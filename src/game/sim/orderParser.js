// Custom Order System (Master Build §18): "The player is never restricted to A–E."
// Rule-based parser + keyword mapping + deterministic fallback. Works with no AI.
// An optional AI interpretation (src/game/ai) produces the same `actions` shape,
// and is converted into an order by the same buildCustomOrder() below.

import { scaleEffects } from './resolver.js';

export const CATEGORIES = ['diplomacy', 'military', 'clandestine', 'research', 'economic'];

const KEYWORDS = {
  diplomacy: [
    'envoy', 'negotiat', 'talk', 'treaty', 'accord', 'peace', 'diplomat', 'terms', 'chancellor', 'vex',
    'embassy', 'sign', 'apolog', 'parley', 'ambassador', 'letter', 'summit', 'truce', 'compromise', 'alliance',
  ],
  military: [
    'reinforce', 'army', 'troop', 'soldier', 'garrison', 'attack', 'strike', 'defend', 'fortif', 'wall',
    'barricade', 'mara', 'march', 'hunt', 'fight', 'kill', 'legion', 'deploy', 'cavalry', 'patrol', 'guard', 'siege', 'drive them',
  ],
  clandestine: [
    'spy', 'spies', 'agent', 'secret', 'covert', 'cassian', 'sabotage', 'infiltrat', 'assassin', 'steal',
    'leak', 'expose', 'blackmail', 'intel', 'scout', 'shadow', 'informant', 'bribe', 'disguise', 'watch them',
  ],
  research: [
    'vale', 'research', 'study', 'ward', 'aegis', 'magic', 'lattice', 'scien', 'experiment', 'lights',
    'investigat', 'arcane', 'magitech', 'prototype', 'engineer', 'academy', 'symbol', 'shield',
  ],
  economic: [
    'refugee', 'camp', 'road', 'build', 'grain', 'food', 'feed', 'trade', 'tax', 'gold', 'infrastructure',
    'supply', 'open the', 'gate', 'shelter', 'work', 'market', 'bread', 'house', 'invest', 'fund', 'rebuild',
  ],
};

const COVERT_WORDS = ['secret', 'covert', 'quiet', 'hidden', 'without them knowing', 'discreet', 'undercover', 'in the dark'];

const TARGETS = {
  iron_syndicate: ['syndicate', 'vex', 'walker', 'depot', 'border', 'south', 'drae', 'iron', 'ford', 'greywater', 'nyra'],
  frost_wargs: ['warg', 'wolf', 'wolves', 'north', 'ice', 'pack', 'skaela', 'blizzard'],
  refugees: ['refugee', 'famil', 'mika', 'camp', 'northern road', 'children', 'villag'],
  mystery: ['light', 'symbol', 'ruin', 'circle', 'lattice', 'architect'],
};

function scoreText(text, words) {
  let score = 0;
  for (const w of words) {
    if (text.includes(w)) score += w.length >= 6 ? 2 : 1;
  }
  return score;
}

/**
 * Parse free text into structured actions.
 * @returns {{ actions: Array<{category:string, target:string|null, covert:boolean, weight:number}>,
 *             summary: string, confidence: number, understood: boolean }}
 */
export function parseOrder(rawText) {
  const text = ` ${String(rawText ?? '').toLowerCase().replace(/\s+/g, ' ').trim()} `;
  if (text.trim().length < 3) {
    return { actions: [], summary: 'The Council waits for a clearer decree.', confidence: 0, understood: false };
  }
  // Split on conjunctions so "reinforce the border but secretly send agents" yields two clauses.
  const clauses = text.split(/\b(?:but|and then|then|while|and also|also|;|,| and )\b/).filter((c) => c.trim().length > 2);
  const covertGlobal = COVERT_WORDS.some((w) => text.includes(w));

  const found = new Map();
  for (const clause of clauses) {
    let best = null;
    for (const cat of CATEGORIES) {
      const sc = scoreText(clause, KEYWORDS[cat]);
      if (sc > 0 && (!best || sc > best.score)) best = { cat, score: sc };
    }
    if (!best) continue;
    let target = null;
    let targetScore = 0;
    for (const [t, words] of Object.entries(TARGETS)) {
      const sc = scoreText(clause, words);
      if (sc > targetScore) {
        target = t;
        targetScore = sc;
      }
    }
    const covert = COVERT_WORDS.some((w) => clause.includes(w));
    const prev = found.get(best.cat);
    if (!prev || best.score > prev.score) found.set(best.cat, { category: best.cat, target, covert, score: best.score });
  }

  let actions = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 3);
  if (!actions.length) {
    return {
      actions: [],
      summary: 'The Council could not turn those words into orders. Name who should act, and toward what.',
      confidence: 0,
      understood: false,
    };
  }
  // Splitting focus costs efficiency: two actions run at 60% each, three at 45%.
  const weight = actions.length === 1 ? 1 : actions.length === 2 ? 0.6 : 0.45;
  actions = actions.map(({ category, target, covert }) => ({ category, target, covert: covert || (covertGlobal && category === 'clandestine'), weight }));
  const summary = actions
    .map((a) => `${a.covert ? 'covert ' : ''}${a.category}${a.target ? ` toward ${a.target.replace('_', ' ')}` : ''}`)
    .join(' + ');
  const confidence = Math.min(1, [...found.values()].reduce((sum, a) => sum + a.score, 0) / 4);
  return { actions, summary: `Interpreted as: ${summary}.`, confidence, understood: true };
}

/**
 * Turn an interpretation into a resolvable order by blending the current crisis's
 * category orders at the action weights. Deterministic and fully simulation-owned.
 */
export function buildCustomOrder(crisis, interpretation, text) {
  const byCategory = Object.fromEntries(crisis.orders.filter((o) => !o.locked).map((o) => [o.category, o]));
  const effects = [];
  const outcome = [];
  const voices = [];
  const cost = { treasury: 0, manpower: 0 };
  const used = [];
  for (const action of interpretation.actions) {
    const base = byCategory[action.category];
    if (!base) continue;
    used.push(base.id);
    effects.push(...scaleEffects(base.effects, action.weight));
    cost.treasury += Math.round((base.cost?.treasury ?? 0) * action.weight);
    cost.manpower += Math.round((base.cost?.manpower ?? 0) * action.weight);
    if (base.outcome?.[0]) outcome.push(base.outcome[0]);
    if (base.voices?.[0]) voices.push(base.voices[0]);
    if (action.covert && action.category !== 'clandestine') {
      effects.push({ type: 'relationship', character: 'cassian', trust: 2 });
    }
  }
  const short = String(text).trim().replace(/\s+/g, ' ');
  const title = short.length > 48 ? `${short.slice(0, 47)}…` : short;
  if (!used.length) {
    return { locked: 'No part of that decree applies to this crisis.', effects: [], id: 'X' };
  }
  effects.push({
    type: 'chronicle',
    title: `Royal Decree: ${title}`,
    text: `The Sovereign set aside the Council's options and decreed it personally: "${short.slice(0, 200)}"`,
    kind: 'decision',
    tags: ['custom'],
  });
  return {
    id: 'X',
    crisisId: crisis.id,
    category: interpretation.actions.map((a) => a.category).join('+'),
    label: 'Custom Order',
    text: short,
    cost,
    effects,
    outcome: outcome.length ? outcome : ['The decree goes out exactly as spoken.'],
    voices,
    blendedFrom: used,
  };
}
