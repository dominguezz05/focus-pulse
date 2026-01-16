import * as vscode from 'vscode';
import { reloadConfig } from './config';
import { initStatusBar, refreshStatusBar } from './statusBar';
import {
    handleEditorChange,
    handleTextDocumentChange,
    getCurrentStats,
    computeFocusScore,
    formatMinutes,
    getStatsArray
} from './focusTracker';
import { openDashboard } from './dashboard';
import { initStorage, updateHistoryFromStats } from './storage';
import { initPomodoro, togglePomodoro } from './pomodoro';

async function updateAll() {
    refreshStatusBar();
    const statsArray = getStatsArray();
    await updateHistoryFromStats(statsArray);
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
        openDashboard();
    });
    context.subscriptions.push(commandOpenDashboard);

    const commandPomodoroToggle = vscode.commands.registerCommand('focusPulse.pomodoroToggle', () => {
        togglePomodoro();
    });
    context.subscriptions.push(commandPomodoroToggle);
}

export function deactivate() {
    // nada especial
}
