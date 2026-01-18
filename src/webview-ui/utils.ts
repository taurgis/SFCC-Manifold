/**
 * Utility functions for HTML rendering
 */

/**
 * Escape HTML for safe rendering
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) {return "";}
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape string for use in HTML attributes
 */
export function escapeAttr(str: unknown): string {
  if (str === null || str === undefined) {return "";}
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

/**
 * Format attribute key for display (convert kebab-case to readable)
 */
export function formatAttributeKey(key: string): string {
  return key.replace(/-/g, " ").replace(/_/g, " ");
}

/**
 * Debounce helper for performance-critical operations
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>): void {
    if (timeout) { clearTimeout(timeout); }
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle helper for continuous events like drag/zoom
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs !== null) {
          func.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
      }, limit);
    } else {
      lastArgs = args;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastThis = this;
    }
  };
}
