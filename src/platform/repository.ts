import { browser } from 'wxt/browser';
import { type Store } from '../core/model';
import { StoreSchema } from '../core/schema';
import { toPublicState } from '../core/public';

import { initializeV2, STATE_V2 } from '../core/migrations';
import { ensureHistory } from './history';
const KEY = STATE_V2;
let queue: Promise<unknown> = Promise.resolve();
let initialisation: Promise<void> | undefined;

export async function readStore(): Promise<Store> {
  initialisation ??= initializeV2(browser.storage.local, ensureHistory, () => crypto.randomUUID()).catch(error => { initialisation = undefined; throw new Error(error instanceof Error ? `Saved data needs recovery: ${error.message}` : 'Saved data needs recovery.'); });
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
