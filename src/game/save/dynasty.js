// Dynasty meta-record (Cycle doc §8 "Save rule"): "Saves hold a reign. The meta record holds
// the dynasty. Loading an old save replays choices — it does not un-remember the world."
//
// Pure functions only; saveSystem.js does the storage. The meta lives ABOVE save slots:
//   { formatVersion, dynastyId, cyclesCompleted, committedCycles[], chronicle[],
//     civilization{ [factionId]: { liberator, conqueror, oathbreaker, peacemaker } },
//     cycles[ {cycle, sovereign, startYear, endYear, cause, legacies[], highlights[]} ],
//     legaciesTaken[], updatedAt }
// Every merge is monotonic: chronicle is a union, civilization memory is a per-key MAX,
// cycle summaries are first-commit-wins. Nothing a later reign earned can be rolled back.

import { CIV_MEMORY_KEYS, PHASES } from '../core/state.js';

export const DYNASTY_FORMAT_VERSION = 1;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function num(v, d = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

export function createEmptyMeta(dynastyId) {
  return {
    formatVersion: DYNASTY_FORMAT_VERSION,
    dynastyId,
    cyclesCompleted: 0,
    committedCycles: [],
    chronicle: [],
    civilization: {},
    cycles: [],
    legaciesTaken: [],
    updatedAt: null,
  };
}

/** Coerce stored data into a meta record, or null if it is not one. Never throws. */
export function normalizeMeta(raw) {
  if (!isPlainObject(raw) || typeof raw.dynastyId !== 'string' || !raw.dynastyId) return null;
  const meta = createEmptyMeta(raw.dynastyId);
  meta.formatVersion = num(raw.formatVersion, DYNASTY_FORMAT_VERSION);
  meta.committedCycles = Array.isArray(raw.committedCycles)
    ? [...new Set(raw.committedCycles.filter((n) => Number.isInteger(n)))].sort((a, b) => a - b)
    : [];
  meta.cyclesCompleted = Math.max(num(raw.cyclesCompleted), meta.committedCycles.length);
  meta.chronicle = Array.isArray(raw.chronicle) ? raw.chronicle.filter((e) => isPlainObject(e) && e.id != null) : [];
  meta.civilization = {};
  if (isPlainObject(raw.civilization)) {
    for (const [fid, mem] of Object.entries(raw.civilization)) {
      if (isPlainObject(mem)) meta.civilization[fid] = maxMemory({}, mem);
    }
  }
  meta.cycles = Array.isArray(raw.cycles) ? raw.cycles.filter((c) => isPlainObject(c) && Number.isInteger(c.cycle)) : [];
  meta.legaciesTaken = Array.isArray(raw.legaciesTaken) ? raw.legaciesTaken : [];
  meta.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  return meta;
}

/** Per-key MAX of two civilization-memory objects (only finite numbers count). */
export function maxMemory(a = {}, b = {}) {
  const out = {};
  const keys = new Set([...CIV_MEMORY_KEYS, ...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const va = a?.[k];
    const vb = b?.[k];
    const ok = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!ok(va) && !ok(vb)) continue;
    out[k] = Math.max(ok(va) ? va : -Infinity, ok(vb) ? vb : -Infinity);
  }
  return out;
}

function mergeEntry(primary, secondary) {
  // primary = the dynasty's copy; an approval recorded anywhere is never undone.
  return { ...secondary, ...primary, approved: Boolean(primary?.approved || secondary?.approved) };
}

/**
 * Union of chronicle lists, deduped by id (first list wins on conflicts), sorted by
 * cycle, then turn, then original order (first list before second).
 */
export function unionChronicle(primary = [], secondary = [], defaultCycle = Infinity) {
  const byId = new Map();
  let order = 0;
  for (const list of [primary, secondary]) {
    for (const e of list ?? []) {
      if (!isPlainObject(e) || e.id == null) continue;
      const prev = byId.get(e.id);
      if (prev) prev.entry = mergeEntry(prev.entry, e);
      else byId.set(e.id, { entry: { ...e }, order: order++ });
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const ca = num(a.entry.cycle, defaultCycle);
      const cb = num(b.entry.cycle, defaultCycle);
      if (ca !== cb) return ca - cb;
      const ta = num(a.entry.turn, 0);
      const tb = num(b.entry.turn, 0);
      if (ta !== tb) return ta - tb;
      return a.order - b.order;
    })
    .map((x) => x.entry);
}

/** Union of cycle summaries by cycle number; `primary` wins; sorted by cycle. */
export function unionCycles(primary = [], secondary = []) {
  const byCycle = new Map();
  const loose = [];
  for (const list of [primary, secondary]) {
    for (const c of list ?? []) {
      if (!isPlainObject(c)) continue;
      if (!Number.isInteger(c.cycle)) {
        loose.push(c);
        continue;
      }
      if (!byCycle.has(c.cycle)) byCycle.set(c.cycle, { ...c });
    }
  }
  return [...[...byCycle.values()].sort((a, b) => a.cycle - b.cycle), ...loose];
}

function legacyKey(x) {
  if (typeof x === 'string') return x;
  if (isPlainObject(x) && x.id != null) return `id:${x.id}`;
  return JSON.stringify(x);
}

function unionLegacies(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    const k = legacyKey(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function sovereignString(state) {
  const s = state?.cycle?.sovereign;
  return s ? `${s.name} ${s.ordinal}`.trim() : 'Unknown Sovereign';
}

/**
 * Which cycle is being committed. Explicit `cycle` wins. During the Passing the state is still
 * in the completing cycle; after the lead has advanced to the next cycle, the last history
 * entry names the one that just ended.
 */
export function resolveCommitCycle(state, explicit) {
  if (Number.isInteger(explicit)) return explicit;
  const history = Array.isArray(state.history) ? state.history : [];
  const last = history[history.length - 1];
  if (state.phase === PHASES.PASSING) return state.cycle.number;
  if (last && Number.isInteger(last.cycle) && last.cycle < state.cycle.number) return last.cycle;
  return state.cycle.number;
}

/** Cycle summary for `cycleNumber` from state.history, else synthesized from the live state. */
export function cycleSummaryFrom(state, cycleNumber) {
  const history = Array.isArray(state.history) ? state.history : [];
  const entry = [...history].reverse().find((h) => isPlainObject(h) && h.cycle === cycleNumber);
  if (!entry && cycleNumber !== state.cycle.number) return null;
  const own = (state.chronicle ?? []).filter((e) => num(e.cycle, cycleNumber) === cycleNumber);
  const highlights = own
    .slice()
    .sort((a, b) => Number(Boolean(b.approved)) - Number(Boolean(a.approved)))
    .slice(0, 5)
    .map((e) => e.title)
    .filter(Boolean);
  const base = {
    cycle: cycleNumber,
    sovereign: sovereignString(state),
    startYear: state.cycle.startYear ?? null,
    endYear: state.year ?? null,
    cause: state.cycle.cause ?? null,
    legacies: [...(state.cycle.activeLegacies ?? [])],
    highlights,
  };
  if (!entry) return base;
  const merged = { ...base, ...clone(entry), cycle: cycleNumber };
  if (!Array.isArray(merged.legacies)) merged.legacies = Array.isArray(entry.legaciesTaken) ? [...entry.legaciesTaken] : base.legacies;
  if (!Array.isArray(merged.highlights)) merged.highlights = base.highlights;
  return merged;
}

/**
 * Fold a completed cycle into the meta. Idempotent per cycle number: committing the same
 * cycle twice never double-counts cyclesCompleted, and every merge is monotonic.
 * @returns {{ meta, cycle: number, alreadyCommitted: boolean, addedChronicle: number }}
 */
export function commitCycle(prevMeta, state, { cycle, now } = {}) {
  const meta = prevMeta && prevMeta.dynastyId === state.campaignId ? clone(prevMeta) : createEmptyMeta(state.campaignId);
  const cycleNumber = resolveCommitCycle(state, cycle);

  const eligible = (state.chronicle ?? []).filter((e) => num(e.cycle, cycleNumber) <= cycleNumber);
  const before = new Set(meta.chronicle.map((e) => e.id));
  meta.chronicle = unionChronicle(meta.chronicle, eligible);
  const addedChronicle = meta.chronicle.filter((e) => !before.has(e.id)).length;

  for (const [fid, faction] of Object.entries(state.factions ?? {})) {
    meta.civilization[fid] = maxMemory(meta.civilization[fid], faction?.memory);
  }

  const summary = cycleSummaryFrom(state, cycleNumber);
  if (summary) {
    meta.cycles = unionCycles(meta.cycles, [summary]);
    meta.legaciesTaken = unionLegacies(meta.legaciesTaken, summary.legacies);
  }
  // Older reigns' summaries the state carries (e.g. imported saves) are folded in too.
  meta.cycles = unionCycles(
    meta.cycles,
    (state.history ?? []).filter((h) => isPlainObject(h) && Number.isInteger(h.cycle) && h.cycle <= cycleNumber),
  );

  const alreadyCommitted = meta.committedCycles.includes(cycleNumber);
  if (!alreadyCommitted) {
    meta.committedCycles = [...meta.committedCycles, cycleNumber].sort((a, b) => a - b);
    meta.cyclesCompleted = Math.max(meta.cyclesCompleted + 1, meta.committedCycles.length);
  }
  meta.updatedAt = now ?? meta.updatedAt;
  return { meta, cycle: cycleNumber, alreadyCommitted, addedChronicle };
}

/**
 * Apply the dynasty meta to a loaded reign save. Only merges when the meta belongs to the
 * save's dynasty (meta.dynastyId === state.campaignId); otherwise returns the state unchanged.
 */
export function mergeMetaIntoState(state, meta) {
  if (!meta || meta.dynastyId !== state.campaignId) return state;
  const s = clone(state);
  s.chronicle = unionChronicle(meta.chronicle, s.chronicle, s.cycle?.number ?? Infinity);
  for (const [fid, faction] of Object.entries(s.factions ?? {})) {
    const civ = meta.civilization?.[fid];
    if (civ && isPlainObject(faction)) faction.memory = { ...faction.memory, ...maxMemory(faction.memory, civ) };
  }
  s.history = unionCycles(meta.cycles, s.history);
  return s;
}

/** Monotonic union of two metas of the same dynasty (used when importing a save + its meta). */
export function mergeMetas(a, b) {
  if (!a) return b ? clone(b) : null;
  if (!b || a.dynastyId !== b.dynastyId) return clone(a);
  const out = clone(a);
  out.chronicle = unionChronicle(a.chronicle, b.chronicle);
  for (const fid of new Set([...Object.keys(a.civilization ?? {}), ...Object.keys(b.civilization ?? {})])) {
    out.civilization[fid] = maxMemory(a.civilization?.[fid], b.civilization?.[fid]);
  }
  out.cycles = unionCycles(a.cycles, b.cycles);
  out.legaciesTaken = unionLegacies(a.legaciesTaken, b.legaciesTaken);
  out.committedCycles = [...new Set([...(a.committedCycles ?? []), ...(b.committedCycles ?? [])])].sort((x, y) => x - y);
  out.cyclesCompleted = Math.max(num(a.cyclesCompleted), num(b.cyclesCompleted), out.committedCycles.length);
  return out;
}
