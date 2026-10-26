// Presentation words for the march. Pure helpers: labels, speaker names, duel-outcome copy.
// Every outcome itself comes from the game layer; this only decides how to say it.

import { MISREAD_INFO } from '../../../game/duel/analysis.js';

/** Short rail labels for each beat id (src/game/content/expedition.js EXPEDITION_KINDS). */
export const BEAT_RAIL_LABEL = {
  road: 'Road',
  checkpoint: 'Checkpoint',
  wilds: 'Wilds',
  ruin: 'Ruin',
  champion: 'Champion',
  skirmish: 'Skirmish',
  last_stand: 'Last Stand',
  camp: 'Camp',
};

/** Longer names used in sentences ("Behind you, at the Greywater checkpoint"). */
export const BEAT_PLACE = {
  road: 'the frontier road',
  checkpoint: 'the Greywater checkpoint',
  wilds: 'the frontier wilds',
  ruin: 'the broken circle',
  champion: 'Greywater Ford',
  skirmish: 'Greywater',
  last_stand: 'the siege lines',
  camp: 'the forward camp',
};

// People the Sovereign has not been introduced to yet are named by what you can see.
const UNMET_NAME = {
  mika: 'A girl on a cart wheel',
  nyra: 'The walker pilot',
};

const FALLBACK_NAME = {
  mara: 'General Mara Voss',
  sparky: 'Sparky',
  vale: 'Dr. Elias Vale',
  cassian: 'Director Cassian Rey',
  mika: 'Mika',
  nyra: 'Lieutenant Nyra Kell',
};

export function speakerName(state, id) {
  const c = state?.characters?.[id];
  if (c && c.status === 'unmet' && UNMET_NAME[id]) return UNMET_NAME[id];
  return c?.name ?? FALLBACK_NAME[id] ?? 'A voice on the road';
}

/**
 * Typographic quotes for authored prose ("x" → “x”, it's → it’s). Display only; button labels are
 * left exactly as authored so they stay stable accessible names.
 */
export function smartQuotes(text) {
  return String(text ?? '')
    .replace(/(^|[\s([{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}

/** Strip one pair of surrounding straight quotes ("…" → …) so cards can draw their own. */
export function unquote(text) {
  const t = String(text ?? '').trim();
  return t.length > 1 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
export function ordinalWord(n) {
  return ORDINAL[n] ?? `${n}th`;
}

/** How the Sovereign walked away, in words (never a number). */
export function woundWords(hp) {
  if (hp == null) return null;
  if (hp >= 0.95) return 'Not a scratch on you.';
  if (hp >= 0.65) return 'You walk away whole.';
  if (hp >= 0.3) return 'Bloodied, but standing.';
  return 'Barely standing.';
}

const OUTLASTED = {
  kind: 'outlasted',
  title: 'Outlasted',
  advice: 'You read it cleanly; it simply outlasted you. Strike more while it recovers, break its poise, and spend Arc Pulse when the sigil glows.',
};

/** The lessons to show after a duel: on defeat always at least one ("name why you lost"). */
export function duelLessons(lastDuel) {
  if (!lastDuel) return [];
  const list = (lastDuel.misreads ?? []).map((m) => ({ kind: m.kind, title: MISREAD_INFO[m.kind]?.title ?? 'Misread', advice: m.advice, count: m.count }));
  if (!list.length && lastDuel.outcome === 'defeat') return [OUTLASTED];
  return list;
}

/** Banner copy for a finished duel on the march. */
export function duelBanner(lastDuel, beatId) {
  if (!lastDuel) return null;
  const foe = lastDuel.enemyName ?? 'your foe';
  const again = lastDuel.attempt > 1 ? ` On the ${ordinalWord(lastDuel.attempt)} attempt.` : '';
  if (lastDuel.outcome === 'victory') {
    return {
      tone: 'victory',
      eyebrow: 'Single combat · Victory',
      title: `You bested ${foe}`,
      line: `${woundWords(lastDuel.playerHpRemaining) ?? ''}${again}`.trim(),
    };
  }
  if (lastDuel.outcome === 'retreat') {
    return {
      tone: 'retreat',
      eyebrow: 'Single combat · Withdrawn',
      title: `You yielded the circle to ${foe}`,
      line: 'You chose to live. The realm will remember that you did.',
    };
  }
  return {
    tone: 'defeat',
    eyebrow: beatId === 'last_stand' ? 'The last stand · Defeat' : 'Single combat · Defeat',
    title: `${foe} put you down`,
    line: beatId === 'last_stand' ? 'This is where this life ends. The Chronicle will say how.' : `Defeat is not the end of the march.${again}`,
  };
}
