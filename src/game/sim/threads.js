// World threads (Master Build §21): lightweight narrative threads that only
// advance when relevant. Unaddressed active threads grow more urgent; when
// urgency boils over, the thread advances a stage and produces a world event.

const PASSIVE_URGENCY = {
  IRON_SYNDICATE_BORDER_CRISIS: 8,
  FROST_WARG_MIGRATION: 6,
  NORTHERN_REFUGEES: 5,
  FIRST_ARCHITECTS_MYSTERY: 0,
};

// Effects applied when a thread boils over (urgency >= 85) without being addressed.
const BOIL_OVER = {
  IRON_SYNDICATE_BORDER_CRISIS: (state) => ({
    title: 'Walkers test the border',
    text:
      state.regions.southern_marches.state === 'FORTIFIED'
        ? 'A Syndicate walker lance probes the Marches at night, finds Aegis pylons and Royal Army pickets, and withdraws before dawn.'
        : 'A Syndicate walker lance probes the Marches at night and burns an undefended toll-house before withdrawing.',
    effects:
      state.regions.southern_marches.state === 'FORTIFIED'
        ? [
            { type: 'resource', key: 'readiness', delta: -3 },
            { type: 'intensity', delta: 6, reason: 'border probe' },
          ]
        : [
            { type: 'resource', key: 'stability', delta: -5 },
            { type: 'region', region: 'southern_marches', damage: 10 },
            { type: 'intensity', delta: 8, reason: 'border raid' },
          ],
  }),
  FROST_WARG_MIGRATION: () => ({
    title: 'A northern village empties',
    text: 'The village of Holloway is found empty, doors open, fires still warm. Huge tracks circle it and lead south — toward Elvia.',
    effects: [
      { type: 'resource', key: 'unrest', delta: 4 },
      { type: 'thread', thread: 'FROST_WARG_MIGRATION', visibility: 'known' },
      { type: 'intensity', delta: 6, reason: 'warg sign' },
    ],
  }),
  NORTHERN_REFUGEES: (state) => ({
    title: 'The camps overflow',
    text:
      state.flags.refugees_policy === 'granted'
        ? 'The refugee camps on the northern road are full past bursting. Grain runs short before the next convoy.'
        : 'Refugees crowd the closed checkpoints. Fights break out over blankets and bread.',
    effects: [
      { type: 'resource', key: 'unrest', delta: 6 },
      { type: 'resource', key: 'stability', delta: -3 },
    ],
  }),
};

export function passiveThreadEffects(state, addressedThreads) {
  const effects = [];
  const events = [];
  for (const thread of Object.values(state.threads)) {
    if (thread.status !== 'active' || addressedThreads.has(thread.id)) continue;
    const gain = PASSIVE_URGENCY[thread.id] ?? 0;
    if (!gain) continue;
    if (thread.urgency + gain >= 85 && BOIL_OVER[thread.id]) {
      const event = BOIL_OVER[thread.id](state);
      events.push({ thread: thread.id, title: event.title, text: event.text });
      effects.push({ type: 'thread', thread: thread.id, stage: 1, urgency: -35 });
      effects.push(...event.effects);
    } else {
      effects.push({ type: 'thread', thread: thread.id, urgency: gain });
    }
  }
  return { effects, events };
}

export function threadsTouchedBy(effects) {
  const touched = new Set();
  for (const e of effects) if (e.type === 'thread') touched.add(e.thread);
  return touched;
}

export function stageOf(state, threadId) {
  return state.threads[threadId]?.stage ?? 0;
}
