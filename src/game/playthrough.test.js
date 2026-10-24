// M12 headless playthrough: one full cycle (War Room → march → duels → campfire → Passing → Return),
// driven only through the public controller, with real duels played by bots.
import { describe, it, expect } from 'vitest';
import { newGame, dispatch, getView } from './actions.js';
import { PHASES } from './core/state.js';
import { getDuelResult } from './duel/engine.js';
import { simulateDuel, createOracleBot, createGuardSpamBot } from './duel/bots.js';
import { getCrisis } from './content/crises.js';
import { getBeat } from './content/expedition.js';
import { validateStateShape } from './save/saveSystem.js';

function run(state, action) {
  const out = dispatch(state, action);
  if (out.error) throw new Error(`${action.type}: ${out.error}`);
  return out.state;
}

function playDuel(config, bot) {
  const { duel } = simulateDuel(config, bot, { maxMs: 240000 });
  const result = getDuelResult(duel);
  expect(result).not.toBeNull();
  return result;
}

const winner = () => createOracleBot({ mode: 'parry' });
const loser = () => createGuardSpamBot();

// Walk the current expedition beat by beat, preferring the given choice ids.
function walkExpedition(state, prefs, { loseFirstChampion = false } = {}) {
  let s = state;
  let lostOnce = false;
  let guard = 0;
  while (s.phase === PHASES.EXPEDITION && guard++ < 60) {
    if (s.expedition.pendingDuel) {
      const cfg = s.expedition.pendingDuel;
      const bot = loseFirstChampion && cfg.beat === 'champion' && !lostOnce ? loser() : winner();
      const result = playDuel(cfg, bot);
      if (loseFirstChampion && cfg.beat === 'champion' && !lostOnce) {
        expect(result.outcome).toBe('defeat');
        expect(result.misreads.length).toBeGreaterThan(0); // the player can name why
        expect(result.misreads[0].advice).toBeTruthy();
        lostOnce = true;
      }
      s = run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result });
      continue;
    }
    const beat = getBeat(s);
    const pick = prefs.find((id) => beat.choices.some((c) => c.id === id)) ?? beat.choices.find((c) => c.kind !== 'talk')?.id;
    s = run(s, { type: 'EXPEDITION_CHOICE', choiceId: pick });
  }
  return s;
}

function finishResolution(state, prefs) {
  let s = state;
  if (s.phase === PHASES.CAMPFIRE) s = run(s, { type: 'CAMPFIRE_COMPLETE', mode: 'enter', responseId: prefs.campfire ?? 'honest' });
  if (s.phase === PHASES.RESOLUTION && getView(s).campfire) {
    s = run(s, { type: 'START_CAMPFIRE' });
    s = run(s, { type: 'CAMPFIRE_COMPLETE', mode: 'enter', responseId: 'ask' });
  }
  return s;
}

describe('full cycle playthrough', () => {
  it('plays a reign, passes the mantle, and the second briefing cites the first', () => {
    let s = newGame({ seed: 42 });
    expect(s.phase).toBe(PHASES.WAR_ROOM);

    // Turn 1 — open the northern road (refugees granted), then walk the Marches.
    expect(getCrisis(s).orders).toHaveLength(5);
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'E' });
    expect(s.phase).toBe(PHASES.RESOLUTION);
    expect(s.lastResolution.outcome.length).toBeGreaterThan(0);
    const marchOffer = getView(s).deployments.find((d) => d.kind === 'march');
    expect(marchOffer).toBeTruthy();
    s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'march' });
    s = walkExpedition(
      s,
      ['ask_mara', 'feed_sparky', 'ride_on', 'ask_mika', 'sparky_hello', 'walk_through', 'seal', 'face_alpha', 'spare_alpha', 'study', 'leave_ruin', 'ask_why', 'challenge', 'rematch', 'release', 'rest'],
      { loseFirstChampion: true },
    );
    expect(s.flags.mika_family).toBe('helped');
    expect(s.flags.nyra_fate).toBe('released');
    expect(s.flags.architect_studied).toBe(true);
    expect(s.flags.march_done_1).toBe(true);
    expect(s.chronicle.some((e) => e.title === 'Unknown Symbol Discovered')).toBe(true);
    s = finishResolution(s, {});
    expect(s.phase).toBe(PHASES.RESOLUTION);

    // A Trial of Blades does not consume the turn.
    s = run(s, { type: 'CONTINUE' });
    expect(s.turn).toBe(2);
    s = run(s, { type: 'TRIAL_START', archetypeId: 'warg_alpha' });
    s = run(s, { type: 'TRIAL_COMPLETE', result: playDuel(s.trial.pending, winner()) });
    expect(s.turn).toBe(2);
    expect(s.counters.trialWins).toBe(1);

    // Approve three Chronicle entries (Chronicler's Pen).
    for (const e of s.chronicle.filter((x) => x.cycle === 1).slice(0, 3)) s = run(s, { type: 'APPROVE_CHRONICLE', entryId: e.id });
    expect(s.counters.chronicleApproved).toBe(3);

    // Turns 2–4 via orders A, custom, and the turn-4 skirmish.
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'E' });
    s = finishResolution(s, {});
    s = run(s, { type: 'CONTINUE' });
    expect(s.turn).toBe(3);
    s = run(s, { type: 'ISSUE_CUSTOM_ORDER', text: 'Evacuate the villages and feed the refugees, but secretly send agents to watch the depots' });
    expect(s.lastResolution.custom).toBeTruthy();
    s = finishResolution(s, {});
    s = run(s, { type: 'CONTINUE' });
    expect(s.turn).toBe(4);
    expect(s.year).toBe(412);
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'A' });
    const skirmish = getView(s).deployments.find((d) => d.kind === 'skirmish');
    expect(skirmish).toBeTruthy();
    s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'skirmish' });
    s = walkExpedition(s, ['face', 'hold_greywater', 'rest']);
    expect(s.flags.skirmish_won).toBe(true);
    s = finishResolution(s, {});
    s = run(s, { type: 'CONTINUE' });
    expect(s.turn).toBe(5);
    expect(s.year).toBe(413); // the season wrapped to spring

    // Turn 5 — the era closes.
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'A' });
    s = finishResolution(s, {});
    expect(getView(s).isFinalTurn).toBe(true);
    s = run(s, { type: 'CONTINUE' });
    expect(s.phase).toBe(PHASES.PASSING);
    expect(s.passing.cause).toBe('era');

    // The Passing in 4 steps.
    const view = getView(s);
    expect(view.farewells.length).toBeGreaterThan(0);
    s = run(s, { type: 'PASSING_NEXT' });
    expect(s.passing.step).toBe('chronicle');
    expect(getView(s).readback.lines.length).toBeGreaterThan(3);
    s = run(s, { type: 'PASSING_NEXT' });
    expect(s.passing.step).toBe('legacies');
    const earned = getView(s).legacies.filter((l) => l.earned).map((l) => l.id);
    expect(earned).toEqual(expect.arrayContaining(['architects_mark', 'chroniclers_pen']));
    expect(dispatch(s, { type: 'PASSING_CHOOSE_LEGACIES', ids: ['architects_mark', 'chroniclers_pen', 'maras_oath'] }).error).toMatch(/at most 2/);
    const chosen = dispatch(s, { type: 'PASSING_CHOOSE_LEGACIES', ids: ['architects_mark', 'chroniclers_pen'] });
    expect(chosen.error).toBeNull();
    expect(chosen.io.commitDynasty).toBe(true);
    s = chosen.state;
    expect(s.history).toHaveLength(1);

    const startCycle2 = dispatch(s, { type: 'BEGIN_NEXT_CYCLE' });
    expect(startCycle2.error).toBeNull();
    expect(startCycle2.io.autosave).toBe('cycle_start');
    s = startCycle2.state;

    // The Return: new incarnation, older world, the first briefing cites history.
    expect(s.cycle.number).toBe(2);
    expect(s.phase).toBe(PHASES.WAR_ROOM);
    expect(s.turn).toBe(1);
    expect(s.year).toBeGreaterThanOrEqual(413 + 38);
    expect(s.cycle.activeLegacies).toEqual(['architects_mark', 'chroniclers_pen']);
    expect(s.factions.iron_syndicate.leader).toBe('Chancellor Nyra Kell');
    expect(s.characters.mara.name).toMatch(/Younger/);
    const briefing = getCrisis(s).briefing.join(' ');
    expect(briefing).toMatch(/years/);
    expect(briefing).toMatch(/Mika/);
    expect(briefing).toMatch(/Nyra Kell/);
    // The Chronicle is write-only: nothing from cycle 1 was lost.
    expect(s.chronicle.filter((e) => e.cycle === 1).length).toBeGreaterThan(8);
    expect(s.chronicle.some((e) => e.title.startsWith('The Return'))).toBe(true);
    expect(validateStateShape(s).ok).toBe(true);
  });

  it('is deterministic: the same inputs give the same world', () => {
    const play = () => {
      let s = newGame({ seed: 7 });
      s = run(s, { type: 'ISSUE_ORDER', orderId: 'C' });
      s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'march' });
      s = walkExpedition(s, ['ride_on', 'walk_past', 'leave_meat', 'leave_ruin', 'challenge', 'capture', 'rest']);
      return s;
    };
    expect(JSON.stringify(play())).toEqual(JSON.stringify(play()));
  });

  it('a lost last stand ends the reign as a fall, never a game over', () => {
    let s = newGame({ seed: 9 });
    // Provoke the Syndicate every turn so the thaw brings a siege.
    const provoke = { 1: 'B', 2: 'B', 3: 'D', 4: 'B' };
    for (let t = 1; t <= 4; t += 1) {
      s = run(s, { type: 'ISSUE_ORDER', orderId: provoke[t] });
      s = finishResolution(s, {});
      s = run(s, { type: 'CONTINUE' });
    }
    s = { ...s, factions: { ...s.factions, iron_syndicate: { ...s.factions.iron_syndicate, tension: 95 } } };
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'B' });
    const stand = getView(s).deployments.find((d) => d.kind === 'last_stand');
    expect(stand).toBeTruthy();
    s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'last_stand' });
    s = run(s, { type: 'EXPEDITION_CHOICE', choiceId: 'ride_out' });
    expect(s.expedition.pendingDuel.allowRetreat).toBe(false);
    s = run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result: playDuel(s.expedition.pendingDuel, loser()) });
    s = run(s, { type: 'EXPEDITION_CHOICE', choiceId: 'fall' });
    expect(s.phase).toBe(PHASES.PASSING);
    expect(s.passing.cause).toBe('fall');
    s = run(s, { type: 'PASSING_NEXT' });
    s = run(s, { type: 'PASSING_NEXT' });
    s = run(s, { type: 'PASSING_CHOOSE_LEGACIES', ids: [] });
    s = run(s, { type: 'BEGIN_NEXT_CYCLE' });
    expect(s.cycle.number).toBe(2);
    expect(getCrisis(s).briefing.join(' ')).toMatch(/fell at the Siege of the Marches/);
    expect(s.regions.southern_marches.monuments.some((m) => m.id === 'cairn_1')).toBe(true);
  });

  it('abdication is remembered differently from a fall', () => {
    let s = newGame({ seed: 3 });
    s = run(s, { type: 'ABDICATE' });
    expect(s.passing.cause).toBe('abdication');
    s = run(s, { type: 'PASSING_NEXT' });
    s = run(s, { type: 'PASSING_NEXT' });
    s = run(s, { type: 'PASSING_CHOOSE_LEGACIES', ids: [] });
    s = run(s, { type: 'BEGIN_NEXT_CYCLE' });
    expect(getCrisis(s).briefing.join(' ')).toMatch(/laid down the crown by choice/);
  });

  it('skipping a campfire never punishes', () => {
    let s = newGame({ seed: 11 });
    s = { ...s, intensity: 90 };
    s = run(s, { type: 'ISSUE_ORDER', orderId: 'B' });
    s = { ...s, intensity: 90 };
    expect(getView(s).campfire).toBeTruthy();
    const before = s;
    s = run(s, { type: 'START_CAMPFIRE' });
    s = run(s, { type: 'CAMPFIRE_COMPLETE', mode: 'skip' });
    expect(s.resources).toEqual(before.resources);
    for (const id of Object.keys(before.characters)) expect(s.characters[id].rel).toEqual(before.characters[id].rel);
    expect(s.intensity).toBeLessThan(before.intensity);
  });
});
