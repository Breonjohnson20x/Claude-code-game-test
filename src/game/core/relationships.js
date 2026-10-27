// Relationship + civilization-memory presentation (Master Build §16, Cycle doc §4).
// Raw numbers stay hidden from the player; these functions turn them into words.

export const TIERS = ['Hostile', 'Wary', 'Cautious', 'Cordial', 'Respected', 'Fond', 'Trusted', 'Close'];

export function relationshipLabel(rel) {
  const { trust, respect, affection, resentment, fear } = rel;
  if (resentment >= 55 && resentment > trust) return 'Hostile';
  if (trust >= 60 && affection >= 40) return 'Close';
  if (trust >= 55) return 'Trusted';
  if (affection >= 40) return 'Fond';
  if (respect >= 45) return 'Respected';
  if (fear >= 50) return 'Wary';
  if (trust < -20 || resentment >= 30) return 'Wary';
  if (trust >= 20 || affection >= 20 || respect >= 30) return 'Cordial';
  return 'Cautious';
}

export function tierIndex(label) {
  return TIERS.indexOf(label);
}

export function atLeast(rel, label) {
  return tierIndex(relationshipLabel(rel)) >= tierIndex(label);
}

// Human-readable hints for the dossier — direction only, never numbers.
export function relationshipNotes(rel) {
  const notes = [];
  if (rel.trust >= 40) notes.push('relies on your word');
  else if (rel.trust <= -15) notes.push('doubts your word');
  if (rel.respect >= 40) notes.push('respects your judgment');
  if (rel.affection >= 35) notes.push('genuinely likes you');
  if (rel.resentment >= 25) notes.push('carries a grievance');
  if (rel.fear >= 30) notes.push('is afraid of you');
  return notes;
}

export const CIV_LABELS = {
  liberator: { label: 'Liberator', gloss: 'you freed people and left' },
  conqueror: { label: 'Conqueror', gloss: 'you took and stayed' },
  oathbreaker: { label: 'Oathbreaker', gloss: 'you swore and broke' },
  peacemaker: { label: 'Peacemaker', gloss: 'you ended wars by deal' },
};

// A faction's standing view of Elvia. Different factions can hold different labels.
export function civilizationLabel(memory) {
  const entries = Object.entries(memory).sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  if (topVal < 10) return { key: null, label: 'Unwritten', gloss: 'they have not decided what you are' };
  return { key: topKey, ...CIV_LABELS[topKey] };
}

export function attitudeLabel(attitude) {
  if (attitude >= 50) return 'Allied';
  if (attitude >= 20) return 'Warm';
  if (attitude >= -10) return 'Guarded';
  if (attitude >= -45) return 'Hostile';
  return 'Implacable';
}

export function tensionLabel(tension) {
  if (tension >= 80) return 'War footing';
  if (tension >= 60) return 'Escalating';
  if (tension >= 35) return 'Uneasy';
  return 'Calm';
}
