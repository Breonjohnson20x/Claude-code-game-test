// Save system (PERSIST) — Master Build §26 + Cycle doc §8.
//
// GameState is plain JSON, so a save is the whole state object plus a small summary for the
// slot picker. Slots: 'auto' + manual 1..3. The dynasty meta-record lives ABOVE the slots and
// is merged into every load, so loading an older reign never rolls back civilization memory or
// the dynasty chronicle ("Saves hold a reign. The meta record holds the dynasty.").
//
// Storage keys:  elvia.save.v1.auto · elvia.save.v1.slot1..3
//                elvia.dynasty.v1 (pointer: { current }) · elvia.dynasty.v1.<dynastyId> (meta)
// Saved record:  { formatVersion, savedAt, reason?, summary, state }
// Exported JSON: the record plus `dynasty` (that campaign's meta) so a dynasty can travel.

import { PHASES, STATE_VERSION, seasonLabel } from '../core/state.js';
import { migrateState } from './migrate.js';
import { commitCycle, mergeMetaIntoState, mergeMetas, normalizeMeta } from './dynasty.js';
import { AI_CACHE_KEY, DYNASTY_KEY, SAVE_PREFIX, normalizeStorage, readJson, safeRemove, writeJson } from './storage.js';

export const SAVE_FORMAT_VERSION = 1;
export const AUTO_SLOT = 'auto';
export const MANUAL_SLOTS = [1, 2, 3];
export const ALL_SLOTS = [AUTO_SLOT, ...MANUAL_SLOTS];
export const AUTOSAVE_REASONS = ['before_resolution', 'after_resolution', 'after_campfire', 'cycle_start', 'expedition'];

const PHASE_VALUES = Object.values(PHASES);

export class SaveError extends Error {
  /** code: 'invalid_slot'|'empty'|'corrupt'|'invalid'|'newer'|'quota'|'storage'|'serialize' */
  constructor(message, code, details) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function normalizeSlot(slot) {
  if (slot === AUTO_SLOT) return AUTO_SLOT;
  const n = typeof slot === 'string' ? Number(slot.replace(/^slot/, '')) : slot;
  if (MANUAL_SLOTS.includes(n)) return n;
  throw new SaveError(`Unknown save slot "${slot}". Use 'auto', 1, 2 or 3.`, 'invalid_slot');
}

export function slotKey(slot) {
  const s = normalizeSlot(slot);
  return s === AUTO_SLOT ? `${SAVE_PREFIX}auto` : `${SAVE_PREFIX}slot${s}`;
}

const metaKey = (dynastyId) => `${DYNASTY_KEY}.${dynastyId}`;

/**
 * Structural validation. `strict` (used after migration) also requires every current
 * top-level key with the right type. Returns { ok, errors[] } — never throws.
 */
export function validateStateShape(state, { strict = false } = {}) {
  const errors = [];
  if (!isPlainObject(state)) return { ok: false, errors: ['state is not an object'] };
  const need = (cond, msg) => {
    if (!cond) errors.push(msg);
  };
  if (state.version !== undefined || strict) need(Number.isInteger(state.version) && state.version >= 1, 'version must be a positive integer');
  need(typeof state.campaignId === 'string' && state.campaignId.length > 0, 'campaignId must be a non-empty string');
  need(isPlainObject(state.cycle), 'cycle must be an object');
  if (isPlainObject(state.cycle)) {
    need(Number.isInteger(state.cycle.number) && state.cycle.number >= 1, 'cycle.number must be a positive integer');
    need(isPlainObject(state.cycle.sovereign) && typeof state.cycle.sovereign.name === 'string', 'cycle.sovereign.name must be a string');
  }
  need(isNum(state.year), 'year must be a number');
  need(Number.isInteger(state.turn) && state.turn >= 1, 'turn must be a positive integer');
  need(isPlainObject(state.resources), 'resources must be an object');
  if (isPlainObject(state.resources)) {
    for (const [k, v] of Object.entries(state.resources)) need(isNum(v), `resources.${k} must be a number`);
  }
  for (const key of ['factions', 'characters']) {
    need(isPlainObject(state[key]), `${key} must be an object`);
    if (isPlainObject(state[key])) {
      for (const [id, v] of Object.entries(state[key])) need(isPlainObject(v), `${key}.${id} must be an object`);
    }
  }
  const objectKeys = ['flags', 'counters', 'threads', 'regions', 'campfire', 'trial'];
  const arrayKeys = ['memories', 'chronicle', 'decisions', 'voices', 'history'];
  for (const key of objectKeys) {
    if (state[key] !== undefined || strict) need(isPlainObject(state[key]), `${key} must be an object`);
  }
  for (const key of arrayKeys) {
    if (state[key] !== undefined || strict) need(Array.isArray(state[key]), `${key} must be an array`);
  }
  if (Array.isArray(state.chronicle)) {
    state.chronicle.forEach((e, i) => need(isPlainObject(e), `chronicle[${i}] must be an object`));
  }
  if (state.phase !== undefined || strict) need(PHASE_VALUES.includes(state.phase), `phase must be one of ${PHASE_VALUES.join(', ')}`);
  if (state.intensity !== undefined || strict) need(isNum(state.intensity), 'intensity must be a number');
  if (state.rngSeed !== undefined || strict) need(isNum(state.rngSeed), 'rngSeed must be a number');
  if (state.totalTurns !== undefined || strict) need(isNum(state.totalTurns), 'totalTurns must be a number');
  return { ok: errors.length === 0, errors };
}

/** Slot-picker summary. Tolerant of partial/older states. */
export function summarize(state) {
  const s = state?.cycle?.sovereign;
  const cycle = state?.cycle?.number ?? null;
  const turn = state?.turn ?? null;
  let season = null;
  try {
    if (Number.isInteger(turn) && isNum(state?.year)) season = seasonLabel(state);
  } catch {
    season = null;
  }
  const parts = [cycle != null ? `Cycle ${cycle}` : null, turn != null ? `Turn ${turn}` : null, season].filter(Boolean);
  return {
    cycle,
    turn,
    year: state?.year ?? null,
    sovereign: s ? `${s.name ?? ''} ${s.ordinal ?? ''}`.trim() : null,
    phase: state?.phase ?? null,
    regionState: state?.regions?.southern_marches?.state ?? null,
    chronicleCount: Array.isArray(state?.chronicle) ? state.chronicle.length : 0,
    label: parts.join(' · '),
  };
}

/**
 * Accept a saved record or a bare GameState. Returns { record } or { error, code }.
 * Only cheap structural checks — no migration.
 */
function parseRecord(value) {
  if (!isPlainObject(value)) return { error: 'Save data is not an object.', code: 'corrupt' };
  let record;
  if (isPlainObject(value.state) && value.formatVersion !== undefined) {
    record = value;
  } else if (typeof value.campaignId === 'string' && isPlainObject(value.cycle)) {
    record = { formatVersion: SAVE_FORMAT_VERSION, savedAt: null, summary: null, state: value };
  } else {
    return { error: 'Save data has no game state.', code: 'corrupt' };
  }
  if (!Number.isInteger(record.formatVersion) || record.formatVersion < 1) {
    return { error: 'Save record has an invalid formatVersion.', code: 'corrupt' };
  }
  if (record.formatVersion > SAVE_FORMAT_VERSION) {
    return { error: `Save format v${record.formatVersion} is newer than this build supports.`, code: 'newer' };
  }
  if (Number.isInteger(record.state.version) && record.state.version > STATE_VERSION) {
    return { error: `This save was made by a newer build (state v${record.state.version}).`, code: 'newer' };
  }
  const check = validateStateShape(record.state);
  if (!check.ok) return { error: `Save data is damaged: ${check.errors.slice(0, 4).join('; ')}.`, code: 'invalid', errors: check.errors };
  return { record };
}

/** parse → structural validation → migrate/backfill → strict validation. Throws SaveError. */
function prepareState(rawState) {
  let migrated;
  try {
    migrated = migrateState(rawState).state;
  } catch (err) {
    throw new SaveError(err.message, 'newer');
  }
  const check = validateStateShape(migrated, { strict: true });
  if (!check.ok) {
    throw new SaveError(`Save data is damaged: ${check.errors.slice(0, 4).join('; ')}.`, 'invalid', check.errors);
  }
  return migrated;
}

/**
 * @param {{ storage?: object, now?: () => string }} [options]
 *   storage: adapter ({getItem,setItem,removeItem,keys?}); default localStorage or memory.
 *   now: ISO timestamp source (default new Date().toISOString()) — injectable for tests.
 */
export function createSaveSystem({ storage, now } = {}) {
  const store = normalizeStorage(storage);
  const clock = typeof now === 'function' ? now : () => new Date().toISOString();
  let lastError = null;

  function write(key, value) {
    let res = writeJson(store, key, value);
    if (!res.ok && res.code === 'quota') {
      // The AI generation cache is disposable; free it before giving up on a save.
      safeRemove(store, AI_CACHE_KEY);
      res = writeJson(store, key, value);
    }
    if (!res.ok) {
      const msg = res.code === 'quota' ? 'Could not save: browser storage is full.' : `Could not save: ${res.error}.`;
      throw new SaveError(msg, res.code);
    }
    return res;
  }

  function readRecord(slot) {
    const key = slotKey(slot);
    const res = readJson(store, key);
    if (res.status === 'missing') return { empty: true };
    if (res.status !== 'ok') return { error: res.error, code: res.status === 'corrupt' ? 'corrupt' : 'storage' };
    return parseRecord(res.value);
  }

  function readMeta(dynastyId) {
    if (!dynastyId) return null;
    const res = readJson(store, metaKey(dynastyId));
    if (res.status !== 'ok') return null;
    const meta = normalizeMeta(res.value);
    return meta && meta.dynastyId === dynastyId ? meta : null;
  }

  function writeMeta(meta) {
    const existing = readJson(store, metaKey(meta.dynastyId));
    if (existing.status === 'corrupt') {
      // Keep the damaged copy rather than silently destroying a dynasty record.
      try {
        store.setItem(`${metaKey(meta.dynastyId)}.corrupt`, existing.raw);
      } catch {
        // best effort
      }
    }
    write(metaKey(meta.dynastyId), meta);
    write(DYNASTY_KEY, { formatVersion: 1, current: meta.dynastyId });
  }

  function makeRecord(state, { savedAt, reason } = {}) {
    const check = validateStateShape(state, { strict: true });
    if (!check.ok) throw new SaveError(`Refusing to save an invalid state: ${check.errors.slice(0, 4).join('; ')}.`, 'invalid', check.errors);
    const record = {
      formatVersion: SAVE_FORMAT_VERSION,
      savedAt: typeof savedAt === 'string' ? savedAt : clock(),
      summary: summarize(state),
      state,
    };
    if (reason) record.reason = reason;
    return record;
  }

  const api = {
    /** [{ slot, summary|null, savedAt?, reason?, corrupt?: true, error? }] for 'auto', 1, 2, 3. Never throws. */
    listSlots() {
      return ALL_SLOTS.map((slot) => {
        let res;
        try {
          res = readRecord(slot);
        } catch (err) {
          return { slot, summary: null, corrupt: true, error: err.message };
        }
        if (res.empty) return { slot, summary: null };
        if (res.error) return { slot, summary: null, corrupt: true, error: res.error };
        const { record } = res;
        let summary;
        try {
          summary = summarize(record.state);
        } catch {
          summary = isPlainObject(record.summary) ? record.summary : null;
        }
        const out = { slot, summary, savedAt: record.savedAt ?? null };
        if (record.reason) out.reason = record.reason;
        return out;
      });
    },

    /** Write a slot (manual 1..3; 'auto' accepted). Throws SaveError on failure. */
    save(slot, state, options = {}) {
      const key = slotKey(slot);
      const record = makeRecord(state, options);
      write(key, record);
      lastError = null;
      return record.summary;
    },

    /** Write the 'auto' slot. Never throws: returns the summary, or null (see getLastError()). */
    autosave(state, reason = 'autosave', options = {}) {
      try {
        const record = makeRecord(state, { ...options, reason });
        write(slotKey(AUTO_SLOT), record);
        lastError = null;
        return record.summary;
      } catch (err) {
        lastError = err;
        return null;
      }
    },

    /** Validated + migrated + merged with dynasty meta. Throws SaveError (code empty|corrupt|invalid|newer). */
    load(slot) {
      const res = readRecord(slot);
      if (res.empty) throw new SaveError(`Save slot ${normalizeSlot(slot)} is empty.`, 'empty');
      if (res.error) throw new SaveError(res.error, res.code, res.errors);
      const state = prepareState(res.record.state);
      return mergeMetaIntoState(state, readMeta(state.campaignId));
    },

    remove(slot) {
      safeRemove(store, slotKey(slot));
    },

    hasAnySave() {
      return api.listSlots().some((s) => s.summary && !s.corrupt);
    },

    /** Dynasty meta for a dynastyId (or a state's campaignId); defaults to the last committed dynasty. */
    loadMeta(dynastyIdOrState) {
      let id = typeof dynastyIdOrState === 'string' ? dynastyIdOrState : dynastyIdOrState?.campaignId;
      if (!id) {
        const ptr = readJson(store, DYNASTY_KEY);
        id = ptr.status === 'ok' && typeof ptr.value?.current === 'string' ? ptr.value.current : null;
      }
      return readMeta(id);
    },

    /**
     * Called at the Passing. Folds the completed cycle into the dynasty meta (idempotent per
     * cycle number). `options.cycle` names the cycle explicitly; otherwise it is inferred (see
     * dynasty.resolveCommitCycle). Returns the new meta. Throws SaveError if storage fails.
     */
    commitDynasty(state, options = {}) {
      const check = validateStateShape(state);
      if (!check.ok) throw new SaveError(`Cannot commit dynasty: ${check.errors.slice(0, 4).join('; ')}.`, 'invalid', check.errors);
      const { meta } = commitCycle(readMeta(state.campaignId), state, { cycle: options.cycle, now: clock() });
      writeMeta(meta);
      return meta;
    },

    /** The slot's record as JSON (plus its dynasty meta). Throws SaveError if empty/corrupt. */
    exportSave(slot) {
      const res = readRecord(slot);
      if (res.empty) throw new SaveError(`Save slot ${normalizeSlot(slot)} is empty.`, 'empty');
      if (res.error) throw new SaveError(res.error, res.code, res.errors);
      const out = { ...res.record };
      const meta = readMeta(res.record.state.campaignId);
      if (meta) out.dynasty = meta;
      return JSON.stringify(out);
    },

    /** Validate and store exported JSON (record or bare state) into a slot. Returns the summary. */
    importSave(slot, json) {
      const key = slotKey(slot);
      let parsed;
      try {
        parsed = typeof json === 'string' ? JSON.parse(json) : json;
      } catch {
        throw new SaveError('That is not a save file (invalid JSON).', 'corrupt');
      }
      const res = parseRecord(parsed);
      if (res.error) throw new SaveError(res.error, res.code, res.errors);
      const state = prepareState(res.record.state);
      const record = makeRecord(state, {
        savedAt: typeof res.record.savedAt === 'string' ? res.record.savedAt : undefined,
        reason: 'import',
      });
      write(key, record);
      const importedMeta = normalizeMeta(parsed?.dynasty);
      if (importedMeta && importedMeta.dynastyId === state.campaignId) {
        writeMeta(mergeMetas(readMeta(state.campaignId), importedMeta));
      }
      return record.summary;
    },

    /** Last autosave failure (SaveError) or null. */
    getLastError() {
      return lastError;
    },
  };
  return api;
}
