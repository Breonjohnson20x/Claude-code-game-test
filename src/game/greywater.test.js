import { describe, expect, it } from 'vitest';
import { dispatch } from './actions.js';
import { SCENARIOS } from './dev/scenarios.js';
import { createSaveSystem } from './save/saveSystem.js';
import { createMemoryStorage } from './save/storage.js';

describe('Greywater campaign outcome', () => {
  for (const outcome of ['released', 'held']) {
    it(`records ${outcome} exactly once`, () => {
      const state = SCENARIOS.resolution_t4_skirmish.build();
      const result = { won: true, outcome, deaths: 1, dispatches: [] };
      const first = dispatch(state, { type: 'GREYWATER_COMPLETE', result });
      expect(first.error).toBeNull();
      expect(first.io.commitDynasty).toBeUndefined();
      expect(first.state.chronicle.some((entry) => entry.title === 'The Greywater Front')).toBe(true);
      expect(first.state.memories.some((memory) => memory.eventId === `GREYWATER_${state.cycle.number}`)).toBe(true);
      expect(dispatch(first.state, { type: 'GREYWATER_COMPLETE', result }).error).toBeTruthy();
    });
  }
  it('rejects unfinished missions', () => {
    const state = SCENARIOS.resolution_t4_skirmish.build();
    expect(dispatch(state, { type: 'GREYWATER_COMPLETE', result: { won: false } }).state).toBe(state);
  });
  it('preserves a completed mission through an autosave and reload', () => {
    const state = SCENARIOS.resolution_t4_skirmish.build();
    const outcome = dispatch(state, { type: 'GREYWATER_COMPLETE', result: { won: true, outcome: 'held', deaths: 0, dispatches: [] } });
    const saves = createSaveSystem({ storage: createMemoryStorage() });
    expect(saves.autosave(outcome.state, outcome.io.autosave)).toBeTruthy();
    const loaded = saves.load('auto');
    expect(loaded.chronicle.some((entry) => entry.title === 'The Greywater Front')).toBe(true);
    expect(loaded.memories.some((memory) => memory.eventId === `GREYWATER_${state.cycle.number}`)).toBe(true);
    expect(dispatch(loaded, { type: 'GREYWATER_COMPLETE', result: { won: true, outcome: 'held', deaths: 0, dispatches: [] } }).error).toBeTruthy();
  });
});
