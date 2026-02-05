import * as vscode from "vscode";
import {
  FriendEntry,
  FriendsTabData,
  PublicProfile,
  FRIENDS_STORAGE_KEY,
  PROFILE_GIST_DESCRIPTION,
  PROFILE_GIST_FILENAME,
  CACHE_TTL_MS,
} from "./FriendTypes";

interface BuildOwnProfileParams {
  githubLogin: string;
  level: number;
  totalXp: number;
  totalFocusTimeMs: number;
  currentStreak: number;
  totalPomodoros: number;
  totalAchievements: number;
  avgScoreLast7Days: number;
}

export class FriendService {
  private static instance: FriendService;
  private context: vscode.ExtensionContext | null = null;
  private cachedLogin: string | null = null;

  private constructor() {}

  static getInstance(): FriendService {
    if (!FriendService.instance) {
      FriendService.instance = new FriendService();
    }
    return FriendService.instance;
  }

  setContext(ctx: vscode.ExtensionContext): void {
    this.context = ctx;
  }

  // ─── Octokit helper ─────────────────────────────────────────────────────

  private async getOctokit(): Promise<any> {
    if (!this.context) {
      throw new Error("FriendService: contexto no inicializado.");
    }
    const token = await this.context.secrets.get("focusPulse.githubToken");
    if (!token) {
      throw new Error(
        "No estás autenticado. Ejecuta 'Focus Pulse: Autenticar cuenta' primero.",
      );
    }
    const { Octokit } = await import("@octokit/rest");
    return new Octokit({ auth: token });
  }

  // ─── Authenticated login (cached) ───────────────────────────────────────

  async getAuthenticatedLogin(): Promise<string | null> {
    if (this.cachedLogin) return this.cachedLogin;

    if (!this.context) return null;

    // Try persisted cache first
    const stored = this.context.globalState.get<string>(
      "focusPulse.githubLogin",
    );
    if (stored) {
      this.cachedLogin = stored;
      return stored;
    }

    // Fetch from GitHub
    try {
      const octokit = await this.getOctokit();
      const { data } = await octokit.rest.users.getAuthenticated();
      const login: string = data.login;
      await this.context.globalState.update("focusPulse.githubLogin", login);
      this.cachedLogin = login;
      return login;
    } catch {
      return null;
    }
  }

  // ─── Build own profile (pure computation, no network) ────────────────────

  buildOwnProfile(params: BuildOwnProfileParams): PublicProfile {
    return {
      github_login: params.githubLogin,
      level: params.level,
      totalXp: params.totalXp,
      totalFocusTimeMs: params.totalFocusTimeMs,
      currentStreak: params.currentStreak,
      totalPomodoros: params.totalPomodoros,
      totalAchievements: params.totalAchievements,
      avgScoreLast7Days: params.avgScoreLast7Days,
      lastUpdatedAt: Date.now(),
    };
  }

  // ─── Share profile (create/update public gist) ──────────────────────────

  async shareProfile(profile: PublicProfile): Promise<string> {
    const octokit = await this.getOctokit();

    // List own gists, look for existing profile gist
    let existingGistId: string | null = null;

    // Paginate through user's gists (max 100 per page)
    const { data: gists } = await octokit.rest.gists.list({
      per_page: 100,
    });

    for (const g of gists as any[]) {
      if (g.description === PROFILE_GIST_DESCRIPTION) {
        existingGistId = g.id;
        break;
      }
    }

    const content = JSON.stringify(profile, null, 2);

    if (existingGistId) {
      // Update existing gist
      await octokit.rest.gists.update({
        gist_id: existingGistId,
        files: {
          [PROFILE_GIST_FILENAME]: { content },
        },
      });
      return existingGistId;
    }

    // Create new public gist
    const { data: newGist } = await octokit.rest.gists.create({
      description: PROFILE_GIST_DESCRIPTION,
      public: true,
      files: {
        [PROFILE_GIST_FILENAME]: { content },
      },
    });

    return (newGist as any).id;
  }

  // ─── Add friend by GitHub username ───────────────────────────────────────

  async addFriendByUsername(username: string): Promise<FriendEntry> {
    const octokit = await this.getOctokit();

    // Search through user's public gists
    const { data: gists } = await octokit.rest.gists.listForUser({
      username,
      per_page: 100,
    });

    let profileGist: any = null;
    for (const g of gists as any[]) {
      if (g.description === PROFILE_GIST_DESCRIPTION) {
        profileGist = g;
        break;
      }
    }

    if (!profileGist) {
      throw new Error(
        `No se encontró perfil de Focus Pulse para el usuario "${username}". ¿Ha compartido su perfil?`,
      );
    }

    // Fetch full gist content (list endpoint truncates files)
    const { data: fullGist } = await octokit.rest.gists.get({
      gist_id: profileGist.id,
    });

    const fileContent =
      (fullGist.files as any)[PROFILE_GIST_FILENAME]?.content;
    if (!fileContent) {
      throw new Error(
        `El gist del usuario "${username}" no contiene un archivo de perfil válido.`,
      );
    }

    const profile: PublicProfile = JSON.parse(fileContent);

    const entry: FriendEntry = {
      username,
      gistId: profileGist.id,
      cachedProfile: profile,
      lastFetched: Date.now(),
    };

    this.addToList(entry);
    return entry;
  }

  // ─── Add friend by Gist ID ───────────────────────────────────────────────

  async addFriendByGistId(gistId: string): Promise<FriendEntry> {
    const octokit = await this.getOctokit();

    const { data: gist } = await octokit.rest.gists.get({ gist_id: gistId });

    if ((gist as any).description !== PROFILE_GIST_DESCRIPTION) {
      throw new Error(
        "El gist proporcionado no es un perfil de Focus Pulse válido.",
      );
    }

    const fileContent =
      ((gist as any).files as any)[PROFILE_GIST_FILENAME]?.content;
    if (!fileContent) {
      throw new Error(
        "El gist no contiene el archivo de perfil esperado.",
      );
    }

    const profile: PublicProfile = JSON.parse(fileContent);
    const username = profile.github_login || (gist as any).owner?.login || "desconocido";

    const entry: FriendEntry = {
      username,
      gistId,
      cachedProfile: profile,
      lastFetched: Date.now(),
    };

    this.addToList(entry);
    return entry;
  }

  // ─── Remove friend ───────────────────────────────────────────────────────

  async removeFriend(username: string): Promise<void> {
    const friends = this.loadFriends();
    const updated = friends.filter((f) => f.username !== username);
    this.saveFriends(updated);
  }

  // ─── Refresh all friends (respects cache TTL) ────────────────────────────

  async refreshFriends(force = false): Promise<FriendEntry[]> {
    const friends = this.loadFriends();
    const now = Date.now();
    let octokit: any = null;

    for (const friend of friends) {
      if (!force && friend.lastFetched && now - friend.lastFetched < CACHE_TTL_MS) {
        continue; // still fresh
      }

      try {
        if (!octokit) octokit = await this.getOctokit();

        const { data: gist } = await octokit.rest.gists.get({
          gist_id: friend.gistId,
        });

        const fileContent =
          ((gist as any).files as any)[PROFILE_GIST_FILENAME]?.content;
        if (fileContent) {
          friend.cachedProfile = JSON.parse(fileContent);
          friend.lastFetched = now;
        }
      } catch (err) {
        // Network error — keep stale cache, don't crash
        console.warn(
          `FriendService: no se pudo actualizar el perfil de ${friend.username}:`,
          err,
        );
      }
    }

    this.saveFriends(friends);
    return friends;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  loadFriends(): FriendEntry[] {
    if (!this.context) return [];
    return this.context.globalState.get<FriendEntry[]>(FRIENDS_STORAGE_KEY) || [];
  }

  saveFriends(friends: FriendEntry[]): void {
    if (!this.context) return;
    this.context.globalState.update(FRIENDS_STORAGE_KEY, friends);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private addToList(entry: FriendEntry): void {
    const friends = this.loadFriends();
    // Replace if already exists (same username)
    const idx = friends.findIndex((f) => f.username === entry.username);
    if (idx >= 0) {
      friends[idx] = entry;
    } else {
      friends.push(entry);
    }
    this.saveFriends(friends);
  }
}
