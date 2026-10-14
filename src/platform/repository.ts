import { browser } from 'wxt/browser';
import { emptyStore, type Store } from '../core/model';
import { StoreSchema } from '../core/schema';

const KEY = 'mylimits:state:v1';
let queue: Promise<unknown> = Promise.resolve();
let initialisation: Promise<void> | undefined;

export async function readStore(): Promise<Store> {
  initialisation ??= (async () => {
    const saved = (await browser.storage.local.get(KEY))[KEY];
    if (saved === undefined) await browser.storage.local.set({ [KEY]: emptyStore(crypto.randomUUID()) });
  })();
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

export async function publicStore(): Promise<Omit<Store, 'installSalt' | 'alertLedger' | 'observationLedger'>> {
  const { installSalt: _salt, alertLedger: _alerts, observationLedger: _observations, ...publicData } = await readStore();
  return publicData;
}
