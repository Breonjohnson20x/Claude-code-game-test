// Save migrations (PERSIST). Brings any older GameState up to STATE_VERSION, then backfills
// keys the current factory defines but an older save lacks, so old saves never crash new code.
//
// Adding v2: bump STATE_VERSION in core/state.js, then add MIGRATIONS[1] = (s) => ({ ...s, newThing })
// — a pure function from a v1 state to a v2 state. Steps run in order 1→2→3…; each one only
// has to know about its own version. Backfill runs after the last step.

import { STATE_VERSION, createNewGame } from '../core/state.js';

/** MIGRATIONS[n] upgrades a version-n state to version n+1. v1 is current: none yet. */
export const MIGRATIONS = {};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/**
 * Fill keys present in `defaults` but missing (undefined) in `target`, recursing into plain
 * objects. Never overwrites an existing value and never touches arrays' contents.
 * Returns the list of dotted paths that were filled.
 */
export function fillDefaults(target, defaults, path = '', filled = []) {
  for (const [key, defVal] of Object.entries(defaults)) {
    const here = path ? `${path}.${key}` : key;
    if (target[key] === undefined) {
      target[key] = clone(defVal);
      filled.push(here);
    } else if (isPlainObject(target[key]) && isPlainObject(defVal)) {
      fillDefaults(target[key], defVal, here, filled);
    }
  }
  return filled;
}

/** Backfill a (current-version) state from createNewGame() defaults. Mutates a copy. */
export function backfillState(state) {
  const s = clone(state);
  const defaults = createNewGame({
    seed: Number.isFinite(s.rngSeed) ? s.rngSeed : 1,
    sovereignName: s.cycle?.sovereign?.name ?? 'Aurelian',
    startYear: Number.isFinite(s.cycle?.startYear) ? s.cycle.startYear : 412,
  });
  const filled = fillDefaults(s, defaults);
  return { state: s, filled };
}

/**
 * Upgrade `input` (any supported older version) to STATE_VERSION and backfill.
 * @returns {{ state, from: number, to: number, steps: number[], filled: string[] }}
 */
export function migrateState(input) {
  if (!isPlainObject(input)) throw new Error('Cannot migrate: save data is not an object.');
  let state = clone(input);
  const from = Number.isInteger(state.version) ? state.version : 1; // pre-versioned saves are v1
  if (from < 1) throw new Error(`Cannot migrate: unknown save version "${state.version}".`);
  if (from > STATE_VERSION) {
    throw new Error(
      `This save was made by a newer build (state v${from}); this build reads up to v${STATE_VERSION}.`,
    );
  }
  const steps = [];
  for (let v = from; v < STATE_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (typeof step !== 'function') throw new Error(`No migration from state v${v} to v${v + 1}.`);
    state = step(state);
    state.version = v + 1;
    steps.push(v);
  }
  state.version = STATE_VERSION;
  const { state: backfilled, filled } = backfillState(state);
  return { state: backfilled, from, to: STATE_VERSION, steps, filled };
}
