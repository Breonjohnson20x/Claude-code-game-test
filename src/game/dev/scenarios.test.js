import { describe, it, expect } from 'vitest';
import { SCENARIOS, buildScenario } from './scenarios.js';
import { getView } from '../actions.js';
import { validateStateShape } from '../save/saveSystem.js';

const EXPECT_PHASE = {
  war_room_t1: 'war_room',
  resolution_t1: 'resolution',
  march_road: 'expedition',
  march_checkpoint: 'expedition',
  march_checkpoint_scout: 'expedition',
  march_wilds: 'expedition',
  march_ruin: 'expedition',
  march_champion: 'expedition',
  duel_pending: 'expedition',
  champion_defeated: 'expedition',
  campfire: 'campfire',
  war_room_t3: 'war_room',
  resolution_t4_skirmish: 'resolution',
  resolution_t5_skaela: 'resolution',
  passing_campfire: 'passing',
  passing_chronicle: 'passing',
  passing_legacies: 'passing',
  cycle2_war_room: 'war_room',
};

describe('dev scenarios (UI preview fixtures)', () => {
  for (const name of Object.keys(SCENARIOS)) {
    it(`${name} reaches ${EXPECT_PHASE[name]} through the real controller`, () => {
      const s = buildScenario(name);
      expect(s.phase).toBe(EXPECT_PHASE[name]);
      expect(validateStateShape(s).ok).toBe(true);
      expect(() => getView(s)).not.toThrow();
    });
  }
  it('beats and offers are where the previews expect them', () => {
    expect(getView(buildScenario('march_checkpoint')).beat.id).toBe('checkpoint');
    expect(buildScenario('march_checkpoint_scout').expedition.phase).toBe('after_victory');
    expect(buildScenario('resolution_t5_skaela').flags.skaela_spoke).toBe(true);
    expect(getView(buildScenario('march_champion')).beat.id).toBe('champion');
    expect(buildScenario('duel_pending').expedition.pendingDuel.archetypeId).toBe('blade_adept');
    expect(buildScenario('champion_defeated').expedition.phase).toBe('after_defeat');
    expect(getView(buildScenario('resolution_t4_skirmish')).deployments.map((d) => d.kind)).toContain('skirmish');
    expect(buildScenario('passing_legacies').passing.step).toBe('legacies');
    expect(buildScenario('cycle2_war_room').cycle.number).toBe(2);
  });
});
