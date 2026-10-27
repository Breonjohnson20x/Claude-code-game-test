// The Campfire (Master Build §23–25, World Bible "Campfire Scenes").
// Offered only when NarrativeIntensity is high, a major beat has resolved, there is
// no immediate danger, and the cooldown has expired. The player may Enter, take a
// Short moment, or Skip — and skipping never punishes them (§25).

import { rel, mem, heat, chron, counter, res, thread, hasLegacy, T_MYSTERY } from './effectHelpers.js';
import { campfireEligibility, CAMPFIRE_COOLDOWN_TURNS } from '../sim/intensity.js';
import { atLeast } from '../core/relationships.js';

export const CAMPFIRE_MODES = ['enter', 'short', 'skip'];

// Which companion carries tonight's scene. Mara leads unless something weighs on someone else more.
function sceneSpeaker(state) {
  const f = state.flags;
  const mara = state.characters.mara;
  if (f.nyra_fate === 'killed' || mara.rel.resentment >= 15) return 'mara_hard';
  if (state.counters.duelsLost > 0 && state.counters.duelsWon === 0) return 'mara_defeat';
  if (f.architect_studied) return 'mara_symbol';
  if (f.mika_family === 'helped') return 'mara_mika';
  return 'mara_father';
}

const SCENES = {
  mara_father: {
    topic: 'Her father',
    opener: [
      'Mara sits on an upturned supply crate, cleaning a blade that is already clean.',
      '"My father held a wall like this one," she says, without looking up. "Brennick. I was eleven. He told me the wall would hold. It did. He didn\'t."',
    ],
    question: '"Do you ever think about how many of them have to die so you can be right?"',
  },
  mara_mika: {
    topic: 'The girl at the checkpoint',
    opener: [
      'Mara sits on an upturned supply crate, cleaning a blade that is already clean.',
      '"That girl at Greywater," she says. "Mika. She looked at you the way I looked at the captain who carried me out of Brennick."',
    ],
    question: '"You know you can\'t do that for all of them. So why that one?"',
  },
  mara_symbol: {
    topic: 'The ruin',
    opener: [
      'Mara sits close to the fire, closer than she needs to.',
      '"At the ruin," she says. "You stopped. Just stood there with your hand on that stone. I\'ve seen men do that after a shell lands close. You looked like that, except you were smiling."',
    ],
    question: '"What did you see?"',
  },
  mara_defeat: {
    topic: 'The duel you lost',
    opener: [
      'Mara hands you a cup of something that is mostly smoke.',
      '"You went down in front of the whole army," she says. "They\'re not talking about that. They\'re talking about how you got up."',
    ],
    question: '"Are you going to tell me what you saw before the blade came in, or do I have to guess?"',
  },
  mara_hard: {
    topic: 'What you did at the ford',
    opener: [
      'Mara sits on the far side of the fire, and does not offer you the crate.',
      '"I have served three kings," she says. "I have never had to explain an execution to a nineteen-year-old private before tonight."',
    ],
    question: '"Tell me it was worth it. Make me believe it."',
  },
};

const TONE_PHRASE = {
  honest: 'honestly',
  deflect: 'by changing the subject',
  joke: 'with a joke',
  comfort: 'with comfort',
  command: 'with an order',
  ask: 'by asking her counsel',
  lattice: 'by telling her about the threads',
};

// Six authored responses (World Bible: honest, deflect, joke, comfort, command, ask),
// plus a Lattice option the Architect's Mark unlocks (Cycle doc §3).
function responses(state, sceneId) {
  const hard = sceneId === 'mara_hard';
  const list = [
    {
      id: 'honest',
      tone: 'Honest',
      label: hard ? '"No. I wanted Kessrin afraid. I was wrong to want it that way."' : '"Every night. I count them."',
      effects: [
        rel('mara', { trust: hard ? 8 : 6, affection: 4, resentment: hard ? -6 : 0 }),
        mem('mara', 'THE_SOVEREIGN_WAS_HONEST_AT_THE_FIRE', 'At the fire the Sovereign told me the truth, even when it cost them.', 6, 0.7),
      ],
      reply: hard
        ? ['Mara is quiet for a long time. "That\'s the first thing you\'ve said tonight I believe," she says. It is not forgiveness. It is the place forgiveness would start.']
        : ['"Good," Mara says. "The day you stop counting, I\'m going home." She doesn\'t say it like a threat. She says it like a promise she has made to herself.'],
    },
    {
      id: 'deflect',
      tone: 'Deflect',
      label: '"The Crown carries what it must. Let\'s talk about the spring muster."',
      effects: [rel('mara', { respect: 1, affection: -2 })],
      reply: ['"Of course, Majesty." She lays out the muster numbers. She is very good at it. She does not look at you again until the fire is low.'],
    },
    {
      id: 'joke',
      tone: 'Joke',
      label: '"Sparky has eaten our maps. I think we\'re fighting blind now."',
      effects: [rel('mara', { affection: 5 }), rel('sparky', { affection: 2 }), res('stability', 1)],
      reply: [
        'Mara laughs before she can stop herself — a short, surprised bark. Across the fire a pair of soldiers grin and pretend they weren\'t listening.',
        'Sparky, hearing his name, belches a small green flame and goes back to sleep.',
      ],
    },
    {
      id: 'comfort',
      tone: 'Comfort',
      label: hard ? '"You didn\'t fail that private. I did."' : '"Your father\'s wall held, Mara. So will this one."',
      effects: [rel('mara', { affection: 7, trust: 3, resentment: hard ? -4 : 0 }), mem('mara', 'THE_SOVEREIGN_COMFORTED_ME', 'At the fire the Sovereign spoke to me like a person, not a general.', 5, 0.8)],
      reply: ['Mara turns the blade over in her hands. "Don\'t," she says, but she says it softly, and she stays by the fire a long time after the others have gone.'],
    },
    {
      id: 'command',
      tone: 'Command',
      label: '"Enough. You have your orders, General."',
      effects: [rel('mara', { respect: 3, affection: -5, fear: 4 }), res('readiness', 2)],
      reply: ['"Majesty." She stands, salutes with perfect precision, and walks into the dark. The camp is very orderly the next morning. Nobody sings.'],
    },
    {
      id: 'ask',
      tone: 'Ask',
      label: '"What would you have done?"',
      effects: [
        rel('mara', { respect: 6, trust: 4 }),
        mem('mara', 'THE_SOVEREIGN_ASKED_MY_COUNSEL', 'At the fire the Sovereign asked what I would have done — and listened to the answer.', 5, 0.7),
      ],
      reply: [
        '"Honestly?" Mara thinks about it. "The same. Probably worse." She looks at you. "But I\'d want somebody to ask me afterward. So thank you for asking."',
      ],
    },
  ];
  if (hasLegacy(state, 'architects_mark') || state.flags.architect_studied) {
    list.push({
      id: 'lattice',
      tone: 'The Lattice',
      label: '"Everything is held together by threads, Mara. I can see them sometimes."',
      effects: [
        rel('mara', { trust: 2, fear: 3 }),
        mem('mara', 'THE_SOVEREIGN_SPOKE_OF_THREADS', 'At the fire the Sovereign told me the world is woven, and that they can see the weave.', 6, 0),
        thread(T_MYSTERY, { urgency: 5 }),
      ],
      reply: [
        'Mara is quiet for a long time. Then she pulls her coat tighter, though the fire is warm. "My grandmother said that," she says. "Right before she stopped making sense." She looks at you. "You\'re making sense. That\'s worse."',
      ],
    });
  }
  return list;
}

function sparkyBeat(state) {
  const sparky = state.characters.sparky;
  if (atLeast(sparky.rel, 'Fond') || state.counters.sparkyCare >= 2) {
    return {
      text: 'Sometime after midnight Sparky crawls into your lap, all forty pounds of him, and falls asleep with his chin on your knee. His scales are warm. His breathing is the only thing in the camp that isn\'t afraid.',
      effects: [rel('sparky', { affection: 4, trust: 2 }), counter('sparkyCare'), mem('sparky', 'WE_SAT_BY_THE_FIRE', 'The God-King let me sleep by the fire.', 4, 0.9)],
    };
  }
  if (sparky.rel.fear >= 15) {
    return {
      text: 'Sparky watches you from the edge of the firelight and will not come closer. When you hold out a hand, he looks at it for a long moment and then puts his head down.',
      effects: [rel('sparky', { fear: -3 })],
    };
  }
  return {
    text: 'Sparky steals a strip of dried meat from the cookpot, gets caught, and pretends very hard that he has always been asleep.',
    effects: [rel('sparky', { affection: 2 })],
  };
}

/** Called by the controller after a major resolution. Returns an offer or null. */
export function campfireOffer(state, { majorResolved = true, immediateDanger = false } = {}) {
  const { eligible, reasons } = campfireEligibility(state, { majorResolved, immediateDanger });
  if (!eligible) return { eligible: false, reasons };
  const sceneId = sceneSpeaker(state);
  return {
    eligible: true,
    reasons,
    sceneId,
    topic: SCENES[sceneId].topic,
    prompt: 'The army makes camp. Mara has built a fire away from the others.',
  };
}

/** The full campfire scene for the chosen mode. */
export function getCampfireScene(state, mode = 'enter') {
  const sceneId = state.campfire.offer?.sceneId ?? sceneSpeaker(state);
  const scene = SCENES[sceneId];
  const sparky = sparkyBeat(state);
  if (mode === 'short') {
    return {
      mode,
      sceneId,
      topic: scene.topic,
      lines: [scene.opener[0], 'You sit with her a while. Neither of you says much. It helps anyway.'],
      sparky,
      responses: [],
      closing: [{
        id: 'rest',
        label: 'Bank the fire',
        effects: [rel('mara', { affection: 2 }), ...sparky.effects],
      }],
    };
  }
  return {
    mode,
    sceneId,
    topic: scene.topic,
    lines: [...scene.opener],
    question: scene.question,
    sparky,
    responses: responses(state, sceneId),
  };
}

/**
 * Effects for completing the campfire. Intensity always settles; the cooldown is
 * set by the controller. Skipping applies only the settling — never a penalty.
 */
export function campfireCompletionEffects(state, mode, responseId) {
  const effects = [heat(mode === 'skip' ? -10 : mode === 'short' ? -14 : -22, 'campfire')];
  if (mode === 'skip') return effects;
  const scene = getCampfireScene(state, mode);
  if (mode === 'short') {
    effects.push(...scene.closing[0].effects);
  } else {
    const chosen = scene.responses.find((r) => r.id === responseId) ?? scene.responses[0];
    effects.push(...chosen.effects, ...scene.sparky.effects);
    effects.push(
      chron(
        `By the Fire: ${scene.topic}`,
        `At the forward camp the Sovereign sat with ${state.characters.mara.name}. They spoke of ${scene.topic.toLowerCase()}. The Sovereign answered ${TONE_PHRASE[chosen.id] ?? 'quietly'}.`,
        'campfire',
        ['mara'],
      ),
    );
  }
  return effects;
}

export function campfireCooldown() {
  return CAMPFIRE_COOLDOWN_TURNS;
}
