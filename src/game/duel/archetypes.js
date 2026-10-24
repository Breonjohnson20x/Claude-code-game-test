// Duel enemy archetypes (Cycle doc §6, §10): one shared rig, distinct timing.
//
// Every number here is in milliseconds or raw hit points unless noted. `resolveArchetype(config)`
// turns an archetype + duel modifiers (cycle number, legacies, stakes) into the concrete,
// immutable `def` stored on the duel. Pure data, no randomness except the seeded champion
// style pick (hashString), so the same config always yields the same def.
//
// Move shape:
//   { id, kind: 'light'|'heavy'|'combo'|'feint', weight, dirs: [...], hits?, windup,
//     followWindup?, active, recovery, damage, open?, follow? }
//   dirs: the side of the screen the blow comes FROM ('left'|'right'|'overhead'|'thrust').
//   hits > 1 → a chain; later hits use followWindup and alternate left/right when both allowed.
//   feint → a flickering windup that cancels (`open` ms exposed window), then `follow` (a real light).

import { hashString } from '../core/rng.js';

export const ARCHETYPE_IDS = ['blade_adept', 'warg_alpha', 'fallen_champion'];
export const DIRS = ['left', 'right', 'overhead', 'thrust'];

// Legacies the Fallen Champion can turn against the player, and the style each gives it.
export const MIRROR_LEGACIES = {
  aegis_mastery: 'aegis',
  warg_truce: 'warg',
  oathbreakers_shadow: 'shadow',
};

export const LEGACY_NAMES = {
  aegis_mastery: 'Aegis Mastery',
  warg_truce: 'Warg Truce',
  maras_oath: "Mara's Oath",
  oathbreakers_shadow: "Oathbreaker's Shadow",
};

const BLADE_ADEPT = {
  id: 'blade_adept',
  name: 'Syndicate Blade-Adept',
  epithet: 'Iron Syndicate duelist',
  check: 'The duelist check',
  lesson: 'Fast and dishonest. A flickering glow is a feint: wait for the real strike, or punish the opening.',
  rig: 'adept',
  maxHp: 300,
  maxPoise: 50,
  staggerMs: 1400,
  poiseRegen: 0.15, // fraction of max poise per second, after a short delay
  idleMs: [550, 1050],
  graceMs: 3200,
  stance: true, // guards one side while idle; strike the other side
  wardGuard: false,
  armor: 1,
  riposte: {
    idleStrikes: 2,
    recoveryStrikes: 3,
    windup: 470,
    active: 160,
    recovery: 620,
    damage: 8,
    dirs: ['left', 'right', 'thrust'],
  },
  moves: [
    { id: 'slash', kind: 'light', weight: 3, dirs: ['left', 'right', 'overhead'], windup: 640, active: 170, recovery: 650, damage: 9 },
    { id: 'flurry', kind: 'combo', weight: 2, hits: 3, dirs: ['left', 'right'], windup: 620, followWindup: 440, active: 150, recovery: 820, damage: 7 },
    {
      id: 'feint',
      kind: 'feint',
      weight: 2.2,
      dirs: ['left', 'right', 'overhead'],
      windup: 540,
      open: 560,
      active: 0,
      recovery: 0,
      damage: 0,
      follow: { windup: 470, active: 170, recovery: 650, damage: 9, dirs: ['left', 'right', 'thrust'] },
    },
    { id: 'lunge', kind: 'heavy', weight: 1.1, dirs: ['thrust'], windup: 950, active: 240, recovery: 1050, damage: 17 },
  ],
};

const WARG_ALPHA = {
  id: 'warg_alpha',
  name: 'Warg Alpha',
  epithet: 'First of the Frost Wargs',
  check: 'The patience check',
  lesson: 'Slow wind-ups, devastating follow-through. A red-gold glow means dodge, every time. Then punish the long recovery.',
  rig: 'warg',
  maxHp: 240,
  maxPoise: 110,
  staggerMs: 2300,
  poiseRegen: 0.1,
  idleMs: [950, 1600],
  graceMs: 3200,
  hesitationMs: 6500, // warg_truce: "It hesitates — it remembers."
  stance: false,
  wardGuard: false,
  armor: 1,
  riposte: {
    idleStrikes: 3,
    recoveryStrikes: 99,
    windup: 640,
    active: 180,
    recovery: 700,
    damage: 9,
    dirs: ['thrust'],
  },
  moves: [
    { id: 'rend', kind: 'heavy', weight: 3, dirs: ['left', 'right'], windup: 1250, active: 300, recovery: 1150, damage: 18 },
    { id: 'pounce', kind: 'heavy', weight: 1.5, dirs: ['overhead'], windup: 1450, active: 340, recovery: 1400, damage: 22 },
    { id: 'maul', kind: 'heavy', weight: 1.4, hits: 2, dirs: ['left', 'right'], windup: 1250, followWindup: 950, active: 300, recovery: 1300, damage: 16 },
    { id: 'bite', kind: 'light', weight: 2, dirs: ['thrust', 'left', 'right'], windup: 720, active: 180, recovery: 720, damage: 9 },
  ],
};

const FALLEN_CHAMPION = {
  id: 'fallen_champion',
  name: 'The Fallen Champion',
  epithet: 'Crown of a cycle undone',
  check: 'The story check',
  lesson: 'It fights with a style you have used yourself. Read the glow: steel = parry or dodge, red-gold = dodge, flicker = wait.',
  rig: 'champion',
  maxHp: 280,
  maxPoise: 80,
  staggerMs: 2000,
  poiseRegen: 0.12,
  idleMs: [700, 1300],
  graceMs: 3200,
  stance: true,
  wardGuard: false,
  armor: 1,
  riposte: {
    idleStrikes: 3,
    recoveryStrikes: 4,
    windup: 520,
    active: 170,
    recovery: 650,
    damage: 9,
    dirs: ['left', 'right', 'overhead'],
  },
  moves: [
    { id: 'royal_cut', kind: 'light', weight: 3, dirs: ['left', 'right', 'overhead'], windup: 680, active: 170, recovery: 700, damage: 10 },
    { id: 'cleave', kind: 'heavy', weight: 1.6, dirs: ['overhead', 'left', 'right'], windup: 1150, active: 280, recovery: 1150, damage: 20 },
    { id: 'spear_thrust', kind: 'light', weight: 1.2, dirs: ['thrust'], windup: 620, active: 160, recovery: 650, damage: 9 },
    { id: 'twin_cut', kind: 'combo', weight: 1.6, hits: 2, dirs: ['left', 'right'], windup: 640, followWindup: 450, active: 160, recovery: 800, damage: 8 },
  ],
};

// Extra moves layered onto the Fallen Champion by mirrored legacy.
const CHAMPION_STYLE_MOVES = {
  aegis: [{ id: 'aegis_bash', kind: 'heavy', weight: 1, dirs: ['thrust'], windup: 1050, active: 260, recovery: 1200, damage: 18 }],
  warg: [
    { id: 'rending_pair', kind: 'heavy', weight: 1.6, hits: 2, dirs: ['left', 'right'], windup: 1200, followWindup: 950, active: 300, recovery: 1300, damage: 18 },
  ],
  shadow: [
    {
      id: 'oathbreak_feint',
      kind: 'feint',
      weight: 2,
      dirs: ['left', 'right', 'overhead'],
      windup: 560,
      open: 560,
      active: 0,
      recovery: 0,
      damage: 0,
      follow: { windup: 480, active: 170, recovery: 680, damage: 10, dirs: ['left', 'right', 'thrust'] },
    },
    { id: 'shadow_flurry', kind: 'combo', weight: 1, hits: 3, dirs: ['left', 'right'], windup: 620, followWindup: 450, active: 150, recovery: 850, damage: 7 },
  ],
};

const CHAMPION_STYLE_INFO = {
  aegis: { label: 'Aegis ward', note: 'It wards like you do: strikes while it idles barely land. Punish its recoveries.' },
  warg: { label: 'Warg patience', note: 'It fights like the wolves you made peace with: paired heavies. Dodge both.' },
  shadow: { label: "Oathbreaker's feints", note: 'It lies like a broken oath: flickering feints. Do not flinch.' },
};

export const ARCHETYPES = {
  blade_adept: BLADE_ADEPT,
  warg_alpha: WARG_ALPHA,
  fallen_champion: FALLEN_CHAMPION,
};

const STAKES = {
  practice: { dmg: 0.75, hp: 0.85 },
  march: { dmg: 1, hp: 1 },
  champion: { dmg: 1.05, hp: 1.05 },
  last_stand: { dmg: 1.15, hp: 1.1 },
};

function seedKey(seed) {
  return typeof seed === 'number' ? String(seed >>> 0) : String(seed ?? 1);
}

function cloneMove(m) {
  return { hits: 1, followWindup: m.windup, open: 0, ...m, dirs: m.dirs.slice(), follow: m.follow ? { ...m.follow, dirs: m.follow.dirs.slice() } : undefined };
}

// Pick which of the player's legacies the Fallen Champion mirrors. Prefers legacies the player
// actually holds ("uses one of your past Legacies against you"); otherwise picks by seed.
export function pickChampionMirror(legacies = [], seed = 1, override = null) {
  if (override && MIRROR_LEGACIES[override]) return { legacy: override, fromPlayer: legacies.includes(override) };
  const owned = legacies.filter((l) => MIRROR_LEGACIES[l]);
  const pool = owned.length ? owned : Object.keys(MIRROR_LEGACIES);
  const idx = hashString(`${seedKey(seed)}:champion-mirror`) % pool.length;
  return { legacy: pool[idx], fromPlayer: owned.length > 0 };
}

export function resolveArchetype(config) {
  const id = ARCHETYPES[config.archetypeId] ? config.archetypeId : 'blade_adept';
  const base = ARCHETYPES[id];
  const mods = config.modifiers || {};
  const legacies = mods.legacies || [];
  const cycle = Math.max(1, Math.floor(mods.cycleNumber || 1));
  const stakes = STAKES[mods.stakes] || STAKES.march;
  const oathbreaker = legacies.includes('oathbreakers_shadow');

  const def = {
    ...base,
    riposte: { ...base.riposte, dirs: base.riposte.dirs.slice() },
    idleMs: base.idleMs.slice(),
    moves: base.moves.map(cloneMove),
    style: null,
    styleLabel: null,
    styleNote: null,
    mirrorLegacy: null,
    mirrorFromPlayer: false,
    dmgMult: stakes.dmg,
    windupMult: 1,
    recoveryMult: 1,
    hesitation: false,
    cycle,
  };

  let hpMult = stakes.hp;
  let poiseMult = 1;

  if (id === 'fallen_champion') {
    const mirror = pickChampionMirror(legacies, config.seed, mods.champion?.mirror || null);
    const style = MIRROR_LEGACIES[mirror.legacy];
    def.style = style;
    def.styleLabel = CHAMPION_STYLE_INFO[style].label;
    def.styleNote = CHAMPION_STYLE_INFO[style].note;
    def.mirrorLegacy = mirror.legacy;
    def.mirrorFromPlayer = mirror.fromPlayer;
    def.moves.push(...CHAMPION_STYLE_MOVES[style].map(cloneMove));
    if (style === 'aegis') {
      def.wardGuard = true;
      poiseMult *= 1.25;
    }
    if (style === 'shadow') def.idleMs = [600, 1150];
    if (mods.champion?.name) def.name = String(mods.champion.name);
    if (mods.champion?.epithet) def.epithet = String(mods.champion.epithet);
    // Cycle-scaled mirror enemy.
    hpMult *= Math.min(1.8, 1 + 0.1 * (cycle - 1));
    def.dmgMult *= Math.min(1.5, 1 + 0.06 * (cycle - 1));
    def.windupMult *= Math.max(0.86, 1 - 0.025 * (cycle - 1));
    poiseMult *= Math.min(1.4, 1 + 0.05 * (cycle - 1));
  } else {
    hpMult *= Math.min(1.3, 1 + 0.04 * (cycle - 1));
    def.dmgMult *= Math.min(1.25, 1 + 0.03 * (cycle - 1));
  }

  if (oathbreaker) {
    // "Enemies punish harder (high risk)": more damage, shorter punish windows,
    // slightly quicker wind-ups (still answerable: see engine fairness notes).
    def.dmgMult *= 1.25;
    def.recoveryMult *= 0.85;
    def.windupMult *= 0.93;
  }

  if (id === 'warg_alpha' && legacies.includes('warg_truce')) def.hesitation = true;

  def.maxHp = Math.round(base.maxHp * hpMult);
  def.maxPoise = Math.round(base.maxPoise * poiseMult);
  return def;
}

// Every (move, dir) pair an archetype def can produce — used by the fairness tests and the UI
// practice mode. Includes the riposte.
export function listAttackPatterns(def) {
  const out = [];
  for (const m of def.moves) {
    for (const dir of m.dirs) out.push({ move: m.id, kind: m.kind, dir, hits: m.hits || 1 });
    if (m.follow) for (const dir of m.follow.dirs) out.push({ move: m.id, kind: 'light', dir, follow: true });
  }
  for (const dir of def.riposte.dirs) out.push({ move: 'riposte', kind: 'light', dir });
  return out;
}
