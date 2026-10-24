// Scripted duel "players" — pure functions (duel) → DuelInput[] for tests, tuning and demos.
// The oracle reads only what the UI shows (duel.telegraph + visible enemy state), so if the
// oracle can answer an attack with zero damage, a human reading the same telegraph can too.

import { STEP_MS, stepDuel, createDuel } from './engine.js';

export const ORACLE_GUARD_LEAD_MS = 120; // press guard this long before impact (inside the perfect window)
export const ORACLE_DODGE_LEAD_MS = 150; // dodge this long before impact (inside the i-frames)

const PUNISH_STATES = new Set(['recovery', 'staggered', 'open']);

export function dodgeSideFor(dir) {
  if (dir === 'left') return 'right';
  if (dir === 'right') return 'left';
  return 'left';
}

// mode: 'parry' (perfect-parry lights, dodge heavies) | 'dodge' (dodge everything) | 'mixed'
export function createOracleBot({ mode = 'parry', strike = true, arc = true, royal = true, royalBelowHp = 45 } = {}) {
  let guardDown = false;
  let guardStepId = null;
  return function oracle(duel) {
    const inputs = [];
    if (!duel || duel.phase === 'over') return inputs;
    const p = duel.player;
    const e = duel.enemy;
    const t = duel.telegraph;
    const free = p.stunMs <= 0 && p.swingMs <= 0 && !p.dodge.active;
    const release = () => {
      if (guardDown) inputs.push({ type: 'guard', down: false });
      guardDown = false;
      guardStepId = null;
    };

    if (t && !t.isFeint) {
      const tti = t.timeToImpactMs;
      const dodgeIt = t.isHeavy || mode === 'dodge' || (mode === 'mixed' && t.stepId % 2 === 0);
      if (dodgeIt) {
        if (guardDown) release();
        if (tti <= ORACLE_DODGE_LEAD_MS && free && p.dodge.cooldownMs <= 0) inputs.push({ type: 'dodge', side: dodgeSideFor(t.dir) });
      } else if (tti <= ORACLE_GUARD_LEAD_MS) {
        if (!guardDown || guardStepId !== t.stepId) {
          if (guardDown) inputs.push({ type: 'guard', down: false });
          inputs.push({ type: 'guard', down: true });
          guardDown = true;
          guardStepId = t.stepId;
        }
      } else if (guardDown && guardStepId !== t.stepId) {
        release();
      }
    } else if (guardDown) {
      release(); // never hold guard into a feint or through idle
    }

    if (strike && free && PUNISH_STATES.has(e.state)) {
      if (arc && p.arcCharge >= 1) inputs.push({ type: 'arc' });
      else {
        const dir = e.guardSide === 'left' ? 'right' : e.guardSide === 'right' ? 'left' : 'up';
        inputs.push({ type: 'strike', dir });
      }
    }
    if (royal && !p.royalUsed && p.hp < royalBelowHp) inputs.push({ type: 'royal' });
    return inputs;
  };
}

// The newcomer who holds guard and swings whenever — useful for misread tests.
export function createGuardSpamBot() {
  let down = false;
  return function spam(duel) {
    const inputs = [];
    if (!down) {
      inputs.push({ type: 'guard', down: true });
      down = true;
    }
    return inputs;
  };
}

// Run a duel to completion (or maxMs) with a bot. Collects every event if `collect` is true.
export function simulateDuel(config, bot = null, { maxMs = 180000, collect = false, onStep = null } = {}) {
  let d = createDuel(config);
  const events = collect ? d.events.slice() : null;
  while (d.phase !== 'over' && d.timeMs < maxMs) {
    const inputs = bot ? bot(d) : [];
    d = stepDuel(d, inputs, STEP_MS);
    if (collect) events.push(...d.events);
    if (onStep) onStep(d, inputs);
  }
  return { duel: d, events };
}
