import * as vscode from "vscode";
import { getEventBus } from "../events";
import { getStateManager } from "../state/StateManager";
import { FOCUS_EVENTS } from "../events/EventTypes";
import { DashboardData, FocusSummary } from "../webview/types";

export interface AssistantInsight {
  type: 'fatigue' | 'drift' | 'motivation' | 'celebration' | 'warning' | 'tip';
  message: string;
  priority: 'low' | 'medium' | 'high';
  state: 'IDLE' | 'FOCUSED' | 'WARNING';
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
      messageCooldown: 5 // 5 minutes between messages
    };
  }

  private setupEventListeners(): void {
    // Listen for achievement unlocks
    this.eventBus.on(FOCUS_EVENTS.ACHIEVEMENT_UNLOCKED, (data: any) => {
      if (this.config.enableCelebrations) {
        this.triggerCelebration('achievement', data);
      }
    });

    // Listen for level ups
    this.eventBus.on(FOCUS_EVENTS.LEVEL_UP, (data: any) => {
      if (this.config.enableCelebrations) {
        this.triggerCelebration('level', data);
      }
    });

    // Listen for deep work events
    this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_STARTED, (data: any) => {
      this.triggerDeepWorkStart(data);
    });

    this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_ENDED, (data: any) => {
      this.triggerDeepWorkComplete(data);
    });

    // Listen for pomodoro events
    this.eventBus.on(FOCUS_EVENTS.POMODORO_COMPLETED, (data: any) => {
      this.triggerPomodoroComplete(data);
    });

    // Listen for session updates
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
        data
      });
    }
  }

  private triggerCelebration(type: 'achievement' | 'level' | 'streak', details: any): void {
    const celebrationMessages = {
      achievement: [
        "🎉 ¡Increíble! Has desbloqueado un nuevo logro",
        "🏆 ¡Eres una máquina! Nuevo logro conseguido",
        "⭐ ¡Brillante! Tu esfuerzo ha sido recompensado"
      ],
      level: [
        "🚀 ¡Nivel superior! Sigue creciendo",
        "⬆️ ¡Subiendo de nivel! Tu progreso es impresionante",
        "📈 ¡Nuevo nivel alcanzado! No te detengas ahora"
      ],
      streak: [
        "🔥 ¡Racha intacta! Tu constancia es admirable",
        "💪 ¡Sigue así! Tu racha continúa",
        "⚡ ¡Imparable! Tu racha sigue creciendo"
      ]
    };

    const messages = celebrationMessages[type];
    const message = messages[Math.floor(Math.random() * messages.length)];

    this.sendMessage('celebrate', {
      type,
      message,
      details
    });
  }

  private triggerDeepWorkStart(data: any): void {
    this.sendMessage('show', {
      message: "🧠 ¡Modo Deep Work activado! Cero distracciones, máximo enfoque",
      state: 'FOCUSED',
      duration: 3000
    });
  }

  private triggerDeepWorkComplete(data: any): void {
    const duration = data.duration || 60;
    const score = data.score || 0;
    
    this.sendMessage('show', {
      message: `✅ ¡Deep Work completado! ${duration}min de concentración pura (Score: ${score})`,
      state: 'FOCUSED',
      duration: 5000
    });
  }

  private triggerPomodoroComplete(data: any): void {
    const cycle = data.cycle || 1;
    this.sendMessage('show', {
      message: `🍅 ¡Pomodoro #${cycle} completado! Tiempo de un pequeño descanso`,
      state: 'IDLE',
      duration: 4000
    });
  }

  private analyzeSessionData(sessionData: any): void {
    const state = this.stateManager.getState();
    const insights = this.generateInsights(state, sessionData);
    
    // Send insights to webview
    insights.forEach(insight => {
      if (this.shouldSendMessage(insight)) {
        this.sendMessage('show', {
          message: insight.message,
          state: insight.state,
          duration: this.getDurationForType(insight.type)
        });
      }
    });
  }

  generateInsights(state: any, sessionData?: any): AssistantInsight[] {
    const insights: AssistantInsight[] = [];
    const currentTime = Date.now();

    // Check cooldown
    if (currentTime - this.lastMessageTime < this.config.messageCooldown * 60 * 1000) {
      return insights;
    }

    // Fatigue detection
    if (this.config.enableFatigueDetection) {
      const fatigueInsight = this.detectFatigue(state);
      if (fatigueInsight) insights.push(fatigueInsight);
    }

    // Drift detection
    if (this.config.enableDriftDetection) {
      const driftInsight = this.detectDrift(state);
      if (driftInsight) insights.push(driftInsight);
    }

    // Motivation messages
    if (this.config.enableMotivationMessages) {
      const motivationInsight = this.detectMotivation(state);
      if (motivationInsight) insights.push(motivationInsight);
    }

    // Goal progress
    const goalInsight = this.analyzeGoalProgress(state);
    if (goalInsight) insights.push(goalInsight);

    return insights;
  }

  private detectFatigue(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session || !session.startTime) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60); // minutes

    if (sessionDuration > this.config.sessionTimeThreshold) {
      const fatigueMessages = [
        "⏰ Llevas más de 90 minutos trabajando. ¿Un descanso?",
        "😴 ¿Tus ojos necesitan un break? Un pomodoro de 5min te ayudará",
        "🧘‍♂️ Tu cerebro agradece pausas. ¿Estiramiento o café?",
        "⚡ Recarga energías. Un descanso corto te hará más productivo"
      ];

      return {
        type: 'fatigue',
        message: fatigueMessages[Math.floor(Math.random() * fatigueMessages.length)],
        priority: 'medium',
        state: 'WARNING',
        data: { sessionDuration }
      };
    }

    return null;
  }

  private detectDrift(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60); // minutes
    const switchesPerMinute = sessionDuration > 0 ? session.totalSwitches / sessionDuration : 0;

    if (switchesPerMinute > this.config.driftThreshold) {
      const driftMessages = [
        "🔄 Muchos cambios de archivo detectados. Intenta enfocarte en una tarea",
        "📂 ¿Saltando mucho? Elige un archivo y concéntrate 25min en él",
        "🎯 El multitasking reduce tu productividad. Una tarea a la vez",
        "🧠 Tu cerebro prefiere el enfoque profundo. Evita los cambios constantes"
      ];

      return {
        type: 'drift',
        message: driftMessages[Math.floor(Math.random() * driftMessages.length)],
        priority: 'medium',
        state: 'WARNING',
        data: { switchesPerMinute, totalSwitches: session.totalSwitches }
      };
    }

    return null;
  }

  private detectMotivation(state: any): AssistantInsight | null {
    const focus = state.focus;
    if (!focus || !focus.averageScore) return null;

    const avgScore = focus.averageScore;

    if (avgScore >= this.config.motivationThreshold) {
      const motivationMessages = [
        "🔥 ¡Estás en la zona! No te detengas ahora",
        "⚡ ¡Excelente enfoque! Sigue con ese ritmo",
        "🚀 ¡Productividad máxima! Tu concentración es impresionante",
        "💪 ¡Increíble! Estás rindiendo al máximo nivel"
      ];

      return {
        type: 'motivation',
        message: motivationMessages[Math.floor(Math.random() * motivationMessages.length)],
        priority: 'low',
        state: 'FOCUSED',
        data: { avgScore }
      };
    }

    return null;
  }

  private analyzeGoalProgress(state: any): AssistantInsight | null {
    const goals = state.goals;
    if (!goals || !goals.enabled) return null;

    const minutesProgress = (goals.minutesDone / goals.targetMinutes) * 100;
    const pomodorosProgress = goals.targetPomodoros > 0 
      ? (goals.pomodorosDone / goals.targetPomodoros) * 100 
      : 100;

    // Near completion
    if (minutesProgress > 80 && pomodorosProgress > 80 && !goals.allDone) {
      return {
        type: 'tip',
        message: "🎯 ¡Casi completas los objetivos de hoy! Un último esfuerzo 💪",
        priority: 'medium',
        state: 'FOCUSED',
        data: { minutesProgress, pomodorosProgress }
      };
    }

    // Halfway there
    if (minutesProgress > 40 && minutesProgress < 60 && !goals.doneMinutes) {
      return {
        type: 'tip',
        message: "📈 ¡Vas por buen camino! Ya completaste más del 50% de tus minutos",
        priority: 'low',
        state: 'IDLE',
        data: { minutesProgress }
      };
    }

    return null;
  }

  private shouldSendMessage(insight: AssistantInsight): boolean {
    // Don't send messages during deep work unless high priority
    const state = this.stateManager.getState();
    if (state.deepWork?.active && insight.priority !== 'high') {
      return false;
    }

    // Check cooldown
    const currentTime = Date.now();
    if (currentTime - this.lastMessageTime < this.config.messageCooldown * 60 * 1000) {
      return false;
    }

    // Update last message time
    this.lastMessageTime = currentTime;
    return true;
  }

  private getDurationForType(type: string): number {
    const durations: Record<string, number> = {
      'fatigue': 4000,
      'drift': 4000,
      'motivation': 3000,
      'celebration': 5000,
      'warning': 4000,
      'tip': 3000
    };

    return durations[type] || 3000;
  }

  // Public API methods
  analyzeDashboardData(data: DashboardData): void {
    const insights = this.generateInsightsFromDashboard(data);
    
    insights.forEach(insight => {
      if (this.shouldSendMessage(insight)) {
        this.sendMessage('show', {
          message: insight.message,
          state: insight.state,
          duration: this.getDurationForType(insight.type)
        });
      }
    });
  }

  private generateInsightsFromDashboard(data: DashboardData): AssistantInsight[] {
    const insights: AssistantInsight[] = [];

    if (!data.stats || data.stats.length === 0) {
      return insights;
    }

    // Analyze focus scores
    const avgScore = data.stats.reduce((sum, stat) => sum + stat.score, 0) / data.stats.length;
    if (avgScore >= this.config.motivationThreshold) {
      insights.push({
        type: 'motivation',
        message: "🔥 ¡Excelente enfoque general! Tu productividad está en su punto máximo",
        priority: 'low',
        state: 'FOCUSED',
        data: { avgScore }
      });
    }

    // Analyze file switching
    const totalSwitches = data.stats.reduce((sum, stat) => sum + stat.switches, 0);
    const totalTime = data.stats.reduce((sum, stat) => sum + this.parseTimeToMinutes(stat.timeText), 0);
    const switchesPerMinute = totalTime > 0 ? totalSwitches / totalTime : 0;

    if (switchesPerMinute > this.config.driftThreshold) {
      insights.push({
        type: 'drift',
        message: "🔄 Detectados muchos cambios de archivo. Intenta bloques de enfoque más largos",
        priority: 'medium',
        state: 'WARNING',
        data: { switchesPerMinute }
      });
    }

    // Check streak
    if (data.streak > 0 && data.streak % 7 === 0) {
      insights.push({
        type: 'celebration',
        message: `🔥 ¡${data.streak} días de racha! Eres increíblemente constante`,
        priority: 'high',
        state: 'FOCUSED',
        data: { streak: data.streak }
      });
    }

    return insights;
  }

  private parseTimeToMinutes(timeText: string): number {
    const match = timeText.match(/(\d+)m?\s*(\d*)s?/);
    if (!match) return 0;
    
    const minutes = parseInt(match[1]) || 0;
    const seconds = parseInt(match[2]) || 0;
    return minutes + seconds / 60;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<AssistantConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AssistantConfig {
    return { ...this.config };
  }

  // Manual trigger methods
  triggerManualInsight(type: string, customMessage?: string): void {
    const insights: Record<string, string> = {
      'fatigue': "⏰ Recuerda tomar pausas regulares para mantener tu productividad",
      'drift': "🎯 Concéntrate en una tarea a la vez para mejores resultados",
      'motivation': "💪 ¡Tú puedes! Cada línea de código te acerca a tu meta",
      'tip': "💡 El trabajo profundo es donde ocurre la magia"
    };

    const message = customMessage || insights[type] || "🤖 Deepy está aquí para ayudarte";
    const state = type === 'fatigue' || type === 'drift' ? 'WARNING' : 'IDLE';

    this.sendMessage('show', {
      message,
      state,
      duration: 4000
    });
  }

  destroy(): void {
    // Cleanup event listeners
    // Note: In the current implementation, event listeners are not automatically cleaned up
    // This would need to be enhanced in a production environment
  }
}