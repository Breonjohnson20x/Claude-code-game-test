import { describe, it, expect } from 'vitest';
import {
  GENERATOR_NAMES,
  OUTPUT_JSON_SCHEMAS,
  normalizeOrderTarget,
  parseJsonLoose,
  repairOutput,
  validateOutput,
} from './schemas.js';

function walk(schema, visit) {
  visit(schema);
  if (schema.properties) Object.values(schema.properties).forEach((s) => walk(s, visit));
  if (schema.items) walk(schema.items, visit);
}

describe('wire schemas (structured outputs subset)', () => {
  it('covers every generator', () => {
    expect(GENERATOR_NAMES.sort()).toEqual(['campfire', 'character', 'chronicle', 'dialogue', 'diplomacy', 'event', 'narrative', 'orderInterpreter']);
  });

  it('closes every object and sends no size/range constraints', () => {
    for (const name of GENERATOR_NAMES) {
      walk(OUTPUT_JSON_SCHEMAS[name], (s) => {
        if (s.type === 'object') {
          expect(s.additionalProperties).toBe(false);
          expect(Array.isArray(s.required)).toBe(true);
        }
        for (const banned of ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'multipleOf']) {
          expect(s[banned]).toBeUndefined();
        }
      });
    }
    expect(OUTPUT_JSON_SCHEMAS.narrative.required).toEqual(['briefing']);
    expect(OUTPUT_JSON_SCHEMAS.narrative.properties.briefing.description).toMatch(/900 characters/);
    expect(OUTPUT_JSON_SCHEMAS.diplomacy.properties.tone.enum).toEqual(['conciliatory', 'firm', 'threatening', 'evasive']);
  });
});

describe('validate + repair', () => {
  it('accepts valid outputs as-is', () => {
    const out = { message: 'We have read your letter twice.', tone: 'firm' };
    expect(validateOutput('diplomacy', out).ok).toBe(true);
    expect(repairOutput('diplomacy', out)).toMatchObject({ ok: true, value: out, notes: [] });
  });

  it('truncates, trims arrays, drops bad items, clamps numbers, coerces types', () => {
    const r = repairOutput('narrative', {
      Briefing: `  ${'The ford is quiet. '.repeat(80)}  `,
      voices: [
        { speaker: 'Mara', text: 'Hold the line.' },
        { speaker: 'Vale' }, // no text → dropped
        { speaker: 'Cassian', text: 'Watch the river.' },
        { speaker: 'Sparky', text: '*steals a biscuit*' },
        { speaker: 'Mara', text: 'Again.' },
      ],
      extra: 'ignored',
    });
    expect(r.ok).toBe(true);
    expect(r.value.briefing.length).toBeLessThanOrEqual(900);
    expect(r.value.briefing.endsWith('…')).toBe(true);
    expect(r.value.voices.map((v) => v.speaker)).toEqual(['Mara', 'Cassian', 'Sparky']);
    expect(r.value.extra).toBeUndefined();
    expect(validateOutput('narrative', r.value).ok).toBe(true);

    const c = repairOutput('character', { name: 'Ilsa Varenne', age: '213', occupation: 'Ward-wright', personality: 'Patient', belief: 'Stone outlasts kings', fear: 'Fire', desire: 'A quiet forge' });
    expect(c.value.age).toBe(120);

    const o = repairOutput('orderInterpreter', {
      actions: [
        { category: 'Military', target: 'the southern border', covert: 'no', weight: 60 },
        { category: 'clandestine', target: 'Chancellor Vex', covert: 'yes', weight: '40%' },
        { category: 'cooking', covert: false, weight: 0.1 },
      ],
      summary: 'Reinforce the border; send Cassian’s agents across it in secret.',
    });
    expect(o.ok).toBe(true);
    expect(o.value.actions).toEqual([
      { category: 'military', target: 'iron_syndicate', covert: false, weight: 0.6 },
      { category: 'clandestine', target: 'iron_syndicate', covert: true, weight: 0.4 },
    ]);
  });

  it('splits a chronicle given as one string into paragraphs and unwraps a wrapper key', () => {
    const r = repairOutput('chronicle', { chronicle: { paragraphs: 'They held the ford.\n\nThe Wargs came anyway.' } });
    expect(r.ok).toBe(true);
    expect(r.value.paragraphs).toEqual(['They held the ford.', 'The Wargs came anyway.']);
  });

  it('reports irreparable outputs', () => {
    expect(repairOutput('dialogue', { lines: [] }).ok).toBe(false);
    expect(repairOutput('diplomacy', { message: 'Hm.', tone: 'jolly' }).ok).toBe(false);
    expect(repairOutput('orderInterpreter', 'reinforce').ok).toBe(false);
  });

  it('maps free-text targets to the parser vocabulary', () => {
    expect(normalizeOrderTarget('Queen Skaela')).toBe('frost_wargs');
    expect(normalizeOrderTarget('the refugee camps')).toBe('refugees');
    expect(normalizeOrderTarget('that broken circle')).toBe('mystery');
    expect(normalizeOrderTarget('iron_syndicate')).toBe('iron_syndicate');
    expect(normalizeOrderTarget('the moon')).toBeUndefined();
  });
});

describe('parseJsonLoose', () => {
  it('parses plain, fenced, prose-wrapped and trailing-comma JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonLoose('Here you go:\n```json\n{"a": [1, 2,],}\n```\nEnjoy.')).toMatchObject({ ok: true, value: { a: [1, 2] } });
    expect(parseJsonLoose('Sure! {"x": "a } inside", "y": {"z": true}} trailing words')).toMatchObject({ ok: true, value: { x: 'a } inside', y: { z: true } } });
  });

  it('salvages output cut off by max_tokens', () => {
    const cut = '{"paragraphs": ["They held the ford.", "The Wargs came anyw';
    const r = parseJsonLoose(cut);
    expect(r.ok).toBe(true);
    expect(r.value.paragraphs[0]).toBe('They held the ford.');
    const r2 = parseJsonLoose('{"lines": [{"speaker": "Mara", "text": "Sleep."}, {"speaker": "Va');
    expect(r2.ok).toBe(true);
    expect(r2.value.lines[0]).toEqual({ speaker: 'Mara', text: 'Sleep.' });
  });

  it('rejects text with no JSON', () => {
    expect(parseJsonLoose('I cannot help with that.').ok).toBe(false);
    expect(parseJsonLoose('').ok).toBe(false);
    expect(parseJsonLoose(null).ok).toBe(false);
  });
});
