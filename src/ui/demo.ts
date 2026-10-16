import { emptyStore, type Account, type Meter } from '../core/model';
import { toPublicState } from '../core/public';
import type { PublicStore } from '../platform/messages';

export function demoState(now = Date.now()): PublicStore {
  const store = emptyStore('demo-only');
  const meter = (id: string, label: string, usedPercent: number, hours: number, scope: Meter['scope']): Meter => ({
    id, label, usedPercent, used: null, total: null, unit: 'percent', resetsAt: now + hours * 3600_000,
    scope, evidence: 'reported', source: 'Sample reading, not a real account',
  });
  const make = (id: string, provider: Account['provider'], alias: string, plan: string, meters: Meter[], active: boolean): Account => ({
    id, provider, alias, defaultName: `${provider === 'claude' ? 'Claude' : 'ChatGPT'} account`, kind: 'account', plan,
    meters, connection: active ? 'active' : 'inactive', createdAt: now - 86400_000, updatedAt: active ? now : now - 3600_000,
    alertRemaining: null, alertsMuted: false,
  });
  store.accounts = [
    make('demo-claude-work', 'claude', 'Claude Work', 'max 5x', [meter('session', 'Session · 5 hours', 32, 2.8, 'subscription'), meter('week', 'Weekly · all models', 61, 72, 'subscription')], true),
    make('demo-gpt-work', 'chatgpt', 'GPT Work', 'plus', [meter('session', 'Work / Codex · 5 hours', 86, 1.4, 'work-codex'), meter('week', 'Work / Codex · Weekly', 45, 94, 'work-codex')], true),
    make('demo-claude-personal', 'claude', 'Claude Personal', 'pro', [meter('session', 'Session · 5 hours', 17, 2, 'subscription')], false),
    make('demo-gpt-personal', 'chatgpt', 'GPT Personal', 'plus', [meter('session', 'Work / Codex · 5 hours', 25, 3, 'work-codex')], false),
    make('demo-gpt-projects', 'chatgpt', 'GPT Projects', 'pro', [meter('week', 'Work / Codex · Weekly', 12, 80, 'work-codex')], false),
  ];
  for (const provider of ['claude', 'chatgpt'] as const) {
    store.providers[provider] = { enabled: true, status: 'active', activeAccountId: store.accounts.find(account => account.provider === provider && account.connection === 'active')!.id,
      checkedAt: now, message: null, failures: 0, nextRetryAt: null };
  }
  return toPublicState(store);
}
