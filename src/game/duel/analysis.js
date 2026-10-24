// "What you misread" — the post-duel breakdown that lets a first-time player name why they lost
// (Cycle doc success test: "loses the first duel, can name why, wins the rematch").
// Pure: turns the engine's misread counters into short, kind, actionable advice.

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

// kind → { label (in-fight callout), title, advice(count) }
export const MISREAD_INFO = {
  parried_heavy: {
    label: "Heavy! Dodge, don't parry",
    title: 'Parried a heavy',
    advice: (n) => `You tried to parry ${n} heavy ${plural(n, 'strike')}. A red-gold glow means DODGE. No blade stops that weight.`,
  },
  panic_parry: {
    label: 'Feint! Your guard was baited',
    title: 'Panic parry',
    advice: (n) =>
      `You raised your guard at ${n} ${plural(n, 'feint')}. A flickering glow is a bluff: hold still, then answer the real strike, or hit the opening.`,
  },
  bit_feint: {
    label: 'Feint! You dodged a bluff',
    title: 'Dodged a feint',
    advice: (n) => `You dodged ${n} ${plural(n, 'feint')}. Flicker means fake. Wait for a steady glow before you move.`,
  },
  greedy_strike: {
    label: 'Greedy: hit mid-swing',
    title: 'Greedy strike',
    advice: (n) =>
      `You were hit ${n} ${plural(n, 'time')} while swinging. Strike while it recovers or is staggered, never while its blade is already moving.`,
  },
  wrong_dodge: {
    label: 'Wrong way: dodge away from it',
    title: 'Dodged into it',
    advice: (n) => `You dodged into ${n} ${plural(n, 'strike')}. Dodge AWAY from the side it winds up on. Overheads and thrusts: either side works.`,
  },
  early_dodge: {
    label: 'Too early',
    title: 'Dodged too early',
    advice: (n) => `${n} ${plural(n, 'dodge')} came too early. Wait for the glow to peak; a dodge only protects you for a moment.`,
  },
  late_guard: {
    label: 'Guard a beat late',
    title: 'Late guard',
    advice: (n) => `Your guard came a beat late ${n} ${plural(n, 'time')}. Raise it as the glow peaks, just before the blow lands.`,
  },
  late_dodge: {
    label: 'Dodge a beat late',
    title: 'Late dodge',
    advice: (n) => `Your dodge came a beat late ${n} ${plural(n, 'time')}. Move as the glow peaks, not after the blow.`,
  },
  no_response: {
    label: 'Answer it: parry or dodge',
    title: 'No answer',
    advice: (n) => `${n} ${plural(n, 'attack')} landed with no answer. Steel glow: parry or dodge. Red-gold: dodge. Flicker: wait.`,
  },
  warded_heavy: {
    label: 'Ward softened it; a dodge takes none',
    title: 'Warded a heavy',
    advice: (n) => `Shield Ward softened ${n} heavy ${plural(n, 'blow')}, but a clean dodge takes no damage at all.`,
  },
  ward_broken: {
    label: 'Ward broken: out of stamina',
    title: 'Ward broke',
    advice: (n) => `Your ward broke ${n} ${plural(n, 'time')} when stamina ran dry. Lower it between attacks to recover.`,
  },
};

export const MISREAD_KINDS = Object.keys(MISREAD_INFO);

export function emptyMisreadCounts() {
  const out = {};
  for (const k of MISREAD_KINDS) out[k] = 0;
  return out;
}

// Teaching priority when counts tie: the lesson most likely to flip the rematch first.
const PRIORITY = [
  'parried_heavy',
  'panic_parry',
  'greedy_strike',
  'wrong_dodge',
  'no_response',
  'bit_feint',
  'late_guard',
  'late_dodge',
  'early_dodge',
  'ward_broken',
  'warded_heavy',
];

export function buildMisreads(counts = {}) {
  return PRIORITY.filter((k) => (counts[k] || 0) > 0)
    .map((k) => ({ kind: k, count: counts[k], advice: MISREAD_INFO[k].advice(counts[k]) }))
    .sort((a, b) => b.count - a.count || PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
}

export function misreadLabel(kind) {
  return MISREAD_INFO[kind]?.label || '';
}

// Post-duel card copy. Kind on defeat, honest on victory.
export function summarizeDuel(result, def = null) {
  if (!result) return null;
  const misreads = result.misreads || [];
  let title;
  let line;
  if (result.outcome === 'victory') {
    title = result.flawless ? 'Flawless Victory' : 'Victory';
    line = result.flawless ? 'Not a scratch. The circle is yours.' : 'The circle is yours.';
  } else if (result.outcome === 'retreat') {
    title = 'Retreated';
    line = 'You yield the circle. The realm will remember you chose to live.';
  } else {
    title = 'Withdrawn';
    line = 'The Sovereign withdraws: wounded, noted, remembered.';
  }

  let tips;
  if (result.outcome === 'victory') {
    tips = misreads.slice(0, 2);
  } else {
    tips = misreads.slice(0, 4);
    if (!tips.length && result.outcome === 'defeat') {
      tips = [
        {
          kind: 'outlasted',
          count: 0,
          advice:
            'You read it cleanly; it simply outlasted you. Strike more while it recovers, break its poise, and spend Arc Pulse when the sigil glows.',
        },
      ];
    }
  }
  const lesson = def?.lesson || null;
  return { title, line, tips, lesson };
}
