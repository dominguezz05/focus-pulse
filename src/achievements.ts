import type { HistoryDay } from "./storage";
import type { FocusSummary } from "./focusTracker";
import type { XpState, PomodoroStats } from "./xp";
import type { DailyGoalProgress } from "./goals";

export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export function computeAchievements(
  streakDays: number,
  history: HistoryDay[],
  todayStats: FocusSummary[],
  xp?: XpState,
  pomodoroStats?: PomodoroStats,
  goals?: DailyGoalProgress,
): Achievement[] {
  const list: Achievement[] = [];

  // --- Logros básicos por sesión de hoy ---

  if (todayStats.length > 0) {
    list.push({
      id: "first-focus",
      title: "Primer enfoque",
      description: "Has trabajado al menos en un archivo hoy.",
    });
  }

  const totalTodayTimeMs = todayStats
    .map((s) => parseTimeToMs(s.timeText))
    .reduce((a, b) => a + b, 0);

  if (totalTodayTimeMs >= 20 * 60 * 1000) {
    list.push({
      id: "twenty-mins",
      title: "20 minutos de foco",
      description: "Más de 20 minutos de trabajo hoy.",
    });
  }

  const maxEdits = todayStats.reduce((max, s) => Math.max(max, s.edits), 0);
  if (maxEdits >= 100) {
    list.push({
      id: "hundred-edits",
      title: "Dedos de acero",
      description: "Has hecho 100+ ediciones en un archivo hoy.",
    });
  }

  // --- Logros por racha ---

  if (streakDays >= 3) {
    list.push({
      id: "streak-3",
      title: "Racha x3",
      description: `Llevas ${streakDays} días seguidos con sesión de foco.`,
    });
  }

  if (streakDays >= 7) {
    list.push({
      id: "streak-7",
      title: "Semana épica",
      description: "7 días seguidos con trabajo registrado.",
    });
  }

  // --- Logros por consistencia (últimos días) ---

  const last7 = history.slice(-7);
  const avgScore7 =
    last7.reduce((a, h) => a + h.avgScore, 0) / (last7.length || 1);

  if (last7.length >= 3 && avgScore7 >= 60) {
    list.push({
      id: "consistent",
      title: "Constante",
      description: "Media de foco ≥ 60/100 en los últimos días.",
    });
  }
  // --- Logros ligados a días / semana (heatmap-ish) ---

  // Día “intenso”: algún día con mucho tiempo de foco
  const heavyDay = history.find((h) => h.totalTimeMs >= 90 * 60 * 1000);
  if (heavyDay) {
    list.push({
      id: "heavy-day",
      title: "Día intenso",
      description: "Has tenido al menos un día con 90+ minutos de foco.",
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
        title: "Semana sólida",
        description: "Más de 5 horas de foco acumuladas en los últimos 7 días.",
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
        title: "Hoy mejor que ayer",
        description: "Has mejorado tu foco medio respecto al día anterior.",
      });
    }
  }

  // --- Logros por XP / nivel ---

  if (xp) {
    if (xp.totalXp >= 300) {
      list.push({
        id: "xp-300",
        title: "En marcha",
        description: "Has acumulado al menos 300 XP de foco.",
      });
    }

    if (xp.level >= 3) {
      list.push({
        id: "level-3",
        title: "Nivel 3 alcanzado",
        description: "Has subido hasta el nivel 3 de Focus Pulse.",
      });
    }

    if (xp.level >= 5) {
      list.push({
        id: "level-5",
        title: "Dev disciplinado",
        description: "Nivel 5 o superior. Llevas varias sesiones sólidas.",
      });
    }

    if (xp.level >= 10) {
      list.push({
        id: "level-10",
        title: "Leyenda del foco",
        description: "Nivel 10 o más. Tu disciplina es seria.",
      });
    }
  }

  // --- Logros específicos de Pomodoro ---

  if (pomodoroStats) {
    if (pomodoroStats.today >= 1) {
      list.push({
        id: "pomo-first",
        title: "Primer pomodoro",
        description:
          "Has completado un bloque de trabajo con el temporizador hoy.",
      });
    }

    if (pomodoroStats.today >= 4) {
      list.push({
        id: "pomo-4-today",
        title: "Cuatro bloques",
        description: "Has completado 4 pomodoros en un solo día.",
      });
    }

    if (pomodoroStats.total >= 20) {
      list.push({
        id: "pomo-20-total",
        title: "Acumulador de bloques",
        description: "Has completado 20 pomodoros en total.",
      });
    }

    if (pomodoroStats.total >= 50) {
      list.push({
        id: "pomo-50-total",
        title: "Máquina de pomodoros",
        description: "Has completado 50 pomodoros en total.",
      });
    }
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
// Catálogo completo de logros conocidos por Focus Pulse
export function getAllAchievementsDefinitions(): Achievement[] {
  return [
    {
      id: "first-focus",
      title: "Primer enfoque",
      description: "Has trabajado al menos en un archivo hoy.",
    },
    {
      id: "twenty-mins",
      title: "20 minutos de foco",
      description: "Más de 20 minutos de trabajo hoy.",
    },
    {
      id: "hundred-edits",
      title: "Dedos de acero",
      description: "Has hecho 100+ ediciones en un archivo hoy.",
    },
    {
      id: "streak-3",
      title: "Racha x3",
      description: "Llevas al menos 3 días seguidos con sesión de foco.",
    },
    {
      id: "streak-7",
      title: "Semana épica",
      description: "7 días seguidos con trabajo registrado.",
    },
    {
      id: "consistent",
      title: "Constante",
      description: "Media de foco ≥ 60/100 en los últimos días.",
    },
    {
      id: "heavy-day",
      title: "Día intenso",
      description: "Has tenido al menos un día con 90+ minutos de foco.",
    },
    {
      id: "strong-week",
      title: "Semana sólida",
      description: "Más de 5 horas de foco en los últimos 7 días.",
    },
    {
      id: "today-better",
      title: "Hoy mejor que ayer",
      description: "Has mejorado tu foco medio respecto al día anterior.",
    },
    {
      id: "xp-300",
      title: "En marcha",
      description: "Has acumulado al menos 300 XP de foco.",
    },
    {
      id: "level-3",
      title: "Nivel 3 alcanzado",
      description: "Has subido hasta el nivel 3 de Focus Pulse.",
    },
    {
      id: "level-5",
      title: "Dev disciplinado",
      description: "Nivel 5 o superior. Varias sesiones sólidas.",
    },
    {
      id: "level-10",
      title: "Leyenda del foco",
      description: "Nivel 10 o más. Tu disciplina es seria.",
    },
    {
      id: "pomo-first",
      title: "Primer pomodoro",
      description: "Has completado un bloque de trabajo con el temporizador.",
    },
    {
      id: "pomo-4-today",
      title: "Cuatro bloques",
      description: "Has completado 4 pomodoros en un solo día.",
    },
    {
      id: "pomo-20-total",
      title: "Acumulador de bloques",
      description: "Has completado 20 pomodoros en total.",
    },
    {
      id: "pomo-50-total",
      title: "Máquina de pomodoros",
      description: "Has completado 50 pomodoros en total.",
    },
  ];
}
