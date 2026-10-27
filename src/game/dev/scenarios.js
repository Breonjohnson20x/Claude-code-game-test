// Dev-only: reach any phase through the real controller, for UI previews, screenshot loops and
// tests. Every scenario is produced by dispatching real actions (no hand-built states).
// Usage in the browser (dev server only): /?scenario=war_room_t3

import { newGame, dispatch } from '../actions.js';
import { getDuelResult } from '../duel/engine.js';
import { simulateDuel, createOracleBot, createGuardSpamBot } from '../duel/bots.js';
import { getBeat } from '../content/expedition.js';

function run(state, action) {
  const out = dispatch(state, action);
  if (out.error) throw new Error(`[scenario] ${action.type}: ${out.error}`);
  return out.state;
}

function duel(state, win = true) {
  const cfg = state.expedition?.pendingDuel ?? state.trial?.pending;
  const { duel: d } = simulateDuel(cfg, win ? createOracleBot({ mode: 'parry' }) : createGuardSpamBot(), { maxMs: 240000 });
  return getDuelResult(d);
}

function choose(state, ...ids) {
  let s = state;
  for (const id of ids) {
    const beat = getBeat(s);
    if (!beat.choices.some((c) => c.id === id)) throw new Error(`[scenario] no choice ${id} at ${beat.id}`);
    s = run(s, { type: 'EXPEDITION_CHOICE', choiceId: id });
  }
  return s;
}

function settleCampfire(s) {
  if (s.phase === 'campfire') return run(s, { type: 'CAMPFIRE_COMPLETE', mode: 'enter', responseId: 'honest' });
  return s;
}

const base = () => newGame({ seed: 20261024, sovereignName: 'Aurelian' });

function afterTurn1() {
  return run(base(), { type: 'ISSUE_ORDER', orderId: 'E' });
}

function marchTo(beatId) {
  let s = run(afterTurn1(), { type: 'BEGIN_DEPLOYMENT', kind: 'march' });
  const path = { road: [], checkpoint: ['ride_on'], wilds: ['ride_on', 'walk_through'], ruin: ['ride_on', 'walk_through', 'leave_meat'], champion: ['ride_on', 'walk_through', 'leave_meat', 'study', 'leave_ruin'] };
  s = choose(s, ...(path[beatId] ?? []));
  return s;
}

function fullCycle1() {
  let s = afterTurn1();
  s = run(s, { type: 'BEGIN_DEPLOYMENT', kind: 'march' });
  s = choose(s, 'ask_mara', 'ride_on', 'sparky_hello', 'walk_through', 'face_alpha');
  s = run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result: duel(s) });
  s = choose(s, 'spare_alpha', 'study', 'leave_ruin', 'ask_why', 'challenge');
  s = run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result: duel(s) });
  s = choose(s, 'release', 'rest');
  s = settleCampfire(s);
  for (const order of ['E', 'A', 'A']) {
    s = run(s, { type: 'CONTINUE' });
    s = run(s, { type: 'ISSUE_ORDER', orderId: order });
    s = settleCampfire(s);
  }
  for (const e of s.chronicle.filter((x) => x.cycle === 1).slice(0, 3)) s = run(s, { type: 'APPROVE_CHRONICLE', entryId: e.id });
  s = run(s, { type: 'CONTINUE' });
  s = run(s, { type: 'ISSUE_ORDER', orderId: 'A' });
  s = settleCampfire(s);
  return s;
}

export const SCENARIOS = {
  war_room_t1: { label: 'War Room · turn 1', build: () => base() },
  resolution_t1: { label: 'Resolution · turn 1 (march offered)', build: afterTurn1 },
  march_road: { label: 'March · the road', build: () => marchTo('road') },
  march_checkpoint: { label: 'March · checkpoint (Mika)', build: () => marchTo('checkpoint') },
  march_wilds: { label: 'March · wilds (warg alpha)', build: () => marchTo('wilds') },
  march_ruin: { label: 'March · the broken circle', build: () => marchTo('ruin') },
  march_champion: { label: 'March · Greywater Ford (Nyra)', build: () => marchTo('champion') },
  duel_pending: { label: 'March · champion duel ready', build: () => choose(marchTo('champion'), 'challenge') },
  champion_defeated: {
    label: 'March · lost to the champion (rematch offered)',
    build: () => {
      const s = choose(marchTo('champion'), 'challenge');
      return run(s, { type: 'EXPEDITION_DUEL_COMPLETE', result: duel(s, false) });
    },
  },
  campfire: {
    label: 'Campfire offered',
    build: () => {
      let s = afterTurn1();
      s = { ...s, intensity: 80 };
      return run(s, { type: 'START_CAMPFIRE' });
    },
  },
  war_room_t3: {
    label: 'War Room · turn 3 (the line is crossed)',
    build: () => {
      let s = settleCampfire(afterTurn1());
      s = run(s, { type: 'CONTINUE' });
      s = run(s, { type: 'ISSUE_ORDER', orderId: 'A' });
      s = settleCampfire(s);
      return run(s, { type: 'CONTINUE' });
    },
  },
  resolution_t4_skirmish: {
    label: 'Resolution · turn 4 (skirmish offered)',
    build: () => {
      let s = settleCampfire(afterTurn1());
      for (const o of ['A', 'A']) {
        s = run(s, { type: 'CONTINUE' });
        s = settleCampfire(run(s, { type: 'ISSUE_ORDER', orderId: o }));
      }
      s = run(s, { type: 'CONTINUE' });
      return run(s, { type: 'ISSUE_ORDER', orderId: 'B' });
    },
  },
  passing_campfire: { label: 'Passing · final campfire', build: () => run(fullCycle1(), { type: 'CONTINUE' }) },
  passing_chronicle: { label: 'Passing · Chronicle read-back', build: () => run(run(fullCycle1(), { type: 'CONTINUE' }), { type: 'PASSING_NEXT' }) },
  passing_legacies: {
    label: 'Passing · choose Legacies',
    build: () => run(run(run(fullCycle1(), { type: 'CONTINUE' }), { type: 'PASSING_NEXT' }), { type: 'PASSING_NEXT' }),
  },
  cycle2_war_room: {
    label: 'Reign II · first briefing',
    build: () => {
      let s = run(run(run(fullCycle1(), { type: 'CONTINUE' }), { type: 'PASSING_NEXT' }), { type: 'PASSING_NEXT' });
      s = run(s, { type: 'PASSING_CHOOSE_LEGACIES', ids: ['architects_mark', 'chroniclers_pen'] });
      return run(s, { type: 'BEGIN_NEXT_CYCLE' });
    },
  },
};

export function buildScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) return null;
  return sc.build();
}
