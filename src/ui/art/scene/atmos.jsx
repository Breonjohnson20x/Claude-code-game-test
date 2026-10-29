// Atmosphere for RegionScene: the sky dome (graded sky, horizon glow, sun bloom
// or a shaded moon, stars, three cloud decks lit by the key light), snow-capped
// mountain ranges with shadowed facets, terrain layers with aerial perspective
// and rim light, light shafts, drifting mist, birds and grass strokes.
// Pure SVG. SMIL only when `motion` is true. Key light: upper right.
import { C } from '../palette.js';
import { mulberry32, r1 } from '../util.js';
import { mix } from './tone.js';

// ---------------------------------------------------------------- geometry
/** Same maths as util.ridgePath / ridgeHeightAt, returned as points. */
export function ridgePts(opts) {
  const { seed = 1, y = 120, amp = 8, waves = [[1.3, 1], [3.1, 0.45], [7.3, 0.18]], bumps = [], jag = 0, step = 10, x0 = -12, x1 = 412 } = opts;
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
  return pts;
}

/** Smooth open path through points (quadratic midpoints). */
export function smoothLine(pts) {
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    d += `Q${r1(px)},${r1(py)} ${r1((px + cx) / 2)},${r1((py + cy) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${r1(last[0])},${r1(last[1])}`;
}

function polyLine(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`).join('');
}

/** Filled land shape + its top edge (for rim light). */
export function landShapes(opts, bottom = 262) {
  const pts = ridgePts({ step: 6, ...opts });
  const top = opts.jag > 0.5 ? polyLine(pts) : smoothLine(pts);
  const x0 = pts[0][0];
  const x1 = pts[pts.length - 1][0];
  const fill = `M${x0},${bottom}L${top.slice(1)}L${x1},${bottom}Z`;
  return { fill, top, pts };
}

function circlePath(cx, cy, r) {
  return `M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;
}

// ---------------------------------------------------------------- defs
export function AtmosDefs({ uid, L, T }) {
  const { sun } = L;
  const moon = Boolean(sun.moon);
  return (
    <defs>
      {/* rim light: strongest near the key light, gone by the far side */}
      <radialGradient id={`${uid}-rimg`} gradientUnits="userSpaceOnUse" cx={sun.x} cy={sun.y} r="330">
        <stop offset="0" stopColor={L.rim} stopOpacity="1" />
        <stop offset="0.45" stopColor={L.rim} stopOpacity="0.65" />
        <stop offset="1" stopColor={L.rim} stopOpacity="0.08" />
      </radialGradient>
      <radialGradient id={`${uid}-bloom`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={moon ? C.frost100 : C.lattice100} stopOpacity="1" />
        <stop offset="0.07" stopColor={moon ? C.frost100 : C.lattice200} stopOpacity="0.85" />
        <stop offset="0.2" stopColor={T.bloom} stopOpacity="0.32" />
        <stop offset="0.5" stopColor={T.bloom} stopOpacity="0.09" />
        <stop offset="1" stopColor={T.bloom} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-hglow`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={T.horizonGlow} stopOpacity="0.85" />
        <stop offset="0.45" stopColor={T.horizonGlow} stopOpacity="0.3" />
        <stop offset="1" stopColor={T.horizonGlow} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-ray`} gradientUnits="userSpaceOnUse" cx={sun.x} cy={sun.y} r="260">
        <stop offset="0" stopColor={T.ray} stopOpacity="0.9" />
        <stop offset="0.35" stopColor={T.ray} stopOpacity="0.35" />
        <stop offset="1" stopColor={T.ray} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-mist`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={T.fog} stopOpacity={0.9 * (T.mistK ?? 1)} />
        <stop offset="0.6" stopColor={T.fog} stopOpacity={0.35 * (T.mistK ?? 1)} />
        <stop offset="1" stopColor={T.fog} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-fogband`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={T.fog} stopOpacity="0" />
        <stop offset="0.6" stopColor={T.fog} stopOpacity={T.fogOp} />
        <stop offset="1" stopColor={T.fog} stopOpacity={T.fogOp * 0.5} />
      </linearGradient>
      {/* cloud banks: a solid core graded top→belly, soft puffs for the edge, sun-facing light */}
      <linearGradient id={`${uid}-cl`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={T.cloudTop} />
        <stop offset="0.55" stopColor={T.cloudMid} />
        <stop offset="1" stopColor={T.cloudBot} />
      </linearGradient>
      <radialGradient id={`${uid}-puff`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={T.cloudMid} stopOpacity="0.95" />
        <stop offset="0.55" stopColor={T.cloudMid} stopOpacity="0.8" />
        <stop offset="0.8" stopColor={T.cloudMid} stopOpacity="0.35" />
        <stop offset="1" stopColor={T.cloudMid} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-puffl`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={T.silver} stopOpacity="0.7" />
        <stop offset="0.5" stopColor={T.cloudTop} stopOpacity="0.32" />
        <stop offset="1" stopColor={T.cloudTop} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-puffd`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={T.cloudBot} stopOpacity="0.85" />
        <stop offset="0.6" stopColor={T.cloudBot} stopOpacity="0.4" />
        <stop offset="1" stopColor={T.cloudBot} stopOpacity="0" />
      </radialGradient>
      {/* dusk cloud bellies: lit from below by the low sun, ember into gold at the very edge */}
      <linearGradient id={`${uid}-belly`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.ember400} stopOpacity="0" />
        <stop offset="0.5" stopColor={C.ember400} stopOpacity="0.12" />
        <stop offset="0.8" stopColor={C.ember300} stopOpacity="0.55" />
        <stop offset="1" stopColor={C.gold200} stopOpacity="0.9" />
      </linearGradient>
      {moon && (
        <>
          <radialGradient id={`${uid}-moon`} cx="62%" cy="38%" r="70%">
            <stop offset="0" stopColor={C.lattice100} />
            <stop offset="0.6" stopColor={C.frost100} />
            <stop offset="1" stopColor={C.frost300} />
          </radialGradient>
          {/* the crescent is a mask, so the unlit part is truly the sky behind it */}
          <mask id={`${uid}-moonmask`} maskUnits="userSpaceOnUse" x={sun.x - sun.r * 2} y={sun.y - sun.r * 2} width={sun.r * 4} height={sun.r * 4}>
            <circle cx={sun.x} cy={sun.y} r={sun.r} fill="#fff" />
            <circle cx={sun.x - sun.r * 0.95} cy={sun.y - sun.r * 0.18} r={sun.r * 0.98} fill="#000" />
          </mask>
        </>
      )}
    </defs>
  );
}

// ---------------------------------------------------------------- sky
/** A cumulus bank as soft puffs: [cx, cy, r] (a bell of puffs over a flat base). */
function cumulus(rnd, x, y, w, h) {
  const n = 6 + Math.floor(rnd() * 4);
  const gap = w / n;
  const puffs = [];
  for (let i = 0; i < n; i += 1) {
    const u = (i + 0.5) / n;
    const r = (gap * 0.62 + h * (0.25 + 0.95 * Math.sin(Math.PI * u) ** 1.4)) * (0.8 + rnd() * 0.4);
    const cx = x + w * u + (rnd() - 0.5) * gap * 0.4;
    puffs.push([cx, y - r * 0.45, r]);
    if (rnd() < 0.55 && u > 0.2 && u < 0.8) puffs.push([cx + (rnd() - 0.4) * r, y - r * 1.05, r * (0.6 + rnd() * 0.25)]);
  }
  return { puffs, base: [x + w / 2, y - h * 0.12, w * 0.55, h * 0.36] };
}

/** A low stratus streak as a few long soft ellipses: [cx, cy, rx, ry]. */
function stratus(rnd, x, y, w, h) {
  const out = [];
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i += 1) {
    out.push([x + w * ((i + 0.5) / n) + (rnd() - 0.5) * w * 0.1, y + (rnd() - 0.5) * h * 0.6, (w / n) * (0.9 + rnd() * 0.6), h * (0.7 + rnd() * 0.6)]);
  }
  return out;
}

function Cumulus({ uid, id, cloud, sunX, dusk, night, op }) {
  const { puffs, base } = cloud;
  // the sun-facing flank catches the light; at dusk the sun is below the deck, so
  // the light sits on the belly (shaped from the puffs themselves, clipped to the cloud)
  const dir = Math.sign(sunX - base[0]) || 1;
  let core = '';
  for (const [cx, cy, r] of puffs) core += circlePath(cx, cy + r * 0.06, r * 0.72);
  core += `M${r1(base[0] - base[2])},${r1(base[1])}a${r1(base[2])},${r1(base[3])} 0 1 0 ${r1(base[2] * 2)},0a${r1(base[2])},${r1(base[3])} 0 1 0 ${r1(-base[2] * 2)},0Z`;
  const litOp = night ? 0.45 : 0.85;
  const clip = `${uid}-cc-${id}`;
  // the cloud's bounds, for the belly light
  let bx0 = base[0] - base[2];
  let bx1 = base[0] + base[2];
  let by0 = base[1];
  let by1 = base[1] + base[3];
  for (const [cx, cy, r] of puffs) {
    bx0 = Math.min(bx0, cx - r);
    bx1 = Math.max(bx1, cx + r);
    by0 = Math.min(by0, cy - r);
    by1 = Math.max(by1, cy + r * 0.86);
  }
  return (
    <g opacity={op}>
      <path d={core} fill={`url(#${uid}-cl)`} />
      {puffs.map(([cx, cy, r], i) => (
        <circle key={i} cx={r1(cx)} cy={r1(cy)} r={r1(r)} fill={`url(#${uid}-puff)`} opacity="0.55" />
      ))}
      <ellipse cx={r1(base[0])} cy={r1(base[1] + base[3] * 0.3)} rx={r1(base[2] * 1.1)} ry={r1(base[3] * 1.2)} fill={`url(#${uid}-puffd)`} opacity={dusk ? 0.3 : 0.65} />
      {dusk ? (
        <>
          <defs>
            <clipPath id={clip}>
              <path d={core} />
              {puffs.map(([cx, cy, r], i) => (
                <circle key={i} cx={r1(cx)} cy={r1(cy)} r={r1(r * 0.86)} />
              ))}
            </clipPath>
          </defs>
          <rect x={r1(bx0)} y={r1(by0)} width={r1(bx1 - bx0)} height={r1(by1 - by0)} fill={`url(#${uid}-belly)`} clipPath={`url(#${clip})`} />
        </>
      ) : (
        puffs.map(([cx, cy, r], i) => <circle key={`l${i}`} cx={r1(cx + dir * r * 0.3)} cy={r1(cy - r * 0.3)} r={r1(r * 0.9)} fill={`url(#${uid}-puffl)`} opacity={litOp} />)
      )}
    </g>
  );
}

function Drift({ motion, dx = -14, dur = 90, children }) {
  return (
    <g>
      {motion && <animateTransform attributeName="transform" type="translate" values={`0 0;${dx} 0;0 0`} dur={`${dur}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
      {children}
    </g>
  );
}

/**
 * The whole sky. `clouds`: 0 (clear) … 1 (heavy). `horizonY` is where the land
 * meets the sky, used to place the horizon glow and the low cloud deck.
 */
export function SkyDome({ uid, L, T, seed = 7, clouds = 0.6, horizonY = 112, motion, sunHidden = false }) {
  const rnd = mulberry32(seed);
  const { sun } = L;
  const moon = Boolean(sun.moon);
  // stars
  let stars = '';
  let bright = '';
  if (L.stars > 0) {
    for (let i = 0; i < 140; i += 1) {
      const x = rnd() * 410 - 5;
      const y = rnd() * horizonY * (0.15 + rnd() * 0.85);
      const big = rnd() < 0.1;
      const r = big ? 0.5 + rnd() * 0.25 : 0.2 + rnd() * 0.2;
      if (big) bright += circlePath(x, y, r);
      else stars += circlePath(x, y, r);
    }
  }
  // cloud decks
  const high = [];
  const mid = [];
  const low = [];
  if (clouds > 0) {
    const nMid = Math.round(2 + clouds * 4);
    for (let i = 0; i < nMid; i += 1) {
      const w = 50 + rnd() * 80 * (0.6 + clouds * 0.6);
      const x = -30 + ((i + rnd() * 0.7) / nMid) * 420 - w * 0.3;
      const y = horizonY * (0.42 + rnd() * 0.26);
      mid.push(cumulus(rnd, x, y, w, 6 + rnd() * 7 * (0.6 + clouds)));
    }
    for (let i = 0; i < 4; i += 1) {
      const x = -20 + rnd() * 380;
      const y = horizonY * (0.12 + rnd() * 0.22);
      const w = 70 + rnd() * 120;
      high.push([x + w / 2, y, w / 2, 1.2 + rnd() * 1.4, -2 - rnd() * 4]);
    }
    for (let i = 0; i < 4; i += 1) {
      const w = 90 + rnd() * 110;
      const x = -20 + rnd() * 360;
      const y = horizonY - 6 - rnd() * 16;
      low.push(...stratus(rnd, x, y, w, 2 + rnd() * 2.5));
    }
  }
  const dusk = T.tod === 'dusk';
  return (
    <g>
      <rect x="-5" y="-5" width="410" height="270" fill={`url(#${uid}-sky)`} />
      {/* horizon glow pooled under the key light */}
      <ellipse cx={sun.x} cy={horizonY - 4} rx={moon ? 230 : 300} ry={moon ? 40 : 62} fill={`url(#${uid}-hglow)`} opacity={moon ? 0.35 : dusk ? 0.95 : 0.7} />
      {L.stars > 0 && (
        <g fill={C.lattice100}>
          {moon && <ellipse cx="150" cy="34" rx="230" ry="16" transform="rotate(-18 150 34)" fill={`url(#${uid}-mist)`} opacity="0.32" />}
          <path d={stars} opacity={0.6 * L.stars} />
          <path d={bright} opacity={0.95 * L.stars}>
            {motion && <animate attributeName="opacity" values={`${0.95 * L.stars};${0.55 * L.stars};${0.95 * L.stars}`} dur="4.5s" repeatCount="indefinite" />}
          </path>
        </g>
      )}
      {!sunHidden && (
        <g>
          <circle cx={sun.x} cy={sun.y} r={sun.haloR * (moon ? 1.6 : 2.1)} fill={`url(#${uid}-bloom)`} opacity={moon ? 0.5 : 1} />
          {moon ? (
            <g>
              {/* earthshine: the dark limb only just visible */}
              <circle cx={sun.x} cy={sun.y} r={sun.r} fill={C.frost500} opacity="0.07" />
              <g mask={`url(#${uid}-moonmask)`}>
                <circle cx={sun.x} cy={sun.y} r={sun.r} fill={`url(#${uid}-moon)`} />
                <ellipse cx={sun.x + sun.r * 0.3} cy={sun.y + sun.r * 0.3} rx={sun.r * 0.28} ry={sun.r * 0.2} fill={C.frost500} opacity="0.22" />
                <ellipse cx={sun.x + sun.r * 0.45} cy={sun.y - sun.r * 0.3} rx={sun.r * 0.16} ry={sun.r * 0.12} fill={C.frost500} opacity="0.2" />
              </g>
            </g>
          ) : (
            <>
              <circle cx={sun.x} cy={sun.y} r={sun.r * (dusk ? 1.15 : 0.72)} fill={dusk ? C.lattice200 : C.lattice100} />
              <circle cx={sun.x} cy={sun.y} r={sun.r * (dusk ? 0.8 : 0.5)} fill={C.lattice100} />
            </>
          )}
        </g>
      )}
      {clouds > 0 && (
        <g>
          <Drift motion={motion} dx={-10} dur={140}>
            {high.map(([cx, cy, rx, ry, a], i) => (
              <ellipse key={i} cx={r1(cx)} cy={r1(cy)} rx={r1(rx)} ry={r1(ry)} transform={`rotate(${r1(a)} ${r1(cx)} ${r1(cy)})`} fill={`url(#${uid}-puffl)`} opacity={0.35 + 0.3 * L.cloudOp} />
            ))}
          </Drift>
          <Drift motion={motion} dx={-8} dur={160}>
            {low.map(([cx, cy, rx, ry], i) => (
              <ellipse key={i} cx={r1(cx)} cy={r1(cy)} rx={r1(rx)} ry={r1(ry)} fill={`url(#${uid}-puff)`} opacity={0.5} />
            ))}
          </Drift>
          <Drift motion={motion} dx={-16} dur={110}>
            {mid.map((c, i) => (
              <Cumulus key={i} id={i} uid={uid} cloud={c} sunX={sun.x} dusk={dusk} night={moon} op={Math.min(1, L.cloudOp + 0.25)} />
            ))}
          </Drift>
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- light
/** Shafts of light fanning from (x,y) between angles a0..a1 (degrees, 90 = straight down). */
export function GodRays({ uid, T, x, y, a0 = 100, a1 = 160, count = 7, len = 260, op = 1, seed = 5, motion, fill }) {
  const rnd = mulberry32(seed);
  let dA = '';
  let dB = '';
  for (let i = 0; i < count; i += 1) {
    const a = ((a0 + ((a1 - a0) * (i + 0.2 + rnd() * 0.6)) / count) * Math.PI) / 180;
    const half = ((1.2 + rnd() * 3.2) * Math.PI) / 180;
    const l = len * (0.7 + rnd() * 0.3);
    const p1 = [x + Math.cos(a - half) * l, y + Math.sin(a - half) * l];
    const p2 = [x + Math.cos(a + half) * l, y + Math.sin(a + half) * l];
    const seg = `M${r1(x)},${r1(y)}L${r1(p1[0])},${r1(p1[1])}L${r1(p2[0])},${r1(p2[1])}Z`;
    if (i % 2) dA += seg;
    else dB += seg;
  }
  const base = T.rayOp * op;
  const paint = fill || `url(#${uid}-ray)`;
  return (
    <g pointerEvents="none">
      <path d={dA} fill={paint} opacity={base}>
        {motion && <animate attributeName="opacity" values={`${base};${base * 0.45};${base}`} dur="9s" repeatCount="indefinite" />}
      </path>
      <path d={dB} fill={paint} opacity={base * 0.7}>
        {motion && <animate attributeName="opacity" values={`${base * 0.4};${base * 0.85};${base * 0.4}`} dur="12s" repeatCount="indefinite" />}
      </path>
    </g>
  );
}

/** Soft light bloom laid over the middle distance (aerial glow around the key light). */
export function Bloom({ uid, L, T, op = 1, r }) {
  const { sun } = L;
  return <circle cx={sun.x} cy={sun.y} r={r ?? sun.haloR * 2.4} fill={`url(#${uid}-bloom)`} opacity={T.bloomOp * 0.55 * op} pointerEvents="none" />;
}

/** A horizontal band of fog. */
export function FogBand({ uid, y, h, op = 1 }) {
  return <rect x="-10" y={y} width="420" height={h} fill={`url(#${uid}-fogband)`} opacity={op} pointerEvents="none" />;
}

/** Drifting banks of mist (soft ellipses) along a line. */
export function Mist({ uid, y, op = 0.6, seed = 3, count = 5, rx = 70, ry = 6, motion, dur = 50 }) {
  const rnd = mulberry32(seed);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push([-30 + ((i + rnd() * 0.6) / count) * 460, y + (rnd() - 0.5) * ry * 1.6, rx * (0.6 + rnd() * 0.7), ry * (0.6 + rnd() * 0.7)]);
  }
  return (
    <g opacity={op} pointerEvents="none">
      {motion && <animateTransform attributeName="transform" type="translate" values="0 0;18 0;0 0" dur={`${dur}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
      {items.map(([x, yy, a, b], i) => (
        <ellipse key={i} cx={r1(x)} cy={r1(yy)} rx={r1(a)} ry={r1(b)} fill={`url(#${uid}-mist)`} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- mountains
function rangeProfile({ seed, y, amp, step = 2.5, oct = [[1.6, 1], [3.7, 0.55], [8.1, 0.3], [17, 0.12]] }) {
  const rnd = mulberry32(seed);
  const ph = oct.map(() => rnd() * Math.PI);
  const pts = [];
  for (let x = -14; x <= 414.01; x += step) {
    const u = (x + 14) / 428;
    let h = 0;
    let n = 0;
    oct.forEach(([f, a], i) => {
      h += a * (1 - Math.abs(Math.sin(Math.PI * f * u + ph[i]))) ** 1.7;
      n += a;
    });
    pts.push([x, y - (amp * h) / n]);
  }
  return pts;
}

/**
 * A mountain range with snow caps, shadowed west faces, gullies and a hazy
 * foot. Lit from the upper right.
 */
export function Range({ uid, id, L, T, seed = 1, y = 100, amp = 30, snow = 0.42, op = 1, haze = 0.55, base = 140, oct, rim = 0.8 }) {
  const pts = rangeProfile({ seed, y, amp, oct });
  const top = polyLine(pts);
  const fill = `M-14,${base}L${top.slice(1)}L414,${base}Z`;
  const rnd = mulberry32(seed + 99);
  // peaks: the highest point within ±W samples (prominent summits only)
  const W = 9;
  const peaks = [];
  for (let i = 2; i < pts.length - 2; i += 1) {
    const yy = pts[i][1];
    let top = true;
    for (let j = Math.max(0, i - W); j <= Math.min(pts.length - 1, i + W) && top; j += 1) if (pts[j][1] < yy) top = false;
    if (top && yy < y - amp * 0.25 && (!peaks.length || i - peaks[peaks.length - 1] > W)) peaks.push(i);
  }
  // each summit: a shadowed west face bounded by the west ridge and a spine running
  // from the summit down to the lower right; gullies score the lit east face
  let shadow = '';
  let gullies = '';
  let prev = 0;
  for (const pi of peaks) {
    let vi = prev;
    for (let j = prev; j < pi; j += 1) if (pts[j][1] > pts[vi][1]) vi = j;
    const [px, py] = pts[pi];
    const [vx, vy] = pts[vi];
    const span = Math.max(10, px - vx);
    const drop = base - py;
    const k1 = 0.18 + rnd() * 0.14;
    const k2 = k1 + 0.16 + rnd() * 0.14;
    let d = `M${r1(vx + span * 0.12)},${base + 2}L${r1(vx + span * 0.04)},${r1(vy + (base - vy) * 0.4)}`;
    for (let j = vi; j <= pi; j += 1) d += `L${r1(pts[j][0])},${r1(pts[j][1])}`;
    d += `L${r1(px + span * k1 * 0.4)},${r1(py + drop * 0.2)}L${r1(px + span * k1)},${r1(py + drop * 0.45)}L${r1(px + span * k2)},${r1(py + drop * 0.75)}L${r1(px + span * (k2 + 0.15))},${base + 2}Z`;
    shadow += d;
    const gN = 2 + Math.floor(rnd() * 2);
    for (let g = 0; g < gN; g += 1) {
      const gx = px + span * (0.25 + rnd() * 0.5);
      const gy = py + drop * (0.15 + rnd() * 0.2);
      const gl = drop * (0.12 + rnd() * 0.14);
      gullies += `M${r1(gx)},${r1(gy)}q${r1(gl * 0.1)},${r1(gl * 0.5)} ${r1(gl * (0.35 + rnd() * 0.25))},${r1(gl)}`;
    }
    prev = pi;
  }
  // snowline with fingers that reach down the gullies
  const sl = [];
  const p1 = rnd() * 6;
  for (let x = -14; x <= 414.01; x += 3) {
    const finger = Math.max(0, Math.sin(x * 0.21 + p1)) ** 6 * amp * 0.22;
    sl.push([x, y - amp * snow + Math.sin(x * 0.07 + p1) * amp * 0.06 + Math.sin(x * 0.33) * amp * 0.03 + finger]);
  }
  const snowD = `M-14,${r1(y - amp - 10)}H414L${polyLine([...sl].reverse()).slice(1)}Z`;
  const clip = `${uid}-rg-${id}`;
  const grad = `${uid}-rgf-${id}`;
  const hz = `${uid}-rgh-${id}`;
  // Ranges are solid rock: distance comes from the haze toward the sky, never from
  // transparency. `op` < 1 (an older knob) now just means "further away".
  const hzK = Math.min(0.92, haze * (T.hazeK ?? 1) + (1 - op) * 0.6);
  const lit = T.rockLit || L.mountain;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={fill} />
        </clipPath>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="0" y1={y - amp} x2="0" y2={base}>
          <stop offset="0" stopColor={mix(lit, T.horizon, 0.08)} />
          <stop offset="1" stopColor={mix(L.mountain, L.haze, hzK * 0.6)} />
        </linearGradient>
        <linearGradient id={hz} gradientUnits="userSpaceOnUse" x1="0" y1={y - amp * 0.35} x2="0" y2={base}>
          <stop offset="0" stopColor={L.haze} stopOpacity="0" />
          <stop offset="0.55" stopColor={L.haze} stopOpacity={hzK * 0.7} />
          <stop offset="1" stopColor={L.haze} stopOpacity={hzK} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`}>
        {snow > 0 && <path d={snowD} fill={T.snowLit} />}
        <path d={shadow} fill={T.shadow} opacity={0.78 - hzK * 0.3} />
        {snow > 0 && <path d={gullies} stroke={T.shadow} strokeWidth="0.6" opacity="0.3" fill="none" />}
        <rect x="-14" y={y - amp} width="430" height={base - y + amp + 2} fill={`url(#${hz})`} />
      </g>
      {rim > 1 && <path d={top} stroke={`url(#${uid}-rimg)`} strokeWidth="0.5" fill="none" opacity={(rim - 1) * L.rimOp} />}
    </g>
  );
}

// ---------------------------------------------------------------- terrain
/**
 * One depth layer of land. `haze` lifts it toward the sky (distance),
 * `mist` pools fog at its foot, `rim` is the light catching its crest.
 */
export function Land({ uid, id, L, T, ridge, color, haze: hazeIn = 0, mist = 0.2, rim = 0.5, rimW = 0.9, bottom = 262 }) {
  const { fill, top } = landShapes(ridge, bottom);
  const g = `${uid}-ld-${id}`;
  const topY = (ridge.y ?? 120) - (ridge.amp ?? 8) * 1.4 - Math.max(0, ...(ridge.bumps || []).map((b) => b.h));
  const span = Math.max(20, Math.min(bottom, (ridge.y ?? 120) + 40) - topY);
  const haze = hazeIn * (T.hazeK ?? 1);
  const lift = mix(color, L.haze, Math.min(0.85, haze));
  return (
    <g>
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="0" y1={topY} x2="0" y2={topY + span}>
          <stop offset="0" stopColor={mix(lift, L.rim, 0.06)} />
          <stop offset="0.35" stopColor={mix(color, L.haze, haze * 0.75)} />
          <stop offset="1" stopColor={mix(color, T.fog, mist)} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${g})`} />
      {rim > 0 && <path d={top} stroke={`url(#${uid}-rimg)`} strokeWidth={rimW} fill="none" opacity={rim * L.rimOp} />}
    </g>
  );
}

/** Grass blades along a baseline: { dark, lit } stroke paths (lit blades lean into the light). */
export function grassStrokes(seed, { from, to, count, baseAt, h = 4, spread = 6 }) {
  const rnd = mulberry32(seed);
  let dark = '';
  let lit = '';
  for (let i = 0; i < count; i += 1) {
    const x = from + (to - from) * rnd();
    const y = baseAt(x) + rnd() * spread;
    const hh = h * (0.5 + rnd() * 0.9);
    const lean = (rnd() - 0.35) * hh * 0.5;
    const d = `M${r1(x)},${r1(y)}q${r1(lean * 0.2)},${r1(-hh * 0.6)} ${r1(lean)},${r1(-hh)}`;
    if (rnd() < 0.3) lit += d;
    else dark += d;
  }
  return { dark, lit };
}

export function Grass({ seed, from, to, count, baseAt, h, spread, color, lit, litOp = 0.5, width = 0.5 }) {
  const g = grassStrokes(seed, { from, to, count, baseAt, h, spread });
  return (
    <g fill="none" strokeLinecap="round">
      <path d={g.dark} stroke={color} strokeWidth={width} />
      {lit && <path d={g.lit} stroke={lit} strokeWidth={width * 0.9} opacity={litOp} />}
    </g>
  );
}

// ---------------------------------------------------------------- life
/** A loose flock gliding west with flapping wings. list: [x, y, size] */
export function Birds({ list, motion, color, op = 0.8, from = 140, to = -420, dur = 52 }) {
  const wing = (s, up) => (up ? `M${-2.2 * s},${-0.9 * s}Q${-1 * s},${-1.3 * s} 0,0Q${1 * s},${-1.3 * s} ${2.2 * s},${-0.9 * s}` : `M${-2.2 * s},${0.6 * s}Q${-1 * s},${-0.5 * s} 0,0Q${1 * s},${-0.5 * s} ${2.2 * s},${0.6 * s}`);
  return (
    <g opacity={op} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      {motion && <animateTransform attributeName="transform" type="translate" values={`${from} 6;0 0;${to} -10`} keyTimes={`0;${r1(from / (from - to))};1`} dur={`${dur}s`} begin={`-${r1(dur * (from / (from - to)))}s`} repeatCount="indefinite" />}
      {list.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d={wing(s, i % 2 === 0)} strokeWidth={0.45 * s}>
            {motion && <animate attributeName="d" values={`${wing(s, true)};${wing(s, false)};${wing(s, true)}`} dur={`${0.7 + (i % 3) * 0.13}s`} repeatCount="indefinite" />}
          </path>
        </g>
      ))}
    </g>
  );
}
