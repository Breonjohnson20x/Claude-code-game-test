// Narrator status for the Settings UI: is AI on, what failed last, how much budget is left.
// One shared instance per page session (aiStatus); tests create isolated ones.
// The API key itself is never stored here — only a one-way fingerprint of a rejected key.

import { DEFAULT_AI_BUDGET, hash53, normalizeBudget } from './cache.js';
import { DEFAULT_MODEL } from './client.js';

const fingerprint = (apiKey, model = '') => hash53(`${apiKey ?? ''}\u0000${model}`, 7);

/**
 * @returns {{
 *   get(): AiStatus, subscribe(fn): () => void, syncSettings(settings): void,
 *   blockedReason(settings): string|null, recordCall(): void, recordSuccess(source): void,
 *   recordFallback(reason): void, recordError(classified, settings?): void, resetSession(): void,
 *   clearBlock(): void,
 * }}
 * AiStatus = { enabled, configured, model, keyRejected, lastError, lastErrorKind, lastSource,
 *              callsThisSession, budget, remaining, cacheHits, fallbacks, successes }
 */
export function createAiStatus({ budget = DEFAULT_AI_BUDGET } = {}) {
  const s = {
    enabled: false,
    configured: false,
    model: DEFAULT_MODEL,
    keyRejected: false,
    lastError: null,
    lastErrorKind: null,
    lastSource: null,
    callsThisSession: 0,
    budget: normalizeBudget(budget),
    cacheHits: 0,
    fallbacks: 0,
    successes: 0,
  };
  let block = null; // { kind, message, fp, scope: 'key'|'key+model' }
  const listeners = new Set();

  const snapshot = () => ({ ...s, remaining: Math.max(0, s.budget - s.callsThisSession) });
  const emit = () => {
    const snap = snapshot();
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch {
        // a broken listener must not break generation
      }
    }
  };

  function blockedReason(settings = {}) {
    if (!block) return null;
    const fp = block.scope === 'key' ? fingerprint(settings.apiKey) : fingerprint(settings.apiKey, settings.model);
    return fp === block.fp ? block.kind : null;
  }

  return {
    get: snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    syncSettings(settings = {}) {
      s.configured = Boolean(settings.apiKey);
      s.model = settings.model || DEFAULT_MODEL;
      s.budget = normalizeBudget(settings.aiBudget);
      const blocked = blockedReason(settings);
      s.keyRejected = blocked === 'auth';
      if (block && !blocked) {
        // The player changed the key/model: give the new one a chance.
        block = null;
        if (['auth', 'permission', 'not_found'].includes(s.lastErrorKind)) {
          s.lastError = null;
          s.lastErrorKind = null;
        }
      }
      s.enabled = Boolean(settings.aiEnabled) && s.configured && !blocked;
      emit();
    },
    blockedReason,
    recordCall() {
      s.callsThisSession += 1;
      emit();
    },
    recordSuccess(source = 'ai') {
      s.lastSource = source;
      if (source === 'cache') s.cacheHits += 1;
      else s.successes += 1;
      if (source === 'ai') {
        s.lastError = null;
        s.lastErrorKind = null;
      }
      emit();
    },
    recordFallback(reason) {
      s.lastSource = 'fallback';
      s.fallbacks += 1;
      if (reason === 'budget' && s.lastErrorKind !== 'budget') {
        s.lastError = 'Session AI budget used up — using authored text';
        s.lastErrorKind = 'budget';
      }
      emit();
    },
    recordError(classified, settings = {}) {
      s.lastError = classified.message;
      s.lastErrorKind = classified.kind;
      if (classified.blocksKey) {
        const scope = classified.kind === 'auth' ? 'key' : 'key+model';
        block = {
          kind: classified.kind,
          scope,
          fp: scope === 'key' ? fingerprint(settings.apiKey) : fingerprint(settings.apiKey, settings.model),
        };
        if (classified.kind === 'auth') s.keyRejected = true;
        s.enabled = false;
      }
      emit();
    },
    clearBlock() {
      block = null;
      s.keyRejected = false;
      emit();
    },
    resetSession() {
      s.callsThisSession = 0;
      s.cacheHits = 0;
      s.fallbacks = 0;
      s.successes = 0;
      emit();
    },
  };
}

/** The page-wide status every createGenerators() instance reports to by default. */
export const aiStatus = createAiStatus();

/** { enabled, configured, model, keyRejected, lastError, lastErrorKind, callsThisSession, budget, remaining, … } */
export function getAiStatus() {
  return aiStatus.get();
}

/** Subscribe to status changes (e.g. in a Settings panel). Returns an unsubscribe function. */
export function subscribeAiStatus(fn) {
  return aiStatus.subscribe(fn);
}
