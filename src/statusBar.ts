import * as vscode from "vscode";
import {
  getCurrentStats,
  computeFocusScore,
  formatMinutes,
} from "./focusTracker";
import { isStatusBarEnabled } from "./config";
import { getHistory } from "./storage";
import { computeXpState } from "./xp";
import { getPomodoroStats } from "./pomodoro";
import type { DeepWorkState } from "./deepWork";

let statusBarItem: vscode.StatusBarItem;
let deepWorkItem: vscode.StatusBarItem;
let deepWorkState: DeepWorkState | undefined;

function getScoreColor(score: number): string {
  if (score >= 80) {
    return "#4caf50";
  }
  if (score >= 50) {
    return "#ffb300";
  }
  return "#e53935";
}

export function initStatusBar(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = "focusPulse.openDashboard";
  statusBarItem.text = "$(pulse) Lvl 1 · Focus: -";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  deepWorkItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  deepWorkItem.command = "focusPulse.deepWorkToggle";
  context.subscriptions.push(deepWorkItem);
}

export function setDeepWorkState(state?: DeepWorkState) {
  deepWorkState = state;
  refreshStatusBar();
}

export function refreshStatusBar() {
  if (!statusBarItem) {
    return;
  }

  if (!isStatusBarEnabled()) {
    statusBarItem.hide();
    return;
  }

  const stats = getCurrentStats();

  let level = 1;
  let totalXp = 0;

  try {
    const history = getHistory();
    const pomodoroStats = getPomodoroStats();
    const xpState = computeXpState(history, pomodoroStats);
    level = xpState.level;
    totalXp = xpState.totalXp;
  } catch {
    // ignoramos fallos de inicialización
  }

  statusBarItem.show();

  if (!stats) {
    statusBarItem.text = `$(pulse) Lvl ${level} · Focus: -`;
    statusBarItem.tooltip =
      `Focus Pulse\n\n` +
      `Nivel: ${level}\n` +
      `XP total aprox.: ${Math.round(totalXp)}\n\n` +
      `No hay ningún archivo activo ahora mismo.`;
    statusBarItem.color = undefined;
    return;
  }

  const score = computeFocusScore(stats);
  const timeText = formatMinutes(stats.timeMs);

  statusBarItem.text = `$(pulse) Lvl ${level} · Focus: ${score} | ${timeText} | edits: ${stats.edits}`;
  statusBarItem.tooltip =
    `Focus Pulse\n\n` +
    `Nivel: ${level}\n` +
    `XP total aprox.: ${Math.round(totalXp)}\n\n` +
    `Archivo: ${stats.fileName}\n` +
    `Puntuación: ${score}/100\n` +
    `Tiempo: ${timeText}\n` +
    `Ediciones: ${stats.edits}\n` +
    `Cambios de fichero: ${stats.switches}`;
  statusBarItem.color = getScoreColor(score);

  if (deepWorkItem) {
    if (deepWorkState?.active) {
      deepWorkItem.text = "$(flame) Deep Work";
      deepWorkItem.tooltip = "Deep Work activo. Pulsa para detener.";
      deepWorkItem.color = new vscode.ThemeColor("terminal.ansiRed");
      deepWorkItem.show();
    } else {
      deepWorkItem.text = "$(flame) Deep Work off";
      deepWorkItem.tooltip = "Iniciar modo Deep Work.";
      deepWorkItem.color = undefined;
      deepWorkItem.show();
    }
  }
}
