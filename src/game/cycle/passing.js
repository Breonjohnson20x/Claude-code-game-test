// The Passing (Cycle doc §2, §8 "The Passing in 4 steps"):
//   1. Final campfire — whoever stands with you, speaks.
//   2. The Chronicle is read back in the world's words.
//   3. You choose 1–2 earned Legacies.
//   4. The mantle passes — new cycle, older world; the first briefing cites your history.
// Pure: (state, input) => state. The controller performs saves and the dynasty commit.

import { commitEffects } from '../core/effects.js';
import { makeRng } from '../core/rng.js';
import {
  PHASES, createNewGame, createThreads, createFactions, createRegions, createCounters, sovereignTitle, seasonLabel,
} from '../core/state.js';
import { relationshipLabel, atLeast, civilizationLabel } from '../core/relationships.js';
import { incarnationName } from '../content/names.js';
import { legacyStatus, earnedLegacies, validateLegacyChoice, legacyName } from '../content/legacies.js';
import { chron, heat, voice, mem, region, fac, thread, SYN, WARGS, T_MYSTERY } from '../content/effectHelpers.js';
import { borderOutcome } from '../content/crises.js';

export const PASSING_STEPS = ['campfire', 'chronicle', 'legacies', 'mantle'];
export const CYCLE_CAUSES = ['fall', 'era', 'abdication'];

// Soldiers hand over the army; spymasters the Directorate; scientists simply refuse to retire.
const RETIRE_AGE = { mara: 68, cassian: 75, vale: 86 };
const CHILD_NAMES = ['Wren', 'Tamsin', 'Ilsa', 'Rue', 'Kestra', 'Orla', 'Yara', 'Sabeth', 'Lio', 'Maren'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function commit(state, effects) {
  return commitEffects(state, effects).state;
}

// ─── Step 0: the Turning ────────────────────────────────────────────────────────────────

function turningChronicle(state, cause) {
  const who = sovereignTitle(state);
  if (cause === 'fall') {
    return chron(`The Fall of ${who}`, `${who} fell at the Siege of the Marches in ${seasonLabel(state)}. The Lattice held the thread.`, 'passing', ['passing']);
  }
  if (cause === 'abdication') {
    return chron(`${who} Lays Down the Crown`, `In ${seasonLabel(state)}, ${who} gave the crown back by choice. The Council did not know what to do with its hands.`, 'passing', ['passing']);
  }
  return chron(`An Era Closes: the Reign of ${who}`, `With the thaw of ${state.year} E.R., the reign of ${who} passed into the Chronicle.`, 'passing', ['passing']);
}

/** Enter the Passing. Cause: 'fall' | 'era' | 'abdication'. */
export function beginPassing(state, cause = 'era') {
  if (!CYCLE_CAUSES.includes(cause)) throw new Error(`Unknown cycle cause "${cause}"`);
  if (state.phase === PHASES.PASSING) return state;
  const effects = [turningChronicle(state, cause), heat(15, 'the passing')];
  if (cause === 'fall') {
    effects.push(
      region({ monument: { id: `cairn_${state.cycle.number}`, title: `The Cairn of ${sovereignTitle(state)}`, text: 'stones piled by soldiers where their Sovereign fell at the Siege of the Marches' } }),
    );
  }
  if (cause === 'abdication') {
    effects.push(region({ monument: { id: `empty_throne_${state.cycle.number}`, title: 'The Empty Chair', text: 'a stone chair at the ford, carved for a Sovereign who chose to stand up from it' } }));
  }
  let s = commit(state, effects);
  s = {
    ...s,
    phase: PHASES.PASSING,
    expedition: null,
    cycle: { ...s.cycle, cause },
    passing: {
      cause,
      step: 'campfire',
      earned: earnedLegacies(s),
      chosen: [],
      startedAtTurn: s.turn,
    },
  };
  return s;
}

// ─── Step 1: final campfire ─────────────────────────────────────────────────────────────

const STANDS_WITH_YOU = ['active', 'met', 'recruited', 'released'];

function farewellFor(state, id) {
  const ch = state.characters[id];
  const label = relationshipLabel(ch.rel);
  const warm = atLeast(ch.rel, 'Fond') || atLeast(ch.rel, 'Trusted');
  const cold = label === 'Hostile' || label === 'Wary';
  const fell = state.passing?.cause === 'fall' || state.cycle.cause === 'fall';
  const abdicated = (state.passing?.cause ?? state.cycle.cause) === 'abdication';
  switch (id) {
    case 'mara':
      if (cold) return '"I served the crown," Mara says. "I want that written down exactly. The crown. Not you."';
      if (fell) return warm
        ? 'Mara kneels by the fire with your banner across her knees. "I told you I\'d be right behind you. I was. I\'ll keep the fire lit for the next one."'
        : '"You rode out," Mara says. "Whatever else they write, write that you rode out."';
      if (abdicated) return '"Most kings have to be dragged off that chair," Mara says. "You stood up. I don\'t understand it. I think I respect it."';
      return warm
        ? '"My father held a wall," Mara says. "I held a border, beside you. That\'s a better story. Tell the next one I said so."'
        : '"It was a hard reign, Majesty. You made it harder in some places and easier in others. That\'s more than most."';
    case 'vale':
      return warm
        ? '"I\'ll be old when you come back," Vale says, fiddling with a lens. "Older. Ask me about the lights under the ice. I\'ll have an answer by then. Probably the wrong one!"'
        : '"I kept notes," Vale says. "On everything. Somebody should."';
    case 'cassian':
      return cold
        ? 'Cassian says nothing at all. Later you will learn he burned three files the night you passed.'
        : '"Every Sovereign leaves secrets," Cassian says. "Yours were mostly honest ones. That will make my successor\'s job harder."';
    case 'sparky':
      return ch.rel.fear >= 20
        ? 'Sparky watches from the edge of the light. When the fire burns low he creeps close enough to touch your boot, just once.'
        : 'Sparky climbs into your lap, as he always does, and falls asleep with his chin on your knee. His scales are warm. He does not know what tomorrow is. That is a mercy.';
    case 'mika':
      if (state.flags.mika_family === 'helped') return `${ch.short} has walked a long way from the northern camps to sit at this fire. She does not say anything. She does not have to.`;
      return null;
    case 'nyra':
      if (ch.status === 'recruited') return '"I came to your border to stop a God-King," Nyra says. "I stayed because one of them listened. Don\'t make me regret it next time."';
      if (ch.status === 'released') return 'A letter arrives from Kessrin, unsigned, in a pilot\'s blunt hand: "You sent me home. I am still deciding what that means."';
      return null;
    default:
      return null;
  }
}

/** The companions who speak at the final campfire (only those who still stand with you). */
export function passingFarewells(state) {
  const order = ['mara', 'vale', 'cassian', 'mika', 'nyra', 'sparky'];
  return order
    .filter((id) => STANDS_WITH_YOU.includes(state.characters[id]?.status))
    .map((id) => ({ id, name: state.characters[id].name, tier: relationshipLabel(state.characters[id].rel), line: farewellFor(state, id) }))
    .filter((f) => f.line);
}

// ─── Step 2: the Chronicle read back in the world's words ───────────────────────────────

function worldVoiceFor(entry) {
  const tags = entry.tags ?? [];
  if (tags.includes('nyra')) return 'In Kessrin, the academies teach it this way';
  if (tags.includes('mika')) return 'In Halden, the refugees\' town, they say';
  if (tags.includes('wargs')) return 'In the north, the trappers tell it';
  if (tags.includes('mystery') || entry.kind === 'discovery') return 'Scholars of the Lattice still argue over this';
  if (entry.kind === 'duel' || entry.kind === 'battle') return 'Soldiers in the Marches sing it like this';
  if (entry.kind === 'era') return 'The histories of Elvia open the chapter here';
  if (entry.kind === 'loss') return 'At Greywater there is a wall with names on it';
  if (entry.kind === 'passing') return 'And the last line of the reign';
  return 'The Chronicle records';
}

/**
 * Read back this cycle's Chronicle (write-only — nothing is changed). Campfire entries stay
 * private. Approved entries come back with the Chronicler's detail.
 */
export function chronicleReadback(state, { limit = 12 } = {}) {
  const own = state.chronicle.filter((e) => e.cycle === state.cycle.number && e.kind !== 'campfire');
  const ranked = own.map((e, i) => ({ e, i, score: (e.approved ? 3 : 0) + (['era', 'duel', 'battle', 'passing', 'loss'].includes(e.kind) ? 2 : 0) + (e.tags?.length ? 1 : 0) }));
  const keep = new Set(ranked.slice().sort((a, b) => b.score - a.score || a.i - b.i).slice(0, limit).map((r) => r.i));
  const lines = ranked
    .filter((r) => keep.has(r.i))
    .map(({ e }) => ({
      id: e.id,
      title: e.title,
      year: e.year,
      voice: worldVoiceFor(e),
      text: e.text,
      detail: e.approved ? e.detail ?? null : null,
      approved: Boolean(e.approved),
    }));
  const verdicts = Object.values(state.factions).map((f) => {
    const label = civilizationLabel(f.memory);
    return {
      faction: f.id,
      name: f.name,
      label: label.label,
      text: label.key ? `${f.name} will remember this reign as ${label.label} — ${label.gloss}.` : `${f.name} has not yet decided what this reign was.`,
    };
  });
  return { sovereign: sovereignTitle(state), years: `${state.cycle.startYear}–${state.year} E.R.`, lines, verdicts };
}

// ─── Steps 1→2→3 navigation, Step 3: Legacies ───────────────────────────────────────────

export function advancePassing(state) {
  if (state.phase !== PHASES.PASSING) throw new Error('advancePassing outside the Passing');
  const step = state.passing.step;
  const next = step === 'campfire' ? 'chronicle' : step === 'chronicle' ? 'legacies' : step;
  return { ...state, passing: { ...state.passing, step: next } };
}

export function passingLegacyOptions(state) {
  return legacyStatus(state);
}

function historyKeys(state) {
  const f = state.flags;
  return {
    refugees_policy: f.refugees_policy ?? null,
    mika_family: f.mika_family ?? null,
    child_name: state.characters.mika.short,
    nyra_fate: f.nyra_fate ?? null,
    architect_studied: Boolean(f.architect_studied),
    accord: f.accord_broken ? 'broken' : f.accord_sworn ? 'sworn' : null,
    era_policy: f.era_policy ?? null,
    border_outcome: borderOutcome(state),
    warg_mercy: state.counters.wargMercy,
    duels_won: state.counters.duelsWon,
    duels_lost: state.counters.duelsLost,
  };
}

export function cycleHistoryEntry(state, chosen) {
  const own = state.chronicle.filter((e) => e.cycle === state.cycle.number);
  const highlights = own
    .filter((e) => e.kind !== 'campfire')
    .sort((a, b) => Number(Boolean(b.approved)) - Number(Boolean(a.approved)) || (b.kind === 'era') - (a.kind === 'era'))
    .slice(0, 5)
    .map((e) => e.title);
  return {
    cycle: state.cycle.number,
    sovereign: sovereignTitle(state),
    sovereignName: state.cycle.sovereign.name,
    sovereignOrdinal: state.cycle.sovereign.ordinal,
    startYear: state.cycle.startYear,
    endYear: state.year,
    cause: state.passing?.cause ?? state.cycle.cause ?? 'era',
    legacies: [...chosen],
    highlights,
    keys: historyKeys(state),
    civilization: Object.fromEntries(Object.values(state.factions).map((f) => [f.id, civilizationLabel(f.memory).label])),
  };
}

/** Step 3. Validates the choice, writes it to the Chronicle, records the reign in history. */
export function chooseLegacies(state, ids) {
  if (state.phase !== PHASES.PASSING) throw new Error('chooseLegacies outside the Passing');
  const check = validateLegacyChoice(state, ids);
  if (!check.ok) return { state, error: check.error };
  const who = sovereignTitle(state);
  const effects = check.chosen.length
    ? check.chosen.map((id) => chron(`Legacy: ${legacyName(id)}`, `${who} chose to carry ${legacyName(id)} across the Passing.`, 'legacy', ['legacy', id]))
    : [chron('No Legacy Carried', `${who} carried nothing across the Passing. Everything became history instead.`, 'legacy', ['legacy'])];
  let s = commit(state, effects);
  const entry = cycleHistoryEntry(s, check.chosen);
  const history = [...s.history.filter((h) => h.cycle !== entry.cycle), entry];
  s = { ...s, history, passing: { ...s.passing, chosen: check.chosen, step: 'mantle' } };
  return { state: s, error: null };
}

// ─── Step 4: the mantle passes ──────────────────────────────────────────────────────────

function inherit(rel, factor, floor = 0) {
  return {
    trust: Math.round(rel.trust * factor),
    respect: Math.round(rel.respect * factor),
    affection: Math.round(rel.affection * factor * 0.8),
    resentment: Math.max(floor, Math.round(rel.resentment * factor)),
    fear: Math.round(rel.fear * factor * 0.6),
  };
}

function strongestMemory(state, characterId) {
  return state.memories
    .filter((m) => m.characterId === characterId && m.cycle === state.cycle.number)
    .sort((a, b) => b.emotionalWeight * (0.5 + Math.abs(b.sentiment)) - a.emotionalWeight * (0.5 + Math.abs(a.sentiment)))[0];
}

function heirName(base, generation) {
  return generation <= 1 ? `${base} the Younger` : `${base} ${ROMAN[Math.min(generation + 1, 10)]}`;
}

function nextCharacters(prev, state, gap, chosen, rng) {
  const fresh = createNewGame().characters;
  const out = {};
  const inheritedMemories = [];
  for (const id of Object.keys(fresh)) {
    const old = prev[id];
    const base = fresh[id];
    const aged = (old.age ?? base.age) + gap;
    if (id === 'mika') {
      // A new child at the checkpoint each generation. The last one grew up; history keeps her.
      const short = rng.pick(CHILD_NAMES.filter((n) => n !== old.short));
      out.mika = { ...base, name: short, short, generation: (old.generation ?? 0) + 1, status: 'unmet', rel: { trust: 0, respect: 0, affection: 0, resentment: 0, fear: 0 } };
      continue;
    }
    if (id === 'sparky') {
      const line = chosen.includes('sparkys_line');
      out.sparky = {
        ...base,
        age: 3,
        generation: (old.generation ?? 0) + 1,
        role: line ? "Royal companion · Acid Drake of Sparky's line — found you early" : "Royal companion · a wary Acid Drake hatchling of Sparky's line",
        rel: line ? { trust: 40, respect: 10, affection: 45, resentment: 0, fear: 0 } : { trust: 10, respect: 0, affection: 20, resentment: 0, fear: 5 },
      };
      inheritedMemories.push(mem('sparky', 'THE_LINE_REMEMBERS', line ? 'Something in the blood knows this Sovereign. It came looking.' : 'A stranger who smells faintly of someone the line once loved.', line ? 5 : 2, line ? 0.8 : 0.2, { kind: 'inherited' }));
      continue;
    }
    if (id === 'nyra') {
      const fate = state.flags.nyra_fate;
      if (fate === 'released') {
        out.nyra = { ...old, age: aged, name: 'Chancellor Nyra Kell', short: 'Nyra', role: 'Chancellor of the Iron Syndicate', status: 'met', rel: inherit(old.rel, 0.85) };
      } else if (fate === 'recruited') {
        out.nyra = { ...old, age: aged, short: 'Nyra', role: 'Marshal of the Southern Marches (retired)', status: 'retired', rel: inherit(old.rel, 0.85) };
      } else if (fate === 'killed') {
        out.nyra = { ...old, age: old.age, status: 'dead' };
      } else if (fate === 'captured') {
        out.nyra = { ...old, age: aged, role: 'Memoirist, Kessrin', status: 'departed', rel: inherit(old.rel, 0.7) };
      } else {
        out.nyra = { ...base, status: old.status === 'unmet' ? 'departed' : old.status, age: aged, rel: inherit(old.rel, 0.7) };
      }
      continue;
    }
    if (aged > (RETIRE_AGE[id] ?? 80)) {
      const generation = (old.generation ?? 0) + 1;
      const rootName = fresh[id].name;
      out[id] = {
        ...base,
        name: heirName(rootName, generation),
        age: id === 'mara' ? 33 : id === 'cassian' ? 46 : 41,
        generation,
        role: `${base.role} · heir of the house`,
        status: 'active',
        rel: inherit(old.rel, 0.5),
      };
      const memory = strongestMemory(state, id);
      inheritedMemories.push(
        mem(id, 'INHERITED_OPINION_OF_THE_CROWN', memory ? `My family's story of the last Sovereign: "${memory.description}"` : 'My family never said much about the last Sovereign. That says something too.', 4, memory ? memory.sentiment * 0.6 : 0, { kind: 'inherited' }),
      );
    } else {
      out[id] = { ...old, age: aged, rel: inherit(old.rel, 0.85) };
    }
  }
  if (chosen.includes('maras_oath')) {
    out.mara = { ...out.mara, rel: { ...out.mara.rel, trust: out.mara.rel.trust + 15, respect: out.mara.rel.respect + 20 } };
  }
  return { characters: out, inheritedMemories };
}

function nextFactions(prev, state, chosen) {
  const base = createFactions();
  const out = {};
  for (const id of Object.keys(base)) {
    const old = prev[id];
    const b = base[id];
    const memory = { ...old.memory }; // civilization memory never decays by waiting (Cycle doc §4)
    const label = civilizationLabel(memory).key;
    let tension = b.tension + (label === 'conqueror' || label === 'oathbreaker' ? 10 : label === 'peacemaker' ? -10 : 0);
    let attitude = Math.round(b.attitude + (old.attitude - b.attitude) * 0.5);
    out[id] = { ...b, memory, tension, attitude };
  }
  if (state.flags.nyra_fate === 'released') out[SYN].leader = 'Chancellor Nyra Kell';
  else out[SYN].leader = 'Chancellor Lys Vex';
  if (chosen.includes('warg_truce')) {
    out[WARGS] = { ...out[WARGS], attitude: Math.max(out[WARGS].attitude, 20), tension: Math.max(0, out[WARGS].tension - 10) };
  }
  if (chosen.includes('oathbreakers_shadow')) {
    const grudge = Object.values(out).sort((a, b) => b.memory.oathbreaker - a.memory.oathbreaker)[0]?.id ?? SYN;
    out[grudge] = { ...out[grudge], attitude: out[grudge].attitude - 15, tension: Math.min(100, out[grudge].tension + 20) };
  }
  return out;
}

function generationalVoices(state, entry) {
  const k = entry.keys;
  const v = [];
  if (entry.cause === 'fall') v.push(voice('An old soldier in Harrowmere', '"I was nineteen at the Siege. I saw you go down. You look different now. You stand the same."'));
  if (entry.cause === 'abdication') v.push(voice('A Citadel archivist', '"The last one gave the crown back. Nobody has ever explained why to my satisfaction."'));
  if (k.refugees_policy === 'granted') v.push(voice('A Halden schoolteacher', '"My grandmother crossed the northern road the year your last incarnation opened it. She kept the travel paper. It is framed in our kitchen."'));
  if (k.refugees_policy === 'removed') v.push(voice('A northern ballad singer', '"We still sing the one about the closed gate. You won\'t like the last verse."'));
  if (k.nyra_fate === 'killed') v.push(voice('A Syndicate cadet, overheard at Greywater', '"They teach us about Lieutenant Kell first. Before drill. Before anything."'));
  if (k.warg_mercy >= 2) v.push(voice('A northern trapper', '"The packs leave our traps alone now. My father said the old Sovereign made a deal. I think it was something gentler than a deal."'));
  if (!v.length) v.push(voice('A ferryman at Greywater', '"New face, same crown. The river doesn\'t care. I do, a little."'));
  return v.slice(0, 3);
}

/** Step 4. Builds the next incarnation's world from the old one. */
export function beginNextCycle(state) {
  if (state.phase !== PHASES.PASSING) throw new Error('beginNextCycle outside the Passing');
  if (state.passing.step !== 'mantle') throw new Error('Choose Legacies before the mantle passes');
  const chosen = state.passing.chosen;
  const entry = state.history.find((h) => h.cycle === state.cycle.number) ?? cycleHistoryEntry(state, chosen);
  const rng = makeRng(state.rngSeed);
  const gap = rng.int(38, 42);
  const previous = state.history.map((h) => ({ name: h.sovereignName ?? h.sovereign?.split(' ')[0], ordinal: h.sovereignOrdinal }));
  const incarnation = incarnationName(rng, previous);
  const startYear = state.year + gap;

  const { characters, inheritedMemories } = nextCharacters(state.characters, state, gap, chosen, rng);
  const factions = nextFactions(state.factions, state, chosen);

  const threads = createThreads();
  const mystery = state.threads[T_MYSTERY];
  threads[T_MYSTERY] = { ...threads[T_MYSTERY], stage: mystery.stage, visibility: mystery.visibility, urgency: mystery.urgency, flags: { ...mystery.flags } };

  const regions = createRegions();
  regions.southern_marches = { ...regions.southern_marches, monuments: [...state.regions.southern_marches.monuments] };

  const fresh = createNewGame({ seed: state.rngSeed, startYear });
  const flags = {};
  if (chosen.includes('maras_oath')) flags.legacy_maras_oath_turns = 3;
  if (chosen.includes('architects_mark')) flags.architect_vision = true;
  if (chosen.includes('vales_notes')) flags.vale_head_start = true;

  let s = {
    ...state,
    phase: PHASES.WAR_ROOM,
    rngSeed: rng.seed,
    cycle: {
      number: state.cycle.number + 1,
      sovereign: { name: incarnation.name, ordinal: incarnation.ordinal, title: 'God-King of Elvia' },
      startYear,
      activeLegacies: [...chosen],
      cause: null,
    },
    year: startYear,
    turn: 1,
    totalTurns: state.totalTurns + 1,
    resources: { ...fresh.resources, stability: fresh.resources.stability - (entry.cause === 'fall' ? 5 : entry.cause === 'abdication' ? 3 : 0) },
    factions,
    characters,
    flags,
    counters: createCounters(),
    threads,
    regions,
    intensity: 20, // falls during early-cycle rebuilding (Cycle doc §8)
    campfire: { cooldown: 0, history: state.campfire.history, offer: null },
    voices: [],
    expedition: null,
    lastExpedition: null,
    trial: { lastRewardedKey: null, count: 0, pending: null, last: null },
    lastResolution: null,
    passing: null,
    history: state.history.some((h) => h.cycle === entry.cycle) ? state.history : [...state.history, entry],
  };

  const opening = [
    chron(
      `The Return: ${incarnation.name} ${incarnation.ordinal}`,
      `${gap} years after ${entry.sovereign}, the Lattice wove the Sovereign again: ${incarnation.name} ${incarnation.ordinal}, God-King of Elvia, in ${startYear} E.R.`,
      'passing',
      ['return'],
    ),
    ...inheritedMemories,
    ...generationalVoices(s, entry),
  ];
  if (chosen.includes('architects_mark')) {
    opening.push(
      thread(T_MYSTERY, { visibility: 'known', urgency: 10, stage: 1 }),
      chron('A Vision of the Broken Circle', 'On the first night of the new reign the Sovereign dreamed of a broken circle around a small star, and woke knowing how to draw it.', 'discovery', ['mystery']),
    );
  }
  if (factions[SYN].leader === 'Chancellor Nyra Kell') opening.push(fac(SYN, { attitude: 5 }));
  s = commit(s, opening);
  return s;
}

export { earnedLegacies };
