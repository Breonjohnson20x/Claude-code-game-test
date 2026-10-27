// Presentation words shared by the War Room and the Resolution report. No game logic:
// these only turn values the game already computed into readable English.

import { useSyncExternalStore } from 'react';

export const ADVISOR_IDS = ['mara', 'cassian', 'vale'];

export function reactionWord(r) {
  if (r === 'approves') return 'approves';
  if (r === 'doubts') return 'has doubts';
  if (r === 'objects') return 'objects';
  return 'is undecided';
}

export const TARGET_WORDS = {
  iron_syndicate: 'the Iron Syndicate',
  frost_wargs: 'the Frost Wargs',
  refugees: 'the northern refugees',
  mystery: 'the lights in the north',
};

export const CATEGORY_WORDS = {
  diplomacy: 'Diplomacy',
  military: 'Military',
  clandestine: 'Clandestine',
  research: 'Research / Magic',
  economic: 'Economic / Infrastructure',
};

export function categoryWords(category) {
  return String(category ?? '')
    .split('+')
    .filter(Boolean)
    .map((c) => CATEGORY_WORDS[c] ?? c)
    .join(' + ');
}

export function weightWord(w) {
  if (w >= 0.99) return 'Full effort';
  if (w >= 0.55) return `Split focus · ${Math.round(w * 100)}%`;
  return `Spread thin · ${Math.round(w * 100)}%`;
}

export function threadUrgency(thread) {
  if (thread.status === 'resolved') return { word: 'Resolved', tone: 'parchment' };
  if (thread.status === 'dormant') return { word: 'Dormant', tone: 'iron' };
  const u = thread.urgency ?? 0;
  if (u >= 70) return { word: 'Urgent', tone: 'crimson' };
  if (u >= 45) return { word: 'Pressing', tone: 'ember' };
  if (u >= 20) return { word: 'Simmering', tone: 'iron' };
  return { word: 'Quiet', tone: 'frost' };
}

export const KIND_WORDS = {
  decision: 'Decision',
  battle: 'Battle',
  oath: 'Oath',
  era: 'Era',
  discovery: 'Discovery',
  duel: 'Single combat',
  loss: 'The fallen',
  event: 'Event',
  personal: 'Personal',
  campfire: 'Campfire',
};

export const REGION_WORDS = {
  STABLE: { label: 'Stable', line: 'The Southern Marches are quiet again: open roads, working farms, soldiers who sleep at night.' },
  FORTIFIED: { label: 'Fortified', line: 'Barricades, Aegis pylons and Royal Army pickets now hold the Southern Marches.' },
  AFTERMATH: { label: 'Aftermath', line: 'The Southern Marches carry the scars of fighting: broken iron in the fords, smoke over the farms.' },
};

export function sentimentWord(s) {
  if (s >= 0.45) return 'Remembers this warmly';
  if (s >= 0.15) return 'Remembers this kindly';
  if (s <= -0.45) return 'Remembers this bitterly';
  if (s <= -0.15) return 'Remembers this uneasily';
  return 'Will not forget';
}

export function outcomeWord(outcome) {
  if (outcome === 'victory') return 'Victory';
  if (outcome === 'defeat') return 'Defeat';
  if (outcome === 'retreat') return 'Withdrew';
  return 'Undecided';
}

const ROMAN = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function roman(n) {
  let v = Math.max(1, Math.floor(Number(n) || 1));
  let out = '';
  for (const [k, s] of ROMAN) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}

/** "+232" / "−3" with a real minus sign. */
export function signed(n) {
  if (n > 0) return `+${n.toLocaleString('en-US')}`;
  if (n < 0) return `−${Math.abs(n).toLocaleString('en-US')}`;
  return '0';
}

// ─── Reduced motion: OS setting or <html data-motion="reduced"> (the in-game toggle) ──────

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readReduced() {
  try {
    const root = globalThis.document?.documentElement;
    if (root?.dataset?.motion === 'reduced') return true;
    if (root?.dataset?.motion === 'full') return false;
    return Boolean(globalThis.matchMedia?.(MOTION_QUERY).matches);
  } catch {
    return false;
  }
}

function subscribeReduced(cb) {
  let mq = null;
  let mo = null;
  try {
    mq = globalThis.matchMedia?.(MOTION_QUERY) ?? null;
    mq?.addEventListener?.('change', cb);
    if (typeof MutationObserver !== 'undefined' && globalThis.document) {
      mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    }
  } catch {
    // no media queries here; motion stays as first read
  }
  return () => {
    mq?.removeEventListener?.('change', cb);
    mo?.disconnect();
  };
}

/** True when animation should be skipped. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, readReduced, () => true);
}
