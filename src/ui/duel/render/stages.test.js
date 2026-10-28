import { describe, expect, it } from 'vitest';
import { layout, stageFor, STAGES, createAtmosphere } from './stages.js';
import { lookFor } from './foes.js';

describe('duel stages', () => {
  it('every march beat, the trial and the yard have a stage', () => {
    expect(stageFor({ beat: 'checkpoint' })).toBe('checkpoint');
    expect(stageFor({ beat: 'wilds' })).toBe('wilds');
    expect(stageFor({ beat: 'ruin' })).toBe('ruin');
    expect(stageFor({ beat: 'champion' })).toBe('ford');
    expect(stageFor({ beat: 'skirmish' })).toBe('ford_winter');
    expect(stageFor({ beat: 'last_stand' })).toBe('siege');
    expect(stageFor({ beat: 'trial' })).toBe('circle');
    expect(stageFor({ modifiers: { stakes: 'drill' } })).toBe('yard');
    expect(stageFor({ stage: 'ruin', beat: 'wilds' })).toBe('ruin');
    expect(stageFor({})).toBe('circle');
  });

  it('never lays out at zero scale (painters step their loops by it)', () => {
    for (const [w, h] of [[0, 0], [1, 1], [0, 800], [390, 0]]) {
      const L = layout(w, h);
      expect(L.s).toBeGreaterThan(0.01);
      expect(L.w).toBeGreaterThan(0);
      expect(L.h).toBeGreaterThan(0);
    }
    expect(layout(390, 844).phone).toBe(true);
    expect(layout(1280, 800).phone).toBe(false);
  });

  it('every stage has scenery, light for the foe and an atmosphere', () => {
    const L = layout(390, 844);
    for (const [id, stage] of Object.entries(STAGES)) {
      expect(typeof stage.paint).toBe('function');
      for (const k of ['key', 'rim', 'shadow', 'back']) expect(stage.light[k]).toHaveLength(3);
      expect(stage.light.side === 1 || stage.light.side === -1).toBe(true);
      expect(createAtmosphere(id, L).length).toBeGreaterThan(0);
    }
  });

  it('dresses each named foe in their own look', () => {
    const look = (name, archetype = 'blade_adept') => lookFor({ title: name }, archetype);
    expect(look('Lieutenant Nyra Kell').head).toBe('pilot');
    expect(look('The Man in the Grey Coat').head).toBe('hood');
    expect(look('Sword-Master Ilvane').weapon).toBe('rapier');
    expect(look('General Corvin Drae').head).toBe('greathelm');
    expect(look('Captain Sable Ostrava').head).toBe('officer');
    expect(look('Anyone else').head).toBe('visor');
    expect(look('An Echo in a Crown', 'fallen_champion').spectral).toBe(true);
    expect(look('Greymane', 'warg_alpha').old).toBe(true);
    expect(look('Rimefang', 'warg_alpha').kind).toBe('warg');
  });
});
