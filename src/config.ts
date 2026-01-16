import * as vscode from 'vscode';

let config = vscode.workspace.getConfiguration('focusPulse');

export function reloadConfig() {
    config = vscode.workspace.getConfiguration('focusPulse');
}

export function isStatusBarEnabled(): boolean {
    return config.get<boolean>('enableStatusBar', true);
}

export function getMinMinutesForScore(): number {
    const value = config.get<number>('minMinutesForScore');
    return Math.max(value ?? 1, 0.1);
}
