/**
 * Shared formatting utilities used across the application
 */

/**
 * Format a date to YYYY-MM-DD string
 */
export function formatDate(date: Date | string | number): string {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Format milliseconds to human-readable time string
 */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Convert milliseconds to minutes (rounded down)
 */
export function formatMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}

/**
 * Format seconds to MM:SS string (for timers)
 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to "Xm Ys" or "Xs" format (used in UI components)
 */
export function formatTimeShort(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
