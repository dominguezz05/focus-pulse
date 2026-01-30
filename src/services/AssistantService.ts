import * as vscode from "vscode";
import { getEventBus } from "../events";
import { getStateManager } from "../state/StateManager";
import { FOCUS_EVENTS } from "../events/EventTypes";
import { DashboardData, FocusSummary } from "../webview/types";

export interface AssistantInsight {
  type: "fatigue" | "drift" | "motivation" | "celebration" | "warning" | "tip";
  message: string;
  priority: "low" | "medium" | "high";
  state: "IDLE" | "FOCUSED" | "WARNING" | "SUCCESS";
  data?: any;
}

export interface AssistantConfig {
  enableFatigueDetection: boolean;
  enableDriftDetection: boolean;
  enableMotivationMessages: boolean;
  enableCelebrations: boolean;
  sessionTimeThreshold: number; // minutes
  driftThreshold: number; // switches per minute
  motivationThreshold: number; // focus score
  messageCooldown: number; // minutes between messages
}

export class AssistantService {
  private static instance: AssistantService;
  private eventBus = getEventBus();
  private stateManager = getStateManager();
  private lastMessageTime = 0;
  private config: AssistantConfig;
  private webviewPanel: vscode.WebviewPanel | undefined;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.setupEventListeners();
  }

  static getInstance(): AssistantService {
    if (!AssistantService.instance) {
      AssistantService.instance = new AssistantService();
    }
    return AssistantService.instance;
  }

  private getDefaultConfig(): AssistantConfig {
    return {
      enableFatigueDetection: true,
      enableDriftDetection: true,
      enableMotivationMessages: true,
      enableCelebrations: true,
      sessionTimeThreshold: 90, // 90 minutes
      driftThreshold: 2, // 2 switches per minute
      motivationThreshold: 80, // 80+ focus score
      messageCooldown: 5, // 5 minutes between messages
    };
  }

  private setupEventListeners(): void {
    // Escuchar desbloqueo de logros
    this.eventBus.on(FOCUS_EVENTS.ACHIEVEMENT_UNLOCKED, (data: any) => {
      if (this.config.enableCelebrations) {
        this.triggerCelebration("achievement", data);
      }
    });

    // Escuchar subidas de nivel
    this.eventBus.on(FOCUS_EVENTS.LEVEL_UP, (data: any) => {
      if (this.config.enableCelebrations) {
        this.triggerCelebration("level", data);
      }
    });

    // Escuchar eventos de Deep Work
    this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_STARTED, (data: any) => {
      this.triggerDeepWorkStart(data);
    });

    this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_ENDED, (data: any) => {
      this.triggerDeepWorkComplete(data);
    });

    // Escuchar eventos de Pomodoro
    this.eventBus.on(FOCUS_EVENTS.POMODORO_COMPLETED, (data: any) => {
      this.triggerPomodoroComplete(data);
    });

    // Escuchar actualizaciones de sesión
    this.eventBus.on(FOCUS_EVENTS.SESSION_UPDATED, (data: any) => {
      this.analyzeSessionData(data);
    });
  }

  setWebviewPanel(panel: vscode.WebviewPanel): void {
    this.webviewPanel = panel;
  }

  private sendMessage(type: string, data: any): void {
    if (this.webviewPanel) {
      this.webviewPanel.webview.postMessage({
        type: `assistant:${type}`,
        data,
      });
    }
  }

  private triggerCelebration(
    type: "achievement" | "level" | "streak",
    details: any,
  ): void {
    const celebrationMessages = {
      achievement: [
        `¡Increíble! Has desbloqueado: ${details?.title || "nuevo logro"}`,
        "¡Eres una máquina! Nuevo logro conseguido",
        "¡Brillante! Tu esfuerzo ha sido recompensado",
      ],
      level: [
        `¡Nivel ${details?.level || "superior"} alcanzado! Sigue creciendo`,
        "¡Subiendo de nivel! Tu progreso es impresionante",
        "¡Nuevo nivel alcanzado! No te detengas ahora",
      ],
      streak: [
        `¡Racha de ${details?.days || "varios"} días intacta! Tu constancia es admirable`,
        "¡Sigue así! Tu racha continúa firme",
        "¡Imparable! Tu racha sigue creciendo",
      ],
    };

    const messages = celebrationMessages[type];
    const message = messages[Math.floor(Math.random() * messages.length)];

    // Usamos el estado SUCCESS para activar la animación de Level Up
    this.sendMessage("show", {
      message,
      state: "SUCCESS",
      duration: 5000,
    });
  }

  private triggerDeepWorkStart(data: any): void {
    const duration = data.duration || "ilimitado";
    this.sendMessage("show", {
      message: `¡Modo Deep Work activado! Sesión de ${duration} minutos sin distracciones`,
      state: "FOCUSED",
      duration: 3000,
    });
  }

  private triggerDeepWorkComplete(data: any): void {
    const duration = data.duration || 60;
    const score = data.score || 0;

    this.sendMessage("show", {
      message: `¡Deep Work completado! ${duration} minutos de concentración pura (Score: ${score})`,
      state: "SUCCESS",
      duration: 5000,
    });
  }

  private triggerPomodoroComplete(data: any): void {
    const cycle = data.cycle || 1;
    this.sendMessage("show", {
      message: `¡Pomodoro número ${cycle} completado! Tiempo de un pequeño descanso`,
      state: "IDLE",
      duration: 4000,
    });
  }

  private analyzeSessionData(sessionData: any): void {
    const state = this.stateManager.getState();
    const insights = this.generateInsights(state, sessionData);

    insights.forEach((insight) => {
      if (this.shouldSendMessage(insight)) {
        this.sendMessage("show", {
          message: insight.message,
          state: insight.state,
          duration: this.getDurationForType(insight.type),
        });
      }
    });
  }

  generateInsights(state: any, sessionData?: any): AssistantInsight[] {
    const insights: AssistantInsight[] = [];
    const currentTime = Date.now();

    if (
      currentTime - this.lastMessageTime <
      this.config.messageCooldown * 60 * 1000
    ) {
      return insights;
    }

    if (this.config.enableFatigueDetection) {
      const fatigueInsight = this.detectFatigue(state);
      if (fatigueInsight) insights.push(fatigueInsight);
    }

    if (this.config.enableDriftDetection) {
      const driftInsight = this.detectDrift(state);
      if (driftInsight) insights.push(driftInsight);
    }

    if (this.config.enableMotivationMessages) {
      const motivationInsight = this.detectMotivation(state);
      if (motivationInsight) insights.push(motivationInsight);
    }

    const goalInsight = this.analyzeGoalProgress(state);
    if (goalInsight) insights.push(goalInsight);

    return insights;
  }

  private detectFatigue(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session || !session.startTime) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60);

    if (sessionDuration > this.config.sessionTimeThreshold) {
      const fatigueMessages = [
        `Llevas ${Math.round(sessionDuration)} minutos trabajando. ¿Un descanso?`,
        "Tus ojos necesitan un break. Un descanso te ayudará",
        "Tu cerebro agradece pausas. ¿Estiramiento o café?",
        "Recarga energías. Un descanso corto te hará más productivo",
      ];

      return {
        type: "fatigue",
        message:
          fatigueMessages[Math.floor(Math.random() * fatigueMessages.length)],
        priority: "medium",
        state: "WARNING",
        data: { sessionDuration },
      };
    }
    return null;
  }

  private detectDrift(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60);
    const switchesPerMinute =
      sessionDuration > 0 ? session.totalSwitches / sessionDuration : 0;

    if (switchesPerMinute > this.config.driftThreshold) {
      const driftMessages = [
        `${Math.round(switchesPerMinute)} cambios por minuto detectados. Intenta enfocarte`,
        `¿Saltando mucho? ${session.totalSwitches} cambios en ${Math.round(sessionDuration)} minutos. Elige un archivo`,
        "El multitasking reduce tu productividad. Una tarea a la vez",
        "Tu cerebro prefiere el enfoque profundo",
      ];

      return {
        type: "drift",
        message:
          driftMessages[Math.floor(Math.random() * driftMessages.length)],
        priority: "medium",
        state: "WARNING",
        data: { switchesPerMinute, totalSwitches: session.totalSwitches },
      };
    }
    return null;
  }

  private detectMotivation(state: any): AssistantInsight | null {
    const focus = state.focus;
    if (!focus || !focus.averageScore) return null;

    if (focus.averageScore >= this.config.motivationThreshold) {
      const motivationMessages = [
        "¡Estás en la zona! No te detengas ahora",
        `¡Excelente enfoque! Score de ${Math.round(focus.averageScore)}/100`,
        "¡Productividad máxima! Concentración impresionante",
        "¡Increíble! Estás rindiendo al máximo",
      ];

      return {
        type: "motivation",
        message:
          motivationMessages[
            Math.floor(Math.random() * motivationMessages.length)
          ],
        priority: "low",
        state: "FOCUSED",
        data: { avgScore: focus.averageScore },
      };
    }
    return null;
  }

  private analyzeGoalProgress(state: any): AssistantInsight | null {
    const goals = state.goals;
    if (!goals || !goals.enabled) return null;

    const minutesProgress = (goals.minutesDone / goals.targetMinutes) * 100;
    const pomodorosProgress =
      goals.targetPomodoros > 0
        ? (goals.pomodorosDone / goals.targetPomodoros) * 100
        : 100;

    if (minutesProgress > 80 && pomodorosProgress > 80 && !goals.allDone) {
      return {
        type: "tip",
        message: `¡Casi completas los objetivos de hoy! ${Math.round(minutesProgress)}% minutos y ${Math.round(pomodorosProgress)}% pomodoros`,
        priority: "medium",
        state: "FOCUSED",
        data: { minutesProgress, pomodorosProgress },
      };
    }

    if (minutesProgress > 40 && minutesProgress < 60 && !goals.doneMinutes) {
      return {
        type: "tip",
        message: `¡Vas por buen camino! ${Math.round(minutesProgress)}% del tiempo objetivo completado`,
        priority: "low",
        state: "IDLE",
        data: { minutesProgress },
      };
    }
    return null;
  }

  private shouldSendMessage(insight: AssistantInsight): boolean {
    const state = this.stateManager.getState();
    if (state.deepWork?.active && insight.priority !== "high") {
      return false;
    }

    const currentTime = Date.now();
    if (
      currentTime - this.lastMessageTime <
      this.config.messageCooldown * 60 * 1000
    ) {
      return false;
    }

    this.lastMessageTime = currentTime;
    return true;
  }

  private getDurationForType(type: string): number {
    const durations: Record<string, number> = {
      fatigue: 4000,
      drift: 4000,
      motivation: 3000,
      celebration: 5000,
      warning: 4000,
      tip: 3000,
    };
    return durations[type] || 3000;
  }

  analyzeDashboardData(data: DashboardData): void {
    const insights = this.generateInsightsFromDashboard(data);
    insights.forEach((insight) => {
      if (this.shouldSendMessage(insight)) {
        this.sendMessage("show", {
          message: insight.message,
          state: insight.state,
          duration: this.getDurationForType(insight.type),
        });
      }
    });
  }

  private generateInsightsFromDashboard(
    data: DashboardData,
  ): AssistantInsight[] {
    const insights: AssistantInsight[] = [];
    if (!data.stats || data.stats.length === 0) return insights;

    const avgScore =
      data.stats.reduce((sum, stat) => sum + stat.score, 0) / data.stats.length;
    if (avgScore >= this.config.motivationThreshold) {
      insights.push({
        type: "motivation",
        message: `¡Excelente enfoque general! Score promedio: ${Math.round(avgScore)}/100`,
        priority: "low",
        state: "FOCUSED",
        data: { avgScore },
      });
    }

    if (data.streak > 0 && data.streak % 7 === 0) {
      insights.push({
        type: "celebration",
        message: `¡${data.streak} días seguidos de productividad! Eres constante`,
        priority: "high",
        state: "SUCCESS",
        data: { streak: data.streak },
      });
    }

    return insights;
  }

  updateConfig(newConfig: Partial<AssistantConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AssistantConfig {
    return { ...this.config };
  }

  triggerManualInsight(type: string, customMessage?: string): void {
    const insights: Record<string, string> = {
      fatigue: "Recuerda tomar pausas regulares",
      drift: "Concéntrate en una tarea a la vez",
      motivation: "¡Tú puedes! Falta poco",
      tip: "El trabajo profundo es la clave",
    };

    const message = customMessage || insights[type] || "Deepy está aquí para ayudarte";
    const state = type === "fatigue" || type === "drift" ? "WARNING" : "IDLE";

    this.sendMessage("show", {
      message,
      state,
      duration: 4000,
    });
  }

  destroy(): void {
    // Cleanup opcional
  }
}
