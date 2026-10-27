// Wire-level checks against the real SDK 1.3.0 with an injected fetch — no network.
import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_MODEL, SERVER_FALLBACK_BETA, buildMessageParams, classifyError, createClaudeClient, interpretResponse } from './client.js';
import { OUTPUT_JSON_SCHEMAS } from './schemas.js';

function fakeFetch(respond) {
  const requests = [];
  const fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    requests.push({ url: String(url), method: init.method, headers, body: JSON.parse(init.body) });
    const { status = 200, body } = respond(requests.length);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  };
  return { fetch, requests };
}

const message = (text, extra = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: DEFAULT_MODEL,
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 12, output_tokens: 30 },
  ...extra,
});

describe('buildMessageParams', () => {
  it('builds the claude-opus-5-5 request: effort low, structured output, default fallbacks, no sampling or thinking', () => {
    const { params, beta } = buildMessageParams({ system: 'sys', user: 'ctx', schema: OUTPUT_JSON_SCHEMAS.diplomacy });
    expect(beta).toBe(true);
    expect(params).toEqual({
      model: 'claude-opus-5-5',
      max_tokens: 1500,
      system: 'sys',
      messages: [{ role: 'user', content: 'ctx' }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMAS.diplomacy } },
      betas: [SERVER_FALLBACK_BETA],
      fallbacks: 'default',
    });
    for (const banned of ['temperature', 'top_p', 'top_k', 'thinking']) expect(params).not.toHaveProperty(banned);
  });

  it('omits fallbacks for models without server-side fallback, and effort for models without effort', () => {
    expect(buildMessageParams({ model: 'claude-haiku-5-5', system: 's', user: 'u', schema: {} })).toMatchObject({ beta: false });
    expect(buildMessageParams({ model: 'claude-haiku-5-5', system: 's', user: 'u', schema: {} }).params).not.toHaveProperty('fallbacks');
    expect(buildMessageParams({ model: 'claude-haiku-4-5', system: 's', user: 'u', schema: {} }).params.output_config).not.toHaveProperty('effort');
  });
});

describe('createClaudeClient over the real SDK (fake fetch)', () => {
  it('sends betas as the anthropic-beta header and fallbacks/output_config in the body', async () => {
    const { fetch, requests } = fakeFetch(() => ({ body: message('{"message":"Noted.","tone":"firm"}') }));
    const sdk = new Anthropic({ apiKey: 'sk-test', dangerouslyAllowBrowser: true, fetch, maxRetries: 0 });
    const client = createClaudeClient({ sdkClient: sdk });
    const res = await client.complete({ apiKey: 'sk-test', system: 'sys', user: 'ctx', schema: OUTPUT_JSON_SCHEMAS.diplomacy });
    expect(res).toMatchObject({ stopReason: 'end_turn', text: '{"message":"Noted.","tone":"firm"}', fallbackUsed: false });
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.url).toMatch(/\/v1\/messages(\?.*)?$/);
    expect(req.headers.get('anthropic-beta')).toContain(SERVER_FALLBACK_BETA);
    // SDK 1.3.0 sends the key as `Authorization: Bearer <key>` (older SDKs used x-api-key).
    expect(req.headers.get('x-api-key') ?? req.headers.get('authorization')).toMatch(/sk-test$/);
    expect(req.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(req.body.fallbacks).toBe('default');
    expect(req.body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMAS.diplomacy } });
    expect(req.body).not.toHaveProperty('betas');
    expect(req.body).not.toHaveProperty('temperature');
    expect(req.body).not.toHaveProperty('thinking');
    expect(req.body.model).toBe('claude-opus-5-5');
  });

  it('surfaces a 401 as the SDK AuthenticationError, classified as auth', async () => {
    const { fetch } = fakeFetch(() => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }));
    const sdk = new Anthropic({ apiKey: 'sk-bad', dangerouslyAllowBrowser: true, fetch, maxRetries: 0 });
    const client = createClaudeClient({ sdkClient: sdk });
    const err = await client.complete({ apiKey: 'sk-bad', system: 's', user: 'u', schema: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(Anthropic.AuthenticationError);
    expect(classifyError(err)).toMatchObject({ kind: 'auth', message: 'API key rejected', blocksKey: true });
  });

  it('classifies SDK error classes, never by message text', () => {
    const h = new Headers();
    expect(classifyError(new Anthropic.RateLimitError(429, {}, 'slow down', h)).kind).toBe('rate_limit');
    expect(classifyError(new Anthropic.APIConnectionTimeoutError()).kind).toBe('timeout');
    expect(classifyError(new Anthropic.APIConnectionError({ message: 'down' })).kind).toBe('offline');
    expect(classifyError(new Anthropic.InternalServerError(529, {}, 'overloaded', h)).kind).toBe('server');
    expect(classifyError(new Anthropic.NotFoundError(404, {}, 'no such model', h))).toMatchObject({ kind: 'not_found', blocksKey: true });
    expect(classifyError(new Error('API key rejected')).kind).toBe('unknown');
  });

  it('reads refusals and fallback switch points', () => {
    const r = interpretResponse(message('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: null }, content: [] }));
    expect(r).toMatchObject({ stopReason: 'refusal', refusalCategory: 'cyber', text: '' });
    const f = interpretResponse(message('{}', { usage: { input_tokens: 1, output_tokens: 1, iterations: [{ type: 'fallback_message' }] } }));
    expect(f.fallbackUsed).toBe(true);
  });
});
