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
} from "./focusTracker";
import { openRefactoredDashboard, updateRefactoredDashboard, setupDashboardEventListeners } from "./dashboard-refactored";
import { getStateManager, type AppState } from "./state/StateManager";

// Legacy imports - commented out for clarity
// import { openDashboard, updateDashboard } from "./dashboard";
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
} from "./deepWork";
import type { DeepWorkState } from "./deepWork";
import { openDashboard, updateDashboard } from "./dashboard";

// ---------------- Objetivos diarios ----------------

function computeDailyGoals(
  fullHistory: HistoryDay[],
  pomodoroStats: PomodoroStats | undefined,
): DailyGoalProgress | undefined {
  const config = vscode.workspace.getConfiguration("focusPulse");
  const enabled = config.get<boolean>("goals.enabled", true);
  if (!enabled) return undefined;

  const targetMinutes = config.get<number>("goals.minutes", 60);
  const targetPomodoros = config.get<number>("goals.pomodoros", 3);

  const todayDate = new Date();
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, "0");
  const dd = String(todayDate.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const todayHistory = fullHistory.find((h) => h.date === todayKey);
  const minutesDone = todayHistory ? todayHistory.totalTimeMs / 60000 : 0;
  const pomodorosDone = pomodoroStats?.today ?? 0;

  const doneMinutes = minutesDone >= targetMinutes;
  const donePomodoros = pomodorosDone >= targetPomodoros;

  return {
    enabled,
    targetMinutes,
    targetPomodoros,
    minutesDone,
    pomodorosDone,
    doneMinutes,
    donePomodoros,
    allDone: doneMinutes && donePomodoros,
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

  const statsArray = getStatsArray();
  await updateHistoryFromStats(statsArray);

  const fullHistory = getHistory();
  const { state: deepWorkState, completed } =
    await checkDeepWorkCompletion(context);
  setDeepWorkState(deepWorkState);

  const pomodoroStats = getPomodoroStats();
  const goals = computeDailyGoals(fullHistory, pomodoroStats);

  const xp = computeXpState(fullHistory, pomodoroStats, deepWorkState);
  const weeklySummary = buildWeeklySummaryFromHistory(fullHistory);
  const history7 = getLastDays(7);
  const streak = getStreakDays(fullHistory);

  const unlockedAchievements = computeAchievements(
    Array.isArray(streak) ? streak.length : streak,
    history7,
    statsArray as FocusSummary[],
  );

  const allDefs = getAllAchievementsDefinitions(unlockedAchievements);
  const mergedAll = allDefs.map((a) => ({
    ...a,
    unlocked: unlockedAchievements.some((u) => u.id === a.id),
  }));

  updateDashboard({
    stats: statsArray,
    history7,
    streak,
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

  for (const h of history) {
    const d = new Date(h.date);
    const year = d.getFullYear();
    const week = getWeekNumber(d); // helper abajo
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const entry = byWeek.get(key) ?? {
      totalMinutes: 0,
      totalScore: 0,
      days: 0,
    };
    entry.totalMinutes += h.totalTimeMs / 60000;
    entry.totalScore += h.avgScore;
    entry.days += 1;
    byWeek.set(key, entry);
  }

  return Array.from(byWeek.entries())
    .map(([weekLabel, v]) => ({
      weekLabel,
      totalMinutes: v.totalMinutes,
      avgScore: v.days ? v.totalScore / v.days : 0,
    }))
    .sort((a, b) => (a.weekLabel < b.weekLabel ? -1 : 1));
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
}

// ---------------- Activación extensión ----------------

export function activate(context: vscode.ExtensionContext) {
  console.log("Focus Pulse v2.1 activado con refactor de componentes");

  // Initialize state and events
  const stateManager = getStateManager();
  stateManager.load();
  setupDashboardEventListeners(context);

  initStorage(context);
  initStatusBar(context);
  initPomodoro(context);
  initDeepWork(context);

  const handlers = [
  vscode.commands.registerCommand("focusPulse.openDashboard", () => {
      openRefactoredDashboard(context);
    }),
    vscode.commands.registerCommand("focusPulse.openDashboardLegacy", () => {
      // Keep original as fallback for testing
      vscode.window.showInformationMessage("Focus Pulse: Using legacy dashboard for compatibility");
    }),
    vscode.commands.registerCommand("focusPulse.exportData", async (args: any) => {
      await exportHistory(args.format, args.target);
    }),
    vscode.commands.registerCommand("focusPulse.resetHistory", async () => {
      resetFocusStats();
      clearHistory();
      await stateManager.reset();
      vscode.window.showInformationMessage("Focus Pulse: histórico y estado reiniciados.");
    }),
    vscode.commands.registerCommand("focusPulse.toggleDeepWork", () => {
      toggleDeepWork(context);
    }),
    vscode.commands.registerCommand("focusPulse.togglePomodoro", () => {
      togglePomodoro(context);
    }),
  ];

  

  // Loop principal con mejor rendimiento
  setInterval(() => {
    updateAll(context);
  },2000);

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      handleEditorChange(editor);
      updateAll(context);
    },
  );
  context.subscriptions.push(editorChangeDisposable);

  const editDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    handleTextDocumentChange(event);
    updateAll(context);
  });
  context.subscriptions.push(editDisposable);

  const commandExportData = vscode.commands.registerCommand(
    "focusPulse.exportData",
    async (args: any) => {
      if (!args || !args.format || !args.target) return;
      const format = args.format === "csv" ? "csv" : "json";
      const uri = args.target as vscode.Uri;
      await exportHistory(format, uri);
    },
  );
  context.subscriptions.push(commandExportData);

  const commandShowStats = vscode.commands.registerCommand(
    "focusPulse.showStats",
    () => {
      const stats = getCurrentStats();
      if (!stats) {
        vscode.window.showInformationMessage(
          "Focus Pulse: no hay estadísticas para el archivo actual.",
        );
        return;
      }

      const score = computeFocusScore(stats);
      const message =
        `Focus Pulse\n\n` +
        `Archivo: ${stats.fileName}\n` +
        `Puntuación de foco: ${score}/100\n` +
        `Tiempo total: ${formatMinutes(stats.timeMs)}\n` +
        `Ediciones: ${stats.edits}\n` +
        `Cambios de fichero: ${stats.switches}`;

      vscode.window.showInformationMessage(message, { modal: true });
    },
  );
  context.subscriptions.push(commandShowStats);

  const commandOpenDashboard = vscode.commands.registerCommand(
    "focusPulse.openDashboard",
    () => {
      openDashboard(context);
      updateAll(context);
    },
  );
  context.subscriptions.push(commandOpenDashboard);

  const commandDeepWorkToggle = vscode.commands.registerCommand(
    "focusPulse.deepWorkToggle",
    async () => {
      const state = await toggleDeepWork(context);
      setDeepWorkState(state);
    },
  );
  context.subscriptions.push(commandDeepWorkToggle);

  const commandPomodoroToggle = vscode.commands.registerCommand(
    "focusPulse.pomodoroToggle",
     () => {
      togglePomodoro(context);
     },
  );
  context.subscriptions.push(commandPomodoroToggle);

  const commandResetData = vscode.commands.registerCommand(
    "focusPulse.resetData",
    async () => {
      const answer = await vscode.window.showWarningMessage(
        "Esto borrará el histórico de días, racha y XP calculada. ¿Seguro?",
        "Sí, resetear",
        "Cancelar",
      );
      if (answer !== "Sí, resetear") {
        return;
      }

      resetFocusStats();
      await clearHistory();
      await updateAll(context);

      vscode.window.showInformationMessage(
        "Focus Pulse: histórico y XP reseteados.",
      );
    },
  );
  context.subscriptions.push(commandResetData);
}

export function deactivate() {
  // nada especial
}
