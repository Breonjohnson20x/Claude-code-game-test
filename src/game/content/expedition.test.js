import { describe, expect, it } from 'vitest';
import { newGame, dispatch, getView } from '../actions.js';
import { getBeat, checkpointScout } from './expedition.js';
import { getDuelResult } from '../duel/engine.js';
import { simulateDuel, createOracleBot, createGuardSpamBot } from '../duel/bots.js';

function run(state, action) {
  const out = dispatch(state, action);
  if (out.error) throw new Error(`${action.type}: ${out.error}`);
  return out.state;
}

function choose(state, ...ids) {
  let s = state;
  for (const id of ids) s = run(s, { type: 'EXPEDITION_CHOICE', choiceId: id });
  return s;
}

function fight(state, win) {
  const { duel } = simulateDuel(state.expedition.pendingDuel, win ? createOracleBot({ mode: 'parry' }) : createGuardSpamBot(), { maxMs: 240000 });
  return run(state, { type: 'EXPEDITION_DUEL_COMPLETE', result: getDuelResult(duel) });
}

/** Turn 1 with the given order, then march to the checkpoint. */
function atCheckpoint(order = 'E') {
  let s = run(newGame({ seed: 20261024, sovereignName: 'Aurelian' }), { type: 'ISSUE_ORDER', orderId: order });
  s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'march' });
  return choose(s, 'ride_on');
}

const ids = (s) => getBeat(s).choices.map((c) => c.id);
const text = (s) => getBeat(s).text.join(' ');
const toFord = (s) => choose(s, 'walk_past', 'leave_meat', 'leave_ruin');

describe('the checkpoint: the man in the grey coat', () => {
  it('Sparky spots a Syndicate pathfinder among the refugees; calling him out is a duel', () => {
    const s = atCheckpoint();
    expect(text(s)).toMatch(/grey refugee's coat/);
    const call = getBeat(s).choices.find((c) => c.id === 'call_out_scout');
    expect(call.kind).toBe('duel');
    const pending = choose(s, 'call_out_scout').expedition.pendingDuel;
    expect(pending).toMatchObject({ archetypeId: 'blade_adept', beat: 'checkpoint', title: 'The Man in the Grey Coat' });
    expect(pending.modifiers.stakes).toBe('march');
    // Low intelligence: no quiet option.
    expect(ids(s)).not.toContain('signal_watchers');
  });

  it('a win: he is caught, the family is still waiting, and the ford remembers the map', () => {
    let s = fight(choose(atCheckpoint(), 'call_out_scout'), true);
    expect(s.expedition.phase).toBe('after_victory');
    expect(checkpointScout(s.expedition)).toBe('caught');
    expect(text(s)).toMatch(/face-down in the mud/);
    expect(ids(s)).toEqual(expect.arrayContaining(['search_scout', 'ask_mika', 'walk_through']));
    expect(ids(s)).not.toContain('call_out_scout');
    expect(s.chronicle.some((e) => e.title === 'The Sovereign Bested The Man in the Grey Coat')).toBe(true);
    const intel = s.resources.intel;
    s = choose(s, 'search_scout');
    expect(s.resources.intel).toBe(intel + 6);
    expect(s.flags.checkpoint_scout).toBe('caught');
    expect(s.memories.some((m) => m.characterId === 'mika' && m.eventId === 'THE_SOVEREIGN_FOUGHT_IN_THE_MUD')).toBe(true);
    s = toFord(s);
    expect(getBeat(s).id).toBe('champion');
    expect(text(s)).toMatch(/map from the grey coat was exact/);
  });

  it('a loss or a withdrawal: he escapes, no rematch, and the champion heard about you', () => {
    const lost = fight(choose(atCheckpoint(), 'call_out_scout'), false);
    expect(lost.expedition.phase).toBe('after_defeat');
    expect(checkpointScout(lost.expedition)).toBe('escaped');
    expect(text(lost)).toMatch(/gone into the reeds/);
    expect(getBeat(lost).choices.some((c) => c.kind === 'duel')).toBe(false);
    expect(text(toFord(lost))).toMatch(/Our pathfinder said you'd come by moonrise/);

    const s = choose(atCheckpoint(), 'call_out_scout');
    const { duel } = simulateDuel(s.expedition.pendingDuel, null, { maxMs: 100 });
    const withdrew = run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result: { ...getDuelResult({ ...duel, phase: 'over', outcome: 'retreat', endedAtMs: 100 }) } });
    expect(withdrew.expedition.phase).toBe('after_retreat');
    expect(text(withdrew)).toMatch(/backs into the crowd/);
  });

  it("with Cassian's network in place, his watchers can take the scout quietly instead", () => {
    let s = atCheckpoint('C');
    expect(s.resources.intel).toBeGreaterThanOrEqual(35);
    expect(ids(s)).toContain('signal_watchers');
    s = choose(s, 'signal_watchers');
    expect(s.flags.checkpoint_scout).toBe('taken');
    expect(checkpointScout(s.expedition)).toBe('taken');
    expect(ids(s)).not.toContain('call_out_scout');
    expect(s.expedition.phase).toBe('main');
    expect(text(toFord(s))).toMatch(/no word from its pathfinder since noon/);
  });

  it('ignoring him changes nothing at the ford', () => {
    const s = toFord(atCheckpoint());
    expect(checkpointScout(s.expedition)).toBeNull();
    expect(text(s)).not.toMatch(/pathfinder|grey coat/);
    expect(getView(s).beat.id).toBe('champion');
  });
});
