import { NotificationMessage, ToastNotification } from '../../notifications/NotificationTypes';
import { DashboardComponent, DashboardData } from '../types';

export class ToastRenderer {
  private container: HTMLElement | null = null;
  private activeToasts: Map<string, ToastElement> = new Map();
  private maxToasts: number = 5;
  private defaultDuration: number = 5000;

  constructor() {
    this.createContainer();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'fixed pointer-events-none z-50 space-y-2';
    this.updatePosition('top-right');
    document.body.appendChild(this.container);
  }

  public showToast(notification: NotificationMessage, duration?: number): void {
    if (!this.container) {
      this.createContainer();
    }

    // Remove oldest toast if we're at max capacity
    if (this.activeToasts.size >= this.maxToasts) {
      const oldestToastId = this.activeToasts.keys().next().value;
      if (oldestToastId) {
        this.removeToast(oldestToastId);
      }
    }

    const toastElement = this.createToastElement(notification, duration || this.defaultDuration);
    this.activeToasts.set(notification.id, toastElement);

    // Add to container
    this.container!.appendChild(toastElement.element);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toastElement.element.classList.add('toast-enter');
    });

    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
      this.removeToast(notification.id);
    }, duration || this.defaultDuration);

    toastElement.timeoutId = timeoutId;

    // Setup click handlers for actions
    this.setupActionHandlers(toastElement, notification);
  }

  private createToastElement(notification: NotificationMessage, duration: number): ToastElement {
    const toast = document.createElement('div');
    toast.className = this.getToastClasses(notification.type, notification.priority);
    toast.style.cssText = this.getToastStyles(notification.type);

    const icon = notification.icon || this.getDefaultIcon(notification.type);
    const actionsHtml = notification.actions?.map(action => 
      `<button class="toast-action" data-action="${action.id}">${action.label}</button>`
    ).join('') || '';

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${icon}</div>
        <div class="toast-body">
          <div class="toast-title">${this.escapeHtml(notification.title)}</div>
          <div class="toast-message">${this.escapeHtml(notification.message)}</div>
        </div>
        <button class="toast-close" aria-label="Close">×</button>
      </div>
      ${actionsHtml ? `<div class="toast-actions">${actionsHtml}</div>` : ''}
    `;

    return {
      element: toast,
      notification,
      timeoutId: null
    };
  }

  private getToastClasses(type: NotificationMessage['type'], priority: NotificationMessage['priority']): string {
    const baseClasses = [
      'toast',
      'pointer-events-auto',
      'relative',
      'overflow-hidden',
      'rounded-lg',
      'shadow-lg',
      'backdrop-blur-sm',
      'min-w-[300px]',
      'max-w-[400px]',
      'transform',
      'transition-all',
      'duration-300',
      'ease-in-out',
      'border'
    ];

    const typeClasses: Record<string, string[]> = {
      achievement: ['bg-emerald-500/90', 'border-emerald-400/50', 'text-white'],
      levelup: ['bg-indigo-500/90', 'border-indigo-400/50', 'text-white'],
      pomodoro: ['bg-red-500/90', 'border-red-400/50', 'text-white'],
      goal: ['bg-blue-500/90', 'border-blue-400/50', 'text-white'],
      deepwork: ['bg-purple-500/90', 'border-purple-400/50', 'text-white'],
      info: ['bg-slate-600/90', 'border-slate-500/50', 'text-white'],
      warning: ['bg-amber-500/90', 'border-amber-400/50', 'text-white'],
      success: ['bg-emerald-500/90', 'border-emerald-400/50', 'text-white']
    };

    const priorityClasses: Record<string, string[]> = {
      low: ['scale-95'],
      normal: ['scale-100'],
      high: ['scale-105', 'ring-2', 'ring-white/20']
    };

    return [
      ...baseClasses,
      ...(typeClasses[type] || typeClasses.info),
      ...(priorityClasses[priority] || priorityClasses.normal)
    ].join(' ');
  }

  private getToastStyles(type: NotificationMessage['type']): string {
    return `
      opacity: 0;
      transform: translateX(100%) translateY(-50%);
      animation: toastSlideIn 0.3s ease-out forwards;
    `;
  }

  private setupActionHandlers(toastElement: ToastElement, notification: NotificationMessage): void {
    // Close button
    const closeBtn = toastElement.element.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeToast(notification.id);
      });
    }

    // Action buttons
    const actionBtns = toastElement.element.querySelectorAll('.toast-action');
    actionBtns.forEach(btn => {
      const actionId = (btn as HTMLElement).dataset.action;
      if (actionId && notification.actions) {
        const action = notification.actions.find((a: any) => a.id === actionId);
        if (action) {
          btn.addEventListener('click', () => {
            action.action();
            this.removeToast(notification.id);
          });
        }
      }
    });

    // Pause auto-remove on hover
    toastElement.element.addEventListener('mouseenter', () => {
      if (toastElement.timeoutId) {
        clearTimeout(toastElement.timeoutId);
      }
    });

    // Resume auto-remove on leave
    toastElement.element.addEventListener('mouseleave', () => {
      toastElement.timeoutId = setTimeout(() => {
        this.removeToast(notification.id);
      }, 2000); // Give 2 seconds before removing
    });
  }

  public removeToast(id: string): void {
    const toastElement = this.activeToasts.get(id);
    if (!toastElement) return;

    // Clear timeout if it exists
    if (toastElement.timeoutId) {
      clearTimeout(toastElement.timeoutId);
    }

    // Add exit animation
    toastElement.element.style.animation = 'toastSlideOut 0.3s ease-in forwards';

    // Remove after animation
    setTimeout(() => {
      if (toastElement.element.parentNode) {
        toastElement.element.parentNode.removeChild(toastElement.element);
      }
      this.activeToasts.delete(id);
    }, 300);
  }

  public updatePosition(position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'): void {
    if (!this.container) return;

    // Remove all position classes
    this.container.className = this.container.className.replace(/top-\d+|bottom-\d+|left-\d+|right-\d+/g, '');

    const positionClasses: Record<string, string[]> = {
      'top-right': ['top-4', 'right-4'],
      'bottom-right': ['bottom-4', 'right-4'],
      'top-left': ['top-4', 'left-4'],
      'bottom-left': ['bottom-4', 'left-4']
    };

    const classes = positionClasses[position];
    this.container.className = `fixed pointer-events-none z-50 space-y-2 ${classes?.join(' ') || ''}`;
  }

  public clearAllToasts(): void {
    const toastIds = Array.from(this.activeToasts.keys());
    toastIds.forEach(id => this.removeToast(id));
  }

  private getDefaultIcon(type: NotificationMessage['type']): string {
    const icons: Record<string, string> = {
      achievement: '🏆',
      levelup: '⬆️',
      pomodoro: '🍅',
      goal: '🎯',
      deepwork: '🧠',
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅'
    };
    return icons[type] || 'ℹ️';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public destroy(): void {
    this.clearAllToasts();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }
}

interface ToastElement {
  element: HTMLElement;
  notification: NotificationMessage;
  timeoutId: any | null;
}

export class NotificationsComponent implements DashboardComponent {
  private toastRenderer: ToastRenderer | null = null;

  constructor() {
    // Initialize toast renderer
    this.toastRenderer = new ToastRenderer();
    injectToastStyles();
    
    // Listen for notification events
    this.setupNotificationListener();
  }

  private setupNotificationListener(): void {
    // Listen for notification events from the extension
    window.addEventListener('message', (event) => {
      if (event.data.type === 'notification:toast') {
        if (this.toastRenderer) {
          this.toastRenderer.showToast(event.data.data.notification, event.data.data.config.duration);
        }
      }
    });
  }

  render(container: HTMLElement, data: DashboardData): void {
    // Notifications don't need a specific container as they overlay the dashboard
    // The toast container is created by ToastRenderer and added to document.body
    container.innerHTML = '';
  }

  update(data: DashboardData): void {
    // No updates needed for notifications component
  }

  destroy(): void {
    if (this.toastRenderer) {
      this.toastRenderer.destroy();
      this.toastRenderer = null;
    }
  }

  // Expose toast renderer for external access
  public showToast(notification: any, duration?: number): void {
    if (this.toastRenderer) {
      this.toastRenderer.showToast(notification, duration);
    }
  }
}

// Add CSS animations to the document
export function injectToastStyles(): void {
  const styleId = 'toast-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes toastSlideIn {
      0% {
        opacity: 0;
        transform: translateX(100%) translateY(-50%);
      }
      100% {
        opacity: 1;
        transform: translateX(0) translateY(0);
      }
    }

    @keyframes toastSlideOut {
      0% {
        opacity: 1;
        transform: translateX(0) translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateX(100%) translateY(-50%);
      }
    }

    .toast {
      backdrop-filter: blur(12px);
    }

    .toast-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
    }

    .toast-icon {
      font-size: 20px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-weight: 600;
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .toast-message {
      font-size: 13px;
      line-height: 1.4;
      opacity: 0.9;
    }

    .toast-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      line-height: 1;
      padding: 0;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .toast-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .toast-actions {
      display: flex;
      gap: 8px;
      padding: 0 16px 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 8px;
    }

    .toast-action {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      transition: all 0.2s;
    }

    .toast-action:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }

    /* Position adjustments for bottom placement */
    #notification-container.bottom-right,
    #notification-container.bottom-left {
      flex-direction: column-reverse;
    }
  `;
  document.head.appendChild(style);
}