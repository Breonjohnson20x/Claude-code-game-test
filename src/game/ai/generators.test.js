// Generator pipeline tests. The SDK client is always a mock — these never touch the network.
import { describe, it, expect, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { createNewGame } from '../core/state.js';
import { applyEffects } from '../core/effects.js';
import { createMemoryStorage } from '../save/storage.js';
import { createGenerators, normalizeOrderWeights } from './generators.js';
import { createAiStatus } from './status.js';
import { createAiCache } from './cache.js';
import { SERVER_FALLBACK_BETA } from './client.js';

const ON = { aiEnabled: true, apiKey: 'sk-ant-test', aiBudget: 25 };

function reply(payload, { stop = 'end_turn' } = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) },
    ],
    stop_reason: stop,
    stop_details: stop === 'refusal' ? { type: 'refusal', category: 'general_harms', explanation: null } : null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/** Mock Anthropic client: each create() pops the next scripted response (or throws it). */
function mockSdk(...script) {
  const create = vi.fn(async () => {
    if (!script.length) throw new Error('mock exhausted');
    const next = script.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return { create, sdk: { beta: { messages: { create } }, messages: { create } } };
}

function setup({ settings = ON, script = [], storage = createMemoryStorage(), fallbacks } = {}) {
  const { create, sdk } = mockSdk(...script);
  const status = createAiStatus();
  const s = { ...settings };
  const gens = createGenerators({ getSettings: () => s, client: sdk, storage, status, fallbacks });
  return { gens, create, status, settings: s, storage };
}

const state = createNewGame({ seed: 5 });
const briefingFallback = vi.fn(() => ({ briefing: 'The Council waits on your word, Majesty.' }));
const GOOD_BRIEFING = { briefing: 'Walkers idle at Greywater Ford. Mara wants the line held; Cassian wants it watched.', voices: [{ speaker: 'Mara', text: 'Hold the ford.' }] };

describe('fallback paths', () => {
  it('uses the authored fallback when AI is disabled or no key is set — and never calls the API', async () => {
    const { gens, create } = setup({ settings: { aiEnabled: false, apiKey: 'sk' } });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r).toEqual({ ok: true, output: { briefing: 'The Council waits on your word, Majesty.' }, source: 'fallback', proposals: [], rejected: [], error: 'disabled' });
    const noKey = setup({ settings: { aiEnabled: true, apiKey: '  ' } });
    expect((await noKey.gens.narrative({ state }, briefingFallback)).error).toBe('no_key');
    expect(create).not.toHaveBeenCalled();
    expect(noKey.create).not.toHaveBeenCalled();
  });

  it('uses fallbacks registered at construction when none is passed per call', async () => {
    const { gens } = setup({ settings: { aiEnabled: false }, fallbacks: { diplomacy: () => ({ message: 'The Chancellor regrets nothing.', tone: 'firm' }) } });
    expect((await gens.diplomacy({ state, faction: 'iron_syndicate' })).output.tone).toBe('firm');
  });

  it('returns ok:false only when the fallback is missing or throws', async () => {
    const { gens } = setup({ settings: { aiEnabled: false } });
    expect(await gens.event({ state })).toMatchObject({ ok: false, output: null, source: 'fallback' });
    const boom = await gens.event({ state }, () => {
      throw new Error('authored table missing');
    });
    expect(boom).toMatchObject({ ok: false, output: null, source: 'fallback', error: 'disabled' });
    expect(boom.detail).toMatch(/authored table missing/);
  });
});

describe('AI path', () => {
  it('valid output → source ai, with the documented request shape', async () => {
    const { gens, create, status } = setup({ script: [reply(GOOD_BRIEFING)] });
    const r = await gens.narrative({ state, beat: 'turn_briefing' }, briefingFallback);
    expect(r).toMatchObject({ ok: true, source: 'ai', output: GOOD_BRIEFING, proposals: [], rejected: [] });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.betas).toEqual([SERVER_FALLBACK_BETA]);
    expect(params.fallbacks).toBe('default');
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.output_config.format.schema.required).toEqual(['briefing']);
    expect(params.max_tokens).toBe(1500);
    for (const banned of ['temperature', 'top_p', 'top_k', 'thinking']) expect(params).not.toHaveProperty(banned);
    expect(options).toEqual({ timeout: 20000, maxRetries: 1 });
    expect(params.system).toMatch(/Every civilization is somebody's home/);
    expect(params.system).toMatch(/Mara Voss/);
    expect(status.get()).toMatchObject({ callsThisSession: 1, enabled: true, lastSource: 'ai' });
    expect(briefingFallback).not.toHaveBeenCalled();
  });

  it('honors a user-chosen model id from settings', async () => {
    const { gens, create } = setup({ settings: { ...ON, model: 'claude-sonnet-5-5' }, script: [reply(GOOD_BRIEFING)] });
    await gens.narrative({ state }, briefingFallback);
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
  });

  it('sends compact context, not the whole GameState, and keeps hidden lore out', async () => {
    const { gens, create } = setup({ script: [reply(GOOD_BRIEFING)] });
    await gens.narrative({ state }, briefingFallback);
    const { messages, system } = create.mock.calls[0][0];
    const user = messages[0].content;
    expect(user.length).toBeLessThan(JSON.stringify(state).length / 2);
    expect(user).not.toMatch(/rngSeed|"trust"|1400|FIRST_ARCHITECTS_MYSTERY|A Broken Circle/);
    expect(user).toMatch(/Walkers on the Southern Border/);
    expect(user).toMatch(/"treasury":"steady"/);
    expect(system).not.toMatch(/Winter Heart/);

    const revealed = setup({ script: [reply(GOOD_BRIEFING)] });
    await revealed.gens.narrative({ state: { ...state, flags: { winterHeartRevealed: true } } }, briefingFallback);
    expect(revealed.create.mock.calls[0][0].system).toMatch(/Winter Heart/);
  });

  it('invalid output → repair succeeds without a second call', async () => {
    const messy = `Certainly, Majesty. Here is the briefing:\n\`\`\`json\n${JSON.stringify({
      briefing: 'The ford holds. '.repeat(90),
      voices: [1, 2, 3, 4].map((i) => ({ speaker: 'Mara', text: `Line ${i}` })),
      mood: 'grim',
    })}\n\`\`\``;
    const { gens, create } = setup({ script: [reply(messy)] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r.source).toBe('ai');
    expect(r.output.briefing.length).toBeLessThanOrEqual(900);
    expect(r.output.voices).toHaveLength(3);
    expect(r.output.mood).toBeUndefined();
    expect(r.repairs.length).toBeGreaterThan(0);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('irreparable output → retries exactly once → fallback', async () => {
    const { gens, create, status } = setup({ script: [reply('The walkers are restless tonight.'), reply({ wrong: true })] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r).toMatchObject({ ok: true, source: 'fallback', error: 'invalid' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content).toMatch(/previous reply could not be used/);
    expect(status.get().callsThisSession).toBe(2);
  });

  it('a bad first reply followed by a good retry → source ai', async () => {
    const { gens, create } = setup({ script: [reply('no json here'), reply(GOOD_BRIEFING)] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('max_tokens: salvages a truncated reply when possible, otherwise retries with more room', async () => {
    const cut = '{"paragraphs": ["Aurelian held the ford and fed the camps.", "The Wargs came anyw';
    const ok = setup({ script: [reply(cut, { stop: 'max_tokens' })] });
    const r = await ok.gens.chronicle({ state }, () => ({ paragraphs: ['…'] }));
    expect(r.source).toBe('ai');
    expect(r.output.paragraphs[0]).toBe('Aurelian held the ford and fed the camps.');

    const bad = setup({ script: [reply('{"paragr', { stop: 'max_tokens' }), reply({ paragraphs: ['Short and whole.'] })] });
    const r2 = await bad.gens.chronicle({ state }, () => ({ paragraphs: ['…'] }));
    expect(r2.source).toBe('ai');
    expect(bad.create.mock.calls[1][0].max_tokens).toBe(3000);
  });

  it('thrown SDK errors → fallback, no extra semantic retry', async () => {
    const h = new Headers();
    const cases = [
      [new Anthropic.RateLimitError(429, {}, 'slow down', h), 'rate_limit'],
      [new Anthropic.APIConnectionError({ message: 'offline' }), 'offline'],
      [new Anthropic.APIConnectionTimeoutError(), 'timeout'],
      [new Anthropic.InternalServerError(500, {}, 'oops', h), 'server'],
      [new TypeError('boom'), 'unknown'],
    ];
    for (const [err, kind] of cases) {
      const { gens, create, status } = setup({ script: [err] });
      const r = await gens.narrative({ state }, briefingFallback);
      expect(r).toMatchObject({ ok: true, source: 'fallback', error: kind });
      expect(create).toHaveBeenCalledTimes(1);
      expect(status.get().lastErrorKind).toBe(kind);
    }
  });

  it('refusal stop_reason → fallback without reading content or retrying', async () => {
    const { gens, create } = setup({ script: [reply(GOOD_BRIEFING, { stop: 'refusal' })] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r).toMatchObject({ source: 'fallback', error: 'refusal', detail: 'general_harms' });
    expect(r.output).toEqual({ briefing: 'The Council waits on your word, Majesty.' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('AuthenticationError flips status to "API key rejected" and stops calling until the key changes', async () => {
    const auth = new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid' } }, 'invalid', new Headers());
    const { gens, create, status, settings } = setup({ script: [auth, reply(GOOD_BRIEFING)] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r).toMatchObject({ source: 'fallback', error: 'auth' });
    expect(status.get()).toMatchObject({ keyRejected: true, enabled: false, lastError: 'API key rejected', lastErrorKind: 'auth' });

    const again = await gens.narrative({ state, focus: 'something else' }, briefingFallback);
    expect(again).toMatchObject({ source: 'fallback', error: 'auth' });
    expect(create).toHaveBeenCalledTimes(1);

    settings.apiKey = 'sk-ant-new-key';
    const fresh = await gens.narrative({ state }, briefingFallback);
    expect(fresh.source).toBe('ai');
    expect(gens.getStatus()).toMatchObject({ keyRejected: false, enabled: true, lastError: null });
  });
});

describe('cost control', () => {
  it('caches by compact context: the second identical request is free, even across instances', async () => {
    const storage = createMemoryStorage();
    const { gens, create } = setup({ script: [reply(GOOD_BRIEFING)], storage });
    expect((await gens.narrative({ state }, briefingFallback)).source).toBe('ai');
    const second = await gens.narrative({ state }, briefingFallback);
    expect(second).toMatchObject({ source: 'cache', output: GOOD_BRIEFING });
    expect(create).toHaveBeenCalledTimes(1);

    const other = setup({ script: [], storage });
    expect((await other.gens.narrative({ state }, briefingFallback)).source).toBe('cache');
    expect(other.create).not.toHaveBeenCalled();

    // A different moment is a different context → a new call.
    const later = setup({ script: [reply(GOOD_BRIEFING)], storage });
    expect((await later.gens.narrative({ state: { ...state, turn: 2 } }, briefingFallback)).source).toBe('ai');
  });

  it('dedupes identical in-flight requests', async () => {
    const { gens, create } = setup({ script: [reply(GOOD_BRIEFING)] });
    const [a, b] = await Promise.all([gens.narrative({ state }, briefingFallback), gens.narrative({ state }, briefingFallback)]);
    expect(a.source).toBe('ai');
    expect(b.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stops calling once the session budget is spent', async () => {
    const { gens, create, status } = setup({ settings: { ...ON, aiBudget: 2 }, script: [reply(GOOD_BRIEFING), reply(GOOD_BRIEFING), reply(GOOD_BRIEFING)] });
    expect((await gens.narrative({ state, focus: 'a' }, briefingFallback)).source).toBe('ai');
    expect((await gens.narrative({ state, focus: 'b' }, briefingFallback)).source).toBe('ai');
    const third = await gens.narrative({ state, focus: 'c' }, briefingFallback);
    expect(third).toMatchObject({ source: 'fallback', error: 'budget' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(status.get()).toMatchObject({ callsThisSession: 2, budget: 2, remaining: 0, lastErrorKind: 'budget' });
    // Cached moments still work after the budget is gone.
    expect((await gens.narrative({ state, focus: 'a' }, briefingFallback)).source).toBe('cache');
  });

  it('the budget also caps the retry', async () => {
    const { gens, create } = setup({ settings: { ...ON, aiBudget: 1 }, script: [reply('nope'), reply(GOOD_BRIEFING)] });
    const r = await gens.narrative({ state }, briefingFallback);
    expect(r).toMatchObject({ source: 'fallback', error: 'invalid' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('caps the cache at ~100 entries, evicting least recently used', () => {
    const cache = createAiCache({ storage: createMemoryStorage(), cap: 3 });
    cache.set('a', { n: 1 });
    cache.set('b', { n: 2 });
    cache.set('c', { n: 3 });
    expect(cache.get('a')).toEqual({ n: 1 }); // touch a
    cache.set('d', { n: 4 });
    expect(cache.keys().sort()).toEqual(['a', 'c', 'd']);
  });
});

describe('proposals never bypass the simulation', () => {
  it('AI proposals outside allowed types/caps are rejected or clamped by validateEffects', async () => {
    const campfire = {
      lines: [
        { speaker: 'Mara', text: 'You could have ordered the charge. You didn’t. They noticed.' },
        { speaker: 'Sparky', text: '*curls against Mara’s boot, steaming faintly*' },
      ],
      proposals: [
        { type: 'relationship', character: 'mara', trust: 40 },
        { type: 'resource', key: 'treasury', delta: 5000 },
        { type: 'flag', key: 'mara_loyal_forever', value: true },
        { type: 'relationship', character: 'emperor_zed', trust: 2 },
        { type: 'memory', character: 'mara', eventId: 'NO_CHARGE', description: 'The Sovereign refused a needless charge.', sentiment: 0.8 },
      ],
    };
    const { gens } = setup({ script: [reply(campfire)] });
    const frozen = JSON.stringify(state);
    const r = await gens.campfire({ state, participants: ['mara', 'sparky'] }, () => ({ lines: [{ speaker: 'Narrator', text: 'The fire pops.' }] }));
    expect(r.source).toBe('ai');
    expect(r.output.proposals).toBeUndefined();
    expect(r.output.lines).toHaveLength(2);
    expect(r.proposals).toEqual([
      { type: 'relationship', character: 'mara', trust: 5 },
      { type: 'resource', key: 'treasury', delta: 150 },
    ]);
    // Schema repair trims to MAX_PROPOSALS first (recorded in r.repairs, never silent);
    // the simulation validator then rejects what is left over.
    expect(r.repairs.some((n) => /proposals: trimmed to 3 items/.test(n))).toBe(true);
    expect(r.rejected.map((x) => x.reason)).toEqual(['AI generators may not request "flag" effects']);
    expect(JSON.stringify(state)).toBe(frozen); // generators never mutate state
    const next = applyEffects(state, r.proposals);
    expect(next.characters.mara.rel.trust).toBe(state.characters.mara.rel.trust + 5);
  });

  it('cached proposals are re-validated against the current state', async () => {
    const storage = createMemoryStorage();
    const event = { headline: 'Smoke over Greywater', text: 'A depot burns south of the ford.', proposals: [{ type: 'intensity', delta: 30, reason: 'smoke' }] };
    const { gens } = setup({ script: [reply(event)], storage });
    const first = await gens.event({ state, kind: 'border' }, () => null);
    expect(first.proposals).toEqual([{ type: 'intensity', delta: 5, reason: 'smoke' }]);
    const second = await gens.event({ state, kind: 'border' }, () => null);
    expect(second).toMatchObject({ source: 'cache', proposals: [{ type: 'intensity', delta: 5, reason: 'smoke' }] });
  });
});

describe('orderInterpreter (custom orders, §18)', () => {
  const order = 'I want to reinforce the border but secretly send Cassian’s agents across it.';
  const parser = vi.fn(() => ({ actions: [{ category: 'military', target: 'iron_syndicate', covert: false, weight: 1 }], summary: 'Interpreted as: military.', confidence: 0.5, understood: true }));

  it('turns AI output into the parser’s action shape with sim-capped weights', async () => {
    const ai = {
      actions: [
        { category: 'military', target: 'the southern border', covert: false, weight: 1 },
        { category: 'clandestine', target: 'Iron Syndicate', covert: 'true', weight: 1 },
      ],
      summary: 'Reinforce the border; send Cassian’s agents across it in secret.',
    };
    const { gens, create } = setup({ script: [reply(ai)] });
    const r = await gens.orderInterpreter({ state, text: order }, parser);
    expect(r.source).toBe('ai');
    expect(r.output).toEqual({
      actions: [
        { category: 'military', target: 'iron_syndicate', covert: false, weight: 0.6 },
        { category: 'clandestine', target: 'iron_syndicate', covert: true, weight: 0.6 },
      ],
      summary: 'Reinforce the border; send Cassian’s agents across it in secret.',
      understood: true,
      confidence: 0.8,
    });
    expect(create.mock.calls[0][0].messages[0].content).toContain('reinforce the border but secretly');
    expect(parser).not.toHaveBeenCalled();
  });

  it('falls back to the rule-based parser when AI is unavailable', async () => {
    const { gens } = setup({ settings: { aiEnabled: false } });
    const r = await gens.orderInterpreter({ state, text: order }, parser);
    expect(r).toMatchObject({ source: 'fallback', error: 'disabled', output: { summary: 'Interpreted as: military.' } });
    expect(parser).toHaveBeenCalledWith({ state, text: order });
  });

  it('missing order text skips the API and uses the parser', async () => {
    const { gens, create } = setup({ script: [reply({})] });
    const r = await gens.orderInterpreter({ state, text: '' }, parser);
    expect(r).toMatchObject({ source: 'fallback', error: 'context' });
    expect(create).not.toHaveBeenCalled();
  });

  it('weight normalization keeps emphasis and never exceeds the parser’s effort total', () => {
    const w = normalizeOrderWeights([
      { category: 'military', weight: 0.75 },
      { category: 'clandestine', weight: 0.25 },
    ]).map((a) => a.weight);
    expect(w).toEqual([0.9, 0.3]);
    expect(normalizeOrderWeights([{ category: 'economic', weight: 0.2 }])[0].weight).toBe(1);
  });
});

describe('every generator', () => {
  const samples = {
    narrative: GOOD_BRIEFING,
    campfire: { lines: [{ speaker: 'Vale', text: 'Magic is physics that refuses to explain itself.' }] },
    dialogue: { lines: [{ speaker: 'Cassian', text: 'You already know what I am going to say.' }] },
    diplomacy: { message: 'Chancellor Vex thanks Your Majesty for the restraint at the ford.', tone: 'conciliatory' },
    character: { name: 'Corvin Halde', age: 34, occupation: 'Ward engineer', personality: 'Meticulous, wry', belief: 'Every ward is a promise.', fear: 'That the lattice fails on his watch.', desire: 'To see his daughter’s school rebuilt.' },
    event: { headline: 'Lights under Greywater', text: 'Fishermen report a slow pale glow beneath the ford.' },
    chronicle: { paragraphs: ['They will say Aurelian held the ford without a massacre.'] },
  };
  const contexts = {
    dialogue: { state, character: 'cassian', playerLine: 'Speak plainly.' },
    diplomacy: { state, faction: 'iron_syndicate', playerStance: 'firm' },
    character: { state, role: 'walker mechanic', origin: 'Iron Syndicate' },
  };
  for (const [name, sample] of Object.entries(samples)) {
    it(`${name}: AI → validated output`, async () => {
      const { gens } = setup({ script: [reply(sample)] });
      const r = await gens[name](contexts[name] ?? { state }, () => null);
      expect(r).toMatchObject({ ok: true, source: 'ai', output: sample });
    });
  }
});
