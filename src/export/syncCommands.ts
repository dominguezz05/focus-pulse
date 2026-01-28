import * as vscode from 'vscode';
import { UserSyncManager, MockCloudSyncProvider, SyncOptions } from './UserSyncManager';

export function registerSyncCommands(context: vscode.ExtensionContext): void {
  const syncManager = UserSyncManager.getInstance();
  syncManager.setContext(context);

  const authenticateCommand = vscode.commands.registerCommand(
    'focusPulse.authenticate',
    async () => {
      try {
        // Check if already authenticated
        const existingUser = syncManager.getCurrentUser();
        if (existingUser) {
          const action = await vscode.window.showQuickPick(
            ['Continue as current user', 'Sign out and re-authenticate', 'Cancel'],
            {
              placeHolder: `Already authenticated as ${existingUser.email}`,
            }
          );
          
          if (action === 'Sign out and re-authenticate') {
            await syncManager.signOut();
          } else if (action === 'Continue as current user' || action === 'Cancel') {
            vscode.window.showInformationMessage(`Continuing as ${existingUser.email}`);
            return existingUser;
          }
        }

        const provider = new MockCloudSyncProvider();
        const user = await syncManager.authenticate(provider);
        vscode.window.showInformationMessage(`✅ Successfully authenticated as ${user.email}`);
        return user;
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Authentication failed: ${error}`);
        throw error;
      }
    }
  );

  const enableAutoSyncCommand = vscode.commands.registerCommand(
    'focusPulse.enableAutoSync',
    async () => {
      try {
        const interval = await vscode.window.showInputBox({
          prompt: 'Sync interval (minutes)',
          value: '30',
          validateInput: (value) => {
            const num = parseInt(value);
            return isNaN(num) || num < 1 ? 'Please enter a valid number' : undefined;
          },
        });

        if (interval) {
          const options: SyncOptions = {
            autoSync: true,
            syncInterval: parseInt(interval),
            includeHistory: true,
            includeState: true,
            includeConfiguration: true,
          };

          await syncManager.enableAutoSync(options);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to enable auto-sync: ${error}`);
      }
    }
  );

  const disableAutoSyncCommand = vscode.commands.registerCommand(
    'focusPulse.disableAutoSync',
    async () => {
      try {
        await syncManager.disableAutoSync();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to disable auto-sync: ${error}`);
      }
    }
  );

  const manualSyncCommand = vscode.commands.registerCommand(
    'focusPulse.manualSync',
    async () => {
      try {
        // Auto-authenticate if not already authenticated
        if (!syncManager.getCurrentUser()) {
          const shouldAuthenticate = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            {
              placeHolder: 'Not authenticated. Do you want to authenticate for sync?',
            }
          );
          
          if (shouldAuthenticate === 'Yes') {
            const provider = new MockCloudSyncProvider();
            await syncManager.authenticate(provider);
          } else {
            vscode.window.showInformationMessage('Sync cancelled. Authentication required.');
            return;
          }
        }

        const options: SyncOptions = {
          includeHistory: true,
          includeState: true,
          includeConfiguration: true,
        };

        const syncId = await syncManager.performSync(options);
        vscode.window.showInformationMessage(`Sync completed (ID: ${syncId})`);
      } catch (error) {
        vscode.window.showErrorMessage(`Manual sync failed: ${error}`);
      }
    }
  );

  const downloadSyncCommand = vscode.commands.registerCommand(
    'focusPulse.downloadSync',
    async () => {
      try {
        const syncs = await syncManager.listAvailableSyncs();
        
        if (syncs.length === 0) {
          vscode.window.showInformationMessage('No syncs available');
          return;
        }

        const syncItems = syncs.map(sync => ({
          label: `${sync.timestamp} (${sync.version})`,
          description: `ID: ${sync.id}`,
          syncId: sync.id,
        }));

        const selected = await vscode.window.showQuickPick(syncItems, {
          placeHolder: 'Select sync to download',
        });

        if (selected) {
          const options: SyncOptions = {
            includeHistory: true,
            includeState: true,
            includeConfiguration: true,
          };

          await syncManager.downloadSync(selected.syncId, options);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Download sync failed: ${error}`);
      }
    }
  );

  const listSyncsCommand = vscode.commands.registerCommand(
    'focusPulse.listSyncs',
    async () => {
      try {
        const syncs = await syncManager.listAvailableSyncs();
        
        if (syncs.length === 0) {
          vscode.window.showInformationMessage('No syncs available');
          return;
        }

        const syncInfo = syncs.map(sync => 
          `• ${sync.timestamp} (${sync.version}) - ID: ${sync.id}`
        ).join('\n');

        const document = await vscode.workspace.openTextDocument({
          content: `Available Syncs:\n\n${syncInfo}`,
          language: 'plaintext'
        });
        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(`List syncs failed: ${error}`);
      }
    }
  );

  const deleteSyncCommand = vscode.commands.registerCommand(
    'focusPulse.deleteSync',
    async () => {
      try {
        const syncs = await syncManager.listAvailableSyncs();
        
        if (syncs.length === 0) {
          vscode.window.showInformationMessage('No syncs available');
          return;
        }

        const syncItems = syncs.map(sync => ({
          label: `${sync.timestamp} (${sync.version})`,
          description: `ID: ${sync.id}`,
          syncId: sync.id,
        }));

        const selected = await vscode.window.showQuickPick(syncItems, {
          placeHolder: 'Select sync to delete',
        });

        if (selected) {
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete sync ${selected.syncId}?`,
            'Delete',
            'Cancel'
          );

          if (confirm === 'Delete') {
            await syncManager.deleteSync(selected.syncId);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Delete sync failed: ${error}`);
      }
    }
  );

  const signOutCommand = vscode.commands.registerCommand(
    'focusPulse.signOut',
    async () => {
      try {
        await syncManager.signOut();
      } catch (error) {
        vscode.window.showErrorMessage(`Sign out failed: ${error}`);
      }
    }
  );

  const syncStatusCommand = vscode.commands.registerCommand(
    'focusPulse.syncStatus',
    async () => {
      try {
        const user = syncManager.getCurrentUser();
        const autoSyncEnabled = syncManager.isAutoSyncEnabled();
        const lastSync = syncManager.getLastSyncTime();

        let status = '=== FOCUS PULSE SYNC STATUS ===\n\n';
        
        if (user) {
          status += `👤 User: ${user.email}\n`;
          status += `🆔 User ID: ${user.id}\n`;
          status += `📅 Account created: ${new Date(user.createdAt).toLocaleString()}\n`;
          if (user.lastSyncAt) {
            status += `🔄 Last sync: ${new Date(user.lastSyncAt).toLocaleString()}\n`;
          }
          status += `✅ Authentication: Active\n`;
        } else {
          status += `👤 User: Not authenticated\n`;
          status += `❌ Authentication: Inactive\n`;
          status += `💡 Tip: Use "Sincronizar ahora" to auto-authenticate\n`;
        }

        status += `\n🔄 Auto-sync: ${autoSyncEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
        
        if (lastSync > 0) {
          const timeSince = Date.now() - lastSync;
          const hours = Math.floor(timeSince / (1000 * 60 * 60));
          const minutes = Math.floor((timeSince % (1000 * 60 * 60)) / (1000 * 60));
          
          status += `⏰ Last successful sync: ${new Date(lastSync).toLocaleString()}\n`;
          status += `⏱️  Time since last sync: ${hours}h ${minutes}m ago\n`;
        } else {
          status += `⏰ Last successful sync: Never\n`;
        }

        status += `\n📊 Available syncs: `;
        try {
          const syncs = await syncManager.listAvailableSyncs();
          status += `${syncs.length} sync(s) available\n`;
        } catch (err) {
          status += `Unable to check (authentication required)\n`;
        }

        const document = await vscode.workspace.openTextDocument({
          content: status,
          language: 'plaintext'
        });
        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(`Get sync status failed: ${error}`);
      }
    }
  );

  context.subscriptions.push(
    authenticateCommand,
    enableAutoSyncCommand,
    disableAutoSyncCommand,
    manualSyncCommand,
    downloadSyncCommand,
    listSyncsCommand,
    deleteSyncCommand,
    signOutCommand,
    syncStatusCommand
  );
}