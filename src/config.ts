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

export interface ScoreWeights {
    timeWeight: number;
    editsWeight: number;
    switchPenalty: number;
}

export function getScoreWeights(): ScoreWeights {
    const timeWeight = config.get<number>('score.timeWeight', 0.3);
    const editsWeight = config.get<number>('score.editsWeight', 8);
    const switchPenalty = config.get<number>('score.switchPenalty', 15);

    return {
        timeWeight: Math.max(0, timeWeight),
        editsWeight: Math.max(0, editsWeight),
        switchPenalty: Math.max(0, switchPenalty)
    };
}
