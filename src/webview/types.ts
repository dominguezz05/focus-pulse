export interface DashboardData {
  stats: FocusSummary[];
  history7: HistoryDay[];
  streak: number;
  achievements: Achievement[];
  xp: XpState;
  pomodoroStats?: PomodoroStats;
  historyAll?: HistoryDay[];
  deepWork?: DeepWorkState;
  weeklySummary?: {
    weekLabel: string;
    totalMinutes: number;
    avgScore: number;
  }[];
  goals?: {
    enabled: boolean;
    targetMinutes: number;
    targetPomodoros: number;
    minutesDone: number;
    pomodorosDone: number;
    doneMinutes: boolean;
    donePomodoros: boolean;
    allDone: boolean;
  };
  allAchievements?: (Achievement & { unlocked: boolean })[];
  sync?: {
    isAuthenticated: boolean;
    userEmail?: string;
    lastSync?: number;
    autoSyncEnabled: boolean;
  };
}

export interface FocusSummary {
  fileName: string;
  score: number;
  timeText: string;
  edits: number;
  added: number;
  deleted: number;
  switches: number;
}

export interface HistoryDay {
  date: string;
  totalTimeMs: number;
  avgScore: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked?: boolean;
}

export interface XpState {
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
}

export interface PomodoroStats {
  today: number;
  total: number;
}

export interface DeepWorkState {
  active: boolean;
}

export interface DashboardComponent {
  render(container: any, data: DashboardData): void;
  update?(data: DashboardData): void;
  destroy?(): void;
}