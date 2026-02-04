import * as vscode from 'vscode';
import { AppState, StateManager, StateSubscriber } from './StateTypes';
import { getEventBus } from '../events';
import { FOCUS_EVENTS } from '../events/EventTypes';
import { debounceStorageWrite } from '../utils/Debouncer';

const STORAGE_KEY = 'focusPulseAppState';

export class FocusStateManager implements StateManager {
  private state: AppState;
  private subscribers: Set<StateSubscriber<AppState>> = new Set();
  private keySubscribers: Map<keyof AppState, Set<StateSubscriber<any>>> = new Map();

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): AppState {
    return {
      focus: {
        currentFile: null,
        previousFile: null,
        sessionStats: [],
        totalFocusTime: 0,
        averageScore: 0,
        lastUpdateTime: 0,
      },
      pomodoro: {
        isRunning: false,
        isPaused: false,
        remainingTime: 0,
        totalTime: 0,
        cycleCount: 0,
        todayCount: 0,
        totalCount: 0,
        lastUpdateTime: 0,
      },
      achievements: {
        unlocked: [],
        inProgress: {},
        lastUnlocked: null,
        lastCheckTime: 0,
      },
      xp: {
        totalXp: 0,
        level: 1,
        xpInLevel: 0,
        xpToNext: 100,
        lastXpGain: 0,
        lastXpSource: '',
      },
      deepWork: {
        active: false,
        startTime: null,
        duration: 0,
        expectedDuration: null,
        score: 0,
      },
      goals: {
        enabled: false,
        targetMinutes: 120,
        targetPomodoros: 4,
        minutesDone: 0,
        pomodorosDone: 0,
        doneMinutes: false,
        donePomodoros: false,
        allDone: false,
        lastUpdateTime: 0,
      },
      ui: {
        dashboardOpen: false,
        lastRefreshTime: 0,
        updateQueue: [],
        isLoading: false,
      },
      session: {
        startTime: Date.now(),
        endTime: null,
        filesWorked: new Set(),
        totalEdits: 0,
        totalSwitches: 0,
        isActive: true,
      },
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(partialState: Partial<AppState>): void {
    const previousState = { ...this.state };
    
    // Merge new state
    this.state = { ...this.state, ...partialState };
    
    // Notify general subscribers
    this.notifySubscribers(this.state, previousState);
    
    // Notify key-specific subscribers
    this.notifyKeySubscribers(partialState, previousState);
    
    // Emit events for state changes
    this.emitStateChangeEvents(partialState, previousState);
    
    // Persist state changes
    this.persistDebounced();
  }

  subscribe(subscriber: StateSubscriber<AppState>): () => void {
    this.subscribers.add(subscriber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  subscribeToKey<T extends keyof AppState>(
    key: T,
    subscriber: StateSubscriber<AppState[T]>
  ): () => void {
    if (!this.keySubscribers.has(key)) {
      this.keySubscribers.set(key, new Set());
    }
    
    const subscribers = this.keySubscribers.get(key)!;
    subscribers.add(subscriber);
    
    // Return unsubscribe function
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.keySubscribers.delete(key);
      }
    };
  }

  async reset(): Promise<void> {
    this.state = this.getInitialState();
    this.notifySubscribers(this.state, undefined);
    
    // Clear all key subscribers
    this.keySubscribers.forEach(subscribers => subscribers.clear());
    this.keySubscribers.clear();
    
    await this.persist();
    getEventBus().emit(FOCUS_EVENTS.DATA_RESET, { timestamp: Date.now() });
  }

  async persist(): Promise<void> {
    try {
      const stateToPersist = {
        ...this.state,
        session: {
          ...this.state.session,
          filesWorked: Array.from(this.state.session.filesWorked),
        },
      };
      
      await vscode.workspace.getConfiguration('focusPulse').update(STORAGE_KEY, stateToPersist);
      getEventBus().emit(FOCUS_EVENTS.DATA_SAVED, { timestamp: Date.now() });
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  async load(): Promise<void> {
    try {
      const persistedState = vscode.workspace.getConfiguration('focusPulse').get<any>(STORAGE_KEY);
      
      if (persistedState) {
        this.state = {
          ...this.getInitialState(),
          ...persistedState,
          session: {
            ...this.getInitialState().session,
            ...persistedState.session,
            filesWorked: new Set(persistedState.session?.filesWorked || []),
          },
        };
        
        this.notifySubscribers(this.state, undefined);
        getEventBus().emit(FOCUS_EVENTS.DATA_LOADED, { timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  // Convenience methods for updating specific state parts
  updateFocus(focusUpdate: Partial<AppState['focus']>): void {
    this.setState({ focus: { ...this.state.focus, ...focusUpdate } });
  }

  updatePomodoro(pomodoroUpdate: Partial<AppState['pomodoro']>): void {
    this.setState({ pomodoro: { ...this.state.pomodoro, ...pomodoroUpdate } });
  }

  updateAchievements(achievementsUpdate: Partial<AppState['achievements']>): void {
    this.setState({ achievements: { ...this.state.achievements, ...achievementsUpdate } });
  }

  updateXp(xpUpdate: Partial<AppState['xp']>): void {
    this.setState({ xp: { ...this.state.xp, ...xpUpdate } });
  }

  updateDeepWork(deepWorkUpdate: Partial<AppState['deepWork']>): void {
    this.setState({ deepWork: { ...this.state.deepWork, ...deepWorkUpdate } });
  }

  updateGoals(goalsUpdate: Partial<AppState['goals']>): void {
    this.setState({ goals: { ...this.state.goals, ...goalsUpdate } });
  }

  updateUI(uiUpdate: Partial<AppState['ui']>): void {
    this.setState({ ui: { ...this.state.ui, ...uiUpdate } });
  }

  updateSession(sessionUpdate: Partial<AppState['session']>): void {
    this.setState({ session: { ...this.state.session, ...sessionUpdate } });
  }

  private notifySubscribers(state: AppState, previousState: AppState | undefined): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(state, previousState);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  private notifyKeySubscribers(
    partialState: Partial<AppState>,
    previousState: AppState
  ): void {
    Object.keys(partialState).forEach(key => {
      const typedKey = key as keyof AppState;
      const subscribers = this.keySubscribers.get(typedKey);
      
      if (subscribers) {
        subscribers.forEach(subscriber => {
          try {
            subscriber(this.state[typedKey], previousState[typedKey]);
          } catch (error) {
            console.error(`Error in ${key} state subscriber:`, error);
          }
        });
      }
    });
  }

  private emitStateChangeEvents(
    partialState: Partial<AppState>,
    previousState: AppState
  ): void {
    const eventBus = getEventBus();
    
    // Emit specific events based on state changes
    if (partialState.focus) {
      if (partialState.focus.currentFile !== previousState.focus.currentFile) {
        eventBus.emit(FOCUS_EVENTS.FILE_FOCUS_CHANGED, {
          fileName: partialState.focus.currentFile!,
          previousFile: previousState.focus.currentFile,
          timestamp: Date.now(),
        });
      }
    }

    if (partialState.pomodoro) {
      if (partialState.pomodoro.isRunning !== previousState.pomodoro.isRunning) {
        if (partialState.pomodoro.isRunning) {
          eventBus.emit(FOCUS_EVENTS.POMODORO_STARTED, { timestamp: Date.now() });
        }
      }
    }

    if (partialState.achievements?.lastUnlocked && partialState.achievements.lastUnlocked !== previousState.achievements.lastUnlocked) {
      // This would need achievement details, which should be passed separately
    }

    // LEVEL_UP is emitted explicitly in updateAll after computing xp;
    // no secondary emit here to avoid duplicates.

    if (partialState.deepWork?.active && partialState.deepWork.active !== previousState.deepWork.active) {
      if (partialState.deepWork.active) {
        eventBus.emit(FOCUS_EVENTS.DEEP_WORK_STARTED, {
          timestamp: Date.now(),
          expectedDuration: partialState.deepWork.expectedDuration,
        });
      }
    }

    if (partialState.ui?.dashboardOpen && partialState.ui.dashboardOpen !== previousState.ui.dashboardOpen) {
      if (partialState.ui.dashboardOpen) {
        eventBus.emit(FOCUS_EVENTS.DASHBOARD_OPENED, { timestamp: Date.now() });
      } else {
        eventBus.emit(FOCUS_EVENTS.DASHBOARD_CLOSED, { timestamp: Date.now() });
      }
    }
  }

  private persistDebounced = () => {
    debounceStorageWrite('app_state', () => this.persist());
  };
}

// Global state manager instance
let globalStateManager: FocusStateManager | null = null;

export function getStateManager(): StateManager {
  if (!globalStateManager) {
    globalStateManager = new FocusStateManager();
  }
  return globalStateManager;
}

export type { AppState } from './StateTypes';

export function resetStateManager(): void {
  globalStateManager = null;
}