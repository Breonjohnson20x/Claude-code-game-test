import { describe, it, expect } from 'vitest';
import { createNewGame, STATE_VERSION } from '../core/state.js';
import { commitEffects } from '../core/effects.js';
import { createSaveSystem, SaveError } from './saveSystem.js';
import { createMemoryStorage, AI_CACHE_KEY } from './storage.js';
import { migrateState, MIGRATIONS } from './migrate.js';

const T0 = '2026-10-24T08:00:00.000Z';

function apply(state, effects) {
  const { state: next, report } = commitEffects(state, effects);
  expect(report.rejected).toEqual([]);
  return next;
}

function chronicle(title) {
  return { type: 'chronicle', title, text: `${title} — as the clerks wrote it.`, kind: 'event' };
}

function newSystem(storage = createMemoryStorage()) {
  let tick = 0;
  return { storage, saves: createSaveSystem({ storage, now: () => new Date(Date.parse(T0) + 1000 * tick++).toISOString() }) };
}

function midGame() {
  let s = createNewGame({ seed: 7 });
  s = apply(s, [
    chronicle('Walkers at Greywater Ford'),
    { type: 'faction', faction: 'iron_syndicate', memory: { peacemaker: 6 }, tension: 5 },
    { type: 'relationship', character: 'mara', trust: 4 },
    { type: 'memory', character: 'mara', eventId: 'HELD_THE_FORD', description: 'The Sovereign held the ford without a massacre.' },
  ]);
  return { ...s, turn: 2, totalTurns: 1 };
}

describe('save system: slots', () => {
  it('round-trips a state exactly', () => {
    const { saves } = newSystem();
    const state = midGame();
    const summary = saves.save(1, state);
    expect(summary).toMatchObject({ cycle: 1, turn: 2, year: 412, sovereign: 'Aurelian I', phase: 'war_room', regionState: 'STABLE', chronicleCount: 1 });
    expect(summary.label).toMatch(/^Cycle 1 · Turn 2 · \w+ 412 E\.R\.$/);
    expect(saves.load(1)).toEqual(state);
    expect(saves.load('slot1')).toEqual(state);
  });

  it('keeps three manual slots and the autosave independent', () => {
    const { saves } = newSystem();
    const states = [1, 2, 3, 4].map((turn) => ({ ...createNewGame({ seed: 3 }), turn }));
    saves.save(1, states[0]);
    saves.save(2, states[1]);
    saves.save(3, states[2]);
    expect(saves.autosave(states[3], 'after_campfire')).toMatchObject({ turn: 4 });
    expect(saves.load(1).turn).toBe(1);
    expect(saves.load(2).turn).toBe(2);
    expect(saves.load(3).turn).toBe(3);
    expect(saves.load('auto').turn).toBe(4);
    saves.remove(2);
    const slots = saves.listSlots();
    expect(slots.map((s) => s.slot)).toEqual(['auto', 1, 2, 3]);
    expect(slots[0]).toMatchObject({ reason: 'after_campfire', summary: { turn: 4 } });
    expect(slots[2]).toEqual({ slot: 2, summary: null });
    expect(saves.load(3).turn).toBe(3);
    expect(saves.hasAnySave()).toBe(true);
    expect(() => saves.load(2)).toThrow(SaveError);
    expect(() => saves.save(4, states[0])).toThrow(/Unknown save slot/);
  });

  it('reports corrupt slots without throwing, and load rejects them clearly', () => {
    const { saves, storage } = newSystem();
    saves.save(1, midGame());
    storage.setItem('elvia.save.v1.slot2', '{"formatVersion":1,"state":');
    storage.setItem('elvia.save.v1.slot3', JSON.stringify({ hello: 'world' }));
    storage.setItem('elvia.save.v1.auto', JSON.stringify({ formatVersion: 1, savedAt: T0, state: { ...midGame(), turn: 'soon', resources: null } }));
    const slots = saves.listSlots();
    expect(slots[1]).toMatchObject({ slot: 1, summary: { turn: 2 } });
    for (const s of [slots[0], slots[2], slots[3]]) {
      expect(s.summary).toBeNull();
      expect(s.corrupt).toBe(true);
      expect(typeof s.error).toBe('string');
    }
    expect(saves.hasAnySave()).toBe(true);
    const err = (() => {
      try {
        saves.load(2);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(SaveError);
    expect(err.code).toBe('corrupt');
    expect(() => saves.load(3)).toThrow(/no game state/);
    expect(() => saves.load('auto')).toThrow(/turn must be a positive integer/);
  });

  it('autosave never throws; a bad state yields null and lastError', () => {
    const { saves } = newSystem();
    expect(saves.autosave({ nope: true }, 'before_resolution')).toBeNull();
    expect(saves.getLastError()).toBeInstanceOf(SaveError);
    expect(saves.listSlots()[0].summary).toBeNull();
  });

  it('frees the disposable AI cache when storage is full, and surfaces quota errors', () => {
    const base = createMemoryStorage();
    let budget = 52_000;
    const storage = {
      ...base,
      setItem(k, v) {
        const used = base.keys().filter((key) => key !== k).reduce((n, key) => n + base.getItem(key).length, 0);
        if (used + String(v).length > budget) {
          const e = new Error('full');
          e.name = 'QuotaExceededError';
          throw e;
        }
        base.setItem(k, v);
      },
    };
    const { saves } = newSystem(storage);
    base.setItem(AI_CACHE_KEY, 'x'.repeat(50_000));
    expect(saves.save(1, midGame())).toMatchObject({ turn: 2 });
    expect(base.getItem(AI_CACHE_KEY) === null).toBe(true);
    budget = 100;
    try {
      saves.save(2, midGame());
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SaveError);
      expect(e.code).toBe('quota');
    }
    expect(saves.autosave(midGame(), 'after_resolution')).toBeNull();
    expect(saves.getLastError().code).toBe('quota');
  });
});

describe('save system: migration', () => {
  it('backfills keys an older save lacks without touching existing values', () => {
    const { saves, storage } = newSystem();
    const old = midGame();
    delete old.voices;
    delete old.campfire;
    delete old.history;
    delete old.version;
    delete old.counters.duelsWon;
    delete old.factions.frost_wargs.memory.peacemaker;
    delete old.characters.nyra;
    old.resources.treasury = 333;
    storage.setItem('elvia.save.v1.slot1', JSON.stringify({ formatVersion: 1, savedAt: T0, state: old }));
    const loaded = saves.load(1);
    expect(loaded.version).toBe(STATE_VERSION);
    expect(loaded.voices).toEqual([]);
    expect(loaded.history).toEqual([]);
    expect(loaded.campfire).toEqual({ cooldown: 0, history: [], offer: null });
    expect(loaded.counters.duelsWon).toBe(0);
    expect(loaded.factions.frost_wargs.memory.peacemaker).toBe(0);
    expect(loaded.characters.nyra.status).toBe('unmet');
    expect(loaded.resources.treasury).toBe(333);
    expect(loaded.chronicle).toEqual(old.chronicle);
    expect(loaded.factions.iron_syndicate.memory.peacemaker).toBe(6);
  });

  it('rejects saves from a newer build and exposes a migrations table', () => {
    expect(typeof MIGRATIONS).toBe('object');
    expect(() => migrateState({ ...createNewGame(), version: STATE_VERSION + 1 })).toThrow(/newer build/);
    const { saves, storage } = newSystem();
    storage.setItem('elvia.save.v1.slot1', JSON.stringify({ formatVersion: 1, state: { ...createNewGame(), version: 99 } }));
    expect(saves.listSlots()[1]).toMatchObject({ corrupt: true });
    expect(() => saves.load(1)).toThrow(/newer build/);
  });

  it('accepts a bare GameState (no record wrapper) on import', () => {
    const { saves } = newSystem();
    const state = midGame();
    expect(saves.importSave(2, JSON.stringify(state))).toMatchObject({ turn: 2, chronicleCount: 1 });
    expect(saves.load(2)).toEqual(state);
  });
});

describe('save system: dynasty meta (Cycle doc §8)', () => {
  // Build: cycle 1 turn 2 (saved to slot 1) → end of cycle 1 (commit) → cycle 2 (commit).
  function playDynasty(saves) {
    const early = midGame();
    saves.save(1, early);

    let s = apply({ ...early, turn: 5, totalTurns: 4 }, [
      chronicle('The Ward Lattice Holds'),
      { type: 'faction', faction: 'iron_syndicate', memory: { liberator: 30 } },
      { type: 'faction', faction: 'frost_wargs', memory: { peacemaker: 12 } },
    ]);
    s = { ...s, phase: 'passing', cycle: { ...s.cycle, cause: 'abdication' } };
    const meta1 = saves.commitDynasty(s);
    expect(meta1).toMatchObject({ dynastyId: early.campaignId, cyclesCompleted: 1, committedCycles: [1] });

    // The lead advances to cycle 2 and records the cycle-1 summary in history.
    s = {
      ...s,
      phase: 'war_room',
      turn: 1,
      year: 413,
      cycle: { number: 2, sovereign: { name: 'Seren', ordinal: 'II', title: 'God-Queen of Elvia' }, startYear: 413, activeLegacies: ['aegis_mastery'], cause: null },
      history: [{ cycle: 1, sovereign: 'Aurelian I', startYear: 412, endYear: 412, cause: 'abdication', legacies: ['aegis_mastery'], highlights: ['The Ward Lattice Holds'] }],
    };
    s = apply(s, [
      chronicle('Seren II Burns the Depot'),
      { type: 'faction', faction: 'iron_syndicate', memory: { conqueror: 25, liberator: -20 } },
    ]);
    s = { ...s, phase: 'passing', cycle: { ...s.cycle, cause: 'fell_in_battle' } };
    const meta2 = saves.commitDynasty(s);
    return { early, cycle2End: s, meta2 };
  }

  it('loading an older cycle-1 save does not roll back civilization memory or the dynasty chronicle', () => {
    const { saves } = newSystem();
    const { early, cycle2End, meta2 } = playDynasty(saves);
    expect(meta2.cyclesCompleted).toBe(2);
    expect(meta2.civilization.iron_syndicate).toMatchObject({ liberator: 30, conqueror: 25, peacemaker: 6 });
    expect(meta2.cycles.map((c) => c.cycle)).toEqual([1, 2]);
    expect(meta2.legaciesTaken).toContain('aegis_mastery');

    const loaded = saves.load(1);
    // The reign rolls back…
    expect(loaded.cycle.number).toBe(1);
    expect(loaded.turn).toBe(2);
    expect(loaded.resources).toEqual(early.resources);
    // …the world does not forget.
    const titles = loaded.chronicle.map((e) => e.title);
    expect(titles).toEqual(['Walkers at Greywater Ford', 'The Ward Lattice Holds', 'Seren II Burns the Depot']);
    expect(loaded.factions.iron_syndicate.memory).toMatchObject({ liberator: 30, conqueror: 25, peacemaker: 6 });
    expect(loaded.factions.frost_wargs.memory.peacemaker).toBe(12);
    expect(loaded.history.map((h) => h.cycle)).toEqual([1, 2]);
    // Earned-later state in the live reign is the max, not the latest value (liberator fell to 10 in cycle 2).
    expect(cycle2End.factions.iron_syndicate.memory.liberator).toBe(10);
  });

  it('commitDynasty is idempotent per cycle number', () => {
    const { saves } = newSystem();
    const { cycle2End, meta2 } = playDynasty(saves);
    const again = saves.commitDynasty(cycle2End);
    expect(again.cyclesCompleted).toBe(2);
    expect(again.committedCycles).toEqual([1, 2]);
    expect(again.chronicle).toHaveLength(meta2.chronicle.length);
    expect(again.cycles).toHaveLength(2);
    expect(saves.loadMeta()).toEqual(again);
    expect(saves.loadMeta(cycle2End.campaignId)).toEqual(again);
    expect(saves.loadMeta(cycle2End)).toEqual(again);
  });

  it('infers the completed cycle after the lead has already advanced to the next one', () => {
    const { saves } = newSystem();
    let s = apply(createNewGame({ seed: 11 }), [chronicle('First Winter')]);
    s = {
      ...s,
      phase: 'war_room',
      cycle: { ...s.cycle, number: 2 },
      history: [{ cycle: 1, sovereign: 'Aurelian I', legacies: ['warg_truce'] }],
    };
    const meta = saves.commitDynasty(s);
    expect(meta.committedCycles).toEqual([1]);
    expect(meta.chronicle.map((e) => e.title)).toEqual(['First Winter']);
    expect(meta.cycles[0]).toMatchObject({ cycle: 1, sovereign: 'Aurelian I', legacies: ['warg_truce'] });
    expect(saves.commitDynasty(s, { cycle: 1 }).cyclesCompleted).toBe(1);
  });

  it('only merges meta of the same dynasty', () => {
    const { saves } = newSystem();
    playDynasty(saves);
    const other = createNewGame({ seed: 99 });
    saves.save(2, other);
    expect(saves.load(2)).toEqual(other);
    expect(saves.loadMeta(other)).toBeNull();
  });

  it('export/import round-trips a slot and carries the dynasty to a fresh browser', () => {
    const a = newSystem();
    const { meta2 } = playDynasty(a.saves);
    const json = a.saves.exportSave(1);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({ formatVersion: 1, summary: { turn: 2 } });
    expect(parsed.dynasty.dynastyId).toBe(meta2.dynastyId);

    const summary = a.saves.importSave(3, json);
    expect(summary).toMatchObject({ turn: 2, cycle: 1 });
    expect(a.saves.load(3)).toEqual(a.saves.load(1));

    const b = newSystem();
    b.saves.importSave(1, json);
    expect(b.saves.loadMeta(meta2.dynastyId)).toMatchObject({ cyclesCompleted: 2, committedCycles: [1, 2] });
    expect(b.saves.load(1)).toEqual(a.saves.load(1));

    expect(() => b.saves.importSave(2, 'not json at all')).toThrow(SaveError);
    expect(() => b.saves.importSave(2, JSON.stringify({ formatVersion: 1, state: { campaignId: 'x' } }))).toThrow(/no game state|damaged/);
    expect(() => b.saves.exportSave(2)).toThrow(/empty/);
  });
});
