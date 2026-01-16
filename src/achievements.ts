import type { HistoryDay } from './storage';
import type { FocusSummary } from './focusTracker';
import type { XpState, PomodoroStats } from './xp';

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
    pomodoroStats?: PomodoroStats
): Achievement[] {
    const list: Achievement[] = [];

    // --- Logros básicos por sesión de hoy ---

    if (todayStats.length > 0) {
        list.push({
            id: 'first-focus',
            title: 'Primer enfoque',
            description: 'Has trabajado al menos en un archivo hoy.'
        });
    }

    const totalTodayTimeMs = todayStats
        .map(s => parseTimeToMs(s.timeText))
        .reduce((a, b) => a + b, 0);

    if (totalTodayTimeMs >= 20 * 60 * 1000) {
        list.push({
            id: 'twenty-mins',
            title: '20 minutos de foco',
            description: 'Más de 20 minutos de trabajo hoy.'
        });
    }

    const maxEdits = todayStats.reduce((max, s) => Math.max(max, s.edits), 0);
    if (maxEdits >= 100) {
        list.push({
            id: 'hundred-edits',
            title: 'Dedos de acero',
            description: 'Has hecho 100+ ediciones en un archivo hoy.'
        });
    }

    // --- Logros por racha ---

    if (streakDays >= 3) {
        list.push({
            id: 'streak-3',
            title: 'Racha x3',
            description: `Llevas ${streakDays} días seguidos con sesión de foco.`
        });
    }

    if (streakDays >= 7) {
        list.push({
            id: 'streak-7',
            title: 'Semana épica',
            description: '7 días seguidos con trabajo registrado.'
        });
    }

    // --- Logros por consistencia (últimos días) ---

    const last7 = history.slice(-7);
    const avgScore7 =
        last7.reduce((a, h) => a + h.avgScore, 0) / (last7.length || 1);

    if (last7.length >= 3 && avgScore7 >= 60) {
        list.push({
            id: 'consistent',
            title: 'Constante',
            description: 'Media de foco ≥ 60/100 en los últimos días.'
        });
    }

    // --- Logros por XP / nivel ---

    if (xp) {
        if (xp.totalXp >= 300) {
            list.push({
                id: 'xp-300',
                title: 'En marcha',
                description: 'Has acumulado al menos 300 XP de foco.'
            });
        }

        if (xp.level >= 3) {
            list.push({
                id: 'level-3',
                title: 'Nivel 3 alcanzado',
                description: 'Has subido hasta el nivel 3 de Focus Pulse.'
            });
        }

        if (xp.level >= 5) {
            list.push({
                id: 'level-5',
                title: 'Dev disciplinado',
                description: 'Nivel 5 o superior. Llevas varias sesiones sólidas.'
            });
        }

        if (xp.level >= 10) {
            list.push({
                id: 'level-10',
                title: 'Leyenda del foco',
                description: 'Nivel 10 o más. Tu disciplina es seria.'
            });
        }
    }

    // --- Logros específicos de Pomodoro ---

    if (pomodoroStats) {
        if (pomodoroStats.today >= 1) {
            list.push({
                id: 'pomo-first',
                title: 'Primer pomodoro',
                description: 'Has completado un bloque de trabajo con el temporizador hoy.'
            });
        }

        if (pomodoroStats.today >= 4) {
            list.push({
                id: 'pomo-4-today',
                title: 'Cuatro bloques',
                description: 'Has completado 4 pomodoros en un solo día.'
            });
        }

        if (pomodoroStats.total >= 20) {
            list.push({
                id: 'pomo-20-total',
                title: 'Acumulador de bloques',
                description: 'Has completado 20 pomodoros en total.'
            });
        }

        if (pomodoroStats.total >= 50) {
            list.push({
                id: 'pomo-50-total',
                title: 'Máquina de pomodoros',
                description: 'Has completado 50 pomodoros en total.'
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
