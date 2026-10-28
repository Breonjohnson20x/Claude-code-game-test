import { describe, expect, it } from 'vitest';
import { DRILLS, drillConfig, SPARRING, sparringConfig } from './drills.js';
import { createOracleBot, createGuardSpamBot, simulateDuel } from './bots.js';
import { createDuel, getDuelResult, drillProgress } from './engine.js';

describe('training yard drills', () => {
  it.each(DRILLS.map((d) => d.id))('%s: a player who reads the glow passes', (id) => {
    const { duel } = simulateDuel(drillConfig(id, 7), createOracleBot({ mode: id === 'red_gold' ? 'dodge' : 'parry', royal: false }), { maxMs: 120000 });
    const result = getDuelResult(duel);
    expect(result.outcome).toBe('victory');
    expect(result.drill.met).toBe(true);
    expect(result.drill.value).toBe(result.drill.target);
  });

  it.each(DRILLS.map((d) => d.id))('%s: standing idle does not pass', (id) => {
    const { duel } = simulateDuel(drillConfig(id, 7), null, { maxMs: 120000 });
    expect(drillProgress(duel).met).toBe(false);
    expect(duel.outcome).not.toBe('victory');
  });

  // Holding guard is a fair answer to steel light, but not to heavies or feints.
  it.each(['red_gold', 'flicker'])('%s: holding guard into everything does not pass', (id) => {
    const { duel } = simulateDuel(drillConfig(id, 7), createGuardSpamBot(), { maxMs: 120000 });
    expect(drillProgress(duel).met).toBe(false);
    expect(duel.outcome).not.toBe('victory');
  });

  it('opens with the coach, uses the yard partner, and is deterministic', () => {
    const a = createDuel(drillConfig('flicker', 3));
    expect(a.def.name).toBe('Sword-Master Ilvane');
    expect(a.events.find((e) => e.type === 'line')).toMatchObject({ speaker: 'mara' });
    const run = () => getDuelResult(simulateDuel(drillConfig('steel', 3), createOracleBot()).duel);
    expect(run()).toEqual(run());
  });

  it('every drill names a telegraph, an answer and a goal', () => {
    for (const d of DRILLS) {
      expect(['steel', 'red_gold', 'flicker']).toContain(d.telegraph);
      expect(d.instruction.length).toBeGreaterThan(20);
      expect(d.goalLabel).toBeTruthy();
      expect(d.hudLabel).toBeTruthy();
      expect(drillConfig(d.id).drill).toEqual(d.goal);
    }
    expect(drillConfig('nope')).toBeNull();
  });
});

describe('training yard sparring', () => {
  it('offers every foe at practice stakes, and every champion style', () => {
    expect(SPARRING.map((s) => s.archetypeId)).toEqual(['blade_adept', 'warg_alpha', 'fallen_champion']);
    for (const s of SPARRING) expect(createDuel(sparringConfig(s.archetypeId, 1)).config.modifiers.stakes).toBe('practice');
    const styles = SPARRING.find((s) => s.styles).styles.map((mirror) => createDuel(sparringConfig('fallen_champion', 1, { mirror })).def.style);
    expect(styles).toEqual(['aegis', 'warg', 'shadow']);
  });
});
