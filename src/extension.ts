import * as vscode from "vscode";
import * as fs from "fs";

import { reloadConfig } from "./config";
import { initStatusBar, refreshStatusBar, setDeepWorkState } from "./statusBar";
import {
  handleEditorChange,
  handleTextDocumentChange,
  getCurrentStats,
  computeFocusScore,
  formatMinutes,
  getStatsArray,
  FocusSummary,
  resetFocusStats,
  FocusStats,
} from "./focusTracker";
import {
  initStorage,
  updateHistoryFromStats,
  getLastDays,
  getStreakDays,
  getHistory,
  clearHistory,
  HistoryDay,
} from "./storage";
import { initPomodoro, togglePomodoro, getPomodoroStats } from "./pomodoro";
import {
  computeAchievements,
  getAllAchievementsDefinitions,
} from "./achievements";
import { computeXpState, PomodoroStats } from "./xp";
import { DailyGoalProgress } from "./goals";
import {
  initDeepWork,
  toggleDeepWork,
  checkDeepWorkCompletion,
  getDeepWorkState,
  DeepWorkState,
} from "./deepWork";
import {
  openRefactoredDashboard,
  updateRefactoredDashboard,
  setupDashboardEventListeners,
} from "./dashboard";
import { getStateManager, type AppState, setGlobalContext } from "./state/StateManager";
import { CustomAchievementManager } from "./webview/CustomAchievementManager";
import { registerExportCommands } from "./export/exportCommands";
import { registerSyncCommands } from "./export/syncCommands";
import { registerFriendCommands } from "./friends/friendCommands";
import { AssistantService } from "./services/AssistantService";
import { NotificationService } from "./notifications/NotificationService";
import { getEventBus } from "./events";
import { FOCUS_EVENTS } from "./events/EventTypes";
import { formatDate } from "./utils/formatters";

let previousGoals: DailyGoalProgress | undefined;

// Module-level tracking for event deduplication.
// Using plain variables (not StateManager) makes this immune to async races
// in concurrent updateAll() calls: the write happens synchronously right after
// the emit, so the next concurrent read always sees the updated value.
let lastEmittedLevel = 0;
let lastEmittedXp = 0;
const emittedAchievementIds = new Set<string>();

// ---------------- Objetivos diarios ----------------

function computeDailyGoals(
  fullHistory: HistoryDay[],
  pomodoroStats: PomodoroStats | undefined,
): DailyGoalProgress | undefined {
  const config = vscode.workspace.getConfiguration("focusPulse");
  const enabled = config.get<boolean>("goals.enabled", true);
  if (!enabled) return undefined;

  const targetMinutes = config.get<number>("goals.targetMinutes", 120);
  const targetPomodoros = config.get<number>("goals.targetPomodoros", 4);

  // Calcular minutos y pomodoros de hoy
  const today = formatDate(new Date());
  const todayHistory = fullHistory.find((h) => h.date === today);
  let minutesDone = 0;
  let pomodorosDone = 0;

  if (todayHistory) {
    minutesDone = todayHistory.totalTimeMs / 60000;
    if (pomodoroStats) {
      pomodorosDone = pomodoroStats.today || 0;
    }
  }

  const doneMinutes = minutesDone >= targetMinutes;
  const donePomodoros = pomodorosDone >= targetPomodoros;
  const allDone = doneMinutes && donePomodoros;

  return {
    enabled,
    targetMinutes,
    targetPomodoros,
    minutesDone,
    pomodorosDone,
    doneMinutes,
    donePomodoros,
    allDone,
  };
}

// ---------------- Export histórico ----------------

async function exportHistory(format: "json" | "csv", target: vscode.Uri) {
  const history = getHistory();
  if (!history.length) {
    vscode.window.showInformationMessage(
      "Focus Pulse: no hay histórico para exportar.",
    );
    return;
  }

  if (format === "json") {
    const json = JSON.stringify(history, null, 2);
    await fs.promises.writeFile(target.fsPath, json, "utf8");
  } else {
    const header =
      "date,totalTimeMs,totalMinutes,totalEdits,avgScore,sessions\n";
    const rows = history.map((h) => {
      const minutes = h.totalTimeMs / 60000;
      return `${h.date},${h.totalTimeMs},${minutes.toFixed(
        1,
      )},${h.totalEdits},${h.avgScore.toFixed(2)},${h.sessions}`;
    });
    const csv = header + rows.join("\n");
    await fs.promises.writeFile(target.fsPath, csv, "utf8");
  }

  vscode.window.showInformationMessage(
    `Focus Pulse: histórico exportado como ${format.toUpperCase()}.`,
  );
}

// ---------------- Loop de actualización ----------------

async function updateAll(context: vscode.ExtensionContext) {
  refreshStatusBar();
  
  // Initialize eventBus early for notification events
  const eventBus = getEventBus();

  const statsArray = getStatsArray();
  await updateHistoryFromStats(statsArray);

  const fullHistory = getHistory();
  const { state: deepWorkState, completed } =
    await checkDeepWorkCompletion(context);
  setDeepWorkState(deepWorkState);

  const pomodoroStats = getPomodoroStats();
  const goals = computeDailyGoals(fullHistory, pomodoroStats);

  const currentState = getStateManager().getState();

  const xp = computeXpState(fullHistory, pomodoroStats, deepWorkState);

  // Emit XP earned event if XP increased (guarded by module-level tracker)
  if (xp.totalXp > lastEmittedXp) {
    eventBus.emit(FOCUS_EVENTS.XP_EARNED, {
      amount: xp.totalXp - lastEmittedXp,
      source: 'session',
      totalXp: xp.totalXp,
      timestamp: Date.now()
    });
    lastEmittedXp = xp.totalXp;
  }

  // Emit level up event if level increased (guarded by module-level tracker)
  if (xp.level > lastEmittedLevel) {
    eventBus.emit(FOCUS_EVENTS.LEVEL_UP, {
      newLevel: xp.level,
      totalXp: xp.totalXp,
      timestamp: Date.now()
    });
    lastEmittedLevel = xp.level;
  }

  // Persist xp to state for dashboard / other consumers
  getStateManager().setState({ xp: { ...currentState.xp, ...xp } });
  
  const weeklySummary = buildWeeklySummaryFromHistory(fullHistory);
  const history7 = getLastDays(7);
  const streakDaysArray = getStreakDays(fullHistory);
  const streakCount = Array.isArray(streakDaysArray)
    ? streakDaysArray.length
    : streakDaysArray;
  
  const unlockedAchievements = computeAchievements(
    streakCount,
    history7,
    statsArray as FocusSummary[],
    xp,
    pomodoroStats,
    goals,
    deepWorkState,
    context,
  );

  // Emit achievement unlocked events for truly new achievements (module-level tracker)
  const newUnlocked = unlockedAchievements.filter(a => !emittedAchievementIds.has(a.id));

  newUnlocked.forEach(achievement => {
    emittedAchievementIds.add(achievement.id);
    eventBus.emit(FOCUS_EVENTS.ACHIEVEMENT_UNLOCKED, {
      achievement: {
        title: achievement.title,
        description: achievement.description,
        id: achievement.id
      },
      timestamp: Date.now()
    });
  });

  // Persist unlocked set to state for dashboard / other consumers
  if (newUnlocked.length > 0) {
    getStateManager().setState({
      achievements: {
        ...currentState.achievements,
        unlocked: Array.from(emittedAchievementIds),
        lastUnlocked: newUnlocked[newUnlocked.length - 1].id,
        lastCheckTime: Date.now()
      }
    });
  }

  // Emit goal events on state transitions
  if (goals) {
    if (previousGoals) {
      if (goals.doneMinutes && !previousGoals.doneMinutes) {
        eventBus.emit(FOCUS_EVENTS.GOAL_COMPLETED, {
          type: 'minutes',
          current: goals.minutesDone,
          target: goals.targetMinutes,
          completed: true,
          timestamp: Date.now()
        });
      }
      if (goals.donePomodoros && !previousGoals.donePomodoros) {
        eventBus.emit(FOCUS_EVENTS.GOAL_COMPLETED, {
          type: 'pomodoros',
          current: goals.pomodorosDone,
          target: goals.targetPomodoros,
          completed: true,
          timestamp: Date.now()
        });
      }
    }
    previousGoals = goals;
  }

  const allDefs = getAllAchievementsDefinitions();
  const mergedAll = allDefs.map((a) => ({
    ...a,
    unlocked: unlockedAchievements.some((u) => u.id === a.id),
  }));

  // Análisis de picos de rendimiento del asistente (una vez al día)
  const assistantService = AssistantService.getInstance();
  if (fullHistory.length >= 5) {
    assistantService.analyzeAndShowPeakPerformance(fullHistory);
  }

  updateRefactoredDashboard({
    stats: statsArray,
    history7,
    streak: streakCount,
    achievements: unlockedAchievements,
    xp,
    pomodoroStats,
    historyAll: fullHistory,
    goals,
    deepWork: deepWorkState,
    weeklySummary,
    allAchievements: mergedAll,
  });
}

function buildWeeklySummaryFromHistory(history: HistoryDay[]) {
  const byWeek = new Map<
    string,
    { totalMinutes: number; totalScore: number; days: number }
  >();

  history.forEach((day) => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    const weekNum = getWeekNumber(date);
    const weekKey = `${year}-W${weekNum.toString().padStart(2, "0")}`;

    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, { totalMinutes: 0, totalScore: 0, days: 0 });
    }

    const weekData = byWeek.get(weekKey)!;
    weekData.totalMinutes += day.totalTimeMs / 60000;
    weekData.totalScore += day.avgScore;
    weekData.days += 1;
  });

  return Array.from(byWeek.entries())
    .map(([weekLabel, data]) => ({
      weekLabel,
      totalMinutes: data.totalMinutes,
      avgScore: data.days > 0 ? data.totalScore / data.days : 0,
    }))
    .sort((a, b) => a.weekLabel.localeCompare(b.weekLabel))
    .slice(-8); // Last 8 weeks
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Focus Pulse v2.1 activado con refactor de componentes");

  // Set global context for state manager
  setGlobalContext(context);

  // Initialize state and events
  const stateManager = getStateManager();
  stateManager.load(); // get() is sync so state is populated immediately

  // Seed dedup trackers from persisted state so we don't re-emit on restart
  const persisted = stateManager.getState();
  lastEmittedLevel = persisted.xp.level;
  lastEmittedXp = persisted.xp.totalXp;
  persisted.achievements.unlocked.forEach(id => emittedAchievementIds.add(id));

  setupDashboardEventListeners(context);

  initStorage(context);
  initStatusBar(context);
  initPomodoro(context);
  initDeepWork(context);

  // Initialize Notification Service  
  const notificationService = new NotificationService(getEventBus());
  context.subscriptions.push({
    dispose: () => notificationService.dispose()
  });

  // Initialize Assistant Service with configuration
  const assistantService = AssistantService.getInstance();
  const config = vscode.workspace.getConfiguration("focusPulse");
  assistantService.updateConfig({
          personality: config.get<"motivational" | "neutral" | "zen" | "humorous">("assistant.personality", "motivational"),
    flowProtection: config.get<boolean>("assistant.flowProtection", true),
    contextualMessages: config.get<boolean>("assistant.contextualMessages", true),
    enableFatigueDetection: true,
    enableDriftDetection: true,
    enableMotivationMessages: true,
    enableCelebrations: true,
    sessionTimeThreshold: 90,
    driftThreshold: 2,
    motivationThreshold: 80,
    messageCooldown: 5,
  });

  // Register export/import commands
  registerExportCommands(context);

  // Register sync commands
  registerSyncCommands(context);

  // Register friend commands
  registerFriendCommands(context);

  // Register notification commands (reusa la instancia ya creada)
  const { registerNotificationCommands } = require('./notifications/NotificationCommands');
  registerNotificationCommands(context, notificationService);

  // Auto-authenticate with stored token (persists across window reloads)
  (async () => {
    try {
      const { GitHubSyncProvider, UserSyncManager } = require('./export/UserSyncManager');
      const provider = new GitHubSyncProvider();
      provider.setContext(context);
      const storedUser = await provider.authenticateWithStoredToken();
      if (storedUser) {
        const syncMgr = UserSyncManager.getInstance();
        await syncMgr.setProvider(provider);
        await syncMgr.setCurrentUser(storedUser);
        console.log('Focus Pulse: auto-authenticated as', storedUser.email);
      }
    } catch (e) {
      console.log('Focus Pulse: auto-auth skipped:', e);
    }
  })();

  const handlers = [
    vscode.commands.registerCommand("focusPulse.openDashboard", () => {
      console.log("Opening refactored dashboard");
      openRefactoredDashboard(context);
    }),
    vscode.commands.registerCommand("focusPulse.openDashboardLegacy", () => {
      // Keep original as fallback for testing
    }),
    vscode.commands.registerCommand(
      "focusPulse.exportData",
      async (args: any) => {
        await exportHistory(args.format, args.target);
      },
    ),
    vscode.commands.registerCommand("focusPulse.resetHistory", async () => {
      resetFocusStats();
      clearHistory();
      await stateManager.reset();
      // Reset dedup trackers so future level-ups / achievements emit correctly
      lastEmittedLevel = 0;
      lastEmittedXp = 0;
      emittedAchievementIds.clear();
      vscode.window.showInformationMessage(
        "Focus Pulse: histórico y estado reiniciados.",
      );
    }),
    vscode.commands.registerCommand("focusPulse.deepWorkToggle", () => {
      toggleDeepWork(context);
    }),
    vscode.commands.registerCommand("focusPulse.pomodoroToggle", () => {
      togglePomodoro(context);
    }),
    vscode.commands.registerCommand("focusPulse.createCustomAchievement", () => {
      CustomAchievementManager.show(context);
    }),
    vscode.commands.registerCommand("focusPulse.manageCustomAchievements", () => {
      CustomAchievementManager.show(context);
    }),
    vscode.commands.registerCommand("focusPulse.showGitStats", async () => {
      const assistantService = AssistantService.getInstance();
      await assistantService.showGitStats(7);
    }),
  ];

  const watchers = [
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      handleEditorChange(editor);
      updateAll(context);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      handleTextDocumentChange(event);
      updateAll(context);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      // Actualizar configuración del asistente cuando cambie en settings
      if (event.affectsConfiguration("focusPulse.assistant")) {
        const assistantService = AssistantService.getInstance();
        const config = vscode.workspace.getConfiguration("focusPulse");
        assistantService.updateConfig({
    personality: config.get<"motivational" | "neutral" | "zen" | "humorous">("assistant.personality", "motivational"),
          flowProtection: config.get<boolean>("assistant.flowProtection", true),
          contextualMessages: config.get<boolean>("assistant.contextualMessages", true),
        });
        console.log("Assistant configuration updated");
      }
    }),
  ];

  context.subscriptions.push(...handlers, ...watchers);

  // Loop principal con mejor rendimiento
  setInterval(() => {
    updateAll(context);
  }, 2000);
}

export function deactivate() {
  // Limpiar recursos del asistente
  const assistantService = AssistantService.getInstance();
  assistantService.destroy();
  console.log("Focus Pulse desactivado - recursos liberados");
}
