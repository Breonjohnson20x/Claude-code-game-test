// Words for the dossier. Raw numbers stay hidden (Master Build §16); only tiers, phrases and labels.

export const STATUS_WORD = {
  active: 'In service',
  met: 'Known to the Crown',
  retired: 'Retired',
  dead: 'Dead',
  killed: 'Killed',
  captured: 'Held captive',
  released: 'Sent home',
  recruited: 'Sworn to Elvia',
  departed: 'Gone from court',
};

export function statusWord(ch) {
  if (ch.status === 'active' && ch.companion) return 'At your side';
  return STATUS_WORD[ch.status] ?? 'Known to the Crown';
}

export function isDead(ch) {
  return ch.status === 'dead' || ch.status === 'killed';
}

/** Chip class per relationship tier (warm tiers gold/ember, cold tiers crimson, the middle plain). */
export function tierChip(tier) {
  switch (tier) {
    case 'Close':
    case 'Trusted':
      return 'chip chip--gold';
    case 'Fond':
    case 'Respected':
      return 'chip chip--ember';
    case 'Hostile':
    case 'Wary':
      return 'chip chip--crimson';
    case 'Cautious':
      return 'chip chip--iron';
    default:
      return 'chip';
  }
}

export function joinAnd(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export function sentimentOf(memory) {
  const s = Number(memory.sentiment) || 0;
  if (s > 0.15) return 'warm';
  if (s < -0.15) return 'cold';
  return 'mixed';
}

export const THREAD_STATUS_WORD = { active: 'Unfolding', dormant: 'Quiet', resolved: 'Resolved' };

export function urgencyWord(u) {
  if (u >= 70) return 'Pressing';
  if (u >= 40) return 'Rising';
  if (u >= 15) return 'Simmering';
  return 'Faint';
}

export const REGION_STATE_WORD = { STABLE: 'Stable', FORTIFIED: 'Fortified', AFTERMATH: 'Aftermath' };

export function attitudeTone(word) {
  if (word === 'Allied' || word === 'Warm') return 'chip chip--gold';
  if (word === 'Guarded') return 'chip chip--iron';
  return 'chip chip--crimson';
}

export function tensionTone(t) {
  if (t >= 60) return 'crimson';
  if (t >= 35) return 'ember';
  return 'gold';
}
