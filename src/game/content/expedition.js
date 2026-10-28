// Expeditions: "Infinity Blade's castle run becomes Elvia's march" (Cycle doc §7).
// Four authored beats, endless generational variation. Each beat is a pure view
// of state + the expedition record; choices carry fully resolved effects.

import {
  res, rel, fac, flag, counter, thread, region, heat, chron, mem, character,
  SYN, WARGS, T_SYN, T_WARGS, T_MYSTERY, hasLegacy,
} from './effectHelpers.js';
import { crossingLeader, borderOutcome } from './crises.js';
import { hashString } from '../core/rng.js';
import { atLeast } from '../core/relationships.js';

const FAMILIES = ['Arden', 'Halloran', 'Esk', 'Brandt', 'Lowe'];

export const EXPEDITION_KINDS = {
  march: ['road', 'checkpoint', 'wilds', 'ruin', 'champion', 'camp'],
  skirmish: ['skirmish', 'camp'],
  last_stand: ['last_stand', 'camp'],
};

export function createExpedition(state, kind) {
  return {
    id: `exp-${state.cycle.number}-${state.turn}-${kind}`,
    kind,
    beats: EXPEDITION_KINDS[kind],
    index: 0,
    picked: [],
    phase: 'main', // 'main' | 'after_victory' | 'after_defeat' | 'after_retreat'
    lastResult: null,
    log: [],
    companions: ['mara', 'sparky'],
    attempts: {},
    duels: [],
    fallen: [],
    pendingDuel: null,
    outcome: null,
    wounded: false,
  };
}

export function currentBeatId(exp) {
  return exp.beats[exp.index];
}

export function duelConfig(state, exp, beat, archetypeId, champion, stakes, allowRetreat = true) {
  const attempt = (exp.attempts[beat] ?? 0) + 1;
  return {
    archetypeId,
    seed: hashString(`${state.campaignId}:${state.cycle.number}:${state.turn}:${beat}:${attempt}`),
    title: champion.name,
    subtitle: champion.epithet,
    modifiers: {
      cycleNumber: state.cycle.number,
      legacies: [...state.cycle.activeLegacies],
      companion: exp.companions.includes('mara') ? 'mara' : exp.companions.includes('sparky') ? 'sparky' : null,
      champion,
      stakes,
    },
    allowRetreat,
    beat,
    attempt,
  };
}

const regionLine = {
  road: {
    STABLE: 'The frontier road runs south through the Crownlands: farm carts, a tinker\'s wagon, two bored soldiers at a mile-post. It looks like peace. Mara says that is what it looked like the last time, too.',
    FORTIFIED: 'The road south is a column of Elvian purpose: supply convoys, barricades at every bridge, Aegis pylons humming on the ridge. Soldiers straighten when they see your banner.',
    AFTERMATH: 'The road south is scarred: burned carts shoved into ditches, a field hospital in a barn, wounded waiting their turn. People look up when your banner passes, and then look at each other.',
  },
  checkpoint: {
    STABLE: 'The Greywater checkpoint is a gate, a hut and a tired sergeant.',
    FORTIFIED: 'The Greywater checkpoint bristles: soldiers search every cart, and the ward-lines on the gate spark when anyone leans on it.',
    AFTERMATH: 'Half of the Greywater checkpoint is a field hospital now. The other half is a line of families who have stopped asking how long.',
  },
};

// ─── Beats ──────────────────────────────────────────────────────────────────────

function beatRoad(state) {
  const rs = state.regions.southern_marches.state;
  const monuments = state.regions.southern_marches.monuments.filter((m) => m.cycle < state.cycle.number);
  const text = [regionLine.road[rs]];
  if (monuments.length) {
    text.push(`You pass ${monuments[0].title}. A child is climbing it. Nobody tells her that the person it remembers is walking past in a different body.`);
  }
  text.push('Sparky rides on the supply wagon, nose deep in a sack of dried apples he was told not to touch.');
  return {
    id: 'road',
    title: 'The Frontier Road',
    subtitle: 'Southern Marches · Crownlands Frontier',
    scene: { beat: 'road', timeOfDay: 'day' },
    speaker: { id: 'mara', line: '"Reports only tell you what someone wanted to write down, Majesty. This is the rest of it."' },
    text,
    choices: [
      {
        id: 'ask_mara',
        kind: 'talk',
        label: 'Ask Mara about the border towns',
        effects: [
          rel('mara', { affection: 3, trust: 2 }),
          mem('mara', 'PLAYER_ASKED_ABOUT_MY_FATHER', 'You asked about the border town she grew up in.', 3, 0.5),
        ],
        result: [
          '"I was born in a town like Brennick," Mara says. "My father died on its wall when I was eleven. Raiders, not walkers. The walkers are new. The dying isn\'t."',
          'She watches the road a while. "Peace is what happens when the people who\'d hurt you are sure it would cost them everything. That\'s all I know about it."',
        ],
      },
      {
        id: 'feed_sparky',
        kind: 'talk',
        label: 'Share your rations with Sparky',
        effects: [counter('sparkyCare'), rel('sparky', { affection: 5, trust: 2 })],
        result: ['Sparky eats your rations, then Mara\'s, then most of a tent rope. He falls asleep against your boot, content and faintly smoldering.'],
      },
      { id: 'ride_on', kind: 'advance', label: 'Ride on to the Greywater checkpoint', effects: [], result: [] },
    ],
  };
}

// The pathfinder at the checkpoint: a Syndicate scout hidden among the refugees. Fighting him
// teaches the Blade-Adept's feints before Greywater Ford tests them ("teach, test, or tell").
const SCOUT = { name: 'The Man in the Grey Coat', epithet: 'A Syndicate pathfinder among the refugees' };

/** How the checkpoint's scout was dealt with this march: 'caught' | 'taken' | 'escaped' | null. */
export function checkpointScout(exp) {
  if (!exp) return null;
  if (exp.picked.includes('signal_watchers')) return 'taken';
  const fight = exp.duels.filter((d) => d.beat === 'checkpoint').at(-1);
  if (!fight) return null;
  return fight.outcome === 'victory' ? 'caught' : 'escaped';
}

function beatCheckpoint(state, exp) {
  const rs = state.regions.southern_marches.state;
  const policy = state.flags.refugees_policy ?? 'held';
  const cycle = state.cycle.number;
  const child = state.characters.mika.short; // a new refugee child each generation
  const family = FAMILIES[(cycle - 1) % FAMILIES.length];
  const text = [regionLine.checkpoint[rs]];
  if (cycle >= 2 && state.history.at(-1)?.keys?.mika_family === 'helped') {
    text.push(
      cycle === 2
        ? 'The checkpoint captain is a woman near fifty with a northern accent and a wool scarf she has clearly owned for decades. Her name-plate says MIKA ARDEN. She salutes, and then she looks at you for a long time, the way a girl once did from a cart wheel.'
        : "The checkpoint's young officer has a northern accent and a well-thumbed copy of the Chronicle in her coat. \"My grandmother crossed here,\" she says, before you ask. \"Your seal. Different face.\"",
    );
  }
  text.push(
    policy === 'granted'
      ? 'Refugee families pass through toward the northern camps, one stamped paper at a time.'
      : policy === 'removed'
        ? 'The gate is shut on your own decree. Families sit in the mud on the far side.'
        : 'The gate is closed by default; families wait in the mud for a decree that has not come.',
  );
  const scout = checkpointScout(exp);
  const afterFight = exp && exp.phase !== 'main' && scout && scout !== 'taken';
  if (afterFight) {
    text.unshift(
      scout === 'caught'
        ? 'The man in the grey coat is face-down in the mud with Mara\'s knee in his back. Under the refugee\'s coat: a Syndicate pathfinder\'s harness and a short blade still warm from your guard.'
        : exp.phase === 'after_retreat'
          ? 'You lower your blade. The man in the grey coat backs into the crowd, and the crowd closes around him, and he is gone.'
          : 'When you get your breath back, the man in the grey coat is gone into the reeds. He left the coat behind. Sparky is chewing it.',
    );
  }
  text.push(
    'A girl of about nine sits on a cart wheel with her hood up, watching your banner. Her mother is arguing with the duty sergeant. Her little brother is asleep in a crate of turnips.',
    '"Are you the God-King?" the girl asks. Then, before you answer: "Mama says you decide who\'s allowed to live where."',
  );
  if (!scout) {
    text.push(
      'Sparky has not looked at the girl once. He is staring at a man in a grey refugee\'s coat at the back of the line, and the crest along his spine is standing straight up. Mara follows his gaze and goes very still.',
    );
  }

  const settle = (id, label, effects, result) => ({ id, kind: 'advance', label, effects: [character('mika', { status: 'met' }), ...effects], result });
  const helped = [
    flag('mika_family', 'helped'),
    mem('mika', 'PLAYER_HELPED_FAMILY', 'The God-King got my family through the Greywater checkpoint.', 7, 0.9, { permanent: true }),
    mem('mika', 'PLAYER_PERSONALLY_INTERVENED', 'The God-King came down off the horse and did it personally.', 6, 0.8, { permanent: true }),
    rel('mika', { trust: 20, affection: 15 }),
    rel('mara', { trust: 4, affection: 2 }),
    flag('civilians', 'saved'),
    chron("The Sovereign's Seal at Greywater", `At the Greywater checkpoint the Sovereign personally passed a northern family named ${family} through the gate — and a girl called ${child}.`, 'personal', ['mika']),
  ];

  const scoutChoices = [];
  if (!scout) {
    scoutChoices.push({
      id: 'call_out_scout',
      kind: 'duel',
      label: 'Call out the man in the grey coat',
      hint: 'A hidden blade · he fights with feints',
      duel: (s, e) => duelConfig(s, e, 'checkpoint', 'blade_adept', SCOUT, 'march', true),
    });
    if (state.resources.intel >= 35) {
      scoutChoices.push({
        id: 'signal_watchers',
        kind: 'talk',
        label: "Signal Cassian's watchers to take him quietly",
        hint: 'Your intelligence network is here',
        effects: [
          flag('checkpoint_scout', 'taken'),
          res('intel', 4),
          rel('cassian', { trust: 3, respect: 2 }),
          mem('cassian', 'THE_SOVEREIGN_LET_MY_PEOPLE_WORK', 'At Greywater the Sovereign let my watchers take a Syndicate scout without a scene.', 4, 0.6),
        ],
        result: [
          'You touch two fingers to your collar. A tinker, a sergeant and a woman selling hot chestnuts all stop what they are doing. The man in the grey coat does not reach the reeds.',
          'Nobody in the line sees anything. That is the point. Somewhere in the Citadel, Cassian will allow himself one small smile.',
        ],
      });
    }
  }
  if (scout === 'caught' && !exp.picked.includes('search_scout')) {
    scoutChoices.push({
      id: 'search_scout',
      kind: 'talk',
      label: "Search the pathfinder's harness",
      effects: [
        flag('checkpoint_scout', 'caught'),
        res('intel', 6),
        thread(T_SYN, { visibility: 'known' }),
        mem('mika', 'THE_SOVEREIGN_FOUGHT_IN_THE_MUD', 'The God-King fought a Syndicate spy in the mud at the checkpoint, right in front of me.', 4, 0.5),
      ],
      result: [
        'Folded flat in the harness: a map of Greywater Ford, the crossing marked in red ink, and tonight\'s date. Mara reads it twice and hands it to you without a word.',
        'On the cart wheel, the girl has not moved. She watched the whole fight. She is still watching you.',
      ],
    });
  }

  const choices = [
    ...scoutChoices,
    {
      id: 'ask_mika',
      kind: 'talk',
      label: 'Ask her what she saw in the north',
      effects: [
        character('mika', { status: 'met' }),
        rel('mika', { trust: 5, affection: 5 }),
        mem('mika', 'THE_SOVEREIGN_ASKED_ME', 'The God-King asked me what I saw, and listened.', 3, 0.6),
        thread(T_WARGS, { visibility: 'known' }),
        ...(state.threads[T_MYSTERY].visibility === 'hidden' ? [thread(T_MYSTERY, { visibility: 'rumored' })] : []),
      ],
      result: [
        '"The wolves walked with us," she says. "Not at us. With us. Like they were running from the same thing."',
        'She thinks about it. "And the ice had lights in it. Underneath. Like somebody left a lamp on."',
      ],
    },
    {
      id: 'sparky_hello',
      kind: 'talk',
      label: 'Let Sparky say hello',
      effects: [character('mika', { status: 'met' }), rel('mika', { affection: 8 }), counter('sparkyCare'), rel('sparky', { affection: 3 })],
      result: [
        `Sparky sniffs the turnip crate, wakes the little brother, and licks his face with a tongue that fizzes faintly. The boy shrieks. Then he laughs. Then ${child} laughs, which seems to surprise her.`,
        'Sparky steals a turnip on the way back. Nobody stops him.',
      ],
    },
    policy === 'granted'
      ? settle('walk_through', 'Walk the family through the gate yourself', helped, [
          'You dismount and walk them through the gate yourself. The sergeant stamps the paper twice to be safe.',
          `${child} does not say thank you. She looks at you like she is memorizing you.`,
        ])
      : settle('seal', 'Grant the family passage under your own seal', helped, [
          'You write your name on the duty sergeant\'s paper. He stares at it for a long time.',
          `${child}'s mother cries without making a sound. ${child} doesn't. She looks at you like she is memorizing you.`,
        ]),
    settle(
      'rations',
      'Give them your rations',
      [
        flag('mika_family', policy === 'granted' ? 'helped' : 'fed'),
        mem('mika', 'PLAYER_HELPED_FAMILY', 'The God-King gave us bread at the checkpoint.', 4, 0.6),
        rel('mika', { trust: 8, affection: 8 }),
        rel('sparky', { affection: -2 }),
      ],
      [`You hand down your saddlebag rations. Sparky watches the bread leave with open betrayal, then tries to steal it back. ${child} holds it over her head and glares at him until he gives up.`],
    ),
    policy === 'granted'
      ? settle(
          'let_work',
          'Let the checkpoint do its work',
          [flag('mika_family', 'passed'), mem('mika', 'THE_GATE_OPENED', 'The gate opened on the King\'s law, not the King\'s hand.', 2, 0.2)],
          ['You let the system you built do its work. The family passes through with everyone else, stamped and counted.'],
        )
      : settle(
          'turn_back',
          'Uphold the closed border — send them back north',
          [
            flag('mika_family', 'turned_back'),
            flag('refugees_policy', 'removed'),
            flag('civilians', 'ignored'),
            mem('mika', 'PLAYER_ORDERED_REFUGEES_REMOVED', 'The God-King sent my family back into the snow.', 8, -0.9, { permanent: true }),
            rel('mika', { trust: -25, resentment: 30 }),
            rel('mara', { trust: -3 }),
            res('unrest', 3),
            chron('Refugees Turned Back at Greywater', 'In person, the Sovereign upheld the closed border and sent a northern family back into the snow.', 'decision', ['mika']),
          ],
          [
            'The sergeant turns the cart around. Nobody argues; they have run out of arguing.',
            `${child} looks back once from the cart wheel. She does not look away first.`,
          ],
        ),
    settle(
      'walk_past',
      'Ride past',
      [flag('mika_family', 'ignored'), mem('mika', 'PLAYER_IGNORED_FAMILY', 'The God-King rode past.', 5, -0.6)],
      ['You ride on. Behind you the sergeant keeps arguing with the mother, and the girl keeps watching your banner until the road bends.'],
    ),
  ];
  return {
    id: 'checkpoint',
    title: 'The Greywater Checkpoint',
    subtitle: 'Civilian & refugee checkpoint',
    scene: { beat: 'checkpoint', timeOfDay: 'day' },
    speaker: { id: 'mika', line: '"Are you the God-King?"' },
    text,
    choices,
  };
}

function wargChampion(state) {
  return state.cycle.number >= 2
    ? { name: 'Rimefang the Elder', epithet: 'An alpha who remembers your last incarnation' }
    : { name: 'Rimefang', epithet: 'Alpha of the Holloway pack' };
}

function beatWilds(state, exp) {
  const truce = hasLegacy(state, 'warg_truce');
  const friendly = state.factions[WARGS].attitude >= 20;
  const sparkyBrave = atLeast(state.characters.sparky.rel, 'Fond') || state.characters.sparky.rel.trust >= 40;
  const text = [
    'North of the road the frontier turns to pine and snow. At dusk the pack is waiting on the path: a dozen Frost Wargs and an alpha the size of a cart horse, frost in its ruff, eyes like lamps.',
  ];
  if (truce) text.push('The alpha lifts its head when it sees you. It knows your scent — or something older than your scent. It hesitates.');
  if (state.cycle.number >= 2 && state.history.some((h) => h.keys?.skaela_spoke)) {
    text.push('On the ridge above the pack lies the Queen herself, older now, grey as old ice. She lowers her head to you a fraction of an inch. She knows exactly who you are.');
  }
  else if (friendly) text.push('The pack does not snarl. It watches. It is hungry, and it is deciding.');
  else text.push('The pack spreads across the path. Behind you the supply wagons stop. Mara\'s hand is on her sword; she waits for yours.');

  if (exp.phase === 'after_victory') {
    return {
      id: 'wilds',
      title: 'The Frontier Wilds',
      subtitle: 'The alpha is down',
      scene: { beat: 'wilds', timeOfDay: 'dusk' },
      text: ['The alpha lies in the trampled snow, flank heaving, steam rising from its wounds. The pack has fallen back to the treeline. They are watching you, not it.'],
      choices: [
        {
          id: 'spare_alpha',
          kind: 'advance',
          label: 'Lower your blade and let it go',
          effects: [
            counter('wargMercy'),
            fac(WARGS, { attitude: 10, tension: -6, memory: { peacemaker: 4 } }),
            rel('sparky', { affection: 4 }),
            chron('Mercy in the Frontier Wilds', 'The Sovereign bested the alpha Rimefang in single combat and let it walk away.', 'duel', ['wargs']),
          ],
          result: [
            'The alpha rises, slowly. It limps to the treeline and stops once to look back at you — not the way an animal looks at a predator. The way a soldier looks at an officer from the other army.',
            'On the ridge above the pines, something far larger than the alpha is watching: grey as old ice, scarred from muzzle to shoulder. When you look straight at it, there is only snow.',
          ],
        },
        {
          id: 'finish_alpha',
          kind: 'advance',
          label: 'Finish it',
          effects: [
            fac(WARGS, { attitude: -15, memory: { conqueror: 8 } }),
            rel('sparky', { affection: -5, fear: 6 }),
            mem('sparky', 'PLAYER_KILLED_THE_ALPHA', 'You killed the wolf that was already beaten.', 5, -0.6),
            chron('The Alpha of Holloway Slain', 'The Sovereign killed the warg alpha Rimefang on the frontier path.', 'duel', ['wargs']),
          ],
          result: ['It is quick. The pack howls once, all together, and is gone. Sparky does not come out from under the wagon until morning.'],
        },
      ],
    };
  }
  if (exp.phase === 'after_defeat' || exp.phase === 'after_retreat') {
    return {
      id: 'wilds',
      title: 'The Frontier Wilds',
      subtitle: exp.phase === 'after_retreat' ? 'You fell back' : 'You are in the snow',
      scene: { beat: 'wilds', timeOfDay: 'dusk' },
      text: [
        exp.phase === 'after_retreat'
          ? 'You give ground. The alpha does not follow. It stands on the path until the wagons have turned, and then it is simply gone.'
          : "The alpha knocks you into the snow and stands over you, breath like a furnace. Then Mara's rangers are there with torches, and the pack is gone. It could have killed you. It didn't.",
      ],
      choices: [{ id: 'press_on', kind: 'advance', label: 'Press on, bruised', effects: [], result: [] }],
    };
  }
  const choices = [
    {
      id: 'face_alpha',
      kind: 'duel',
      label: 'Face the alpha',
      hint: 'Single combat · the patience check',
      duel: (s, e) => duelConfig(s, e, 'wilds', 'warg_alpha', wargChampion(s), 'march', true),
    },
    {
      id: 'leave_meat',
      kind: 'advance',
      label: 'Leave the supply meat and pass quietly',
      effects: [counter('wargMercy'), res('treasury', -40), fac(WARGS, { attitude: 10, tension: -5, memory: { peacemaker: 2 } })],
      result: ['The drovers roll a side of salt beef into the snow and back away. The alpha waits until you are past before it eats. It watches you the whole time.'],
    },
  ];
  if (sparkyBrave) {
    choices.push({
      id: 'sparky_stands',
      kind: 'advance',
      label: 'Let Sparky stand his ground',
      effects: [
        counter('sparkyCare'),
        rel('sparky', { trust: 6, respect: 8, affection: 4 }),
        mem('sparky', 'PLAYER_TRUSTED_ME', 'You let me protect everyone. You trusted me.', 5, 0.9),
        fac(WARGS, { attitude: 5 }),
      ],
      result: [
        'Sparky hops off the wagon and plants himself in the snow between the pack and the drovers: wings mantled, acid hissing on his lips. He is a third of the alpha\'s size. He does not move.',
        'After a long moment the alpha huffs — almost a laugh — and turns away. Sparky walks back to the wagon very slowly, very proudly, and then has to sit down.',
      ],
    });
  }
  if (truce || friendly) {
    choices.push({
      id: 'open_hand',
      kind: 'advance',
      label: 'Raise an open hand',
      effects: [counter('wargMercy'), fac(WARGS, { attitude: 12, memory: { peacemaker: 6 } })],
      result: ['You raise your hand, empty. The alpha steps off the path and the pack goes with it, close enough to touch the wagons, touching nothing.'],
    });
  }
  choices.push({
    id: 'go_around',
    kind: 'advance',
    label: 'Take the long way around',
    effects: [thread(T_SYN, { urgency: 6 })],
    result: ['The detour through the gullies costs a day. Somewhere south, the Syndicate gets a day closer to whatever it is planning.'],
  });
  return {
    id: 'wilds',
    title: 'The Frontier Wilds',
    subtitle: 'Frost Warg pack on the path',
    scene: { beat: 'wilds', timeOfDay: 'dusk' },
    text,
    choices,
  };
}

function beatRuin(state, exp) {
  const studied = exp.picked.includes('study');
  const remembered = state.cycle.number >= 2 && state.history.some((h) => h.keys?.architect_studied);
  const text = [
    'Off the road, half-buried in a hillside: stones too regular to be natural and too old to be Elvian. Mara does not like it. Sparky likes it less; he will not come within twenty paces, and the crest along his spine stands straight up.',
    'On the largest stone, cut so precisely the frost cannot settle in it: a broken circle surrounding a small star.',
  ];
  if (remembered) text.push('You know this place. You have never been here.');
  if (exp.phase === 'after_victory' || exp.phase === 'after_defeat' || exp.phase === 'after_retreat') {
    return {
      id: 'ruin',
      title: 'The Broken Circle',
      subtitle: 'An abandoned structure, older than Elvia',
      scene: { beat: 'ruin', timeOfDay: 'night' },
      text: [
        exp.phase === 'after_victory'
          ? 'The echo kneels and comes apart into light. In the last instant its face is yours. Then it is no one\'s.'
          : 'You wake on the cold stones with Mara holding your head. "You just stopped," she says. "Stood there and stopped. For a full minute."',
        'The symbol is just a carving again. The frost still will not touch it.',
      ],
      choices: [{ id: 'leave_ruin', kind: 'advance', label: 'Leave the ruin', effects: [], result: [] }],
    };
  }
  const choices = [
    {
      id: 'ask_mara_ruin',
      kind: 'talk',
      label: 'Ask Mara about this place',
      effects: [rel('mara', { affection: 1 })],
      result: ['"My grandmother said all the old roads lead here," Mara says. "She also said not to follow them."'],
    },
  ];
  if (!studied) {
    choices.push({
      id: 'study',
      kind: 'talk',
      label: 'Study the broken circle',
      effects: [
        flag('FIRST_ARCHITECT_SYMBOL_DISCOVERED', true),
        flag('architect_studied', true),
        thread(T_MYSTERY, { stage: 1, visibility: 'known', urgency: 10 }),
        chron('Unknown Symbol Discovered', 'In a ruin off the frontier road the Sovereign found a broken circle surrounding a small star. No one could say who carved it.', 'discovery', ['mystery']),
        heat(12, 'revelation'),
      ],
      result: [
        'You trace it with a gloved finger. The stone is warm.',
        'For one heartbeat the world is threads — every pine, every soldier, Sparky, yourself — a weave of light pulled tight across nothing. Then it is just a stone again.',
        'Nobody else saw it. Mara is staring at you.',
      ],
    });
  } else {
    choices.push(
      {
        id: 'sketch_for_vale',
        kind: 'talk',
        label: 'Sketch it for Vale',
        effects: [rel('vale', { affection: 4, trust: 2 }), mem('vale', 'PLAYER_BROUGHT_ME_THE_SYMBOL', 'You brought me a drawing of the broken circle.', 4, 0.8)],
        result: ['You sketch it on the back of a supply chit. Months later Vale will frame it, and then lose the frame, and then find it again in a teapot.'],
      },
      {
        id: 'touch_star',
        kind: 'duel',
        label: 'Touch the star at its center',
        hint: 'Something answers · the story check',
        duel: (s, e) =>
          duelConfig(s, e, 'ruin', 'fallen_champion', { name: 'An Echo in a Crown', epithet: 'Lattice-memory of a sovereign who came before' }, 'march', true),
      },
    );
  }
  choices.push({ id: 'leave_ruin', kind: 'advance', label: studied ? 'Leave it be' : 'Leave it buried', effects: [], result: [] });
  return {
    id: 'ruin',
    title: 'The Broken Circle',
    subtitle: 'Optional · an abandoned structure, older than Elvia',
    scene: { beat: 'ruin', timeOfDay: 'night' },
    text,
    choices,
  };
}

function casualtiesFor(result, fortified) {
  if (!result) return 0;
  if (result.outcome !== 'victory') return fortified ? 3 : 5;
  if (result.playerHpRemaining < 0.3) return fortified ? 2 : 4;
  if (result.playerHpRemaining < 0.65) return fortified ? 1 : 2;
  return fortified ? 0 : 1;
}

function beatChampion(state, exp) {
  const lead = crossingLeader(state);
  const isNyra = lead.name === 'Lieutenant Nyra Kell';
  const rs = state.regions.southern_marches.state;
  const heard = exp.picked.includes('ask_why');
  const name = isNyra ? 'Nyra' : 'Ostrava';
  const base = {
    id: 'champion',
    title: 'Greywater Ford',
    subtitle: 'Iron Syndicate encounter zone',
    scene: { beat: 'champion', timeOfDay: 'night' },
  };

  if (exp.phase === 'after_victory') {
    const fateEffects = (fate) => [
      flag('nyra_fate', fate),
      flag(`march_champion_${state.cycle.number}`, 'won'),
      thread(T_SYN, { stage: 1, urgency: -30 }),
    ];
    const choices = [
      {
        id: 'release',
        kind: 'advance',
        label: `Send ${name} home`,
        effects: [
          ...fateEffects('released'),
          ...(isNyra ? [character('nyra', { status: 'released' }), rel('nyra', { trust: 15, respect: 15 }), mem('nyra', 'PLAYER_SPARED_ME', 'The God-King beat me in the ford and sent me home.', 9, 0.8, { permanent: true })] : []),
          fac(SYN, { attitude: 10, memory: { peacemaker: 8 } }),
          rel('mara', { respect: -1 }),
          chron(`${lead.name} Spared at Greywater`, `The Sovereign defeated ${lead.name} in single combat at Greywater Ford and sent her home.`, 'duel', ['nyra']),
        ],
        result: [`${name} stares at you from the water. "Why?" You don't answer. Neither does she, but she walks back across the ford upright.`, '"She\'ll be back," Mara says. "They always come back." She doesn\'t sound sure that\'s bad.'],
      },
      {
        id: 'capture',
        kind: 'advance',
        label: 'Take her prisoner',
        effects: [
          ...fateEffects('captured'),
          ...(isNyra ? [character('nyra', { status: 'captured' }), mem('nyra', 'PLAYER_TOOK_ME_PRISONER', 'The God-King took me prisoner at Greywater.', 7, -0.4)] : []),
          res('intel', 10),
          rel('cassian', { trust: 3 }),
          fac(SYN, { attitude: -4 }),
          chron('A Walker Ace Taken at Greywater', `${lead.name} was taken prisoner after losing single combat to the Sovereign.`, 'duel', ['nyra']),
        ],
        result: [`${name} gives up her shock-blade hilt-first. Cassian will have questions. She will have fewer answers than he hopes.`],
      },
      {
        id: 'recruit',
        kind: 'advance',
        label: 'Offer her a place in Elvia',
        hint: heard ? 'She told you why she came' : 'You never asked why she came',
        effects: isNyra && heard && state.characters.nyra.rel.trust >= 0
          ? [
              ...fateEffects('recruited'),
              character('nyra', { status: 'recruited', role: 'Former Syndicate pilot · Royal Army' }),
              rel('nyra', { trust: 20, respect: 10 }),
              mem('nyra', 'PLAYER_OFFERED_ME_A_PLACE', 'The God-King listened, beat me, and offered me a place anyway.', 8, 0.7, { permanent: true }),
              fac(SYN, { attitude: -8 }),
              chron('A Syndicate Ace Changes Sides', `${lead.name} laid down her blade at Greywater and swore to the Elvian crown.`, 'duel', ['nyra']),
            ]
          : [
              ...fateEffects('released'),
              ...(isNyra ? [character('nyra', { status: 'released' }), mem('nyra', 'PLAYER_OFFERED_ME_A_PLACE', 'The God-King offered me a place. I said no.', 6, 0.3)] : []),
              fac(SYN, { attitude: 4, memory: { peacemaker: 3 } }),
              chron(`${lead.name} Refuses the Crown`, `Offered a place in Elvia after losing at Greywater, ${lead.name} refused and walked home.`, 'duel', ['nyra']),
            ],
        result:
          isNyra && heard && state.characters.nyra.rel.trust >= 0
            ? ['She looks at your hand for a long time. "You listened," she says. "Nobody on either side of this river has listened in my whole life." She takes it.']
            : [`"No," ${name} says. "But ask me again in ten years." She walks home across the ford.`],
      },
      {
        id: 'execute',
        kind: 'advance',
        label: 'Execute her as a warning',
        warning: 'Mara will remember this.',
        effects: [
          ...fateEffects('killed'),
          ...(isNyra ? [character('nyra', { status: 'killed' })] : []),
          fac(SYN, { attitude: -25, tension: -8, memory: { conqueror: 15 } }),
          rel('mara', { trust: -6, resentment: 8 }),
          mem('mara', 'PLAYER_EXECUTED_A_PRISONER', 'You executed a pilot who had already surrendered.', 8, -0.8, { permanent: true }),
          rel('sparky', { fear: 10 }),
          chron('The Execution at Greywater Ford', `${lead.name} surrendered to the Sovereign and was executed on the riverbank as a warning to Kessrin.`, 'duel', ['nyra']),
          heat(20, 'death'),
        ],
        result: ['It is done on the riverbank, in front of both sides. The Syndicate lance withdraws before dawn. Kessrin will tell this story for a hundred years.', 'Mara does not speak to you for the rest of the night. "That wasn\'t a battle, Majesty," she says at last. "We\'ll be paying for it after I\'m dead."'],
      },
    ];
    return { ...base, subtitle: 'The ford is yours', text: [`${name} is on her knees in the ford, her shock-blade in the water. The walker lance behind her has stopped firing. Everyone on both banks is waiting to see what the God-King does.`], choices };
  }

  if (exp.phase === 'after_defeat' || exp.phase === 'after_retreat') {
    return {
      ...base,
      subtitle: exp.phase === 'after_retreat' ? 'You fell back across the ford' : 'Wounded in the ford',
      text: [
        exp.phase === 'after_retreat'
          ? `You fall back across the ford. ${name} lets you go. "Next time," she calls after you, and it sounds almost like a promise.`
          : `${name}'s blade takes you across the ribs and the river takes your feet. Mara's soldiers drag you out of the ford under walker fire.`,
        'Defeat is not the end of the march. You can name what you misread. The question is whether you want her to see you try again.',
      ],
      choices: [
        { id: 'rematch', kind: 'duel', label: 'Again. Now.', hint: 'Rematch · you know her timing now', duel: (s, e) => duelConfig(s, e, 'champion', 'blade_adept', { name: lead.name, epithet: 'Ace of the Fourth Walker Lance' }, 'champion', true) },
        {
          id: 'withdraw',
          kind: 'advance',
          label: 'Withdraw to camp',
          effects: [
            flag(`march_champion_${state.cycle.number}`, 'lost'),
            region({ state: rs === 'FORTIFIED' ? 'FORTIFIED' : 'AFTERMATH', damage: 10 }),
            fac(SYN, { tension: 5, attitude: 3 }),
            ...(isNyra ? [character('nyra', { status: 'met' }), mem('nyra', 'I_BEAT_THE_GOD_KING', 'I beat the God-King in the ford at Greywater.', 7, 0.3)] : []),
            chron('The Sovereign Withdrew from Greywater', `${lead.name} held Greywater Ford against the Sovereign in single combat.`, 'duel', ['nyra']),
          ],
          result: ['The banner withdraws to the forward camp. The Syndicate holds the ford tonight. The Chronicle will say so.'],
        },
      ],
    };
  }

  const text = [
    rs === 'FORTIFIED'
      ? 'Greywater Ford at night: Aegis pylons on your bank, walker lamps on theirs, and between them a hundred yards of black water and broken ice.'
      : 'Greywater Ford at night: the captured depot burns on the far bank, and a Syndicate walker stands knee-deep in the river with its lamps on your banner.',
  ];
  if (isNyra) {
    text.push('The walker\'s hatch opens. The pilot who climbs down is young — twenty-four, maybe — cropped hair, a shock-blade on her hip.');
    if (state.flags.intel_nyra_dossier) text.push('You know her name before she gives it: Nyra Kell, of Kessrin-on-Ash.');
    text.push('"So you\'re real," she says. "They told us the God-King never comes in person. Kings send other people\'s children."');
  } else {
    text.push('A Syndicate officer climbs down from the walker: Captain Ilse Ostrava, a Blade-Adept of the Iron Academies, who has clearly read about you. "The Chronicle says you come yourself," she says. "Let\'s see if the Chronicle lies."');
  }
  const scout = checkpointScout(exp);
  if (scout === 'caught') text.push('The map from the grey coat was exact: the lance is camped exactly where the red ink said. They were not expecting you tonight.');
  else if (scout === 'taken') text.push("A runner from Cassian's watchers caught up with you on the road: the lance at the ford has had no word from its pathfinder since noon. They are nervous. Nervous soldiers are slow.");
  else if (scout === 'escaped') text.push(`"Our pathfinder said you'd come by moonrise," ${name} calls across the water. "He said you were good. He didn't say how good."`);
  if (state.flags[`march_retreated_${state.cycle.number}`] || state.counters.retreats > 0) {
    text.push(`"I heard you turned back once," ${name} calls across the water. "I hope you didn't come all this way to do it again."`);
  }
  const choices = [];
  if (isNyra && !heard) {
    choices.push({
      id: 'ask_why',
      kind: 'talk',
      label: 'Ask why she crossed',
      effects: [character('nyra', { status: 'met' }), rel('nyra', { respect: 6, trust: 3 }), mem('nyra', 'THE_SOVEREIGN_ASKED_WHY', 'The God-King asked me why. To my face.', 4, 0.4)],
      result: [
        '"Because your magic burns cities," she says. "It burned mine. Ash District, the year I was born. You call it the Lattice Fire like it was weather."',
        '"Our doctrine is one sentence long: human destiny must never depend on forces humanity cannot control. Look at your border, God-King. Look at what hums on it."',
      ],
    });
  }
  if (isNyra && heard && state.flags.intel_nyra_dossier && !exp.picked.includes('tell_ash')) {
    choices.push({
      id: 'tell_ash',
      kind: 'talk',
      label: 'Tell her you know about Ash District',
      effects: [rel('nyra', { trust: 10 })],
      result: ['"Then you know I\'m not lying," she says. For the first time she sounds tired instead of angry.'],
    });
  }
  choices.push({
    id: 'challenge',
    kind: 'duel',
    label: 'Challenge her to single combat',
    hint: 'Named duel · the duelist check',
    duel: (s, e) => duelConfig(s, e, 'champion', 'blade_adept', { name: lead.name, epithet: isNyra ? 'Ace of the Fourth Walker Lance' : 'Blade of the Iron Academies' }, 'champion', true),
  });
  return { ...base, text, choices };
}

function skirmishChampion(state) {
  const syn = state.factions[SYN];
  if (syn.tension >= 45 || state.factions[WARGS].attitude >= 0) {
    return { archetypeId: 'blade_adept', champion: { name: 'Captain Sable Ostrava', epithet: "General Drae's Blade" }, foe: 'syndicate' };
  }
  return { archetypeId: 'warg_alpha', champion: { name: 'Old Rime', epithet: 'Alpha of the northern packs' }, foe: 'wargs' };
}

function beatSkirmish(state, exp) {
  const pick = skirmishChampion(state);
  const base = { id: 'skirmish', title: 'The Skirmish at Greywater', subtitle: 'Winter · the deployment that matters', scene: { beat: 'champion', timeOfDay: 'dusk' } };
  if (exp.phase === 'after_victory') {
    return {
      ...base,
      text: [pick.foe === 'syndicate' ? 'Sable Ostrava yields in the snow. Across the river the vanguard lowers its blades one by one. Drae\'s war does not start today.' : 'Old Rime goes down in the snow and does not rise until you step back. The packs melt into the white.'],
      choices: [
        {
          id: 'hold_greywater',
          kind: 'advance',
          label: 'Hold Greywater',
          effects: [
            flag('skirmish_won', true),
            fac(pick.foe === 'syndicate' ? SYN : WARGS, { tension: -20, memory: { peacemaker: 3 } }),
            res('readiness', 5),
            rel('mara', { respect: 6, trust: 3 }),
            chron('The Sovereign Held Greywater', `In the winter skirmish at Greywater the Sovereign bested ${pick.champion.name} in person.`, 'duel'),
          ],
          result: ['The army saw it. By spring every soldier in the Marches will claim to have been standing in the front row.'],
        },
      ],
    };
  }
  if (exp.phase === 'after_defeat' || exp.phase === 'after_retreat') {
    return {
      ...base,
      text: ['You are carried back from the ford. The line holds without you — barely, and at a price.'],
      choices: [
        { id: 'rematch', kind: 'duel', label: 'Again. Now.', hint: 'Rematch', duel: (s, e) => duelConfig(s, e, 'skirmish', pick.archetypeId, pick.champion, 'champion', true) },
        {
          id: 'withdraw',
          kind: 'advance',
          label: 'Withdraw',
          effects: [flag('skirmish_won', false), fac(SYN, { tension: 5 }), region({ casualties: 3, damage: 8 }), chron('Greywater Without Its Sovereign', `${pick.champion.name} bested the Sovereign at Greywater; the line held without the crown.`, 'duel')],
          result: ['The winter ends without a decision. Everyone remembers who walked away.'],
        },
      ],
    };
  }
  return {
    ...base,
    text: [
      pick.foe === 'syndicate'
        ? 'The vanguard waits on the ice. Its champion steps forward alone, shock-blade crackling: Captain Sable Ostrava, the Blade Drae sends when he wants a story told.'
        : 'Old Rime comes out of the blizzard alone, enormous and scarred. The packs stop at the treeline to watch.',
    ],
    choices: [{ id: 'face', kind: 'duel', label: `Face ${pick.champion.name}`, hint: 'Single combat · settles the winter', duel: (s, e) => duelConfig(s, e, 'skirmish', pick.archetypeId, pick.champion, 'champion', true) }],
  };
}

function beatLastStand(state, exp) {
  const base = { id: 'last_stand', title: 'The Siege of the Marches', subtitle: 'The last stand', scene: { beat: 'champion', timeOfDay: 'night' } };
  if (exp.phase === 'after_victory') {
    return {
      ...base,
      text: ['General Corvin Drae goes down in the mud beside his command walker. The siege breaks before the sun is up.'],
      choices: [
        {
          id: 'siege_broken',
          kind: 'advance',
          label: 'Ride back through the gates',
          effects: [flag('skirmish_won', true), fac(SYN, { tension: -40, memory: { conqueror: 4 } }), chron('The Sovereign Broke the Siege', 'At the Siege of the Marches the Sovereign rode out and defeated General Corvin Drae in person.', 'battle')],
          result: ['They ring the bells in Harrowmere all night.'],
        },
      ],
    };
  }
  if (exp.phase === 'after_defeat') {
    return {
      ...base,
      text: ['Drae\'s blade finds you in the dark. The last thing you see is your banner, still standing.', 'The Lattice holds the thread.'],
      choices: [{ id: 'fall', kind: 'advance', label: 'Let go', effects: [flag('sovereign_fell', true), chron('The Sovereign Fell at the Marches', 'At the Siege of the Marches the Sovereign rode out against General Corvin Drae and did not ride back.', 'battle')], result: [] }],
    };
  }
  return {
    ...base,
    text: ['Drae\'s walkers ring the Marches. The general himself waits beside his command walker, blade drawn, because he wants history to see this.'],
    choices: [{ id: 'ride_out', kind: 'duel', label: 'Ride out and face Drae', hint: 'Last stand · defeat here ends this life', duel: (s, e) => duelConfig(s, e, 'last_stand', 'blade_adept', { name: 'General Corvin Drae', epithet: 'Who wanted this war' }, 'last_stand', false) }],
  };
}

function beatCamp(state, exp) {
  const fallen = exp.fallen;
  return {
    id: 'camp',
    title: 'Forward Camp',
    subtitle: 'Overlooking the Southern Marches',
    scene: { beat: 'camp', timeOfDay: 'night' },
    text: [
      'The forward camp overlooks the Southern Marches. Small fires. Exhausted soldiers. Somebody is singing badly and nobody is stopping him.',
      fallen.length ? `${fallen.length} soldier${fallen.length > 1 ? 's' : ''} did not come back to camp tonight.` : 'Everyone came back to camp tonight. Mara checked twice.',
    ],
    choices: [{ id: 'rest', kind: 'advance', label: 'Sit by the fire', effects: [], result: [] }],
  };
}

const BEATS = {
  road: beatRoad,
  checkpoint: beatCheckpoint,
  wilds: beatWilds,
  ruin: beatRuin,
  champion: beatChampion,
  skirmish: beatSkirmish,
  last_stand: beatLastStand,
  camp: beatCamp,
};

/** The current beat, resolved for this state. Talk choices already picked are hidden. */
export function getBeat(state) {
  const exp = state.expedition;
  if (!exp) return null;
  const beat = BEATS[currentBeatId(exp)](state, exp);
  beat.choices = beat.choices.filter((c) => !(c.kind === 'talk' && exp.picked.includes(c.id)));
  return beat;
}

// ─── Deployment offers after a War Room resolution ─────────────────────────────

const BEAT_NAMES = { road: 'the frontier road', checkpoint: 'the Greywater checkpoint', wilds: 'the frontier wilds', ruin: 'the broken circle', champion: 'Greywater Ford', skirmish: 'the winter skirmish', last_stand: 'the Siege of the Marches' };

/** Every deployment the Sovereign may take after this turn's resolution (may be empty). */
export function deploymentOffers(state) {
  const c = state.cycle.number;
  const f = state.flags;
  const offers = [];
  const marchDone = Boolean(f[`march_done_${c}`]);
  if (!marchDone && state.turn <= 4) {
    offers.push({
      kind: 'march',
      title: f[`march_retreated_${c}`] ? 'Walk the Southern Marches Again' : 'Walk the Southern Marches',
      text: 'Leave the War Room and walk the frontier in person: the road, the checkpoint, the wilds, an old ruin, and Greywater Ford.',
      recommender: 'mara',
      line:
        f[`march_retreated_${c}`]
          ? '"We turned back once. The road is still there, Majesty. So am I."'
          : state.turn === 1
            ? '"Reports only tell you what someone wanted to write down. Walk the Marches with me, Majesty. See it."'
            : '"You\'ve been reading about this border for months. Come and stand on it."',
    });
  }
  if (state.turn === 4 && !f[`skirmish_done_${c}`]) {
    offers.push({
      kind: 'skirmish',
      title: 'Ride to Greywater',
      text: 'Settle the winter skirmish yourself, in single combat on the ice. This is the deployment that matters.',
      recommender: 'mara',
      line: '"I can hold the ford with orders. I can end it with you."',
    });
  }
  if (state.turn === 5 && borderOutcome(state) === 'siege' && !f[`laststand_done_${c}`]) {
    offers.push({
      kind: 'last_stand',
      title: 'Ride Out to Break the Siege',
      text: 'Face General Drae in person. Victory breaks the siege. Defeat ends this life — and begins the next.',
      recommender: 'mara',
      line: '"I won\'t tell you not to. I\'ll tell you I\'ll be right behind you."',
      danger: true,
    });
  }
  return offers;
}

/** Back-compat: the first offer, or null. */
export function deploymentOffer(state) {
  return deploymentOffers(state)[0] ?? null;
}

// Effects applied directly from a duel result (before the post-duel beat choices).
// "Victory writes to the Chronicle, readiness, and character memory immediately" (Cycle doc §7).
export function duelOutcomeEffects(state, exp, result) {
  const beat = currentBeatId(exp);
  const fortified = state.regions.southern_marches.state === 'FORTIFIED';
  const effects = [];
  const champion = beat === 'champion' || beat === 'skirmish' || beat === 'last_stand';
  const foe = result.enemyName ?? 'the enemy';
  const place = BEAT_NAMES[beat] ?? 'the march';
  if (result.outcome === 'victory') {
    effects.push(
      counter('duelsWon'),
      heat(champion ? 18 : 10, champion ? 'major_victory' : 'minor_conflict'),
      res('readiness', champion ? 4 : 2),
      rel('mara', { respect: champion ? 4 : 2 }),
      mem('mara', `SAW_THE_SOVEREIGN_WIN_AT_${beat.toUpperCase()}`, `I watched the Sovereign beat ${foe} at ${place}.`, champion ? 5 : 3, 0.6),
    );
    if (result.flawless) effects.push(rel('mara', { respect: 2 }), res('readiness', 2));
    if (!champion) effects.push(chron(`The Sovereign Bested ${foe}`, `At ${place}, the Sovereign met ${foe} in single combat and won.`, 'duel'));
  } else if (result.outcome === 'defeat') {
    effects.push(
      counter('duelsLost'),
      heat(champion ? 16 : 8, 'major_defeat'),
      res('stability', champion ? -2 : -1),
      mem('mara', `SAW_THE_SOVEREIGN_FALL_AT_${beat.toUpperCase()}`, `I pulled the Sovereign out of the snow at ${place}.`, champion ? 5 : 3, -0.2),
    );
    if (!champion) effects.push(chron(`${foe} Bested the Sovereign`, `At ${place}, ${foe} put the Sovereign in the snow. The Chronicle records it; the march went on.`, 'duel'));
  } else {
    effects.push(counter('retreats'), heat(6, 'retreat'), rel('mara', { respect: -1 }));
  }
  if (beat === 'champion' || beat === 'skirmish') {
    const dead = casualtiesFor(result, fortified);
    if (dead) effects.push(region({ casualties: dead }));
  }
  return effects.filter((e) => !(e.type === 'resource' && e.delta === 0));
}

/** Retreat between duels is allowed and recorded (Cycle doc §7). */
export function canRetreat(exp) {
  if (!exp || exp.pendingDuel) return false;
  const beat = currentBeatId(exp);
  return exp.kind === 'march' && beat !== 'camp' && exp.phase === 'main';
}

export function retreatEffects(state, exp) {
  const beat = currentBeatId(exp);
  return [
    counter('retreats'),
    flag(`march_retreated_${state.cycle.number}`, true),
    rel('mara', { respect: -2 }),
    chron('The Sovereign Turned Back', `The Sovereign turned the march around at ${BEAT_NAMES[beat] ?? 'the road'}. The Chronicle records the retreat; the champions will hear of it.`, 'duel'),
  ];
}

export { casualtiesFor };
