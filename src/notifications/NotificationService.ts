import * as vscode from 'vscode';
import { EventBus } from '../events/EventBus';
import { FOCUS_EVENTS } from '../events/EventTypes';
import {
  NotificationConfig,
  NotificationMessage,
  NotificationQueue,
  NotificationAction,
  DEFAULT_NOTIFICATION_MESSAGES,
  NOTIFICATION_ICONS
} from './NotificationTypes';

export class NotificationService {
  private config: NotificationConfig;
  private eventBus: EventBus;
  private queue: NotificationQueue;
  private disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel;

  constructor(eventBus: EventBus, initialConfig?: Partial<NotificationConfig>) {
    this.eventBus = eventBus;
    this.config = this.getDefaultConfig(initialConfig);
    this.queue = {
      pending: [],
      active: new Map(),
      history: []
    };
    this.outputChannel = vscode.window.createOutputChannel('Focus Pulse Notifications');
    
    this.setupEventListeners();
    this.watchConfigChanges();
  }

  private getDefaultConfig(override?: Partial<NotificationConfig>): NotificationConfig {
    const vscodeConfig = vscode.workspace.getConfiguration('focusPulse');
    const config: NotificationConfig = {
      enabled: true,
      types: {
        achievements: true,
        levelUp: true,
        pomodoro: true,
        goals: true,
        deepWork: true
      },
      style: 'toast',
      position: 'top-right',
      duration: 5000,
      sound: false,
      ...override
    };

    // Override with VS Code settings if available
    if (vscodeConfig.get('notifications.enabled') !== undefined) {
      config.enabled = vscodeConfig.get('notifications.enabled') as boolean;
    }
    if (vscodeConfig.get('notifications.style') !== undefined) {
      config.style = vscodeConfig.get('notifications.style') as 'native' | 'toast' | 'both';
    }
    if (vscodeConfig.get('notifications.position') !== undefined) {
      config.position = vscodeConfig.get('notifications.position') as 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
    }
    if (vscodeConfig.get('notifications.duration') !== undefined) {
      config.duration = vscodeConfig.get('notifications.duration') as number;
    }

    return config;
  }

  private setupEventListeners(): void {
    // Achievement notifications
    const unsubscribeAchievement = this.eventBus.on(FOCUS_EVENTS.ACHIEVEMENT_UNLOCKED, (data) => {
      if (this.config.enabled && this.config.types.achievements) {
        this.handleAchievementUnlocked(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribeAchievement));

    // Level up notifications
    const unsubscribeLevelUp = this.eventBus.on(FOCUS_EVENTS.LEVEL_UP, (data) => {
      if (this.config.enabled && this.config.types.levelUp) {
        this.handleLevelUp(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribeLevelUp));

    // Pomodoro notifications
    const unsubscribePomodoro = this.eventBus.on(FOCUS_EVENTS.POMODORO_COMPLETED, (data) => {
      if (this.config.enabled && this.config.types.pomodoro) {
        this.handlePomodoroCompleted(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribePomodoro));

    // Goal notifications
    const unsubscribeGoal = this.eventBus.on(FOCUS_EVENTS.GOAL_COMPLETED, (data) => {
      if (this.config.enabled && this.config.types.goals) {
        this.handleGoalCompleted(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribeGoal));

    // Deep Work notifications
    const unsubscribeDeepWorkStart = this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_STARTED, (data) => {
      if (this.config.enabled && this.config.types.deepWork) {
        this.handleDeepWorkStarted(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribeDeepWorkStart));

    const unsubscribeDeepWorkEnd = this.eventBus.on(FOCUS_EVENTS.DEEP_WORK_ENDED, (data) => {
      if (this.config.enabled && this.config.types.deepWork) {
        this.handleDeepWorkEnded(data);
      }
    });
    this.disposables.push(new vscode.Disposable(unsubscribeDeepWorkEnd));
  }

  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('focusPulse.notifications')) {
          this.config = this.getDefaultConfig();
          this.outputChannel.appendLine(`[Config] Notification configuration updated: ${JSON.stringify(this.config)}`);
        }
      })
    );
  }

  private handleAchievementUnlocked(data: any): void {
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['achievement:unlocked'](data.achievement.title);
    this.showNotification({
      id: `achievement-${Date.now()}`,
      type: 'achievement',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'high',
      timestamp: Date.now(),
      actions: [
        {
          id: 'view-achievements',
          label: 'Ver Logros',
          action: () => vscode.commands.executeCommand('focusPulse.openDashboard'),
          style: 'primary'
        }
      ]
    });
  }

  private handleLevelUp(data: any): void {
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['xp:level_up'](data.newLevel);
    this.showNotification({
      id: `levelup-${Date.now()}`,
      type: 'levelup',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'high',
      timestamp: Date.now(),
      actions: [
        {
          id: 'view-dashboard',
          label: 'Ver Dashboard',
          action: () => vscode.commands.executeCommand('focusPulse.openDashboard'),
          style: 'primary'
        }
      ]
    });
  }

  private handlePomodoroCompleted(data: any): void {
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['pomodoro:completed']();
    this.showNotification({
      id: `pomodoro-${Date.now()}`,
      type: 'success',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'normal',
      timestamp: Date.now(),
      actions: [
        {
          id: 'start-break',
          label: 'Iniciar Descanso',
          action: () => vscode.commands.executeCommand('focusPulse.pomodoroToggle'),
          style: 'secondary'
        }
      ]
    });
  }

  private handleGoalCompleted(data: any): void {
    const goalType = data.type === 'minutes' ? 'minutos de foco' : 'pomodoros';
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['goal:completed'](goalType);
    this.showNotification({
      id: `goal-${Date.now()}`,
      type: 'success',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'high',
      timestamp: Date.now()
    });
  }

  private handleDeepWorkStarted(data: any): void {
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['deepwork:started']();
    this.showNotification({
      id: `deepwork-start-${Date.now()}`,
      type: 'info',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'normal',
      timestamp: Date.now()
    });
  }

  private handleDeepWorkEnded(data: any): void {
    const defaultMessage = DEFAULT_NOTIFICATION_MESSAGES['deepwork:completed']();
    this.showNotification({
      id: `deepwork-end-${Date.now()}`,
      type: 'success',
      title: defaultMessage.title,
      message: defaultMessage.message,
      icon: defaultMessage.icon,
      priority: 'high',
      timestamp: Date.now()
    });
  }

  public showNotification(notification: NotificationMessage): void {
    if (!this.config.enabled) return;

    // Add to queue
    this.queue.pending.push(notification);
    
    // Log to output channel
    this.outputChannel.appendLine(`[Notification] ${notification.type}: ${notification.title} - ${notification.message}`);

    // Show based on style configuration
    if (this.config.style === 'native' || this.config.style === 'both') {
      this.showNativeNotification(notification);
    }
    
    if (this.config.style === 'toast' || this.config.style === 'both') {
      this.showToastNotification(notification);
    }

    // Add to history and move from pending to active
    this.queue.active.set(notification.id, notification);
    this.queue.history.push(notification);
    
    // Remove from pending
    const index = this.queue.pending.indexOf(notification);
    if (index > -1) {
      this.queue.pending.splice(index, 1);
    }

    // Clean history (keep last 100)
    if (this.queue.history.length > 100) {
      this.queue.history = this.queue.history.slice(-100);
    }
  }

  private showNativeNotification(notification: NotificationMessage): void {
    const actions = notification.actions?.map(action => action.label);
    
    vscode.window.showInformationMessage(
      `${notification.icon} ${notification.title}`,
      ...(actions || [])
    ).then(selection => {
      if (selection && notification.actions) {
        const action = notification.actions.find(a => a.label === selection);
        if (action) {
          action.action();
        }
      }
    });
  }

  private showToastNotification(notification: NotificationMessage): void {
    // This will be handled by the ToastRenderer in the webview
    // Emit an event that the dashboard can listen to
    this.eventBus.emit('notification:toast', {
      notification,
      config: {
        position: this.config.position,
        duration: this.config.duration
      }
    });
  }

  public showCustomNotification(
    title: string, 
    message: string, 
    type: NotificationMessage['type'] = 'info',
    actions?: NotificationAction[]
  ): void {
    this.showNotification({
      id: `custom-${Date.now()}`,
      type,
      title,
      message,
      icon: NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.info,
      priority: 'normal',
      timestamp: Date.now(),
      actions
    });
  }

  public getConfig(): NotificationConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update VS Code settings
    const vscodeConfig = vscode.workspace.getConfiguration('focusPulse');
    vscodeConfig.update('notifications', updates, vscode.ConfigurationTarget.Global);
  }

  public getQueue(): NotificationQueue {
    return {
      pending: [...this.queue.pending],
      active: new Map(this.queue.active),
      history: [...this.queue.history]
    };
  }

  public clearHistory(): void {
    this.queue.history = [];
    this.outputChannel.appendLine('[Notification] History cleared');
  }

  public testNotification(type: 'native' | 'toast' | 'both' = this.config.style): void {
    this.showNotification({
      id: `test-${Date.now()}`,
      type: 'info',
      title: 'Notificación de Prueba',
      message: 'Esta es una notificación de prueba para verificar que todo funciona correctamente.',
      icon: NOTIFICATION_ICONS.info,
      priority: 'normal',
      timestamp: Date.now(),
      actions: [
        {
          id: 'test-action',
          label: '¡Funciona!',
          action: () => vscode.window.showInformationMessage('¡La notificación funciona perfectamente!'),
          style: 'primary'
        }
      ]
    });
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.outputChannel.dispose();
  }
}