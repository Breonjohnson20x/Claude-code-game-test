// Procedural PBR material textures for the first-person mode. Nothing is loaded: every map
// (albedo, normal, roughness/metalness) is computed from tileable noise when the mission loads.
//
// Each recipe is a function of (u, v) in 0..1 returning height, colour, roughness and metalness;
// `bake` turns it into three tiling textures. Normals come from the height field.

import * as THREE from 'three';

// ───────────────────────────────────────────────────────────── tileable noise

function hash(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => fade(clamp01((x - a) / (b - a)));

/** Value noise that repeats every `period` cells. */
function pnoise(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const x0 = mod(ix, period);
  const x1 = mod(ix + 1, period);
  const y0 = mod(iy, period);
  const y1 = mod(iy + 1, period);
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Tileable fractal noise over the unit square. */
function pfbm(u, v, period, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = period;
  for (let i = 0; i < octaves; i += 1) {
    sum += pnoise(u * p, v * p, p, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

const CELL = { d1: 0, d2: 0, id: 0 };
/** Tileable cellular noise: distance to the nearest and second nearest feature point. */
function pcell(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const cx = mod(ix + ox, period);
      const cy = mod(iy + oy, period);
      const px = ix + ox + hash(cx, cy, seed);
      const py = iy + oy + hash(cx, cy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash(cx, cy, seed + 13);
      } else if (d < d2) d2 = d;
    }
  }
  CELL.d1 = d1;
  CELL.d2 = d2;
  CELL.id = id;
  return CELL;
}

// ───────────────────────────────────────────────────────────── baking

const OUT = { h: 0, r: 0, g: 0, b: 0, rough: 1, metal: 0 };

function makeTexture(data, size, srgb, anisotropy) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Run a recipe over a size×size grid and build { map, normalMap, ormMap }. */
function bake(size, recipe, normalStrength = 2, anisotropy = 4) {
  const n = size * size;
  const height = new Float32Array(n);
  const albedo = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      OUT.rough = 1;
      OUT.metal = 0;
      recipe(x / size, y / size, OUT);
      height[i] = OUT.h;
      albedo[i * 4] = clamp01(OUT.r) * 255;
      albedo[i * 4 + 1] = clamp01(OUT.g) * 255;
      albedo[i * 4 + 2] = clamp01(OUT.b) * 255;
      albedo[i * 4 + 3] = 255;
      orm[i * 4] = 255;
      orm[i * 4 + 1] = clamp01(OUT.rough) * 255;
      orm[i * 4 + 2] = clamp01(OUT.metal) * 255;
      orm[i * 4 + 3] = 255;
    }
  }
  const normal = new Uint8Array(n * 4);
  const k = normalStrength * size * 0.012;
  for (let y = 0; y < size; y += 1) {
    const ym = mod(y - 1, size) * size;
    const yp = mod(y + 1, size) * size;
    for (let x = 0; x < size; x += 1) {
      const xm = mod(x - 1, size);
      const xp = mod(x + 1, size);
      const dx = (height[y * size + xp] - height[y * size + xm]) * k;
      const dy = (height[yp + x] - height[ym + x]) * k;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      normal[i] = (-dx * inv * 0.5 + 0.5) * 255;
      normal[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      normal[i + 2] = (inv * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
    }
  }
  return { map: makeTexture(albedo, size, true, anisotropy), normalMap: makeTexture(normal, size, false, anisotropy), ormMap: makeTexture(orm, size, false, anisotropy) };
}

const tint = (o, r, g, b, k) => {
  o.r = r * k;
  o.g = g * k;
  o.b = b * k;
};

// ───────────────────────────────────────────────────────────── recipes

const RECIPES = {
  // coursed rubble masonry: staggered blocks, recessed mortar, weathering
  stone(u, v, o) {
    const rows = 6;
    const row = Math.floor(v * rows);
    const cols = 4;
    const off = (row % 2) * 0.5 + hash(row, 3, 5) * 0.2;
    const cu = u * cols + off;
    const col = Math.floor(cu);
    const fu = cu - col;
    const fv = v * rows - row;
    const edge = Math.min(fu, 1 - fu) * (1 / cols) * 6 < Math.min(fv, 1 - fv) * (1 / rows) * 6 ? Math.min(fu, 1 - fu) * 1.5 : Math.min(fv, 1 - fv);
    const wob = (pfbm(u, v, 16, 2, 51) - 0.5) * 0.08;
    const mortar = smooth(0.015, 0.075, Math.min(Math.min(fu, 1 - fu) * 1.5, Math.min(fv, 1 - fv)) + wob);
    void edge;
    const id = hash(mod(col, cols), row, 9);
    const grain = pfbm(u, v, 8, 5, 3);
    const pits = pfbm(u, v, 32, 3, 17);
    o.h = mortar * (0.55 + id * 0.25 + grain * 0.35) + pits * 0.08;
    const tone = 0.3 + id * 0.16 + grain * 0.2;
    const moss = smooth(0.58, 0.8, pfbm(u, v, 4, 4, 41)) * (1 - fv) * 0.5;
    tint(o, lerp(0.8, 0.6, moss), lerp(0.79, 0.76, moss), lerp(0.77, 0.52, moss), lerp(tone * 0.72, tone, mortar));
    o.rough = lerp(0.95, 0.78, mortar * grain);
  },
  // big dressed quay stones for the depot
  ashlar(u, v, o) {
    const rows = 2;
    const row = Math.floor(v * rows);
    const cu = u * 2 + (row % 2) * 0.5;
    const fu = cu - Math.floor(cu);
    const fv = v * rows - row;
    const joint = smooth(0.006, 0.028, Math.min(Math.min(fu, 1 - fu), Math.min(fv, 1 - fv) * 0.5));
    const grain = pfbm(u, v, 6, 6, 12);
    const chips = smooth(0.62, 0.7, pfbm(u, v, 24, 3, 77));
    o.h = joint * (0.7 + grain * 0.3) - chips * 0.12;
    const tone = 0.34 + grain * 0.2 + hash(Math.floor(cu) % 2, row, 4) * 0.06;
    tint(o, 0.74, 0.75, 0.76, lerp(tone * 0.7, tone, joint));
    o.rough = 0.82 + grain * 0.12;
  },
  // packed road dirt with cart ruts and pebbles
  road(u, v, o) {
    const base = pfbm(u, v, 5, 6, 21);
    const c = pcell(u, v, 22, 5);
    const pebble = smooth(0.34, 0.12, c.d1) * (c.id > 0.55 ? 1 : 0);
    const rut = Math.pow(Math.abs(Math.sin((u + pfbm(u, v, 3, 2, 8) * 0.06) * Math.PI * 2)), 6) * 0.25;
    o.h = base * 0.6 + pebble * 0.5 - rut;
    const tone = 0.62 + base * 0.5;
    tint(o, lerp(0.43, 0.5, pebble), lerp(0.36, 0.48, pebble), lerp(0.27, 0.46, pebble), tone);
    o.rough = lerp(0.96, 0.75, pebble);
  },
  // neutral ground detail: multiplied by the terrain's painted vertex colours
  ground(u, v, o) {
    const a = pfbm(u, v, 6, 6, 2);
    const fine = pfbm(u, v, 48, 3, 9);
    const clump = smooth(0.4, 0.75, pfbm(u, v, 10, 4, 55));
    const grit = smooth(0.7, 0.9, pfbm(u, v, 64, 2, 31));
    o.h = a * 0.6 + fine * 0.25 + clump * 0.25 + grit * 0.12;
    const k = 0.66 + a * 0.34 + fine * 0.16 - clump * 0.1 + grit * 0.1;
    tint(o, 1, 1, 1, k);
    o.rough = 0.95 - grit * 0.1;
  },
  // sawn planks: board joints, long grain, knots, nail heads
  wood(u, v, o) {
    const boards = 4;
    const b = Math.floor(u * boards);
    const fu = u * boards - b;
    const joint = smooth(0.0, 0.06, Math.min(fu, 1 - fu));
    const vv = v + hash(b, 1, 3) * 0.7;
    const grain = pfbm(u * 6, vv, 3, 5, 14 + b) * 0.6 + pnoise(u * 90, vv * 5, 5, 6 + b) * 0.4;
    const kn = pcell(u * 2, vv * 0.6, 3, 40 + b);
    const knot = smooth(0.16, 0.05, kn.d1) * (kn.id > 0.7 ? 1 : 0);
    const end = Math.abs(mod(vv * 1.0 + hash(b, 2, 8), 1) - 0.5) < 0.006 ? 0 : 1;
    o.h = joint * end * (0.6 + grain * 0.4) - knot * 0.15;
    const tone = (0.4 + grain * 0.36 + hash(b, 5, 2) * 0.14) * lerp(0.4, 1, joint * end) * lerp(1, 0.55, knot);
    tint(o, 0.5, 0.41, 0.32, tone * 0.82);
    o.rough = 0.8 + grain * 0.15;
  },
  // pine bark: deep vertical furrows
  bark(u, v, o) {
    const warp = pfbm(u, v, 4, 3, 5) * 0.12;
    const ridge = Math.abs(pnoise((u + warp) * 14, v * 3, 14, 3) - 0.5) * 2;
    const fine = pfbm(u, v, 24, 3, 8);
    o.h = ridge * 0.8 + fine * 0.2;
    const tone = 0.22 + ridge * 0.3 + fine * 0.12;
    tint(o, 0.55, 0.42, 0.33, tone);
    o.rough = 0.95;
  },
  // woven canvas for tents, wagon covers and sandbags
  canvas(u, v, o) {
    const wx = Math.sin(u * Math.PI * 2 * 64);
    const wy = Math.sin(v * Math.PI * 2 * 64);
    const weave = wx * wy * 0.5 + 0.5;
    const stain = pfbm(u, v, 4, 5, 23);
    const fold = pfbm(u * 0.5, v, 3, 3, 4);
    o.h = weave * 0.25 + fold * 0.75;
    const tone = 0.55 + weave * 0.1 + stain * 0.3 - smooth(0.6, 0.85, stain) * 0.2;
    tint(o, 0.74, 0.68, 0.55, tone);
    o.rough = 0.94;
  },
  // Syndicate plate: riveted iron panels, scratches, rust in the seams
  plate(u, v, o) {
    const px = u * 2;
    const py = v * 2;
    const fx = px - Math.floor(px);
    const fy = py - Math.floor(py);
    const seamD = Math.min(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy));
    const seam = smooth(0.0, 0.025, seamD);
    const rx = mod(fx * 6, 1) - 0.5;
    const ry = mod(fy * 6, 1) - 0.5;
    const onRim = fx < 0.085 || fx > 0.915 || fy < 0.085 || fy > 0.915;
    const rivet = onRim ? smooth(0.2, 0.08, Math.hypot(rx, ry)) : 0;
    const wear = pfbm(u, v, 6, 5, 61);
    const scratch = smooth(0.78, 0.86, pnoise(u * 3, v * 70, 3, 19)) * 0.5;
    const rust = smooth(0.5, 0.78, wear) * smooth(0.25, 0.0, seamD) + smooth(0.74, 0.9, wear) * 0.6;
    o.h = seam * 0.6 + rivet * 0.5 - scratch * 0.05 + wear * 0.08;
    const steel = 0.3 + wear * 0.14 + scratch * 0.2;
    o.r = lerp(steel * 0.92, 0.36, rust);
    o.g = lerp(steel * 0.95, 0.2, rust);
    o.b = lerp(steel, 0.12, rust);
    const dark = lerp(0.4, 1, seam);
    o.r *= dark;
    o.g *= dark;
    o.b *= dark;
    o.rough = lerp(0.42 + wear * 0.2 - scratch * 0.2, 0.92, rust);
    o.metal = lerp(1, 0.15, rust);
  },
  // Elvian brass: brushed, warm, a little tarnish
  brass(u, v, o) {
    const brush = pnoise(u * 4, v * 160, 4, 9) * 0.6 + pnoise(u * 2, v * 60, 2, 3) * 0.4;
    const tarnish = smooth(0.5, 0.8, pfbm(u, v, 5, 4, 71));
    o.h = brush * 0.3;
    const k = 0.72 + brush * 0.25;
    o.r = lerp(0.95, 0.42, tarnish) * k;
    o.g = lerp(0.72, 0.36, tarnish) * k;
    o.b = lerp(0.36, 0.24, tarnish) * k;
    o.rough = lerp(0.3 + brush * 0.12, 0.7, tarnish);
    o.metal = lerp(1, 0.6, tarnish);
  },
  // blued gun steel
  gunmetal(u, v, o) {
    const brush = pnoise(u * 3, v * 140, 3, 27);
    const wear = smooth(0.62, 0.85, pfbm(u, v, 6, 4, 33));
    o.h = brush * 0.2 + wear * 0.1;
    const k = 0.3 + brush * 0.08 + wear * 0.3;
    o.r = k * 0.97;
    o.g = k * 0.98;
    o.b = k * 1.02;
    o.rough = lerp(0.38, 0.24, wear) + brush * 0.1;
    o.metal = 1;
  },
  // slate shingles in overlapping courses
  slate(u, v, o) {
    const rows = 7;
    const row = Math.floor(v * rows);
    const fv = v * rows - row;
    const cu = u * 6 + (row % 2) * 0.5;
    const fu = cu - Math.floor(cu);
    const id = hash(mod(Math.floor(cu), 6), row, 6);
    const gap = smooth(0.0, 0.06, Math.min(fu, 1 - fu));
    o.h = gap * (1 - fv * 0.8) + pfbm(u, v, 16, 3, 5) * 0.12;
    const tone = (0.2 + id * 0.12 + pfbm(u, v, 8, 4, 7) * 0.14) * lerp(0.5, 1, gap) * lerp(1, 0.7, smooth(0.8, 1, fv));
    tint(o, 0.74, 0.8, 0.92, tone);
    o.rough = 0.7 + id * 0.15;
  },
  // weathered rock: cracks and lichen
  rock(u, v, o) {
    const a = pfbm(u, v, 4, 6, 44);
    const c = pcell(u, v, 6, 12);
    const crack = smooth(0.0, 0.07, c.d2 - c.d1);
    const fine = pfbm(u, v, 32, 3, 3);
    o.h = a * 0.6 + crack * 0.3 + fine * 0.15;
    const lichen = smooth(0.62, 0.8, pfbm(u, v, 7, 4, 90));
    const tone = (0.3 + a * 0.3 + fine * 0.1) * lerp(0.55, 1, crack);
    tint(o, lerp(0.8, 0.66, lichen), lerp(0.79, 0.74, lichen), lerp(0.78, 0.52, lichen), tone);
    o.rough = 0.9;
  },
  // pine needles: dense, dark, flecked
  needles(u, v, o) {
    const strand = pnoise(u * 60, v * 14, 60, 4) * 0.6 + pnoise(u * 24, v * 40, 24, 8) * 0.4;
    const clump = pfbm(u, v, 6, 4, 19);
    o.h = strand * 0.7 + clump * 0.3;
    const tone = 0.16 + strand * 0.34 + clump * 0.2;
    tint(o, 0.4, 0.62, 0.42, tone);
    o.rough = 0.86;
  },
  // dyed wool and leather for uniforms; neutral so vertex colours can tint it
  cloth(u, v, o) {
    const twill = Math.sin((u + v) * Math.PI * 2 * 90) * 0.5 + 0.5;
    const fold = pfbm(u, v, 4, 4, 14);
    o.h = twill * 0.2 + fold * 0.8;
    tint(o, 1, 1, 1, 0.74 + twill * 0.08 + fold * 0.22);
    o.rough = 0.88;
  },
  // open-water ripples: only its normal map is used
  water(u, v, o) {
    const a = pfbm(u, v, 5, 5, 71);
    const b = pfbm(u + 0.37, v + 0.11, 11, 4, 13);
    o.h = a * 0.65 + b * 0.35;
    tint(o, 1, 1, 1, o.h);
    o.rough = 0.1;
  },
  // charred timber for the burning sheds
  char(u, v, o) {
    const c = pcell(u * 1, v * 2, 9, 3);
    const crack = smooth(0.0, 0.1, c.d2 - c.d1);
    const ash = pfbm(u, v, 12, 4, 6);
    o.h = crack * 0.8 + ash * 0.2;
    const tone = 0.04 + crack * 0.06 + smooth(0.6, 0.85, ash) * 0.2;
    tint(o, 1, 0.95, 0.9, tone);
    o.rough = 0.95;
  },
};

const SIZES = { stone: 512, ashlar: 512, road: 512, ground: 512, wood: 512, plate: 512, bark: 256, canvas: 256, brass: 256, gunmetal: 256, slate: 256, rock: 256, needles: 256, cloth: 256, char: 256, water: 256 };
const STRENGTH = { stone: 1.8, ashlar: 1.4, road: 2.2, ground: 1.5, wood: 2, plate: 1.8, bark: 3, canvas: 1.4, brass: 0.7, gunmetal: 0.6, slate: 2.4, rock: 2.6, needles: 2, cloth: 1.2, char: 2.6, water: 1.6 };

export const TEXTURE_NAMES = Object.keys(RECIPES);

/**
 * Bake every texture set. `onProgress(done, total)` lets the loading screen move; baking is
 * spread over animation frames so the page stays alive. `detail` 0.5 halves the resolution.
 */
export async function bakeTextures({ detail = 1, anisotropy = 4, onProgress } = {}) {
  const sets = {};
  let i = 0;
  for (const name of TEXTURE_NAMES) {
    const size = Math.max(128, SIZES[name] * detail);
    sets[name] = bake(size, RECIPES[name], STRENGTH[name], anisotropy);
    i += 1;
    onProgress?.(i, TEXTURE_NAMES.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return sets;
}

/** A PBR material from one texture set. `repeat` tiles it; extra parameters pass through. */
export function pbr(set, opts = {}) {
  const { repeat, ...rest } = opts;
  const mat = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, metalnessMap: set.ormMap, roughness: 1, metalness: 1, ...rest });
  if (repeat) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
      // clones share the image data; only the transform differs
      const t = mat[key].clone();
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
      mat[key] = t;
    }
  }
  return mat;
}

/** Small soft sprites for particles, drawn once to a canvas atlas (2×2 cells). */
export function makeParticleAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * 2;
  c.height = S * 2;
  const g = c.getContext('2d');
  // 0: soft round glow
  let grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // 1: smoke puff (blotchy)
  for (let i = 0; i < 26; i += 1) {
    const a = hash(i, 1, 5) * Math.PI * 2;
    const r = hash(i, 2, 5) * S * 0.22;
    const x = S * 1.5 + Math.cos(a) * r;
    const y = S * 0.5 + Math.sin(a) * r;
    const rad = S * (0.14 + hash(i, 3, 5) * 0.16);
    grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(S, 0, S, S);
  }
  // 2: flame tongue (teardrop)
  for (let i = 0; i < 14; i += 1) {
    const t = i / 13;
    const y = S * 1.92 - t * S * 0.8;
    const rad = S * (0.3 * (1 - t) + 0.05);
    const x = S * 0.5 + Math.sin(t * 5) * S * 0.05;
    grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(255,255,255,${0.5 * (1 - t * 0.6)})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, S, S, S);
  }
  // 3: hard spark / star
  grad = g.createRadialGradient(S * 1.5, S * 1.5, 0, S * 1.5, S * 1.5, S * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(S, S, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
