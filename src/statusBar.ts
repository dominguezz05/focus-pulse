import * as vscode from 'vscode';
import { getCurrentStats, computeFocusScore, formatMinutes } from './focusTracker';
import { isStatusBarEnabled } from './config';

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
    statusBarItem.text = '$(pulse) Focus: -';
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

    statusBarItem.show();

    if (!stats) {
        statusBarItem.text = '$(pulse) Focus: -';
        statusBarItem.tooltip = 'Focus Pulse: sin archivo activo';
        statusBarItem.color = undefined;
        return;
    }

    const score = computeFocusScore(stats);
    const timeText = formatMinutes(stats.timeMs);

    statusBarItem.text = `$(pulse) Focus: ${score} | ${timeText} | edits: ${stats.edits}`;
    statusBarItem.tooltip =
        `Focus Pulse\n\n` +
        `Archivo: ${stats.fileName}\n` +
        `Puntuación: ${score}/100\n` +
        `Tiempo: ${timeText}\n` +
        `Ediciones: ${stats.edits}\n` +
        `Cambios de fichero: ${stats.switches}`;
    statusBarItem.color = getScoreColor(score);
}
