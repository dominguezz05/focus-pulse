import * as vscode from "vscode";
import { getEventBus } from "../events";
import { getStateManager } from "../state/StateManager";
import { FOCUS_EVENTS } from "../events/EventTypes";
import { DashboardData, FocusSummary } from "../webview/types";
import { PeakPerformanceAnalyzer } from "./PeakPerformanceAnalyzer";
import { GitAnalysisService, GitActivityInsight } from "./GitAnalysisService";
import { HistoryDay } from "../storage";

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
  private scoreHistory: Array<{ timestamp: number; score: number }> = [];
  private peakAnalyzer = PeakPerformanceAnalyzer.getInstance();
  private gitAnalyzer = GitAnalysisService.getInstance();
  private lastPeakAnalysisMessage = 0;
  private gitCheckInterval: NodeJS.Timeout | undefined;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.setupEventListeners();
    this.startGitMonitoring();
  }

  static getInstance(): AssistantService {
    if (!AssistantService.instance) {
      AssistantService.instance = new AssistantService();
    }
    return AssistantService.instance;
  }

  private getDefaultConfig(): AssistantConfig {
    // Intentar leer configuración desde VS Code settings
    const config = vscode.workspace.getConfiguration("focusPulse");

    return {
      enableFatigueDetection: true,
      enableDriftDetection: true,
      enableMotivationMessages: true,
      enableCelebrations: true,
      sessionTimeThreshold: 90, // 90 minutes
      driftThreshold: 2, // 2 switches per minute
      motivationThreshold: 80, // 80+ focus score
      messageCooldown: 5, // 5 minutes between messages
      personality: config.get<"motivador" | "neutro" | "zen" | "humorístico">("assistant.personality", "motivador"),
      flowProtection: config.get<boolean>("assistant.flowProtection", true),
      contextualMessages: config.get<boolean>("assistant.contextualMessages", true),
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

    // Actualizar historial de scores para análisis predictivo
    if (state.focus?.averageScore) {
      this.updateScoreHistory(state.focus.averageScore);
    }

    if (
      currentTime - this.lastMessageTime <
      this.config.messageCooldown * 60 * 1000
    ) {
      return insights;
    }

    // NUEVA: Detección predictiva de fatiga (alertar ANTES de que ocurra)
    if (this.config.enableFatigueDetection) {
      const predictiveInsight = this.predictFatigue(state);
      if (predictiveInsight) insights.push(predictiveInsight);

      // Detección normal de fatiga (cuando ya ocurrió)
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

  private updateScoreHistory(score: number): void {
    const now = Date.now();
    this.scoreHistory.push({ timestamp: now, score });

    // Mantener solo los últimos 30 minutos de historial
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    this.scoreHistory = this.scoreHistory.filter(
      entry => entry.timestamp > thirtyMinutesAgo
    );
  }

  private calculateScoreDecline(): number {
    if (this.scoreHistory.length < 5) return 0;

    // Calcular tendencia de decline usando los últimos 10 minutos
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const recentScores = this.scoreHistory.filter(
      entry => entry.timestamp > tenMinutesAgo
    );

    if (recentScores.length < 3) return 0;

    // Calcular la pendiente de decline (regression lineal simple)
    const n = recentScores.length;
    const sumX = recentScores.reduce((sum, entry, i) => sum + i, 0);
    const sumY = recentScores.reduce((sum, entry) => sum + entry.score, 0);
    const sumXY = recentScores.reduce((sum, entry, i) => sum + i * entry.score, 0);
    const sumX2 = recentScores.reduce((sum, entry, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalizar el slope a un valor entre 0 y 1 (1 = decline muy rápido)
    return Math.abs(Math.min(0, slope)) / 10;
  }

  private predictFatigue(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session || !session.startTime) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60);
    const scoreDeclineRate = this.calculateScoreDecline();
    const currentScore = state.focus?.averageScore || 0;

    // Alertar 10-15 minutos ANTES del umbral de fatiga
    const timeUntilFatigue = this.config.sessionTimeThreshold - sessionDuration;

    // Condiciones para alerta predictiva:
    // 1. Estamos a 10-15 minutos del umbral de fatiga
    // 2. El score está declinando rápidamente (>0.4)
    // 3. El score actual es medio-bajo (<60)
    if (
      timeUntilFatigue > 10 &&
      timeUntilFatigue < 15 &&
      scoreDeclineRate > 0.4 &&
      currentScore < 60
    ) {
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "warning",
        message: this.getPredictiveMessage(scoreDeclineRate, currentFileContext),
        priority: "medium",
        state: "WARNING",
        data: {
          sessionDuration,
          scoreDeclineRate,
          timeUntilFatigue: Math.round(timeUntilFatigue)
        },
      };
    }

    // Alerta temprana si el decline es MUY pronunciado
    if (scoreDeclineRate > 0.7 && currentScore < 50 && sessionDuration > 30) {
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "warning",
        message: `⚠️ Tu foco está cayendo rápido. Considera un break de 5 min antes de continuar`,
        priority: "high",
        state: "WARNING",
        data: { scoreDeclineRate },
      };
    }

    return null;
  }

  private getPredictiveMessage(declineRate: number, context?: string): string {
    const messages = [
      "📉 Detecto que tu enfoque está bajando. ¿Un break preventivo en 10 min?",
      "⏰ Tu score está declinando. Planea un descanso pronto para mantener la calidad",
      "🔮 Predicción: Fatiga en ~10 min. Considera pausar antes de llegar ahí",
      "💡 Tu rendimiento está bajando gradualmente. Un break ahora = mejor productividad después"
    ];

    // Mensajes contextuales según el tipo de archivo
    if (context === "test") {
      return "🧪 Tests requieren precisión. Tu foco está bajando - considera un break antes de continuar";
    } else if (context === "backend") {
      return "🏗️ Lógica crítica necesita enfoque total. Tu score está cayendo - break preventivo recomendado";
    }

    return messages[Math.floor(Math.random() * messages.length)];
  }

  private detectFatigue(state: any): AssistantInsight | null {
    const session = state.session;
    if (!session || !session.startTime) return null;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60);

    if (sessionDuration > this.config.sessionTimeThreshold) {
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "fatigue",
        message: this.getPersonalityMessage("fatigue", currentFileContext),
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
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "drift",
        message: this.getPersonalityMessage("drift", currentFileContext),
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
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "motivation",
        message: this.getPersonalityMessage("motivation", currentFileContext),
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

  private getCurrentFileContext(state: any): string | undefined {
    // Intentar obtener el archivo actual desde vscode
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document) {
      return this.detectFileContext(editor.document.fileName);
    }

    // Fallback: usar el archivo más reciente del focus
    if (state.focus?.topFiles && state.focus.topFiles.length > 0) {
      return this.detectFileContext(state.focus.topFiles[0].name);
    }

    return undefined;
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
    // Si hay contexto específico, usar mensajes contextuales
    if (context && this.config.contextualMessages) {
      const contextualMessage = this.getContextualMessage(type, context);
      if (contextualMessage) return contextualMessage;
    }

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

  private getContextualMessage(
    type: "fatigue" | "drift" | "motivation" | "tip",
    fileContext: string
  ): string | null {
    const contextualMessages: Record<string, Record<string, string[]>> = {
      test: {
        motivation: [
          "¡Tests pasando! Tu código es más sólido ahora 🧪",
          "¡Testing como un pro! La calidad se agradece 🧪",
          "¡TDD en acción! Los tests son tu red de seguridad 🎯"
        ],
        tip: [
          "💡 Recuerda: Un test bien escrito es documentación viva 📚",
          "🧪 Tip: Tests unitarios rápidos = feedback instantáneo",
          "✅ Cobertura > 80% = tranquilidad mental"
        ],
        fatigue: [
          "Escribir tests requiere concentración. Descansa y vuelve con ideas frescas 🧪",
          "Los mejores tests se escriben con mente despejada. Break time ☕"
        ],
        drift: [
          "Focus en los tests actuales. Un caso a la vez 🎯",
          "Testing requiere concentración. Vuelve al archivo de test principal 🧪"
        ]
      },
      frontend: {
        motivation: [
          "¡La UI está tomando forma! 🎨",
          "¡Frontend impecable! Los usuarios lo van a amar 💅",
          "¡Componentes que brillan! Tu UI skills están on fire 🔥"
        ],
        tip: [
          "💡 Considera revisar la accesibilidad (a11y) de este componente ♿",
          "🎨 Tip: Responsive first = usuarios felices en todos los dispositivos",
          "⚡ Performance tip: Lazy loading para componentes pesados"
        ],
        fatigue: [
          "El diseño requiere creatividad fresca. Un break te traerá nuevas ideas 🎨",
          "Los mejores diseños surgen con mente descansada. Tómate un respiro 💅"
        ],
        drift: [
          "Focus en el componente actual. La UI se construye pieza por pieza 🎨",
          "Demasiados componentes abiertos. Enfócate en uno a la vez 💅"
        ]
      },
      backend: {
        motivation: [
          "¡APIs robustas = usuarios felices! 🚀",
          "¡Backend sólido! La arquitectura está impecable 🏗️",
          "¡Lógica de negocio on point! Eres una máquina 💪"
        ],
        tip: [
          "💡 ¿Validaste los edge cases en este endpoint? 🔍",
          "🔒 Security tip: Sanitiza todos los inputs del usuario",
          "⚡ Performance: Considera índices en las queries frecuentes"
        ],
        fatigue: [
          "La lógica compleja requiere mente fresca. Break time para evitar bugs 🐛",
          "Backend crítico necesita concentración total. Descansa y vuelve fuerte 💪"
        ],
        drift: [
          "Focus en este endpoint. Una API a la vez 🎯",
          "Demasiados servicios abiertos. Enfócate en la lógica actual 🏗️"
        ]
      },
      documentation: {
        motivation: [
          "¡Documentando! Futuro tú te lo agradecerá 📝",
          "¡Docs de calidad! El equipo te lo va a agradecer 📚",
          "¡Clarity in writing! Las mejores docs del proyecto 🌟"
        ],
        tip: [
          "💡 Buena docs = menos preguntas en Slack 💬",
          "📚 Tip: Ejemplos de código > mil palabras",
          "✨ Docs actualizadas = equipo productivo"
        ],
        fatigue: [
          "Escribir docs claras requiere mente fresca. Tómate un break 📝",
          "La claridad viene con descanso. Pausa y vuelve con energía 📚"
        ],
        drift: [
          "Focus en esta sección. Docs coherentes se escriben con foco 📝",
          "Un documento a la vez. La claridad requiere concentración 📚"
        ]
      },
      config: {
        motivation: [
          "¡Configuración impecable! El setup es crucial ⚙️",
          "¡Config on point! Todo va a funcionar smooth 🛠️"
        ],
        tip: [
          "💡 Documenta por qué cada config existe. Futuro tú lo agradecerá 📝",
          "⚙️ Tip: Variables de entorno para configs sensibles"
        ],
        fatigue: [
          "Configuraciones requieren precisión. Descansa para evitar errores ⚙️"
        ],
        drift: [
          "Focus en este archivo de config. Uno a la vez 🛠️"
        ]
      }
    };

    const contextMessages = contextualMessages[fileContext];
    if (!contextMessages || !contextMessages[type]) {
      return null;
    }

    const messages = contextMessages[type];
    return messages[Math.floor(Math.random() * messages.length)];
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

  analyzeAndShowPeakPerformance(history: HistoryDay[]): void {
    // Mostrar análisis de horarios solo una vez por día
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - this.lastPeakAnalysisMessage < oneDayMs) {
      return; // Ya mostramos el análisis hoy
    }

    if (history.length < 5) {
      return; // No hay suficientes datos para análisis significativo
    }

    const analysis = this.peakAnalyzer.analyzePeakPerformance(history);
    const currentHour = new Date().getHours();

    // Mostrar recomendación principal
    this.sendMessage("show", {
      message: analysis.recommendation,
      state: "IDLE",
      duration: 6000,
    });

    this.lastPeakAnalysisMessage = now;

    // Mostrar un insight aleatorio después de 8 segundos
    setTimeout(() => {
      if (analysis.insights.length > 0) {
        const randomInsight =
          analysis.insights[
            Math.floor(Math.random() * analysis.insights.length)
          ];
        this.sendMessage("show", {
          message: randomInsight,
          state: "IDLE",
          duration: 5000,
        });
      }
    }, 8000);

    // Si estamos en una hora no óptima, sugerir
    if (!this.peakAnalyzer.isGoodTimeToWork(currentHour, history)) {
      setTimeout(() => {
        this.sendMessage("show", {
          message: `💡 Esta hora (${this.formatHour(currentHour)}) no es tu momento más productivo. Considera tareas más ligeras`,
          state: "IDLE",
          duration: 5000,
        });
      }, 15000);
    }
  }

  checkOptimalWorkTime(history: HistoryDay[]): AssistantInsight | null {
    if (history.length < 3) return null;

    const currentHour = new Date().getHours();
    const isGoodTime = this.peakAnalyzer.isGoodTimeToWork(currentHour, history);
    const analysis = this.peakAnalyzer.analyzePeakPerformance(history);

    // Si no es buen momento Y el usuario está empezando una sesión
    if (!isGoodTime && this.isStartingSession()) {
      return {
        type: "tip",
        message: `⏰ Según tus datos, ${this.formatHour(analysis.bestHour)} es tu mejor hora. Considera tareas ligeras ahora`,
        priority: "low",
        state: "IDLE",
        data: { currentHour, bestHour: analysis.bestHour },
      };
    }

    // Si ES buen momento, motivar
    if (isGoodTime && Math.random() > 0.7) {
      return {
        type: "motivation",
        message: `✨ Estás en tu hora pico de productividad. ¡Aprovecha este momentum!`,
        priority: "low",
        state: "FOCUSED",
        data: { currentHour },
      };
    }

    return null;
  }

  private isStartingSession(): boolean {
    const state = this.stateManager.getState();
    const session = state.session;

    if (!session || !session.startTime) return false;

    const sessionDuration = (Date.now() - session.startTime) / (1000 * 60);
    return sessionDuration < 5; // Primeros 5 minutos de sesión
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:00 ${period}`;
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

  startGitMonitoring(): void {
    // Verificar actividad de git cada 30 segundos
    if (this.gitCheckInterval) {
      clearInterval(this.gitCheckInterval);
    }

    this.gitCheckInterval = setInterval(async () => {
      await this.checkGitActivity();
    }, 30000); // 30 segundos

    // Primera verificación inmediata
    setTimeout(() => this.checkGitActivity(), 5000);
  }

  private async checkGitActivity(): Promise<void> {
    try {
      // Verificar commits recientes
      const recentActivity = await this.gitAnalyzer.checkRecentActivity();
      if (recentActivity && this.config.enableCelebrations) {
        this.celebrateGitActivity(recentActivity);
      }

      // Verificar racha de commits
      const streak = await this.gitAnalyzer.detectCommitStreak();
      if (streak && this.config.enableCelebrations) {
        this.celebrateGitActivity(streak);
      }

      // Verificar PR mergeado
      const prMerge = await this.gitAnalyzer.checkForPRMerge();
      if (prMerge && this.config.enableCelebrations) {
        this.celebrateGitActivity(prMerge);
      }
    } catch (error) {
      // Silenciar errores de git
    }
  }

  private celebrateGitActivity(activity: GitActivityInsight): void {
    let state: "SUCCESS" | "FOCUSED" | "IDLE" = "SUCCESS";

    if (activity.celebrationLevel === "high") {
      state = "SUCCESS";
    } else if (activity.celebrationLevel === "medium") {
      state = "FOCUSED";
    } else {
      state = "IDLE";
    }

    const duration =
      activity.celebrationLevel === "high"
        ? 6000
        : activity.celebrationLevel === "medium"
          ? 4000
          : 3000;

    this.sendMessage("show", {
      message: activity.message,
      state,
      duration,
    });
  }

  async showGitStats(days: number = 7): Promise<void> {
    const stats = await this.gitAnalyzer.getCommitStats(days);

    if (stats.totalCommits === 0) {
      this.sendMessage("show", {
        message: "📊 No hay commits en los últimos días. ¡Es hora de crear algo!",
        state: "IDLE",
        duration: 4000,
      });
      return;
    }

    const message = `📊 Últimos ${days} días: ${stats.totalCommits} commits (${stats.avgCommitsPerDay}/día). Día más productivo: ${stats.mostProductiveDay}`;

    this.sendMessage("show", {
      message,
      state: "FOCUSED",
      duration: 5000,
    });
  }

  stopGitMonitoring(): void {
    if (this.gitCheckInterval) {
      clearInterval(this.gitCheckInterval);
      this.gitCheckInterval = undefined;
    }
  }

  destroy(): void {
    this.stopGitMonitoring();
  }
}
