export interface HistoryPoint { accountId: string; time: number; meters: { id: string; usedPercent: number | null }[]; }

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mylimits-history', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('readings', { keyPath: 'id', autoIncrement: true });
      store.createIndex('account', 'accountId');
      store.createIndex('time', 'time');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local history could not be opened.'));
  });
}

export async function saveHistory(point: HistoryPoint): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('readings', 'readwrite');
    const store = transaction.objectStore('readings');
    store.add(point);
    const cursor = store.index('time').openCursor(IDBKeyRange.upperBound(Date.now() - 30 * 86400_000));
    cursor.onsuccess = () => { const item = cursor.result; if (item) { item.delete(); item.continue(); } };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Local history could not be saved.'));
  });
  db.close();
}

export async function readHistory(accountId: string): Promise<HistoryPoint[]> {
  const db = await database();
  const points = await new Promise<HistoryPoint[]>((resolve, reject) => {
    const output: HistoryPoint[] = [];
    const transaction = db.transaction('readings', 'readonly');
    const request = transaction.objectStore('readings').index('account').openCursor(IDBKeyRange.only(accountId), 'prev');
    request.onsuccess = () => { const cursor = request.result; if (cursor && output.length < 48) { output.push(cursor.value as HistoryPoint); cursor.continue(); } };
    transaction.oncomplete = () => resolve(output.reverse());
    transaction.onerror = () => reject(new Error('Local history could not be read.'));
  });
  db.close();
  return points;
}

export async function removeHistory(accountId: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('readings', 'readwrite');
    const cursor = transaction.objectStore('readings').index('account').openCursor(IDBKeyRange.only(accountId));
    cursor.onsuccess = () => { const item = cursor.result; if (item) { item.delete(); item.continue(); } };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Local history could not be removed.'));
  });
  db.close();
}
