// Presentation helpers for the Chronicle, the dossier and the Passing. Pure reads of GameState —
// words only, never raw relationship numbers or NarrativeIntensity.

import { seasonOf } from '../../../game/core/state.js';
import { legacyName } from '../../../game/content/legacies.js';

export const PEN_GOAL = 3;

/** Kind → icon (kit Icon name, or a local glyph handled by KindIcon) and a readable word. */
export const KIND_META = {
  decision: { icon: 'scroll', label: 'Decree' },
  event: { icon: 'alert', label: 'Event' },
  personal: { icon: 'heart', label: 'Personal' },
  duel: { icon: 'sword', label: 'Single combat' },
  battle: { icon: 'flag', label: 'Battle' },
  loss: { icon: 'stone', label: 'Loss' },
  era: { icon: 'crown', label: 'An era' },
  discovery: { icon: 'circle', label: 'Discovery' },
  campfire: { icon: 'fire', label: 'By the fire' },
  passing: { icon: 'quill', label: 'The Passing' },
  legacy: { icon: 'seal', label: 'Legacy' },
  oath: { icon: 'seal', label: 'Oath' },
  diplomacy: { icon: 'council', label: 'Diplomacy' },
};

export function kindMeta(kind) {
  return KIND_META[kind] ?? { icon: 'scroll', label: 'Record' };
}

const TAG_LABELS = {
  mika: 'The refugee child',
  nyra: 'Nyra Kell',
  mara: 'Mara Voss',
  vale: 'Vale',
  cassian: 'Cassian',
  sparky: 'Sparky',
  wargs: 'The Frost Wargs',
  syndicate: 'The Iron Syndicate',
  mystery: 'The Broken Circle',
  passing: 'The Passing',
  return: 'The Return',
  legacy: 'Legacy',
};

export function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  const named = legacyName(tag);
  if (named !== tag) return named;
  return String(tag)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Campfire words stay private (the Passing read-back leaves them out; the badge does not count them). */
export function isPrivate(entry) {
  return entry.kind === 'campfire';
}

/** The game accepts approval for this reign's unapproved entries (actions.approveChronicle + effects 'approval'). */
export function isApprovable(state, entry) {
  return entry.cycle === state.cycle.number && !entry.approved && !isPrivate(entry);
}

export function entryWhen(entry) {
  return entry.turn ? `${seasonOf(entry.turn)} ${entry.year} E.R.` : `${entry.year} E.R.`;
}

export const CAUSE_WORD = {
  fall: 'Fell in battle',
  era: 'An era closed',
  abdication: 'Laid down the crown',
};

export function causeWord(cause) {
  return CAUSE_WORD[cause] ?? 'Passed into the Chronicle';
}

export function romanNumeral(n) {
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let v = Math.max(1, Math.floor(Number(n) || 1));
  let out = '';
  for (const [k, s] of map) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}

/** One label block per reign: the current one from state.cycle, finished ones from state.history. */
export function reignInfo(state, cycleNumber) {
  if (cycleNumber === state.cycle.number) {
    const s = state.cycle.sovereign;
    const done = state.history.find((h) => h.cycle === cycleNumber);
    return {
      cycle: cycleNumber,
      numeral: romanNumeral(cycleNumber),
      sovereign: `${s.name} ${s.ordinal}`,
      years: state.year > state.cycle.startYear ? `${state.cycle.startYear}–${state.year} E.R.` : `from ${state.cycle.startYear} E.R.`,
      status: done ? causeWord(done.cause) : state.phase === 'passing' ? 'The Passing' : 'Reigning now',
      current: true,
      legacies: state.cycle.activeLegacies ?? [],
    };
  }
  const h = state.history.find((x) => x.cycle === cycleNumber);
  if (!h) return { cycle: cycleNumber, numeral: romanNumeral(cycleNumber), sovereign: `Reign ${romanNumeral(cycleNumber)}`, years: '', status: 'Remembered', current: false, legacies: [] };
  return {
    cycle: cycleNumber,
    numeral: romanNumeral(cycleNumber),
    sovereign: h.sovereign,
    years: `${h.startYear}–${h.endYear} E.R.`,
    status: causeWord(h.cause),
    current: false,
    legacies: h.legacies ?? [],
  };
}

/** Chronicle grouped by reign: current reign first, then earlier reigns newest first. Entries stay in written order. */
export function reignGroups(state, scope = 'reign') {
  const byCycle = new Map();
  for (const e of state.chronicle) {
    if (!byCycle.has(e.cycle)) byCycle.set(e.cycle, []);
    byCycle.get(e.cycle).push(e);
  }
  if (!byCycle.has(state.cycle.number)) byCycle.set(state.cycle.number, []);
  const cycles = [...byCycle.keys()].sort((a, b) => {
    if (a === state.cycle.number) return -1;
    if (b === state.cycle.number) return 1;
    return b - a;
  });
  const chosen = scope === 'all' ? cycles : cycles.filter((c) => c === state.cycle.number);
  return chosen.map((c) => ({ info: reignInfo(state, c), entries: byCycle.get(c) }));
}
