// Output schemas for every generator (Master Build §28: "Each returns validated structured
// output"). One tiny spec DSL drives three things, so they can never drift apart:
//   toJsonSchema(spec)        → the JSON schema sent as output_config.format (structured outputs)
//   validateValue(spec, v)    → strict check, list of errors
//   repairValue(spec, v)      → coerce/trim/clamp what is salvageable, or undefined
// Structured outputs reject numeric/length/array-size constraints in the wire schema, so limits
// are stated in descriptions for the model and enforced here, client-side.
// No dependencies; pure functions.

export const CATEGORY_VALUES = ['diplomacy', 'military', 'clandestine', 'research', 'economic'];
export const TONE_VALUES = ['conciliatory', 'firm', 'threatening', 'evasive'];
// Same target vocabulary as the rule-based parser in sim/orderParser.js.
export const ORDER_TARGETS = ['iron_syndicate', 'frost_wargs', 'refugees', 'mystery'];
// AI may only *request* these (core/effects.js enforces it again with tight caps).
export const AI_EFFECT_TYPES = ['resource', 'relationship', 'faction', 'memory', 'intensity', 'voice'];
export const MAX_PROPOSALS = 3;

// ---------------------------------------------------------------------------------------------
// Spec DSL
// ---------------------------------------------------------------------------------------------
export const t = {
  string: (max, { min = 1, description } = {}) => ({ kind: 'string', max, min, description }),
  enum: (values, { description } = {}) => ({ kind: 'enum', values, description }),
  number: (min, max, { description, percentOk = false } = {}) => ({ kind: 'number', min, max, integer: false, description, percentOk }),
  integer: (min, max, { description } = {}) => ({ kind: 'number', min, max, integer: true, description }),
  boolean: ({ description } = {}) => ({ kind: 'boolean', description }),
  array: (items, { min = 0, max = Infinity, description, splitStrings = false } = {}) => ({ kind: 'array', items, min, max, description, splitStrings }),
  object: (props, { optional = [], description } = {}) => ({ kind: 'object', props, optional, description }),
  // A proposed Effect. Shape-checked here; validateEffects(…, {source:'ai'}) is the real gate.
  effect: () => ({ kind: 'effect' }),
};

const EFFECT_WIRE_SCHEMA = {
  type: 'object',
  description:
    'A small requested change. type resource: {key, delta}; relationship: {character, trust|respect|affection|resentment|fear}; ' +
    'faction: {faction, attitude|tension}; memory: {character, eventId (UPPER_SNAKE_CASE), description, sentiment -1..1}; ' +
    'intensity: {delta, reason}; voice: {speaker, text}. Magnitudes are tiny (relationship ±1..5, resource ±150 treasury/manpower, ±4 others).',
  properties: {
    type: { type: 'string', enum: AI_EFFECT_TYPES },
    key: { type: 'string', enum: ['treasury', 'manpower', 'readiness', 'stability', 'unrest', 'intel'] },
    delta: { type: 'number' },
    character: { type: 'string' },
    faction: { type: 'string' },
    trust: { type: 'number' },
    respect: { type: 'number' },
    affection: { type: 'number' },
    resentment: { type: 'number' },
    fear: { type: 'number' },
    attitude: { type: 'number' },
    tension: { type: 'number' },
    eventId: { type: 'string' },
    description: { type: 'string' },
    sentiment: { type: 'number' },
    reason: { type: 'string' },
    speaker: { type: 'string' },
    text: { type: 'string' },
  },
  required: ['type'],
  additionalProperties: false,
};

function describe(base, extra) {
  return [base, extra].filter(Boolean).join(' ');
}

/** Wire JSON schema (structured-outputs subset: additionalProperties:false, no size constraints). */
export function toJsonSchema(spec) {
  switch (spec.kind) {
    case 'string':
      return { type: 'string', description: describe(spec.description, `At most ${spec.max} characters.`) };
    case 'enum':
      return { type: 'string', enum: [...spec.values], ...(spec.description ? { description: spec.description } : {}) };
    case 'number':
      return { type: spec.integer ? 'integer' : 'number', description: describe(spec.description, `Between ${spec.min} and ${spec.max}.`) };
    case 'boolean':
      return { type: 'boolean', ...(spec.description ? { description: spec.description } : {}) };
    case 'array': {
      const size = Number.isFinite(spec.max) ? `${spec.min}–${spec.max} items.` : `At least ${spec.min} items.`;
      return { type: 'array', items: toJsonSchema(spec.items), description: describe(spec.description, size) };
    }
    case 'object': {
      const properties = {};
      for (const [k, v] of Object.entries(spec.props)) properties[k] = toJsonSchema(v);
      const out = {
        type: 'object',
        properties,
        required: Object.keys(spec.props).filter((k) => !spec.optional.includes(k)),
        additionalProperties: false,
      };
      if (spec.description) out.description = spec.description;
      return out;
    }
    case 'effect':
      return EFFECT_WIRE_SCHEMA;
    default:
      throw new Error(`unknown spec kind ${spec.kind}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Strict validation
// ---------------------------------------------------------------------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function validateValue(spec, value, path = '$') {
  const errors = [];
  const err = (msg) => errors.push(`${path}: ${msg}`);
  switch (spec.kind) {
    case 'string':
      if (typeof value !== 'string') err('expected string');
      else if (value.trim().length < spec.min) err('empty string');
      else if (value.length > spec.max) err(`longer than ${spec.max}`);
      break;
    case 'enum':
      if (!spec.values.includes(value)) err(`expected one of ${spec.values.join('|')}`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) err('expected number');
      else if (spec.integer && !Number.isInteger(value)) err('expected integer');
      else if (value < spec.min || value > spec.max) err(`outside ${spec.min}..${spec.max}`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') err('expected boolean');
      break;
    case 'array':
      if (!Array.isArray(value)) err('expected array');
      else {
        if (value.length < spec.min) err(`fewer than ${spec.min} items`);
        if (value.length > spec.max) err(`more than ${spec.max} items`);
        value.forEach((item, i) => errors.push(...validateValue(spec.items, item, `${path}[${i}]`)));
      }
      break;
    case 'object':
      if (!isPlainObject(value)) err('expected object');
      else {
        for (const [k, sub] of Object.entries(spec.props)) {
          if (value[k] === undefined) {
            if (!spec.optional.includes(k)) err(`missing "${k}"`);
          } else errors.push(...validateValue(sub, value[k], `${path}.${k}`));
        }
        for (const k of Object.keys(value)) if (!(k in spec.props)) err(`unexpected "${k}"`);
      }
      break;
    case 'effect':
      if (!isPlainObject(value) || typeof value.type !== 'string') err('expected effect object with type');
      break;
    default:
      err('unknown spec');
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Repair: coerce / trim / clamp / drop. Returns undefined when nothing usable remains.
// ---------------------------------------------------------------------------------------------
function cleanString(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(' ');
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.-]+$/, '')}…`;
}

function findKey(obj, key) {
  if (key in obj) return key;
  const lower = key.toLowerCase();
  return Object.keys(obj).find((k) => k.toLowerCase() === lower || k.toLowerCase().replace(/[_\s-]/g, '') === lower);
}

export function repairValue(spec, value, notes = [], path = '$') {
  const note = (msg) => notes.push(`${path}: ${msg}`);
  switch (spec.kind) {
    case 'string': {
      let s = value;
      if (typeof s === 'number' || typeof s === 'boolean') {
        s = String(s);
        note('coerced to string');
      }
      if (typeof s !== 'string') return undefined;
      s = cleanString(s);
      if (s.length < spec.min) return undefined;
      if (s.length > spec.max) {
        note(`truncated to ${spec.max}`);
        s = truncate(s, spec.max);
      }
      return s;
    }
    case 'enum': {
      if (typeof value !== 'string') return undefined;
      const v = value.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const hit = spec.values.find((x) => x === v || x.replace(/_/g, '') === v.replace(/_/g, ''));
      if (hit && hit !== value) note('normalized enum');
      return hit;
    }
    case 'number': {
      let n = typeof value === 'string' && value.trim() !== '' ? Number(value.trim().replace(/%$/, '')) : value;
      if (typeof value === 'string' && /%$/.test(value.trim()) && Number.isFinite(n)) n /= 100;
      if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
      if (spec.percentOk && n > spec.max && n <= 100) {
        n /= 100;
        note('read as percent');
      }
      if (spec.integer && !Number.isInteger(n)) n = Math.round(n);
      if (n < spec.min || n > spec.max) {
        note(`clamped to ${spec.min}..${spec.max}`);
        n = Math.min(spec.max, Math.max(spec.min, n));
      }
      return n;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'covert', 'secret'].includes(v)) return true;
        if (['false', 'no', 'n', '0', 'open', 'overt'].includes(v)) return false;
      }
      return undefined;
    }
    case 'array': {
      let list = value;
      if (!Array.isArray(list)) {
        if (list === undefined || list === null) return spec.min === 0 ? [] : undefined;
        if (spec.splitStrings && typeof list === 'string') list = list.split(/\n\s*\n/);
        else list = [list];
        note('wrapped in array');
      }
      const out = [];
      list.forEach((item, i) => {
        const r = repairValue(spec.items, item, notes, `${path}[${i}]`);
        if (r === undefined) note(`dropped item ${i}`);
        else out.push(r);
      });
      if (out.length > spec.max) {
        note(`trimmed to ${spec.max} items`);
        out.length = spec.max;
      }
      if (out.length < spec.min) return undefined;
      return out;
    }
    case 'object': {
      if (!isPlainObject(value)) return undefined;
      const out = {};
      for (const [k, sub] of Object.entries(spec.props)) {
        const src = findKey(value, k);
        const raw = src === undefined ? undefined : value[src];
        if (raw === undefined || raw === null) {
          if (spec.optional.includes(k)) continue;
          return undefined;
        }
        const r = repairValue(sub, raw, notes, `${path}.${k}`);
        if (r === undefined) {
          if (spec.optional.includes(k)) {
            note(`dropped optional "${k}"`);
            continue;
          }
          return undefined;
        }
        out[k] = r;
      }
      return out;
    }
    case 'effect':
      return isPlainObject(value) && typeof value.type === 'string' ? { ...value } : undefined;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Generator output specs
// ---------------------------------------------------------------------------------------------
const line = (maxText) =>
  t.object({
    speaker: t.string(60, { description: 'Who speaks: a character name, "Narrator" for stage direction.' }),
    text: t.string(maxText),
  });

const proposals = t.array(t.effect(), { max: MAX_PROPOSALS, description: 'Optional small requested changes; the simulation may reject them.' });

export const OUTPUT_SPECS = {
  narrative: t.object(
    {
      briefing: t.string(900, { description: 'The War Room briefing, addressed to the Sovereign.' }),
      voices: t.array(line(240), { max: 3, description: 'Optional one-line remarks from advisors.' }),
    },
    { optional: ['voices'] },
  ),
  orderInterpreter: t.object({
    actions: t.array(
      t.object(
        {
          category: t.enum(CATEGORY_VALUES),
          target: t.enum(ORDER_TARGETS, { description: 'Who or what the action is aimed at; omit if none fits.' }),
          covert: t.boolean({ description: 'True when the order asks for secrecy or deniability.' }),
          weight: t.number(0, 1, { description: 'Share of the Crown’s effort.', percentOk: true }),
        },
        { optional: ['target'] },
      ),
      { min: 1, max: 3 },
    ),
    summary: t.string(240, { description: 'One sentence, as the Royal secretary would record the decree.' }),
  }),
  campfire: t.object({ lines: t.array(line(280), { min: 1, max: 8 }), proposals }, { optional: ['proposals'] }),
  dialogue: t.object({ lines: t.array(line(280), { min: 1, max: 6 }) }),
  diplomacy: t.object({ message: t.string(600), tone: t.enum(TONE_VALUES) }),
  character: t.object({
    name: t.string(60),
    age: t.integer(1, 120),
    occupation: t.string(80),
    personality: t.string(200),
    belief: t.string(200),
    fear: t.string(200),
    desire: t.string(200),
  }),
  event: t.object({ headline: t.string(90), text: t.string(600), proposals }, { optional: ['proposals'] }),
  chronicle: t.object({
    paragraphs: t.array(t.string(700), { min: 1, max: 5, splitStrings: true, description: 'The Chronicle read back in the world’s words.' }),
  }),
};

// Map free-text targets ("the Syndicate", "Skaela", "the refugees") onto ORDER_TARGETS.
const TARGET_ALIASES = [
  ['iron_syndicate', /syndicate|\bvex\b|walker|iron|nyra|depot|greywater|south/],
  ['frost_wargs', /warg|skaela|wolf|wolves|\bpack\b|\bice\b|north(?!ern road)/],
  ['refugees', /refugee|mika|famil|children|camp|northern road|villag/],
  ['mystery', /symbol|circle|ruin|architect|lattice|light/],
];

export function normalizeOrderTarget(raw) {
  if (typeof raw !== 'string') return raw;
  const v = raw.trim().toLowerCase();
  if (ORDER_TARGETS.includes(v)) return v;
  const hit = TARGET_ALIASES.find(([, re]) => re.test(v));
  return hit ? hit[0] : undefined;
}

/** Generator-specific normalization applied to the parsed value before repair. */
export const PREPARE = {
  orderInterpreter(value) {
    if (!isPlainObject(value) || !Array.isArray(value.actions)) return value;
    return {
      ...value,
      actions: value.actions.map((a) =>
        isPlainObject(a) && a.target !== undefined ? { ...a, target: normalizeOrderTarget(a.target) ?? undefined } : a,
      ),
    };
  },
};

export const GENERATOR_NAMES = Object.keys(OUTPUT_SPECS);

/** Precomputed wire schemas: OUTPUT_JSON_SCHEMAS[name] → JSON schema object. */
export const OUTPUT_JSON_SCHEMAS = Object.fromEntries(GENERATOR_NAMES.map((n) => [n, toJsonSchema(OUTPUT_SPECS[n])]));

function specFor(name) {
  const spec = OUTPUT_SPECS[name];
  if (!spec) throw new Error(`unknown generator "${name}"`);
  return spec;
}

/** Strict validation of a generator output. */
export function validateOutput(name, value) {
  const errors = validateValue(specFor(name), value);
  return { ok: errors.length === 0, errors };
}

/**
 * Repair a parsed value into a valid output for `name`, or report failure.
 * Unwraps one level of `{ "<anything>": { ...the real object } }` if needed.
 * @returns {{ ok: boolean, value?: object, notes: string[], errors?: string[] }}
 */
export function repairOutput(name, value) {
  const spec = specFor(name);
  const prepare = PREPARE[name] ?? ((v) => v);
  const attempt = (v) => {
    const notes = [];
    const repaired = repairValue(spec, prepare(v), notes);
    if (repaired === undefined) return null;
    const errors = validateValue(spec, repaired);
    return errors.length ? null : { ok: true, value: repaired, notes };
  };
  const direct = attempt(value);
  if (direct) return direct;
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && isPlainObject(value[keys[0]])) {
      const inner = attempt(value[keys[0]]);
      if (inner) return { ...inner, notes: [`unwrapped "${keys[0]}"`, ...inner.notes] };
    }
  }
  return { ok: false, notes: [], errors: validateValue(spec, value) };
}

// ---------------------------------------------------------------------------------------------
// JSON extraction (model text → value). Tolerates code fences, prose around the object,
// trailing commas and outputs cut off by max_tokens.
// ---------------------------------------------------------------------------------------------
function tryParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function stripTrailingCommas(s) {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/** Scan from `start` (a '{' or '['); return the balanced substring, or the unterminated tail. */
function scanBalanced(text, start) {
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) return { complete: true, text: text.slice(start, i + 1) };
    }
  }
  return { complete: false, text: text.slice(start), stack, inString };
}

/** Best-effort close of a JSON prefix cut off mid-stream. */
function closeTruncated(prefix) {
  let s = prefix;
  for (let guard = 0; guard < 6; guard += 1) {
    const scan = scanBalanced(s, 0);
    if (scan.complete) return tryParse(stripTrailingCommas(scan.text));
    let body = scan.text;
    if (scan.inString) body += '"';
    body = body.replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:?\s*$/, '').replace(/:\s*$/, ': null');
    const closers = [...(scanBalanced(body, 0).stack ?? [])]
      .reverse()
      .map((c) => (c === '{' ? '}' : ']'))
      .join('');
    const parsed = tryParse(stripTrailingCommas(body + closers));
    if (parsed.ok) return parsed;
    const cut = body.lastIndexOf(',');
    if (cut <= 0) return { ok: false };
    s = body.slice(0, cut);
  }
  return { ok: false };
}

/**
 * Extract a JSON value from model text.
 * @returns {{ ok: boolean, value?: any, salvaged?: boolean }}
 */
export function parseJsonLoose(text) {
  if (typeof text !== 'string') return { ok: false };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false };
  const direct = tryParse(trimmed);
  if (direct.ok) return direct;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.search(/[{[]/);
  if (start === -1) return { ok: false };
  const scan = scanBalanced(body, start);
  if (scan.complete) {
    const p = tryParse(scan.text);
    if (p.ok) return { ...p, salvaged: true };
    const q = tryParse(stripTrailingCommas(scan.text));
    return q.ok ? { ...q, salvaged: true } : { ok: false };
  }
  const closed = closeTruncated(body.slice(start));
  return closed.ok ? { ...closed, salvaged: true } : { ok: false };
}
