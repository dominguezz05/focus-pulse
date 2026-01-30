import * as vscode from 'vscode';
import { UserSyncManager, MockCloudSyncProvider, GitHubSyncProvider, SyncOptions } from './UserSyncManager';

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

        // Try to authenticate with stored token first
        const provider = new GitHubSyncProvider();
        provider.setContext(context);
        
        const storedUser = await provider.authenticateWithStoredToken();
        if (storedUser) {
          await syncManager.setProvider(provider);
          await syncManager.setCurrentUser(storedUser);
          vscode.window.showInformationMessage(`✅ Autenticado como ${storedUser.email}`);
          return storedUser;
        }

        const user = await syncManager.authenticate(provider);
        vscode.window.showInformationMessage(`✅ Autenticado como ${user.email} - ¡Tu progreso ahora se sincronizará en la nube!`);
        
        // Trigger dashboard refresh to update auth status
        const eventBus = require('./events').getEventBus();
        if (eventBus) {
          const FOCUS_EVENTS = require('./events/EventTypes').FOCUS_EVENTS;
          eventBus.emit(FOCUS_EVENTS.DASHBOARD_REFRESH);
        }
        
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
        // Check if user is already authenticated
        if (syncManager.getCurrentUser()) {
          // User is authenticated, proceed with normal sync
          const options: SyncOptions = {
            includeHistory: true,
            includeState: true,
            includeConfiguration: true,
          };

          const syncId = await syncManager.performSync(options);
          vscode.window.showInformationMessage(`✅ Sincronización completada (ID: ${syncId})`);
          return;
        }

        // User is not authenticated, show options
        const action = await vscode.window.showQuickPick(
          [
            {
              label: "Sí, autenticar y sincronizar",
              description: "Te mostraremos cómo crear tu token de GitHub",
              value: "auth-and-sync"
            },
            {
              label: "No, solo autenticar",
              description: "Sin sincronización automática después",
              value: "auth-only"
            },
            {
              label: "Cancelar",
              value: "cancel"
            }
          ],
          {
            placeHolder: "Para sincronizar necesitas autenticarte con GitHub"
          }
        );

        if (!action || action.value === "cancel") {
          return;
        }

        // Show detailed help for both authentication options
        const helpMessage = `📋 PASOS PARA CREAR TU TOKEN DE GITHUB:

1️⃣ Ve a github.com/settings/tokens
2️⃣ Haz clic en "Generate new token" → "Generate new token (classic)"
3️⃣ Dale un nombre (ej: "Focus Pulse Sync")
4️⃣ Selecciona "No expiration" o elige una duración
5️⃣ Marca SOLO el permiso "gist"
6️⃣ Haz clic en "Generate token"
7️⃣ Copia el token (no podrás volver a verlo)

Luego pégalo cuando te lo pidamos.`;

        const openAction = await vscode.window.showInformationMessage(
          helpMessage,
          "Abrir GitHub Tokens",
          "Entendido, continuar"
        );

        if (openAction === "Abrir GitHub Tokens") {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
        }

        // Proceed with authentication
        const provider = new GitHubSyncProvider();
        const user = await syncManager.authenticate(provider);

        if (action.value === "auth-and-sync") {
          // Now sync after authentication
          const options: SyncOptions = {
            includeHistory: true,
            includeState: true,
            includeConfiguration: true,
          };

          const syncId = await syncManager.performSync(options);
          vscode.window.showInformationMessage(`✅ Autenticado como ${user.email} y sincronización completada (ID: ${syncId})`);
        } else if (action.value === "auth-only") {
          vscode.window.showInformationMessage(`✅ Autenticado como ${user.email}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Error: ${error}`);
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

  const createTokenCommand = vscode.commands.registerCommand(
    'focusPulse.createGitHubToken',
    async () => {
      const action = await vscode.window.showInformationMessage(
        'Para crear un Personal Access Token de GitHub:',
        'Abrir GitHub Tokens',
        'Ver instrucciones'
      );

      if (action === 'Abrir GitHub Tokens') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
      } else if (action === 'Ver instrucciones') {
        const instructions = `
## Cómo crear tu Personal Access Token de GitHub

1. Ve a github.com/settings/tokens
2. Haz clic en "Generate new token" → "Generate new token (classic)"
3. Dale un nombre (ej: "Focus Pulse Sync")
4. Selecciona "No expiration" o elige una duración
5. Marca solo el permiso **gist**
6. Haz clic en "Generate token"
7. Copia el token (no podrás volver a verlo)

Luego usa "Focus Pulse: Autenticar cuenta" y pega tu token.
        `;

        const document = await vscode.workspace.openTextDocument({
          content: instructions,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
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
          status += `👤 Usuario: ${user.email}\n`;
          status += `🆔 ID Usuario: ${user.id}\n`;
          status += `📅 Cuenta creada: ${new Date(user.createdAt).toLocaleString()}\n`;
          if (user.lastSyncAt) {
            status += `🔄 Última sincronización: ${new Date(user.lastSyncAt).toLocaleString()}\n`;
          }
          status += `✅ Autenticación: Activa\n`;
          status += `☁️  Almacenamiento: Gists privados de GitHub\n`;
        } else {
          status += `👤 Usuario: No autenticado\n`;
          status += `❌ Autenticación: Inactiva\n`;
          status += `💡 Consejo: Usa "Focus Pulse: Autenticar cuenta" para guardar tu progreso en la nube\n`;
          status += `📝 Necesitarás un Personal Access Token de GitHub con permiso 'gist'\n`;
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
    createTokenCommand,
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