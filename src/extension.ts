import * as vscode from "vscode";
import * as fs from "fs";

import { reloadConfig } from "./config";
import { initStatusBar, refreshStatusBar } from "./statusBar";
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
import { openDashboard, updateDashboard } from "./dashboard";
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
import { computeAchievements } from "./achievements";
import { computeXpState, PomodoroStats } from "./xp";

import { DailyGoalProgress } from "./goals";
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

async function updateAll() {
  refreshStatusBar();

  const statsArray = getStatsArray();
  await updateHistoryFromStats(statsArray);

  const fullHistory = getHistory();
  const pomodoroStats = getPomodoroStats();
  const goals = computeDailyGoals(fullHistory, pomodoroStats);

  const xp = computeXpState(fullHistory, pomodoroStats);

  const history7 = getLastDays(7);
  const streak = getStreakDays();
  const achievements = computeAchievements(
    streak,
    history7,
    statsArray as FocusSummary[],
    xp,
    pomodoroStats,
    goals,
  );

  updateDashboard({
    stats: statsArray,
    history7,
    streak,
    achievements,
    xp,
    pomodoroStats,
    historyAll: fullHistory,
    goals,
  });
}

// ---------------- Activación extensión ----------------

export function activate(context: vscode.ExtensionContext) {
  reloadConfig();
  initStorage(context);
  initStatusBar(context);
  initPomodoro(context);

  handleEditorChange(vscode.window.activeTextEditor);
  updateAll();

  const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("focusPulse")) {
      reloadConfig();
      updateAll();
    }
  });
  context.subscriptions.push(configDisposable);

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      handleEditorChange(editor);
      updateAll();
    },
  );
  context.subscriptions.push(editorChangeDisposable);

  const editDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    handleTextDocumentChange(event);
    updateAll();
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
      updateAll();
    },
  );
  context.subscriptions.push(commandOpenDashboard);

  const commandPomodoroToggle = vscode.commands.registerCommand(
    "focusPulse.pomodoroToggle",
    () => {
      togglePomodoro();
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
      await updateAll();

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
