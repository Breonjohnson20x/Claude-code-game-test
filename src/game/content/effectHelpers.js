// Tiny constructors so authored content reads like prose, not JSON.

export const res = (key, delta) => ({ type: 'resource', key, delta });
export const rel = (character, deltas) => ({ type: 'relationship', character, ...deltas });
export const fac = (faction, deltas) => ({ type: 'faction', faction, ...deltas });
export const flag = (key, value = true) => ({ type: 'flag', key, value });
export const counter = (key, delta = 1) => ({ type: 'counter', key, delta });
export const thread = (id, changes) => ({ type: 'thread', thread: id, ...changes });
export const region = (changes) => ({ type: 'region', region: 'southern_marches', ...changes });
export const heat = (delta, reason) => ({ type: 'intensity', delta, reason });
export const chron = (title, text, kind = 'decision', tags = []) => ({ type: 'chronicle', title, text, kind, tags });
export const voice = (speaker, text) => ({ type: 'voice', speaker, text });
export const character = (id, changes) => ({ type: 'character', character: id, ...changes });
export const mem = (characterId, eventId, description, emotionalWeight = 4, sentiment = 0, extra = {}) => ({
  type: 'memory',
  character: characterId,
  eventId,
  description,
  emotionalWeight,
  sentiment,
  ...extra,
});

export const SYN = 'iron_syndicate';
export const WARGS = 'frost_wargs';
export const T_SYN = 'IRON_SYNDICATE_BORDER_CRISIS';
export const T_WARGS = 'FROST_WARG_MIGRATION';
export const T_REFUGEES = 'NORTHERN_REFUGEES';
export const T_MYSTERY = 'FIRST_ARCHITECTS_MYSTERY';

export function hasLegacy(state, id) {
  return state.cycle.activeLegacies.includes(id);
}
