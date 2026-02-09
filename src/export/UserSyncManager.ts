import * as vscode from "vscode";
import { DataExportManager, ExportData } from "./DataExportManager";

export interface UserAccount {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  lastSyncAt?: string;
}

export interface SyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // minutes
  includeHistory?: boolean;
  includeState?: boolean;
  includeConfiguration?: boolean;
}

export interface CloudSyncProvider {
  authenticate(): Promise<UserAccount>;
  upload(data: ExportData): Promise<string>;
  download(syncId: string): Promise<ExportData>;
  listSyncs(): Promise<
    Array<{ id: string; timestamp: string; version: string }>
  >;
  delete(syncId: string): Promise<void>;
}

export class UserSyncManager {
  private static instance: UserSyncManager;
  private syncProvider: CloudSyncProvider | null = null;
  private currentUser: UserAccount | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;

  static getInstance(): UserSyncManager {
    if (!UserSyncManager.instance) {
      UserSyncManager.instance = new UserSyncManager();
    }
    return UserSyncManager.instance;
  }

  constructor() {
    this.loadStoredUser();
  }

  async authenticate(provider: CloudSyncProvider): Promise<UserAccount> {
    try {
      this.syncProvider = provider;
      this.currentUser = await provider.authenticate();
      await this.storeUser(this.currentUser);

      vscode.window.showInformationMessage(
        `Successfully authenticated as ${this.currentUser.email}`,
      );

      return this.currentUser;
    } catch (error) {
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      throw error;
    }
  }

  async enableAutoSync(options: SyncOptions = {}): Promise<void> {
    if (!this.currentUser || !this.syncProvider) {
      throw new Error("User not authenticated. Please authenticate first.");
    }

    // Clear existing timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const interval = (options.syncInterval || 30) * 60 * 1000; // Convert to milliseconds

    this.syncTimer = setInterval(async () => {
      try {
        await this.performSync(options);
      } catch (error) {
        console.error("Auto-sync failed:", error);
      }
    }, interval);

    vscode.window.showInformationMessage(
      `Auto-sync enabled (every ${options.syncInterval || 30} minutes)`,
    );
  }

  async disableAutoSync(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    vscode.window.showInformationMessage("Auto-sync disabled");
  }

  async performSync(options: SyncOptions = {}): Promise<string> {
    if (!this.currentUser || !this.syncProvider) {
      throw new Error("User not authenticated");
    }

    try {
      const exportManager = DataExportManager.getInstance();

      // Export data based on options
      const fullData = JSON.parse(await exportManager.exportData("json"));

      // Prepare data for sync
      const data: ExportData = {
        version: "2.2.0",
        exportDate: new Date().toISOString(),
        userAccount: {
          id: this.currentUser.id,
          email: this.currentUser.email,
        },
        configuration:
          options.includeConfiguration !== false
            ? fullData.configuration
            : {
                enableStatusBar: false,
                minMinutesForScore: 1,
                scoreWeights: {
                  timeWeight: 0,
                  editsWeight: 0,
                  switchPenalty: 0,
                },
                pomodoro: { enabled: false, workMinutes: 25, breakMinutes: 5 },
                goals: {
                  enabled: false,
                  targetMinutes: 60,
                  targetPomodoros: 3,
                },
                deepWork: {
                  enabled: false,
                  durationMinutes: 60,
                  switchPenalty: 40,
                  xpBonus: 150,
                },
              },
        state:
          options.includeState !== false
            ? fullData.state
            : {
                focus: null,
                pomodoro: null,
                achievements: null,
                xp: null,
                deepWork: null,
                goals: null,
                session: null,
              },
        history: options.includeHistory !== false ? fullData.history : [],
      };

      // Upload to cloud
      const syncId = await this.syncProvider.upload(data);

      // Update last sync time
      this.lastSyncTime = Date.now();
      this.currentUser.lastSyncAt = new Date().toISOString();
      await this.storeUser(this.currentUser);

      vscode.window.showInformationMessage(
        `Data synced successfully (Sync ID: ${syncId})`,
      );

      return syncId;
    } catch (error) {
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
      throw error;
    }
  }

  async downloadSync(syncId: string, options: SyncOptions = {}): Promise<void> {
    if (!this.syncProvider) {
      throw new Error("No sync provider available");
    }

    try {
      const data = await this.syncProvider.download(syncId);
      const exportManager = DataExportManager.getInstance();

      // Import data with merge options
      await exportManager.importData(JSON.stringify(data), "json", {
        mergeConfiguration: options.includeConfiguration !== false,
        mergeState: options.includeState !== false,
        mergeHistory: options.includeHistory !== false,
      });

      vscode.window.showInformationMessage(
        `Data imported from sync (Sync ID: ${syncId})`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Download sync failed: ${error}`);
      throw error;
    }
  }

  async listAvailableSyncs(): Promise<
    Array<{ id: string; timestamp: string; version: string }>
  > {
    if (!this.syncProvider) {
      throw new Error("No sync provider available");
    }

    return await this.syncProvider.listSyncs();
  }

  async deleteSync(syncId: string): Promise<void> {
    if (!this.syncProvider) {
      throw new Error("No sync provider available");
    }

    try {
      await this.syncProvider.delete(syncId);
      vscode.window.showInformationMessage(`Sync deleted: ${syncId}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Delete sync failed: ${error}`);
      throw error;
    }
  }

  getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  async setCurrentUser(user: UserAccount): Promise<void> {
    this.currentUser = user;
    await this.storeUser(user);
  }

  setProvider(provider: CloudSyncProvider): void {
    this.syncProvider = provider;
  }

  isAutoSyncEnabled(): boolean {
    return this.syncTimer !== null;
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.syncProvider = null;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    await this.clearStoredUser();
    vscode.window.showInformationMessage("Signed out successfully");
  }

  private context: vscode.ExtensionContext | null = null;

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  private async storeUser(user: UserAccount): Promise<void> {
    if (this.context) {
      await this.context.globalState.update("focusPulse.userAccount", user);
    }
  }

  private async loadStoredUser(): Promise<void> {
    if (this.context) {
      const stored = this.context.globalState.get<UserAccount>(
        "focusPulse.userAccount",
      );
      if (stored) {
        this.currentUser = stored;
      }
    }
  }

  private async clearStoredUser(): Promise<void> {
    if (this.context) {
      await this.context.globalState.update(
        "focusPulse.userAccount",
        undefined,
      );
    }
  }
}

// Example cloud provider implementations
export class MockCloudSyncProvider implements CloudSyncProvider {
  private users: Map<string, UserAccount> = new Map();
  private syncs: Map<string, ExportData> = new Map();

  async authenticate(): Promise<UserAccount> {
    // Mock authentication - using specific real data
    const mockUser: UserAccount = {
      id: "iker-dominguez-focus-pulse-user",
      email: "iker.dominguez@example.com",
      name: "Iker Domínguez",
      createdAt: new Date().toISOString(),
    };

    this.users.set(mockUser.id, mockUser);
    return mockUser;
  }

  async upload(data: ExportData): Promise<string> {
    const syncId = "sync-" + Math.random().toString(36).substr(2, 9);
    this.syncs.set(syncId, data);
    return syncId;
  }

  async download(syncId: string): Promise<ExportData> {
    const data = this.syncs.get(syncId);
    if (!data) {
      throw new Error(`Sync not found: ${syncId}`);
    }
    return data;
  }

  async listSyncs(): Promise<
    Array<{ id: string; timestamp: string; version: string }>
  > {
    return Array.from(this.syncs.entries()).map(([id, data]) => ({
      id,
      timestamp: data.exportDate,
      version: data.version,
    }));
  }

  async delete(syncId: string): Promise<void> {
    this.syncs.delete(syncId);
  }
}

// GitHub-based sync provider
export class GitHubSyncProvider implements CloudSyncProvider {
  private octokit: any;
  private user: UserAccount | null = null;
  private token: string | null = null;

  async authenticate(): Promise<UserAccount> {
    try {
      // Show step-by-step guide before asking for the token
      const proceed = await vscode.window.showInformationMessage(
        "Crear token de GitHub",
        {
          modal: true,
          detail:
            "1. Ve a github.com/settings/tokens\n" +
            "2. Crea un nuevo token (classic)\n" +
            '3. Da permiso de "gist" (lectura y escritura) y de "repo"\n' +
            "4. Cópialo y pégalo cuando te lo pida abajo",
        },
        "Entendido",
      );
      if (proceed !== "Entendido") {
        throw new Error("Authentication cancelled");
      }

      // Request GitHub token from user
      const token = await vscode.window.showInputBox({
        prompt: "Pega aquí tu Personal Access Token de GitHub",
        password: true,
        placeHolder: "ghp_xxxxxxxxxxxx...",
        validateInput: (value) => {
          if (!value || value.length < 10) {
            return "Please enter a valid GitHub Personal Access Token";
          }
          return undefined;
        },
      });

      if (!token) {
        throw new Error("Authentication cancelled");
      }

      this.token = token;

      // Initialize Octokit with token
      const { Octokit } = await import("@octokit/rest");
      this.octokit = new Octokit({ auth: token });

      // Get authenticated user info from GitHub
      const { data: githubUser } =
        await this.octokit.rest.users.getAuthenticated();

      this.user = {
        id: githubUser.id.toString(),
        email:
          githubUser.email || `${githubUser.login}@users.noreply.github.com`,
        name: githubUser.name || githubUser.login,
        createdAt: githubUser.created_at,
      };

      // Store token for future use
      await this.storeToken(token);

      return this.user;
    } catch (error) {
      throw new Error(`GitHub authentication failed: ${error}`);
    }
  }

  async upload(data: ExportData): Promise<string> {
    if (!this.octokit || !this.user) {
      throw new Error("Not authenticated with GitHub");
    }

    try {
      const gistName = `focus-pulse-sync-${Date.now()}`;
      const filename = `focus-pulse-data-${data.version}.json`;

      const { data: gist } = await this.octokit.rest.gists.create({
        description: `Focus Pulse Sync - ${new Date(data.exportDate).toLocaleString()}`,
        public: false,
        files: {
          [filename]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      });

      return gist.id;
    } catch (error) {
      throw new Error(`Failed to upload to GitHub Gist: ${error}`);
    }
  }

  async download(syncId: string): Promise<ExportData> {
    if (!this.octokit) {
      throw new Error("Not authenticated with GitHub");
    }

    try {
      const { data: gist } = await this.octokit.rest.gists.get({
        gist_id: syncId,
      });

      const files = Object.values(gist.files);
      if (files.length === 0) {
        throw new Error("No files found in gist");
      }

      const file = files[0] as any;
      if (!file.content) {
        throw new Error("Gist file has no content");
      }

      return JSON.parse(file.content);
    } catch (error) {
      throw new Error(`Failed to download from GitHub Gist: ${error}`);
    }
  }

  async listSyncs(): Promise<
    Array<{ id: string; timestamp: string; version: string }>
  > {
    if (!this.octokit) {
      throw new Error("Not authenticated with GitHub");
    }

    try {
      const { data: gists } = await this.octokit.rest.gists.list({
        per_page: 100,
      });

      return gists
        .filter((gist: any) => gist.description?.includes("Focus Pulse Sync"))
        .map((gist: any) => {
          const files = Object.values(gist.files);
          const filename = files.length > 0 ? Object.keys(gist.files)[0] : "";
          const versionMatch = filename.match(/focus-pulse-data-(.+)\.json/);
          const version = versionMatch ? versionMatch[1] : "unknown";

          return {
            id: gist.id,
            timestamp: gist.created_at,
            version,
          };
        });
    } catch (error) {
      throw new Error(`Failed to list GitHub Gists: ${error}`);
    }
  }

  async delete(syncId: string): Promise<void> {
    if (!this.octokit) {
      throw new Error("Not authenticated with GitHub");
    }

    try {
      await this.octokit.rest.gists.delete({
        gist_id: syncId,
      });
    } catch (error) {
      throw new Error(`Failed to delete GitHub Gist: ${error}`);
    }
  }

  public context: vscode.ExtensionContext | null = null;

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  public async storeToken(token: string): Promise<void> {
    if (this.context?.secrets) {
      await this.context.secrets.store("focusPulse.githubToken", token);
    }
  }

  public async loadStoredToken(): Promise<string | null> {
    if (this.context?.secrets) {
      const token = await this.context.secrets.get("focusPulse.githubToken");
      return token || null;
    }
    return null;
  }

  public async authenticateWithStoredToken(): Promise<UserAccount | null> {
    const storedToken = await this.loadStoredToken();
    if (!storedToken) {
      return null;
    }

    try {
      this.token = storedToken;
      const { Octokit } = await import("@octokit/rest");
      this.octokit = new Octokit({ auth: storedToken });

      const { data: githubUser } =
        await this.octokit.rest.users.getAuthenticated();

      this.user = {
        id: githubUser.id.toString(),
        email:
          githubUser.email || `${githubUser.login}@users.noreply.github.com`,
        name: githubUser.name || githubUser.login,
        createdAt: githubUser.created_at,
      };

      return this.user;
    } catch (error) {
      // Token is invalid, clear it
      await this.clearStoredToken();
      return null;
    }
  }

  public async clearStoredToken(): Promise<void> {
    if (this.context?.secrets) {
      await this.context.secrets.delete("focusPulse.githubToken");
    }
  }
}
