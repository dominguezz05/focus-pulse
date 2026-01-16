import * as vscode from 'vscode';
import { getMinMinutesForScore } from './config';

export interface FocusStats {
    uri: string;
    fileName: string;
    timeMs: number;
    edits: number;
    switches: number;
    lastActivatedAt: number;
}

export interface FocusSummary {
    fileName: string;
    timeText: string;
    score: number;
    edits: number;
    switches: number;
}

const statsByDoc = new Map<string, FocusStats>();
let currentUri: string | undefined;
let lastSwitchTime = Date.now();

function getOrCreateStats(uri: string, fileName: string): FocusStats {
    let stats = statsByDoc.get(uri);
    if (!stats) {
        stats = {
            uri,
            fileName,
            timeMs: 0,
            edits: 0,
            switches: 0,
            lastActivatedAt: Date.now()
        };
        statsByDoc.set(uri, stats);
    }
    return stats;
}

export function computeFocusScore(s: FocusStats): number {
    let minutes = s.timeMs / 60000;
    const minMinutes = getMinMinutesForScore();
    if (minutes < minMinutes) {
        minutes = minMinutes;
    }

    const editsPerMin = s.edits / minutes;
    const switchesPerMin = s.switches / Math.max(minutes, 0.1);

    let score = editsPerMin * 8 - switchesPerMin * 15;

    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return Math.round(score);
}

export function formatMinutes(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes === 0) {
        return `${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
}

export function handleEditorChange(editor: vscode.TextEditor | undefined): void {
    const now = Date.now();

    if (currentUri && statsByDoc.has(currentUri)) {
        const prevStats = statsByDoc.get(currentUri)!;
        prevStats.timeMs += now - lastSwitchTime;
    }

    if (!editor || !editor.document) {
        currentUri = undefined;
        return;
    }

    const uri = editor.document.uri.toString();
    const fileName = editor.document.fileName.split(/[\\/]/).pop() || editor.document.fileName;
    const stats = getOrCreateStats(uri, fileName);

    if (currentUri && currentUri !== uri) {
        stats.switches += 1;
    }

    currentUri = uri;
    stats.lastActivatedAt = now;
    lastSwitchTime = now;
}

export function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const uri = event.document.uri.toString();
    const fileName = event.document.fileName.split(/[\\/]/).pop() || event.document.fileName;
    const stats = getOrCreateStats(uri, fileName);
    stats.edits += event.contentChanges.length;
}

export function getCurrentStats(): FocusStats | undefined {
    if (!currentUri) return undefined;
    return statsByDoc.get(currentUri);
}

export function getStatsArray(): FocusSummary[] {
    const arr: FocusSummary[] = [];

    for (const stats of statsByDoc.values()) {
        const score = computeFocusScore(stats);
        arr.push({
            fileName: stats.fileName,
            timeText: formatMinutes(stats.timeMs),
            score,
            edits: stats.edits,
            switches: stats.switches
        });
    }

    arr.sort((a, b) => b.score - a.score);
    return arr;
}
