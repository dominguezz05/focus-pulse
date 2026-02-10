import type { HistoryDay } from "./storage";
import type { FocusSummary } from "./focusTracker";
import type { XpState, PomodoroStats } from "./xp";
import type { DailyGoalProgress } from "./goals";
import type { DeepWorkState } from "./deepWork";
import * as vscode from "vscode";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  custom?: boolean;
}

export interface CustomAchievement extends Achievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  condition: AchievementCondition;
  created: number;
  custom: true;
}

export interface AchievementCondition {
  type:
    | "focus_time"
    | "streak"
    | "files_worked"
    | "pomodoros"
    | "xp_level"
    | "score_avg"
    | "edits_count";
  operator: "gte" | "lte" | "eq" | "gt" | "lt";
  value: number;
  timeframe?: "today" | "week" | "month" | "total";
}

export function computeAchievements(
  streakDays: number,
  history: HistoryDay[],
  todayStats: FocusSummary[],
  xp?: XpState,
  pomodoroStats?: PomodoroStats,
  goals?: DailyGoalProgress,
  deepWork?: DeepWorkState,
  context?: vscode.ExtensionContext,
): Achievement[] {
  const list: Achievement[] = [];

  // --- Logros básicos por sesión de hoy ---

  if (todayStats.length > 0) {
    list.push({
      id: "first-focus",
      title: "First focus",
      description: "You've worked on at least one file today.",
    });
  }

  const totalTodayTimeMs = todayStats
    .map((s) => parseTimeToMs(s.timeText))
    .reduce((a, b) => a + b, 0);

  if (totalTodayTimeMs >= 20 * 60 * 1000) {
    list.push({
      id: "twenty-mins",
      title: "20 minutes of focus",
      description: "More than 20 minutes of work today.",
    });
  }

  const maxEdits = todayStats.reduce((max, s) => Math.max(max, s.edits), 0);
  if (maxEdits >= 100) {
    list.push({
      id: "hundred-edits",
      title: "Steel fingers",
      description: "You've made 100+ edits in a file today.",
    });
  }

  // --- Logros por racha ---

  if (streakDays >= 3) {
    list.push({
      id: "streak-3",
      title: "Streak x3",
      description: `You have ${streakDays} consecutive days with focus sessions.`,
    });
  }

  if (streakDays >= 7) {
    list.push({
      id: "streak-7",
      title: "Epic week",
      description: "7 consecutive days with recorded work.",
    });
  }

  // --- Logros por consistencia (últimos días) ---

  const last7 = history.slice(-7);
  const avgScore7 =
    last7.reduce((a, h) => a + h.avgScore, 0) / (last7.length || 1);

  if (last7.length >= 3 && avgScore7 >= 60) {
    list.push({
      id: "consistent",
      title: "Consistent",
      description: "Average focus ≥ 60/100 in recent days.",
    });
  }
  // --- Logros ligados a días / semana (heatmap-ish) ---

  // Día “intenso”: algún día con mucho tiempo de foco
  const heavyDay = history.find((h) => h.totalTimeMs >= 90 * 60 * 1000);
  if (heavyDay) {
    list.push({
      id: "heavy-day",
      title: "Intense day",
      description: "You've had at least one day with 90+ minutes of focus.",
    });
  }

  // Buena semana: suma de los últimos 7 días razonable
  if (history.length) {
    const totalWeekMs = history
      .slice(-7)
      .reduce((a, h) => a + h.totalTimeMs, 0);
    if (totalWeekMs >= 5 * 60 * 60 * 1000) {
      // 5h en total
      list.push({
        id: "strong-week",
        title: "Solid week",
        description: "More than 5 hours of focus accumulated in the last 7 days.",
      });
    }
  }

  // Hoy mejor que ayer (si hay al menos 2 días)
  if (history.length >= 2) {
    const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const today = sorted[sorted.length - 1];
    const yesterday = sorted[sorted.length - 2];
    if (
      today.avgScore > yesterday.avgScore &&
      today.totalTimeMs > 0 &&
      yesterday.totalTimeMs > 0
    ) {
      list.push({
        id: "today-better",
        title: "Better today than yesterday",
        description: "You've improved your average focus compared to yesterday.",
      });
    }
  }

  // --- Logros por XP / nivel ---

  if (xp) {
    if (xp.totalXp >= 300) {
      list.push({
        id: "xp-300",
        title: "On your way",
        description: "You've accumulated at least 300 focus XP.",
      });
    }

    if (xp.level >= 3) {
      list.push({
        id: "level-3",
        title: "Level 3 reached",
        description: "You've reached level 3 of Focus Pulse.",
      });
    }

    if (xp.level >= 5) {
      list.push({
        id: "level-5",
        title: "Disciplined dev",
        description: "Level 5 or higher. You've had several solid sessions.",
      });
    }

    if (xp.level >= 10) {
      list.push({
        id: "level-10",
        title: "Focus legend",
        description: "Level 10 or higher. Your discipline is serious.",
      });
    }
  }

  // --- Logros específicos de Pomodoro ---

  if (pomodoroStats) {
    if (pomodoroStats.today >= 1) {
      list.push({
        id: "pomo-first",
        title: "First pomodoro",
        description:
          "You've completed a work block with the timer today.",
      });
    }

    if (pomodoroStats.today >= 4) {
      list.push({
        id: "pomo-4-today",
        title: "Four blocks",
        description: "You've completed 4 pomodoros in a single day.",
      });
    }

    if (pomodoroStats.total >= 20) {
      list.push({
        id: "pomo-20-total",
        title: "Block accumulator",
        description: "You've completed 20 pomodoros in total.",
      });
    }

    if (pomodoroStats.total >= 50) {
      list.push({
        id: "pomo-50-total",
        title: "Pomodoro machine",
        description: "You've completed 50 pomodoros in total.",
      });
    }
  }
  // --- Logros de Deep Work ---
  if (deepWork) {
    if (deepWork.completedSessions >= 1) {
      list.push({
        id: "deepwork-1",
        title: "First deep block",
        description: "You've completed your first Deep Work session.",
      });
    }
    if (deepWork.completedSessions >= 5) {
      list.push({
        id: "deepwork-5",
        title: "Deep habit",
        description: "You've completed 5 Deep Work sessions.",
      });
    }
    if (deepWork.completedSessions >= 15) {
      list.push({
        id: "deepwork-15",
        title: "Monk mode",
        description: "15 Deep Work sessions completed.",
      });
    }
  }

  // --- Logros personalizados ---
  if (context) {
    const customAchievements = getCustomAchievements(context);
    const customUnlocked = evaluateCustomAchievements(
      customAchievements,
      todayStats,
      history,
      streakDays,
      xp,
      pomodoroStats,
    );
    list.push(...customUnlocked);
  }

  return list;
}

function parseTimeToMs(text: string): number {
  const m = text.match(/(?:(\d+)m)?\s*(\d+)s/);
  if (!m) return 0;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseInt(m[2], 10);
  return minutes * 60000 + seconds * 1000;
}

// --- Gestión de logros personalizados ---

const CUSTOM_ACHIEVEMENTS_KEY = "focusPulse.customAchievements";

export async function saveCustomAchievement(
  achievement: CustomAchievement,
  context: vscode.ExtensionContext,
): Promise<CustomAchievement[]> {
  const existing = getCustomAchievements(context);
  existing.push(achievement);
  await context.globalState.update(CUSTOM_ACHIEVEMENTS_KEY, existing);
  return existing;
}

export function getCustomAchievements(
  context: vscode.ExtensionContext,
): CustomAchievement[] {
  return context.globalState.get<CustomAchievement[]>(
    CUSTOM_ACHIEVEMENTS_KEY,
    [],
  );
}

export async function deleteCustomAchievement(
  id: string,
  context: vscode.ExtensionContext,
): Promise<CustomAchievement[]> {
  const existing = getCustomAchievements(context);
  const filtered = existing.filter((a) => a.id !== id);
  await context.globalState.update(CUSTOM_ACHIEVEMENTS_KEY, filtered);
  return filtered;
}

export function evaluateCustomAchievements(
  customAchievements: CustomAchievement[],
  stats: FocusSummary[],
  history: HistoryDay[],
  streakDays: number,
  xp: XpState | undefined,
  pomodoroStats: PomodoroStats | undefined,
): Achievement[] {
  const unlocked: Achievement[] = [];

  for (const custom of customAchievements) {
    if (
      evaluateCondition(
        custom.condition,
        stats,
        history,
        streakDays,
        xp,
        pomodoroStats,
      )
    ) {
      unlocked.push({
        id: custom.id,
        title: custom.title,
        description: custom.description,
        icon: custom.icon,
        color: custom.color,
        custom: true,
      });
    }
  }

  return unlocked;
}

function evaluateCondition(
  condition: AchievementCondition,
  stats: FocusSummary[],
  history: HistoryDay[],
  streakDays: number,
  xp: XpState | undefined,
  pomodoroStats: PomodoroStats | undefined,
): boolean {
  let value: number = 0;

  switch (condition.type) {
    case "focus_time":
      value = getFocusTime(stats, history, condition.timeframe);
      break;
    case "streak":
      value = streakDays;
      break;
    case "files_worked":
      value = getFilesWorked(stats, condition.timeframe);
      break;
    case "pomodoros":
      value = getPomodorosCount(pomodoroStats, condition.timeframe);
      break;
    case "xp_level":
      value = xp?.level || 0;
      break;
    case "score_avg":
      value = getAverageScore(stats, history, condition.timeframe);
      break;
    case "edits_count":
      value = getEditsCount(stats, condition.timeframe);
      break;
    default:
      return false;
  }

  switch (condition.operator) {
    case "gte":
      return value >= condition.value;
    case "lte":
      return value <= condition.value;
    case "eq":
      return value === condition.value;
    case "gt":
      return value > condition.value;
    case "lt":
      return value < condition.value;
    default:
      return false;
  }
}

function getFocusTime(
  stats: FocusSummary[],
  history: HistoryDay[],
  timeframe?: string,
): number {
  const toMinutes = (ms: number) => Math.floor(ms / (60 * 1000));

  switch (timeframe) {
    case "today":
      return stats.reduce(
        (total, s) => total + toMinutes(parseTimeToMs(s.timeText)),
        0,
      );
    case "week":
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekHistory = history.filter(
        (h) => new Date(h.date).getTime() >= weekAgo,
      );
      return weekHistory.reduce(
        (total, h) => total + toMinutes(h.totalTimeMs),
        0,
      );
    case "month":
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const monthHistory = history.filter(
        (h) => new Date(h.date).getTime() >= monthAgo,
      );
      return monthHistory.reduce(
        (total, h) => total + toMinutes(h.totalTimeMs),
        0,
      );
    case "total":
    default:
      return history.reduce((total, h) => total + toMinutes(h.totalTimeMs), 0);
  }
}

function getFilesWorked(stats: FocusSummary[], timeframe?: string): number {
  switch (timeframe) {
    case "today":
      return stats.length;
    case "week":
    case "month":
    case "total":
    default:
      return stats.length; // Simplificado - para timeframe extendido necesitaríamos histórico
  }
}

function getPomodorosCount(
  pomodoroStats: PomodoroStats | undefined,
  timeframe?: string,
): number {
  if (!pomodoroStats) return 0;

  switch (timeframe) {
    case "today":
      return pomodoroStats.today || 0;
    case "total":
    default:
      return pomodoroStats.total || 0;
  }
}

function getAverageScore(
  stats: FocusSummary[],
  history: HistoryDay[],
  timeframe?: string,
): number {
  switch (timeframe) {
    case "today":
      if (stats.length === 0) return 0;
      return stats.reduce((total, s) => total + s.score, 0) / stats.length;
    case "week":
      const weekHistory = history.slice(-7);
      if (weekHistory.length === 0) return 0;
      return (
        weekHistory.reduce((total, h) => total + h.avgScore, 0) /
        weekHistory.length
      );
    case "month":
      const monthHistory = history.slice(-30);
      if (monthHistory.length === 0) return 0;
      return (
        monthHistory.reduce((total, h) => total + h.avgScore, 0) /
        monthHistory.length
      );
    case "total":
    default:
      if (history.length === 0) return 0;
      return (
        history.reduce((total, h) => total + h.avgScore, 0) / history.length
      );
  }
}

function getEditsCount(stats: FocusSummary[], timeframe?: string): number {
  switch (timeframe) {
    case "today":
      return stats.reduce((total, s) => total + s.edits, 0);
    case "week":
    case "month":
    case "total":
    default:
      return stats.reduce((total, s) => total + s.edits, 0); // Simplificado
  }
}

// --- Validación de logros personalizados ---

export function validateCustomAchievement(achievement: CustomAchievement): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar título
  if (!achievement.title || achievement.title.trim().length === 0) {
    errors.push("Title is required");
  }
  if (achievement.title && achievement.title.length > 50) {
    errors.push("Title cannot exceed 50 characters");
  }

  // Validar descripción
  if (!achievement.description || achievement.description.trim().length === 0) {
    errors.push("Description is required");
  }
  if (achievement.description && achievement.description.length > 150) {
    errors.push("Description cannot exceed 150 characters");
  }

  // Validar ID único
  if (!achievement.id || achievement.id.trim().length === 0) {
    errors.push("ID is required");
  }
  if (achievement.id && !/^[a-zA-Z0-9_-]+$/.test(achievement.id)) {
    errors.push(
      "ID can only contain letters, numbers, hyphens and underscores",
    );
  }

  // Validar condición
  if (!achievement.condition) {
    errors.push("Condition is required");
  } else {
    const conditionErrors = validateCondition(achievement.condition);
    errors.push(...conditionErrors);
  }

  // Validar icon (opcional)
  if (achievement.icon && achievement.icon.length > 2) {
    errors.push("Icon cannot exceed 2 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCondition(condition: AchievementCondition): string[] {
  const errors: string[] = [];

  // Validar tipo
  const validTypes = [
    "focus_time",
    "streak",
    "files_worked",
    "pomodoros",
    "xp_level",
    "score_avg",
    "edits_count",
  ];
  if (!validTypes.includes(condition.type)) {
    errors.push(
      `Invalid condition type. Valid values: ${validTypes.join(", ")}`,
    );
  }

  // Validar operador
  const validOperators = ["gte", "lte", "eq", "gt", "lt"];
  if (!validOperators.includes(condition.operator)) {
    errors.push(
      `Invalid operator. Valid values: ${validOperators.join(", ")}`,
    );
  }

  // Validar valor
  if (typeof condition.value !== "number" || condition.value < 0) {
    errors.push("Value must be a positive number");
  }

  // Validar timeframe para tipos que lo requieren
  if (
    condition.type === "focus_time" ||
    condition.type === "files_worked" ||
    condition.type === "score_avg"
  ) {
    const validTimeframes = ["today", "week", "month", "total"];
    if (condition.timeframe && !validTimeframes.includes(condition.timeframe)) {
      errors.push(
        `Invalid timeframe. Valid values: ${validTimeframes.join(", ")}`,
      );
    }
  }

  return errors;
}

export function generateAchievementId(title: string): string {
  return (
    "custom-" +
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 20) +
    "-" +
    Date.now().toString(36)
  );
}
// Catálogo completo de logros conocidos por Focus Pulse
export function getAllAchievementsDefinitions(
  unlockedAchievements: Achievement[] = [],
): Achievement[] {
  return [
    {
      id: "first-focus",
      title: "First focus",
      description: "You've worked on at least one file today.",
    },
    {
      id: "twenty-mins",
      title: "20 minutes of focus",
      description: "More than 20 minutes of work today.",
    },
    {
      id: "hundred-edits",
      title: "Steel fingers",
      description: "You've made 100+ edits in a file today.",
    },
    {
      id: "streak-3",
      title: "Streak x3",
      description: "You have at least 3 consecutive days with focus sessions.",
    },
    {
      id: "streak-7",
      title: "Epic week",
      description: "7 consecutive days with recorded work.",
    },
    {
      id: "consistent",
      title: "Consistent",
      description: "Average focus ≥ 60/100 in recent days.",
    },
    {
      id: "heavy-day",
      title: "Intense day",
      description: "You've had at least one day with 90+ minutes of focus.",
    },
    {
      id: "strong-week",
      title: "Solid week",
      description: "More than 5 hours of focus in the last 7 days.",
    },
    {
      id: "today-better",
      title: "Better today than yesterday",
      description: "You've improved your average focus compared to yesterday.",
    },
    {
      id: "xp-300",
      title: "On your way",
      description: "You've accumulated at least 300 focus XP.",
    },
    {
      id: "level-3",
      title: "Level 3 reached",
      description: "You've reached level 3 of Focus Pulse.",
    },
    {
      id: "level-5",
      title: "Disciplined dev",
      description: "Level 5 or higher. Several solid sessions.",
    },
    {
      id: "level-10",
      title: "Focus legend",
      description: "Level 10 or higher. Your discipline is serious.",
    },
    {
      id: "pomo-first",
      title: "First pomodoro",
      description: "You've completed a work block with the timer.",
    },
    {
      id: "pomo-4-today",
      title: "Four blocks",
      description: "You've completed 4 pomodoros in a single day.",
    },
    {
      id: "pomo-20-total",
      title: "Block accumulator",
      description: "You've completed 20 pomodoros in total.",
    },
    {
      id: "pomo-50-total",
      title: "Pomodoro machine",
      description: "You've completed 50 pomodoros in total.",
    },
    {
      id: "deepwork-1",
      title: "First deep block",
      description: "You've completed your first Deep Work session.",
    },
    {
      id: "deepwork-5",
      title: "Deep habit",
      description: "You've completed 5 Deep Work sessions.",
    },
    {
      id: "deepwork-15",
      title: "Monk mode",
      description: "15 Deep Work sessions completed.",
    },
  ];
}
