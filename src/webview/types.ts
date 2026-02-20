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
  friends?: {
    friends: Array<{
      username: string;
      gistId: string;
      cachedProfile: {
        github_login: string;
        level: number;
        totalXp: number;
        totalFocusTimeMs: number;
        currentStreak: number;
        totalPomodoros: number;
        totalAchievements: number;
        avgScoreLast7Days: number;
        lastUpdatedAt: number;
      } | null;
      lastFetched: number;
    }>;
    ownProfile: {
      github_login: string;
      level: number;
      totalXp: number;
      totalFocusTimeMs: number;
      currentStreak: number;
      totalPomodoros: number;
      totalAchievements: number;
      avgScoreLast7Days: number;
      lastUpdatedAt: number;
    } | null;
    isAuthenticated: boolean;
    ownUsername: string | null;
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

// Import shared types from central location
import type { XpState } from "../state/StateTypes";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked?: boolean;
}

// Re-export for convenience
export type { XpState };

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