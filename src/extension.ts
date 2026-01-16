import * as vscode from 'vscode';
import { reloadConfig } from './config';
import { initStatusBar, refreshStatusBar } from './statusBar';
import {
    handleEditorChange,
    handleTextDocumentChange,
    getCurrentStats,
    computeFocusScore,
    formatMinutes,
    getStatsArray,
    FocusSummary,
    resetFocusStats
} from './focusTracker';
import { openDashboard, updateDashboard } from './dashboard';
import {
    initStorage,
    updateHistoryFromStats,
    getLastDays,
    getStreakDays,
    getHistory,
    clearHistory
} from './storage';
import { initPomodoro, togglePomodoro } from './pomodoro';
import { computeAchievements } from './achievements';
import { computeXpStateFromHistory } from './xp';

async function updateAll() {
    refreshStatusBar();

    const statsArray = getStatsArray();
    await updateHistoryFromStats(statsArray);

    // Histórico completo para XP
    const fullHistory = getHistory();
    const xp = computeXpStateFromHistory(fullHistory);

    const history7 = getLastDays(7);
    const streak = getStreakDays();
    const achievements = computeAchievements(
        streak,
        history7,
        statsArray as FocusSummary[],
        xp
    );

    updateDashboard({
        stats: statsArray,
        history7,
        streak,
        achievements,
        xp
    });
}

export function activate(context: vscode.ExtensionContext) {
    reloadConfig();
    initStorage(context);
    initStatusBar(context);
    initPomodoro(context);

    handleEditorChange(vscode.window.activeTextEditor);
    updateAll();

    const configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('focusPulse')) {
            reloadConfig();
            updateAll();
        }
    });
    context.subscriptions.push(configDisposable);

    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        handleEditorChange(editor);
        updateAll();
    });
    context.subscriptions.push(editorChangeDisposable);

    const editDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        handleTextDocumentChange(event);
        updateAll();
    });
    context.subscriptions.push(editDisposable);

    const commandShowStats = vscode.commands.registerCommand('focusPulse.showStats', () => {
        const stats = getCurrentStats();
        if (!stats) {
            vscode.window.showInformationMessage('Focus Pulse: no hay estadísticas para el archivo actual.');
            return;
        }

        const score = computeFocusScore(stats);
        const message =
            `Focus Pulse\n\n` +
            `Archivo: ${stats.fileName}\n` +
            `Puntuación de foco: ${score}/100\n` +
            `Tiempo total: ${formatMinutes(stats.timeMs)}\n` +
            `Ediciones: ${stats.edits}\n` +
            `Cambios de fichero: ${stats.switches}`;

        vscode.window.showInformationMessage(message, { modal: true });
    });
    context.subscriptions.push(commandShowStats);

    const commandOpenDashboard = vscode.commands.registerCommand('focusPulse.openDashboard', () => {
        openDashboard(context);
        updateAll();
    });
    context.subscriptions.push(commandOpenDashboard);

    const commandPomodoroToggle = vscode.commands.registerCommand('focusPulse.pomodoroToggle', () => {
        togglePomodoro();
    });
    context.subscriptions.push(commandPomodoroToggle);

    const commandResetData = vscode.commands.registerCommand('focusPulse.resetData', async () => {
        const answer = await vscode.window.showWarningMessage(
            'Esto borrará el histórico de días, racha y XP calculada. ¿Seguro?',
            'Sí, resetear',
            'Cancelar'
        );
        if (answer !== 'Sí, resetear') {
            return;
        }

        resetFocusStats();
        await clearHistory();
        await updateAll();

        vscode.window.showInformationMessage('Focus Pulse: histórico y XP reseteados.');
    });
    context.subscriptions.push(commandResetData);
}

export function deactivate() {
    // nada especial
}
