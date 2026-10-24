// AI generators (Master Build §28/§29/§18). Every generator:
//   async (context, fallback?) => { ok, output, source: 'ai'|'cache'|'fallback', proposals, rejected, error?, detail? }
// Pipeline: compact structured context → cache → Claude (optional) → parse → validate → repair
//           → retry once → deterministic fallback(context).
// Generators never touch GameState. Proposed effects in an output are run through
// validateEffects(proposals, context.state, { source: 'ai' }) and only the valid ones are
// returned in `proposals`; the caller applies them with applyEffects(). `output` never carries
// raw proposals.
//
// `ok` is true whenever a usable output is returned (AI, cache or fallback). It is false only
// when the authored fallback is missing or throws — then `output` is null.

import { validateEffects } from '../core/effects.js';
import { DEFAULT_MAX_TOKENS, DEFAULT_MODEL, classifyError, createClaudeClient } from './client.js';
import { createAiCache, contextHash, normalizeBudget } from './cache.js';
import { GENERATOR_NAMES, MAX_PROPOSALS, OUTPUT_JSON_SCHEMAS, parseJsonLoose, repairOutput } from './schemas.js';
import { PROMPT_VERSION, buildCompactContext, buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { aiStatus } from './status.js';

// Same efficiency rule as sim/orderParser.js: splitting focus costs efficiency
// (1 action → 1.0 total effort, 2 → 1.2, 3 → 1.35). AI weights keep their relative emphasis
// but can never buy more total effort than the deterministic parser would.
export const ORDER_EFFORT_TOTALS = [0, 1, 1.2, 1.35];

const MAX_TOKENS = { chronicle: 2000 };

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const round3 = (n) => Math.round(n * 1000) / 1000;

export function normalizeOrderWeights(actions) {
  const n = Math.min(actions.length, 3);
  const total = ORDER_EFFORT_TOTALS[n] ?? 1;
  const sum = actions.reduce((acc, a) => acc + (a.weight > 0 ? a.weight : 0), 0);
  return actions.map((a) => {
    const share = sum > 0 ? (a.weight > 0 ? a.weight : 0) / sum : 1 / n;
    return { ...a, weight: round3(Math.min(1, share * total)) };
  });
}

// Shape AI/cached outputs to what callers expect (idempotent).
const POSTPROCESS = {
  orderInterpreter(out) {
    const actions = normalizeOrderWeights(out.actions).map((a) => ({
      category: a.category,
      target: a.target ?? null,
      covert: a.covert,
      weight: a.weight,
    }));
    return { actions, summary: out.summary, understood: actions.length > 0, confidence: 0.8 };
  },
};

function readSettingsFrom(getSettings, settings) {
  let raw;
  try {
    raw = typeof getSettings === 'function' ? getSettings() : settings;
  } catch {
    raw = null;
  }
  raw = isPlainObject(raw) ? raw : {};
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : DEFAULT_MODEL;
  return {
    aiEnabled: Boolean(raw.aiEnabled),
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    model,
    aiBudget: normalizeBudget(raw.aiBudget),
  };
}

function isOffline() {
  return globalThis.navigator?.onLine === false;
}

/** Split proposals off an output and validate them against the state. */
function settleProposals(output, state, source) {
  if (!isPlainObject(output) || output.proposals === undefined) return { output, proposals: [], rejected: [] };
  const { proposals: raw, ...rest } = output;
  const list = Array.isArray(raw) ? raw : [raw];
  const rejected = list.slice(MAX_PROPOSALS).map((effect) => ({ effect, reason: `at most ${MAX_PROPOSALS} proposals` }));
  const kept = list.slice(0, MAX_PROPOSALS);
  if (!state || typeof state !== 'object' || !state.characters) {
    return { output: rest, proposals: [], rejected: [...kept.map((effect) => ({ effect, reason: 'no state to validate against' })), ...rejected] };
  }
  const report = validateEffects(kept, state, { source });
  return { output: rest, proposals: report.valid, rejected: [...report.rejected, ...rejected] };
}

const RETRY_NOTES = {
  invalid: 'Your previous reply could not be used: it was not a JSON object matching the schema. Reply again with only that JSON object, keeping every field within its stated limits.',
  max_tokens: 'Your previous reply was cut off. Reply again with only the JSON object, shorter, keeping every field within its stated limits.',
};

/**
 * @param {object} [options]
 * @param {() => object} [options.getSettings]  returns { aiEnabled, apiKey, model?, aiBudget? } (read on every call)
 * @param {object} [options.settings]           static settings alternative to getSettings
 * @param {object} [options.client]             Anthropic-shaped SDK instance (or { complete }) — tests inject a mock
 * @param {(apiKey) => object} [options.createClient] factory for SDK clients (default: real SDK, lazy)
 * @param {object} [options.storage]            storage adapter for the generation cache
 * @param {object} [options.cache]              prebuilt cache (createAiCache)
 * @param {object} [options.status]             status instance (default: the shared aiStatus)
 * @param {object} [options.fallbacks]          { [generatorName]: (context) => output } defaults
 */
export function createGenerators({ getSettings, settings, client, createClient, storage, cache, status, fallbacks = {} } = {}) {
  const claude = client && typeof client.complete === 'function' ? client : createClaudeClient({ sdkClient: client, createClient });
  const memo = cache ?? createAiCache({ storage });
  const stat = status ?? aiStatus;
  const inflight = new Map();
  const readSettings = () => readSettingsFrom(getSettings, settings);

  async function useFallback(name, context, fallbackFn, error, detail) {
    stat.recordFallback(error);
    const base = { source: 'fallback', proposals: [], rejected: [], error };
    if (detail) base.detail = detail;
    if (typeof fallbackFn !== 'function') return { ...base, ok: false, output: null, error: error ?? 'no_fallback', detail: detail ?? 'No authored fallback was provided' };
    let out;
    try {
      out = await fallbackFn(context);
    } catch (err) {
      return { ...base, ok: false, output: null, detail: `Fallback failed: ${err?.message ?? err}` };
    }
    // Authored content is simulation-owned: its proposals validate at 'sim' level.
    const settled = settleProposals(out, context?.state, 'sim');
    return { ...base, ok: settled.output !== undefined && settled.output !== null, output: settled.output ?? null, proposals: settled.proposals, rejected: settled.rejected };
  }

  function finish(name, value, context, source, notes) {
    const shaped = POSTPROCESS[name] ? POSTPROCESS[name](value) : value;
    const settled = settleProposals(shaped, context?.state, 'ai');
    stat.recordSuccess(source);
    const result = { ok: true, output: settled.output, source, proposals: settled.proposals, rejected: settled.rejected };
    if (notes?.length) result.repairs = notes;
    return result;
  }

  async function callModel(name, compact, s, hash) {
    const system = buildSystemPrompt(name, compact);
    let failure = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (stat.get().callsThisSession >= s.aiBudget) return { ok: false, error: failure ?? 'budget' };
      stat.recordCall();
      let res;
      try {
        res = await claude.complete({
          apiKey: s.apiKey,
          model: s.model,
          system,
          user: buildUserPrompt(name, compact, attempt ? RETRY_NOTES[failure] : undefined),
          schema: OUTPUT_JSON_SCHEMAS[name],
          maxTokens: Math.round((MAX_TOKENS[name] ?? DEFAULT_MAX_TOKENS) * (failure === 'max_tokens' ? 1.5 : 1)),
          effort: 'low',
        });
      } catch (err) {
        // The SDK already retried transport failures (maxRetries: 1); don't spend more.
        const cls = classifyError(err);
        stat.recordError(cls, s);
        return { ok: false, error: cls.kind, detail: cls.message };
      }
      if (res.stopReason === 'refusal') {
        // Server-side fallbacks already had their chance; a re-ask would likely refuse again.
        stat.recordError({ kind: 'refusal', message: 'The model declined this request — using authored text', blocksKey: false }, s);
        return { ok: false, error: 'refusal', detail: res.refusalCategory ?? undefined };
      }
      const parsed = parseJsonLoose(res.text);
      if (parsed.ok) {
        const repaired = repairOutput(name, parsed.value);
        if (repaired.ok) {
          memo.set(hash, repaired.value, name);
          const notes = [...(parsed.salvaged ? ['extracted JSON from text'] : []), ...repaired.notes];
          return { ok: true, value: repaired.value, notes };
        }
      }
      failure = res.stopReason === 'max_tokens' ? 'max_tokens' : 'invalid';
    }
    stat.recordError({ kind: failure, message: 'The narrator returned unusable text — using authored text', blocksKey: false }, s);
    return { ok: false, error: failure };
  }

  async function run(name, rawContext, fallbackFn) {
    const context = isPlainObject(rawContext) ? rawContext : {};
    const fb = typeof fallbackFn === 'function' ? fallbackFn : fallbacks[name];
    const s = readSettings();
    stat.syncSettings(s);

    if (!s.aiEnabled) return useFallback(name, context, fb, 'disabled');
    if (!s.apiKey) return useFallback(name, context, fb, 'no_key');
    const blocked = stat.blockedReason(s);
    if (blocked) return useFallback(name, context, fb, blocked, stat.get().lastError ?? undefined);
    if (isOffline()) return useFallback(name, context, fb, 'offline');

    let compact;
    try {
      compact = buildCompactContext(name, context);
    } catch (err) {
      return useFallback(name, context, fb, 'context', err?.message);
    }
    const hash = contextHash(name, compact, { model: s.model, version: PROMPT_VERSION });

    const cached = memo.get(hash);
    if (cached !== undefined) {
      const repaired = repairOutput(name, cached);
      if (repaired.ok) return finish(name, repaired.value, context, 'cache');
    }

    let pending = inflight.get(hash);
    if (!pending) {
      pending = callModel(name, compact, s, hash).finally(() => inflight.delete(hash));
      inflight.set(hash, pending);
    }
    let result;
    try {
      result = await pending;
    } catch (err) {
      result = { ok: false, error: 'unknown', detail: err?.message };
    }
    if (!result.ok) return useFallback(name, context, fb, result.error, result.detail);
    return finish(name, result.value, context, 'ai', result.notes);
  }

  const generators = Object.fromEntries(GENERATOR_NAMES.map((name) => [name, (context, fallback) => run(name, context, fallback)]));
  return {
    ...generators,
    /** Status snapshot reflecting the current settings. */
    getStatus() {
      stat.syncSettings(readSettings());
      return stat.get();
    },
    clearCache() {
      memo.clear();
    },
  };
}

export { getAiStatus, subscribeAiStatus, aiStatus, createAiStatus } from './status.js';
