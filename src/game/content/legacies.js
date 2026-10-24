// Legacies: choose what survives you (Cycle doc §3). A Legacy must be earned in play
// first; at the Passing the player keeps one or two. Each opens a door and closes another.

import { atLeast, relationshipLabel } from '../core/relationships.js';

export const MAX_LEGACIES = 2;

export const LEGACIES = {
  maras_oath: {
    id: 'maras_oath',
    name: "Mara's Oath",
    earn: 'End a cycle with Mara at Trusted or higher.',
    effect: 'Mara (or her heir) starts one relationship tier higher. Camp readiness +1 in the first three turns.',
    cost: 'The Voss line expects the Crown to keep faith. Breaking it will cost more.',
    check: (s) => ({ earned: atLeast(s.characters.mara.rel, 'Trusted'), progress: `Mara stands at ${tierWord(s.characters.mara.rel)}` }),
  },
  aegis_mastery: {
    id: 'aegis_mastery',
    name: 'Aegis Mastery',
    earn: 'Complete two ward or shield projects in one cycle.',
    effect: 'Ward projects are stronger and finish one step faster. Shield Ward in duels starts with a small bonus.',
    cost: 'You will be known as the Crown that builds walls of light. Kessrin will plan for it.',
    check: (s) => ({ earned: s.counters.wardProjects >= 2, progress: `${s.counters.wardProjects} of 2 ward projects` }),
  },
  warg_truce: {
    id: 'warg_truce',
    name: 'Warg Truce',
    earn: 'Choose mercy with the Frost Wargs at least twice.',
    effect: 'Frost Wargs start Cordial instead of Wary. Warg Alpha duels open with a hesitation window.',
    cost: 'The north will expect mercy. Breaking the truce will be remembered for a century.',
    check: (s) => ({ earned: s.counters.wargMercy >= 2, progress: `${s.counters.wargMercy} of 2 acts of mercy` }),
  },
  architects_mark: {
    id: 'architects_mark',
    name: "Architect's Mark",
    earn: 'Investigate the ruin and choose to study the broken circle.',
    effect: 'The symbol appears in visions and unlocks Lattice dialogue. Pure story power, real consequences.',
    cost: 'Something under the ice will know your name before you know its.',
    check: (s) => ({ earned: Boolean(s.flags.architect_studied), progress: s.flags.architect_studied ? 'You studied the broken circle' : 'The broken circle is still unread' }),
  },
  vales_notes: {
    id: 'vales_notes',
    name: "Vale's Notes",
    earn: "Fund Vale's research through one full project.",
    effect: 'Research costs less. One research option is revealed early each cycle.',
    cost: 'The Syndicate reads Vale\'s notes too. They will fear every lamp you light.',
    check: (s) => ({ earned: s.counters.valeFunded >= 1, progress: `${s.counters.valeFunded} of 1 funded project` }),
  },
  chroniclers_pen: {
    id: 'chroniclers_pen',
    name: "The Chronicler's Pen",
    earn: 'Approve detailed Chronicle entries three times.',
    effect: 'The Chronicle records more detail, unlocking more callbacks and evidence in future reigns.',
    cost: 'Everything you do will be written down. Everything.',
    check: (s) => ({ earned: s.counters.chronicleApproved >= 3, progress: `${s.counters.chronicleApproved} of 3 entries approved` }),
  },
  sparkys_line: {
    id: 'sparkys_line',
    name: "Sparky's Line",
    earn: 'Keep Sparky fed, safe, and included at campfires.',
    effect: "The drake bloodline remembers you. Sparky's descendant finds you early and starts Fond.",
    cost: 'A drake who loves you is a drake who follows you into every fight.',
    check: (s) => {
      const attended = s.campfire.history.some((h) => h.cycle === s.cycle.number && h.mode !== 'skip');
      const safe = s.characters.sparky.status === 'active' && s.characters.sparky.rel.fear < 20;
      const fed = s.counters.sparkyCare >= 2;
      return {
        earned: attended && safe && fed,
        progress: [fed ? 'fed' : 'not fed enough', safe ? 'safe' : 'frightened', attended ? 'at the fire' : 'never at a campfire'].join(' · '),
      };
    },
  },
  oathbreakers_shadow: {
    id: 'oathbreakers_shadow',
    name: "Oathbreaker's Shadow",
    earn: 'Break a sworn oath in a recorded decision.',
    effect: 'Start with one grudge faction that will test you early. Duel enemies punish harder.',
    cost: 'High risk. The highest narrative payoff in the game.',
    check: (s) => ({ earned: s.counters.oathsBroken >= 1, progress: s.counters.oathsBroken >= 1 ? 'An oath lies broken in the Chronicle' : 'Every oath kept' }),
  },
};

export const LEGACY_IDS = Object.keys(LEGACIES);

function tierWord(rel) {
  return relationshipLabel(rel);
}

/** Every Legacy with whether this cycle earned it and a progress line. */
export function legacyStatus(state) {
  return LEGACY_IDS.map((id) => {
    const def = LEGACIES[id];
    const { earned, progress } = def.check(state);
    return { id, name: def.name, earn: def.earn, effect: def.effect, cost: def.cost, earned, progress };
  });
}

export function earnedLegacies(state) {
  return legacyStatus(state).filter((l) => l.earned).map((l) => l.id);
}

/** Validates a Passing choice. Returns { ok, chosen, error }. */
export function validateLegacyChoice(state, ids) {
  const list = [...new Set(Array.isArray(ids) ? ids : [])];
  if (list.length > MAX_LEGACIES) return { ok: false, chosen: [], error: `Choose at most ${MAX_LEGACIES} Legacies.` };
  const earned = new Set(earnedLegacies(state));
  const unearned = list.filter((id) => !earned.has(id));
  if (unearned.length) return { ok: false, chosen: [], error: `Not earned this cycle: ${unearned.map((id) => LEGACIES[id]?.name ?? id).join(', ')}.` };
  return { ok: true, chosen: list, error: null };
}

export function legacyName(id) {
  return LEGACIES[id]?.name ?? id;
}
