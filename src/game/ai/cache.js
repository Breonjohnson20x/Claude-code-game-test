// Generation cache + hashing (Master Build §29 cost control). Identical compact context for the
// same generator/model/prompt version ⇒ reuse the stored output instead of paying for a call.
// Persisted in the storage adapter under elvia.aicache.v1, capped (~100 entries), least-recently
// used evicted first. Every failure here is swallowed: the cache is an optimization, never a
// dependency.

import { AI_CACHE_KEY, getDefaultStorage, normalizeStorage, readJson, writeJson } from '../save/storage.js';

export const DEFAULT_CACHE_CAP = 100;

/** Deterministic JSON: object keys sorted, undefined dropped. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** cyrb53 — fast 53-bit string hash, returned as hex. Not cryptographic. */
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function contextHash(generator, compactContext, { model = '', version = 1 } = {}) {
  return hash53(stableStringify({ g: generator, m: model, v: version, c: compactContext }));
}

/**
 * @param {{ storage?: object, key?: string, cap?: number }} [options]
 * @returns {{ get(hash), set(hash, output, generator?), clear(), size(), keys() }}
 */
export function createAiCache({ storage, key = AI_CACHE_KEY, cap = DEFAULT_CACHE_CAP } = {}) {
  let store;
  try {
    store = normalizeStorage(storage ?? getDefaultStorage());
  } catch {
    store = null;
  }
  let data = null; // { v: 1, seq, entries: { [hash]: { o, g, u } } }

  function load() {
    if (data) return data;
    data = { v: 1, seq: 0, entries: {} };
    if (!store) return data;
    const res = readJson(store, key);
    if (res.status === 'ok' && res.value && typeof res.value === 'object' && res.value.entries && typeof res.value.entries === 'object') {
      data = { v: 1, seq: Number.isFinite(res.value.seq) ? res.value.seq : 0, entries: { ...res.value.entries } };
    }
    return data;
  }

  function evictTo(limit) {
    const ids = Object.keys(data.entries);
    if (ids.length <= limit) return;
    ids.sort((a, b) => (data.entries[a].u ?? 0) - (data.entries[b].u ?? 0));
    for (const id of ids.slice(0, ids.length - limit)) delete data.entries[id];
  }

  function persist() {
    if (!store) return;
    let res = writeJson(store, key, data);
    if (!res.ok && res.code === 'quota') {
      evictTo(Math.floor(Object.keys(data.entries).length / 2));
      res = writeJson(store, key, data);
    }
  }

  return {
    get(hash) {
      const d = load();
      const entry = d.entries[hash];
      if (!entry) return undefined;
      d.seq += 1;
      entry.u = d.seq;
      persist();
      return JSON.parse(JSON.stringify(entry.o));
    },
    set(hash, output, generator) {
      const d = load();
      d.seq += 1;
      d.entries[hash] = { o: output, g: generator ?? null, u: d.seq };
      evictTo(cap);
      persist();
    },
    clear() {
      data = { v: 1, seq: 0, entries: {} };
      persist();
    },
    size() {
      return Object.keys(load().entries).length;
    },
    keys() {
      return Object.keys(load().entries);
    },
  };
}

// Session budget (§29): at most settings.aiBudget real API calls per page session.
export const DEFAULT_AI_BUDGET = 25;

export function normalizeBudget(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_AI_BUDGET;
}

export function budgetRemaining(callsThisSession, budget) {
  return Math.max(0, normalizeBudget(budget) - (callsThisSession ?? 0));
}
