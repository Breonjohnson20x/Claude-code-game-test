// Canonical GameState for OmniStrategy: Empire of Elvia.
// The simulation owns truth (Master Build §19). UI and narrative generators only
// read this object; every change goes through core/effects.js (validate -> apply).

export const STATE_VERSION = 1;

export const TURNS_PER_CYCLE = 5;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const RESOURCE_KEYS = ['treasury', 'manpower', 'readiness', 'stability', 'unrest', 'intel'];
// Visible HUD keys (Master Build §17). `intel` is tracked but surfaced only through Cassian.
export const HUD_KEYS = ['treasury', 'manpower', 'readiness', 'stability', 'unrest'];

export const RESOURCE_BOUNDS = {
  treasury: [0, 99999],
  manpower: [0, 99999],
  readiness: [0, 100],
  stability: [0, 100],
  unrest: [0, 100],
  intel: [0, 100],
};

export const REL_KEYS = ['trust', 'respect', 'affection', 'resentment', 'fear'];
export const REL_BOUNDS = {
  trust: [-100, 100],
  respect: [-100, 100],
  affection: [-100, 100],
  resentment: [0, 100],
  fear: [0, 100],
};

export const CIV_MEMORY_KEYS = ['liberator', 'conqueror', 'oathbreaker', 'peacemaker'];
export const REGION_STATES = ['STABLE', 'FORTIFIED', 'AFTERMATH'];
export const THREAD_STATUSES = ['active', 'dormant', 'resolved'];
export const THREAD_VISIBILITY = ['hidden', 'rumored', 'known'];

export const PHASES = {
  WAR_ROOM: 'war_room',
  RESOLUTION: 'resolution',
  EXPEDITION: 'expedition',
  CAMPFIRE: 'campfire',
  PASSING: 'passing',
};

export const CHARACTER_IDS = ['mara', 'vale', 'cassian', 'sparky', 'mika', 'nyra'];
export const FACTION_IDS = ['iron_syndicate', 'frost_wargs'];
export const THREAD_IDS = [
  'IRON_SYNDICATE_BORDER_CRISIS',
  'FROST_WARG_MIGRATION',
  'NORTHERN_REFUGEES',
  'FIRST_ARCHITECTS_MYSTERY',
];

// Counters that earn Legacies (Cycle doc §3). Incremented only by validated effects.
export const COUNTER_KEYS = [
  'wardProjects',
  'wargMercy',
  'valeFunded',
  'chronicleApproved',
  'sparkyCare',
  'oathsBroken',
  'trialWins',
  'duelsWon',
  'duelsLost',
  'retreats',
];

function rel(trust, respect, affection, resentment = 0, fear = 0) {
  return { trust, respect, affection, resentment, fear };
}

export function createCharacters() {
  return {
    mara: {
      id: 'mara',
      name: 'General Mara Voss',
      short: 'Mara',
      role: 'Commander of the First Royal Army',
      status: 'active',
      companion: true,
      age: 41,
      generation: 0,
      rel: rel(25, 30, 10),
    },
    vale: {
      id: 'vale',
      name: 'Dr. Elias Vale',
      short: 'Vale',
      role: 'Director of Advanced Sciences',
      status: 'active',
      companion: false,
      age: 38,
      generation: 0,
      rel: rel(20, 15, 20),
    },
    cassian: {
      id: 'cassian',
      name: 'Director Cassian Rey',
      short: 'Cassian',
      role: 'Royal Intelligence Directorate',
      status: 'active',
      companion: false,
      age: 52,
      generation: 0,
      rel: rel(10, 25, 0),
    },
    sparky: {
      id: 'sparky',
      name: 'Sparky',
      short: 'Sparky',
      role: 'Royal companion · young Acid Drake',
      status: 'active',
      companion: true,
      age: 6,
      generation: 0,
      rel: rel(40, 10, 45),
    },
    mika: {
      id: 'mika',
      name: 'Mika',
      short: 'Mika',
      role: 'Northern refugee child',
      status: 'unmet',
      companion: false,
      age: 9,
      generation: 0,
      rel: rel(0, 0, 0),
    },
    nyra: {
      id: 'nyra',
      name: 'Lieutenant Nyra Kell',
      short: 'Nyra',
      role: 'Iron Syndicate walker pilot',
      status: 'unmet',
      companion: false,
      age: 24,
      generation: 0,
      rel: rel(-10, 0, 0, 10, 0),
    },
  };
}

export function createFactions() {
  return {
    iron_syndicate: {
      id: 'iron_syndicate',
      name: 'The Iron Syndicate',
      leader: 'Chancellor Adrian Vex',
      attitude: -20,
      tension: 45,
      memory: { liberator: 0, conqueror: 0, oathbreaker: 0, peacemaker: 0 },
    },
    frost_wargs: {
      id: 'frost_wargs',
      name: 'The Frost Wargs',
      leader: 'Warg Queen Skaela',
      attitude: -35,
      tension: 30,
      memory: { liberator: 0, conqueror: 0, oathbreaker: 0, peacemaker: 0 },
    },
  };
}

export function createThreads() {
  const base = (id, title, extra) => ({
    id,
    title,
    status: 'active',
    stage: 0,
    visibility: 'known',
    urgency: 30,
    involvedCharacters: [],
    involvedFactions: [],
    lastAdvancedTurn: 0,
    generational: false,
    flags: {},
    ...extra,
  });
  return {
    IRON_SYNDICATE_BORDER_CRISIS: base('IRON_SYNDICATE_BORDER_CRISIS', 'Walkers on the Southern Border', {
      urgency: 55,
      involvedCharacters: ['mara', 'cassian', 'nyra'],
      involvedFactions: ['iron_syndicate'],
    }),
    FROST_WARG_MIGRATION: base('FROST_WARG_MIGRATION', 'The Frost Warg Migration', {
      urgency: 35,
      visibility: 'rumored',
      involvedCharacters: ['sparky'],
      involvedFactions: ['frost_wargs'],
    }),
    NORTHERN_REFUGEES: base('NORTHERN_REFUGEES', 'Refugees from the North', {
      urgency: 45,
      involvedCharacters: ['mika', 'mara'],
    }),
    FIRST_ARCHITECTS_MYSTERY: base('FIRST_ARCHITECTS_MYSTERY', 'A Broken Circle', {
      urgency: 5,
      visibility: 'hidden',
      generational: true,
      involvedCharacters: ['vale'],
    }),
  };
}

export function createRegions() {
  return {
    southern_marches: {
      id: 'southern_marches',
      name: 'Southern Marches',
      subtitle: 'Crownlands Frontier',
      state: 'STABLE',
      casualties: 0,
      damage: 0,
      monuments: [],
    },
  };
}

export function createCounters() {
  return Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0]));
}

export function createNewGame({ seed = 1, sovereignName = 'Aurelian', startYear = 412 } = {}) {
  return {
    version: STATE_VERSION,
    campaignId: `elvia-${seed.toString(36)}`,
    rngSeed: seed >>> 0,
    phase: PHASES.WAR_ROOM,
    cycle: {
      number: 1,
      sovereign: { name: sovereignName, ordinal: 'I', title: 'God-King of Elvia' },
      startYear,
      activeLegacies: [],
      cause: null,
    },
    year: startYear,
    turn: 1,
    totalTurns: 0,
    resources: { treasury: 1400, manpower: 4200, readiness: 52, stability: 61, unrest: 22, intel: 15 },
    factions: createFactions(),
    characters: createCharacters(),
    memories: [],
    flags: {},
    counters: createCounters(),
    threads: createThreads(),
    regions: createRegions(),
    intensity: 25,
    campfire: { cooldown: 0, history: [], offer: null },
    chronicle: [],
    decisions: [],
    voices: [],
    expedition: null,
    lastExpedition: null,
    trial: { lastRewardedKey: null, count: 0, pending: null, last: null },
    lastResolution: null,
    passing: null,
    history: [], // compact summaries of completed cycles (dynasty view inside the reign save)
  };
}

export function seasonOf(turn) {
  return SEASONS[(turn - 1) % SEASONS.length];
}

// state.year advances when the season wraps (see actions.endTurn), so turn 5 is "Spring 413".
export function seasonLabel(state) {
  return `${seasonOf(state.turn)} ${state.year} E.R.`;
}

export function sovereignTitle(state) {
  const s = state.cycle.sovereign;
  return `${s.name} ${s.ordinal}`;
}

export function clamp(value, [min, max]) {
  return Math.max(min, Math.min(max, value));
}
