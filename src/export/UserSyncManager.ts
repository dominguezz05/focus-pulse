import * as vscode from 'vscode';
import { DataExportManager, ExportData } from './DataExportManager';

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
  listSyncs(): Promise<Array<{ id: string; timestamp: string; version: string }>>;
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
        `Successfully authenticated as ${this.currentUser.email}`
      );
      
      return this.currentUser;
    } catch (error) {
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      throw error;
    }
  }

  async enableAutoSync(options: SyncOptions = {}): Promise<void> {
    if (!this.currentUser || !this.syncProvider) {
      throw new Error('User not authenticated. Please authenticate first.');
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
        console.error('Auto-sync failed:', error);
      }
    }, interval);

    vscode.window.showInformationMessage(
      `Auto-sync enabled (every ${options.syncInterval || 30} minutes)`
    );
  }

  async disableAutoSync(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    vscode.window.showInformationMessage('Auto-sync disabled');
  }

  async performSync(options: SyncOptions = {}): Promise<string> {
    if (!this.currentUser || !this.syncProvider) {
      throw new Error('User not authenticated');
    }

    try {
      const exportManager = DataExportManager.getInstance();
      
      // Export data based on options
      const fullData = JSON.parse(await exportManager.exportData('json'));
      
      // Prepare data for sync
      const data: ExportData = {
        version: '2.2.0',
        exportDate: new Date().toISOString(),
        userAccount: {
          id: this.currentUser.id,
          email: this.currentUser.email,
        },
        configuration: options.includeConfiguration !== false ? fullData.configuration : {
          enableStatusBar: false,
          minMinutesForScore: 1,
          scoreWeights: { timeWeight: 0, editsWeight: 0, switchPenalty: 0 },
          pomodoro: { enabled: false, workMinutes: 25, breakMinutes: 5 },
          goals: { enabled: false, targetMinutes: 60, targetPomodoros: 3 },
          deepWork: { enabled: false, durationMinutes: 60, switchPenalty: 40, xpBonus: 150 },
        },
        state: options.includeState !== false ? fullData.state : {
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
        `Data synced successfully (Sync ID: ${syncId})`
      );

      return syncId;
    } catch (error) {
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
      throw error;
    }
  }

  async downloadSync(syncId: string, options: SyncOptions = {}): Promise<void> {
    if (!this.syncProvider) {
      throw new Error('No sync provider available');
    }

    try {
      const data = await this.syncProvider.download(syncId);
      const exportManager = DataExportManager.getInstance();

      // Import data with merge options
      await exportManager.importData(
        JSON.stringify(data),
        'json',
        {
          mergeConfiguration: options.includeConfiguration !== false,
          mergeState: options.includeState !== false,
          mergeHistory: options.includeHistory !== false,
        }
      );

      vscode.window.showInformationMessage(
        `Data imported from sync (Sync ID: ${syncId})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Download sync failed: ${error}`);
      throw error;
    }
  }

  async listAvailableSyncs(): Promise<Array<{ id: string; timestamp: string; version: string }>> {
    if (!this.syncProvider) {
      throw new Error('No sync provider available');
    }

    return await this.syncProvider.listSyncs();
  }

  async deleteSync(syncId: string): Promise<void> {
    if (!this.syncProvider) {
      throw new Error('No sync provider available');
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
    vscode.window.showInformationMessage('Signed out successfully');
  }

  private context: vscode.ExtensionContext | null = null;

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  private async storeUser(user: UserAccount): Promise<void> {
    if (this.context) {
      await this.context.globalState.update('focusPulse.userAccount', user);
    }
  }

  private async loadStoredUser(): Promise<void> {
    if (this.context) {
      const stored = this.context.globalState.get<UserAccount>('focusPulse.userAccount');
      if (stored) {
        this.currentUser = stored;
      }
    }
  }

  private async clearStoredUser(): Promise<void> {
    if (this.context) {
      await this.context.globalState.update('focusPulse.userAccount', undefined);
    }
  }
}

// Example cloud provider implementations
export class MockCloudSyncProvider implements CloudSyncProvider {
  private users: Map<string, UserAccount> = new Map();
  private syncs: Map<string, ExportData> = new Map();

  async authenticate(): Promise<UserAccount> {
    // Mock authentication - in real implementation, this would use OAuth, etc.
    const mockUser: UserAccount = {
      id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
      email: 'user@example.com',
      name: 'Mock User',
      createdAt: new Date().toISOString(),
    };

    this.users.set(mockUser.id, mockUser);
    return mockUser;
  }

  async upload(data: ExportData): Promise<string> {
    const syncId = 'sync-' + Math.random().toString(36).substr(2, 9);
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

  async listSyncs(): Promise<Array<{ id: string; timestamp: string; version: string }>> {
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

// Future: Implement real cloud providers
export class GitHubSyncProvider implements CloudSyncProvider {
  // TODO: Implement GitHub Gist-based sync
  async authenticate(): Promise<UserAccount> {
    throw new Error('GitHub sync not yet implemented');
  }

  async upload(data: ExportData): Promise<string> {
    throw new Error('GitHub sync not yet implemented');
  }

  async download(syncId: string): Promise<ExportData> {
    throw new Error('GitHub sync not yet implemented');
  }

  async listSyncs(): Promise<Array<{ id: string; timestamp: string; version: string }>> {
    throw new Error('GitHub sync not yet implemented');
  }

  async delete(syncId: string): Promise<void> {
    throw new Error('GitHub sync not yet implemented');
  }
}