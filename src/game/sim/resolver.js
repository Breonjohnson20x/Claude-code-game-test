// TurnResolver — deterministic pipeline (Master Build §20). Order matters.
//   PLAYER ORDER → VALIDATE → CALCULATE COST → UPDATE ECONOMY → UPDATE MILITARY →
//   UPDATE DIPLOMACY → UPDATE INTELLIGENCE → UPDATE CHARACTERS → UPDATE FACTIONS →
//   ADVANCE WORLD THREADS → DETERMINE EVENTS → UPDATE NARRATIVE INTENSITY →
//   UPDATE CHRONICLE → SAVE → PRESENT RESULT
// The UI never mutates state; it hands an order here and renders the report.

import { validateEffects, applyEffects } from '../core/effects.js';
import { makeRng } from '../core/rng.js';
import { relationshipLabel, attitudeLabel, tensionLabel } from '../core/relationships.js';
import { RESOURCE_KEYS, seasonLabel, PHASES } from '../core/state.js';
import { passiveThreadEffects, threadsTouchedBy } from './threads.js';
import { stabilizationEffects } from './intensity.js';

export const PIPELINE = [
  'VALIDATE',
  'CALCULATE_COST',
  'UPDATE_ECONOMY',
  'UPDATE_MILITARY',
  'UPDATE_DIPLOMACY',
  'UPDATE_INTELLIGENCE',
  'UPDATE_CHARACTERS',
  'UPDATE_FACTIONS',
  'ADVANCE_WORLD_THREADS',
  'DETERMINE_EVENTS',
  'UPDATE_NARRATIVE_INTENSITY',
  'UPDATE_CHRONICLE',
  'SAVE',
  'PRESENT_RESULT',
];

export function phaseOfEffect(e) {
  switch (e.type) {
    case 'resource':
      if (e.key === 'intel') return 'UPDATE_INTELLIGENCE';
      if (e.key === 'manpower' || e.key === 'readiness') return 'UPDATE_MILITARY';
      return 'UPDATE_ECONOMY';
    case 'region':
      return 'UPDATE_MILITARY';
    case 'faction':
      return e.attitude === undefined && !e.memory ? 'UPDATE_FACTIONS' : 'UPDATE_DIPLOMACY';
    case 'relationship':
    case 'memory':
    case 'character':
    case 'counter':
      return 'UPDATE_CHARACTERS';
    case 'flag':
      return e.key.startsWith('intel_') ? 'UPDATE_INTELLIGENCE' : 'ADVANCE_WORLD_THREADS';
    case 'thread':
      return 'ADVANCE_WORLD_THREADS';
    case 'intensity':
      return 'UPDATE_NARRATIVE_INTENSITY';
    case 'chronicle':
    case 'voice':
      return 'UPDATE_CHRONICLE';
    default:
      return 'UPDATE_CHRONICLE';
  }
}

const NUMERIC_FIELDS = {
  resource: ['delta'],
  faction: ['attitude', 'tension'],
  relationship: ['trust', 'respect', 'affection', 'resentment', 'fear'],
  thread: ['urgency'],
  region: ['casualties', 'damage'],
  intensity: ['delta'],
};

// Scale the magnitude of numeric effects (custom orders, underfunding). Structural
// effects (flags, region state, chronicle) survive only when weight is substantial.
export function scaleEffects(effects, weight) {
  const out = [];
  for (const e of effects) {
    const fields = NUMERIC_FIELDS[e.type];
    if (fields) {
      const scaled = { ...e };
      for (const f of fields) if (typeof e[f] === 'number') scaled[f] = Math.round(e[f] * weight);
      if (e.type === 'faction' && e.memory) {
        scaled.memory = Object.fromEntries(Object.entries(e.memory).map(([k, v]) => [k, Math.round(v * weight)]));
      }
      if (e.type === 'region' && e.state && weight < 0.5) delete scaled.state;
      const hasValue =
        fields.some((f) => typeof scaled[f] === 'number' && scaled[f] !== 0) ||
        (scaled.memory && Object.values(scaled.memory).some((v) => v !== 0)) ||
        scaled.state;
      if (hasValue) out.push(scaled);
    } else if (weight >= 0.5) {
      out.push(e);
    }
  }
  return out;
}

function passiveEconomy(state) {
  const r = state.resources;
  const income = Math.max(60, 180 + Math.round(r.stability * 3) - Math.round(r.unrest * 2));
  const levy = Math.max(40, 90 + Math.round(r.stability * 1.2));
  const effects = [
    { type: 'resource', key: 'treasury', delta: income },
    { type: 'resource', key: 'manpower', delta: levy },
  ];
  if (r.stability < 40) effects.push({ type: 'resource', key: 'unrest', delta: 3 });
  if (r.stability > 70) effects.push({ type: 'resource', key: 'unrest', delta: -2 });
  if (r.unrest > 60) effects.push({ type: 'resource', key: 'stability', delta: -2 });
  return { effects, notes: [`Crown revenue +${income}`, `Levies +${levy}`] };
}

function passiveMilitary(state) {
  const effects = [];
  const notes = [];
  if (state.resources.treasury < 300) {
    effects.push({ type: 'resource', key: 'readiness', delta: -3 });
    notes.push('Garrisons went unpaid');
  }
  const oathTurns = state.flags.legacy_maras_oath_turns ?? 0;
  if (oathTurns > 0) {
    effects.push({ type: 'resource', key: 'readiness', delta: 1 }); // Cycle doc §3: camp readiness +1
    effects.push({ type: 'flag', key: 'legacy_maras_oath_turns', value: oathTurns - 1 });
    notes.push("Mara's Oath: camp readiness holds");
  }
  return { effects, notes };
}

function passiveFactions(state, effects) {
  const touchedFactions = new Set(effects.filter((e) => e.type === 'faction').map((e) => e.faction));
  const out = [];
  if (!touchedFactions.has('iron_syndicate') && state.threads.IRON_SYNDICATE_BORDER_CRISIS.status === 'active') {
    out.push({ type: 'faction', faction: 'iron_syndicate', tension: 4 });
  }
  if (!touchedFactions.has('frost_wargs') && state.threads.FROST_WARG_MIGRATION.status === 'active') {
    out.push({ type: 'faction', faction: 'frost_wargs', tension: 3 });
  }
  return out;
}

// Threshold events: the world reacts even when the player looks elsewhere.
function thresholdEvents(state) {
  const events = [];
  const effects = [];
  const c = state.cycle.number;
  const r = state.resources;
  const syn = state.factions.iron_syndicate;
  if (r.unrest >= 65 && !state.flags[`event_riots_${c}`]) {
    events.push({
      title: 'Bread riots in the Crownlands',
      text: 'Crowds overturn grain carts in Harrowmere. The City Watch holds, barely. Someone painted "WHO IS THE CROWN FOR?" across the granary doors.',
    });
    effects.push(
      { type: 'resource', key: 'stability', delta: -6 },
      { type: 'flag', key: `event_riots_${c}`, value: true },
      { type: 'intensity', delta: 10, reason: 'riots' },
      { type: 'chronicle', title: 'Bread Riots in Harrowmere', text: 'Unrest boiled over in the Crownlands. The granary doors asked the Crown who it was for.', kind: 'event' },
    );
  }
  if (syn.tension >= 90 && !state.flags[`event_border_incident_${c}`]) {
    events.push({
      title: 'Border incident at Greywater',
      text: 'A Syndicate walker and an Elvian patrol exchange fire at Greywater Ford. Both sides claim the other fired first. Both sides are burying soldiers.',
    });
    effects.push(
      { type: 'resource', key: 'readiness', delta: -4 },
      { type: 'region', region: 'southern_marches', casualties: 3, damage: 8 },
      { type: 'flag', key: `event_border_incident_${c}`, value: true },
      { type: 'intensity', delta: 14, reason: 'border incident' },
      { type: 'chronicle', title: 'Shots at Greywater Ford', text: 'An Elvian patrol and a Syndicate walker exchanged fire. Three Elvian soldiers did not come home.', kind: 'event' },
    );
  }
  if (r.treasury < 150 && !state.flags[`event_bankrupt_${c}_${state.turn}`]) {
    events.push({ title: 'The treasury runs dry', text: 'Royal paymasters issue promissory notes instead of coin. The army notices first.' });
    effects.push(
      { type: 'resource', key: 'stability', delta: -3 },
      { type: 'resource', key: 'readiness', delta: -3 },
      { type: 'flag', key: `event_bankrupt_${c}_${state.turn}`, value: true },
    );
  }
  return { events, effects };
}

function applyPhase(state, effects, phaseName, log, rejectedSink) {
  const scoped = effects.filter((e) => phaseOfEffect(e) === phaseName);
  if (!scoped.length) return state;
  const report = validateEffects(scoped, state);
  rejectedSink.push(...report.rejected);
  log.push(`${phaseName}: ${report.valid.length} change(s)`);
  return applyEffects(state, report.valid);
}

function snapshot(state) {
  return {
    resources: { ...state.resources },
    rel: Object.fromEntries(Object.entries(state.characters).map(([id, c]) => [id, relationshipLabel(c.rel)])),
    factions: Object.fromEntries(
      Object.entries(state.factions).map(([id, f]) => [id, { attitude: attitudeLabel(f.attitude), tension: tensionLabel(f.tension) }]),
    ),
    memories: state.memories.length,
    chronicle: state.chronicle.length,
    region: state.regions.southern_marches.state,
  };
}

/**
 * Resolve one strategic turn.
 * @param {object} state GameState in phase war_room
 * @param {object} order resolved order from content (id, label, category, cost, effects, outcome, voices, roll?)
 * @param {{ custom?: { text: string, interpretation: object } }} [options]
 * @returns {{ state: object, report: object }}
 */
export function resolveTurn(state, order, options = {}) {
  if (state.phase !== PHASES.WAR_ROOM) throw new Error(`resolveTurn called in phase ${state.phase}`);
  if (!order || !Array.isArray(order.effects)) throw new Error('resolveTurn needs a resolved order');
  if (order.locked) throw new Error(`Order ${order.id} is locked: ${order.locked}`);

  const log = [];
  const rejected = [];
  const before = snapshot(state);
  const rng = makeRng(state.rngSeed);
  let s = state;

  // VALIDATE — gather order effects (+ any seeded roll) and screen them.
  let effects = [...order.effects];
  let outcome = [...(order.outcome ?? [])];
  if (typeof order.roll === 'function') {
    const rolled = order.roll(rng, state) ?? {};
    effects.push(...(rolled.effects ?? []));
    outcome.push(...(rolled.outcome ?? []));
  }
  const screened = validateEffects(effects, state);
  rejected.push(...screened.rejected);
  effects = screened.valid;
  log.push(`VALIDATE: ${effects.length} effect(s) accepted, ${screened.rejected.length} rejected`);

  // CALCULATE COST — underfunded orders still happen, at reduced effect.
  const cost = { treasury: order.cost?.treasury ?? 0, manpower: order.cost?.manpower ?? 0 };
  const ratio = Math.min(
    1,
    cost.treasury ? s.resources.treasury / cost.treasury : 1,
    cost.manpower ? s.resources.manpower / cost.manpower : 1,
  );
  let underfunded = false;
  if (ratio < 1) {
    underfunded = true;
    effects = scaleEffects(effects, Math.max(0.4, ratio));
    outcome.push('The order went out underfunded. It did less than it promised.');
  }
  const paid = {
    treasury: Math.min(cost.treasury, s.resources.treasury),
    manpower: Math.min(cost.manpower, s.resources.manpower),
  };
  s = applyEffects(s, [
    { type: 'resource', key: 'treasury', delta: -paid.treasury },
    { type: 'resource', key: 'manpower', delta: -paid.manpower },
  ]);
  log.push(`CALCULATE_COST: −${paid.treasury} treasury, −${paid.manpower} manpower${underfunded ? ' (underfunded)' : ''}`);

  // UPDATE ECONOMY
  const econ = passiveEconomy(s);
  s = applyEffects(s, validateEffects(econ.effects, s).valid);
  log.push(...econ.notes.map((n) => `UPDATE_ECONOMY: ${n}`));
  s = applyPhase(s, effects, 'UPDATE_ECONOMY', log, rejected);

  // UPDATE MILITARY
  const mil = passiveMilitary(s);
  s = applyEffects(s, validateEffects(mil.effects, s).valid);
  log.push(...mil.notes.map((n) => `UPDATE_MILITARY: ${n}`));
  s = applyPhase(s, effects, 'UPDATE_MILITARY', log, rejected);

  // UPDATE DIPLOMACY / INTELLIGENCE / CHARACTERS
  s = applyPhase(s, effects, 'UPDATE_DIPLOMACY', log, rejected);
  s = applyPhase(s, effects, 'UPDATE_INTELLIGENCE', log, rejected);
  s = applyPhase(s, effects, 'UPDATE_CHARACTERS', log, rejected);

  // UPDATE FACTIONS — order tension shifts plus passive drift for ignored factions.
  s = applyPhase(s, effects, 'UPDATE_FACTIONS', log, rejected);
  const drift = passiveFactions(s, effects);
  if (drift.length) {
    s = applyEffects(s, validateEffects(drift, s).valid);
    log.push(`UPDATE_FACTIONS: ${drift.length} faction(s) grew tenser while ignored`);
  }

  // ADVANCE WORLD THREADS — only addressed threads move by order; others simmer.
  s = applyPhase(s, effects, 'ADVANCE_WORLD_THREADS', log, rejected);
  const addressed = threadsTouchedBy(effects);
  const passive = passiveThreadEffects(s, addressed);
  if (passive.effects.length) s = applyEffects(s, validateEffects(passive.effects, s).valid);
  const events = [...passive.events];

  // DETERMINE EVENTS
  const threshold = thresholdEvents(s);
  if (threshold.effects.length) s = applyEffects(s, validateEffects(threshold.effects, s).valid);
  events.push(...threshold.events);
  log.push(`DETERMINE_EVENTS: ${events.length} event(s)`);

  // UPDATE NARRATIVE INTENSITY
  s = applyPhase(s, effects, 'UPDATE_NARRATIVE_INTENSITY', log, rejected);
  const majorEvents = events.length + effects.filter((e) => e.type === 'intensity' && e.delta >= 10).length;
  const settle = stabilizationEffects(s, { majorEventsThisTurn: majorEvents });
  if (settle.length) s = applyEffects(s, settle);

  // UPDATE CHRONICLE — decision log + meaningful entries + voices of the realm.
  s = applyPhase(s, effects, 'UPDATE_CHRONICLE', log, rejected);
  const decision = {
    id: `d${s.cycle.number}-${s.turn}`,
    cycle: s.cycle.number,
    turn: s.turn,
    year: s.year,
    season: seasonLabel(s),
    crisisId: order.crisisId ?? null,
    orderId: order.id,
    category: order.category,
    label: order.label,
    custom: options.custom ? { text: options.custom.text, actions: options.custom.interpretation?.actions ?? [] } : null,
    underfunded,
  };
  s = { ...s, decisions: [...s.decisions, decision] };

  // SAVE — the controller performs IO; the resolver only requests it.
  log.push('SAVE: autosave requested (after_resolution)');

  // PRESENT RESULT
  const after = snapshot(s);
  const resourceDeltas = Object.fromEntries(
    RESOURCE_KEYS.map((k) => [k, after.resources[k] - before.resources[k]]).filter(([, d]) => d !== 0),
  );
  const relationshipShifts = Object.keys(after.rel)
    .filter((id) => after.rel[id] !== before.rel[id] && s.characters[id].status !== 'unmet')
    .map((id) => ({ character: id, from: before.rel[id], to: after.rel[id] }));
  const factionShifts = Object.keys(after.factions)
    .filter((id) => JSON.stringify(after.factions[id]) !== JSON.stringify(before.factions[id]))
    .map((id) => ({ faction: id, from: before.factions[id], to: after.factions[id] }));

  const report = {
    cycle: s.cycle.number,
    turn: s.turn,
    season: seasonLabel(s),
    orderId: order.id,
    orderLabel: order.label,
    category: order.category,
    custom: decision.custom,
    underfunded,
    outcome,
    voices: order.voices ?? [],
    events,
    resourceDeltas,
    relationshipShifts,
    factionShifts,
    regionBefore: before.region,
    regionAfter: after.region,
    newMemories: s.memories.slice(before.memories),
    newChronicle: s.chronicle.slice(before.chronicle),
    pipeline: log,
    rejected: rejected.map((r) => r.reason),
    autosave: 'after_resolution',
  };
  log.push('PRESENT_RESULT: report built');

  s = { ...s, rngSeed: rng.seed, phase: PHASES.RESOLUTION, lastResolution: report };
  return { state: s, report };
}
