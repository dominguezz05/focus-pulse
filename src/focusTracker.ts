import * as vscode from "vscode";
import { getMinMinutesForScore, getScoreWeights } from "./config";
import { getEventBus } from "./events";
import { FOCUS_EVENTS } from "./events/EventTypes";

export interface FocusStats {
  uri: string;
  fileName: string;
  timeMs: number;
  edits: number;
  switches: number;
  added: number;
  deleted: number;
  lastActivatedAt: number;
}

export interface FocusSummary {
  fileName: string;
  timeText: string;
  score: number;
  edits: number;
  added: number;
  deleted: number;
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
      added: 0,
      deleted: 0,
      lastActivatedAt: Date.now(),
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

  const weights = getScoreWeights();

  // score_raw = (tiempo * w_tiempo) + (edits/min * w_edits) - (switches/min * penalización)
  let score =
    minutes * weights.timeWeight +
    editsPerMin * weights.editsWeight -
    switchesPerMin * weights.switchPenalty;

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

export function handleEditorChange(
  editor: vscode.TextEditor | undefined,
): void {
  const now = Date.now();

  // acumular tiempo en el fichero que estaba activo hasta ahora
  if (currentUri && statsByDoc.has(currentUri)) {
    const prevStats = statsByDoc.get(currentUri)!;
    prevStats.timeMs += now - lastSwitchTime;
  }

  if (!editor || !editor.document) {
    currentUri = undefined;
    return;
  }

  const uri = editor.document.uri.toString();
  const fileName =
    editor.document.fileName.split(/[\\/]/).pop() || editor.document.fileName;
  const stats = getOrCreateStats(uri, fileName);

  const previousUri = currentUri;
  const previousFileName = previousUri ? statsByDoc.get(previousUri)?.fileName : undefined;

  if (currentUri && currentUri !== uri) {
    stats.switches += 1;

    // Emit file switch event
    getEventBus().emit(FOCUS_EVENTS.FILE_SWITCH_OCCURRED, {
      fromFile: previousFileName || 'unknown',
      toFile: fileName,
      switchCount: stats.switches,
      timestamp: now
    });
  }

  currentUri = uri;
  stats.lastActivatedAt = now;
  lastSwitchTime = now;

  // Emit focus changed event
  getEventBus().emit(FOCUS_EVENTS.FILE_FOCUS_CHANGED, {
    fileName: fileName,
    previousFile: previousFileName,
    timestamp: now
  });
}

export function handleTextDocumentChange(
  event: vscode.TextDocumentChangeEvent,
): void {
  const uri = event.document.uri.toString();
  const fileName =
    event.document.fileName.split(/[\\/]/).pop() || event.document.fileName;
  const stats = getOrCreateStats(uri, fileName);

  // número de cambios (edits)
  stats.edits += event.contentChanges.length;

  for (const change of event.contentChanges) {
    const removed = change.rangeLength ?? 0;
    const added = change.text.length;

    stats.added += added;
    stats.deleted += removed;
  }

  // Emit event for file edit
  getEventBus().emit(FOCUS_EVENTS.FILE_EDIT_OCCURRED, {
    fileName: stats.fileName,
    editsCount: stats.edits,
    textDelta: { added: stats.added, deleted: stats.deleted },
    timestamp: Date.now()
  });
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
      added: stats.added,
      deleted: stats.deleted,
      switches: stats.switches,
    });
  }

  arr.sort((a, b) => b.score - a.score);
  return arr;
}

export function resetFocusStats(): void {
  statsByDoc.clear();
  currentUri = undefined;
  lastSwitchTime = Date.now();
}
