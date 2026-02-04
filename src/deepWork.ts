import * as vscode from "vscode";
import { getEventBus } from "./events";
import { FOCUS_EVENTS } from "./events/EventTypes";

export interface DeepWorkState {
  active: boolean;
  startedAt: number | null; // timestamp en ms
  durationMinutes: number;
  completedSessions: number;
}

const STORAGE_KEY = "focusPulse.deepWorkState";

export function initDeepWork(context: vscode.ExtensionContext) {
  const stored = context.globalState.get<DeepWorkState>(STORAGE_KEY);
  if (!stored) {
    const cfg = vscode.workspace.getConfiguration("focusPulse");
    const duration = cfg.get<number>("deepWork.durationMinutes", 60);
    const initial: DeepWorkState = {
      active: false,
      startedAt: null,
      durationMinutes: duration,
      completedSessions: 0,
    };
    context.globalState.update(STORAGE_KEY, initial);
  }
}

export function getDeepWorkState(
  context: vscode.ExtensionContext,
): DeepWorkState {
  const cfg = vscode.workspace.getConfiguration("focusPulse");
  const duration = cfg.get<number>("deepWork.durationMinutes", 60);
  const stored = context.globalState.get<DeepWorkState>(STORAGE_KEY);
  return (
    stored ?? {
      active: false,
      startedAt: null,
      durationMinutes: duration,
      completedSessions: 0,
    }
  );
}

export async function toggleDeepWork(
  context: vscode.ExtensionContext,
): Promise<DeepWorkState> {
  const cfg = vscode.workspace.getConfiguration("focusPulse");
  const enabled = cfg.get<boolean>("deepWork.enabled", true);
  if (!enabled) {
    vscode.window.showInformationMessage(
      "Focus Pulse: el modo Deep Work está desactivado en la configuración.",
    );
    return getDeepWorkState(context);
  }

  let state = getDeepWorkState(context);

  if (!state.active) {
    const now = Date.now();
    state = {
      ...state,
      active: true,
      startedAt: now,
      durationMinutes: cfg.get<number>("deepWork.durationMinutes", 60),
    };
    getEventBus().emit(FOCUS_EVENTS.DEEP_WORK_STARTED, {
      timestamp: Date.now(),
      expectedDuration: state.durationMinutes,
    });
    vscode.window.showInformationMessage(
      `Focus Pulse: Deep Work iniciado (${state.durationMinutes} min).`,
    );
  } else {
    const elapsedMinutes = state.startedAt ? (Date.now() - state.startedAt) / 60000 : 0;
    getEventBus().emit(FOCUS_EVENTS.DEEP_WORK_ENDED, {
      duration: elapsedMinutes,
      focusScore: 0,
      timestamp: Date.now(),
    });
    state = {
      ...state,
      active: false,
      startedAt: null,
    };
    vscode.window.showInformationMessage("Focus Pulse: Deep Work detenido.");
  }

  await context.globalState.update(STORAGE_KEY, state);
  return state;
}

export async function checkDeepWorkCompletion(
  context: vscode.ExtensionContext,
): Promise<{ state: DeepWorkState; completed: boolean }> {
  let state = getDeepWorkState(context);
  if (!state.active || !state.startedAt) {
    return { state, completed: false };
  }

  const elapsedMin = (Date.now() - state.startedAt) / 60000;
  if (elapsedMin >= state.durationMinutes) {
    state = {
      ...state,
      active: false,
      startedAt: null,
      completedSessions: state.completedSessions + 1,
    };
    await context.globalState.update(STORAGE_KEY, state);
    getEventBus().emit(FOCUS_EVENTS.DEEP_WORK_ENDED, {
      duration: state.durationMinutes,
      focusScore: 0,
      timestamp: Date.now(),
    });
    vscode.window.showInformationMessage(
      "Focus Pulse: sesión de Deep Work completada. 🧠",
    );
    return { state, completed: true };
  }
  return { state, completed: false };
}
