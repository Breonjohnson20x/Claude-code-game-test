// SimulationValidator + GameStateMutator (Master Build §19, §28).
// Every state change in the game is expressed as an Effect. Authored content,
// the turn resolver, duels and optional AI generators all produce Effects; only
// applyEffects() writes them into GameState, and only after validateEffects().
//
// Effect shapes:
//   { type:'resource', key, delta }
//   { type:'faction', faction, attitude?, tension?, memory?: { liberator?, conqueror?, oathbreaker?, peacemaker? } }
//   { type:'relationship', character, trust?, respect?, affection?, resentment?, fear? }
//   { type:'memory', character, eventId, description, emotionalWeight?, sentiment?, permanent?, tags?, kind? }
//   { type:'flag', key, value }
//   { type:'counter', key, delta }
//   { type:'thread', thread, stage?, setStage?, urgency?, status?, visibility?, flags? }
//   { type:'region', region, state?, casualties?, damage?, monument?: { id, title, text } }
//   { type:'intensity', delta, reason? }
//   { type:'chronicle', title, text, kind?, tags? }
//   { type:'character', character, status?, role?, name?, age? }
//   { type:'voice', speaker, text }
//   { type:'approval', entry, detail? }   — marks a Chronicle entry approved (Chronicler's Pen). Never rewrites it.

import {
  RESOURCE_KEYS,
  RESOURCE_BOUNDS,
  REL_KEYS,
  REL_BOUNDS,
  CIV_MEMORY_KEYS,
  REGION_STATES,
  THREAD_STATUSES,
  THREAD_VISIBILITY,
  COUNTER_KEYS,
  clamp,
} from './state.js';

export const EFFECT_TYPES = [
  'resource',
  'faction',
  'relationship',
  'memory',
  'flag',
  'counter',
  'thread',
  'region',
  'intensity',
  'chronicle',
  'character',
  'voice',
  'approval',
];

// Per-effect magnitude caps. Simulation content may be large; AI proposals are tight.
const SIM_CAPS = {
  resource: { treasury: 5000, manpower: 5000, readiness: 60, stability: 60, unrest: 60, intel: 60 },
  rel: 60,
  faction: 60,
  memory: 100,
  intensity: 60,
  counter: 5,
  thread: 5,
  urgency: 80,
  region: 2000,
};

const AI_CAPS = {
  resource: { treasury: 150, manpower: 150, readiness: 4, stability: 4, unrest: 4, intel: 4 },
  rel: 5,
  faction: 5,
  memory: 4,
  intensity: 5,
};

// AI generators may only *request* low-stakes changes. Structural state stays sim-owned.
const AI_ALLOWED_TYPES = new Set(['resource', 'relationship', 'faction', 'memory', 'intensity', 'voice']);

const CHARACTER_STATUSES = [
  'active',
  'unmet',
  'met',
  'retired',
  'dead',
  'captured',
  'released',
  'recruited',
  'killed',
  'departed',
];

const MAX_TEXT = 600;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function capDelta(value, cap, repairs, label) {
  if (Math.abs(value) <= cap) return Math.round(value);
  repairs.push(`${label} clamped from ${value} to ±${cap}`);
  return Math.round(Math.sign(value) * cap);
}

function cleanText(text, repairs, label, max = MAX_TEXT) {
  if (typeof text !== 'string') return null;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    repairs.push(`${label} truncated`);
    return `${trimmed.slice(0, max - 1)}…`;
  }
  return trimmed;
}

function validateOne(effect, state, source) {
  if (!effect || typeof effect !== 'object') return { error: 'not an object' };
  if (!EFFECT_TYPES.includes(effect.type)) return { error: `unknown effect type "${effect?.type}"` };
  if (source === 'ai' && !AI_ALLOWED_TYPES.has(effect.type)) {
    return { error: `AI generators may not request "${effect.type}" effects` };
  }
  const caps = source === 'ai' ? AI_CAPS : SIM_CAPS;
  const repairs = [];
  const out = { type: effect.type };

  switch (effect.type) {
    case 'resource': {
      if (!RESOURCE_KEYS.includes(effect.key)) return { error: `unknown resource "${effect.key}"` };
      if (!isFiniteNumber(effect.delta)) return { error: 'resource delta must be a finite number' };
      out.key = effect.key;
      out.delta = capDelta(effect.delta, caps.resource[effect.key], repairs, `resource.${effect.key}`);
      break;
    }
    case 'faction': {
      if (!state.factions[effect.faction]) return { error: `unknown faction "${effect.faction}"` };
      out.faction = effect.faction;
      let touched = false;
      for (const key of ['attitude', 'tension']) {
        if (effect[key] !== undefined) {
          if (!isFiniteNumber(effect[key])) return { error: `faction.${key} must be numeric` };
          out[key] = capDelta(effect[key], caps.faction, repairs, `faction.${key}`);
          touched = true;
        }
      }
      if (effect.memory !== undefined) {
        if (typeof effect.memory !== 'object' || effect.memory === null) return { error: 'faction.memory must be an object' };
        out.memory = {};
        for (const [k, v] of Object.entries(effect.memory)) {
          if (!CIV_MEMORY_KEYS.includes(k)) return { error: `unknown civilization memory "${k}"` };
          if (!isFiniteNumber(v)) return { error: `memory.${k} must be numeric` };
          out.memory[k] = capDelta(v, caps.faction, repairs, `memory.${k}`);
          touched = true;
        }
      }
      if (!touched) return { error: 'faction effect changes nothing' };
      break;
    }
    case 'relationship': {
      const ch = state.characters[effect.character];
      if (!ch) return { error: `unknown character "${effect.character}"` };
      out.character = effect.character;
      let touched = false;
      for (const key of REL_KEYS) {
        if (effect[key] !== undefined) {
          if (!isFiniteNumber(effect[key])) return { error: `relationship.${key} must be numeric` };
          out[key] = capDelta(effect[key], caps.rel, repairs, `relationship.${key}`);
          touched = true;
        }
      }
      if (!touched) return { error: 'relationship effect changes nothing' };
      break;
    }
    case 'memory': {
      if (!state.characters[effect.character]) return { error: `unknown character "${effect.character}"` };
      if (typeof effect.eventId !== 'string' || !/^[A-Z0-9_]{3,64}$/.test(effect.eventId)) {
        return { error: 'memory.eventId must be UPPER_SNAKE_CASE' };
      }
      const description = cleanText(effect.description, repairs, 'memory.description', 280);
      if (!description) return { error: 'memory needs a description' };
      out.character = effect.character;
      out.eventId = effect.eventId;
      out.description = description;
      const weight = isFiniteNumber(effect.emotionalWeight) ? effect.emotionalWeight : 3;
      out.emotionalWeight = Math.max(1, Math.min(source === 'ai' ? caps.memory : 10, Math.round(weight)));
      const sentiment = isFiniteNumber(effect.sentiment) ? effect.sentiment : 0;
      out.sentiment = Math.max(-1, Math.min(1, sentiment));
      out.permanent = source === 'ai' ? false : Boolean(effect.permanent);
      out.kind = typeof effect.kind === 'string' ? effect.kind : 'event';
      out.tags = Array.isArray(effect.tags) ? effect.tags.filter((t) => typeof t === 'string').slice(0, 8) : [];
      break;
    }
    case 'flag': {
      if (typeof effect.key !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(effect.key)) return { error: 'invalid flag key' };
      const v = effect.value;
      const okValue = v === null || ['string', 'number', 'boolean'].includes(typeof v);
      if (!okValue) return { error: 'flag value must be a primitive' };
      out.key = effect.key;
      out.value = typeof v === 'string' ? v.slice(0, 120) : v;
      break;
    }
    case 'counter': {
      if (!COUNTER_KEYS.includes(effect.key)) return { error: `unknown counter "${effect.key}"` };
      if (!isFiniteNumber(effect.delta)) return { error: 'counter delta must be numeric' };
      out.key = effect.key;
      out.delta = capDelta(effect.delta, SIM_CAPS.counter, repairs, `counter.${effect.key}`);
      break;
    }
    case 'thread': {
      const thread = state.threads[effect.thread];
      if (!thread) return { error: `unknown thread "${effect.thread}"` };
      out.thread = effect.thread;
      if (effect.stage !== undefined) {
        if (!isFiniteNumber(effect.stage)) return { error: 'thread.stage must be numeric' };
        out.stage = capDelta(effect.stage, SIM_CAPS.thread, repairs, 'thread.stage');
      }
      if (effect.setStage !== undefined) {
        if (!Number.isInteger(effect.setStage) || effect.setStage < 0 || effect.setStage > 10) return { error: 'thread.setStage out of range' };
        out.setStage = effect.setStage;
      }
      if (effect.urgency !== undefined) {
        if (!isFiniteNumber(effect.urgency)) return { error: 'thread.urgency must be numeric' };
        out.urgency = capDelta(effect.urgency, SIM_CAPS.urgency, repairs, 'thread.urgency');
      }
      if (effect.status !== undefined) {
        if (!THREAD_STATUSES.includes(effect.status)) return { error: `invalid thread status "${effect.status}"` };
        out.status = effect.status;
      }
      if (effect.visibility !== undefined) {
        if (!THREAD_VISIBILITY.includes(effect.visibility)) return { error: `invalid visibility "${effect.visibility}"` };
        out.visibility = effect.visibility;
      }
      if (effect.flags !== undefined) {
        if (typeof effect.flags !== 'object' || effect.flags === null) return { error: 'thread.flags must be an object' };
        out.flags = { ...effect.flags };
      }
      break;
    }
    case 'region': {
      if (!state.regions[effect.region]) return { error: `unknown region "${effect.region}"` };
      out.region = effect.region;
      if (effect.state !== undefined) {
        if (!REGION_STATES.includes(effect.state)) return { error: `invalid region state "${effect.state}"` };
        out.state = effect.state;
      }
      for (const key of ['casualties', 'damage']) {
        if (effect[key] !== undefined) {
          if (!isFiniteNumber(effect[key])) return { error: `region.${key} must be numeric` };
          out[key] = capDelta(effect[key], SIM_CAPS.region, repairs, `region.${key}`);
        }
      }
      if (effect.monument !== undefined) {
        const m = effect.monument;
        const title = cleanText(m?.title, repairs, 'monument.title', 80);
        const text = cleanText(m?.text, repairs, 'monument.text', 280);
        if (!title || !text || typeof m.id !== 'string') return { error: 'monument needs id, title, text' };
        out.monument = { id: m.id, title, text };
      }
      break;
    }
    case 'intensity': {
      if (!isFiniteNumber(effect.delta)) return { error: 'intensity delta must be numeric' };
      out.delta = capDelta(effect.delta, caps.intensity, repairs, 'intensity');
      out.reason = typeof effect.reason === 'string' ? effect.reason.slice(0, 60) : undefined;
      break;
    }
    case 'chronicle': {
      const title = cleanText(effect.title, repairs, 'chronicle.title', 90);
      const text = cleanText(effect.text, repairs, 'chronicle.text', 420);
      if (!title || !text) return { error: 'chronicle entry needs title and text' };
      out.title = title;
      out.text = text;
      out.kind = typeof effect.kind === 'string' ? effect.kind : 'event';
      out.tags = Array.isArray(effect.tags) ? effect.tags.filter((t) => typeof t === 'string').slice(0, 8) : [];
      break;
    }
    case 'character': {
      if (!state.characters[effect.character]) return { error: `unknown character "${effect.character}"` };
      out.character = effect.character;
      if (effect.status !== undefined) {
        if (!CHARACTER_STATUSES.includes(effect.status)) return { error: `invalid character status "${effect.status}"` };
        out.status = effect.status;
      }
      for (const key of ['role', 'name']) {
        if (effect[key] !== undefined) {
          const t = cleanText(effect[key], repairs, `character.${key}`, 80);
          if (!t) return { error: `character.${key} must be text` };
          out[key] = t;
        }
      }
      if (effect.age !== undefined) {
        if (!Number.isInteger(effect.age) || effect.age < 0 || effect.age > 400) return { error: 'character.age out of range' };
        out.age = effect.age;
      }
      break;
    }
    case 'approval': {
      const entry = state.chronicle.find((e) => e.id === effect.entry);
      if (!entry) return { error: `unknown chronicle entry "${effect.entry}"` };
      if (entry.approved) return { error: 'chronicle entry already approved' };
      out.entry = effect.entry;
      if (effect.detail !== undefined) {
        const detail = cleanText(effect.detail, repairs, 'approval.detail', 420);
        if (!detail) return { error: 'approval.detail must be text' };
        out.detail = detail;
      }
      break;
    }
    case 'voice': {
      const speaker = cleanText(effect.speaker, repairs, 'voice.speaker', 60);
      const text = cleanText(effect.text, repairs, 'voice.text', 240);
      if (!speaker || !text) return { error: 'voice needs speaker and text' };
      out.speaker = speaker;
      out.text = text;
      break;
    }
    default:
      return { error: 'unhandled effect type' };
  }
  return { effect: out, repairs };
}

/**
 * SimulationValidator. Returns normalized effects plus anything rejected or repaired.
 * @param {Array} effects
 * @param {object} state current GameState (used to check ids exist)
 * @param {{source?: 'sim'|'ai'}} [options]
 */
export function validateEffects(effects, state, { source = 'sim' } = {}) {
  const valid = [];
  const rejected = [];
  const repaired = [];
  if (!Array.isArray(effects)) {
    return { valid, rejected: [{ effect: effects, reason: 'effects must be an array' }], repaired };
  }
  for (const effect of effects) {
    const result = validateOne(effect, state, source);
    if (result.error) {
      rejected.push({ effect, reason: result.error });
    } else {
      valid.push(result.effect);
      if (result.repairs.length) repaired.push({ effect: result.effect, notes: result.repairs });
    }
  }
  return { valid, rejected, repaired };
}

function nextChronicleId(state) {
  return `c${state.cycle.number}-t${state.turn}-${state.chronicle.length + 1}`;
}

/**
 * GameStateMutator. Applies already-validated effects immutably.
 * Callers should pass the `valid` list from validateEffects().
 */
export function applyEffects(state, effects) {
  let s = state;
  const touch = (key) => {
    if (s[key] === state[key]) s = { ...s, [key]: Array.isArray(state[key]) ? [...state[key]] : { ...state[key] } };
    return s[key];
  };

  for (const e of effects) {
    switch (e.type) {
      case 'resource': {
        const res = touch('resources');
        res[e.key] = clamp((res[e.key] ?? 0) + e.delta, RESOURCE_BOUNDS[e.key]);
        break;
      }
      case 'faction': {
        const factions = touch('factions');
        const f = { ...factions[e.faction], memory: { ...factions[e.faction].memory } };
        if (e.attitude !== undefined) f.attitude = clamp(f.attitude + e.attitude, [-100, 100]);
        if (e.tension !== undefined) f.tension = clamp(f.tension + e.tension, [0, 100]);
        if (e.memory) {
          for (const [k, v] of Object.entries(e.memory)) f.memory[k] = clamp(f.memory[k] + v, [0, 100]);
        }
        factions[e.faction] = f;
        break;
      }
      case 'relationship': {
        const chars = touch('characters');
        const ch = { ...chars[e.character], rel: { ...chars[e.character].rel } };
        for (const key of REL_KEYS) {
          if (e[key] !== undefined) ch.rel[key] = clamp(ch.rel[key] + e[key], REL_BOUNDS[key]);
        }
        chars[e.character] = ch;
        break;
      }
      case 'memory': {
        const exists = s.memories.some(
          (m) => m.characterId === e.character && m.eventId === e.eventId && m.cycle === s.cycle.number,
        );
        if (exists) break; // one memory per event per cycle; repeats don't stack
        const memories = touch('memories');
        memories.push({
          id: `${e.character}:${e.eventId}:${s.cycle.number}:${s.turn}`,
          characterId: e.character,
          eventId: e.eventId,
          cycle: s.cycle.number,
          turn: s.turn,
          year: s.year,
          type: e.kind,
          description: e.description,
          emotionalWeight: e.emotionalWeight,
          sentiment: e.sentiment,
          permanent: e.permanent,
          tags: e.tags,
        });
        break;
      }
      case 'flag': {
        const flags = touch('flags');
        flags[e.key] = e.value;
        break;
      }
      case 'counter': {
        const counters = touch('counters');
        counters[e.key] = Math.max(0, (counters[e.key] ?? 0) + e.delta);
        break;
      }
      case 'thread': {
        const threads = touch('threads');
        const t = { ...threads[e.thread], flags: { ...threads[e.thread].flags } };
        if (e.stage !== undefined) t.stage = clamp(t.stage + e.stage, [0, 10]);
        if (e.setStage !== undefined) t.stage = e.setStage;
        if (e.urgency !== undefined) t.urgency = clamp(t.urgency + e.urgency, [0, 100]);
        if (e.status !== undefined) t.status = e.status;
        if (e.visibility !== undefined) t.visibility = e.visibility;
        if (e.flags) Object.assign(t.flags, e.flags);
        t.lastAdvancedTurn = s.totalTurns;
        threads[e.thread] = t;
        break;
      }
      case 'region': {
        const regions = touch('regions');
        const r = { ...regions[e.region], monuments: [...regions[e.region].monuments] };
        if (e.state !== undefined) r.state = e.state;
        if (e.casualties !== undefined) r.casualties = Math.max(0, r.casualties + e.casualties);
        if (e.damage !== undefined) r.damage = clamp(r.damage + e.damage, [0, 100]);
        if (e.monument && !r.monuments.some((m) => m.id === e.monument.id)) {
          r.monuments.push({ ...e.monument, cycle: s.cycle.number, year: s.year });
        }
        regions[e.region] = r;
        break;
      }
      case 'intensity': {
        s = { ...s, intensity: clamp(s.intensity + e.delta, [0, 100]) };
        break;
      }
      case 'chronicle': {
        const id = nextChronicleId(s);
        const chronicle = touch('chronicle');
        chronicle.push({
          id,
          cycle: s.cycle.number,
          turn: s.turn,
          year: s.year,
          title: e.title,
          text: e.text,
          kind: e.kind,
          tags: e.tags,
          approved: false,
        });
        break;
      }
      case 'character': {
        const chars = touch('characters');
        const ch = { ...chars[e.character] };
        for (const key of ['status', 'role', 'name', 'age']) if (e[key] !== undefined) ch[key] = e[key];
        chars[e.character] = ch;
        break;
      }
      case 'approval': {
        const chronicle = touch('chronicle');
        const i = chronicle.findIndex((x) => x.id === e.entry);
        if (i >= 0 && !chronicle[i].approved) chronicle[i] = { ...chronicle[i], approved: true, ...(e.detail ? { detail: e.detail } : {}) };
        break;
      }
      case 'voice': {
        const voices = touch('voices');
        voices.unshift({ speaker: e.speaker, text: e.text, cycle: s.cycle.number, turn: s.turn, year: s.year });
        if (voices.length > 12) voices.length = 12;
        break;
      }
      default:
        break;
    }
  }
  return s;
}

// Convenience: validate then apply, returning the new state and the validation report.
export function commitEffects(state, effects, options) {
  const report = validateEffects(effects, state, options);
  return { state: applyEffects(state, report.valid), report };
}
