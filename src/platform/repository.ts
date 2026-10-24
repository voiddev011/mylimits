import { browser } from 'wxt/browser';
import { type Store } from '../core/model';
import { StoreSchema } from '../core/schema';
import { cleanupRetiredState } from '../core/simplify-cleanup';
import { toPublicState } from '../core/public';

import { initializeV2, STATE_V2 } from '../core/migrations';
import { ensureHistory,removeRetiredHistory } from './history';
const KEY = STATE_V2;
let queue: Promise<unknown> = Promise.resolve();
let initialisation: Promise<void> | undefined;

export async function readStore(): Promise<Store> {
  initialisation ??= cleanupRetiredState(browser.storage.local, async()=>initializeV2(browser.storage.local, ensureHistory, () => crypto.randomUUID()), removeRetiredHistory).catch(error => { initialisation = undefined; throw new Error(error instanceof Error ? `Saved data needs recovery: ${error.message}` : 'Saved data needs recovery.'); });
  await initialisation;
  const saved = (await browser.storage.local.get(KEY))[KEY];
  if (saved !== undefined) {
    const parsed = StoreSchema.safeParse(saved);
    if (!parsed.success) throw new Error('Saved MyLimits data is not recognised. Export it before resetting storage.');
    return parsed.data;
  }
  throw new Error('MyLimits storage was removed. Reload the extension to initialise it.');
}

export function updateStore<T>(mutate: (store: Store) => Promise<{ store: Store; value: T }> | { store: Store; value: T }): Promise<T> {
  const task = queue.then(async () => {
    const result = await mutate(await readStore());
    await browser.storage.local.set({ [KEY]: StoreSchema.parse(result.store) });
    return result.value;
  });
  queue = task.catch(() => undefined);
  return task;
}

export async function publicStore() { return toPublicState(await readStore()); }

// Explicit forgetting also removes that account from recovery copies. Migration
// preserves backups; a later deliberate deletion must not retain forgotten data.
export async function forgetLegacyAccount(accountId: string): Promise<void> {
  const { STATE_V1, BACKUP_V1 } = await import('../core/migrations');
  const { V1StoreSchema } = await import('../core/v1-schema');
  const values=await browser.storage.local.get([STATE_V1,BACKUP_V1]);
  const writes:Record<string,unknown>={};
  for(const key of [STATE_V1,BACKUP_V1]){
    if(values[key]===undefined)continue;
    const old=V1StoreSchema.parse(values[key]);
    writes[key]={...old,accounts:old.accounts.filter(a=>a.id!==accountId),
      providers:Object.fromEntries(Object.entries(old.providers).map(([id,p])=>[id,p.activeAccountId===accountId?{...p,enabled:false,status:'disabled',activeAccountId:null}:p])),
      alertLedger:Object.fromEntries(Object.entries(old.alertLedger).filter(([key])=>!key.startsWith(`${accountId}/`)))};
  }
  if(Object.keys(writes).length)await browser.storage.local.set(writes);
}
