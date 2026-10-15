export interface HistoryPoint { accountId: string; time: number; meters: { id: string; usedPercent: number | null }[]; }

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mylimits-history', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains('readings') ? request.transaction!.objectStore('readings') : db.createObjectStore('readings', { keyPath: 'id', autoIncrement: true });
      if (!store.indexNames.contains('account')) store.createIndex('account', 'accountId');
      if (!store.indexNames.contains('time')) store.createIndex('time', 'time');
      if (!store.indexNames.contains('snapshotKey')) store.createIndex('snapshotKey', 'snapshotKey', { unique: true });
      if (!store.indexNames.contains('account-time')) store.createIndex('account-time', ['accountId', 'time']);
      const cursor = store.openCursor();
      cursor.onsuccess = () => { const row = cursor.result; if (row) { if (!row.value.schemaVersion) row.update({ ...row.value, schemaVersion: 2, observedAt: row.value.time, receivedAt: row.value.time, connectionId: 'legacy', legacy: true }); row.continue(); } };
    };
    request.onblocked = () => reject(new Error('Close other MyLimits tabs and retry the history upgrade.'));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
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

export async function ensureHistory(): Promise<void> { const db = await database(); db.close(); }
