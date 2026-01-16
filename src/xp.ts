import type { HistoryDay } from './storage';

export interface XpState {
    totalXp: number;
    level: number;
    xpInLevel: number;
    xpToNext: number;
}

// XP total a partir del histórico (todas las sesiones)
export function computeXpStateFromHistory(history: HistoryDay[]): XpState {
    if (!history.length) {
        return {
            totalXp: 0,
            level: 1,
            xpInLevel: 0,
            xpToNext: xpNeededForLevel(1)
        };
    }

    const totalXp = history.reduce((acc, day) => {
        const minutes = day.totalTimeMs / 60000;
        // factor 10 para que los números de XP sean “gustosos”
        const dayXp = minutes * (day.avgScore / 100) * 10;
        return acc + dayXp;
    }, 0);

    return computeXpStateFromTotal(totalXp);
}

function computeXpStateFromTotal(totalXp: number): XpState {
    let level = 1;
    let xpRemaining = totalXp;
    let xpToNext = xpNeededForLevel(level);

    // restamos niveles hasta que no llegue al siguiente
    while (xpRemaining >= xpToNext) {
        xpRemaining -= xpToNext;
        level++;
        xpToNext = xpNeededForLevel(level);
    }

    return {
        totalXp,
        level,
        xpInLevel: xpRemaining,
        xpToNext
    };
}

// curva simple: cada nivel requiere un poco más
function xpNeededForLevel(level: number): number {
    // p.ej. 100, 150, 200, 250, ...
    return 100 + (level - 1) * 50;
}
