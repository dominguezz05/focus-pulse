export type DebounceFunction<T extends any[] = any[]> = (...args: T) => void;

export interface DebounceOptions {
  delay?: number;
  immediate?: boolean;
  maxWait?: number;
}

export class Debouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private maxTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounce a function with optional maxWait
   */
  debounce<T extends any[]>(
    key: string,
    func: (...args: T) => void,
    delay: number = 300,
    options: DebounceOptions = {}
  ): (...args: T) => void {
    const { immediate = false, maxWait } = options;

    return (...args: T) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set maxWait timer if specified
      if (maxWait && !this.maxTimers.has(key)) {
        const maxTimer = setTimeout(() => {
          this.executeFunction(key, func, args);
          this.clearTimer(key);
        }, maxWait);
        this.maxTimers.set(key, maxTimer);
      }

      // Execute immediately if immediate is true and no timer exists
      if (immediate && !this.timers.has(key)) {
        this.executeFunction(key, func, args);
      }

      // Set new timer
      const timer = setTimeout(() => {
        if (!immediate) {
          this.executeFunction(key, func, args);
        }
        this.clearTimer(key);
      }, delay);

      this.timers.set(key, timer);
    };
  }

  /**
   * Cancel a debounced function
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const maxTimer = this.maxTimers.get(key);
    if (maxTimer) {
      clearTimeout(maxTimer);
      this.maxTimers.delete(key);
    }
  }

  /**
   * Execute a debounced function immediately
   */
  flush<T extends any[]>(key: string, func: (...args: T) => void, args: T): void {
    this.cancel(key);
    this.executeFunction(key, func, args);
  }

  /**
   * Check if a debounced function is pending
   */
  pending(key: string): boolean {
    return this.timers.has(key) || this.maxTimers.has(key);
  }

  /**
   * Clear all timers
   */
  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.maxTimers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.maxTimers.clear();
  }

  private executeFunction<T extends any[]>(
    key: string,
    func: (...args: T) => void,
    args: T
  ): void {
    try {
      func(...args);
    } catch (error) {
      console.error(`Error executing debounced function for key ${key}:`, error);
    }
  }

  private clearTimer(key: string): void {
    this.timers.delete(key);
    this.maxTimers.delete(key);
  }
}

// Global debouncer instance
let globalDebouncer: Debouncer | null = null;

export function getDebouncer(): Debouncer {
  if (!globalDebouncer) {
    globalDebouncer = new Debouncer();
  }
  return globalDebouncer;
}

// Convenience functions for common debouncing scenarios
export function debounceDashboardUpdate(
  updateFunction: () => void,
  delay: number = 500
): void {
  getDebouncer().debounce('dashboard_update', updateFunction, delay)();
}

export function debounceStorageWrite(
  key: string,
  writeFunction: () => void,
  delay: number = 1000
): void {
  getDebouncer().debounce(`storage_write_${key}`, writeFunction, delay)();
}

export function debounceStatusUpdate(
  updateFunction: () => void,
  delay: number = 200
): void {
  getDebouncer().debounce('status_update', updateFunction, delay)();
}

export function debounceAnalyticsUpdate(
  updateFunction: () => void,
  delay: number = 2000,
  maxWait: number = 5000
): void {
  getDebouncer().debounce(
    'analytics_update',
    updateFunction,
    delay,
    { maxWait }
  )();
}