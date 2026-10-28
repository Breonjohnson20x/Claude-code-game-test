// The training yard (title screen → Training yard): short drills that each teach one read of the
// telegraph, and sparring bouts against every foe. Nothing here touches a reign: these duels
// change no GameState, cost nothing and are never recorded in the Chronicle.
//
// A drill is a scripted foe (the same move cycle every time) plus a goal the engine counts
// (`drill: { stat, target }`, see DRILL_STATS in engine.js); the duel ends in victory the moment
// the goal is met. Drill stakes give the foe deep strength so the goal, not a kill, ends it.

import { ARCHETYPES } from './archetypes.js';

// The yard's sparring partners (the same two the War Room's trial uses). Mara coaches.
export const YARD_FOES = {
  ilvane: { name: 'Sword-Master Ilvane', epithet: 'Who trained under the Iron Academies, and left' },
  greymane: { name: 'Greymane', epithet: 'An old alpha from the royal menagerie' },
};

export const DRILLS = [
  {
    id: 'steel',
    title: 'Steel light',
    telegraph: 'steel',
    answer: 'Parry or dodge',
    instruction: 'A steel glow is an ordinary blow. Hold guard as it lands to parry it, or dodge away from the side it comes from.',
    tip: 'Press guard just before the blow lands for a perfect parry: it breaks poise faster and charges your Arc.',
    goalLabel: 'Turn aside 6 blows',
    hudLabel: 'Blows turned aside',
    archetypeId: 'blade_adept',
    foe: 'ilvane',
    opening: 'Steel light is honest. Meet it with your guard, or step away from it.',
    script: [
      { move: 'slash', dir: 'left' },
      { move: 'slash', dir: 'right' },
      { move: 'slash', dir: 'overhead' },
      { move: 'flurry' },
    ],
    goal: { stat: 'turned_aside', target: 6 },
  },
  {
    id: 'red_gold',
    title: 'Red-gold glow',
    telegraph: 'red_gold',
    answer: 'Dodge, never parry',
    instruction: 'A red-gold glow is a heavy blow. A guard cannot hold it. Dodge away from the side it comes from; overhead and straight blows can be dodged either way.',
    tip: 'Dodge late, as the glow peaks. Then strike while it recovers.',
    goalLabel: 'Dodge 4 heavy blows',
    hudLabel: 'Heavies dodged',
    archetypeId: 'warg_alpha',
    foe: 'greymane',
    opening: 'Red-gold means move. If I see that guard come up, we start again.',
    script: [
      { move: 'rend', dir: 'left' },
      { move: 'rend', dir: 'right' },
      { move: 'pounce', dir: 'overhead' },
      { move: 'maul' },
    ],
    goal: { stat: 'dodges', target: 4 },
  },
  {
    id: 'flicker',
    title: 'The flicker',
    telegraph: 'flicker',
    answer: 'Wait, then punish',
    instruction: 'A flickering glow is a feint. Do nothing: no guard, no dodge. The feint breaks and leaves an opening. Strike it, then answer the real blow that follows.',
    tip: 'Flinching at a feint costs stamina and knocks your guard open. Keep still.',
    goalLabel: 'Read 3 feints and strike each opening',
    hudLabel: 'Openings struck',
    archetypeId: 'blade_adept',
    foe: 'ilvane',
    opening: 'Ilvane lies with the shoulders. Watch the glow, not the blade. If it flickers, stand still.',
    script: [
      { move: 'feint', dir: 'left' },
      { move: 'slash', dir: 'right' },
      { move: 'feint', dir: 'overhead' },
      { move: 'feint', dir: 'right' },
      { move: 'slash', dir: 'left' },
    ],
    goal: { stat: 'feints_punished', target: 3 },
  },
  {
    id: 'poise',
    title: 'Break the guard',
    telegraph: 'steel',
    answer: 'Parry, then punish',
    instruction: 'Every parry and every clean strike wears down the poise bar under the foe’s strength. Empty it and they stagger, wide open.',
    tip: 'Strike the side the foe is not guarding, and strike during the recovery after its blow.',
    goalLabel: 'Stagger the foe once',
    hudLabel: 'Staggers',
    archetypeId: 'blade_adept',
    foe: 'ilvane',
    opening: 'Wear the guard down. When it breaks, so does the fight.',
    script: [{ move: 'slash' }, { move: 'flurry' }, { move: 'slash' }, { move: 'lunge', dir: 'thrust' }],
    goal: { stat: 'poise_breaks', target: 1 },
  },
];

export const DRILL_IDS = DRILLS.map((d) => d.id);

/** Duel config for a drill. `seed` varies the stance and lines; the move cycle is fixed. */
export function drillConfig(drillId, seed = 1) {
  const drill = DRILLS.find((d) => d.id === drillId);
  if (!drill) return null;
  const foe = YARD_FOES[drill.foe];
  return {
    archetypeId: drill.archetypeId,
    seed,
    title: foe.name,
    subtitle: foe.epithet,
    modifiers: { stakes: 'drill', champion: { name: foe.name, epithet: foe.epithet } },
    opening: { speaker: 'mara', text: drill.opening },
    script: drill.script,
    drill: drill.goal,
    allowRetreat: true,
  };
}

// Sparring: the real foes at practice stakes. The Fallen Champion can be set to any of the
// styles it mirrors from a Legacy.
export const SPARRING = [
  { id: 'blade_adept', archetypeId: 'blade_adept' },
  { id: 'warg_alpha', archetypeId: 'warg_alpha' },
  { id: 'fallen_champion', archetypeId: 'fallen_champion', styles: ['aegis_mastery', 'warg_truce', 'oathbreakers_shadow'] },
].map((s) => ({ ...s, name: ARCHETYPES[s.archetypeId].name, check: ARCHETYPES[s.archetypeId].check, lesson: ARCHETYPES[s.archetypeId].lesson }));

export function sparringConfig(archetypeId, seed = 1, { mirror = null } = {}) {
  const spar = SPARRING.find((s) => s.archetypeId === archetypeId);
  if (!spar) return null;
  return {
    archetypeId,
    seed,
    modifiers: { stakes: 'practice', champion: mirror && spar.styles?.includes(mirror) ? { mirror } : null },
    allowRetreat: true,
  };
}
