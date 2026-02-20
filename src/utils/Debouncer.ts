/**
 * Simple debounce utility - executes function after delay with no new calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

// Convenience functions for common scenarios
let dashboardTimeout: NodeJS.Timeout | undefined;
export function debounceDashboardUpdate(updateFunction: () => void, delay: number = 500): void {
  if (dashboardTimeout) {
    clearTimeout(dashboardTimeout);
  }
  dashboardTimeout = setTimeout(updateFunction, delay);
}

let storageTimeouts = new Map<string, NodeJS.Timeout>();
export function debounceStorageWrite(key: string, writeFunction: () => void, delay: number = 1000): void {
  const existing = storageTimeouts.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  const timeout = setTimeout(() => {
    writeFunction();
    storageTimeouts.delete(key);
  }, delay);
  storageTimeouts.set(key, timeout);
}

let statusTimeout: NodeJS.Timeout | undefined;
export function debounceStatusUpdate(updateFunction: () => void, delay: number = 200): void {
  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }
  statusTimeout = setTimeout(updateFunction, delay);
}

let analyticsTimeout: NodeJS.Timeout | undefined;
export function debounceAnalyticsUpdate(updateFunction: () => void, delay: number = 2000): void {
  if (analyticsTimeout) {
    clearTimeout(analyticsTimeout);
  }
  analyticsTimeout = setTimeout(updateFunction, delay);
}
