import * as vscode from "vscode";
import type { FocusSummary } from "./focusTracker";

const HISTORY_KEY = "focusPulse.history.v1";

export interface HistoryDay {
  date: string; // YYYY-MM-DD
  totalTimeMs: number;
  totalEdits: number;
  avgScore: number;
  sessions: number;
}

let context: vscode.ExtensionContext | undefined;

export function initStorage(ctx: vscode.ExtensionContext) {
  context = ctx;
}

function getStore(): vscode.Memento {
  if (!context) {
    throw new Error("Focus Pulse storage not initialized");
  }
  return context.globalState;
}

export function getHistory(): HistoryDay[] {
  return getStore().get<HistoryDay[]>(HISTORY_KEY, []);
}

function saveHistory(history: HistoryDay[]) {
  return getStore().update(HISTORY_KEY, history);
}

export async function clearHistory() {
  await saveHistory([]);
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Llamar cada vez que cambian stats (ediciones o cambio de archivo)
export async function updateHistoryFromStats(stats: FocusSummary[]) {
  if (!stats.length || !context) return;

  const totalTimeMs = stats
    .map((s) => parseTimeToMs(s.timeText))
    .reduce((a, b) => a + b, 0);

  if (!totalTimeMs) return;

  const totalEdits = stats.map((s) => s.edits).reduce((a, b) => a + b, 0);

  const avgScore =
    stats.map((s) => s.score).reduce((a, b) => a + b, 0) / stats.length;

  const date = todayStr();
  const history = getHistory();
  const idx = history.findIndex((h) => h.date === date);

  if (idx >= 0) {
    const h = history[idx];
    h.totalTimeMs = totalTimeMs;
    h.totalEdits = totalEdits;
    h.avgScore = avgScore;
    h.sessions += 1;
  } else {
    history.push({
      date,
      totalTimeMs,
      totalEdits,
      avgScore,
      sessions: 1,
    });
  }

  await saveHistory(history);
}

function parseTimeToMs(text: string): number {
  // formato "Xm Ys" o "Xs"
  const m = text.match(/(?:(\d+)m)?\s*(\d+)s/);
  if (!m) return 0;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseInt(m[2], 10);
  return minutes * 60000 + seconds * 1000;
}

export function getStreakDays(historyAll: HistoryDay[]): number {
  const history = getHistory();
  if (!history.length) return 0;

  const datesSet = new Set(
    history.filter((h) => h.totalTimeMs > 0).map((h) => h.date),
  );

  let streak = 0;
  const dayMs = 24 * 60 * 60 * 1000;
  let cursor = new Date();

  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;

    if (!datesSet.has(key)) break;

    streak += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return streak;
}

export function getLastDays(n: number): HistoryDay[] {
  const history = getHistory()
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return history.slice(-n);
}
