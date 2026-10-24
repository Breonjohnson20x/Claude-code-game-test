import { describe, it, expect } from 'vitest';
import { createDuel, stepDuel, getDuelResult, STEP_MS, TUNING } from './engine.js';
import { resolveArchetype, listAttackPatterns, ARCHETYPE_IDS } from './archetypes.js';
import { createOracleBot, simulateDuel, dodgeSideFor } from './bots.js';
import { makeRng } from '../core/rng.js';
import { buildMisreads, summarizeDuel } from './analysis.js';

const baseConfig = (archetypeId, mods = {}, extra = {}) => ({
  archetypeId,
  seed: 1234,
  title: 'Test duel',
  subtitle: 'vitest',
  modifiers: { cycleNumber: 1, legacies: [], companion: 'mara', stakes: 'march', ...mods },
  allowRetreat: false,
  ...extra,
});

// Champion variants: one per mirrored style.
const CHAMPION_VARIANTS = [
  { legacies: ['aegis_mastery'] },
  { legacies: ['warg_truce'] },
  { legacies: ['oathbreakers_shadow'] },
];

function run(config, bot, maxMs = 120000) {
  return simulateDuel(config, bot, { maxMs, collect: true });
}

function stepFor(d, ms, bot = null) {
  const end = d.timeMs + ms;
  const events = [];
  while (d.timeMs < end && d.phase !== 'over') {
    d = stepDuel(d, bot ? bot(d) : [], STEP_MS);
    events.push(...d.events);
  }
  return { d, events };
}

function stepUntil(d, pred, maxMs = 30000, bot = null) {
  const end = d.timeMs + maxMs;
  const events = [];
  while (!pred(d) && d.timeMs < end && d.phase !== 'over') {
    d = stepDuel(d, bot ? bot(d) : [], STEP_MS);
    events.push(...d.events);
  }
  return { d, events };
}

// A pseudo-random but reproducible input script: [{tick, input}] generated from its own seed.
function randomScript(seed, ticks) {
  const rng = makeRng(seed);
  const out = new Map();
  for (let t = 0; t < ticks; t++) {
    if (!rng.chance(0.08)) continue;
    const r = rng.next();
    let input;
    if (r < 0.35) input = { type: 'strike', dir: rng.pick(['up', 'down', 'left', 'right']) };
    else if (r < 0.55) input = { type: 'dodge', side: rng.pick(['left', 'right']) };
    else if (r < 0.75) input = { type: 'guard', down: rng.chance(0.5) };
    else if (r < 0.88) input = { type: 'ward', down: rng.chance(0.5) };
    else if (r < 0.95) input = { type: 'arc' };
    else input = { type: 'royal' };
    out.set(t, [input]);
  }
  return out;
}

describe('duel engine — determinism & purity', () => {
  it('same seed + same input script → identical result and identical final state', () => {
    for (const id of ARCHETYPE_IDS) {
      const cfg = baseConfig(id, { companion: 'sparky' }, { seed: 'det-seed' });
      const script = randomScript(99, 6000);
      const play = () => {
        let d = createDuel(cfg);
        for (let t = 0; t < 6000 && d.phase !== 'over'; t++) d = stepDuel(d, script.get(t) || [], STEP_MS);
        return d;
      };
      const a = play();
      const b = play();
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
      expect(getDuelResult(a)).toEqual(getDuelResult(b));
    }
  });

  it('oracle runs are reproducible, and different seeds diverge', () => {
    const cfg = baseConfig('blade_adept');
    const r1 = getDuelResult(run(cfg, createOracleBot()).duel);
    const r2 = getDuelResult(run(cfg, createOracleBot()).duel);
    expect(r1).toEqual(r2);
    const r3 = getDuelResult(run({ ...cfg, seed: 98765 }, createOracleBot()).duel);
    expect(r3.durationMs === r1.durationMs && r3.cleanHits === r1.cleanHits && r3.perfectParries === r1.perfectParries).toBe(false);
  });

  it('stepDuel never mutates its input duel', () => {
    const d0 = createDuel(baseConfig('warg_alpha'));
    const snapshot = JSON.stringify(d0);
    const d1 = stepDuel(d0, [{ type: 'strike', dir: 'left' }, { type: 'guard', down: true }], 500);
    expect(JSON.stringify(d0)).toEqual(snapshot);
    expect(d1).not.toBe(d0);
    expect(d1.timeMs).toBeGreaterThan(0);
  });

  it('variable dt is sub-stepped at a fixed timestep', () => {
    const cfg = baseConfig('blade_adept');
    let a = createDuel(cfg);
    let b = createDuel(cfg);
    for (let i = 0; i < 120; i++) a = stepDuel(a, [], STEP_MS);
    for (let i = 0; i < 40; i++) b = stepDuel(b, [], STEP_MS * 3);
    expect(a.tick).toBe(b.tick);
    expect(a.enemy.state).toBe(b.enemy.state);
    expect(a.rngSeed).toBe(b.rngSeed);
  });
});

describe('duel engine — outcomes', () => {
  const variants = [
    ['blade_adept', {}],
    ['warg_alpha', {}],
    ...CHAMPION_VARIANTS.map((m) => ['fallen_champion', m]),
    ['fallen_champion', { legacies: [], cycleNumber: 3 }],
  ];

  it.each(variants)('oracle bot beats %s %j within 120s with hp > 0', (id, mods) => {
    for (const seed of [1, 42, 777]) {
      const { duel } = run(baseConfig(id, mods, { seed }), createOracleBot(), 120000);
      const r = getDuelResult(duel);
      expect(r, `seed ${seed}`).not.toBeNull();
      expect(r.outcome).toBe('victory');
      expect(r.playerHpRemaining).toBeGreaterThan(0);
      expect(r.durationMs).toBeLessThan(120000);
    }
  });

  it.each(variants)('dodge-only oracle also beats %s %j', (id, mods) => {
    const r = getDuelResult(run(baseConfig(id, mods), createOracleBot({ mode: 'dodge' }), 120000).duel);
    expect(r.outcome).toBe('victory');
  });

  it.each(variants)('idle bot (no inputs) loses to %s %j', (id, mods) => {
    for (const seed of [3, 1999]) {
      const { duel } = run(baseConfig(id, mods, { seed }), null, 120000);
      const r = getDuelResult(duel);
      expect(r.outcome).toBe('defeat');
      expect(r.playerHpRemaining).toBe(0);
      expect(r.durationMs).toBeGreaterThan(12000);
      expect(r.durationMs).toBeLessThan(45000);
      expect(r.misreads.some((m) => m.kind === 'no_response')).toBe(true);
    }
  });

  it('getDuelResult is null mid-fight and matches the contract shape at the end', () => {
    const d = createDuel(baseConfig('blade_adept'));
    expect(getDuelResult(d)).toBeNull();
    const r = getDuelResult(run(baseConfig('blade_adept'), createOracleBot()).duel);
    for (const k of [
      'outcome', 'archetypeId', 'durationMs', 'playerHpRemaining', 'flawless', 'cleanHits', 'perfectParries', 'maxCombo',
      'poiseBreaks', 'panicParries', 'heavyHitsTaken', 'feintsBitten', 'usedRoyalCommand', 'usedArcPulse', 'misreads',
    ]) {
      expect(r).toHaveProperty(k);
    }
    expect(r.archetypeId).toBe('blade_adept');
    expect(r.flawless).toBe(true);
    expect(r.poiseBreaks).toBeGreaterThan(0);
    expect(r.usedArcPulse).toBe(true);
    expect(r.maxCombo).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(r.misreads)).toBe(true);
  });

  it('the first attack comes after a newcomer grace period', () => {
    for (const id of ARCHETYPE_IDS) {
      const { d } = stepUntil(createDuel(baseConfig(id)), (x) => x.enemy.firstAttackAt != null, 20000);
      expect(d.enemy.firstAttackAt).toBeGreaterThanOrEqual(3000);
    }
  });
});

describe('duel engine — misreads', () => {
  it("parrying heavies is recorded as 'parried_heavy'", () => {
    // Bot that perfect-times its guard on everything, heavies included.
    let lastStep = null;
    const parryEverything = (d) => {
      const t = d.telegraph;
      if (t && t.timeToImpactMs <= 120 && lastStep !== t.stepId) {
        lastStep = t.stepId;
        return [{ type: 'guard', down: false }, { type: 'guard', down: true }];
      }
      return [];
    };
    const cfg = baseConfig('warg_alpha', {}, { script: [{ move: 'rend', dir: 'left' }, { move: 'pounce' }] });
    const { d } = stepFor(createDuel(cfg), 12000, parryEverything);
    expect(d.misreads.parried_heavy).toBeGreaterThanOrEqual(2);
    expect(d.stats.heavyHitsTaken).toBeGreaterThanOrEqual(2);
    expect(d.stats.parries).toBe(0);
    const misreads = buildMisreads(d.misreads);
    expect(misreads[0].kind).toBe('parried_heavy');
    expect(misreads[0].advice).toMatch(/DODGE/);
  });

  it("guarding during a Blade-Adept feint records 'panic_parry'", () => {
    const cfg = baseConfig('blade_adept', {}, { script: [{ move: 'feint', dir: 'left' }] });
    const panicky = (d) => {
      const t = d.telegraph;
      if (t && t.isFeint && t.progress > 0.5 && !d.player.guardHeld) return [{ type: 'guard', down: true }];
      if ((!t || !t.isFeint) && d.player.guardHeld) return [{ type: 'guard', down: false }];
      return [];
    };
    const { d, events } = stepFor(createDuel(cfg), 9000, panicky);
    expect(d.stats.panicParries).toBeGreaterThanOrEqual(1);
    expect(d.misreads.panic_parry).toBeGreaterThanOrEqual(1);
    expect(d.stats.feintsBitten).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'misread' && e.kind === 'panic_parry')).toBe(true);
    // Panic opens the guard: the quick follow-up arrives while guard is still locked out.
    expect(TUNING.PANIC_FOLLOW_WINDUP_MS).toBeLessThan(TUNING.GUARD_LOCKOUT_MS);
  });

  it('a panic-parried feint follow-up is still answerable by dodging (fairness)', () => {
    const cfg = baseConfig('blade_adept', {}, { script: [{ move: 'feint', dir: 'right' }] });
    let dodgedStep = null;
    const panicThenDodge = (d) => {
      const t = d.telegraph;
      const out = [];
      if (t && t.isFeint && !d.player.guardHeld) out.push({ type: 'guard', down: true });
      if (t && !t.isFeint) {
        if (d.player.guardHeld) out.push({ type: 'guard', down: false });
        if (t.timeToImpactMs <= 150 && dodgedStep !== t.stepId && !d.player.dodge.active && d.player.dodge.cooldownMs <= 0) {
          dodgedStep = t.stepId;
          out.push({ type: 'dodge', side: dodgeSideFor(t.dir) });
        }
      }
      return out;
    };
    const { d } = stepFor(createDuel(cfg), 15000, panicThenDodge);
    expect(d.stats.panicParries).toBeGreaterThanOrEqual(2);
    expect(d.stats.damageTaken).toBe(0);
  });

  it("reading a feint (doing nothing) opens it up and records no feint misread", () => {
    const cfg = baseConfig('blade_adept', {}, { script: [{ move: 'feint', dir: 'overhead' }] });
    const { d, events } = stepUntil(createDuel(cfg), (x) => x.enemy.state === 'open', 8000);
    expect(d.enemy.state).toBe('open');
    expect(events.some((e) => e.type === 'fx' && e.name === 'feint_read')).toBe(true);
    // A strike into the opening lands clean.
    const d2 = stepDuel(d, [{ type: 'strike', dir: 'up' }], STEP_MS);
    expect(d2.stats.cleanHits).toBe(1);
    expect(d2.misreads.panic_parry + d2.misreads.bit_feint).toBe(0);
  });

  it("dodging toward the attack side is 'wrong_dodge'; striking mid-swing is 'greedy_strike'", () => {
    const cfg = baseConfig('blade_adept', {}, { script: [{ move: 'slash', dir: 'left' }] });
    let done = new Set();
    const wrongWay = (d) => {
      const t = d.telegraph;
      if (t && t.timeToImpactMs <= 150 && !done.has(t.stepId)) {
        done.add(t.stepId);
        return [{ type: 'dodge', side: 'left' }];
      }
      return [];
    };
    const { d } = stepFor(createDuel(cfg), 6000, wrongWay);
    expect(d.misreads.wrong_dodge).toBeGreaterThanOrEqual(1);

    done = new Set();
    const greedy = (d2) => {
      const t = d2.telegraph;
      if (t && t.timeToImpactMs <= 100 && !done.has(t.stepId)) {
        done.add(t.stepId);
        return [{ type: 'strike', dir: 'up' }];
      }
      return [];
    };
    const g = stepFor(createDuel(cfg), 6000, greedy).d;
    expect(g.misreads.greedy_strike).toBeGreaterThanOrEqual(1);
  });

  it("a guard pressed just after the blow is 'late_guard', not 'no_response'", () => {
    const cfg = baseConfig('blade_adept', {}, { script: [{ move: 'slash', dir: 'right' }] });
    let pressed = false;
    const late = (d) => {
      if (!pressed && d.player.lastHitAt > 0 && d.timeMs - d.player.lastHitAt >= 100) {
        pressed = true;
        return [{ type: 'guard', down: true }];
      }
      return [];
    };
    const { d } = stepFor(createDuel(cfg), 5000, late);
    expect(d.misreads.late_guard).toBe(1);
    expect(d.misreads.no_response).toBe(0);
  });

  it('summarizeDuel always explains a defeat', () => {
    const r = getDuelResult(run(baseConfig('warg_alpha'), null).duel);
    const s = summarizeDuel(r);
    expect(s.title).toBe('Withdrawn');
    expect(s.tips.length).toBeGreaterThan(0);
    expect(s.tips[0].advice.length).toBeGreaterThan(10);
  });
});

describe('duel engine — telegraphs', () => {
  it('exposes kind, direction, progress and a colour hint', () => {
    const cases = [
      ['warg_alpha', 'rend', 'red_gold', true],
      ['blade_adept', 'slash', 'steel', false],
      ['blade_adept', 'feint', 'flicker', false],
      ['blade_adept', 'flurry', 'steel', false],
    ];
    for (const [id, move, color, heavy] of cases) {
      const cfg = baseConfig(id, {}, { script: [{ move }] });
      const { d } = stepUntil(createDuel(cfg), (x) => x.telegraph && x.telegraph.progress > 0.5, 10000);
      const t = d.telegraph;
      expect(t, `${id}/${move}`).toBeTruthy();
      expect(t.telegraphColor).toBe(color);
      expect(t.isHeavy).toBe(heavy);
      expect(['left', 'right', 'overhead', 'thrust']).toContain(t.dir);
      expect(t.progress).toBeGreaterThan(0.5);
      expect(t.progress).toBeLessThanOrEqual(1);
      expect(t.timeToImpactMs).toBeGreaterThan(0);
      if (move === 'flurry') expect(t.kind).toBe('combo');
    }
  });

  it('heavy wind-ups emit heavy_warn; every wind-up emits telegraph', () => {
    const cfg = baseConfig('warg_alpha', {}, { script: [{ move: 'pounce' }] });
    const { events } = stepUntil(createDuel(cfg), (x) => !!x.telegraph, 10000);
    const names = events.filter((e) => e.type === 'sfx').map((e) => e.name);
    expect(names).toContain('telegraph');
    expect(names).toContain('heavy_warn');
  });
});

describe('duel engine — specials & legacies', () => {
  it('Royal Command works once only', () => {
    let d = createDuel(baseConfig('blade_adept', { companion: 'mara' }));
    d = { ...d, player: { ...d.player, hp: 50 } };
    const { d: d1, events: ev1 } = (() => {
      const x = stepDuel(d, [{ type: 'royal' }], STEP_MS);
      return { d: x, events: x.events };
    })();
    expect(d1.player.royalUsed).toBe(true);
    expect(d1.player.hp).toBe(50 + TUNING.ROYAL_HEAL);
    expect(d1.player.royalWindowMs).toBeGreaterThan(0);
    expect(ev1.some((e) => e.type === 'sfx' && e.name === 'royal_command')).toBe(true);
    expect(ev1.some((e) => e.type === 'line' && e.speaker === 'mara')).toBe(true);
    const d2 = stepDuel({ ...d1, player: { ...d1.player, hp: 40 } }, [{ type: 'royal' }, { type: 'royal' }], STEP_MS);
    expect(d2.player.hp).toBe(40);
    expect(d2.events.some((e) => e.type === 'sfx' && e.name === 'royal_command')).toBe(false);
  });

  it("maras_oath heals more and plays Mara's line; Sparky's acid staggers the enemy", () => {
    let d = createDuel(baseConfig('blade_adept', { companion: null, legacies: ['maras_oath'] }));
    d = stepDuel({ ...d, player: { ...d.player, hp: 30 } }, [{ type: 'royal' }], STEP_MS);
    expect(d.player.hp).toBe(30 + TUNING.ROYAL_HEAL_OATH);
    expect(d.events.some((e) => e.type === 'line' && e.speaker === 'mara')).toBe(true);

    const cfg = baseConfig('warg_alpha', { companion: 'sparky' }, { script: [{ move: 'rend' }] });
    let s = stepUntil(createDuel(cfg), (x) => x.enemy.state === 'windup', 10000).d;
    s = stepDuel(s, [{ type: 'royal' }], STEP_MS);
    expect(s.enemy.state).toBe('staggered');
    expect(s.events.some((e) => e.type === 'line' && e.speaker === 'sparky' && /Sparky/.test(e.text))).toBe(true);
  });

  it("retreat yields outcome 'retreat' only when allowRetreat", () => {
    const blocked = stepDuel(createDuel(baseConfig('warg_alpha', {}, { allowRetreat: false })), [{ type: 'retreat' }], STEP_MS);
    expect(blocked.phase).toBe('fight');
    expect(getDuelResult(blocked)).toBeNull();
    const ok = stepDuel(createDuel(baseConfig('warg_alpha', {}, { allowRetreat: true })), [{ type: 'retreat' }], STEP_MS);
    expect(ok.phase).toBe('over');
    expect(getDuelResult(ok).outcome).toBe('retreat');
    // Further steps after the end are inert.
    const after = stepDuel(ok, [{ type: 'strike', dir: 'up' }], 1000);
    expect(after.timeMs).toBe(ok.timeMs);
  });

  it("'warg_truce' delays the Warg Alpha's first attack", () => {
    const plain = stepUntil(createDuel(baseConfig('warg_alpha')), (x) => x.enemy.firstAttackAt != null, 20000).d;
    const truceStart = createDuel(baseConfig('warg_alpha', { legacies: ['warg_truce'] }));
    expect(truceStart.enemy.state).toBe('hesitate');
    expect(truceStart.events.some((e) => e.type === 'line' && /remembers/.test(e.text))).toBe(true);
    const truce = stepUntil(truceStart, (x) => x.enemy.firstAttackAt != null, 20000).d;
    expect(truce.enemy.firstAttackAt).toBeGreaterThan(plain.enemy.firstAttackAt + 2000);
    // Truce does nothing for other archetypes.
    expect(createDuel(baseConfig('blade_adept', { legacies: ['warg_truce'] })).enemy.state).toBe('idle');
  });

  it('aegis_mastery makes Shield Ward stronger against a heavy', () => {
    const wardBot = () => {
      let sent = false;
      return () => {
        if (sent) return [];
        sent = true;
        return [{ type: 'ward', down: true }];
      };
    };
    const cfg = (legacies) => baseConfig('warg_alpha', { legacies }, { script: [{ move: 'rend', dir: 'left' }] });
    const plain = stepUntil(createDuel(cfg([])), (x) => x.stats.attacksFaced >= 1, 12000, wardBot()).d;
    const aegis = stepUntil(createDuel(cfg(['aegis_mastery'])), (x) => x.stats.attacksFaced >= 1, 12000, wardBot()).d;
    expect(plain.stats.damageTaken).toBeGreaterThan(0);
    expect(aegis.stats.damageTaken).toBeGreaterThan(0);
    expect(aegis.stats.damageTaken).toBeLessThan(plain.stats.damageTaken);
    expect(aegis.player.stamina).toBeGreaterThan(plain.player.stamina);
    expect(plain.misreads.warded_heavy).toBe(1);
  });

  it('oathbreakers_shadow makes enemies hit harder', () => {
    const plain = resolveArchetype(baseConfig('blade_adept'));
    const shadow = resolveArchetype(baseConfig('blade_adept', { legacies: ['oathbreakers_shadow'] }));
    expect(shadow.dmgMult).toBeGreaterThan(plain.dmgMult);
    expect(shadow.recoveryMult).toBeLessThan(plain.recoveryMult);
  });

  it('the Fallen Champion mirrors a held legacy and scales with the cycle', () => {
    const a = resolveArchetype(baseConfig('fallen_champion', { legacies: ['aegis_mastery'] }));
    expect(a.style).toBe('aegis');
    expect(a.wardGuard).toBe(true);
    expect(a.mirrorFromPlayer).toBe(true);
    expect(resolveArchetype(baseConfig('fallen_champion', { legacies: ['warg_truce'] })).style).toBe('warg');
    const shadow = resolveArchetype(baseConfig('fallen_champion', { legacies: ['oathbreakers_shadow'] }));
    expect(shadow.style).toBe('shadow');
    expect(shadow.moves.some((m) => m.kind === 'feint')).toBe(true);
    const none = resolveArchetype(baseConfig('fallen_champion', { legacies: [] }));
    expect(['aegis', 'warg', 'shadow']).toContain(none.style);
    expect(none.mirrorFromPlayer).toBe(false);
    const late = resolveArchetype(baseConfig('fallen_champion', { legacies: [], cycleNumber: 5 }));
    expect(late.maxHp).toBeGreaterThan(none.maxHp);
    expect(late.dmgMult).toBeGreaterThan(none.dmgMult);
    const named = resolveArchetype(baseConfig('fallen_champion', { champion: { name: 'Queen Ysolde', epithet: 'Second of the Line' } }));
    expect(named.name).toBe('Queen Ysolde');
  });

  it('Arc Pulse fires only when charged and deals damage + poise damage', () => {
    let d = createDuel(baseConfig('warg_alpha'));
    const notReady = stepDuel(d, [{ type: 'arc' }], STEP_MS);
    expect(notReady.stats.usedArcPulse).toBe(false);
    d = { ...d, player: { ...d.player, arcCharge: 1 } };
    const fired = stepDuel(d, [{ type: 'arc' }], STEP_MS);
    expect(fired.stats.usedArcPulse).toBe(true);
    expect(fired.player.arcCharge).toBe(0);
    expect(fired.enemy.hp).toBeLessThan(d.enemy.hp);
    expect(fired.enemy.poise).toBeLessThan(d.enemy.poise);
    expect(fired.events.some((e) => e.type === 'sfx' && e.name === 'arc_pulse')).toBe(true);
  });
});

describe('duel engine — fairness: every attack has a zero-damage answer', () => {
  const variants = [
    ['blade_adept', {}],
    ['blade_adept', { legacies: ['oathbreakers_shadow'] }],
    ['warg_alpha', {}],
    ['warg_alpha', { legacies: ['oathbreakers_shadow'] }],
    ...CHAMPION_VARIANTS.map((m) => ['fallen_champion', m]),
    ['fallen_champion', { legacies: ['oathbreakers_shadow'], cycleNumber: 8 }],
  ];

  for (const [id, mods] of variants) {
    const def = resolveArchetype(baseConfig(id, mods));
    const patterns = listAttackPatterns(def);
    it(`${id} ${JSON.stringify(mods)}: all ${patterns.length} (move, dir) patterns`, () => {
      for (const pat of patterns) {
        const modes = pat.kind === 'heavy' ? ['parry' /* oracle dodges heavies in every mode */] : ['parry', 'dodge'];
        for (const mode of modes) {
          for (const strike of [false, true]) {
            const cfg = baseConfig(id, mods, { seed: 5150, script: [{ move: pat.move, dir: pat.dir }] });
            const bot = createOracleBot({ mode, strike, arc: strike, royal: false });
            const { d } = stepUntil(createDuel(cfg), (x) => x.stats.attacksFaced >= 4, 40000, bot);
            const label = `${pat.move}/${pat.dir} mode=${mode} strike=${strike}`;
            expect(d.stats.attacksFaced, label).toBeGreaterThanOrEqual(d.phase === 'over' ? 1 : 4);
            expect(d.stats.damageTaken, label).toBe(0);
            expect(d.stats.hitsTaken, label).toBe(0);
          }
        }
      }
    });
  }
});
