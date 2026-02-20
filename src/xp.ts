import type { HistoryDay } from "./storage";
import type { DeepWorkState } from "./deepWork";
import type { XpState } from "./state/StateTypes";
import * as vscode from "vscode";

// Re-export XpState for backward compatibility
export type { XpState };

export interface PomodoroStats {
  today: number;
  total: number;
}

// Punto de entrada principal: histórico + stats de pomodoro
export function computeXpState(
  history: HistoryDay[],
  pomodoroStats?: PomodoroStats,
  deepWork?: DeepWorkState,
): XpState {
  const baseXp = computeBaseXpFromHistory(history);
  const bonusXp = computePomodoroBonus(pomodoroStats);
  const deepWorkBonus = computeDeepWorkBonus(deepWork);
  const totalXp = baseXp + bonusXp + deepWorkBonus;
  return computeXpStateFromTotal(totalXp);
}
// Bonus por Deep Work completados
function computeDeepWorkBonus(state?: DeepWorkState): number {
  if (!state) return 0;
  const cfg = vscode.workspace.getConfiguration("focusPulse");
  const perSession = cfg.get<number>("deepWork.xpBonus", 150);
  return state.completedSessions * perSession;
}

// Compatibilidad por si en algún sitio queda la antigua
export function computeXpStateFromHistory(history: HistoryDay[]): XpState {
  return computeXpState(history);
}

// XP base según histórico de días (sin pomodoro aún)
function computeBaseXpFromHistory(history: HistoryDay[]): number {
  if (!history.length) return 0;

  let totalXp = 0;
  for (const day of history) {
    const minutes = day.totalTimeMs / 60000;
    const dayXp = minutes * (day.avgScore / 100) * 10;
    totalXp += dayXp;
  }
  return totalXp;
}

// Bonus por pomodoro: hoy pesa más que el acumulado
function computePomodoroBonus(stats?: PomodoroStats): number {
  if (!stats) return 0;
  const todayBonus = stats.today * 50; // 50 XP por bloque de hoy
  const totalBonus = stats.total * 10; // 10 XP por bloque histórico
  return todayBonus + totalBonus;
}

// Convierte XP total en nivel + progreso al siguiente
function computeXpStateFromTotal(totalXp: number): XpState {
  let level = 1;
  let xpRemaining = totalXp;
  let xpToNext = xpNeededForLevel(level);

  while (xpRemaining >= xpToNext) {
    xpRemaining -= xpToNext;
    level++;
    xpToNext = xpNeededForLevel(level);
  }

  return {
    totalXp,
    level,
    xpInLevel: xpRemaining,
    xpToNext,
  };
}

// Curva simple: cada nivel pide un poco más
function xpNeededForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}
