// The War Room's five-turn arc for one reign (Master Build §3, §17; Cycle doc §11
// "5-turn arc"). Crises are pure views of GameState: briefing, conflict, advisors,
// and Orders A–E with fully resolved effects. Nothing here mutates state.

import {
  res, rel, fac, flag, counter, thread, region, heat, chron, voice, mem,
  SYN, WARGS, T_SYN, T_WARGS, T_REFUGEES, T_MYSTERY, hasLegacy,
} from './effectHelpers.js';
import { civilizationLabel } from '../core/relationships.js';
import { seasonLabel } from '../core/state.js';

const CATEGORY_NAMES = {
  diplomacy: 'Diplomacy',
  military: 'Military',
  clandestine: 'Clandestine',
  research: 'Research / Magic',
  economic: 'Economic / Infrastructure',
};

function researchCost(state, base) {
  return hasLegacy(state, 'vales_notes') ? Math.round(base * 0.7) : base;
}

function wardStrength(state, base) {
  return hasLegacy(state, 'aegis_mastery') ? Math.round(base * 1.5) : base;
}

function syndicateLeader(state) {
  return state.factions[SYN].leader;
}

function syndicateLeaderShort(state) {
  return syndicateLeader(state).split(' ').slice(-1)[0];
}

// ─── Memory of earlier reigns: the first briefing of a new cycle cites history ──────────

export function historyCallbacks(state) {
  if (state.cycle.number < 2 || !state.history.length) return [];
  const last = state.history[state.history.length - 1];
  const k = last.keys ?? {};
  const gap = state.year - (last.endYear ?? state.cycle.startYear);
  const lines = [];
  const prev = last.sovereign;

  lines.push(
    last.cause === 'fall'
      ? `${gap} years ago, ${prev} fell at the Siege of the Marches. The Chronicle records where.`
      : last.cause === 'abdication'
        ? `${gap} years ago, ${prev} laid down the crown by choice. Elvia still argues about why.`
        : `${gap} years have passed since ${prev}'s reign closed with the thaw of ${last.endYear} E.R.`,
  );

  if (k.refugees_policy === 'granted') {
    lines.push(`${prev} opened the northern road. The refugees' children are Elvian now; two of them sit on your Council.`);
  } else if (k.refugees_policy === 'removed') {
    lines.push(`${prev} turned the northern refugees back at the border. In the north they still sing about it, and not kindly.`);
  }

  const child = k.child_name ?? 'Mika';
  if (k.mika_family === 'helped') {
    lines.push(
      state.cycle.number === 2
        ? `${child} — the refugee girl ${prev} once walked through the Greywater checkpoint — commands that checkpoint now.`
        : `${child}, the refugee girl ${prev} walked through the Greywater checkpoint, holds it now — and has read every line the Chronicle keeps about the day the first girl crossed.`,
    );
  } else if (k.mika_family === 'turned_back' || k.mika_family === 'ignored') {
    lines.push(`A girl named ${child} was ${k.mika_family === 'turned_back' ? 'turned back' : 'walked past'} at the Greywater checkpoint in ${last.startYear} E.R. The north remembers her name. So does the Chronicle.`);
  }

  if (k.nyra_fate === 'released' || k.nyra_fate === 'recruited') {
    lines.push(
      k.nyra_fate === 'released'
        ? `Nyra Kell, the walker pilot ${prev} sent home from Greywater, became a reformer. Syndicate cadets are taught the day she was spared.`
        : `Nyra Kell crossed to Elvia's side at Greywater and never went back. The Syndicate academies teach her as a warning.`,
    );
  } else if (k.nyra_fate === 'killed') {
    lines.push(`In Syndicate academies, the execution of Lieutenant Nyra Kell is taught as the day Elvia showed its true face.`);
  } else if (k.nyra_fate === 'captured') {
    lines.push(`Nyra Kell spent nine years in an Elvian prison before an exchange. Her memoirs sell well in Kessrin.`);
  }

  for (const m of state.regions.southern_marches.monuments.filter((mm) => mm.cycle < state.cycle.number).slice(0, 2)) {
    lines.push(`At Greywater stands ${m.title.toLowerCase().startsWith('the') ? m.title : `the ${m.title}`}: ${m.text}`);
  }

  const synLabel = civilizationLabel(state.factions[SYN].memory);
  const wargLabel = civilizationLabel(state.factions[WARGS].memory);
  if (synLabel.key) lines.push(`The Iron Syndicate remembers Elvia as ${synLabel.label} — ${synLabel.gloss}.`);
  if (wargLabel.key) lines.push(`The Frost Wargs remember Elvia as ${wargLabel.label}.`);

  if (k.architect_studied) {
    lines.push('You do not remember the broken circle. You recognize it anyway, the way you recognize your own handwriting.');
  }

  const limit = hasLegacy(state, 'chroniclers_pen') ? 8 : 4;
  return lines.slice(0, limit);
}

function returnParagraph(state) {
  if (state.cycle.number < 2) return null;
  const s = state.cycle.sovereign;
  return `You wake in a body you have never seen and remember a war room you have never stood in. The Lattice has woven you again: ${s.name} ${s.ordinal}, God-King of Elvia.`;
}

// ─── Turn 1 · The Southern Marches ───────────────────────────────────────────────

function turn1(state) {
  const leader = syndicateLeader(state);
  const cycle2 = state.cycle.number >= 2;
  const briefing = [
    returnParagraph(state),
    ...historyCallbacks(state),
    cycle2
      ? 'Elvia is older now: lattice-lamps line the Citadel boulevards and the frontier road is paved. The border is not.'
      : 'The Empire of Elvia is an emerging magitech superpower. This spring, two threats arrive at once.',
    `South: the Iron Syndicate has moved mechanized walkers and armored columns toward the Southern Marches. Forward supply depots are rising within sight of the recognized border. ${leader}'s office calls it "routine defensive readiness." Elvian intelligence disagrees.`,
    'North: refugees are arriving from the frontier settlements. They report Frost Warg migrations, abandoned villages, strange lights beneath the ice, ancient banners appearing again — and enormous shapes moving inside the blizzards.',
    'The War Council believes the two crises are unrelated. Director Cassian Rey believes somebody may be exploiting the chaos.',
  ].filter(Boolean);

  const orders = [
    {
      id: 'A',
      category: 'diplomacy',
      label: `Envoy to ${leader}`,
      text: `Send a formal envoy to Kessrin: name every depot on the border, request their withdrawal, offer a joint border commission.`,
      cost: { treasury: 200 },
      reactions: { mara: 'doubts', cassian: 'neutral', vale: 'approves' },
      effects: [
        fac(SYN, { attitude: 12, tension: -10, memory: { peacemaker: 5 } }),
        res('stability', 3),
        rel('mara', { respect: -2 }),
        flag('syndicate_talks', 'opened'),
        thread(T_SYN, { urgency: -15 }),
        chron(`An Envoy to ${leader}`, 'The Crown answered walkers with words: an envoy to Kessrin naming every depot on the border.'),
        heat(4, 'diplomacy'),
      ],
      outcome: [
        `Your envoy is received by ${leader} personally — calm, courteous, entirely unmoved. "Routine readiness," he repeats. Then, quieter: "Your Aegis experiments frighten my people more than my walkers frighten yours. Consider that."`,
        'The walkers stop advancing. They do not leave.',
      ],
      voices: [
        { speaker: 'Toma & Lena, café owners by the Citadel', text: '"Talks! Good. Soldiers tip better, but diplomats drink more coffee."' },
        { speaker: 'A Syndicate border clerk (intercepted letter)', text: '"The Elvians sent a man with a list. He knew the number of every depot. Someone should be nervous about that."' },
      ],
    },
    {
      id: 'B',
      category: 'military',
      label: 'Reinforce the Southern Marches',
      text: 'Send the First Royal Army south: barricades at the fords, convoys on the frontier road, checkpoints, Aegis pylons on the ridgeline.',
      cost: { treasury: 450, manpower: 600 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'neutral' },
      effects: [
        res('readiness', 14),
        region({ state: 'FORTIFIED' }),
        fac(SYN, { tension: 10, attitude: -6 }),
        rel('mara', { respect: 8, trust: 5 }),
        mem('mara', 'PLAYER_REINFORCED_MARCHES', 'You sent the First Royal Army south before the Syndicate could test the border.', 4, 0.6),
        res('unrest', 3),
        thread(T_SYN, { urgency: -20 }),
        thread(T_REFUGEES, { urgency: 8 }),
        chron('Southern Marches Reinforced', 'The First Royal Army marched south under gold banners and dug in at the fords.'),
        heat(6, 'mobilization'),
      ],
      outcome: [
        'The First Royal Army marches south under gold banners. Barricades rise at the fords, convoys clog the frontier road, and Aegis pylons hum along the ridgeline.',
        'Across the border, the walkers turn their sensor-masts toward your soldiers and hold position. Nobody blinks.',
      ],
      voices: [
        { speaker: 'A soldier\'s mother in Harrowmere', text: '"They sent my boy south in new armor. New armor! I don\'t know whether to be proud or terrified."' },
        { speaker: 'A schoolteacher in Aldmoor', text: '"The roof money went to the army again. The children can study the rain."' },
      ],
    },
    {
      id: 'C',
      category: 'clandestine',
      label: 'Read the Depots',
      text: "Cassian's agents slip across the border to count walkers, read the manifests, and learn whose signature is on them.",
      cost: { treasury: 250 },
      reactions: { mara: 'doubts', cassian: 'approves', vale: 'neutral' },
      effects: [
        res('intel', 22),
        rel('cassian', { trust: 8, respect: 4 }),
        rel('mara', { trust: -3 }),
        flag('intel_depot_manifests', true),
        thread(T_SYN, { urgency: -5, flags: { drae_identified: true } }),
        chron('The Directorate Reads the Depots', 'Directorate agents crossed the border and came back with the name on every manifest: General Corvin Drae.'),
        heat(4, 'espionage'),
      ],
      roll: (rng) => {
        if (rng.chance(0.25)) {
          return {
            effects: [
              fac(SYN, { tension: 12, attitude: -8 }),
              flag('intel_agents_exposed', true),
              mem('cassian', 'PLAYER_SPENT_AN_AGENT', 'An agent was taken at Depot Nine on your order.', 5, -0.2),
            ],
            outcome: ['One of Cassian\'s agents is taken at Depot Nine. He does not tell you her name until you ask twice.'],
          };
        }
        return { effects: [], outcome: [] };
      },
      outcome: [
        "Cassian's agents count forty-one walkers, three fuel trains, and one signature on every manifest — not the Chancellor's. General Corvin Drae's.",
        '"The Chancellor may not know how far his general intends to go," Cassian says. "Which makes the General the most interesting man in the Syndicate."',
      ],
      voices: [{ speaker: 'An Elvian customs officer', text: '"Three wine merchants crossed the border this week and none of them knew anything about wine."' }],
    },
    {
      id: 'D',
      category: 'research',
      label: 'Field the Aegis Ward',
      text: "Fund Vale's Aegis ward prototype: a lattice-lit barrier strung along the frontier road. Untested. Brilliant. Probably.",
      cost: { treasury: researchCost(state, 400) },
      reactions: { mara: 'neutral', cassian: 'doubts', vale: 'approves' },
      effects: [
        counter('wardProjects'),
        counter('valeFunded'),
        res('readiness', wardStrength(state, 6)),
        res('stability', 2),
        rel('vale', { affection: 8, trust: 6, respect: 3 }),
        mem('vale', 'PLAYER_FUNDED_THE_WARD', 'You funded the Aegis ward when the Council called it a toy.', 5, 0.8),
        region({ state: 'FORTIFIED' }),
        fac(SYN, { tension: 6, attitude: -4 }),
        thread(T_MYSTERY, { visibility: 'rumored', urgency: 10, flags: { ward_resonance: true } }),
        flag('aegis_ward_built', true),
        chron('The First Aegis Ward Raised', 'A barrier of lattice-light went up along the frontier road in a single night.'),
        heat(5, 'magitech'),
      ],
      outcome: [
        'The Aegis ward goes up along the frontier road in a single night: a lattice of warm light strung between brass pylons, humming just below hearing.',
        'Vale reports in person, ecstatic and slightly singed. "It resonates! With something to the north. Something very old. I didn\'t design it to do that. Isn\'t that wonderful?"',
      ],
      voices: [{ speaker: 'A shepherd on the frontier road', text: '"The sheep won\'t cross the light. Neither will I, honestly."' }],
    },
    {
      id: 'E',
      category: 'economic',
      label: 'Open the Northern Road',
      text: 'Build camps and a supply road from the north. Grant the refugees entry and put them to work rebuilding the frontier walls.',
      cost: { treasury: 350 },
      reactions: { mara: 'approves', cassian: 'doubts', vale: 'neutral' },
      effects: [
        flag('refugees_policy', 'granted'),
        res('unrest', 5),
        res('stability', 2),
        res('manpower', 250),
        thread(T_REFUGEES, { stage: 1, urgency: -30 }),
        rel('mara', { trust: 3 }),
        chron('Northern Refugees Granted Entry', 'The northern road opened. Canvas camps rose; a school tent went up by the second week.'),
        heat(3, 'policy'),
      ],
      outcome: [
        'Camps rise along the northern road — canvas, field kitchens, a school tent by the second week. The refugees are put to work rebuilding frontier walls and paid in grain.',
        'They bring stories with them: wolves walking south in families, not packs. Lights under the ice. Banners no living Elvian recognizes.',
      ],
      voices: [
        { speaker: 'A refugee mason', text: '"They gave us a wall to build. It is the first thing in a year anyone has asked us to make instead of leave."' },
        { speaker: 'A Harrowmere grain trader', text: '"Bread went up two coppers. Somebody has to pay for kindness."' },
      ],
    },
  ];

  return {
    id: 'turn1_marches',
    title: cycle2 ? 'The Southern Marches, Again' : 'The Southern Marches',
    location: 'War Room · Royal Citadel',
    briefing,
    conflict: 'You have the treasury for one decisive commitment this season. Where does the Crown\'s hand fall first?',
    advisors: [
      { id: 'mara', line: '"Walkers don\'t park on a border for exercise, Majesty. Make the Marches expensive and they\'ll find somewhere cheaper to be."' },
      { id: 'cassian', line: '"Depots are logistics. Logistics are intentions. Let me read them before Kessrin knows we\'ve looked."' },
      { id: 'vale', line: '"If the lights under the ice are what I think — well, I don\'t know what I think! That\'s the exciting part. Also the Aegis prototype is ready. Mostly."' },
      { id: 'sparky', line: 'Sparky has fallen asleep on the map of the Southern Marches. He is drooling on the depots.' },
    ],
    orders,
  };
}

// ─── Turn 2 · The Accord and the Ice ─────────────────────────────────────────────

function turn2(state) {
  const f = state.flags;
  const leader = syndicateLeader(state);
  const briefing = [];
  if (f.syndicate_talks === 'opened') {
    briefing.push(`${leader} answers your envoy with a proposal: the Accord of the Marches. No new walkers on the border, and no new magic. A sworn oath, witnessed by both crowns.`);
  } else if (state.regions.southern_marches.state === 'FORTIFIED' && !f.aegis_ward_built) {
    briefing.push('The Syndicate answered your army with machines: twelve more walkers rolled into the Greywater depots this month.');
  } else {
    briefing.push(`Kessrin proposes an Accord of the Marches anyway: no new walkers on the border, no new magic, sworn before both crowns. ${leader} wants it badly. That is worth knowing.`);
  }
  if (f.intel_depot_manifests) {
    briefing.push("Cassian's manifests are proven right: General Drae moved a walker lance to Greywater Ford without the Chancellor's countersignature.");
  }
  if (f.aegis_ward_built) {
    briefing.push('Kessrin\'s broadsheets call the Aegis ward "a loaded gun pointed at the Syndicate." Their doctrine was written in the ashes of cities that magic burned.');
  }
  briefing.push(
    f.refugees_policy === 'granted'
      ? 'The northern camps hold four thousand people and one very overworked school tent.'
      : 'Refugees crowd the closed checkpoints of the Marches. Some have waited since spring.',
  );
  briefing.push(
    state.factions[WARGS].attitude >= 0
      ? 'Frost Wargs passed the village of Holloway in the night. They took nothing. The elders say the wolves were looking back over their shoulders, at the north.'
      : "Frost Wargs took the village of Holloway's herds. No one was killed. The elders swear the wolves only took what they needed to keep moving south.",
  );

  const accordAvailable = !f.accord_sworn;
  const orders = [
    {
      id: 'A',
      category: 'diplomacy',
      label: accordAvailable ? 'Swear the Accord of the Marches' : 'Deepen the Accord',
      text: accordAvailable
        ? 'Swear before both crowns: no new walkers, no new magic on the border. An oath, recorded. Breaking it would be remembered.'
        : 'Send trade delegations under the Accord and let merchants make the peace harder to break.',
      cost: { treasury: 150 },
      reactions: { mara: 'doubts', cassian: 'neutral', vale: 'objects' },
      effects: accordAvailable
        ? [
            fac(SYN, { attitude: 15, tension: -18, memory: { peacemaker: 8 } }),
            flag('accord_sworn', true),
            thread(T_SYN, { urgency: -25, flags: { accord: true } }),
            rel('vale', { trust: -4 }),
            rel('mara', { respect: -1 }),
            mem('vale', 'PLAYER_SWORE_AWAY_THE_WARDS', 'You swore away new wards on the border.', 3, -0.4),
            chron('The Accord of the Marches', 'The Sovereign swore before both crowns: no new walkers and no new magic on the southern border.', 'oath'),
            heat(5, 'oath'),
          ]
        : [fac(SYN, { attitude: 10, tension: -10, memory: { peacemaker: 4 } }), res('treasury', 250), heat(2, 'trade')],
      outcome: accordAvailable
        ? [`The Accord is sworn in the Hall of Banners. ${leader} signs with a steel pen and shakes your hand like a man closing a ledger.`, 'Vale does not attend. He sends a note: "Understood. Disappointed. Understood."']
        : ['Merchants cross the border with wine that is actually wine. Peace starts to look profitable.'],
      voices: [{ speaker: 'A Greywater ferryman', text: '"Two crowns shook hands on my side of the river. I\'ll believe it when the walkers go home."' }],
    },
    {
      id: 'B',
      category: 'military',
      label: 'Hunt the Warg Packs',
      text: 'Send the royal rangers north to break the packs before they reach the villages again.',
      cost: { treasury: 300, manpower: 400 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'objects' },
      effects: [
        fac(WARGS, { attitude: -20, tension: -10, memory: { conqueror: 10 } }),
        thread(T_WARGS, { stage: 1, urgency: -25 }),
        res('stability', 3),
        res('readiness', -4),
        rel('sparky', { affection: -6, trust: -4 }),
        mem('sparky', 'PLAYER_HUNTED_THE_WOLVES', 'The rangers rode north to kill the wolves. Sparky watched them go.', 4, -0.6),
        rel('mara', { respect: 3 }),
        chron('The Rangers Ride North', 'Royal rangers hunted the Frost Warg packs along the northern frontier.'),
        heat(8, 'hunt'),
      ],
      outcome: [
        'The rangers come back with pelts and fewer men than they took. The packs scatter north — then turn, and keep coming.',
        'Sparky refuses to eat for two days. Then he eats a ranger\'s boot.',
      ],
      voices: [{ speaker: 'A Holloway herdswoman', text: '"My cattle are safe. I keep thinking about the pups we found in the den."' }],
    },
    f.intel_depot_manifests
      ? {
          id: 'C',
          category: 'clandestine',
          label: "Expose General Drae",
          text: "Leak Drae's unsanctioned orders to the Chancellor's council and let Kessrin discipline its own general.",
          cost: { treasury: 200 },
          reactions: { mara: 'neutral', cassian: 'approves', vale: 'neutral' },
          effects: [rel('cassian', { trust: 5 }), thread(T_SYN, { urgency: -10 }), heat(6, 'intrigue')],
          roll: (rng) =>
            rng.chance(0.7)
              ? {
                  effects: [
                    fac(SYN, { attitude: 6, tension: -12 }),
                    flag('drae_exposed', true),
                    thread(T_SYN, { flags: { drae_exposed: true } }),
                    chron("Drae's Orders Leaked to Kessrin", "The Syndicate council learned what its general had signed without them."),
                  ],
                  outcome: ['Kessrin recalls General Drae "for consultation." His lieutenants are not recalled with him.'],
                }
              : {
                  effects: [fac(SYN, { tension: 10 }), flag('drae_hardened', true)],
                  outcome: ['Drae gets the leak before the council does. Three moderate officers are reassigned to the arctic depots. The General smiles in public.'],
                },
          outcome: ['Cassian arranges for a ledger to be found where a careful clerk will find it.'],
          voices: [],
        }
      : {
          id: 'C',
          category: 'clandestine',
          label: 'Seed Informants in Kessrin',
          text: 'Build a network inside the Syndicate capital: clerks, rail engineers, a café owner who hears everything.',
          cost: { treasury: 220 },
          reactions: { mara: 'doubts', cassian: 'approves', vale: 'neutral' },
          effects: [res('intel', 18), rel('cassian', { trust: 4 }), flag('intel_kessrin_network', true), thread(T_SYN, { urgency: -5 }), heat(3, 'intrigue')],
          outcome: ['Within a month Cassian knows what the Syndicate council ate for lunch and which of them lied about it.'],
          voices: [],
        },
    f.accord_sworn
      ? {
          id: 'D',
          category: 'research',
          label: 'Study the Lights Beneath the Ice',
          text: 'The Accord forbids new magic on the border — not in the north. Send Vale to find what his ward was resonating with.',
          cost: { treasury: researchCost(state, 350) },
          reactions: { mara: 'doubts', cassian: 'neutral', vale: 'approves' },
          effects: [
            counter('valeFunded'),
            thread(T_MYSTERY, { stage: 1, visibility: 'known', urgency: 15 }),
            fac(WARGS, { attitude: 4 }),
            rel('vale', { affection: 6, trust: 3 }),
            chron("Vale's Expedition North", 'Dr. Elias Vale went north to find the source of the lights beneath the ice.', 'discovery'),
            heat(8, 'revelation'),
          ],
          outcome: [
            'Vale returns with frostbite and a heartbeat — a slow pulse recorded through forty feet of glacier. "Something down there is running," he says. "Not alive. Running. Like an engine."',
            'The wargs circled his camp every night and never attacked. "They were guarding it," he says. "From me, I think."',
          ],
          voices: [],
        }
      : f.aegis_ward_built
        ? {
            id: 'D',
            category: 'research',
            label: 'Complete the Aegis Lattice',
            text: 'Extend the ward into a full lattice along the frontier. Vale says it will hold a walker charge. Vale says many things.',
            cost: { treasury: researchCost(state, 420) },
            reactions: { mara: 'approves', cassian: 'neutral', vale: 'approves' },
            effects: [
              counter('wardProjects'),
              counter('valeFunded'),
              res('readiness', wardStrength(state, 8)),
              region({ state: 'FORTIFIED' }),
              fac(SYN, { tension: 8, attitude: -5 }),
              rel('vale', { affection: 5, respect: 4 }),
              chron('The Aegis Lattice Completed', 'The frontier ward became a lattice: a wall of warm light from the fords to the ridge.'),
              heat(5, 'magitech'),
            ],
            outcome: ['The lattice is complete by midsummer. Syndicate walkers test it once, at night, and decide not to test it again.'],
            voices: [{ speaker: 'A Syndicate walker pilot (radio intercept)', text: '"It\'s not a wall. It\'s worse. It\'s a wall that hums."' }],
          }
        : {
            id: 'D',
            category: 'research',
            label: 'Field the Aegis Ward',
            text: "Fund Vale's Aegis ward along the frontier road — a barrier of lattice-light between brass pylons.",
            cost: { treasury: researchCost(state, 400) },
            reactions: { mara: 'neutral', cassian: 'doubts', vale: 'approves' },
            effects: [
              counter('wardProjects'),
              counter('valeFunded'),
              res('readiness', wardStrength(state, 6)),
              region({ state: 'FORTIFIED' }),
              fac(SYN, { tension: 6, attitude: -4 }),
              rel('vale', { affection: 8, trust: 6 }),
              thread(T_MYSTERY, { visibility: 'rumored', urgency: 10 }),
              flag('aegis_ward_built', true),
              chron('The First Aegis Ward Raised', 'A barrier of lattice-light went up along the frontier road.'),
              heat(5, 'magitech'),
            ],
            outcome: ['The ward rises in a night and hums toward the north. Vale notices. Vale notices everything except dinner.'],
            voices: [],
          },
    {
      id: 'E',
      category: 'economic',
      label: f.refugees_policy === 'granted' ? 'Feed the North' : 'Open the Camps, Feed the North',
      text:
        f.refugees_policy === 'granted'
          ? 'Grain to the northern villages and camps — and meat left at the forest edge, so the wolves have no reason to come closer.'
          : 'Open the checkpoints, feed the camps and the northern villages, and leave meat at the forest edge for the wolves.',
      cost: { treasury: f.refugees_policy === 'granted' ? 350 : 450 },
      reactions: { mara: 'approves', cassian: 'doubts', vale: 'approves' },
      effects: [
        counter('wargMercy'),
        fac(WARGS, { attitude: 12, tension: -8, memory: { peacemaker: 4 } }),
        res('unrest', -4),
        thread(T_WARGS, { urgency: -15 }),
        thread(T_REFUGEES, { urgency: -15 }),
        flag('north_fed', true),
        ...(f.refugees_policy === 'granted' ? [] : [flag('refugees_policy', 'granted'), thread(T_REFUGEES, { stage: 1 })]),
        chron('Grain for the North, Meat for the Wolves', 'The Crown fed the northern villages, the camps — and, at the forest edge, the wolves.'),
        heat(2, 'relief'),
      ],
      outcome: [
        'Wagons roll north. At the treeline, the drovers leave the meat and do not look back. In the morning it is gone, and the tracks lead away from the villages.',
        'Sparky follows the meat wagons for nine miles before Mara sends a rider to bring him home.',
      ],
      voices: [{ speaker: 'Toma & Lena, café owners by the Citadel', text: '"The palace bought every ham in the city and fed it to wolves. Lena thinks it\'s beautiful. Toma wants his ham back."' }],
    },
  ];

  return {
    id: 'turn2_accord',
    title: 'The Accord and the Ice',
    location: 'War Room · Royal Citadel',
    briefing,
    conflict: 'The Council wants one answer this season: settle the border by oath, or deal with the north before the snows.',
    advisors: [
      { id: 'mara', line: f.accord_sworn ? '"A promise is a wall made of paper, Majesty. I\'ll keep the stone ones manned."' : '"An oath with Kessrin is a fine thing to have. I\'d like it with a garrison behind it."' },
      { id: 'cassian', line: '"Every accord has a man inside it who wants it to fail. Find him first."' },
      { id: 'vale', line: '"The ward hums north. North! Not at the Syndicate. Doesn\'t anyone else find that fascinating?"' },
      { id: 'sparky', line: 'Sparky stares north from the window for an hour, very still. Then he sneezes acid on a tapestry.' },
    ],
    orders,
  };
}

// ─── Turn 3 · The Line Is Crossed ────────────────────────────────────────────────

export function crossingLeader(state) {
  const nyra = state.characters.nyra;
  if (state.cycle.number === 1 && ['unmet', 'met', 'released'].includes(nyra.status)) {
    return nyra.status === 'released'
      ? { name: 'Lieutenant Nyra Kell', note: 'The pilot you sent home has come back. This time she has orders.' }
      : { name: 'Lieutenant Nyra Kell', note: null };
  }
  return { name: 'Captain Ilse Ostrava', note: null };
}

function turn3(state) {
  const f = state.flags;
  const fortified = state.regions.southern_marches.state === 'FORTIFIED';
  const lead = crossingLeader(state);
  const briefing = [
    `Before dawn, a walker lance under ${lead.name} crossed Greywater Ford.`,
    fortified
      ? 'They found the Royal Army waiting behind Aegis pylons and stopped at the water\'s edge. They did not go back.'
      : 'They seized the Elvian supply depot on the far bank and raised the iron-gear banner over it.',
  ];
  if (lead.note) briefing.push(lead.note);
  if (f.accord_sworn && !f.accord_broken) briefing.push('The Accord of the Marches is three months old. The Chancellor\'s office is silent.');
  if (f.drae_exposed) briefing.push('Drae was recalled to Kessrin — but his lieutenants moved first.');
  briefing.push(
    state.factions[WARGS].attitude >= 10
      ? 'In the frontier wilds the packs have stopped. They are waiting at the treeline, facing north, as if something behind them is worse than anything ahead.'
      : 'The packs have reached the frontier wilds. In the blizzards: the ancient banners again, and something enormous walking with them.',
  );

  const accordActive = f.accord_sworn && !f.accord_broken;
  const orders = [
    accordActive
      ? {
          id: 'A',
          category: 'diplomacy',
          label: 'Invoke the Accord',
          text: 'Hold Kessrin to its oath. Demand the Chancellor recall the lance publicly.',
          cost: { treasury: 100 },
          reactions: { mara: 'doubts', cassian: 'neutral', vale: 'approves' },
          effects: [fac(SYN, { tension: -15, attitude: 8, memory: { peacemaker: 6 } }), thread(T_SYN, { urgency: -20 }), heat(6, 'standoff')],
          roll: (rng) =>
            rng.chance(0.6)
              ? {
                  effects: [flag('lance_recalled', true), region({ state: 'STABLE' }), chron('The Lance Recalled', 'Held to its oath, Kessrin recalled the walker lance from Greywater Ford.')],
                  outcome: ['Kessrin honors the Accord. The lance withdraws across the ford in daylight, banners furled.'],
                }
              : {
                  effects: [fac(SYN, { tension: 8 })],
                  outcome: ['The Chancellor recalls the lance. The lance does not go. Somebody in Kessrin is giving different orders.'],
                },
          outcome: [],
          voices: [],
        }
      : {
          id: 'A',
          category: 'diplomacy',
          label: 'Ultimatum to Kessrin',
          text: 'Formal demand: withdraw from Greywater within ten days or the Crown will consider the border war.',
          cost: { treasury: 100 },
          reactions: { mara: 'approves', cassian: 'doubts', vale: 'neutral' },
          effects: [fac(SYN, { tension: -5, attitude: -4 }), res('stability', 2), thread(T_SYN, { urgency: -8 }), heat(6, 'ultimatum')],
          outcome: ['Kessrin acknowledges receipt. The lance stays. The clock starts.'],
          voices: [],
        },
    {
      id: 'B',
      category: 'military',
      label: 'Retake the Ford',
      text: 'Send the Royal Army across Greywater Ford before the Syndicate can dig in. It will cost lives.',
      cost: { treasury: 350, manpower: 700 },
      reactions: { mara: 'doubts', cassian: 'neutral', vale: 'objects' },
      effects: [
        res('readiness', -6),
        region({ state: 'AFTERMATH', casualties: fortified ? 4 : 7, damage: 20 }),
        fac(SYN, { tension: 15, attitude: -12, memory: { conqueror: 8 } }),
        thread(T_SYN, { stage: 1, urgency: -30 }),
        flag('ford_retaken', 'army'),
        rel('mara', { respect: 5, resentment: fortified ? 0 : 5 }),
        mem('mara', 'PLAYER_SENT_US_ACROSS_THE_FORD', 'You sent the army across Greywater Ford.', 6, fortified ? 0.2 : -0.3),
        chron('The Battle of Greywater Ford', 'The Royal Army retook Greywater Ford at a cost Mara wrote down by name.', 'battle'),
        heat(18, 'major_combat'),
      ],
      outcome: [
        'The Royal Army crosses at first light. The walkers are faster in the water than anyone expected. By noon the depot is Elvian again, and the ford is full of broken iron.',
        fortified ? 'The pylons held the flank. Mara counts four dead.' : 'Mara counts seven dead. She does it twice.',
      ],
      voices: [{ speaker: 'A field surgeon at Greywater', text: '"We won. I keep saying it out loud so it sounds true."' }],
    },
    {
      id: 'C',
      category: 'clandestine',
      label: 'Turn the Pilot',
      text: `Find out who ${lead.name} is: what she believes, what she fears, who she answers to. Then cut the lance's fuel.`,
      cost: { treasury: 200 },
      reactions: { mara: 'neutral', cassian: 'approves', vale: 'neutral' },
      effects: [
        res('intel', 12),
        flag('intel_nyra_dossier', true),
        rel('cassian', { trust: 4 }),
        thread(T_SYN, { urgency: -10 }),
        heat(4, 'intrigue'),
      ],
      outcome: [
        "Cassian's file is short. Nyra Kell, twenty-four, of Kessrin-on-Ash. Her district burned in the Lattice Fire of 311 — a magical catastrophe the Syndicate built its whole doctrine on. She believes Elvia will do it again. She is not wrong to be afraid.",
        'The lance\'s fuel train develops a mysterious leak. It will not advance this season.',
      ],
      voices: [],
    },
    accordActive
      ? {
          id: 'D',
          category: 'research',
          label: 'Raise the Ward at the Ford — breaks your Accord',
          text: 'Vale can light the ford in a night. It would hold. It would also break the oath you swore before both crowns.',
          cost: { treasury: researchCost(state, 380) },
          warning: 'Breaks your sworn Accord of the Marches.',
          reactions: { mara: 'objects', cassian: 'neutral', vale: 'approves' },
          effects: [
            counter('oathsBroken'),
            counter('wardProjects'),
            flag('accord_broken', true),
            fac(SYN, { attitude: -20, tension: 12, memory: { oathbreaker: 20 } }),
            region({ state: 'FORTIFIED' }),
            res('readiness', wardStrength(state, 8)),
            rel('vale', { affection: 6 }),
            rel('mara', { trust: -4 }),
            mem('mara', 'PLAYER_BROKE_THE_ACCORD', 'You broke the Accord of the Marches. Mara was in the hall when you swore it.', 6, -0.5, { permanent: true }),
            thread(T_SYN, { flags: { accord_broken: true }, urgency: -10 }),
            chron('The Accord of the Marches Broken', 'Three months after swearing it, the Sovereign lit the ford with forbidden magic.', 'oath'),
            heat(15, 'betrayal'),
          ],
          outcome: [
            'The ward goes up at Greywater overnight. The lance cannot advance. Neither, now, can anyone\'s trust in an Elvian oath.',
            'Mara says nothing at the Council table. She says it later, alone: "We gave our word, Majesty. I was standing next to you."',
          ],
          voices: [{ speaker: 'A Kessrin broadsheet', text: '"OATHBREAKER CROWN LIGHTS THE FORD."' }],
        }
      : {
          id: 'D',
          category: 'research',
          label: 'Ward the Ford',
          text: 'Have Vale light Greywater Ford with an Aegis barrier and pin the lance on its bank.',
          cost: { treasury: researchCost(state, 380) },
          reactions: { mara: 'approves', cassian: 'neutral', vale: 'approves' },
          effects: [
            counter('wardProjects'),
            region({ state: 'FORTIFIED' }),
            res('readiness', wardStrength(state, 8)),
            fac(SYN, { tension: 8, attitude: -4 }),
            rel('vale', { affection: 5 }),
            chron('Aegis Light at Greywater', 'The ford was barred with lattice-light; the walker lance was pinned to its bank.'),
            heat(6, 'magitech'),
          ],
          outcome: ['Lattice-light crosses the river. The walkers stop at its edge like cattle at a fence they don\'t understand.'],
          voices: [],
        },
    {
      id: 'E',
      category: 'economic',
      label: 'Evacuate the Frontier Villages',
      text: 'Move every family between the ford and the wilds behind the Citadel walls before the fighting reaches them.',
      cost: { treasury: 300 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'neutral' },
      effects: [
        flag('civilians', 'saved'),
        res('unrest', 4),
        res('stability', 2),
        thread(T_REFUGEES, { urgency: -10 }),
        fac(WARGS, { tension: -5 }),
        rel('mara', { trust: 6, affection: 3 }),
        mem('mara', 'PLAYER_PROTECTED_CIVILIANS', 'You emptied the frontier villages before the fighting reached them.', 6, 0.9),
        chron('The Frontier Villages Evacuated', 'Every family between Greywater and the wilds was brought behind the Citadel walls.'),
        heat(4, 'evacuation'),
      ],
      outcome: ['Wagons, carts, a goat on a rope. Nineteen villages empty in nine days. Nobody is home when the fighting comes.'],
      voices: [{ speaker: 'A grandmother from Brennick', text: '"I left my house to the soldiers. I left my garden to the wolves. I took the cat."' }],
    },
  ];

  return {
    id: 'turn3_crossing',
    title: 'The Line Is Crossed',
    location: 'War Room · Royal Citadel',
    briefing,
    conflict: 'Greywater Ford is Elvian ground. How does the Crown answer?',
    advisors: [
      { id: 'mara', line: fortified ? '"We\'re dug in, Majesty. Say the word and we hold. Say the other word and we bleed."' : '"They took the depot because nobody was standing in it. That\'s a lesson, not a tragedy. Yet."' },
      { id: 'cassian', line: '"A pilot crossed a river. Someone told her to. Find the someone."' },
      { id: 'vale', line: accordActive ? '"I could light that ford tonight. I know. I know. The Accord. I\'m only saying I could."' : '"Give me two nights at the ford. One, if nobody needs me to sleep."' },
      { id: 'sparky', line: 'Sparky has dragged the Greywater pin off the map and is guarding it under the table, growling softly.' },
    ],
    orders,
  };
}

// ─── Turn 4 · Winter at Greywater (the skirmish that matters) ───────────────────────

function turn4(state) {
  const syn = state.factions[SYN];
  const wargsFriendly = state.factions[WARGS].attitude >= 0 || state.counters.wargMercy >= 1;
  const briefing = [
    syn.tension >= 55
      ? 'General Corvin Drae has come to the border himself. His vanguard — Blade-Adepts of the Iron Academies, the Syndicate\'s duelists — waits at Greywater for an Elvian answer. Drae wants the war his Chancellor won\'t declare.'
      : 'Winter quiets the border — quiet enough to hear what\'s left: a Syndicate vanguard still camped across Greywater, waiting for orders that haven\'t come.',
    wargsFriendly
      ? 'An old warg, huge and grey-muzzled, has been seen at the edge of the camps. It does not attack. It watches. It waits.'
      : 'The warg alpha the frontier calls Old Rime leads the packs against the winter herds. Last night it took a sentry\'s horse from inside the pickets.',
    'Mara has sent one line from the front: "This is the kind of fight a crown should see in person."',
  ];
  const orders = [
    {
      id: 'A',
      category: 'diplomacy',
      label: 'Winter Summit at Greywater',
      text: 'Meet the Syndicate delegation on the ice of the ford itself. No walkers, no wards, two tables and a stove.',
      cost: { treasury: 180 },
      reactions: { mara: 'doubts', cassian: 'neutral', vale: 'approves' },
      effects: [
        fac(SYN, { tension: -15, attitude: 10, memory: { peacemaker: state.flags.accord_broken ? 3 : 8 } }),
        flag('winter_summit', true),
        thread(T_SYN, { urgency: -20 }),
        chron('The Winter Summit', 'Elvian and Syndicate delegations met on the frozen ford, between two stoves.'),
        heat(5, 'summit'),
      ],
      outcome: [
        state.flags.accord_broken
          ? 'The Syndicate delegation arrives. They read the Accord of the Marches aloud, slowly, before anyone sits. Then they sit.'
          : 'The delegations talk for nine hours on the ice. Nobody agrees to anything. Nobody shoots anyone. By winter standards it is a triumph.',
      ],
      voices: [],
    },
    {
      id: 'B',
      category: 'military',
      label: 'Winter Garrison',
      text: 'Keep the Royal Army at the fords through the cold. Fires, rations, rotations — and readiness.',
      cost: { treasury: 320, manpower: 300 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'neutral' },
      effects: [res('readiness', 10), region({ state: 'FORTIFIED' }), fac(SYN, { tension: 5 }), res('stability', -2), rel('mara', { respect: 3 }), heat(3, 'garrison')],
      outcome: ['The army winters on the river. Frostbite takes fingers; nobody takes the ford.'],
      voices: [{ speaker: 'A sentry at Greywater', text: '"My breath freezes in my beard and the Syndicate sentry across the river waves at me every morning. I\'ve started waving back."' }],
    },
    {
      id: 'C',
      category: 'clandestine',
      label: "Cut Drae's Supply Trains",
      text: 'Sabotage the fuel trains feeding the vanguard. Walkers that cannot move cannot start a war.',
      cost: { treasury: 260 },
      reactions: { mara: 'neutral', cassian: 'approves', vale: 'neutral' },
      effects: [fac(SYN, { tension: 6, attitude: -4 }), rel('cassian', { trust: 3 }), heat(6, 'sabotage')],
      roll: (rng) =>
        rng.chance(0.7)
          ? {
              effects: [flag('drae_supplies_cut', true), thread(T_SYN, { urgency: -25 }), chron('The Fuel Trains Burn', 'Directorate saboteurs stopped the Syndicate vanguard\'s fuel in the passes.')],
              outcome: ['Three fuel trains burn in the passes. The vanguard\'s walkers sit cold until spring.'],
            }
          : {
              effects: [res('intel', -8), rel('cassian', { trust: -2 }), mem('cassian', 'PLAYER_SPENT_AN_AGENT', 'A sabotage team was lost in the passes on your order.', 5, -0.2)],
              outcome: ['The saboteurs are caught in the passes. Cassian burns their files himself.'],
            },
      outcome: [],
      voices: [],
    },
    {
      id: 'D',
      category: 'research',
      label: 'The Lattice Lamps',
      text: 'Vale\'s lattice heat-lamps for the frontier camps and villages: warm light through the worst of the winter.',
      cost: { treasury: researchCost(state, 300) },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'approves' },
      effects: [
        res('stability', 5),
        res('unrest', -4),
        counter('valeFunded'),
        rel('vale', { affection: 5 }),
        thread(T_MYSTERY, { urgency: 10 }),
        heat(2, 'relief'),
      ],
      outcome: ['The lamps glow all winter. At night they all lean slightly north, like flowers toward a sun nobody else can see.'],
      voices: [{ speaker: 'A child in the frontier camps', text: '"The lamp is warm and it hums a song. Papa says lamps don\'t sing."' }],
    },
    {
      id: 'E',
      category: 'economic',
      label: 'Winter Relief',
      text: 'Coal, blankets and grain for every frontier household — and meat at the treeline again, for whoever is hungry out there.',
      cost: { treasury: 400 },
      reactions: { mara: 'approves', cassian: 'doubts', vale: 'approves' },
      effects: [
        res('unrest', -8),
        res('stability', 4),
        counter('wargMercy'),
        fac(WARGS, { attitude: 8, memory: { peacemaker: 3 } }),
        thread(T_REFUGEES, { urgency: -15 }),
        heat(2, 'relief'),
      ],
      outcome: ['Nobody freezes in the Marches this winter. At the treeline the meat disappears each night, and the tracks lead north.'],
      voices: [],
    },
  ];
  return {
    id: 'turn4_winter',
    title: 'Winter at Greywater',
    location: 'War Room · Royal Citadel',
    briefing,
    conflict: 'The skirmish at Greywater will decide the winter. Command it from here — or ride out and settle it yourself.',
    advisors: [
      { id: 'mara', line: '"I can hold the ford with orders. I can end it with you."' },
      { id: 'cassian', line: '"Drae wants a duel with history. Don\'t give him one he can photograph."' },
      { id: 'vale', line: '"Whatever is under the ice is getting louder. I\'d like that noted somewhere official."' },
      { id: 'sparky', line: 'Sparky has packed. That is, he is sitting in your travel chest and will not get out.' },
    ],
    orders,
  };
}

// ─── Turn 5 · The Thaw (era milestone) ───────────────────────────────────────────

export function borderOutcome(state) {
  const syn = state.factions[SYN];
  const f = state.flags;
  if (syn.tension >= 80 && !f.skirmish_won) return 'siege';
  if (syn.tension <= 40 || f.winter_summit || f.lance_recalled || (f.accord_sworn && !f.accord_broken)) return 'peace';
  return 'armed';
}

function turn5(state) {
  const outcome = borderOutcome(state);
  const f = state.flags;
  const briefing = [
    outcome === 'siege'
      ? 'The thaw opens the roads, and General Drae\'s walkers come with it. The Siege of the Marches has begun. The Chancellor calls it a regrettable border action. Drae calls it the future.'
      : outcome === 'peace'
        ? 'The thaw comes, and with it a Syndicate envoy carrying a treaty instead of a list of grievances.'
        : 'The thaw comes to an armed peace: walkers on one bank, pylons on the other, and everyone waiting to see who blinks.',
    state.counters.wargMercy >= 2
      ? 'In the north, the packs have stopped running. An enormous scarred she-wolf has been seen at the treeline, watching your camps the way a queen watches a border.'
      : 'In the north, the ice is cracking early. The wolves are gone, and nobody knows where.',
    'An era is closing. Whatever the Crown decides this season is how this reign will be remembered.',
  ];
  const treatyPeace = state.flags.accord_broken ? 6 : 12;
  const orders = [
    {
      id: 'A',
      category: 'diplomacy',
      label: 'The Treaty of Greywater',
      text: 'A permanent border, a joint commission, and the walkers home by midsummer. Signed on the ford.',
      cost: { treasury: 200 },
      reactions: { mara: 'doubts', cassian: 'neutral', vale: 'approves' },
      effects: [
        fac(SYN, { tension: -25, attitude: 15, memory: { peacemaker: treatyPeace } }),
        thread(T_SYN, { status: 'resolved', urgency: -50 }),
        flag('era_policy', 'treaty'),
        region({ state: 'STABLE', monument: { id: 'treaty_stone', title: 'The Treaty Stone', text: 'a slab of river granite where two crowns signed on the ice of Greywater' } }),
        chron('The Treaty of Greywater', f.accord_broken ? 'Kessrin signed — once. Their broadsheets called it "the Oathbreaker\'s signature."' : 'Two crowns signed a permanent border on the ford. The walkers went home by midsummer.', 'era'),
        heat(6, 'treaty'),
      ],
      outcome: [f.accord_broken ? 'Vex signs. He does not shake your hand.' : 'The walkers go home by midsummer. The ferryman at Greywater raises his prices.'],
      voices: [],
    },
    {
      id: 'B',
      category: 'military',
      label: 'The Iron Frontier',
      text: '"Peace exists only when dangerous enemies believe attacking Elvia will cost them everything." Make the Marches a fortress forever.',
      cost: { treasury: 380, manpower: 400 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'doubts' },
      effects: [
        res('readiness', 10),
        region({ state: 'FORTIFIED', monument: { id: 'frontier_bastion', title: 'The Greywater Bastion', text: 'a star-fort of stone and brass that has never been tested, which is the point' } }),
        fac(SYN, { tension: -5, memory: { conqueror: 3 } }),
        rel('mara', { respect: 6, trust: 4 }),
        thread(T_SYN, { status: 'dormant' }),
        flag('era_policy', 'fortress'),
        chron('The Iron Frontier', 'The Southern Marches became a fortress line: deterrence as policy, stone as argument.', 'era'),
        heat(4, 'fortress'),
      ],
      outcome: ['The Bastion rises. Mara walks its walls on the day it is finished and does not say a word, which is how you know she approves.'],
      voices: [],
    },
    {
      id: 'C',
      category: 'clandestine',
      label: 'The Long Watch',
      text: "Make Cassian's network permanent: every depot, every rail yard, every council room in Kessrin, watched forever.",
      cost: { treasury: 250 },
      reactions: { mara: 'doubts', cassian: 'approves', vale: 'neutral' },
      effects: [
        res('intel', 20),
        rel('cassian', { trust: 6 }),
        res('stability', -3),
        flag('cassian_network', true),
        flag('era_policy', 'watch'),
        thread(T_SYN, { status: 'dormant' }),
        chron('The Long Watch Begins', 'The Royal Intelligence Directorate became permanent, and quietly larger than anyone voted for.', 'era'),
        heat(3, 'shadow'),
      ],
      outcome: ['Cassian thanks you. It is the only time you will ever see him look surprised.'],
      voices: [{ speaker: 'An anonymous pamphlet in Aldmoor', text: '"Nobody voted for the Directorate. Nobody remembers voting against it, either."' }],
    },
    {
      id: 'D',
      category: 'research',
      label: 'The Lattice Institute',
      text: "Found Vale's institute at the frontier: an academy for magitech — and for whatever is under the ice.",
      cost: { treasury: researchCost(state, 420) },
      reactions: { mara: 'neutral', cassian: 'doubts', vale: 'approves' },
      effects: [
        counter('valeFunded'),
        thread(T_MYSTERY, { stage: 1, visibility: 'known' }),
        rel('vale', { affection: 10, trust: 4 }),
        flag('lattice_institute', true),
        flag('era_policy', 'institute'),
        fac(SYN, { tension: 5 }),
        chron('The Lattice Institute Founded', 'Dr. Elias Vale opened the Lattice Institute at the frontier; its first lecture was titled "We Do Not Know."', 'era'),
        heat(5, 'discovery'),
      ],
      outcome: ['On opening day Vale burns his eyebrows off demonstrating something nobody understands. Enrollment triples.'],
      voices: [],
    },
    {
      id: 'E',
      category: 'economic',
      label: 'The Northern Compact',
      text:
        state.counters.wargMercy >= 1
          ? 'Make the refugees citizens, rebuild the northern villages — and offer the packs a truce: the forests north of Holloway are theirs.'
          : 'Make the refugees citizens and rebuild the northern villages with Crown silver.',
      cost: { treasury: 380 },
      reactions: { mara: 'approves', cassian: 'neutral', vale: 'approves' },
      effects: [
        res('stability', 5),
        res('unrest', -5),
        thread(T_REFUGEES, { status: 'resolved' }),
        flag('era_policy', 'compact'),
        ...(state.counters.wargMercy >= 1
          ? [counter('wargMercy'), fac(WARGS, { attitude: 15, tension: -20, memory: { peacemaker: 10 } }), thread(T_WARGS, { status: 'dormant' })]
          : []),
        chron('The Northern Compact', state.counters.wargMercy >= 1 ? 'Refugees became citizens; the forests north of Holloway were ceded to the Frost Wargs.' : 'The northern refugees became citizens of Elvia.', 'era'),
        heat(3, 'compact'),
      ],
      outcome: ['The northern road becomes a northern town. It needs a name. The refugees vote. They choose "Second Chance," and then, embarrassed, "Halden."'],
      voices: [],
    },
  ];
  return {
    id: 'turn5_thaw',
    title: outcome === 'siege' ? 'The Siege of the Marches' : 'The Thaw',
    location: 'War Room · Royal Citadel',
    briefing,
    conflict: 'Choose what this reign leaves behind on the southern border.',
    advisors: [
      { id: 'mara', line: outcome === 'siege' ? '"They\'re at the walls, Majesty. Whatever you sign, sign it from horseback."' : '"Whatever you choose, make sure the soldiers know why. They\'ll remember longer than the Council."' },
      { id: 'cassian', line: '"Every era ends with a document. Make sure ours is the one historians quote."' },
      { id: 'vale', line: '"Do you ever feel like you\'ve done all this before? No? Just me. Ignore me."' },
      { id: 'sparky', line: 'Sparky lies across your boots and will not move. He has been doing that more lately.' },
    ],
    orders,
    era: true,
    borderOutcome: outcome,
  };
}

const TURNS = { 1: turn1, 2: turn2, 3: turn3, 4: turn4, 5: turn5 };

/** The crisis for the current turn, with every order fully resolved for this state. */
export function getCrisis(state) {
  const build = TURNS[state.turn] ?? turn5;
  const crisis = build(state);
  crisis.season = seasonLabel(state);
  crisis.orders = crisis.orders.map((o) => {
    const cost = { treasury: o.cost?.treasury ?? 0, manpower: o.cost?.manpower ?? 0 };
    const affordable = state.resources.treasury >= cost.treasury && state.resources.manpower >= cost.manpower;
    return {
      ...o,
      crisisId: crisis.id,
      categoryName: CATEGORY_NAMES[o.category],
      cost,
      affordable,
      // Voices of the realm (Bible §16): personal consequences persist in state.voices.
      effects: [...o.effects, ...(o.voices ?? []).map((v) => voice(v.speaker, v.text))],
    };
  });
  return crisis;
}

export { CATEGORY_NAMES };
