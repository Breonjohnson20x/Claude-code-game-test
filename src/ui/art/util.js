// Shared helpers for the procedural art (no React components in this file).
import { useEffect, useId, useSyncExternalStore } from 'react';

/** Small deterministic PRNG so procedural art is stable across renders. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const r1 = (n) => Math.round(n * 10) / 10;

/** SVG-safe unique id prefix (React's useId contains characters url() dislikes). */
export function useUid(prefix = 'e') {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// ---- Reduced motion: OS preference OR <html data-motion="reduced"> ----
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readReducedMotion() {
  if (typeof window === 'undefined') return true;
  try {
    if (document.documentElement?.dataset?.motion === 'reduced') return true;
    return Boolean(window.matchMedia && window.matchMedia(MOTION_QUERY).matches);
  } catch {
    return false;
  }
}

function subscribeReducedMotion(cb) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia ? window.matchMedia(MOTION_QUERY) : null;
  mq?.addEventListener?.('change', cb);
  let mo = null;
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(cb);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  }
  return () => {
    mq?.removeEventListener?.('change', cb);
    mo?.disconnect();
  };
}

/** true when animation should be suppressed. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
}

/**
 * Watch an element: calls onChange(visible) whenever it enters/leaves the
 * viewport or the tab is hidden/shown. Returns a cleanup function.
 * Used to pause SMIL (svg.pauseAnimations) and canvas loops offscreen.
 */
export function watchVisibility(el, onChange) {
  if (!el || typeof window === 'undefined') return () => {};
  let inView = true;
  let last = null;
  const emit = () => {
    const v = inView && !(typeof document !== 'undefined' && document.hidden);
    if (v !== last) {
      last = v;
      onChange(v);
    }
  };
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView = e.isIntersecting;
        emit();
      },
      { rootMargin: '64px' },
    );
    io.observe(el);
  }
  document.addEventListener('visibilitychange', emit);
  emit();
  return () => {
    io?.disconnect();
    document.removeEventListener('visibilitychange', emit);
  };
}

/** Pause an <svg>'s SMIL animations while it is offscreen or the tab is hidden. */
export function useSvgPause(ref, enabled) {
  useEffect(() => {
    const svg = ref.current;
    if (!enabled || !svg || typeof svg.pauseAnimations !== 'function') return undefined;
    const stop = watchVisibility(svg, (visible) => {
      try {
        if (visible) svg.unpauseAnimations();
        else svg.pauseAnimations();
      } catch {
        /* ignore */
      }
    });
    return () => {
      stop();
      try {
        svg.unpauseAnimations();
      } catch {
        /* ignore */
      }
    };
  }, [ref, enabled]);
}

// ---- Procedural silhouettes ----

/**
 * Filled ridge silhouette. Returns an SVG path `d`.
 * opts: y (base height), amp, waves [[freq, ampScale], ...], bumps [{x,w,h}],
 *       jag (0..1 jaggedness), step, x0, x1, bottom, seed
 */
export function ridgePath(opts) {
  const {
    seed = 1,
    y = 120,
    amp = 8,
    waves = [[1.3, 1], [3.1, 0.45], [7.3, 0.18]],
    bumps = [],
    jag = 0,
    step = 10,
    x0 = -12,
    x1 = 412,
    bottom = 232,
  } = opts;
  const rnd = mulberry32(seed);
  const phases = waves.map(() => rnd() * Math.PI * 2);
  const pts = [];
  for (let x = x0; x <= x1 + 0.01; x += step) {
    const u = (x - x0) / (x1 - x0);
    let h = 0;
    waves.forEach(([f, s], i) => {
      h += Math.sin(u * Math.PI * 2 * f + phases[i]) * s;
    });
    h *= amp;
    for (const b of bumps) h -= b.h * Math.exp(-(((x - b.x) / b.w) ** 2));
    if (jag) h += (rnd() - 0.5) * amp * jag * 2;
    pts.push([x, y + h]);
  }
  let d = `M${x0},${bottom}L${r1(pts[0][0])},${r1(pts[0][1])}`;
  if (jag > 0.5) {
    for (let i = 1; i < pts.length; i += 1) d += `L${r1(pts[i][0])},${r1(pts[i][1])}`;
  } else {
    for (let i = 1; i < pts.length; i += 1) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      d += `Q${r1(px)},${r1(py)} ${r1((px + cx) / 2)},${r1((py + cy) / 2)}`;
    }
    const last = pts[pts.length - 1];
    d += `L${r1(last[0])},${r1(last[1])}`;
  }
  d += `L${x1},${bottom}Z`;
  return d;
}

/** Height of a ridge at x — mirrors ridgePath for placing things on it. */
export function ridgeHeightAt(opts, x) {
  const { seed = 1, y = 120, amp = 8, waves = [[1.3, 1], [3.1, 0.45], [7.3, 0.18]], bumps = [], x0 = -12, x1 = 412 } = opts;
  const rnd = mulberry32(seed);
  const phases = waves.map(() => rnd() * Math.PI * 2);
  const u = (x - x0) / (x1 - x0);
  let h = 0;
  waves.forEach(([f, s], i) => {
    h += Math.sin(u * Math.PI * 2 * f + phases[i]) * s;
  });
  h *= amp;
  for (const b of bumps) h -= b.h * Math.exp(-(((x - b.x) / b.w) ** 2));
  return y + h;
}

/** One stylised tiered conifer. Returns { body, lit, snow } path fragments. */
export function pine(x, base, h, opts = {}) {
  const w = h * (opts.width ?? 0.42);
  const t = base - h;
  const trunk = Math.max(0.6, w * 0.07);
  const tiers = opts.tiers ?? 3;
  // left/right outline points per tier
  const L = [];
  const R = [];
  for (let i = 0; i < tiers; i += 1) {
    const ty = t + (h * 0.86 * (i + 1)) / tiers;
    const tw = (w / 2) * ((i + 1) / tiers) * 1.05;
    const inner = tw * 0.5;
    const iy = ty - (h * 0.86) / tiers / 2.4;
    if (i > 0) {
      L.push([x - inner, iy]);
      R.push([x + inner, iy]);
    }
    L.push([x - tw, ty]);
    R.push([x + tw, ty]);
  }
  const P = (p) => `${r1(p[0])},${r1(p[1])}`;
  let body = `M${r1(x)},${r1(t)}`;
  for (const p of R) body += `L${P(p)}`;
  const lastY = R[R.length - 1][1];
  body += `L${P([x + trunk, lastY])}L${P([x + trunk, base])}L${P([x - trunk, base])}L${P([x - trunk, lastY])}`;
  for (let i = L.length - 1; i >= 0; i -= 1) body += `L${P(L[i])}`;
  body += 'Z';
  // lit right half
  let lit = `M${r1(x)},${r1(t)}`;
  for (const p of R) lit += `L${P(p)}`;
  lit += `L${P([x + trunk * 0.2, lastY])}Z`;
  // snow resting on each tier: a pale band hugging the upper half of the tier
  let snow = '';
  if (opts.snow) {
    snow += `M${r1(x)},${r1(t)}L${P([x + (R[0][0] - x) * 0.45, t + (R[0][1] - t) * 0.45])}L${P([x, t + (R[0][1] - t) * 0.32])}L${P([x - (R[0][0] - x) * 0.45, t + (R[0][1] - t) * 0.45])}Z`;
    for (let j = 1; j < R.length; j += 2) {
      const ri = R[j];
      const ro = R[j + 1];
      const li = L[j];
      const lo = L[j + 1];
      if (!ro || !lo) break;
      const k = 0.5;
      const rm = [ri[0] + (ro[0] - ri[0]) * k, ri[1] + (ro[1] - ri[1]) * k];
      const lm = [li[0] + (lo[0] - li[0]) * k, li[1] + (lo[1] - li[1]) * k];
      const dip = h * 0.035;
      snow += `M${P(li)}L${P([x, li[1] - dip * 0.6])}L${P(ri)}L${P(rm)}L${P([x + (rm[0] - x) * 0.4, rm[1] - dip * 0.2])}L${P([x, ri[1] + dip])}L${P([x + (lm[0] - x) * 0.4, lm[1] - dip * 0.2])}L${P(lm)}Z`;
    }
  }
  return { body, lit, snow };
}

/** A belt of pines along a baseline function. */
export function forest(seed, { from, to, count, baseAt, hMin, hMax, snow = false, jitter = 0.7, width }) {
  const rnd = mulberry32(seed);
  let body = '';
  let lit = '';
  let snowD = '';
  const span = to - from;
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const x = from + (span * (i + 0.5 + (rnd() - 0.5) * jitter)) / count;
    const h = hMin + (hMax - hMin) * rnd();
    items.push([x, h]);
  }
  // draw smaller (further) ones first for a little depth inside the belt
  items.sort((a, b) => a[1] - b[1]);
  for (const [x, h] of items) {
    const p = pine(x, baseAt(x) + 1.5, h, { snow, width });
    body += p.body;
    lit += p.lit;
    snowD += p.snow;
  }
  return { body, lit, snow: snowD };
}

/** Rounded deciduous tree blobs (frontier groves). */
export function groveBlobs(seed, { from, to, count, baseAt, rMin, rMax }) {
  const rnd = mulberry32(seed);
  let d = '';
  let lit = '';
  for (let i = 0; i < count; i += 1) {
    const x = from + (to - from) * rnd();
    const r = rMin + (rMax - rMin) * rnd();
    const by = baseAt(x);
    const cy = by - r * 1.1;
    d += `M${r1(x - r)},${r1(cy)}a${r1(r)},${r1(r * 0.92)} 0 1 1 ${r1(r * 2)},0a${r1(r)},${r1(r * 0.6)} 0 0 1 ${r1(-r * 2)},0Z`;
    d += `M${r1(x - 0.5)},${r1(cy + r * 0.4)}h1v${r1(by - cy - r * 0.4 + 1)}h-1Z`;
    lit += `M${r1(x + r * 0.05)},${r1(cy - r * 0.85)}a${r1(r * 0.9)},${r1(r * 0.8)} 0 0 1 ${r1(r * 0.85)},${r1(r * 0.7)}a${r1(r * 0.6)},${r1(r * 0.6)} 0 0 0 ${r1(-r * 0.85)},${r1(-r * 0.7)}Z`;
  }
  return { body: d, lit };
}

// ---- Figures (people silhouettes). Feet at (x, y), height h. ----
function circle(cx, cy, r) {
  return `M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;
}

export function personPath(x, y, h, kind = 'civilian', facing = 1) {
  const f = facing;
  const hr = h * 0.105;
  const hy = y - h + hr;
  let d = '';
  const P = (dx, dy) => `${r1(x + dx * f)},${r1(y - dy)}`;
  if (kind === 'cloak' || kind === 'refugee' || kind === 'child') {
    // hooded cloak to the ground, slight stoop
    d += `M${P(-h * 0.02, h * 0.98)}Q${P(h * 0.13, h * 0.98)} ${P(h * 0.12, h * 0.8)}L${P(h * 0.2, h * 0.02)}Q${P(0, -h * 0.03)} ${P(-h * 0.2, h * 0.02)}L${P(-h * 0.13, h * 0.78)}Q${P(-h * 0.13, h * 0.98)} ${P(-h * 0.02, h * 0.98)}Z`;
    if (kind === 'refugee') d += circle(x - h * 0.17 * f, y - h * 0.62, h * 0.12); // bundle on back
    return d;
  }
  if (kind === 'sitting' || kind === 'wounded') {
    // seated figure, knees up
    const sh = h * 0.62;
    d += circle(x, y - sh + hr, hr);
    d += `M${P(-h * 0.14, sh * 0.78)}Q${P(0, sh * 0.86)} ${P(h * 0.14, sh * 0.78)}L${P(h * 0.16, h * 0.12)}L${P(h * 0.42, h * 0.2)}L${P(h * 0.44, 0)}L${P(-h * 0.16, 0)}Z`;
    return d;
  }
  if (kind === 'lying') {
    d += circle(x - h * 0.42, y - h * 0.1, h * 0.1);
    d += `M${r1(x - h * 0.3)},${r1(y - h * 0.18)}L${r1(x + h * 0.42)},${r1(y - h * 0.14)}L${r1(x + h * 0.44)},${r1(y)}L${r1(x - h * 0.32)},${r1(y)}Z`;
    return d;
  }
  // standing torso
  d += circle(x, hy, hr);
  d += `M${P(-h * 0.17, h * 0.79)}Q${P(0, h * 0.86)} ${P(h * 0.17, h * 0.79)}L${P(h * 0.13, h * 0.42)}L${P(h * 0.1, 0)}L${P(h * 0.02, 0)}L${P(0, h * 0.3)}L${P(-h * 0.02, 0)}L${P(-h * 0.1, 0)}L${P(-h * 0.13, h * 0.42)}Z`;
  if (kind === 'soldier' || kind === 'guard') {
    // helmet brim + spear
    d += `M${P(-hr * 1.25, h - hr * 1.1)}h${r1(hr * 2.5 * f)}v${r1(hr * 0.5)}h${r1(-hr * 2.5 * f)}Z`;
    const sx = x + h * 0.22 * f;
    d += `M${r1(sx - 0.35)},${r1(y)}v${r1(-h * 1.28)}h0.7v${r1(h * 1.28)}Z`;
    d += `M${r1(sx)},${r1(y - h * 1.42)}l0.9,${r1(h * 0.16)}h-1.8Z`;
    if (kind === 'guard') d += `M${P(-h * 0.26, h * 0.7)}h${r1(h * 0.16 * f)}v${r1(h * 0.36)}l${r1(-h * 0.08 * f)},${r1(h * 0.08)}l${r1(-h * 0.08 * f)},${r1(-h * 0.08)}Z`;
  } else if (kind === 'civilian') {
    d += circle(x - h * 0.16 * f, y - h * 0.62, h * 0.11); // pack
  } else if (kind === 'officer') {
    d += `M${P(-h * 0.21, h * 0.8)}L${P(h * 0.21, h * 0.8)}L${P(h * 0.28, h * 0.05)}L${P(-h * 0.28, h * 0.05)}Z`; // greatcoat
  }
  return d;
}

/** Many figures → one path. list: [x, y, h, kind, facing] */
export function crowdPath(list) {
  return list.map(([x, y, h, kind, facing]) => personPath(x, y, h, kind, facing ?? 1)).join('');
}
