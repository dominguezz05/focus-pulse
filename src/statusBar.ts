import * as vscode from 'vscode';
import { getCurrentStats, computeFocusScore, formatMinutes } from './focusTracker';
import { isStatusBarEnabled } from './config';
import { getHistory } from './storage';
import { computeXpStateFromHistory } from './xp';

let statusBarItem: vscode.StatusBarItem;

function getScoreColor(score: number): string {
    if (score >= 80) {
        return '#4caf50';
    }
    if (score >= 50) {
        return '#ffb300';
    }
    return '#e53935';
}

export function initStatusBar(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'focusPulse.openDashboard';
    statusBarItem.text = '$(pulse) Lvl 1 · Focus: -';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
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

    // XP / nivel global calculado a partir del histórico
    let level = 1;
    let totalXp = 0;

    try {
        const history = getHistory();
        const xpState = computeXpStateFromHistory(history);
        level = xpState.level;
        totalXp = xpState.totalXp;
    } catch {
        // si todavía no está inicializado el storage, usamos valores por defecto
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
}
