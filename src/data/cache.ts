// The last good copy of every chart and quote, in IndexedDB. Opening the app paints from here
// straight away, and a symbol whose source is down still shows what we last saw.
const DB = "finnie", STORE = "kv";

let db: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const d = await open();
    return await new Promise((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function cachePut(key: string, value: unknown): Promise<void> {
  try {
    const d = await open();
    d.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
  } catch {
    // A cache that cannot write is only a slower start.
  }
}
