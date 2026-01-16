import type { HistoryDay } from './storage';
import type { FocusSummary } from './focusTracker';

export interface Achievement {
    id: string;
    title: string;
    description: string;
}

export function computeAchievements(
    streakDays: number,
    history: HistoryDay[],
    todayStats: FocusSummary[]
): Achievement[] {
    const list: Achievement[] = [];

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

    const last7 = history.slice(-7);
    const avgScore7 =
        last7.reduce((a, h) => a + h.avgScore, 0) /
        (last7.length || 1);

    if (last7.length >= 3 && avgScore7 >= 60) {
        list.push({
            id: 'consistent',
            title: 'Constante',
            description: 'Media de foco ≥ 60/100 en los últimos días.'
        });
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
