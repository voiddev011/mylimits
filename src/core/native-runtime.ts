// Brave can expose a partial `browser` namespace alongside the full Chrome API.
export function nativeRuntime<T extends { connectNative?: unknown }>(chrome: T | undefined, browser: T | undefined): T {
  if (typeof chrome?.connectNative === 'function') return chrome;
  if (typeof browser?.connectNative === 'function') return browser;
  throw new Error('Native messaging is unavailable. Reload MyLimits in your browser extensions page after approving companion access, then retry.');
}
