import { describe, expect, it } from 'vitest';
import { FOCUS, SCENE_H, SCENE_W, cropBox } from './frame.js';

describe('RegionScene framing', () => {
  it('shows the whole painting when the box is unmeasured or zero-sized', () => {
    for (const ar of [null, 0, -1, NaN, Infinity]) expect(cropBox(ar, FOCUS.road)).toEqual([0, 0, SCENE_W, SCENE_H]);
  });

  it('keeps the full width on wide boxes and crops height around the focus', () => {
    const [x0, y0, w, h] = cropBox(4, FOCUS.ruin);
    expect(x0).toBe(0);
    expect(w).toBe(SCENE_W);
    expect(h).toBe(100);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(y0 + h).toBeLessThanOrEqual(SCENE_H);
  });

  it('frames the focal point in the upper half of a portrait hero', () => {
    for (const focus of Object.values(FOCUS)) {
      const [x0, y0, w, h] = cropBox(1.2, focus);
      expect(w / h).toBeCloseTo(1.2, 1);
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(x0 + w).toBeLessThanOrEqual(SCENE_W + 0.1);
      expect(focus[0]).toBeGreaterThan(x0);
      expect(focus[0]).toBeLessThan(x0 + w);
      expect((focus[1] - y0) / h).toBeLessThan(0.6);
    }
  });

  it('never produces a degenerate box for extreme aspect ratios', () => {
    for (const ar of [0.05, 0.3, 1, 1.8181, 3, 40]) {
      const [, , w, h] = cropBox(ar, FOCUS.camp);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(Number.isFinite(w) && Number.isFinite(h)).toBe(true);
    }
  });
});
