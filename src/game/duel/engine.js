// OmniStrategy duel engine — real-time, direct-control single combat (Cycle doc §6, §10).
//
// Pure + deterministic: `stepDuel(duel, inputs, dtMs)` returns a NEW duel; the input object is
// never mutated. Time advances in fixed sub-steps of STEP_MS (60 Hz) using an accumulator, all
// randomness comes from the seeded mulberry32 RNG in src/game/core/rng.js (state.rngSeed), and
// nothing here touches the DOM, Math.random or Date.now. Same config + same input script ⇒
// identical duel.
//
// Events: every stepDuel call returns `duel.events` = only the events produced during THAT call
// (sfx / line / fx / misread / damage). The UI consumes them each frame.
//
// ──────────────────────────────────────────────────────────────────────────────────────────
// ANSWER RULES (the fairness contract — every attack is answerable by movement or timing)
// ──────────────────────────────────────────────────────────────────────────────────────────
// Each enemy attack is a windup (telegraph, progress 0→1) ending in a single IMPACT instant,
// then `active` follow-through, then `recovery` (the punish window). `dir` is the side of the
// screen the blow comes FROM: 'left' | 'right' | 'overhead' | 'thrust'.
//
//  LIGHT / COMBO hit (steel-white glow):
//    • PARRY  — guard held at impact (not mid-swing, not stunned, not dodging).
//               PERFECT PARRY if guard was pressed ≤ PERFECT_WINDOW_MS before impact
//               (more poise damage, more Arc charge, longer enemy recoil).
//    • DODGE  — dodge i-frames active at impact AND dodged away from the attack side
//               ('left' → dodge right, 'right' → dodge left; overhead/thrust → either side).
//               Dodging toward the attack side = 'wrong_dodge' (you take the hit).
//    • WARD   — Shield Ward held: blocks it fully but costs stamina, earns nothing.
//  HEAVY hit (red-gold glow + rising pulse + 'heavy_warn'):
//    • DODGE only (same side rule). Guard/parry FAILS: full damage + guard broken
//      ('parried_heavy' misread). Shield Ward REDUCES (not negates) it and drains stamina.
//  FEINT (flickering glow, Blade-Adept / shadow champion):
//    • The windup cancels before impact. Guard held at the cancel point or pressed during the
//      feint = PANIC PARRY: stamina drained, guard knocked open (GUARD_LOCKOUT_MS) and a quick
//      real follow-up (PANIC_FOLLOW_WINDUP_MS, shorter than the lockout) that must be DODGED.
//      Dodging a feint = 'bit_feint'. Correct answer: hold still → the enemy is OPEN for
//      `open` ms (strikes land in full, +bonus) → then a real light strike: parry or dodge it.
//  GREED: an impact that lands while you are mid-swing hits you ('greedy_strike'), and swinging
//    into the enemy's active follow-through gets you countered. Strikes land fully during
//    recovery / stagger / feint opening; during enemy idle they are mostly blocked (chip +
//    poise), and repeated idle pecking or long strings in recovery provoke a telegraphed riposte.
//  STANCE (Blade-Adept, Champion): while idle it guards one side (enemy.guardSide). Striking the
//    open side lands harder; striking the guarded side barely scratches.
//  POISE: strikes and parries drain enemy poise; at 0 it is STAGGERED (big punish window).
//  Every windup is ≥ 420 ms and every follow-up arrives after the player's own commitments end,
//  so the oracle bot in the tests answers every (kind, dir) the engine can produce with 0 damage.
// ──────────────────────────────────────────────────────────────────────────────────────────

import { makeRng, hashString } from '../core/rng.js';
import { resolveArchetype } from './archetypes.js';
import { OPENING_LINES, HESITATION_LINE, HESITATION_BROKEN_LINE, ROYAL_LINES, ROYAL_RALLY_LINE } from './lines.js';
import { buildMisreads, emptyMisreadCounts, misreadLabel } from './analysis.js';

export const STEP_MS = 1000 / 60;
const MAX_DT_MS = 250;

export const TUNING = Object.freeze({
  PLAYER_MAX_HP: 100,
  STAMINA_MAX: 100,
  STAMINA_REGEN_PER_S: 26,
  STAMINA_DELAY_MS: 450,

  STRIKE_DMG: 5,
  STRIKE_POISE: 7,
  STRIKE_COMMIT_MS: 300, // you are committed (can't parry/dodge) for this long per swing
  WARD_STRIKE_COMMIT_MS: 420, // striking while warding is slower
  STRIKE_COST: 6,
  WEAK_STRIKE_MULT: 0.5, // out of stamina

  DODGE_IFRAMES_MS: 300,
  DODGE_DURATION_MS: 380,
  DODGE_COOLDOWN_MS: 520,
  DODGE_COST: 12,

  PERFECT_WINDOW_MS: 200,
  PARRY_POISE: 7,
  PERFECT_POISE: 14,
  PARRY_COST: 4,

  LATE_WINDOW_MS: 260,
  EARLY_DODGE_WINDOW_MS: 380,
  BUFFER_MS: 180,

  HIT_STUN_MS: 240,
  HEAVY_STUN_MS: 420,
  GUARD_BREAK_STUN_MS: 460,

  PANIC_STAMINA: 20,
  GUARD_LOCKOUT_MS: 650,
  PANIC_FOLLOW_WINDUP_MS: 520,
  FEINT_OPEN_BONUS: 1.15,

  GREED_COUNTER_MULT: 0.6,

  ARC_DMG: 16,
  ARC_POISE: 55,
  ARC_IFRAMES_MS: 350,
  ARC_INTERRUPT_MS: 1000,
  ARC_GAIN_CLEAN_HIT: 0.07,
  ARC_GAIN_PARRY: 0.08,
  ARC_GAIN_PERFECT: 0.22,
  ARC_GAIN_DODGE: 0.05,
  ARC_GAIN_DODGE_HEAVY: 0.12,
  ARC_GAIN_FEINT_READ: 0.06,

  ROYAL_HEAL: 18,
  ROYAL_HEAL_OATH: 32,
  ROYAL_WINDOW_MS: 6000,
  ROYAL_DMG_MULT: 1.3,
  SPARKY_STAGGER_MS: 1000,

  COMBO_PER_TIER: 3, // "three clean hits without taking damage raises the combo meter"
  COMBO_TIER_BONUS: 0.1,
  COMBO_MAX_TIER: 3,

  POISE_REGEN_DELAY_MS: 2500,
  STAGGER_DMG_MULT: 1.4,
});

// Shield Ward parameters; Aegis Mastery "starts stronger".
const WARD_BASE = { drainPerS: 12, lightCost: 9, heavyCost: 22, heavyReduction: 0.55, brokenMs: 900, regenDelayMs: 600 };
const WARD_AEGIS = { drainPerS: 6, lightCost: 5, heavyCost: 12, heavyReduction: 0.8, brokenMs: 700, regenDelayMs: 400 };

// Recovery length multipliers by how the attack ended (the punish window).
const RECOVERY_MULT = { hit: 0.8, dodged: 1, parried: 1.25, perfect: 1.6, warded: 0.9, whiff: 1.1, greedy: 0.8 };

// Strike multipliers by enemy state: [damage, poise, clean?]
const STRIKE_TABLE = {
  idle: [0.35, 0.6, false],
  idle_guarded: [0.1, 0.3, false],
  idle_open: [0.6, 1, true],
  idle_warded: [0.05, 0.25, false],
  hesitate: [0.8, 1, true],
  windup: [0.25, 0.5, false],
  recovery: [1, 1, true],
  open: [TUNING.FEINT_OPEN_BONUS, 1.2, true],
  staggered: [TUNING.STAGGER_DMG_MULT, 0, true],
};

const SFX = new Set([
  'strike', 'hit', 'parry', 'perfect_parry', 'dodge', 'heavy_warn', 'telegraph', 'poise_break',
  'arc_pulse', 'royal_command', 'ward', 'victory', 'defeat', 'hurt',
]);

// ── helpers ────────────────────────────────────────────────────────────────────────────────

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function seedToInt(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  if (typeof seed === 'string') return hashString(seed);
  return 1;
}

export function correctDodgeSides(dir) {
  if (dir === 'left') return ['right'];
  if (dir === 'right') return ['left'];
  return ['left', 'right'];
}

function normDir(dir) {
  return dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right' ? dir : 'up';
}

function normalizeConfig(config = {}) {
  const m = config.modifiers || {};
  const archetypeId = ['blade_adept', 'warg_alpha', 'fallen_champion'].includes(config.archetypeId)
    ? config.archetypeId
    : 'blade_adept';
  return {
    archetypeId,
    seed: config.seed ?? 1,
    title: config.title || '',
    subtitle: config.subtitle || '',
    modifiers: {
      cycleNumber: Math.max(1, Math.floor(m.cycleNumber || 1)),
      legacies: Array.isArray(m.legacies) ? m.legacies.filter((x) => typeof x === 'string') : [],
      companion: m.companion ?? null,
      champion: m.champion || null,
      stakes: m.stakes || 'march',
    },
    allowRetreat: !!config.allowRetreat,
    // Optional scripted enemy pattern (practice / tests): [{move, dir?}] or move ids, cycled.
    script: Array.isArray(config.script) && config.script.length ? config.script.map((s) => (typeof s === 'string' ? { move: s } : { ...s })) : null,
    // Optional opening line in place of the archetype's own (training yard).
    opening: config.opening?.text ? { speaker: config.opening.speaker || 'narrator', text: String(config.opening.text) } : null,
    // Optional training goal: the duel ends in victory once the stat reaches the target.
    drill:
      config.drill && DRILL_STATS[config.drill.stat]
        ? { stat: config.drill.stat, target: Math.max(1, Math.floor(Number(config.drill.target) || 1)) }
        : null,
  };
}

// Training-yard goals (src/game/duel/drills.js): what counts toward each.
export const DRILL_STATS = Object.freeze({
  turned_aside: (s) => s.parries + s.cleanDodges,
  dodges: (s) => s.cleanDodges,
  perfect_parries: (s) => s.perfectParries,
  feints_read: (s) => s.feintsRead,
  feints_punished: (s) => s.feintsPunished,
  poise_breaks: (s) => s.poiseBreaks,
});

/** { stat, target, value, met } for a drill duel, else null. */
export function drillProgress(duel) {
  const drill = duel?.config?.drill;
  if (!drill) return null;
  const value = Math.min(drill.target, DRILL_STATS[drill.stat](duel.stats));
  return { stat: drill.stat, target: drill.target, value, met: value >= drill.target };
}

function emit(ctx, ev) {
  ctx.d.events.push({ ...ev, t: Math.round(ctx.d.timeMs) });
}
function sfx(ctx, name) {
  if (SFX.has(name)) emit(ctx, { type: 'sfx', name });
}
function fx(ctx, name, extra = {}) {
  emit(ctx, { type: 'fx', name, ...extra });
}
function line(ctx, speaker, text) {
  emit(ctx, { type: 'line', speaker, text });
}
function misread(ctx, kind, extra = {}) {
  ctx.d.misreads[kind] = (ctx.d.misreads[kind] || 0) + 1;
  emit(ctx, { type: 'misread', kind, label: misreadLabel(kind), ...extra });
}

function setState(e, state, durMs = 0) {
  e.state = state;
  e.stateMs = 0;
  e.stateDurMs = durMs;
}

function cloneDuel(d) {
  const p = d.player;
  const e = d.enemy;
  return {
    ...d,
    player: { ...p, dodge: { ...p.dodge }, buffer: p.buffer ? { ...p.buffer } : null },
    enemy: { ...e, step: e.step ? { ...e.step } : null, queue: e.queue.map((s) => ({ ...s })) },
    stats: { ...d.stats },
    misreads: { ...d.misreads },
    pendingLate: d.pendingLate ? { ...d.pendingLate } : null,
    events: [],
  };
}

// ── creation ───────────────────────────────────────────────────────────────────────────────

export function createDuel(config) {
  const cfg = normalizeConfig(config);
  const def = resolveArchetype(cfg);
  const legacies = new Set(cfg.modifiers.legacies);
  const legacy = {
    aegis: legacies.has('aegis_mastery'),
    wargTruce: legacies.has('warg_truce'),
    marasOath: legacies.has('maras_oath'),
    oathbreaker: legacies.has('oathbreakers_shadow'),
  };
  const rng = makeRng((seedToInt(cfg.seed) ^ hashString(`duel:${cfg.archetypeId}`)) >>> 0);

  const d = {
    kind: 'duel',
    version: 1,
    config: cfg,
    archetypeId: cfg.archetypeId,
    def,
    legacy,
    ward: legacy.aegis ? WARD_AEGIS : WARD_BASE,
    rngSeed: 0,
    tick: 0,
    timeMs: 0,
    accumMs: 0,
    phase: 'fight',
    outcome: null,
    endedAtMs: null,
    player: {
      hp: TUNING.PLAYER_MAX_HP,
      maxHp: TUNING.PLAYER_MAX_HP,
      stamina: TUNING.STAMINA_MAX,
      maxStamina: TUNING.STAMINA_MAX,
      staminaDelayMs: 0,
      guardHeld: false,
      guardPressedAt: -1e9,
      guardLockoutMs: 0,
      wardHeld: false,
      wardBrokenMs: 0,
      dodge: { active: false, side: null, elapsedMs: 0, cooldownMs: 0, iframeEndAt: -1e9 },
      swingMs: 0,
      swingDurMs: 0,
      swingDir: null,
      swingResult: null,
      stunMs: 0,
      invulnMs: 0,
      combo: 0,
      comboTier: 0,
      arcCharge: 0,
      royalUsed: false,
      royalWindowMs: 0,
      buffer: null,
      lastHitAt: -1e9,
      lastParryAt: -1e9,
    },
    enemy: {
      hp: def.maxHp,
      maxHp: def.maxHp,
      poise: def.maxPoise,
      maxPoise: def.maxPoise,
      poiseDelayMs: 0,
      state: 'idle',
      stateMs: 0,
      stateDurMs: def.graceMs,
      step: null,
      queue: [],
      moveId: null,
      lastMoveId: null,
      guardSide: def.stance ? rng.pick(['left', 'right']) : null,
      idleStrikes: 0,
      recoveryStrikes: 0,
      riposteQueued: false,
      recoveryReason: null,
      lastResult: null,
      hesitating: false,
      firstAttackAt: null,
      attacksStarted: 0,
    },
    telegraph: null,
    stats: {
      cleanHits: 0,
      strikes: 0,
      perfectParries: 0,
      parries: 0,
      cleanDodges: 0,
      maxCombo: 0,
      poiseBreaks: 0,
      panicParries: 0,
      heavyHitsTaken: 0,
      feintsBitten: 0,
      feintsRead: 0,
      feintsPunished: 0,
      usedRoyalCommand: false,
      usedArcPulse: false,
      arcPulses: 0,
      damageTaken: 0,
      damageDealt: 0,
      attacksFaced: 0,
      hitsTaken: 0,
    },
    misreads: emptyMisreadCounts(),
    pendingLate: null,
    stepSeq: 0,
    scriptIndex: 0,
    events: [],
  };

  const ctx = { d, rng };
  // Opening line + hesitation.
  if (cfg.opening) {
    line(ctx, cfg.opening.speaker, cfg.opening.text);
  } else if (cfg.archetypeId === 'fallen_champion') {
    const pool = OPENING_LINES.fallen_champion[def.style] || OPENING_LINES.fallen_champion.generic;
    const ln = rng.pick(pool);
    line(ctx, ln.speaker, ln.text);
  } else {
    const ln = rng.pick(OPENING_LINES[cfg.archetypeId]);
    line(ctx, ln.speaker, ln.text);
  }
  if (def.hesitation) {
    setState(d.enemy, 'hesitate', def.hesitationMs);
    d.enemy.hesitating = true;
    line(ctx, HESITATION_LINE.speaker, HESITATION_LINE.text);
  }

  d.rngSeed = rng.seed;
  d.telegraph = computeTelegraph(d);
  return d;
}

// ── stepping ───────────────────────────────────────────────────────────────────────────────

export function stepDuel(duel, inputs = [], dtMs = STEP_MS) {
  if (!duel) return duel;
  if (duel.phase === 'over') return duel.events.length ? { ...duel, events: [] } : duel;
  const d = cloneDuel(duel);
  const ctx = { d, rng: makeRng(d.rngSeed) };

  for (const input of inputs || []) {
    if (d.phase === 'over') break;
    if (input && typeof input === 'object') applyInput(ctx, input);
  }

  const dt = Number.isFinite(dtMs) ? Math.min(MAX_DT_MS, Math.max(0, dtMs)) : 0;
  d.accumMs += dt;
  while (d.accumMs + 1e-6 >= STEP_MS && d.phase !== 'over') {
    d.accumMs -= STEP_MS;
    tick(ctx);
  }
  if (d.accumMs < 0) d.accumMs = 0;

  d.telegraph = computeTelegraph(d);
  d.rngSeed = ctx.rng.seed;
  return d;
}

function tick(ctx) {
  const { d } = ctx;
  d.tick += 1;
  d.timeMs = d.tick * STEP_MS;
  updatePlayer(ctx, STEP_MS);
  if (d.phase === 'over') return;
  updateEnemy(ctx, STEP_MS);
  if (d.phase === 'over') return;
  if (d.pendingLate && d.timeMs > d.pendingLate.untilMs) {
    misread(ctx, 'no_response', { heavy: d.pendingLate.heavy });
    d.pendingLate = null;
  }
  if (d.config.drill && drillProgress(d).met) endDuel(ctx, 'victory');
}

// ── input ──────────────────────────────────────────────────────────────────────────────────

function applyInput(ctx, input) {
  const { d } = ctx;
  const p = d.player;
  switch (input.type) {
    case 'guard': {
      const down = !!input.down;
      if (down && !p.guardHeld) {
        p.guardPressedAt = d.timeMs;
        onGuardPressed(ctx);
      }
      p.guardHeld = down;
      break;
    }
    case 'ward': {
      const down = !!input.down;
      if (down && !p.wardHeld && p.wardBrokenMs <= 0) sfx(ctx, 'ward');
      p.wardHeld = down;
      break;
    }
    case 'strike':
      tryAct(ctx, { type: 'strike', dir: normDir(input.dir) });
      break;
    case 'dodge':
      tryAct(ctx, { type: 'dodge', side: input.side === 'right' ? 'right' : 'left' });
      break;
    case 'arc':
      fireArc(ctx);
      break;
    case 'royal':
      fireRoyal(ctx);
      break;
    case 'retreat':
      if (d.config.allowRetreat) endDuel(ctx, 'retreat');
      break;
    default:
      break;
  }
}

function onGuardPressed(ctx) {
  const { d } = ctx;
  const e = d.enemy;
  if (e.state === 'windup' && e.step && e.step.kind === 'feint') e.step.baited = true;
  const pl = d.pendingLate;
  if (pl && d.timeMs <= pl.untilMs) {
    misread(ctx, pl.heavy ? 'parried_heavy' : 'late_guard', { heavy: pl.heavy });
    d.pendingLate = null;
  }
}

function blockedFor(p, action) {
  // ms until the player could perform `action`, or Infinity if impossible right now.
  let wait = 0;
  if (p.stunMs > 0) wait = Math.max(wait, p.stunMs);
  if (p.swingMs > 0) wait = Math.max(wait, p.swingMs);
  if (p.dodge.active) wait = Math.max(wait, TUNING.DODGE_DURATION_MS - p.dodge.elapsedMs);
  if (action.type === 'dodge' && p.dodge.cooldownMs > 0) wait = Math.max(wait, p.dodge.cooldownMs);
  return wait;
}

function tryAct(ctx, action) {
  const { d } = ctx;
  const p = d.player;
  const wait = blockedFor(p, action);
  if (wait <= 0) {
    doAction(ctx, action);
  } else if (wait <= TUNING.BUFFER_MS) {
    p.buffer = { ...action, untilMs: d.timeMs + TUNING.BUFFER_MS };
  }
}

function doAction(ctx, action) {
  if (action.type === 'strike') doStrike(ctx, action.dir);
  else if (action.type === 'dodge') doDodge(ctx, action.side);
}

function spendStamina(ctx, amount, delay = TUNING.STAMINA_DELAY_MS) {
  const p = ctx.d.player;
  p.stamina = Math.max(0, p.stamina - amount);
  p.staminaDelayMs = Math.max(p.staminaDelayMs, delay);
}

function wardActive(p) {
  return p.wardHeld && p.wardBrokenMs <= 0 && p.stunMs <= 0;
}

export function guardActive(p) {
  return p.guardHeld && p.guardLockoutMs <= 0 && p.swingMs <= 0 && p.stunMs <= 0 && !p.dodge.active;
}

// ── player actions ─────────────────────────────────────────────────────────────────────────

function doDodge(ctx, side) {
  const { d } = ctx;
  const p = d.player;
  const e = d.enemy;
  p.dodge = {
    active: true,
    side,
    elapsedMs: 0,
    cooldownMs: TUNING.DODGE_COOLDOWN_MS,
    iframeEndAt: d.timeMs + TUNING.DODGE_IFRAMES_MS,
  };
  spendStamina(ctx, TUNING.DODGE_COST);
  sfx(ctx, 'dodge');
  fx(ctx, 'dodge', { side });
  if (e.state === 'windup' && e.step && e.step.kind === 'feint') e.step.dodged = true;
  const pl = d.pendingLate;
  if (pl && d.timeMs <= pl.untilMs) {
    misread(ctx, 'late_dodge', { heavy: pl.heavy });
    d.pendingLate = null;
  }
}

function playerDamageMult(p) {
  const tier = Math.min(TUNING.COMBO_MAX_TIER, Math.floor(p.combo / TUNING.COMBO_PER_TIER));
  let m = 1 + tier * TUNING.COMBO_TIER_BONUS;
  if (p.royalWindowMs > 0) m *= TUNING.ROYAL_DMG_MULT;
  return m;
}

function strikeClass(e, def, dir) {
  switch (e.state) {
    case 'idle': {
      if (def.wardGuard) return 'idle_warded';
      if (e.guardSide && (dir === 'left' || dir === 'right')) return dir === e.guardSide ? 'idle_guarded' : 'idle_open';
      return 'idle';
    }
    case 'hesitate':
      return 'hesitate';
    case 'windup':
      return 'windup';
    case 'active':
      return 'active';
    case 'recovery':
      return 'recovery';
    case 'open':
      return 'open';
    case 'staggered':
      return 'staggered';
    default:
      return 'idle';
  }
}

function doStrike(ctx, dir) {
  const { d, rng } = ctx;
  const p = d.player;
  const e = d.enemy;
  const def = d.def;
  const commit = wardActive(p) ? TUNING.WARD_STRIKE_COMMIT_MS : TUNING.STRIKE_COMMIT_MS;
  const weak = p.stamina < TUNING.STRIKE_COST;
  spendStamina(ctx, TUNING.STRIKE_COST);
  p.swingMs = commit;
  p.swingDurMs = commit;
  p.swingDir = dir;
  d.stats.strikes += 1;
  sfx(ctx, 'strike');

  const cls = strikeClass(e, def, dir);
  if (cls === 'active') {
    // Swinging into a blade that is already moving: you get countered.
    const step = e.step;
    p.swingResult = 'countered';
    misread(ctx, 'greedy_strike');
    const dmg = Math.max(1, (step ? step.damage : 8) * TUNING.GREED_COUNTER_MULT * def.dmgMult);
    damagePlayer(ctx, dmg, { heavy: false, dir: step?.dir || 'thrust', cause: 'greedy' });
    return;
  }

  const [dmgMult, poiseMult, clean] = STRIKE_TABLE[cls];
  let open = false;
  let mult = dmgMult;
  // Recovery after a stance: striking the side its blade is NOT on still lands a touch harder.
  if (cls === 'recovery' && e.guardSide && (dir === 'left' || dir === 'right') && dir !== e.guardSide) {
    mult *= 1.15;
    open = true;
  }
  if (cls === 'idle_open') open = true;
  const amount = TUNING.STRIKE_DMG * mult * playerDamageMult(p) * (weak ? TUNING.WEAK_STRIKE_MULT : 1) / (def.armor || 1);
  const poise = TUNING.STRIKE_POISE * poiseMult * (weak ? TUNING.WEAK_STRIKE_MULT : 1);
  p.swingResult = clean ? 'clean' : 'blocked';

  if (clean) {
    d.stats.cleanHits += 1;
    if (cls === 'open' && e.step && !e.step.punished) {
      e.step = { ...e.step, punished: true };
      d.stats.feintsPunished += 1;
    }
    p.combo += 1;
    if (p.combo > d.stats.maxCombo) d.stats.maxCombo = p.combo;
    const tier = Math.min(TUNING.COMBO_MAX_TIER, Math.floor(p.combo / TUNING.COMBO_PER_TIER));
    if (tier > p.comboTier) {
      p.comboTier = tier;
      fx(ctx, 'combo_up', { tier });
    }
    gainArc(ctx, TUNING.ARC_GAIN_CLEAN_HIT);
    sfx(ctx, 'hit');
  } else {
    sfx(ctx, 'parry'); // steel on steel: it blocked most of it
  }
  fx(ctx, clean ? 'strike_hit' : 'strike_blocked', { dir, open, amount: Math.round(amount * 10) / 10, cls });
  emit(ctx, { type: 'damage', target: 'enemy', amount: Math.round(amount * 10) / 10, clean });

  if (cls === 'hesitate' && e.hesitating) {
    e.hesitating = false;
    e.stateDurMs = Math.min(e.stateDurMs, e.stateMs + 900);
    line(ctx, HESITATION_BROKEN_LINE.speaker, HESITATION_BROKEN_LINE.text);
  }

  damageEnemy(ctx, amount);
  if (d.phase === 'over') return;
  if (poise > 0) damagePoise(ctx, poise);

  // Duelists punish greed: pecking at its guard, or overlong strings, earn a telegraphed riposte.
  const r = def.riposte;
  if (cls.startsWith('idle')) {
    e.idleStrikes += 1;
    if (r && e.idleStrikes >= r.idleStrikes && e.state === 'idle') {
      e.riposteQueued = true;
      e.stateDurMs = Math.min(e.stateDurMs, e.stateMs + 150);
    }
    if (def.stance && rng.chance(0.35)) e.guardSide = e.guardSide === 'left' ? 'right' : 'left';
  } else if (cls === 'recovery') {
    e.recoveryStrikes += 1;
    if (r && e.recoveryStrikes >= r.recoveryStrikes) e.riposteQueued = true;
  }
}

function gainArc(ctx, amount) {
  const p = ctx.d.player;
  if (p.arcCharge >= 1) return;
  p.arcCharge = Math.min(1, p.arcCharge + amount);
  if (p.arcCharge >= 1) fx(ctx, 'arc_ready');
}

function fireArc(ctx) {
  const { d } = ctx;
  const p = d.player;
  const e = d.enemy;
  if (p.arcCharge < 1 || p.stunMs > 0) return;
  p.arcCharge = 0;
  p.invulnMs = TUNING.ARC_IFRAMES_MS;
  p.swingMs = 0;
  p.buffer = null;
  d.stats.usedArcPulse = true;
  d.stats.arcPulses += 1;
  sfx(ctx, 'arc_pulse');
  const wasStaggered = e.state === 'staggered';
  const amount = TUNING.ARC_DMG * playerDamageMult(p) * (wasStaggered ? 1.3 : 1) / (d.def.armor || 1);
  fx(ctx, 'arc_pulse', { amount: Math.round(amount * 10) / 10 });
  emit(ctx, { type: 'damage', target: 'enemy', amount: Math.round(amount * 10) / 10, clean: true, arc: true });
  p.combo += 1;
  if (p.combo > d.stats.maxCombo) d.stats.maxCombo = p.combo;
  damageEnemy(ctx, amount);
  if (d.phase === 'over') return;
  if (!wasStaggered) {
    damagePoise(ctx, TUNING.ARC_POISE);
    if (e.state === 'windup' || e.state === 'active' || e.state === 'open') interruptEnemy(ctx, TUNING.ARC_INTERRUPT_MS);
  }
}

function fireRoyal(ctx) {
  const { d, rng } = ctx;
  const p = d.player;
  if (p.royalUsed) return;
  p.royalUsed = true;
  d.stats.usedRoyalCommand = true;
  const heal = d.legacy.marasOath ? TUNING.ROYAL_HEAL_OATH : TUNING.ROYAL_HEAL;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.stamina = p.maxStamina;
  p.staminaDelayMs = 0;
  p.royalWindowMs = TUNING.ROYAL_WINDOW_MS;
  p.stunMs = 0;
  p.guardLockoutMs = 0;
  p.wardBrokenMs = 0;
  sfx(ctx, 'royal_command');
  fx(ctx, 'royal_command', { heal: Math.round(p.hp - before) });
  line(ctx, 'narrator', ROYAL_RALLY_LINE);

  const companion = d.config.modifiers.companion;
  if (companion === 'sparky') {
    line(ctx, 'sparky', rng.pick(ROYAL_LINES.sparky));
    fx(ctx, 'sparky_acid');
    if (d.enemy.state !== 'staggered') {
      damagePoise(ctx, d.enemy.maxPoise * 0.15);
      if (d.enemy.state !== 'staggered') interruptEnemy(ctx, TUNING.SPARKY_STAGGER_MS);
    }
  }
  if (d.legacy.marasOath) {
    line(ctx, 'mara', rng.pick(ROYAL_LINES.mara_oath));
  } else if (companion === 'mara') {
    line(ctx, 'mara', rng.pick(ROYAL_LINES.mara));
  } else if (companion !== 'sparky') {
    line(ctx, 'cassian', rng.pick(ROYAL_LINES.cassian));
  }
}

// ── damage ─────────────────────────────────────────────────────────────────────────────────

function damagePlayer(ctx, amount, { heavy = false, dir = null, cause = 'hit' } = {}) {
  const { d } = ctx;
  const p = d.player;
  const dmg = Math.round(amount * 10) / 10;
  p.hp = Math.max(0, p.hp - dmg);
  p.combo = 0;
  p.comboTier = 0;
  p.swingMs = 0;
  p.buffer = null;
  p.stunMs = Math.max(p.stunMs, heavy ? TUNING.HEAVY_STUN_MS : TUNING.HIT_STUN_MS);
  p.lastHitAt = d.timeMs;
  d.stats.damageTaken += dmg;
  d.stats.hitsTaken += 1;
  if (heavy) d.stats.heavyHitsTaken += 1;
  sfx(ctx, 'hurt');
  fx(ctx, 'player_hit', { heavy, dir, cause, amount: dmg });
  emit(ctx, { type: 'damage', target: 'player', amount: dmg, heavy });
  if (p.hp <= 0) endDuel(ctx, 'defeat');
}

function damageEnemy(ctx, amount) {
  const { d } = ctx;
  const e = d.enemy;
  e.hp = Math.max(0, e.hp - amount);
  d.stats.damageDealt += amount;
  if (e.hp <= 0) endDuel(ctx, 'victory');
}

function damagePoise(ctx, amount) {
  const { d } = ctx;
  const e = d.enemy;
  if (e.state === 'staggered') return;
  e.poise = Math.max(0, e.poise - amount);
  e.poiseDelayMs = TUNING.POISE_REGEN_DELAY_MS;
  if (e.poise <= 0) poiseBreak(ctx);
}

function poiseBreak(ctx) {
  const { d } = ctx;
  const e = d.enemy;
  d.stats.poiseBreaks += 1;
  e.queue = [];
  e.step = null;
  e.riposteQueued = false;
  e.interrupted = false;
  setState(e, 'staggered', d.def.staggerMs);
  sfx(ctx, 'poise_break');
  fx(ctx, 'poise_break');
}

function interruptEnemy(ctx, ms) {
  const e = ctx.d.enemy;
  e.queue = [];
  e.step = null;
  e.riposteQueued = false;
  e.interrupted = true;
  e.hesitating = false;
  setState(e, 'staggered', ms);
  fx(ctx, 'interrupt');
}

function endDuel(ctx, outcome) {
  const { d } = ctx;
  if (d.phase === 'over') return;
  if (d.pendingLate) {
    d.misreads.no_response += 1;
    d.pendingLate = null;
  }
  d.phase = 'over';
  d.outcome = outcome;
  d.endedAtMs = d.timeMs;
  d.player.guardHeld = false;
  d.player.wardHeld = false;
  if (outcome === 'victory') sfx(ctx, 'victory');
  else if (outcome === 'defeat') sfx(ctx, 'defeat');
  fx(ctx, outcome);
}

// ── player update ──────────────────────────────────────────────────────────────────────────

function updatePlayer(ctx, dt) {
  const { d } = ctx;
  const p = d.player;
  if (p.stunMs > 0) p.stunMs = Math.max(0, p.stunMs - dt);
  if (p.invulnMs > 0) p.invulnMs = Math.max(0, p.invulnMs - dt);
  if (p.guardLockoutMs > 0) p.guardLockoutMs = Math.max(0, p.guardLockoutMs - dt);
  if (p.wardBrokenMs > 0) p.wardBrokenMs = Math.max(0, p.wardBrokenMs - dt);
  if (p.royalWindowMs > 0) p.royalWindowMs = Math.max(0, p.royalWindowMs - dt);
  if (p.swingMs > 0) p.swingMs = Math.max(0, p.swingMs - dt);
  if (p.dodge.active) {
    p.dodge.elapsedMs += dt;
    if (p.dodge.elapsedMs >= TUNING.DODGE_DURATION_MS) p.dodge.active = false;
  }
  if (p.dodge.cooldownMs > 0) p.dodge.cooldownMs = Math.max(0, p.dodge.cooldownMs - dt);

  if (wardActive(p)) {
    p.stamina -= (d.ward.drainPerS * dt) / 1000;
    p.staminaDelayMs = Math.max(p.staminaDelayMs, d.ward.regenDelayMs);
    if (p.stamina <= 0) breakWard(ctx);
  } else if (p.staminaDelayMs > 0) {
    p.staminaDelayMs = Math.max(0, p.staminaDelayMs - dt);
  } else if (p.stamina < p.maxStamina) {
    p.stamina = Math.min(p.maxStamina, p.stamina + (TUNING.STAMINA_REGEN_PER_S * dt) / 1000);
  }

  if (p.buffer) {
    if (d.timeMs > p.buffer.untilMs) p.buffer = null;
    else if (blockedFor(p, p.buffer) <= 0 && !(p.buffer.type === 'strike' && d.enemy.state === 'active')) {
      // (a buffered swipe never fires into a blade that is already moving — no accidental greed)
      const action = p.buffer;
      p.buffer = null;
      doAction(ctx, action);
    }
  }
}

function breakWard(ctx) {
  const { d } = ctx;
  const p = d.player;
  p.stamina = 0;
  p.wardBrokenMs = d.ward.brokenMs;
  p.staminaDelayMs = Math.max(p.staminaDelayMs, 700);
  misread(ctx, 'ward_broken');
  fx(ctx, 'ward_broken');
}

// ── enemy update ───────────────────────────────────────────────────────────────────────────

function updateEnemy(ctx, dt) {
  const { d } = ctx;
  const e = d.enemy;
  const def = d.def;
  if (e.state !== 'staggered' && e.poise < e.maxPoise) {
    if (e.poiseDelayMs > 0) e.poiseDelayMs = Math.max(0, e.poiseDelayMs - dt);
    else e.poise = Math.min(e.maxPoise, e.poise + (def.poiseRegen * e.maxPoise * dt) / 1000);
  }
  e.stateMs += dt;
  switch (e.state) {
    case 'hesitate':
    case 'idle':
      if (e.stateMs >= e.stateDurMs) startNextMove(ctx);
      break;
    case 'windup':
      if (e.step && e.stateMs >= e.step.windup) {
        if (e.step.kind === 'feint') feintCancel(ctx);
        else impact(ctx);
      }
      break;
    case 'active':
      if (!e.step || e.stateMs >= e.step.active) afterActive(ctx);
      break;
    case 'open':
      if (e.stateMs >= e.stateDurMs) beginNextStep(ctx);
      break;
    case 'recovery':
      if (e.stateMs >= e.stateDurMs) toIdle(ctx);
      break;
    case 'staggered':
      if (e.stateMs >= e.stateDurMs) {
        if (!e.interrupted || e.poise <= 0) e.poise = e.maxPoise;
        e.interrupted = false;
        toIdle(ctx, 380);
      }
      break;
    default:
      toIdle(ctx);
  }
}

function weightedPick(rng, moves, lastId) {
  let total = 0;
  const weights = moves.map((m) => {
    const w = m.id === lastId ? m.weight * 0.45 : m.weight;
    total += w;
    return w;
  });
  let r = rng.next() * total;
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (r <= 0) return moves[i];
  }
  return moves[moves.length - 1];
}

function riposteMove(def) {
  const r = def.riposte;
  return { id: 'riposte', kind: 'light', hits: 1, dirs: r.dirs, windup: r.windup, followWindup: r.windup, active: r.active, recovery: r.recovery, damage: r.damage };
}

function nextComboDir(prev, dirs, rng) {
  const hasL = dirs.includes('left');
  const hasR = dirs.includes('right');
  if (hasL && hasR && (prev === 'left' || prev === 'right')) return prev === 'left' ? 'right' : 'left';
  return rng.pick(dirs);
}

function buildSteps(ctx, move, forcedDir) {
  const { d, rng } = ctx;
  const wm = d.def.windupMult;
  const hits = move.hits || 1;
  const steps = [];
  if (move.kind === 'feint') {
    const dir = forcedDir && move.dirs.includes(forcedDir) ? forcedDir : rng.pick(move.dirs);
    const f = move.follow;
    const fdir = forcedDir && f.dirs.includes(forcedDir) ? forcedDir : rng.pick(f.dirs);
    steps.push({ id: ++d.stepSeq, moveId: move.id, kind: 'feint', dir, windup: Math.round(move.windup * wm), active: 0, damage: 0, recovery: 0, open: move.open, index: 0, total: 1 });
    steps.push({ id: ++d.stepSeq, moveId: move.id, kind: 'light', dir: fdir, windup: Math.max(420, Math.round(f.windup * wm)), active: f.active, damage: f.damage, recovery: f.recovery, index: 0, total: 1, isFollow: true });
    return steps;
  }
  let dir = forcedDir && move.dirs.includes(forcedDir) ? forcedDir : rng.pick(move.dirs);
  for (let i = 0; i < hits; i++) {
    if (i > 0) dir = nextComboDir(dir, move.dirs, rng);
    const base = i === 0 ? move.windup : move.followWindup || move.windup;
    steps.push({
      id: ++d.stepSeq,
      moveId: move.id,
      kind: move.kind,
      dir,
      windup: Math.max(420, Math.round(base * wm)),
      active: move.active,
      damage: move.damage,
      recovery: move.recovery,
      index: i,
      total: hits,
    });
  }
  return steps;
}

function startNextMove(ctx) {
  const { d, rng } = ctx;
  const e = d.enemy;
  const def = d.def;
  let move;
  let forcedDir = null;
  if (e.riposteQueued) {
    move = riposteMove(def);
    e.riposteQueued = false;
  } else if (d.config.script) {
    const entry = d.config.script[d.scriptIndex % d.config.script.length];
    d.scriptIndex += 1;
    move = entry.move === 'riposte' ? riposteMove(def) : def.moves.find((m) => m.id === entry.move) || def.moves[0];
    forcedDir = entry.dir || null;
  } else {
    move = weightedPick(rng, def.moves, e.lastMoveId);
  }
  e.hesitating = false;
  e.queue = buildSteps(ctx, move, forcedDir);
  e.moveId = move.id;
  e.lastMoveId = move.id;
  e.idleStrikes = 0;
  e.recoveryStrikes = 0;
  e.attacksStarted += 1;
  if (e.firstAttackAt == null) e.firstAttackAt = d.timeMs;
  beginNextStep(ctx);
}

function beginNextStep(ctx) {
  const { d } = ctx;
  const e = d.enemy;
  const step = e.queue.shift();
  if (!step) {
    toRecovery(ctx, e.lastResult || 'whiff');
    return;
  }
  e.step = step;
  setState(e, 'windup', step.windup);
  sfx(ctx, 'telegraph');
  if (step.kind === 'heavy') sfx(ctx, 'heavy_warn');
  fx(ctx, 'telegraph', { kind: step.kind, dir: step.dir, stepId: step.id });
}

function feintCancel(ctx) {
  const { d } = ctx;
  const e = d.enemy;
  const p = d.player;
  const step = e.step;
  const panic = p.guardHeld || step.baited;
  const bit = !!step.dodged;
  if (panic) {
    d.stats.panicParries += 1;
    d.stats.feintsBitten += 1;
    misread(ctx, 'panic_parry');
    spendStamina(ctx, TUNING.PANIC_STAMINA, 700);
    p.guardLockoutMs = TUNING.GUARD_LOCKOUT_MS;
    fx(ctx, 'guard_baited');
    const follow = e.queue[0];
    if (follow) {
      follow.windup = TUNING.PANIC_FOLLOW_WINDUP_MS;
      follow.isPanicFollow = true;
    }
    beginNextStep(ctx);
    return;
  }
  if (bit) {
    d.stats.feintsBitten += 1;
    misread(ctx, 'bit_feint');
  } else {
    d.stats.feintsRead += 1;
    gainArc(ctx, TUNING.ARC_GAIN_FEINT_READ);
    fx(ctx, 'feint_read', { label: 'Read it! Strike the opening' });
  }
  e.step = { ...step, opened: true };
  setState(e, 'open', step.open);
}

function impact(ctx) {
  const { d } = ctx;
  const e = d.enemy;
  const p = d.player;
  const def = d.def;
  const step = e.step;
  const heavy = step.kind === 'heavy';
  const dmg = step.damage * def.dmgMult;
  d.stats.attacksFaced += 1;

  const iframes = p.dodge.active && p.dodge.elapsedMs < TUNING.DODGE_IFRAMES_MS;
  if (p.invulnMs > 0) {
    endImpact(ctx, 'whiff', true);
    return;
  }
  if (iframes) {
    if (correctDodgeSides(step.dir).includes(p.dodge.side)) {
      d.stats.cleanDodges += 1;
      gainArc(ctx, heavy ? TUNING.ARC_GAIN_DODGE_HEAVY : TUNING.ARC_GAIN_DODGE);
      fx(ctx, 'dodge_clean', { heavy, dir: step.dir });
      endImpact(ctx, 'dodged', true);
      return;
    }
    misread(ctx, 'wrong_dodge', { heavy });
    damagePlayer(ctx, dmg, { heavy, dir: step.dir, cause: 'wrong_dodge' });
    endImpact(ctx, 'hit', true);
    return;
  }

  const guardOk = guardActive(p);
  const wardOk = wardActive(p);

  if (!heavy && guardOk) {
    const perfect = d.timeMs - p.guardPressedAt <= TUNING.PERFECT_WINDOW_MS;
    d.stats.parries += 1;
    p.lastParryAt = d.timeMs;
    if (perfect) {
      d.stats.perfectParries += 1;
      sfx(ctx, 'perfect_parry');
      fx(ctx, 'perfect_parry', { dir: step.dir });
      gainArc(ctx, TUNING.ARC_GAIN_PERFECT);
      damagePoise(ctx, TUNING.PERFECT_POISE);
    } else {
      spendStamina(ctx, TUNING.PARRY_COST, 200);
      sfx(ctx, 'parry');
      fx(ctx, 'parry', { dir: step.dir });
      gainArc(ctx, TUNING.ARC_GAIN_PARRY);
      damagePoise(ctx, TUNING.PARRY_POISE);
    }
    if (d.phase === 'over' || e.state === 'staggered') return;
    endImpact(ctx, perfect ? 'perfect' : 'parried', false);
    return;
  }

  if (wardOk) {
    const w = d.ward;
    sfx(ctx, 'ward');
    if (heavy) {
      d.stats.heavyHitsTaken += 1;
      misread(ctx, 'warded_heavy');
      const cost = w.heavyCost;
      const broke = p.stamina < cost;
      spendStamina(ctx, cost, w.regenDelayMs);
      fx(ctx, 'ward_block', { heavy: true, dir: step.dir });
      if (broke) breakWard(ctx);
      const taken = dmg * (broke ? 1 - w.heavyReduction / 2 : 1 - w.heavyReduction);
      damagePlayer(ctx, taken, { heavy: false, dir: step.dir, cause: 'warded' });
      if (d.phase === 'over') return;
      endImpact(ctx, 'warded', false);
      return;
    }
    const broke = p.stamina < w.lightCost;
    spendStamina(ctx, w.lightCost, w.regenDelayMs);
    fx(ctx, 'ward_block', { heavy: false, dir: step.dir });
    if (broke) {
      breakWard(ctx);
      damagePlayer(ctx, dmg * 0.5, { heavy: false, dir: step.dir, cause: 'ward_broken' });
      if (d.phase === 'over') return;
    }
    endImpact(ctx, 'warded', false);
    return;
  }

  if (p.swingMs > 0) {
    misread(ctx, 'greedy_strike', { heavy });
    damagePlayer(ctx, dmg, { heavy, dir: step.dir, cause: 'greedy' });
    endImpact(ctx, 'greedy', true);
    return;
  }

  if (heavy && guardOk) {
    misread(ctx, 'parried_heavy', { heavy });
    fx(ctx, 'guard_broken');
    damagePlayer(ctx, dmg, { heavy, dir: step.dir, cause: 'parried_heavy' });
    p.stunMs = Math.max(p.stunMs, TUNING.GUARD_BREAK_STUN_MS);
    endImpact(ctx, 'hit', true);
    return;
  }

  // Unanswered. Was it an early dodge? Otherwise wait briefly to see if a late answer comes.
  const sinceIframes = d.timeMs - p.dodge.iframeEndAt;
  const earlyDodge = sinceIframes >= 0 && sinceIframes <= TUNING.EARLY_DODGE_WINDOW_MS;
  damagePlayer(ctx, dmg, { heavy, dir: step.dir, cause: 'unanswered' });
  if (earlyDodge) misread(ctx, 'early_dodge', { heavy });
  else if (d.phase !== 'over') d.pendingLate = { untilMs: d.timeMs + TUNING.LATE_WINDOW_MS, heavy };
  else d.misreads.no_response += 1;
  if (d.phase === 'over') return;
  endImpact(ctx, 'hit', true);
}

// After the impact resolves: blocked blows recoil straight into the next step / recovery;
// whiffs and hits follow through (`active`), during which striking back is greedy.
function endImpact(ctx, result, followThrough) {
  const e = ctx.d.enemy;
  if (ctx.d.phase === 'over') return;
  e.lastResult = result;
  if (followThrough) {
    setState(e, 'active', e.step ? e.step.active : 0);
    return;
  }
  if (e.queue.length) beginNextStep(ctx);
  else toRecovery(ctx, result);
}

function afterActive(ctx) {
  const e = ctx.d.enemy;
  if (e.queue.length) beginNextStep(ctx);
  else toRecovery(ctx, e.lastResult || 'whiff');
}

function toRecovery(ctx, reason) {
  const { d } = ctx;
  const e = d.enemy;
  const base = e.step ? e.step.recovery : 600;
  const dur = Math.round(base * (RECOVERY_MULT[reason] || 1) * d.def.recoveryMult);
  e.recoveryReason = reason;
  e.recoveryStrikes = 0;
  setState(e, 'recovery', Math.max(250, dur));
}

function toIdle(ctx, forcedMs = null) {
  const { d, rng } = ctx;
  const e = d.enemy;
  const def = d.def;
  e.step = null;
  e.queue = [];
  e.lastResult = null;
  e.idleStrikes = 0;
  if (def.stance) e.guardSide = rng.pick(['left', 'right']);
  const dur = e.riposteQueued ? 120 : forcedMs != null ? forcedMs : rng.int(def.idleMs[0], def.idleMs[1]);
  setState(e, 'idle', dur);
}

// ── telegraph / result ─────────────────────────────────────────────────────────────────────

export function telegraphColorFor(kind) {
  if (kind === 'heavy') return 'red_gold';
  if (kind === 'feint') return 'flicker';
  return 'steel';
}

function computeTelegraph(d) {
  if (d.phase === 'over') return null;
  const e = d.enemy;
  if (e.state !== 'windup' || !e.step) return null;
  const s = e.step;
  const kind = s.kind === 'combo' || (s.total > 1 && s.kind !== 'heavy') ? 'combo' : s.kind;
  return {
    stepId: s.id,
    moveId: s.moveId,
    kind,
    dir: s.dir,
    progress: clamp01(e.stateMs / s.windup),
    windupMs: s.windup,
    timeToImpactMs: Math.max(0, s.windup - e.stateMs),
    isHeavy: s.kind === 'heavy',
    isFeint: s.kind === 'feint',
    telegraphColor: telegraphColorFor(s.kind),
    comboIndex: s.index,
    comboTotal: s.total,
    followUp: !!s.isFollow,
    panicFollow: !!s.isPanicFollow,
    answer: s.kind === 'heavy' ? 'dodge' : s.kind === 'feint' ? 'wait' : 'parry_or_dodge',
    dodgeSides: correctDodgeSides(s.dir),
  };
}

export function getTelegraph(duel) {
  return duel ? computeTelegraph(duel) : null;
}

export function getDuelResult(duel) {
  if (!duel || duel.phase !== 'over') return null;
  const s = duel.stats;
  const p = duel.player;
  const e = duel.enemy;
  return {
    outcome: duel.outcome,
    archetypeId: duel.archetypeId,
    durationMs: Math.round(duel.endedAtMs),
    playerHpRemaining: Math.round((p.hp / p.maxHp) * 1000) / 1000,
    flawless: duel.outcome === 'victory' && s.damageTaken === 0,
    cleanHits: s.cleanHits,
    perfectParries: s.perfectParries,
    maxCombo: s.maxCombo,
    poiseBreaks: s.poiseBreaks,
    panicParries: s.panicParries,
    heavyHitsTaken: s.heavyHitsTaken,
    feintsBitten: s.feintsBitten,
    usedRoyalCommand: s.usedRoyalCommand,
    usedArcPulse: s.usedArcPulse,
    misreads: buildMisreads(duel.misreads),
    // Extras (beyond the contract; safe to ignore):
    enemyName: duel.def.name,
    enemyHpRemaining: Math.round((e.hp / e.maxHp) * 1000) / 1000,
    parries: s.parries,
    cleanDodges: s.cleanDodges,
    damageTaken: Math.round(s.damageTaken * 10) / 10,
    stakes: duel.config.modifiers.stakes,
    mirroredLegacy: duel.def.mirrorLegacy,
    feintsRead: s.feintsRead,
    feintsPunished: s.feintsPunished,
    drill: drillProgress(duel),
  };
}

export function isDuelOver(duel) {
  return !!duel && duel.phase === 'over';
}
