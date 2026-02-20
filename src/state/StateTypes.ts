export interface AppState {
  focus: FocusState;
  pomodoro: PomodoroState;
  achievements: AchievementState;
  xp: XpState;
  deepWork: DeepWorkState;
  goals: GoalsState;
  ui: UIState;
  session: SessionState;
}

export interface FocusState {
  currentFile: string | null;
  previousFile: string | null;
  sessionStats: any[];
  totalFocusTime: number;
  averageScore: number;
  lastUpdateTime: number;
}

export interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  remainingTime: number;
  totalTime: number;
  cycleCount: number;
  todayCount: number;
  totalCount: number;
  lastUpdateTime: number;
}

export interface AchievementState {
  unlocked: string[];
  inProgress: Record<string, number>;
  lastUnlocked: string | null;
  lastCheckTime: number;
}

export interface XpState {
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  lastXpGain?: number; // Optional - not actively used
  lastXpSource?: string; // Optional - not actively used
}

export interface DeepWorkState {
  active: boolean;
  startTime: number | null;
  duration: number;
  expectedDuration: number | null;
  score: number;
}

export interface GoalsState {
  enabled: boolean;
  targetMinutes: number;
  targetPomodoros: number;
  minutesDone: number;
  pomodorosDone: number;
  doneMinutes: boolean;
  donePomodoros: boolean;
  allDone: boolean;
  lastUpdateTime: number;
}

export interface UIState {
  dashboardOpen: boolean;
  lastRefreshTime: number;
  updateQueue: string[];
  isLoading: boolean;
}

export interface SessionState {
  startTime: number;
  endTime: number | null;
  filesWorked: Set<string>;
  totalEdits: number;
  totalSwitches: number;
  isActive: boolean;
}

export interface StateSubscriber<T = any> {
  (state: T, previousState: T | undefined): void;
}

export interface StateManager {
  getState(): AppState;
  setState(partialState: Partial<AppState>): void;
  subscribe(subscriber: StateSubscriber<AppState>): () => void;
  subscribeToKey<T extends keyof AppState>(
    key: T,
    subscriber: StateSubscriber<AppState[T]>
  ): () => void;
  reset(): void;
  persist(): Promise<void>;
  load(): Promise<void>;
}