import * as vscode from 'vscode';
import { NotificationService } from '../notifications/NotificationService';
import { getEventBus } from '../events';

let notificationService: NotificationService | null = null;

export function registerNotificationCommands(context: vscode.ExtensionContext, existingService?: NotificationService) {
  // Reuse externally provided instance; only create one as fallback
  if (existingService) {
    notificationService = existingService;
  } else if (!notificationService) {
    notificationService = new NotificationService(getEventBus());
  }

  // Test notification command
  context.subscriptions.push(
    vscode.commands.registerCommand('focusPulse.testNotification', async () => {
      if (!notificationService) {
        vscode.window.showErrorMessage('Notification service not available');
        return;
      }

      const styleOptions = ['toast', 'native', 'both'];
      const selectedStyle = await vscode.window.showQuickPick(styleOptions, {
        placeHolder: 'Select notification style to test',
        title: 'Test Notification'
      });

      if (selectedStyle) {
        notificationService.testNotification(selectedStyle as 'toast' | 'native' | 'both');
        vscode.window.showInformationMessage(`Test notification sent with ${selectedStyle} style`);
      }
    })
  );

  // Toggle notifications command
  context.subscriptions.push(
    vscode.commands.registerCommand('focusPulse.toggleNotifications', async () => {
      if (!notificationService) {
        vscode.window.showErrorMessage('Notification service not available');
        return;
      }

      const config = notificationService.getConfig();
      const newEnabled = !config.enabled;
      
      notificationService.updateConfig({ enabled: newEnabled });
      
      const message = newEnabled 
        ? '✅ Notifications enabled' 
        : '❌ Notifications disabled';
      
      vscode.window.showInformationMessage(message);
    })
  );

  // Notification settings command
  context.subscriptions.push(
    vscode.commands.registerCommand('focusPulse.notificationSettings', async () => {
      if (!notificationService) {
        vscode.window.showErrorMessage('Notification service not available');
        return;
      }

      const config = notificationService.getConfig();
      
      const actions = [
        'Toggle Enabled/Disabled',
        'Change Style',
        'Change Position',
        'Change Duration',
        'Configure Types',
        'Test Notification',
        'View Current Config'
      ];

      const selectedAction = await vscode.window.showQuickPick(actions, {
        placeHolder: 'Select notification setting to configure',
        title: 'Notification Settings'
      });

      if (!selectedAction) return;

      switch (selectedAction) {
        case 'Toggle Enabled/Disabled':
          const newEnabled = !config.enabled;
          notificationService.updateConfig({ enabled: newEnabled });
          vscode.window.showInformationMessage(`Notifications ${newEnabled ? 'enabled' : 'disabled'}`);
          break;

        case 'Change Style':
          const styleOptions = ['native', 'toast', 'both'];
          const newStyle = await vscode.window.showQuickPick(styleOptions, {
            placeHolder: 'Select notification style'
          });
          if (newStyle) {
            notificationService.updateConfig({ style: newStyle as 'native' | 'toast' | 'both' });
            vscode.window.showInformationMessage(`Notification style changed to ${newStyle}`);
          }
          break;

        case 'Change Position':
          const positionOptions = ['top-right', 'bottom-right', 'top-left', 'bottom-left'];
          const newPosition = await vscode.window.showQuickPick(positionOptions, {
            placeHolder: 'Select notification position'
          });
          if (newPosition) {
            notificationService.updateConfig({ position: newPosition as 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' });
            vscode.window.showInformationMessage(`Notification position changed to ${newPosition}`);
          }
          break;

        case 'Change Duration':
          const durationInput = await vscode.window.showInputBox({
            prompt: 'Enter notification duration (1000-30000 ms)',
            value: config.duration.toString(),
            validateInput: (value) => {
              const num = parseInt(value);
              if (isNaN(num) || num < 1000 || num > 30000) {
                return 'Please enter a number between 1000 and 30000';
              }
              return null;
            }
          });
          if (durationInput) {
            const newDuration = parseInt(durationInput);
            notificationService.updateConfig({ duration: newDuration });
            vscode.window.showInformationMessage(`Notification duration changed to ${newDuration}ms`);
          }
          break;

        case 'Configure Types':
          await configureNotificationTypes(notificationService);
          break;

        case 'Test Notification':
          notificationService.testNotification();
          vscode.window.showInformationMessage('Test notification sent!');
          break;

        case 'View Current Config':
          showCurrentConfig(config);
          break;
      }
    })
  );

  // Export notification service for use in other modules
  context.subscriptions.push({
    dispose: () => {
      if (notificationService) {
        notificationService.dispose();
        notificationService = null;
      }
    }
  });
}

async function configureNotificationTypes(service: NotificationService): Promise<void> {
  const config = service.getConfig();
  const types = [
    { key: 'achievements', label: 'Achievement Notifications', enabled: config.types.achievements },
    { key: 'levelUp', label: 'Level Up Notifications', enabled: config.types.levelUp },
    { key: 'pomodoro', label: 'Pomodoro Notifications', enabled: config.types.pomodoro },
    { key: 'goals', label: 'Goal Notifications', enabled: config.types.goals },
    { key: 'deepWork', label: 'Deep Work Notifications', enabled: config.types.deepWork }
  ];

  const selectedType = await vscode.window.showQuickPick(
    types.map(t => `${t.enabled ? '✅' : '❌'} ${t.label}`),
    {
      placeHolder: 'Select notification type to toggle',
      title: 'Configure Notification Types'
    }
  );

  if (!selectedType) return;

  const typeIndex = types.findIndex(t => selectedType.includes(t.label));
  if (typeIndex === -1) return;

  const type = types[typeIndex];
  const newEnabled = !type.enabled;
  
  const currentTypes = { ...config.types };
  currentTypes[type.key as keyof typeof currentTypes] = newEnabled;
  
  service.updateConfig({ types: currentTypes });
  
  vscode.window.showInformationMessage(
    `${type.label} ${newEnabled ? 'enabled' : 'disabled'}`
  );
}

function showCurrentConfig(config: any): void {
  const configText = `📱 Focus Pulse Notification Configuration

Enabled: ${config.enabled ? '✅ Yes' : '❌ No'}
Style: ${config.style}
Position: ${config.position}
Duration: ${config.duration}ms
Sound: ${config.sound ? '🔊 Yes' : '🔇 No'}

Notification Types:
  🏆 Achievements: ${config.types.achievements ? '✅' : '❌'}
  ⬆️ Level Up: ${config.types.levelUp ? '✅' : '❌'}
  🍅 Pomodoro: ${config.types.pomodoro ? '✅' : '❌'}
  🎯 Goals: ${config.types.goals ? '✅' : '❌'}
  🧠 Deep Work: ${config.types.deepWork ? '✅' : '❌'}`.trim();

  vscode.window.showInformationMessage('Current notification configuration:', 'View Details')
    .then(selection => {
      if (selection === 'View Details') {
        const doc = vscode.workspace.openTextDocument({ content: configText });
        doc.then(document => vscode.window.showTextDocument(document));
      }
    });
}

export function getNotificationService(): NotificationService | null {
  return notificationService;
}