import { EventBus, SimpleEventBus } from './EventBus';
import { FOCUS_EVENTS } from './EventTypes';

// Global event bus instance
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new SimpleEventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
    globalEventBus = null;
  }
}

// Convenience functions for common events
export function emitFileFocusChanged(fileName: string, previousFile?: string): void {
  getEventBus().emit(FOCUS_EVENTS.FILE_FOCUS_CHANGED, {
    fileName,
    previousFile,
    timestamp: Date.now(),
  });
}

export function emitFileEditOccurred(fileName: string, editsCount: number, textDelta: { added: number; deleted: number }): void {
  getEventBus().emit(FOCUS_EVENTS.FILE_EDIT_OCCURRED, {
    fileName,
    editsCount,
    textDelta,
    timestamp: Date.now(),
  });
}

export function emitSessionUpdated(stats: any[], totalFocusTime: number, averageScore: number): void {
  getEventBus().emit(FOCUS_EVENTS.SESSION_UPDATED, {
    stats,
    totalFocusTime,
    averageScore,
    timestamp: Date.now(),
  });
}

export function emitPomodoroCompleted(duration: number, success: boolean): void {
  getEventBus().emit(FOCUS_EVENTS.POMODORO_COMPLETED, {
    duration,
    success,
    timestamp: Date.now(),
  });
}

export function emitAchievementUnlocked(title: string, description: string, id: string): void {
  getEventBus().emit(FOCUS_EVENTS.ACHIEVEMENT_UNLOCKED, {
    achievement: { title, description, id },
    timestamp: Date.now(),
  });
}

export function emitXpEarned(amount: number, source: string, totalXp: number): void {
  getEventBus().emit(FOCUS_EVENTS.XP_EARNED, {
    amount,
    source,
    totalXp,
    timestamp: Date.now(),
  });
}

export function emitLevelUp(newLevel: number, totalXp: number): void {
  getEventBus().emit(FOCUS_EVENTS.LEVEL_UP, {
    newLevel,
    totalXp,
    timestamp: Date.now(),
  });
}

export function emitDeepWorkStarted(expectedDuration?: number): void {
  getEventBus().emit(FOCUS_EVENTS.DEEP_WORK_STARTED, {
    timestamp: Date.now(),
    expectedDuration,
  });
}

export function emitDeepWorkEnded(duration: number, focusScore: number): void {
  getEventBus().emit(FOCUS_EVENTS.DEEP_WORK_ENDED, {
    duration,
    focusScore,
    timestamp: Date.now(),
  });
}

export function emitDashboardRefresh(reason: 'auto' | 'manual' | 'data_change'): void {
  getEventBus().emit(FOCUS_EVENTS.DASHBOARD_REFRESH, {
    reason,
    timestamp: Date.now(),
  });
}