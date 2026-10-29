// Framing for RegionScene: which part of the 400x220 painting a box shows.
// Pure maths so it can be tested; a 0x0 or unmeasured box gets the full frame.
import { clamp } from '../util.js';

export const SCENE_W = 400;
export const SCENE_H = 220;

const W = SCENE_W;
const H = SCENE_H;

// Focal point per beat (viewBox units). When the container is narrower than
// 400:220 (a portrait phone hero) we zoom in a little and frame around this
// point, placing it in the upper half of the box: hero banners lay their title
// over the lower half. The frame may overscan past the painted bottom edge into
// the fade, which ends in the page colour.
export const FOCUS = {
  road: [256, 108],
  checkpoint: [262, 126],
  wilds: [238, 134],
  ruin: [208, 128],
  champion: [222, 138],
  camp: [198, 150],
};
// Card crops frame the beat's set piece itself (the keep on the road, where the
// palisade, wreckage and smoke that show the region state also sit).
export const CARD_FOCUS = {
  road: [300, 118],
};
const NARROW_ZOOM = 0.86;
const FOCUS_AT = 0.42;
const OVERSCAN = 26;

// Card crops (opt-in): a short, wide card (a report or dossier header) would
// show the whole 400-wide painting as a thin strip with the focus pinned to the
// right edge. `card` zooms in so the scene holds a readable band and puts the
// focal point at `cardAt` across, clear of right-hand chips.
const CARD_W = 290;

export function cropBox(ar, [fx, fy], { card = false, cardAt = 0.6 } = {}) {
  if (!ar || !Number.isFinite(ar) || ar <= 0) return [0, 0, W, H];
  if (card && ar > W / H) {
    const w = CARD_W;
    const h = Math.max(40, w / ar);
    const x0 = clamp(fx - w * cardAt, 0, W - w);
    const y0 = clamp(fy - h * 0.48, 0, H - h);
    return [Math.round(x0 * 10) / 10, Math.round(y0 * 10) / 10, w, Math.round(h * 10) / 10];
  }
  let w = W;
  let h = H;
  let y0;
  if (ar < W / H) {
    // narrow: zoom in, keep the focal point in the upper half
    h = H * NARROW_ZOOM;
    w = h * ar;
    if (w > W) {
      w = W;
      h = W / ar;
    }
    w = Math.max(60, w);
    y0 = clamp(fy - h * FOCUS_AT, 0, H - h + OVERSCAN);
  } else {
    h = Math.max(40, W / ar);
    y0 = clamp(fy - h / 2, 0, H - h);
  }
  const x0 = clamp(fx - w / 2, 0, W - w);
  return [Math.round(x0 * 10) / 10, Math.round(y0 * 10) / 10, Math.round(w * 10) / 10, Math.round(h * 10) / 10];
}
