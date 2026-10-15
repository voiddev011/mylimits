import type { Account, Meter, Store } from './model';
export interface CompanionProfile {
  id: string; status: 'active' | 'signed-out' | 'unavailable'; plan: string | null; updatedAt: number; meters: Meter[];
}
export function mergeCompanion(store: Store, profiles: CompanionProfile[], now: number): Store {
  const accounts: Account[] = profiles.map(profile => {
    const id = `openai-companion:${profile.id}`;
    const prior = store.accounts.find(account => account.id === id);
    return { id, provider: 'chatgpt', kind: 'account', companionProfile: profile.id,
      alias: prior?.alias ?? '', defaultName: prior?.defaultName ?? `OpenAI ${profile.id.slice(0, 4)}`,
      plan: profile.plan ?? prior?.plan ?? null, connection: profile.status,
      meters: profile.updatedAt > 0 ? profile.meters : prior?.meters ?? [],
      createdAt: prior?.createdAt ?? now, updatedAt: profile.updatedAt > 0 ? profile.updatedAt : prior?.updatedAt ?? 0,
      alertRemaining: prior?.alertRemaining ?? null, alertsMuted: prior?.alertsMuted ?? false };
  });
  const removed = store.accounts.filter(account => account.companionProfile && !accounts.some(current => current.id === account.id));
  return { ...store, accounts: [...store.accounts.filter(account => !account.companionProfile), ...accounts],
    alertLedger: Object.fromEntries(Object.entries(store.alertLedger).filter(([key]) => !removed.some(account => key.startsWith(`${account.id}/`)))) };
}
