// Storage adapter (PERSIST). The only module under src/game/** that touches browser storage.
//
// Adapter interface: { getItem(key) → string|null, setItem(key, value), removeItem(key), keys?() → string[] }
// Default: window.localStorage when it is usable, otherwise a process-wide in-memory Map
// (vitest / node / private-mode browsers that throw on access).

export const NAMESPACE = 'elvia';
export const SAVE_PREFIX = `${NAMESPACE}.save.v1.`;
export const DYNASTY_KEY = `${NAMESPACE}.dynasty.v1`;
export const AI_CACHE_KEY = `${NAMESPACE}.aicache.v1`;

export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    kind: 'memory',
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
}

/** Wrap a Web Storage object (localStorage) in the adapter interface. */
export function createWebStorage(webStorage) {
  return {
    kind: 'web',
    getItem: (key) => webStorage.getItem(key),
    setItem: (key, value) => webStorage.setItem(key, String(value)),
    removeItem: (key) => webStorage.removeItem(key),
    keys: () => {
      const out = [];
      for (let i = 0; i < webStorage.length; i += 1) {
        const k = webStorage.key(i);
        if (k != null) out.push(k);
      }
      return out;
    },
  };
}

let sharedMemory = null;
let cachedDefault = null;

/** localStorage if it can be written to, else a shared in-memory adapter (same object every call). */
export function getDefaultStorage() {
  if (cachedDefault) return cachedDefault;
  try {
    const ls = globalThis.localStorage;
    if (ls && typeof ls.getItem === 'function') {
      const probe = `${NAMESPACE}.__probe__`;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      cachedDefault = createWebStorage(ls);
      return cachedDefault;
    }
  } catch {
    // Access denied (privacy mode, sandboxed iframe) — fall through to memory.
  }
  if (!sharedMemory) sharedMemory = createMemoryStorage();
  cachedDefault = sharedMemory;
  return cachedDefault;
}

/** Accepts anything storage-shaped; fills in a missing keys() as an empty list. */
export function normalizeStorage(storage) {
  const s = storage ?? getDefaultStorage();
  if (typeof s.getItem !== 'function' || typeof s.setItem !== 'function' || typeof s.removeItem !== 'function') {
    throw new TypeError('storage must implement getItem, setItem and removeItem');
  }
  if (typeof s.keys === 'function') return s;
  return {
    getItem: (k) => s.getItem(k),
    setItem: (k, v) => s.setItem(k, v),
    removeItem: (k) => s.removeItem(k),
    keys: () => [],
  };
}

// DOMException names/codes for "storage full" across browsers (not message matching).
export function isQuotaError(err) {
  if (!err || typeof err !== 'object') return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/**
 * Read + parse JSON without throwing.
 * @returns {{ status: 'missing'|'ok'|'corrupt'|'error', value?: any, error?: string }}
 */
export function readJson(storage, key) {
  let raw;
  try {
    raw = storage.getItem(key);
  } catch (err) {
    return { status: 'error', error: `Storage unavailable: ${err?.name ?? 'error'}` };
  }
  if (raw === null || raw === undefined) return { status: 'missing' };
  try {
    return { status: 'ok', value: JSON.parse(raw), raw };
  } catch {
    return { status: 'corrupt', error: 'Stored data is not valid JSON', raw };
  }
}

/**
 * Serialize + write without throwing.
 * @returns {{ ok: true, bytes: number } | { ok: false, code: 'serialize'|'quota'|'storage', error: string }}
 */
export function writeJson(storage, key, value) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (err) {
    return { ok: false, code: 'serialize', error: `Could not serialize data (${err?.name ?? 'error'})` };
  }
  if (typeof text !== 'string') return { ok: false, code: 'serialize', error: 'Nothing to serialize' };
  try {
    storage.setItem(key, text);
    return { ok: true, bytes: text.length };
  } catch (err) {
    if (isQuotaError(err)) return { ok: false, code: 'quota', error: 'Browser storage is full' };
    return { ok: false, code: 'storage', error: `Storage write failed (${err?.name ?? 'error'})` };
  }
}

export function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
