// Derived lighting for RegionScene. Every colour here is mixed from the palette
// (`C`) and the time-of-day rig (`LIGHT[tod]`) so the vistas never invent hues.
import { C } from '../palette.js';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix two hex colours: t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Darken (k<0, toward navy950) or lighten (k>0, toward lattice100). */
export function shade(hex, k) {
  return k < 0 ? mix(hex, C.navy950, -k) : mix(hex, C.lattice100, k);
}

/**
 * The extended rig for one time of day. `L` is LIGHT[tod].
 * Clouds: `lit` is the sun-facing side, `dark` the belly. At dusk the sun is
 * below the clouds, so bellies glow and tops fall into violet.
 */
export function tone(L, tod) {
  const [s0, s1, s2, s3] = L.sky;
  if (tod === 'dusk') {
    return {
      tod,
      horizon: mix(s3, C.ember300, 0.35),
      horizonGlow: C.ember300,
      cloudTop: mix(s1, s0, 0.35),
      cloudBot: mix(C.ember300, C.gold300, 0.35),
      cloudMid: mix(s2, s1, 0.4),
      cloudFar: mix(s2, C.ember300, 0.45),
      silver: C.gold200,
      ray: C.ember200,
      rayOp: 0.32,
      fog: mix(L.haze, s2, 0.4),
      fogOp: 0.5,
      shadow: mix(L.mountain, s0, 0.65),
      snowLit: mix(L.mountainSnow, C.ember200, 0.35),
      snowShadow: mix(L.mountainSnow, s1, 0.55),
      bloom: C.ember300,
      bloomOp: 0.5,
      water: mix(s3, C.ember300, 0.25),
      waterDark: mix(s1, s0, 0.4),
      grass: mix(L.near, C.ember600, 0.2),
      grassLit: mix(L.rim, C.ember300, 0.4),
      grade: C.ember400,
      gradeOp: 0.07,
      lamp: C.ember300,
    };
  }
  if (tod === 'night') {
    return {
      tod,
      horizon: mix(s3, C.navy600, 0.3),
      horizonGlow: mix(C.frost500, s3, 0.4),
      cloudTop: mix(C.frost300, s3, 0.45),
      cloudBot: mix(s1, s0, 0.3),
      cloudMid: mix(s2, s3, 0.5),
      cloudFar: mix(s3, C.frost500, 0.25),
      silver: C.frost100,
      ray: C.frost200,
      rayOp: 0.12,
      fog: mix(L.haze, s3, 0.4),
      fogOp: 0.45,
      shadow: mix(L.mountain, C.navy950, 0.55),
      snowLit: mix(L.mountainSnow, C.frost200, 0.4),
      snowShadow: mix(L.mountainSnow, C.navy700, 0.55),
      bloom: C.frost200,
      bloomOp: 0.18,
      water: mix(s3, C.frost500, 0.3),
      waterDark: mix(s0, s1, 0.5),
      grass: mix(L.near, C.navy950, 0.2),
      grassLit: mix(L.rim, C.frost300, 0.3),
      grade: C.navy800,
      gradeOp: 0.12,
      lamp: C.ember300,
    };
  }
  return {
    tod: 'day',
    horizon: mix(s3, C.lattice200, 0.3),
    horizonGlow: C.lattice200,
    cloudTop: C.lattice100,
    cloudBot: mix(s1, L.mountain, 0.45),
    cloudMid: mix(C.parch100, s1, 0.35),
    cloudFar: mix(s2, C.parch100, 0.5),
    silver: C.lattice100,
    ray: C.lattice200,
    rayOp: 0.26,
    fog: mix(L.haze, s2, 0.3),
    fogOp: 0.42,
    shadow: mix(L.mountain, C.navy700, 0.45),
    snowLit: L.mountainSnow,
    snowShadow: mix(L.mountainSnow, s0, 0.45),
    bloom: C.lattice300,
    bloomOp: 0.38,
    water: mix(s1, C.parch100, 0.25),
    waterDark: mix(s0, L.mid, 0.5),
    grass: mix(L.near, L.fg, 0.4),
    grassLit: mix(L.rim, C.gold300, 0.35),
    grade: C.gold400,
    gradeOp: 0.05,
    lamp: C.ember300,
  };
}
