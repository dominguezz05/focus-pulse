export interface NotificationConfig {
  enabled: boolean;
  types: {
    achievements: boolean;
    levelUp: boolean;
    pomodoro: boolean;
    goals: boolean;
    deepWork: boolean;
  };
  style: 'native' | 'toast' | 'both';
  position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  duration: number; // milliseconds
  sound: boolean;
}

export interface NotificationMessage {
  id: string;
  type: 'achievement' | 'levelup' | 'pomodoro' | 'goal' | 'deepwork' | 'info' | 'warning' | 'success';
  title: string;
  message: string;
  icon?: string;
  actions?: NotificationAction[];
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  style?: 'default' | 'primary' | 'secondary';
}

export interface ToastNotification {
  id: string;
  type: NotificationMessage['type'];
  title: string;
  message: string;
  icon: string;
  duration: number;
  timestamp: number;
  actions?: NotificationAction[];
}

export interface NotificationQueue {
  pending: NotificationMessage[];
  active: Map<string, NotificationMessage>;
  history: NotificationMessage[];
}

export type NotificationEventType = 
  | 'achievement:unlocked'
  | 'xp:level_up'
  | 'pomodoro:completed'
  | 'goal:completed'
  | 'deepwork:started'
  | 'deepwork:completed'
  | 'session:fatigue'
  | 'assistant:message';

export interface NotificationEvent {
  type: NotificationEventType;
  data: any;
  timestamp: number;
}

// Predefined icons for different notification types
export const NOTIFICATION_ICONS = {
  achievement: '🏆',
  levelup: '⬆️',
  pomodoro: '🍅',
  goal: '🎯',
  deepwork: '🧠',
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅'
};

// Default notification messages for different event types
export const DEFAULT_NOTIFICATION_MESSAGES = {
  'achievement:unlocked': (title: string) => ({
    title: '¡Logro Desbloqueado!',
    message: `Has completado: ${title}`,
    icon: NOTIFICATION_ICONS.achievement,
    type: 'achievement' as const
  }),
  'xp:level_up': (level: number) => ({
    title: '¡LEVEL UP!',
    message: `Has alcanzado el nivel ${level}`,
    icon: NOTIFICATION_ICONS.levelup,
    type: 'levelup' as const
  }),
  'pomodoro:completed': () => ({
    title: '¡Pomodoro Completado!',
    message: '¡Buen trabajo! Tómate un descanso bien merecido.',
    icon: NOTIFICATION_ICONS.pomodoro,
    type: 'success' as const
  }),
  'goal:completed': (goalType: string) => ({
    title: '¡Objetivo Completado!',
    message: `Has alcanzado tu objetivo diario de ${goalType}`,
    icon: NOTIFICATION_ICONS.goal,
    type: 'success' as const
  }),
  'deepwork:started': () => ({
    title: 'Modo Deep Work',
    message: 'Sesión de enfoque profundo iniciada. Evita cambiar de archivo.',
    icon: NOTIFICATION_ICONS.deepwork,
    type: 'info' as const
  }),
  'deepwork:completed': () => ({
    title: '¡Deep Work Completado!',
    message: '¡Excelente sesión de enfoque profundo! +150 XP',
    icon: NOTIFICATION_ICONS.deepwork,
    type: 'success' as const
  }),
  'session:fatigue': () => ({
    title: 'Detección de Fatiga',
    message: 'Llevas mucho tiempo trabajando. Considera tomar un descanso.',
    icon: NOTIFICATION_ICONS.warning,
    type: 'warning' as const
  })
};