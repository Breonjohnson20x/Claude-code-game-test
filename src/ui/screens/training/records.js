// The training yard's own memory: which drills you have passed and how many bouts you have won.
// A per-device convenience in localStorage; it is not game state, never touches a save, and the
// yard works the same if storage is unavailable.

const KEY = 'elvia.training.v1';
const EMPTY = { drills: {}, spars: {} };

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadRecords() {
  try {
    const raw = JSON.parse(storage()?.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    return { drills: raw.drills && typeof raw.drills === 'object' ? raw.drills : {}, spars: raw.spars && typeof raw.spars === 'object' ? raw.spars : {} };
  } catch {
    return { ...EMPTY };
  }
}

function save(records) {
  try {
    storage()?.setItem(KEY, JSON.stringify(records));
  } catch {
    // Storage full or blocked: the yard simply forgets.
  }
}

/** Fold a finished yard duel into the records and persist. Returns the new records. */
export function recordResult(records, { kind, id }, result) {
  const next = { drills: { ...records.drills }, spars: { ...records.spars } };
  if (kind === 'drill') {
    const prev = next.drills[id] ?? { passed: false, attempts: 0 };
    next.drills[id] = { passed: prev.passed || Boolean(result?.drill?.met), attempts: prev.attempts + 1 };
  } else {
    const prev = next.spars[id] ?? { wins: 0, bouts: 0 };
    next.spars[id] = { wins: prev.wins + (result?.outcome === 'victory' ? 1 : 0), bouts: prev.bouts + 1 };
  }
  save(next);
  return next;
}
