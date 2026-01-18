import * as vscode from "vscode";
import type { HistoryDay } from "./storage";
import type { PomodoroStats } from "./xp";

export interface DailyGoalProgress {
  enabled: boolean;
  targetMinutes: number;
  targetPomodoros: number;
  minutesDone: number;
  pomodorosDone: number;
  doneMinutes: boolean;
  donePomodoros: boolean;
  allDone: boolean;
}

export function computeDailyGoals(
  history: HistoryDay[],
  pomodoroStats?: PomodoroStats,
): DailyGoalProgress | undefined {
  const config = vscode.workspace.getConfiguration("focusPulse");
  const enabled = config.get<boolean>("goals.enabled", true);
  if (!enabled) return undefined;

  const targetMinutes = config.get<number>("goals.minutes", 60);
  const targetPomodoros = config.get<number>("goals.pomodoros", 3);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const todayHistory = history.find((h) => h.date === todayKey);
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
