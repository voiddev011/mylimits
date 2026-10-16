import { browser } from 'wxt/browser';

export function openDashboard(section = 'overview', accountId?: string, demo = false) {
  const query = accountId ? `?account=${encodeURIComponent(accountId)}` : '';
  return browser.tabs.create({ url: `${browser.runtime.getURL('/dashboard.html')}${query}#${demo ? 'demo' : section}` });
}
