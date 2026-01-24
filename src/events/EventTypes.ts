// Event types for Focus Pulse
export const FOCUS_EVENTS = {
  // File tracking events
  FILE_FOCUS_CHANGED: 'file:focus:changed',
  FILE_EDIT_OCCURRED: 'file:edit:occurred',
  FILE_SWITCH_OCCURRED: 'file:switch:occurred',
  
  // Session events
  SESSION_STARTED: 'session:started',
  SESSION_ENDED: 'session:ended',
  SESSION_UPDATED: 'session:updated',
  
  // Pomodoro events
  POMODORO_STARTED: 'pomodoro:started',
  POMODORO_COMPLETED: 'pomodoro:completed',
  POMODORO_PAUSED: 'pomodoro:paused',
  POMODORO_RESET: 'pomodoro:reset',
  
  // Achievement events
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ACHIEVEMENT_PROGRESS: 'achievement:progress',
  
  // XP events
  XP_EARNED: 'xp:earned',
  LEVEL_UP: 'xp:level_up',
  
  // Deep Work events
  DEEP_WORK_STARTED: 'deepwork:started',
  DEEP_WORK_ENDED: 'deepwork:ended',
  DEEP_WORK_UPDATED: 'deepwork:updated',
  
  // Goals events
  GOAL_PROGRESS: 'goal:progress',
  GOAL_COMPLETED: 'goal:completed',
  
  // Dashboard events
  DASHBOARD_OPENED: 'dashboard:opened',
  DASHBOARD_CLOSED: 'dashboard:closed',
  DASHBOARD_REFRESH: 'dashboard:refresh',
  
  // Storage events
  DATA_SAVED: 'data:saved',
  DATA_LOADED: 'data:loaded',
  DATA_RESET: 'data:reset',
  
  // Configuration events
  CONFIG_CHANGED: 'config:changed',
} as const;

// Event data interfaces
export interface FileFocusChangedData {
  fileName: string;
  previousFile?: string;
  timestamp: number;
}

export interface FileEditOccurredData {
  fileName: string;
  editsCount: number;
  textDelta: { added: number; deleted: number };
  timestamp: number;
}

export interface FileSwitchOccurredData {
  fromFile: string;
  toFile: string;
  switchCount: number;
  timestamp: number;
}

export interface SessionUpdatedData {
  stats: any[];
  totalFocusTime: number;
  averageScore: number;
  timestamp: number;
}

export interface PomodoroCompletedData {
  duration: number;
  success: boolean;
  timestamp: number;
}

export interface AchievementUnlockedData {
  achievement: {
    title: string;
    description: string;
    id: string;
  };
  timestamp: number;
}

export interface XpEarnedData {
  amount: number;
  source: string;
  totalXp: number;
  timestamp: number;
}

export interface LevelUpData {
  newLevel: number;
  totalXp: number;
  timestamp: number;
}

export interface DeepWorkStartedData {
  timestamp: number;
  expectedDuration?: number;
}

export interface DeepWorkEndedData {
  duration: number;
  focusScore: number;
  timestamp: number;
}

export interface GoalProgressData {
  type: 'minutes' | 'pomodoros';
  current: number;
  target: number;
  completed: boolean;
  timestamp: number;
}

export interface DashboardRefreshData {
  reason: 'auto' | 'manual' | 'data_change';
  timestamp: number;
}

export interface ConfigChangedData {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}