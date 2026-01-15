/**
 * Webview helper utilities
 */

/**
 * Generate a cryptographically random nonce for CSP
 */
export function createNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safely encode data for embedding in script tags
 */
export function encodeForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
