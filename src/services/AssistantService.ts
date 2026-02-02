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
  personality: "motivador" | "neutro" | "zen" | "humorístico";
  flowProtection: boolean; // Don't interrupt during flow state
  contextualMessages: boolean; // File-type specific messages
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
      personality: "motivador",
      flowProtection: true,
      contextualMessages: true,
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
      return {
        type: "fatigue",
        message: this.getPersonalityMessage("fatigue"),
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
      return {
        type: "drift",
        message: this.getPersonalityMessage("drift"),
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
      return {
        type: "motivation",
        message: this.getPersonalityMessage("motivation"),
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

    // Deep Work protection
    if (state.deepWork?.active && insight.priority !== "high") {
      return false;
    }

    // Flow State protection
    if (this.config.flowProtection && this.isInFlowState(state)) {
      // Only allow high priority messages and celebrations during flow
      if (insight.priority !== "high" && insight.type !== "celebration") {
        return false;
      }
    }

    // Adaptive cooldown based on insight type
    const cooldown = this.getAdaptiveCooldown(insight);
    const currentTime = Date.now();
    if (currentTime - this.lastMessageTime < cooldown) {
      return false;
    }

    this.lastMessageTime = currentTime;
    return true;
  }

  private isInFlowState(state: any): boolean {
    const focus = state.focus;
    const session = state.session;

    if (!focus || !session) return false;

    // Flow state criteria:
    // 1. High focus score (>= 75)
    // 2. Recent activity (edits in last 5 min)
    // 3. Low context switching (< 3 switches in last 10 min)
    // 4. Minimum session duration (>= 15 min)
    const sessionDuration = (Date.now() - (session.startTime || 0)) / (1000 * 60);

    return (
      focus.averageScore >= 75 &&
      focus.sessionEdits >= 10 &&
      focus.sessionSwitches < 3 &&
      sessionDuration >= 15
    );
  }

  private getAdaptiveCooldown(insight: AssistantInsight): number {
    const baseTime = this.config.messageCooldown * 60 * 1000;

    // Celebrations: short cooldown (don't want to miss achievements)
    if (insight.type === "celebration") {
      return baseTime * 0.3;
    }

    // Fatigue/Warning: long cooldown (already bothered user)
    if (insight.type === "fatigue" || insight.type === "warning") {
      return baseTime * 2;
    }

    // Motivation: medium cooldown
    if (insight.type === "motivation") {
      return baseTime * 1.5;
    }

    // During flow: extra long cooldown
    const state = this.stateManager.getState();
    if (this.isInFlowState(state)) {
      return baseTime * 3;
    }

    return baseTime;
  }

  private detectFileContext(fileName: string): string {
    if (!fileName) return "general";

    const lower = fileName.toLowerCase();

    // Test files
    if (lower.includes(".test.") || lower.includes(".spec.") || lower.includes("test/") || lower.includes("__tests__/")) {
      return "test";
    }

    // Configuration files
    if (lower.includes("config") || lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".toml")) {
      return "config";
    }

    // Documentation
    if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.includes("readme") || lower.includes("doc")) {
      return "documentation";
    }

    // Frontend files
    if (lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.endsWith(".vue") || lower.endsWith(".svelte") || lower.endsWith(".html") || lower.endsWith(".css") || lower.endsWith(".scss")) {
      return "frontend";
    }

    // Backend files
    if (lower.includes("api/") || lower.includes("server/") || lower.includes("backend/") || lower.includes("service")) {
      return "backend";
    }

    return "general";
  }

  private getPersonalityMessage(
    type: "fatigue" | "drift" | "motivation" | "tip",
    context?: string
  ): string {
    const messages = {
      motivador: {
        fatigue: [
          "¡Campeón! Has trabajado duro. Una pausa corta te hará más productivo 💪",
          "¡Gran esfuerzo! Tu cerebro necesita recargarse. Un descanso y vuelves con todo 🔋",
          "¡Excelente sesión! Tómate 5 minutos, te los has ganado 🌟"
        ],
        drift: [
          "¡Enfoca esa energía! Vuelve al archivo principal y destroza esa tarea 🎯",
          "¡Tú puedes! Elige un archivo y dale con todo. Un paso a la vez 🚀",
          "¡Concentración! Sé que puedes mantener el foco. Vamos 💪"
        ],
        motivation: [
          "¡INCREÍBLE! Estás arrasando. Sigue así, campeón 🔥",
          "¡WOW! Tu nivel de concentración es épico. No pares ahora 🚀",
          "¡BESTIAL! Estás en tu mejor momento. A por más 💪"
        ],
        tip: [
          "💡 Pro tip: Los breaks de 5 min cada 25 min potencian tu rendimiento",
          "🎯 Secreto: Una tarea a la vez. Multitasking = enemigo del foco"
        ]
      },
      zen: {
        fatigue: [
          "El descanso es parte del trabajo. Respira hondo, camina 5 minutos 🍃",
          "Tu mente necesita espacio. Una pausa consciente restaura la claridad 🧘",
          "Observa el cansancio sin juzgar. Un break te devolverá al presente 🌊"
        ],
        drift: [
          "La mente divaga. Observa sin juzgar, luego regresa al presente 🧘",
          "Como agua que fluye, vuelve suavemente al cauce principal 🌊",
          "Nota la distracción, respira, regresa al foco con compasión 🍃"
        ],
        motivation: [
          "Fluyes con el trabajo. Esta es la esencia del flow 🌊",
          "Presente y enfocado. El camino se revela paso a paso 🍃",
          "En equilibrio con la tarea. Continúa con esta presencia 🧘"
        ],
        tip: [
          "🍃 Respiración consciente: 3 respiros profundos antes de cada tarea",
          "🌊 El foco es un músculo. Se entrena con paciencia y constancia"
        ]
      },
      humorístico: {
        fatigue: [
          "Tu cerebro está pidiendo café a gritos ☕️ (o un power nap)",
          "Alerta: Niveles de café peligrosamente bajos. ¡Break time! ☕",
          "¿Cansado? Yo también... y soy una IA. Imagínate tú 😅"
        ],
        drift: [
          "¿Perdido en tabs? Pareces yo buscando las llaves del coche 🔑",
          "Tab switching nivel: DJ haciendo scratch 🎵 Vuelve al beat principal",
          "Houston, tenemos un problema de focus 🚀 ¡A tierra otra vez!"
        ],
        motivation: [
          "¡MODO BESTIA ACTIVADO! 🦁 Sigues imparable",
          "¿Eres humano o máquina? Porque estás ON FIRE 🔥",
          "Plot twist: Tú eres el protagonista y estás ganando 🎮"
        ],
        tip: [
          "🍕 Break = recarga de superpoderes. No lo saltes, héroe",
          "🎮 Productividad es un juego. Tú vs. Distracciones. Estás ganando"
        ]
      },
      neutro: {
        fatigue: [
          "Llevas tiempo trabajando. Considera tomar un descanso breve",
          "Tu sesión ha sido larga. Un break de 5-10 minutos es recomendable",
          "Tiempo de descanso. Las pausas mejoran el rendimiento general"
        ],
        drift: [
          "Detectados múltiples cambios de archivo. Concéntrate en uno principal",
          "Alto nivel de context switching. Reduce cambios para mejor foco",
          "Considera trabajar en un archivo por vez para mantener concentración"
        ],
        motivation: [
          "Excelente nivel de concentración. Continúa con este ritmo",
          "Tu score de foco es alto. Buen trabajo",
          "Rendimiento óptimo detectado. Mantén este enfoque"
        ],
        tip: [
          "Técnica Pomodoro: 25 min trabajo + 5 min break = productividad",
          "Un archivo a la vez reduce carga cognitiva y mejora resultados"
        ]
      }
    };

    const personality = this.config.personality;
    const messageSet = messages[personality][type];
    return messageSet[Math.floor(Math.random() * messageSet.length)];
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
