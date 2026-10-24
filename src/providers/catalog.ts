import type { ProviderId } from '../core/model';

export const providers: Record<ProviderId, {
  name: string; origin: string; home: string; usage: string; color: string;
  detail: string; support: 'prototype' | 'browser-observed';
}> = {
 copilot:{name:'GitHub Copilot',origin:'https://api.github.com/*',home:'https://api.github.com',usage:'https://api.github.com',color:'#939bab',support:'prototype',detail:'Official GitHub REST API premium requests; fine-grained token with Plan: read.'},
  claude: { name: 'Claude', origin: 'https://claude.ai/*', home: 'https://claude.ai', usage: 'https://claude.ai/settings/usage', color: '#cc8566', support: 'prototype', detail: 'Reported subscription limits where your plan exposes them.' },
  chatgpt: { name: 'ChatGPT', origin: 'https://chatgpt.com/*', home: 'https://chatgpt.com', usage: 'https://chatgpt.com/codex/settings/usage', color: '#52a990', support: 'prototype', detail: 'Work / Codex allowance. Ordinary chat quotas are separate.' },
  gemini: { name: 'Gemini', origin: 'https://gemini.google.com/*', home: 'https://gemini.google.com', usage: 'https://gemini.google.com/usage', color: '#7798dc', support: 'browser-observed', detail: 'Local request observations only; consumer account quotas remain unverified.' },
  grok: { name: 'Grok', origin: 'https://grok.com/*', home: 'https://grok.com', usage: 'https://grok.com', color: '#aaaeb8', support: 'prototype', detail: 'Reported Grok 4 default request allowance for identifiable accounts; activity-only mode is optional.' },
  perplexity: { name: 'Perplexity', origin: 'https://www.perplexity.ai/*', home: 'https://www.perplexity.ai', usage: 'https://www.perplexity.ai/settings', color: '#55a8b1', support: 'prototype', detail: 'Returned remaining search counts. Totals and resets may be unknown; activity-only mode is optional.' },
  cursor: {name:'Cursor',origin:'https://cursor.com/*',home:'https://cursor.com',usage:'https://cursor.com/dashboard?tab=usage',color:'#808da2',support:'prototype',detail:'Returned coding-plan allowance and on-demand spend; separate from chat subscriptions.'},
};

export function providerForUrl(url: string): ProviderId | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return (Object.keys(providers) as ProviderId[]).find(id => new URL(providers[id].home).hostname === parsed.hostname) ?? null;
  } catch { return null; }
}
