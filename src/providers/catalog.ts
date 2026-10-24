import type { ProviderId } from '../core/model';

export const providers: Record<ProviderId, {
  name: string; origin: string; home: string; usage: string; color: string;
  detail: string; support: 'prototype';
}> = {
 copilot:{name:'GitHub Copilot',origin:'https://api.github.com/*',home:'https://api.github.com',usage:'https://api.github.com',color:'#939bab',support:'prototype',detail:'Official GitHub REST API premium requests; fine-grained token with Plan: read.'},
  claude: { name: 'Claude / Claude Code', origin: 'https://claude.ai/*', home: 'https://claude.ai', usage: 'https://claude.ai/settings/usage', color: '#cc8566', support: 'prototype', detail: 'Reported subscription limits where your plan exposes them.' },
  chatgpt: { name: 'ChatGPT / Codex', origin: 'https://chatgpt.com/*', home: 'https://chatgpt.com', usage: 'https://chatgpt.com/codex/settings/usage', color: '#52a990', support: 'prototype', detail: 'Work / Codex allowance. Ordinary chat quotas are separate.' },
  cursor: {name:'Cursor',origin:'https://cursor.com/*',home:'https://cursor.com',usage:'https://cursor.com/dashboard?tab=usage',color:'#808da2',support:'prototype',detail:'Returned coding-plan allowance and on-demand spend; separate from chat subscriptions.'},
};

export function providerForUrl(url: string): ProviderId | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return (Object.keys(providers) as ProviderId[]).find(id => new URL(providers[id].home).hostname === parsed.hostname) ?? null;
  } catch { return null; }
}
