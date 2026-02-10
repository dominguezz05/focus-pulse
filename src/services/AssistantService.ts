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
  personality: "motivational" | "neutral" | "zen" | "humorous";
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
      personality: config.get<"motivational" | "neutral" | "zen" | "humorous">(
        "assistant.personality",
        "motivational",
      ),
      flowProtection: config.get<boolean>("assistant.flowProtection", true),
      contextualMessages: config.get<boolean>(
        "assistant.contextualMessages",
        true,
      ),
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
        `Incredible! You've unlocked: ${details?.title || "new achievement"}`,
        "You're a machine! New achievement earned",
        "Brilliant! Your effort has been rewarded",
      ],
      level: [
        `Level ${details?.level || "up"} reached! Keep growing`,
        "Level up! Your progress is impressive",
        "New level reached! Don't stop now",
      ],
      streak: [
        `Streak of ${details?.days || "several"} days intact! Your consistency is admirable`,
        "Keep it up! Your streak stays strong",
        "Unstoppable! Your streak continues to grow",
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
      message: `Deep Work mode activated! ${duration}-minute session with zero distractions`,
      state: "FOCUSED",
      duration: 3000,
    });
  }

  private triggerDeepWorkComplete(data: any): void {
    const duration = data.duration || 60;
    const score = data.score || 0;

    this.sendMessage("show", {
      message: `Deep Work complete! ${duration} minutes of pure focus (Score: ${score})`,
      state: "SUCCESS",
      duration: 5000,
    });
  }

  private triggerPomodoroComplete(data: any): void {
    const cycle = data.cycle || 1;
    this.sendMessage("show", {
      message: `Pomodoro number ${cycle} complete! Time for a short break`,
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
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    this.scoreHistory = this.scoreHistory.filter(
      (entry) => entry.timestamp > thirtyMinutesAgo,
    );
  }

  private calculateScoreDecline(): number {
    if (this.scoreHistory.length < 5) return 0;

    // Calcular tendencia de decline usando los últimos 10 minutos
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentScores = this.scoreHistory.filter(
      (entry) => entry.timestamp > tenMinutesAgo,
    );

    if (recentScores.length < 3) return 0;

    // Calcular la pendiente de decline (regression lineal simple)
    const n = recentScores.length;
    const sumX = recentScores.reduce((sum, entry, i) => sum + i, 0);
    const sumY = recentScores.reduce((sum, entry) => sum + entry.score, 0);
    const sumXY = recentScores.reduce(
      (sum, entry, i) => sum + i * entry.score,
      0,
    );
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
        message: this.getPredictiveMessage(
          scoreDeclineRate,
          currentFileContext,
        ),
        priority: "medium",
        state: "WARNING",
        data: {
          sessionDuration,
          scoreDeclineRate,
          timeUntilFatigue: Math.round(timeUntilFatigue),
        },
      };
    }

    // Alerta temprana si el decline es MUY pronunciado
    if (scoreDeclineRate > 0.7 && currentScore < 50 && sessionDuration > 30) {
      const currentFileContext = this.getCurrentFileContext(state);
      return {
        type: "warning",
        message: `⚠️ Your focus is dropping fast. Consider a 5-min break before continuing`,
        priority: "high",
        state: "WARNING",
        data: { scoreDeclineRate },
      };
    }

    return null;
  }

  private getPredictiveMessage(declineRate: number, context?: string): string {
    const messages = [
      "📉 Detecting a drop in your focus. Consider a preventive break in 10 minutes",
      "⏰ Your score is declining. Plan a break soon to maintain quality",
      "🔮 Prediction: Fatigue in ~10 min. Consider pausing before reaching that point",
      "💡 Your performance is gradually declining. A break now = better productivity later",
    ];

    // Mensajes contextuales según el tipo de archivo
    if (context === "test") {
      return "🧪 Tests require precision. Your focus is dropping - consider a break before continuing";
    } else if (context === "backend") {
      return "🏗️ Critical logic needs full focus. Your score is declining - preventive break recommended";
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
        message: `Almost completed today's goals! ${Math.round(minutesProgress)}% minutes and ${Math.round(pomodorosProgress)}% pomodoros`,
        priority: "medium",
        state: "FOCUSED",
        data: { minutesProgress, pomodorosProgress },
      };
    }

    if (minutesProgress > 40 && minutesProgress < 60 && !goals.doneMinutes) {
      return {
        type: "tip",
        message: `You're on a good path! ${Math.round(minutesProgress)}% of target time completed. Keep the momentum going!`,
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
    const sessionDuration =
      (Date.now() - (session.startTime || 0)) / (1000 * 60);

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
    if (
      lower.includes(".test.") ||
      lower.includes(".spec.") ||
      lower.includes("test/") ||
      lower.includes("__tests__/")
    ) {
      return "test";
    }

    // Configuration files
    if (
      lower.includes("config") ||
      lower.endsWith(".json") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".toml")
    ) {
      return "config";
    }

    // Documentation
    if (
      lower.endsWith(".md") ||
      lower.endsWith(".txt") ||
      lower.includes("readme") ||
      lower.includes("doc")
    ) {
      return "documentation";
    }

    // Frontend files
    if (
      lower.endsWith(".tsx") ||
      lower.endsWith(".jsx") ||
      lower.endsWith(".vue") ||
      lower.endsWith(".svelte") ||
      lower.endsWith(".html") ||
      lower.endsWith(".css") ||
      lower.endsWith(".scss")
    ) {
      return "frontend";
    }

    // Backend files
    if (
      lower.includes("api/") ||
      lower.includes("server/") ||
      lower.includes("backend/") ||
      lower.includes("service")
    ) {
      return "backend";
    }

    return "general";
  }

  private getPersonalityMessage(
    type: "fatigue" | "drift" | "motivation" | "tip",
    context?: string,
  ): string {
    // Si hay contexto específico, usar mensajes contextuales
    if (context && this.config.contextualMessages) {
      const contextualMessage = this.getContextualMessage(type, context);
      if (contextualMessage) return contextualMessage;
    }

    const messages = {
      motivational: {
        fatigue: [
          "Champion! You've worked hard. A short break will make you more productive 💪",
          "Great effort! Your brain needs to recharge. Rest and come back stronger 🔋",
          "Excellent session! Take 5 minutes, you've earned them 🌟",
        ],
        drift: [
          "Focus that energy! Return to the main file and crush that task 🎯",
          "You can do it! Choose one file and give it your all. One step at a time 🚀",
          "Concentration! I know you can maintain focus. Let's go 💪",
        ],
        motivation: [
          "INCREDIBLE! You're crushing it. Keep it up, champion 🔥",
          "WOW! Your concentration level is epic. Don't stop now 🚀",
          "BEAST MODE! You're at your best. Go for more 💪",
        ],
        tip: [
          "💡 Pro tip: 5-min breaks every 25 min boost your performance",
          "🎯 Secret: One task at a time. Multitasking = focus enemy",
        ],
      },
      zen: {
        fatigue: [
          "Rest is part of work. Take a deep breath, walk 5 minutes 🍃",
          "Your mind needs space. A mindful pause restores clarity 🧘",
          "Observe fatigue without judgment. A break brings you back to present 🌊",
        ],
        drift: [
          "Mind wanders. Observe without judgment, then return to present 🧘",
          "Like flowing water, gently return to the main channel 🌊",
          "Note the distraction, breathe, return to focus with compassion 🍃",
        ],
        motivation: [
          "You flow with work. This is the essence of flow 🌊",
          "Present and focused. The path reveals itself step by step 🍃",
          "In balance with the task. Continue with this presence 🧘",
        ],
        tip: [
          "🍃 Conscious breathing: 3 deep breaths before each task",
          "🌊 Focus is a muscle. Trained with patience and consistency",
        ],
      },
      humorous: {
        fatigue: [
          "Your brain is screaming for coffee ☕️ (or a power nap)",
          "Warning: Dangerously low caffeine levels. Break time! ☕",
          "Tired? Me too... and I'm an AI. Imagine you 😅",
        ],
        drift: [
          "Lost in tabs? You look like me searching for car keys 🔑",
          "Tab switching level: DJ scratching 🎵 Return to the main beat",
          "Houston, we have a focus problem 🚀 Back to Earth!",
        ],
        motivation: [
          "BEAST MODE ACTIVATED! 🦁 You're unstoppable",
          "Human or machine? Because you're ON FIRE 🔥",
          "Plot twist: You're the protagonist and you're winning 🎮",
        ],
        tip: [
          "🍕 Break = superpower recharge. Don't skip it, hero",
          "🎮 Productivity is a game. You vs. Distractions. You're winning",
        ],
      },
      neutral: {
        fatigue: [
          "You've been working for a while. Consider taking a short break",
          "Your session has been long. A 5-10 minute break is recommended",
          "Rest time. Breaks improve overall performance",
        ],
        drift: [
          "Multiple file changes detected. Focus on one main file",
          "High context switching level. Reduce changes for better focus",
          "Consider working on one file at a time to maintain concentration",
        ],
        motivation: [
          "Excellent concentration level. Continue at this pace",
          "Your focus score is high. Good work",
          "Optimal performance detected. Maintain this focus",
        ],
        tip: [
          "Pomodoro Technique: 25 min work + 5 min break = productivity",
          "One file at a time reduces cognitive load and improves results",
        ],
      },
    };

    const personality = this.config.personality;
    const messageSet = messages[personality][type];
    return messageSet[Math.floor(Math.random() * messageSet.length)];
  }

  private getContextualMessage(
    type: "fatigue" | "drift" | "motivation" | "tip",
    fileContext: string,
  ): string | null {
    const contextualMessages: Record<string, Record<string, string[]>> = {
      test: {
        motivation: [
          "Tests passing! Your code is more solid now 🧪",
          "Testing like a pro! Quality is always appreciated 🧪",
          "TDD in action! Tests are your safety net 🎯",
        ],
        tip: [
          "💡 Remember: A well-written test is living documentation 📚",
          "🧪 Tip: Fast unit tests = instant feedback",
          "✅ Coverage > 80% = peace of mind",
        ],
        fatigue: [
          "Writing tests requires focus. Rest and come back with a fresh perspective 🧪",
          "The best tests are written with a clear mind. Break time ☕",
        ],
        drift: [
          "Focus on the current tests. One case at a time 🎯",
          "Testing requires concentration. Get back to the main test file 🧪",
        ],
      },
      frontend: {
        motivation: [
          "The UI is taking shape! 🎨",
          "Flawless frontend! Users are going to love it 💅",
          "Components that shine! Your UI skills are on fire 🔥",
        ],
        tip: [
          "💡 Consider checking the accessibility (a11y) of this component ♿",
          "🎨 Tip: Responsive first = happy users on all devices",
          "⚡ Performance tip: Lazy loading for heavy components",
        ],
        fatigue: [
          "Design requires fresh creativity. A break will bring new ideas 🎨",
          "The best designs come from a rested mind. Take a breather 💅",
        ],
        drift: [
          "Focus on the current component. UI is built piece by piece 🎨",
          "Too many components open. Focus on one at a time 💅",
        ],
      },
      backend: {
        motivation: [
          "Robust APIs = happy users! 🚀",
          "Solid backend! The architecture is flawless 🏗️",
          "Business logic on point! You're a machine 💪",
        ],
        tip: [
          "💡 Did you validate the edge cases for this endpoint? 🔍",
          "🔒 Security tip: Sanitize all user inputs",
          "⚡ Performance: Consider indexes for frequent queries",
        ],
        fatigue: [
          "Complex logic requires a fresh mind. Break time to avoid bugs 🐛",
          "Critical backend work needs total focus. Rest and come back strong 💪",
        ],
        drift: [
          "Focus on this endpoint. One API at a time 🎯",
          "Too many services open. Focus on the current logic 🏗️",
        ],
      },
      documentation: {
        motivation: [
          "Documenting! Future you will thank you 📝",
          "Quality docs! The team is going to appreciate this 📚",
          "Clarity in writing! The best docs in the project 🌟",
        ],
        tip: [
          "💡 Good docs = fewer questions on Slack 💬",
          "📚 Tip: Code examples > a thousand words",
          "✨ Updated docs = productive team",
        ],
        fatigue: [
          "Writing clear docs requires a fresh mind. Take a break 📝",
          "Clarity comes with rest. Pause and come back with energy 📚",
        ],
        drift: [
          "Focus on this section. Consistent docs are written with focus 📝",
          "One document at a time. Clarity requires concentration 📚",
        ],
      },
      config: {
        motivation: [
          "Flawless configuration! The setup is crucial ⚙️",
          "Config on point! Everything will run smoothly 🛠️",
        ],
        tip: [
          "💡 Document why each config exists. Future you will thank you 📝",
          "⚙️ Tip: Use environment variables for sensitive configs",
        ],
        fatigue: ["Configurations require precision. Rest to avoid errors ⚙️"],
        drift: ["Focus on this config file. One at a time 🛠️"],
      },
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
          message: `💡 This hour (${this.formatHour(currentHour)}) isn't your peak productivity time. Consider lighter tasks`,
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
        message: `⏰ According to your data, ${this.formatHour(analysis.bestHour)} is your peak window. Consider lighter tasks for now`,
        priority: "low",
        state: "IDLE",
        data: { currentHour, bestHour: analysis.bestHour },
      };
    }

    // Si ES buen momento, motivar
    if (isGoodTime && Math.random() > 0.7) {
      return {
        type: "motivation",
        message: `✨ You're in your peak productivity hour. Make the most of this momentum!`,
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
        message: `Excellent focus overall! Average score: ${Math.round(avgScore)}/100`,
        priority: "low",
        state: "FOCUSED",
        data: { avgScore },
      });
    }

    if (data.streak > 0 && data.streak % 7 === 0) {
      insights.push({
        type: "celebration",
        message: `${data.streak} straight days of productivity! You're so consistent`,
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
      fatigue: "Remember to take regular breaks",
      drift: "Concentrate on one task at a time",
      motivation: "You've got this! You're almost there",
      tip: "Deep work is the key to mastering complex tasks. Try to minimize distractions and focus deeply for at least 25 minutes",
    };

    const message =
      customMessage || insights[type] || "Deepy is here to help you focus!";
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
        message:
          "📊 No commits in the last few days. It's time to create something!",
        state: "IDLE",
        duration: 4000,
      });
      return;
    }

    const message = `📊 Last ${days} days: ${stats.totalCommits} commits (${stats.avgCommitsPerDay}/day). Most productive day: ${stats.mostProductiveDay}`;

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
