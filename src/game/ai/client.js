// Thin wrapper around the official Anthropic SDK (@anthropic-ai/sdk 1.3.0) for the optional
// narrator (Master Build §28). The player supplies their own API key in Settings; it stays in
// their browser (dangerouslyAllowBrowser). Nothing here touches GameState.
//
// Request shape (verified against the SDK 1.3.0 type definitions):
//   model            settings.model || 'claude-opus-5-5'
//   max_tokens       ~1500 (short narrative jobs)
//   system, messages [{ role:'user', content }]
//   output_config    { effort: 'low', format: { type: 'json_schema', schema } }   (structured outputs)
//   betas            ['server-side-fallback-2026-07-01']  + fallbacks: 'default'  (refusal fallbacks,
//                    sent via client.beta.messages.create; the SDK moves `betas` into the
//                    anthropic-beta header and passes `fallbacks` through in the body — it is a
//                    declared BetaMessageCreateParams field in 1.3.0)
//   NOT sent: temperature / top_p / top_k (rejected with 400 since 2026-10-21), thinking (always on
//   for claude-opus-5-5 and cannot be disabled; effort is the only control).
// Request options: { timeout: 20000, maxRetries: 1 }.

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AnthropicError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk/core/error';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export const DEFAULT_MAX_TOKENS = 1500;
export const DEFAULT_EFFORT = 'low';
export const REQUEST_OPTIONS = Object.freeze({ timeout: 20_000, maxRetries: 1 });

// Models that accept server-side `fallbacks: "default"` on the Claude API.
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-sonnet-5-5']);
// Models that reject output_config.effort (older generations a user might still pick).
const NO_EFFORT = /^claude-(?:haiku-4-5|sonnet-4-5|3)/;

export function supportsServerFallback(model) {
  return SERVER_FALLBACK_MODELS.has(model);
}

/**
 * Pure: build Messages API params for one structured-output generation.
 * @returns {{ params: object, beta: boolean }}
 */
export function buildMessageParams({ model = DEFAULT_MODEL, system, user, schema, maxTokens = DEFAULT_MAX_TOKENS, effort = DEFAULT_EFFORT }) {
  const outputConfig = { format: { type: 'json_schema', schema } };
  if (effort && !NO_EFFORT.test(model)) outputConfig.effort = effort;
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: outputConfig,
  };
  if (supportsServerFallback(model)) {
    params.betas = [SERVER_FALLBACK_BETA];
    params.fallbacks = 'default';
    return { params, beta: true };
  }
  return { params, beta: false };
}

/** Read the text, stop reason and fallback info out of a (Beta)Message. */
export function interpretResponse(response) {
  const content = Array.isArray(response?.content) ? response.content : [];
  const text = content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  const iterations = Array.isArray(response?.usage?.iterations) ? response.usage.iterations : [];
  return {
    stopReason: response?.stop_reason ?? null,
    refusalCategory: response?.stop_reason === 'refusal' ? (response?.stop_details?.category ?? null) : null,
    text,
    model: response?.model ?? null,
    usage: response?.usage ?? null,
    fallbackUsed: content.some((b) => b?.type === 'fallback') || iterations.some((i) => i?.type === 'fallback_message'),
  };
}

/**
 * Map SDK errors onto stable kinds using the SDK's typed classes (never message matching).
 * `blocksKey`: stop calling with this key/model until the user changes Settings.
 */
export function classifyError(err) {
  if (err instanceof AuthenticationError) return { kind: 'auth', message: 'API key rejected', blocksKey: true };
  if (err instanceof PermissionDeniedError) return { kind: 'permission', message: 'This API key is not allowed to use this model', blocksKey: true };
  if (err instanceof NotFoundError) return { kind: 'not_found', message: 'Model not found — check the model id in Settings', blocksKey: true };
  if (err instanceof RateLimitError) return { kind: 'rate_limit', message: 'Rate limited by the API — using authored text for now', blocksKey: false };
  if (err instanceof BadRequestError) return { kind: 'bad_request', message: 'The API rejected the request (400)', blocksKey: false };
  if (err instanceof InternalServerError) return { kind: 'server', message: 'The API is having trouble (5xx)', blocksKey: false };
  if (err instanceof APIUserAbortError) return { kind: 'aborted', message: 'Request cancelled', blocksKey: false };
  if (err instanceof APIConnectionTimeoutError) return { kind: 'timeout', message: 'The API timed out', blocksKey: false };
  if (err instanceof APIConnectionError) return { kind: 'offline', message: 'Could not reach the API (offline?)', blocksKey: false };
  if (err instanceof APIError) return { kind: 'api', message: `API error${err.status ? ` ${err.status}` : ''}`, blocksKey: false };
  if (err instanceof AnthropicError) return { kind: 'sdk', message: 'Anthropic SDK error', blocksKey: false };
  return { kind: 'unknown', message: 'Unexpected error while generating', blocksKey: false };
}

let sdkPromise = null;
/** Lazily load the SDK so it is only downloaded when the player turns the narrator on. */
export function loadSdk() {
  if (!sdkPromise) sdkPromise = import('@anthropic-ai/sdk').then((m) => m.default ?? m.Anthropic);
  return sdkPromise;
}

/** Construct an SDK client for a browser-held key. */
export async function createSdkClient(apiKey) {
  const Anthropic = await loadSdk();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: REQUEST_OPTIONS.maxRetries, timeout: REQUEST_OPTIONS.timeout });
}

/**
 * @param {{ sdkClient?: object, createClient?: (apiKey: string) => object|Promise<object> }} [options]
 *   sdkClient: an Anthropic-shaped instance ({ messages.create, beta.messages.create }) — tests inject a mock.
 *   createClient: factory per API key (default: real SDK client, created lazily and reused per key).
 * @returns {{ complete(req): Promise<ReturnType<typeof interpretResponse>> }} — throws SDK errors as-is.
 */
export function createClaudeClient({ sdkClient, createClient = createSdkClient } = {}) {
  let cached = { key: null, client: null };
  async function clientFor(apiKey) {
    if (sdkClient) return sdkClient;
    if (cached.key !== apiKey || !cached.client) cached = { key: apiKey, client: await createClient(apiKey) };
    return cached.client;
  }
  return {
    /**
     * @param {{ apiKey, model?, system, user, schema, maxTokens?, effort?, signal? }} req
     */
    async complete({ apiKey, signal, ...rest }) {
      const client = await clientFor(apiKey);
      const { params, beta } = buildMessageParams(rest);
      const options = { ...REQUEST_OPTIONS, ...(signal ? { signal } : {}) };
      const response = beta ? await client.beta.messages.create(params, options) : await client.messages.create(params, options);
      return interpretResponse(response);
    },
  };
}
