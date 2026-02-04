// ─── Constants ───────────────────────────────────────────────────────────────

export const FRIENDS_STORAGE_KEY = "focusPulse.friends";
export const PROFILE_GIST_DESCRIPTION = "Focus Pulse Profile";
export const PROFILE_GIST_FILENAME = "focus-pulse-profile.json";
export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Sanitized public stats stored in the user's public GitHub Gist. */
export interface PublicProfile {
  github_login: string;
  level: number;
  totalXp: number;
  totalFocusTimeMs: number;
  currentStreak: number;
  totalPomodoros: number;
  totalAchievements: number;
  avgScoreLast7Days: number;
  lastUpdatedAt: number;
}

/** One saved friend entry persisted in globalState. */
export interface FriendEntry {
  username: string;
  gistId: string;
  cachedProfile: PublicProfile | null;
  lastFetched: number; // epoch ms of last successful fetch
}

/** Payload sent to the webview for the Friends tab. */
export interface FriendsTabData {
  friends: FriendEntry[];
  ownProfile: PublicProfile | null;
  isAuthenticated: boolean;
  ownUsername: string | null;
}
