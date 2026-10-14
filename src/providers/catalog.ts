import type { ProviderId } from '../core/model';

export const providers: Record<ProviderId, {
  name: string; origin: string; home: string; usage: string; color: string;
  detail: string; support: 'prototype' | 'browser-observed';
}> = {
  claude: { name: 'Claude', origin: 'https://claude.ai/*', home: 'https://claude.ai', usage: 'https://claude.ai/settings/usage', color: '#cc8566', support: 'prototype', detail: 'Reported subscription limits where your plan exposes them.' },
  chatgpt: { name: 'ChatGPT', origin: 'https://chatgpt.com/*', home: 'https://chatgpt.com', usage: 'https://chatgpt.com/codex/settings/usage', color: '#52a990', support: 'prototype', detail: 'Work / Codex allowance. Ordinary chat quotas are separate.' },
  gemini: { name: 'Gemini', origin: 'https://gemini.google.com/*', home: 'https://gemini.google.com', usage: 'https://gemini.google.com/usage', color: '#7798dc', support: 'browser-observed', detail: 'Local request observations initially; account quotas need validation.' },
  grok: { name: 'Grok', origin: 'https://grok.com/*', home: 'https://grok.com', usage: 'https://grok.com', color: '#aaaeb8', support: 'browser-observed', detail: 'Local request observations initially; account quotas need validation.' },
  perplexity: { name: 'Perplexity', origin: 'https://www.perplexity.ai/*', home: 'https://www.perplexity.ai', usage: 'https://www.perplexity.ai/settings', color: '#55a8b1', support: 'browser-observed', detail: 'Local request observations initially; search quotas need validation.' },
};

export function providerForUrl(url: string): ProviderId | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return (Object.keys(providers) as ProviderId[]).find(id => new URL(providers[id].home).hostname === parsed.hostname) ?? null;
  } catch { return null; }
}
