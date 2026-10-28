// <WarRoomBackdrop threats={{ syndicate, wargs, refugees }} regionState dim className />
// Full-bleed War Room backdrop: a candle-lit war table seen at an angle. A parchment
// chart of Elvia lies on navy leather inside a dark wood table; brass pins, iron
// figurines and wax candles stand on it. Threats (0..100) move and multiply the
// markers; regionState redraws the Southern Marches outpost.
//
// Build: the table is one flat SVG on a CSS-3D plane tilted away from the viewer
// (real perspective, no per-frame work). Upright things are "billboards": children
// of the plane, anchored to a map point and rotated back to face the screen. The only
// animation is opacity/transform on small layers (candle flicker, smoke), and it is
// off under reduced motion. Fills its positioned parent (absolute inset-0).
//
// The room around the table (screen space, in front of the plane): a shaft of high-window
// light from the upper right with dust motes drifting in it (a small canvas), two
// out-of-focus standards of Elvia hanging close to the lens, and candle bokeh at the
// near edge — depth that falls off into darkness behind the War Room title.
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { C } from './palette.js';
import { clamp, mulberry32, r1, useReducedMotion, useUid } from './util.js';
import { Motes } from '../screens/warroom/ornate.jsx';

// ---------------------------------------------------------------- geometry
const WW = 1800; // table world, viewBox units
const WH = 1400;
const MAP = { x: 690, y: 300, w: 420, h: 660 }; // the chart, in world units
const THETA = 27; // table tilt (deg)
const EXT_X = 0.14; // plane overhang left/right (fraction of container width)
const EXT_TOP = 0.36; // plane overhang above the container (fraction of height)
const FOCUS = [900, 640];

const STATES = new Set(['STABLE', 'FORTIFIED', 'AFTERMATH']);
const t01 = (v, d = 0.3) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n / 100, 0, 1) : d;
};

/** Crop of the table world shown on the plane, by plane aspect ratio. */
function planeCrop(ar) {
  if (!ar || !Number.isFinite(ar)) ar = 0.62;
  const needW = 520 * (1 + 2 * EXT_X); // the chart (+frame) must fit the visible width
  const needH = 900;
  let h = Math.max(needH, needW / ar);
  let w = h * ar;
  if (w > WW) {
    w = WW;
    h = w / ar;
  }
  if (h > WH) {
    h = WH;
    w = h * ar;
  }
  const x0 = clamp(FOCUS[0] - w / 2, 0, WW - w);
  // keep a little more of the far table than the near edge: the far part is foreshortened
  const y0 = clamp(FOCUS[1] - h * 0.54, 0, WH - h);
  return [r1(x0), r1(y0), r1(w), r1(h)];
}

function useBox(ref) {
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const next = { w: Math.round(r.width), h: Math.round(r.height) };
        setBox((p) => (p && p.w === next.w && p.h === next.h ? p : next));
      }
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

// map-local → world
const mx = (x) => MAP.x + x;
const my = (y) => MAP.y + y;

// ---------------------------------------------------------------- path helpers
function polyline(pts) {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(y)}`).join('');
}

/** Smooth path through points (quadratic midpoints). */
function smooth(pts) {
  if (pts.length < 3) return polyline(pts);
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += `Q${r1(x)},${r1(y)} ${r1((x + nx) / 2)},${r1((y + ny) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${r1(last[0])},${r1(last[1])}`;
}

/** Point at fraction t along a polyline. */
function along(pts, t) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l);
    total += l;
  }
  let d = clamp(t, 0, 1) * total;
  for (let i = 0; i < segs.length; i += 1) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? d / segs[i] : 0;
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      return [ax + (bx - ax) * k, ay + (by - ay) * k, Math.atan2(by - ay, bx - ax)];
    }
    d -= segs[i];
  }
  return [...pts[0], 0];
}

const circ = (cx, cy, r) => `M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;

function mountain(x, y, w, h) {
  // inked peak + hatching on the shadow (left) flank
  const peak = `M${r1(x - w)},${r1(y)}L${r1(x - w * 0.12)},${r1(y - h)}L${r1(x + w * 0.12)},${r1(y - h * 0.92)}L${r1(x + w)},${r1(y)}`;
  let hatch = '';
  for (let i = 1; i <= 3; i += 1) {
    const k = i / 4.2;
    hatch += `M${r1(x - w * 0.12 - w * k * 0.85)},${r1(y - h + h * k)}l${r1(w * 0.28)},${r1(h * 0.16)}`;
  }
  return { peak, hatch };
}

function gear(cx, cy, r, teeth = 8) {
  let d = '';
  for (let i = 0; i < teeth * 2; i += 1) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.28;
    const a2 = a + Math.PI / (teeth * 2);
    d += `${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * rr)},${r1(cy + Math.sin(a) * rr)}L${r1(cx + Math.cos(a2) * rr)},${r1(cy + Math.sin(a2) * rr)}`;
  }
  return `${d}Z${circ(cx, cy, r * 0.42)}`;
}

function spiral(cx, cy, r, turns = 2.2, phase = 0) {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i += 1) {
    const k = i / n;
    const a = phase + k * turns * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r * (1 - k * 0.85), cy + Math.sin(a) * r * 0.62 * (1 - k * 0.85)]);
  }
  return smooth(pts);
}

// ---------------------------------------------------------------- the chart (map-local coords)
const NORTH_ROAD = [
  [262, 4],
  [256, 58],
  [242, 118],
  [236, 186],
  [222, 252],
  [207, 316],
];
const SOUTH_ROAD = [
  [205, 346],
  [209, 420],
  [214, 488],
  [222, 548],
  [232, 610],
  [240, 658],
];
const CAPITAL = [205, 330];
const OUTPOST = [214, 498];
const BORDER_Y = 547;

function coastX(y, rnd) {
  return 48 + Math.sin(y * 0.021) * 14 + Math.sin(y * 0.063 + 1.3) * 6 + (rnd() - 0.5) * 3;
}

function buildStatic() {
  const rnd = mulberry32(4242);
  const H = MAP.h;
  // west coast
  const coast = [];
  for (let y = 0; y <= H; y += 12) coast.push([coastX(y, rnd), y]);
  const sea = `M0,0${coast.map(([x, y]) => `L${r1(x)},${r1(y)}`).join('')}L0,${H}Z`;
  const coastLine = smooth(coast);
  const coastLine2 = smooth(coast.map(([x, y]) => [x - 7, y]));
  let waves = '';
  for (let i = 0; i < 26; i += 1) {
    const y = 14 + rnd() * (H - 28);
    const x = 8 + rnd() * (coastX(y, rnd) - 26);
    waves += `M${r1(x)},${r1(y)}q3,-3 6,0t6,0`;
  }
  // the Spine (mountains between the Frost Reaches and the Crownlands)
  let peaks = '';
  let hatch = '';
  for (let i = 0; i < 17; i += 1) {
    const x = 78 + i * 20 + (rnd() - 0.5) * 8;
    const y = 200 + Math.sin(i * 0.9) * 8 + (rnd() - 0.5) * 6;
    if (Math.abs(x - 236) < 14) continue; // the pass
    const m = mountain(x, y, 9 + rnd() * 5, 14 + rnd() * 10);
    peaks += m.peak;
    hatch += m.hatch;
  }
  // eastern hills
  for (let i = 0; i < 6; i += 1) {
    const m = mountain(330 + rnd() * 70, 380 + i * 22 + rnd() * 8, 6, 8 + rnd() * 4);
    peaks += m.peak;
    hatch += m.hatch;
  }
  // ice cracks in the north
  let cracks = '';
  for (let i = 0; i < 14; i += 1) {
    let x = 70 + rnd() * 340;
    let y = 10 + rnd() * 150;
    cracks += `M${r1(x)},${r1(y)}`;
    for (let k = 0; k < 4; k += 1) {
      x += (rnd() - 0.5) * 30;
      y += (rnd() - 0.3) * 14;
      cracks += `L${r1(x)},${r1(y)}`;
    }
  }
  // forests (west Crownlands + eastern wilds)
  let trees = '';
  const grove = (cx, cy, n, spread) => {
    for (let i = 0; i < n; i += 1) {
      const x = cx + (rnd() - 0.5) * spread;
      const y = cy + (rnd() - 0.5) * spread * 0.6;
      trees += `${circ(x, y - 3.4, 2.6)}M${r1(x)},${r1(y - 1)}v3.2`;
    }
  };
  grove(110, 280, 16, 60);
  grove(330, 250, 12, 50);
  grove(120, 420, 10, 44);
  grove(360, 480, 9, 40);
  // river: Spine → past the capital → west coast
  const river = smooth([
    [300, 214],
    [282, 252],
    [250, 286],
    [222, 318],
    [180, 360],
    [140, 392],
    [104, 420],
    [coastX(430, rnd) + 2, 432],
  ]);
  const river2 = smooth([
    [330, 300],
    [300, 330],
    [270, 342],
    [234, 334],
  ]);
  // Syndicate rail with ties
  const rail = [
    [coastX(640, rnd) + 4, 640],
    [150, 628],
    [260, 606],
    [420, 584],
  ];
  let ties = '';
  for (let i = 0; i <= 30; i += 1) {
    const [x, y, a] = along(rail, i / 30);
    const nx = -Math.sin(a) * 3;
    const ny = Math.cos(a) * 3;
    ties += `M${r1(x - nx)},${r1(y - ny)}L${r1(x + nx)},${r1(y + ny)}`;
  }
  // chimneys (Syndicate works)
  let works = '';
  for (const [x, y] of [
    [300, 600],
    [318, 596],
    [118, 616],
  ]) {
    works += `M${x - 5},${y}h10v-4h-2v-12h-3v8h-2v-6h-3Z`;
  }
  const gears = gear(96, 602, 9) + gear(352, 628, 7, 7) + gear(200, 640, 5.5, 6);
  // border: a wobbly line across the south
  const border = [];
  for (let x = coastX(BORDER_Y, rnd) - 2; x <= MAP.w + 1; x += 10) border.push([x, BORDER_Y + Math.sin(x * 0.05) * 4 + (rnd() - 0.5) * 3]);
  return {
    sea,
    coastLine,
    coastLine2,
    waves,
    peaks,
    hatch,
    cracks,
    trees,
    river,
    river2,
    rail: smooth(rail),
    ties,
    works,
    gears,
    border: smooth(border),
  };
}

let STATIC = null;
const getStatic = () => (STATIC ??= buildStatic());

/** Threat-driven ink on the chart. */
function buildThreatInk(w, s, r) {
  const rnd = mulberry32(911 + Math.round(w * 20) * 7 + Math.round(s * 20) * 131 + Math.round(r * 20) * 17);
  // blizzards over the Frost Reaches
  const nSw = w < 0.08 ? 0 : 1 + Math.round(w * 4);
  let swirls = '';
  for (let i = 0; i < nSw; i += 1) {
    const x = 100 + ((i * 97 + 31) % 290) + (rnd() - 0.5) * 20;
    const y = 36 + ((i * 53) % 110) + w * 24;
    swirls += spiral(x, y, 12 + rnd() * 9, 2.1, rnd() * 6);
  }
  let snow = '';
  const nSnow = Math.round(w * 46);
  for (let i = 0; i < nSnow; i += 1) {
    const x = 70 + rnd() * 340;
    const y = 8 + rnd() * (150 + w * 70);
    snow += `M${r1(x)},${r1(y)}l4,2.4`;
  }
  // refugee columns on the northern road
  const nRef = r < 0.06 ? 0 : Math.round(4 + r * 26);
  let column = '';
  for (let i = 0; i < nRef; i += 1) {
    const [x, y, a] = along(NORTH_ROAD, 0.04 + (0.9 * i) / Math.max(1, nRef - 1));
    const off = (rnd() - 0.5) * (4 + r * 8);
    const px = x - Math.sin(a) * off;
    const py = y + Math.cos(a) * off;
    if (i % 3 === 2) column += `M${r1(px - 2.6)},${r1(py - 1.6)}l2.6,2.6l2.6,-2.6`;
    else column += circ(px, py, 1.25 + rnd() * 0.5);
  }
  // Syndicate push: arrows aimed at the border
  const nArrow = s < 0.15 ? 0 : Math.round(1 + s * 2.4);
  let arrows = '';
  let heads = '';
  const ax = [258, 150, 345];
  for (let i = 0; i < nArrow; i += 1) {
    const x = ax[i];
    const y0 = 642;
    const y1 = BORDER_Y + 10 - s * 26;
    arrows += smooth([
      [x + 14, y0],
      [x + 4, (y0 + y1) / 2 + 6],
      [x, y1 + 6],
    ]);
    heads += `M${r1(x - 6)},${r1(y1 + 10)}L${r1(x)},${r1(y1 - 2)}L${r1(x + 6)},${r1(y1 + 10)}Z`;
  }
  return { swirls, snow, column, arrows, heads };
}

/** The chart of Elvia, drawn in map-local coordinates. */
function Chart({ uid, w, s, r, st }) {
  const S = getStatic();
  const T = useMemo(() => buildThreatInk(w, s, r), [w, s, r]);
  const ink = '#2a1e12';
  const sepia = '#5a3f22';
  const wallR = 15;
  const ringSegs = st === 'AFTERMATH' ? [0.0, 0.7, 1.55, 2.7, 3.6, 4.7] : null;
  return (
    <g transform={`translate(${MAP.x} ${MAP.y})`}>
      {/* parchment */}
      <rect x="-4" y="-4" width={MAP.w + 8} height={MAP.h + 8} fill="#000" opacity="0.45" />
      <rect width={MAP.w} height={MAP.h} fill={`url(#${uid}-parch)`} />
      <rect width={MAP.w} height={MAP.h} fill={`url(#${uid}-grainf)`} opacity="0.5" />
      {/* frozen north, Marches band, Syndicate lands */}
      <rect width={MAP.w} height={200 + w * 70} fill={`url(#${uid}-frost)`} opacity={0.55 + w * 0.35} />
      <rect y="455" width={MAP.w} height={BORDER_Y - 455} fill="#9c7a3c" opacity="0.13" />
      <rect y={BORDER_Y - s * 40} width={MAP.w} height={MAP.h - BORDER_Y + s * 40} fill={`url(#${uid}-ironwash)`} opacity={0.62 + s * 0.3} />
      {/* sea */}
      <path d={S.sea} fill="#4d5d66" opacity="0.32" />
      <path d={S.coastLine2} fill="none" stroke={sepia} strokeWidth="0.6" opacity="0.4" />
      <path d={S.coastLine} fill="none" stroke={ink} strokeWidth="1.3" opacity="0.7" />
      <path d={S.waves} fill="none" stroke={sepia} strokeWidth="0.7" opacity="0.45" />
      {/* terrain */}
      <path d={S.cracks} fill="none" stroke="#5f7180" strokeWidth="0.8" opacity="0.55" />
      <path d={S.river} fill="none" stroke="#3f5563" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d={S.river2} fill="none" stroke="#3f5563" strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
      <ellipse cx="318" cy="302" rx="17" ry="9" fill="#4d5d66" opacity="0.32" stroke={ink} strokeWidth="0.7" strokeOpacity="0.5" />
      <path d={S.trees} fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5" />
      <path d={S.peaks} fill="#efe2bf" fillOpacity="0.35" stroke={ink} strokeWidth="1.1" strokeLinejoin="round" opacity="0.8" />
      <path d={S.hatch} fill="none" stroke={ink} strokeWidth="0.7" opacity="0.55" />
      {/* Syndicate works */}
      <path d={S.rail} fill="none" stroke={ink} strokeWidth="1.2" opacity="0.6" />
      <path d={S.ties} fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5" />
      <path d={S.works} fill={ink} opacity="0.55" />
      <path d={S.gears} fill="none" stroke={ink} strokeWidth="1.1" opacity="0.6" fillRule="evenodd" />
      {/* roads */}
      <path d={smooth(NORTH_ROAD)} fill="none" stroke={sepia} strokeWidth="1.6" strokeDasharray="5 3" opacity="0.8" />
      <path d={smooth(SOUTH_ROAD)} fill="none" stroke={sepia} strokeWidth="1.8" strokeDasharray="5 3" opacity="0.85" />
      {/* the border */}
      <path d={S.border} fill="none" stroke={C.crimson600} strokeWidth="2.6" strokeDasharray="9 4 2 4" opacity="0.75" />
      {/* threat ink */}
      <path d={T.snow} fill="none" stroke="#6b7f90" strokeWidth="0.9" opacity={0.5} strokeLinecap="round" />
      <path d={T.swirls} fill="none" stroke="#56697a" strokeWidth="1.4" opacity={0.45 + w * 0.4} strokeLinecap="round" />
      <path d={T.column} fill={sepia} stroke={sepia} strokeWidth="0.9" opacity="0.85" />
      <path d={T.arrows} fill="none" stroke={C.ember600} strokeWidth="3.2" opacity="0.7" strokeLinecap="round" />
      <path d={T.heads} fill={C.ember600} opacity="0.75" />
      {/* the Crownlands capital and its Aegis ring */}
      <circle cx={CAPITAL[0]} cy={CAPITAL[1]} r="46" fill="none" stroke={C.gold700} strokeWidth="1.1" strokeDasharray="2 4" opacity="0.7" />
      <circle cx={CAPITAL[0]} cy={CAPITAL[1]} r="15" fill="#efe2bf" fillOpacity="0.4" stroke={ink} strokeWidth="1.6" opacity="0.85" />
      <circle cx={CAPITAL[0]} cy={CAPITAL[1]} r="11" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.7" />
      {/* the Southern Marches outpost */}
      {st === 'AFTERMATH' && <ellipse cx={OUTPOST[0] + 4} cy={OUTPOST[1] + 4} rx="46" ry="30" fill={`url(#${uid}-scorch)`} />}
      {st === 'FORTIFIED' && (
        <g opacity="0.85">
          <circle cx={OUTPOST[0]} cy={OUTPOST[1]} r={wallR + 9} fill="none" stroke={ink} strokeWidth="3.2" />
          <circle cx={OUTPOST[0]} cy={OUTPOST[1]} r={wallR + 9} fill="none" stroke="#efe2bf" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            return <rect key={i} x={OUTPOST[0] + Math.cos(a) * (wallR + 9) - 3.5} y={OUTPOST[1] + Math.sin(a) * (wallR + 9) - 3.5} width="7" height="7" fill={ink} />;
          })}
          {/* palisade along the border */}
          <path
            d={Array.from({ length: 30 }, (_, i) => `M${r1(66 + i * 12)},${r1(BORDER_Y - 9 + Math.sin(i * 0.6) * 2)}v-7`).join('')}
            stroke={ink}
            strokeWidth="1.6"
            opacity="0.7"
          />
        </g>
      )}
      {ringSegs ? (
        <g stroke={ink} strokeWidth="2.2" fill="none" opacity="0.7">
          {[0, 2, 4].map((k) => {
            const a0 = ringSegs[k];
            const a1 = ringSegs[k + 1];
            const R = wallR + 9;
            return (
              <path
                key={k}
                d={`M${r1(OUTPOST[0] + Math.cos(a0) * R)},${r1(OUTPOST[1] + Math.sin(a0) * R)}A${R},${R} 0 0 1 ${r1(OUTPOST[0] + Math.cos(a1) * R)},${r1(OUTPOST[1] + Math.sin(a1) * R)}`}
              />
            );
          })}
          <path d={`M${OUTPOST[0] - 28},${OUTPOST[1] - 22}l9,7m-4,-9l-2,10M${OUTPOST[0] + 26},${OUTPOST[1] + 16}l-8,-6`} strokeWidth="1.4" />
        </g>
      ) : null}
      <path
        d={`M${OUTPOST[0] - 7},${OUTPOST[1] + 6}v-11h3v3h2.5v-3h3v3h2.5v-3h3v11Z`}
        fill={st === 'AFTERMATH' ? '#3a2a1c' : ink}
        opacity={st === 'AFTERMATH' ? 0.6 : 0.85}
      />
      {/* labels */}
      <g fontFamily="Cinzel, 'Cormorant Garamond', Georgia, serif" fill={ink} textAnchor="middle">
        <text x="238" y="40" fontSize="12.5" letterSpacing="5" opacity="0.62">
          THE FROST REACHES
        </text>
        <text x="300" y="232" fontSize="7.5" letterSpacing="3" opacity="0.55">
          THE SPINE
        </text>
        <text x="236" y="392" fontSize="15" letterSpacing="5" opacity="0.66">
          THE CROWNLANDS
        </text>
        <text x="300" y="478" fontSize="9" letterSpacing="3.4" opacity="0.62">
          SOUTHERN MARCHES
        </text>
        <text x="236" y="590" fontSize="11" letterSpacing="4.4" opacity="0.6" fill="#1b1d21">
          IRON SYNDICATE
        </text>
        <text x="27" y="330" fontSize="7" letterSpacing="2.5" opacity="0.45" transform="rotate(-90 27 330)">
          THE GREY SEA
        </text>
      </g>
      {/* compass rose */}
      <g transform="translate(372 96)" opacity="0.7">
        <circle r="24" fill="none" stroke={sepia} strokeWidth="0.8" />
        <circle r="19" fill="none" stroke={sepia} strokeWidth="0.5" strokeDasharray="1 2" />
        <path d="M0,-28L4,-4L28,0L4,4L0,28L-4,4L-28,0L-4,-4Z" fill="#efe2bf" fillOpacity="0.5" stroke={ink} strokeWidth="0.8" />
        <path d="M0,-28L4,-4L0,0Z M28,0L4,4L0,0Z M0,28L-4,4L0,0Z M-28,0L-4,-4L0,0Z" fill={ink} opacity="0.7" />
        <path d="M0,-34l3,5h-6Z" fill={C.crimson600} />
      </g>
      {/* cartouche */}
      <g transform="translate(110 500)" opacity="0.75">
        <path d="M-34,-12h68l6,12l-6,12h-68l-6,-12Z" fill="#efe2bf" fillOpacity="0.45" stroke={ink} strokeWidth="0.9" />
        <text y="4.5" fontFamily="Cinzel, Georgia, serif" fontSize="12" letterSpacing="5" textAnchor="middle" fill={ink}>
          ELVIA
        </text>
      </g>
      {/* aged edges */}
      <rect width={MAP.w} height={MAP.h} fill={`url(#${uid}-burn)`} />
      <rect x="0.5" y="0.5" width={MAP.w - 1} height={MAP.h - 1} fill="none" stroke="#3a2a16" strokeWidth="1" opacity="0.6" />
    </g>
  );
}

// ---------------------------------------------------------------- table, leather, props (world coords)
function buildWood() {
  const rnd = mulberry32(77);
  let dark = '';
  let light = '';
  for (let i = 0; i < 90; i += 1) {
    const y = rnd() * WH;
    const amp = 2 + rnd() * 7;
    const f = 0.002 + rnd() * 0.004;
    const ph = rnd() * 6;
    const pts = [];
    for (let x = -20; x <= WW + 20; x += 60) pts.push([x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3]);
    if (i % 3 === 0) light += smooth(pts);
    else dark += smooth(pts);
  }
  // plank seams
  let seams = '';
  for (let y = 70; y < WH; y += 190) seams += `M0,${y + Math.round(rnd() * 6)}H${WW}`;
  return { dark, light, seams };
}
let WOOD = null;
const getWood = () => (WOOD ??= buildWood());

function TableSvg({ uid, crop, w, s, r, st }) {
  const wood = getWood();
  const [x0, y0, vw, vh] = crop;
  const L = { x: 612, y: 228, w: 576, h: 812 }; // leather inlay
  return (
    <svg viewBox={`${x0} ${y0} ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: 'absolute', inset: 0, display: 'block' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140d08" />
          <stop offset="0.5" stopColor="#24170e" />
          <stop offset="1" stopColor="#1b110a" />
        </linearGradient>
        <radialGradient id={`${uid}-leather`} cx="50%" cy="48%" r="62%">
          <stop offset="0" stopColor="#1d2c47" />
          <stop offset="0.7" stopColor="#111c30" />
          <stop offset="1" stopColor="#0a111e" />
        </radialGradient>
        <linearGradient id={`${uid}-brass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.brass300} />
          <stop offset="0.45" stopColor={C.brass500} />
          <stop offset="1" stopColor={C.brass700} />
        </linearGradient>
        <linearGradient id={`${uid}-parch`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#dccfaa" />
          <stop offset="0.5" stopColor="#d3c399" />
          <stop offset="1" stopColor="#c4b085" />
        </linearGradient>
        <linearGradient id={`${uid}-frost`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe6ea" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#c8d3da" stopOpacity="0.6" />
          <stop offset="1" stopColor="#c8d3da" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-ironwash`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f57" stopOpacity="0" />
          <stop offset="0.18" stopColor="#4a4f57" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2b2f35" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${uid}-scorch`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#120b06" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#3b220f" stopOpacity="0.55" />
          <stop offset="0.8" stopColor="#6b4520" stopOpacity="0.2" />
          <stop offset="1" stopColor="#6b4520" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-burn`} cx="50%" cy="50%" r="72%">
          <stop offset="0.62" stopColor="#5a3a18" stopOpacity="0" />
          <stop offset="0.92" stopColor="#4a2e12" stopOpacity="0.4" />
          <stop offset="1" stopColor="#2a180a" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`${uid}-tablevig`} cx="50%" cy="47%" r="58%">
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.78" />
        </radialGradient>
        <radialGradient id={`${uid}-pinshadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.55 -0.1" />
        </filter>
        <pattern id={`${uid}-grainf`} width={MAP.w} height={MAP.h} patternUnits="userSpaceOnUse" x={MAP.x} y={MAP.y}>
          <rect width={MAP.w} height={MAP.h} filter={`url(#${uid}-grain)`} />
        </pattern>
      </defs>
      {/* wood */}
      <rect x="0" y="0" width={WW} height={WH} fill={`url(#${uid}-wood)`} />
      <path d={wood.dark} fill="none" stroke="#0b0604" strokeWidth="2.2" opacity="0.5" />
      <path d={wood.light} fill="none" stroke="#4a3220" strokeWidth="1.4" opacity="0.32" />
      <path d={wood.seams} fill="none" stroke="#050302" strokeWidth="3" opacity="0.7" />
      {/* tooled navy leather inlay with a gold border */}
      <rect x={L.x - 10} y={L.y - 10} width={L.w + 20} height={L.h + 20} rx="6" fill="#0a0604" opacity="0.6" />
      <rect x={L.x} y={L.y} width={L.w} height={L.h} rx="3" fill={`url(#${uid}-leather)`} />
      <rect x={L.x + 9} y={L.y + 9} width={L.w - 18} height={L.h - 18} fill="none" stroke={C.gold600} strokeWidth="1.6" opacity="0.6" />
      <rect x={L.x + 15} y={L.y + 15} width={L.w - 30} height={L.h - 30} fill="none" stroke={C.gold700} strokeWidth="0.8" strokeDasharray="1 5" opacity="0.7" />
      <rect x={L.x - 3} y={L.y - 3} width={L.w + 6} height={L.h + 6} rx="4" fill="none" stroke={`url(#${uid}-brass)`} strokeWidth="5" />
      {[
        [L.x, L.y],
        [L.x + L.w, L.y],
        [L.x, L.y + L.h],
        [L.x + L.w, L.y + L.h],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="11" fill={`url(#${uid}-brass)`} stroke="#3a2a14" strokeWidth="1.2" />
          <circle cx={x} cy={y} r="4" fill={C.brass700} />
        </g>
      ))}
      <Props uid={uid} />
      {/* the chart */}
      <Chart uid={uid} w={w} s={s} r={r} st={st} />
      {/* thread between pins: capital → outpost (and the north road when refugees press) */}
      <path
        d={`M${mx(CAPITAL[0])},${my(CAPITAL[1])}Q${mx(CAPITAL[0] + 22)},${my(420)} ${mx(OUTPOST[0])},${my(OUTPOST[1])}`}
        fill="none"
        stroke={C.gold500}
        strokeWidth="1.3"
        opacity="0.8"
      />
      {r > 0.3 && (
        <path d={`M${mx(236)},${my(186)}Q${mx(196)},${my(250)} ${mx(CAPITAL[0])},${my(CAPITAL[1])}`} fill="none" stroke={C.ember500} strokeWidth="1.3" opacity="0.85" />
      )}
      {s > 0.3 && (
        <path d={`M${mx(OUTPOST[0])},${my(OUTPOST[1])}L${mx(258)},${my(612 - s * 50)}`} fill="none" stroke={C.crimson500} strokeWidth="1.3" opacity="0.85" />
      )}
      {/* pin and figurine contact shadows */}
      {shadowSpots(w, s, r, st).map(([x, y, rx], i) => (
        <ellipse key={i} cx={x} cy={y + rx * 0.2} rx={rx} ry={rx * 0.55} fill={`url(#${uid}-pinshadow)`} />
      ))}
      <rect x="0" y="0" width={WW} height={WH} fill={`url(#${uid}-tablevig)`} />
    </svg>
  );
}

/** Desk clutter beside the chart (seen mostly on wide screens). */
function Props({ uid }) {
  const lines = (x, y, n, len, gap = 9) =>
    Array.from({ length: n }, (_, i) => `M${x},${y + i * gap}h${r1(len * (0.55 + ((i * 37) % 45) / 100))}`).join('');
  return (
    <g>
      {/* left: dispatches with a wax seal, inkwell and quill */}
      <g transform="rotate(-8 450 560)">
        <rect x="350" y="430" width="200" height="270" fill="#000" opacity="0.4" transform="translate(6 8)" />
        <rect x="350" y="430" width="200" height="270" fill="#cdbd94" />
        <rect x="362" y="420" width="200" height="270" fill="#d8caa2" />
        <path d={lines(382, 460, 20, 160, 11)} stroke="#4a3520" strokeWidth="1.6" opacity="0.4" />
        <circle cx="520" cy="660" r="15" fill={C.crimson600} />
        <circle cx="520" cy="660" r="10" fill="none" stroke={C.crimson400} strokeWidth="1.4" opacity="0.6" />
      </g>
      <g transform="rotate(14 470 840)">
        <rect x="380" y="770" width="180" height="120" fill="#000" opacity="0.4" transform="translate(5 7)" />
        <rect x="380" y="770" width="180" height="120" fill="#cdbd94" />
        <path d={lines(398, 795, 8, 140, 11)} stroke="#4a3520" strokeWidth="1.5" opacity="0.38" />
      </g>
      <circle cx="560" cy="350" r="30" fill="#000" opacity="0.45" transform="translate(4 6)" />
      <circle cx="560" cy="350" r="30" fill="#14181f" stroke={`url(#${uid}-brass)`} strokeWidth="4" />
      <circle cx="560" cy="350" r="15" fill="#05070b" />
      <path d="M560,350 C520,300 470,250 420,232 C470,262 512,300 556,352 Z" fill="#e8dfc8" opacity="0.8" />
      {/* right: brass astrolabe, dividers, token tray, scroll */}
      <g transform="translate(1390 420)">
        <circle r="96" fill="#000" opacity="0.4" transform="translate(6 9)" />
        <circle r="96" fill="none" stroke={`url(#${uid}-brass)`} strokeWidth="9" />
        <circle r="80" fill="none" stroke={C.brass500} strokeWidth="2" opacity="0.8" />
        <circle r="62" fill="none" stroke={C.brass500} strokeWidth="1.2" strokeDasharray="2 6" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const l = i % 3 === 0 ? 10 : 5;
          return <path key={i} d={`M${r1(Math.cos(a) * 80)},${r1(Math.sin(a) * 80)}L${r1(Math.cos(a) * (80 - l))},${r1(Math.sin(a) * (80 - l))}`} stroke={C.brass300} strokeWidth="1.2" opacity="0.7" />;
        })}
        <path d="M0,-58L50,29L-50,29Z M0,58L-50,-29L50,-29Z" fill="none" stroke={C.gold500} strokeWidth="1.3" opacity="0.75" />
        <path d="M-88,-18L88,18" stroke={`url(#${uid}-brass)`} strokeWidth="6" strokeLinecap="round" />
        <circle r="9" fill={C.brass300} stroke={C.brass700} strokeWidth="2" />
      </g>
      <g transform="rotate(-24 1340 760)">
        <path d="M1340,640 L1318,880 M1340,640 L1372,876" stroke={C.brass500} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="1340" cy="640" r="9" fill={C.brass300} stroke={C.brass700} strokeWidth="2" />
      </g>
      <rect x="1260" y="930" width="180" height="80" rx="10" fill="#000" opacity="0.4" transform="translate(5 7)" />
      <rect x="1260" y="930" width="180" height="80" rx="10" fill="#2a1a10" stroke={`url(#${uid}-brass)`} strokeWidth="3" />
      {[
        [1290, 955, '#d9e2e8'],
        [1318, 968, '#d9e2e8'],
        [1350, 952, C.iron500],
        [1384, 972, C.iron500],
        [1300, 990, C.gold500],
        [1410, 948, C.ember500],
        [1350, 990, C.gold500],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="10" fill={c} stroke="#000" strokeOpacity="0.4" strokeWidth="1.5" />
      ))}
      <g transform="rotate(10 1300 280)">
        <rect x="1180" y="262" width="250" height="38" rx="19" fill="#000" opacity="0.4" transform="translate(4 7)" />
        <rect x="1180" y="262" width="250" height="38" rx="19" fill="#cdbd94" />
        <rect x="1180" y="262" width="250" height="14" rx="7" fill="#e3d6b2" opacity="0.7" />
        <ellipse cx="1430" cy="281" rx="9" ry="19" fill="#a8956a" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------- upright pieces
function placements(w, s, r, st) {
  const out = [];
  // candles: two hold the chart's far corners, two stand at the near corners
  out.push({ k: 'c1', type: 'candle', x: mx(8), y: my(10), w: 30, h: 1.15, seed: 1 });
  out.push({ k: 'c2', type: 'candle', x: mx(MAP.w - 6), y: my(6), w: 30, h: 1.4, seed: 2 });
  out.push({ k: 'c3', type: 'candle', x: mx(4), y: my(MAP.h - 4), w: 34, h: 0.8, seed: 3 });
  out.push({ k: 'c4', type: 'candle', x: mx(MAP.w - 2), y: my(MAP.h + 2), w: 34, h: 1.0, seed: 4 });
  // far-side candelabra lights for the desk (wide screens)
  out.push({ k: 'c5', type: 'candle', x: 470, y: 300, w: 30, h: 1.6, seed: 5 });
  out.push({ k: 'c6', type: 'candle', x: 1520, y: 640, w: 32, h: 1.2, seed: 6 });
  // the crown pin at the capital
  out.push({ k: 'crown', type: 'pin', x: mx(CAPITAL[0]), y: my(CAPITAL[1]), w: 12, head: 'gold', tall: 1.25 });
  // Marches standard
  out.push({ k: 'banner', type: 'banner', x: mx(OUTPOST[0] + 6), y: my(OUTPOST[1] - 2), w: 26, fallen: st === 'AFTERMATH', state: st });
  if (st === 'FORTIFIED') {
    out.push({ k: 'wall1', type: 'block', x: mx(OUTPOST[0] - 34), y: my(OUTPOST[1] + 26), w: 16 });
    out.push({ k: 'wall2', type: 'block', x: mx(OUTPOST[0] + 36), y: my(OUTPOST[1] + 30), w: 16 });
  }
  if (st === 'AFTERMATH') {
    out.push({ k: 'smoke1', type: 'smoke', x: mx(OUTPOST[0] - 6), y: my(OUTPOST[1] + 6), w: 44, seed: 1 });
    out.push({ k: 'smoke2', type: 'smoke', x: mx(OUTPOST[0] + 22), y: my(OUTPOST[1] + 14), w: 34, seed: 2 });
  }
  // Frost Warg pins (bone white) moving south as the threat grows
  const nW = w < 0.08 ? 0 : 1 + Math.floor(w * 3.99);
  const wp = [
    [150, 92],
    [312, 70],
    [214, 132],
    [372, 150],
  ];
  for (let i = 0; i < nW; i += 1) out.push({ k: `w${i}`, type: 'pin', x: mx(wp[i][0]), y: my(wp[i][1] + w * 34), w: 11, head: 'frost', tall: 1 });
  // refugee pin at the pass
  if (r > 0.25) out.push({ k: 'ref', type: 'pin', x: mx(236), y: my(186), w: 11, head: 'ember', tall: 0.9 });
  // Iron Syndicate walkers press toward the border
  const nS = s < 0.08 ? 0 : 1 + Math.floor(s * 3.99);
  const sp = [
    [258, 612 - s * 56],
    [150, 630 - s * 30],
    [346, 636 - s * 28],
    [90, 646 - s * 16],
  ];
  for (let i = 0; i < nS; i += 1) out.push({ k: `s${i}`, type: 'walker', x: mx(sp[i][0]), y: my(sp[i][1]), w: i === 0 ? 30 : 25 });
  return out;
}

function shadowSpots(w, s, r, st) {
  return placements(w, s, r, st)
    .filter((p) => p.type !== 'smoke')
    .map((p) => [p.x + 2, p.y + 1, p.type === 'candle' ? p.w * 0.9 : p.type === 'walker' ? p.w * 0.62 : p.w * 0.5]);
}

const HEADS = {
  gold: [C.gold200, C.gold500, C.gold800],
  frost: ['#ffffff', '#d9e2e8', '#6f7f8c'],
  ember: [C.ember200, C.ember400, C.ember600],
};

function PinArt({ uid, head, tall = 1 }) {
  const [a, b, c] = HEADS[head] || HEADS.gold;
  const top = 40 - 30 * tall;
  return (
    <svg viewBox="0 0 12 40" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-h${head}`} cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor={a} />
          <stop offset="0.45" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <path d={`M6,40V${top + 5}`} stroke="#cfd3d6" strokeWidth="1" />
      <path d={`M6.5,40V${top + 5}`} stroke="#5d636b" strokeWidth="0.5" />
      <circle cx="6" cy={top} r="5.2" fill={`url(#${uid}-h${head})`} />
      {head === 'gold' && <path d={`M3,${top + 1}l0.8,-3.4 1.4,1.6 0.8,-2.4 0.8,2.4 1.4,-1.6 0.8,3.4Z`} fill={C.gold800} opacity="0.7" />}
    </svg>
  );
}

function WalkerArt({ uid }) {
  // iron miniature: a three-legged Syndicate walker on a round base
  return (
    <svg viewBox="0 0 40 52" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-ir`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1b1d21" />
          <stop offset="0.6" stopColor="#4a4f57" />
          <stop offset="1" stopColor="#7d838b" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="47" rx="17" ry="5" fill="#22252a" />
      <ellipse cx="20" cy="45.5" rx="17" ry="5" fill={`url(#${uid}-ir)`} />
      <path d="M12,24 L5,45 M28,24 L35,45 M20,26 L21,46" stroke={`url(#${uid}-ir)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M9,12 Q20,4 31,12 L33,24 Q20,30 7,24 Z" fill={`url(#${uid}-ir)`} stroke="#0e0f12" strokeWidth="1" />
      <path d="M13,16 H27" stroke={C.ember400} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <path d="M17,6 V1 M23,6 V2" stroke="#33373d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BannerArt({ fallen }) {
  return (
    <svg viewBox="0 0 26 64" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <g transform={fallen ? 'rotate(-38 6 64)' : undefined}>
        <path d="M6,64V3" stroke={C.brass300} strokeWidth="1.8" />
        <circle cx="6" cy="3" r="2.4" fill={C.gold400} />
        <path d="M7,5 H25 L21,13 L25,21 H7 Z" fill={fallen ? '#3a2a2a' : C.navy700} stroke={C.gold500} strokeWidth="0.9" />
        <path d="M14,9 l3,4 l-3,4 l-3,-4 Z" fill={fallen ? C.gold800 : C.gold400} />
      </g>
    </svg>
  );
}

function BlockArt() {
  return (
    <svg viewBox="0 0 16 14" width="100%" height="100%" style={{ display: 'block' }} aria-hidden="true">
      <path d="M1,4 L8,1 L15,4 L15,11 L8,14 L1,11 Z" fill={C.brass700} />
      <path d="M1,4 L8,7 L15,4 L8,1 Z" fill={C.brass300} />
      <path d="M8,7 L15,4 L15,11 L8,14 Z" fill={C.brass500} />
      <path d="M3,4.2v-1.6h2v1M11,4.2v-1.6h2v1" stroke={C.brass300} strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CandleArt({ uid, h = 1, seed = 1 }) {
  const rnd = mulberry32(seed * 101);
  const bodyTop = 120 - 70 * h;
  const drip = (x) => `M${x},${bodyTop}v${r1(6 + rnd() * 14)}a2,2 0 0 0 4,0v${r1(-(4 + rnd() * 6))}`;
  return (
    <svg viewBox="0 0 40 130" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b5236" />
          <stop offset="0.35" stopColor="#c9ad80" />
          <stop offset="0.7" stopColor="#ecdcb6" />
          <stop offset="1" stopColor="#b39669" />
        </linearGradient>
        <linearGradient id={`${uid}-waxglow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9ae" stopOpacity="0.75" />
          <stop offset="0.35" stopColor="#f4a35e" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={`${uid}-dish`} cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor={C.brass300} />
          <stop offset="0.6" stopColor={C.brass500} />
          <stop offset="1" stopColor={C.brass700} />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="124" rx="19" ry="5.5" fill={C.brass700} />
      <ellipse cx="20" cy="122" rx="19" ry="5.5" fill={`url(#${uid}-dish)`} />
      <rect x="10" y={bodyTop} width="20" height={121 - bodyTop} fill={`url(#${uid}-wax)`} />
      <rect x="10" y={bodyTop} width="20" height={121 - bodyTop} fill={`url(#${uid}-waxglow)`} />
      <path d={`${drip(11)}${drip(23)}`} fill="#e9d6ad" opacity="0.9" />
      <ellipse cx="20" cy={bodyTop} rx="10" ry="2.6" fill="#f3e6c4" />
      <ellipse cx="20" cy={bodyTop + 0.4} rx="6" ry="1.4" fill="#d9b77f" opacity="0.8" />
      <path d={`M20,${bodyTop}v-5`} stroke="#1a120c" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FlameArt({ uid }) {
  return (
    <svg viewBox="0 0 20 40" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-fl`} cx="50%" cy="72%" r="62%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.3" stopColor="#ffe9ae" />
          <stop offset="0.62" stopColor={C.ember300} stopOpacity="0.95" />
          <stop offset="1" stopColor={C.ember500} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M10,2 C13,12 17,19 16,27 C15.3,33 12.8,37 10,37 C7.2,37 4.7,33 4,27 C3,19 7,12 10,2 Z" fill={`url(#${uid}-fl)`} />
      <path d="M10,17 C11.5,23 12.6,27 12.2,30.5 C11.9,33 11,35 10,35 C9,35 8.1,33 7.8,30.5 C7.4,27 8.5,23 10,17 Z" fill="#fffaf0" opacity="0.9" />
    </svg>
  );
}

function SmokeArt({ uid, seed }) {
  return (
    <svg viewBox="0 0 40 120" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sm${seed}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#4a4038" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#5a5048" stopOpacity="0.4" />
          <stop offset="1" stopColor="#6a6058" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={seed === 1 ? 'M20,120 C10,100 26,88 18,70 C10,52 30,40 22,20 C18,10 26,4 24,0 L34,0 C36,14 28,26 34,44 C40,62 22,74 30,92 C34,104 28,112 24,120Z' : 'M18,120 C26,104 12,92 20,74 C26,60 12,46 20,28 C24,18 16,8 18,0 L28,0 C30,12 34,24 28,38 C22,54 36,66 28,84 C22,98 30,110 26,120Z'}
        fill={`url(#${uid}-sm${seed})`}
      />
    </svg>
  );
}

// ---------------------------------------------------------------- component
const STYLE = `
@keyframes wrb-flicker { 0%{opacity:1;transform:scale(1,1)} 9%{opacity:.86;transform:scale(.96,1.05)} 17%{opacity:1;transform:scale(1.02,.96)} 31%{opacity:.9;transform:scale(.97,1.03)} 48%{opacity:1;transform:scale(1,1.06)} 63%{opacity:.82;transform:scale(1.03,.95)} 79%{opacity:.97;transform:scale(.98,1.02)} 100%{opacity:1;transform:scale(1,1)} }
@keyframes wrb-glow { 0%{opacity:.92} 13%{opacity:.74} 27%{opacity:.95} 41%{opacity:.82} 58%{opacity:1} 73%{opacity:.78} 88%{opacity:.9} 100%{opacity:.92} }
@keyframes wrb-sway { 0%,100%{transform:rotate(-0.7deg)} 50%{transform:rotate(0.9deg)} }
@keyframes wrb-breathe { 0%,100%{opacity:.8} 50%{opacity:1} }
@keyframes wrb-smoke { 0%{opacity:.0;transform:translateY(8%) scaleX(.9)} 30%{opacity:.85} 100%{opacity:0;transform:translateY(-14%) scaleX(1.15)} }
`;

function Billboard({ crop, p, aspect, children, z = 0 }) {
  const [x0, y0, vw, vh] = crop;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${((p.x - x0) / vw) * 100}%`,
        top: `${((p.y - y0) / vh) * 100}%`,
        width: `${(p.w / vw) * 100}%`,
        aspectRatio: aspect,
        transform: `translate(-50%, -100%) translateZ(${z}px) rotateX(${-THETA}deg)`,
        transformOrigin: '50% 100%',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
}

function pieceFor(uid, p, crop, motion, i) {
  const key = p.k;
  if (p.type === 'candle') {
    const dur = 1.7 + ((p.seed * 0.37) % 1) * 1.6;
    const anim = motion ? `wrb-flicker ${dur}s ease-in-out ${-p.seed * 0.41}s infinite` : 'none';
    const glow = motion ? `wrb-glow ${dur * 1.6}s ease-in-out ${-p.seed * 0.7}s infinite` : 'none';
    const bodyTop = (120 - 70 * p.h) / 130; // fraction of the candle box
    return (
      <Billboard key={key} crop={crop} p={p} aspect="40 / 130">
        {/* halo: big soft glow around the flame */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${bodyTop * 100 - 9}%`,
            width: '720%',
            aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgb(255 233 174 / 0.42) 0%, rgb(244 163 94 / 0.16) 22%, rgb(224 120 43 / 0.05) 48%, transparent 70%)',
            animation: glow,
            pointerEvents: 'none',
          }}
        />
        <CandleArt uid={`${uid}c${i}`} h={p.h} seed={p.seed} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${bodyTop * 100 - 4}%`,
            width: '46%',
            aspectRatio: '20 / 40',
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div style={{ width: '100%', height: '100%', transformOrigin: '50% 92%', animation: anim }}>
            <FlameArt uid={`${uid}f${i}`} />
          </div>
        </div>
      </Billboard>
    );
  }
  if (p.type === 'pin')
    return (
      <Billboard key={key} crop={crop} p={p} aspect="12 / 40">
        <PinArt uid={`${uid}p${i}`} head={p.head} tall={p.tall} />
      </Billboard>
    );
  if (p.type === 'walker')
    return (
      <Billboard key={key} crop={crop} p={p} aspect="40 / 52">
        <WalkerArt uid={`${uid}w${i}`} />
      </Billboard>
    );
  if (p.type === 'banner')
    return (
      <Billboard key={key} crop={crop} p={p} aspect="26 / 64">
        <BannerArt fallen={p.fallen} />
      </Billboard>
    );
  if (p.type === 'block')
    return (
      <Billboard key={key} crop={crop} p={p} aspect="16 / 14">
        <BlockArt />
      </Billboard>
    );
  if (p.type === 'smoke')
    return (
      <Billboard key={key} crop={crop} p={p} aspect="40 / 120">
        <div style={{ width: '100%', height: '100%', animation: motion ? `wrb-smoke ${5 + p.seed * 1.7}s linear ${-p.seed * 2.1}s infinite` : 'none', opacity: motion ? undefined : 0.7 }}>
          <SmokeArt uid={`${uid}s${i}`} seed={p.seed} />
        </div>
      </Billboard>
    );
  return null;
}

/** Warm light pools on the table under each candle (flat, flickering). */
function LightPools({ crop, list, motion }) {
  const [x0, y0, vw, vh] = crop;
  return list
    .filter((p) => p.type === 'candle')
    .map((p) => {
      const R = 300;
      return (
        <div
          key={`l${p.k}`}
          style={{
            position: 'absolute',
            left: `${((p.x - x0) / vw) * 100}%`,
            top: `${((p.y - y0) / vh) * 100}%`,
            width: `${((R * 2) / vw) * 100}%`,
            aspectRatio: '1',
            transform: 'translate(-50%, -50%) translateZ(0.5px)',
            background: 'radial-gradient(circle, rgb(255 214 150 / 0.30) 0%, rgb(240 160 80 / 0.13) 30%, rgb(224 120 43 / 0.04) 58%, transparent 72%)',
            animation: motion ? `wrb-glow ${2.6 + p.seed * 0.53}s ease-in-out ${-p.seed * 0.9}s infinite` : 'none',
            pointerEvents: 'none',
          }}
        />
      );
    });
}

// ---------------------------------------------------------------- the room around the table
/** A hanging standard of Elvia: navy cloth, gold border, the broken circle and star. */
function HangingBanner({ uid, flip = false }) {
  const id = `${uid}hb${flip ? 'r' : 'l'}`;
  return (
    <svg viewBox="0 0 120 400" width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined }} focusable="false">
      <defs>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#070d18" />
          <stop offset="0.18" stopColor="#16243a" />
          <stop offset="0.34" stopColor="#0b1424" />
          <stop offset="0.55" stopColor="#1f3150" />
          <stop offset="0.72" stopColor="#0f1b2d" />
          <stop offset="0.9" stopColor="#2b4268" />
          <stop offset="1" stopColor="#0f1b2d" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.3" stopColor="#000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e9bd" />
          <stop offset="0.45" stopColor="#c9a227" />
          <stop offset="1" stopColor="#4f3d0d" />
        </linearGradient>
      </defs>
      {/* rod and finials */}
      <rect x="2" y="14" width="116" height="7" rx="3.5" fill={`url(#${id}-gold)`} />
      <circle cx="4" cy="17.5" r="6" fill={`url(#${id}-gold)`} />
      <circle cx="116" cy="17.5" r="6" fill={`url(#${id}-gold)`} />
      <path d="M30 0v16M90 0v16" stroke="#7a5f36" strokeWidth="1.6" />
      {/* cloth with a swallowtail */}
      <path d="M10 20H110V352L60 318 10 352Z" fill={`url(#${id}-cloth)`} />
      <path d="M10 20H110V352L60 318 10 352Z" fill={`url(#${id}-shade)`} />
      <path d="M17 26H103V338L60 308 17 338Z" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.4" />
      <path d="M22 31H98V328L60 301 22 328Z" fill="none" stroke="#c9a227" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="1 3" />
      {/* the broken circle and star */}
      <g transform="translate(60 150)" fill="none" stroke={`url(#${id}-gold)`} strokeLinecap="round">
        <path d="M-6 -27.3A28 28 0 1 0 22 -17" strokeWidth="4" />
        <path d="M0 -14L3.5 -3.5 14 0 3.5 3.5 0 14 -3.5 3.5 -14 0 -3.5 -3.5Z" fill="#e3c463" stroke="#f6e9bd" strokeWidth="0.8" />
      </g>
      <path d="M36 220h48M44 228h32" stroke="#c9a227" strokeOpacity="0.6" strokeWidth="1.4" />
      <path d="M60 248l7 7-7 7-7-7Z" fill="#c9a227" opacity="0.7" />
      {/* tassels */}
      <path d="M10 352v24M110 352v24" stroke="#a8841b" strokeWidth="2" />
      <circle cx="10" cy="378" r="4" fill="#c9a227" />
      <circle cx="110" cy="378" r="4" fill="#c9a227" />
      {/* key-light rim along the lit edge */}
      <path d="M110 22V350" stroke="#ffe9ae" strokeOpacity="0.28" strokeWidth="2" />
    </svg>
  );
}

const SHAFT = { top: 0.86, bottom: 0.28, width: 0.36 };

/** Window light, out-of-focus foreground standards and candle bokeh, dust in the beam. */
function RoomLayer({ uid, motion, wide }) {
  return (
    <>
      {/* a shaft of high-window light from the upper right, falling across the table */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(112deg, transparent 0%, transparent 46%, rgb(255 233 174 / 0.05) 54%, rgb(255 244 214 / 0.11) 62%, rgb(255 233 174 / 0.06) 70%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, rgb(0 0 0 / 0.8) 35%, transparent 80%)',
          maskImage: 'linear-gradient(180deg, #000 0%, rgb(0 0 0 / 0.8) 35%, transparent 80%)',
          mixBlendMode: 'screen',
          animation: motion ? 'wrb-breathe 9s ease-in-out infinite' : 'none',
        }}
      />
      <Motes count={wide ? 56 : 34} shaft={SHAFT} seed={23} opacity={0.9} />
      {/* foreground standards, close to the lens: soft focus */}
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          style={{
            position: 'absolute',
            top: wide ? '-1%' : '7%',
            [flip ? 'right' : 'left']: wide ? '1.5%' : '-11%',
            width: wide ? 'min(10vw, 140px)' : '24vw',
            height: wide ? '64%' : '52%',
            filter: 'blur(1.4px) brightness(0.78)',
            transformOrigin: '50% 0%',
            animation: motion ? `wrb-sway ${11 + (flip ? 2.3 : 0)}s ease-in-out ${flip ? -4 : 0}s infinite` : 'none',
            pointerEvents: 'none',
          }}
        >
          <HangingBanner uid={uid} flip={flip} />
        </div>
      ))}
      {/* candle bokeh: out-of-focus flames between the lens and the table */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: [
            'radial-gradient(circle at 6% 90%, rgb(255 214 150 / 0.16) 0, rgb(255 214 150 / 0.1) 3vmax, transparent 3.4vmax)',
            'radial-gradient(circle at 14% 97%, rgb(244 163 94 / 0.11) 0, rgb(244 163 94 / 0.07) 4.2vmax, transparent 4.6vmax)',
            'radial-gradient(circle at 94% 86%, rgb(255 214 150 / 0.13) 0, rgb(255 214 150 / 0.08) 3.5vmax, transparent 3.9vmax)',
            'radial-gradient(circle at 86% 98%, rgb(244 163 94 / 0.1) 0, rgb(244 163 94 / 0.06) 5vmax, transparent 5.4vmax)',
          ].join(','),
        }}
      />
    </>
  );
}

function WarRoomBackdropImpl({ threats, regionState = 'STABLE', dim = true, className = '', style }) {
  const uid = useUid('wrb');
  const ref = useRef(null);
  const box = useBox(ref);
  const reduced = useReducedMotion();
  const motion = !reduced;

  const w = t01(threats?.wargs);
  const s = t01(threats?.syndicate);
  const r = t01(threats?.refugees);
  const st = STATES.has(String(regionState).toUpperCase()) ? String(regionState).toUpperCase() : 'STABLE';

  const W = box?.w ?? 390;
  const H = box?.h ?? 844;
  const planeW = W * (1 + 2 * EXT_X);
  const planeH = H * (1 + EXT_TOP);
  const crop = planeCrop(planeW / planeH);
  const list = useMemo(() => placements(w, s, r, st), [w, s, r, st]);
  const persp = Math.round(Math.max(700, H * 1.35, W * 0.75));

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: '#04070d', ...style }}
      data-region-state={st}
    >
      <style>{STYLE}</style>
      {/* the room beyond the table: dark stone, a faint brass lattice sigil on the wall */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(90% 45% at 50% 0%, #142035 0%, #0b1424 45%, #05080f 100%)',
        }}
      />
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMin slice" width="100%" height="34%" style={{ position: 'absolute', left: 0, top: 0, opacity: 0.16 }} aria-hidden="true">
        <g transform="translate(200 74)" fill="none" stroke={C.gold500}>
          <circle r="62" strokeWidth="0.8" />
          <circle r="54" strokeWidth="0.4" strokeDasharray="1 3" />
          <path d="M0,-62 L53.7,31 L-53.7,31 Z M0,62 L-53.7,-31 L53.7,-31 Z" strokeWidth="0.6" />
          <circle r="20" strokeWidth="0.6" />
        </g>
        <path d="M0,200 V40 Q60,10 120,40 V200 M280,200 V40 Q340,10 400,40 V200" fill="none" stroke={C.stone600} strokeWidth="1" opacity="0.6" />
      </svg>
      {/* the tilted table */}
      <div style={{ position: 'absolute', inset: 0, perspective: `${persp}px`, perspectiveOrigin: '50% 8%' }}>
        <div
          style={{
            position: 'absolute',
            left: `${-EXT_X * 100}%`,
            width: `${(1 + 2 * EXT_X) * 100}%`,
            top: `${-EXT_TOP * 100}%`,
            height: `${(1 + EXT_TOP) * 100}%`,
            transformOrigin: '50% 100%',
            transform: `rotateX(${THETA}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          <TableSvg uid={uid} crop={crop} w={w} s={s} r={r} st={st} />
          <LightPools crop={crop} list={list} motion={motion} />
          {list.map((p, i) => pieceFor(uid, p, crop, motion, i))}
        </div>
      </div>
      {/* falloff into the dark room at the far edge + legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: dim
            ? 'linear-gradient(180deg, rgb(5 8 15 / 0.86) 0%, rgb(7 13 24 / 0.5) 22%, rgb(7 13 24 / 0.4) 55%, rgb(7 13 24 / 0.72) 100%)'
            : 'linear-gradient(180deg, rgb(5 8 15 / 0.6) 0%, rgb(7 13 24 / 0.12) 24%, rgb(7 13 24 / 0.08) 60%, rgb(7 13 24 / 0.45) 100%)',
        }}
      />
      {/* the lamp over the chart: a warm pool that makes the map the focal point */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: 'radial-gradient(ellipse 60% 34% at 54% 34%, rgb(255 214 150 / 0.13) 0%, rgb(224 120 43 / 0.05) 55%, transparent 80%)',
        }}
      />
      <RoomLayer uid={uid} motion={motion} wide={W >= 900} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 85% 75% at 50% 56%, transparent 40%, rgb(3 5 10 / 0.78) 100%)',
        }}
      />
    </div>
  );
}

function sameProps(a, b) {
  return (
    t01(a.threats?.syndicate) === t01(b.threats?.syndicate) &&
    t01(a.threats?.wargs) === t01(b.threats?.wargs) &&
    t01(a.threats?.refugees) === t01(b.threats?.refugees) &&
    a.regionState === b.regionState &&
    Boolean(a.dim ?? true) === Boolean(b.dim ?? true) &&
    a.className === b.className &&
    JSON.stringify(a.style ?? null) === JSON.stringify(b.style ?? null)
  );
}

export const WarRoomBackdrop = memo(WarRoomBackdropImpl, sameProps);
export default WarRoomBackdrop;
