// The six Southern Marches beats, painted as layered matte paintings:
// sky dome → distant snow ranges → fog → far land → mid land → focal set piece
// → near land → foreground framing → light (rays, bloom) → grade.
// Each beat changes visibly by regionState: STABLE (civilian movement) ·
// FORTIFIED (soldiers, barricades, convoys, Aegis ward lines) · AFTERMATH
// (smoke, wreckage, wounded, scorch). Key light: upper right.
import { C } from '../palette.js';
import { ridgeHeightAt, mulberry32, r1 } from '../util.js';
import { mix } from './tone.js';
import { SkyDome, Range, Land, GodRays, FogBand, Mist, Grass, Birds, Bloom } from './atmos.jsx';
import { firBelt, grove, boulders } from './flora.js';
import {
  Glow,
  Smoke,
  Scorch,
  Torch,
  Banner,
  Pylon,
  Barricade,
  Palisade,
  Tent,
  Cart,
  Crowd,
  Keep,
  Village,
  Monuments,
  Snowfall,
  Eyes,
  Column,
  Monolith,
  StandingStone,
  Depot,
  Fence,
  CampfireMark,
  Embers,
  Flame,
  Lantern,
} from './parts.jsx';
import { CheckpointGate, RoyalParty, Walker, WalkerBeam, WardLanterns, Wolf, WolfPack, mulePath, refugeePath, wolfTones } from './actors.jsx';

// ---------------------------------------------------------------- helpers
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Perspective road: wide at t=0 (foreground), narrow at t=1. */
function makeRoad(p0, p1, p2, p3, w0, w1, steps = 22) {
  const left = [];
  const right = [];
  const centre = [];
  const wAt = (t) => w0 + (w1 - w0) * t ** 0.55;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const [x, y] = bez(p0, p1, p2, p3, t);
    const w = wAt(t);
    left.push([x - w / 2, y]);
    right.push([x + w / 2, y]);
    centre.push([x, y, w]);
  }
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`).join('');
  const d = `${line(left)}${line([...right].reverse()).replace(/^M/, 'L')}Z`;
  const lane = (k) => line(centre.map(([x, y, w]) => [x + w * k, y]));
  const ruts = lane(-0.2) + lane(0.2);
  const edgeL = line(left);
  const edgeR = line(right);
  // worn crown between the ruts catches the light
  const crown = lane(0.02);
  const at = (t) => {
    const [x, y] = bez(p0, p1, p2, p3, t);
    return [x, y, wAt(t)];
  };
  return { d, ruts, crown, edgeL, edgeR, at };
}

/** Patchwork fields lying on a ridge: rows of quads, one path per tint. */
function fields(seed, ridge, { from, to, rows = 4, start = 2, gap = 3, tints }) {
  const rnd = mulberry32(seed);
  const paths = tints.map(() => '');
  let hedges = '';
  const yAt = (x, o) => ridgeHeightAt(ridge, x) + o;
  let o = start;
  for (let r = 0; r < rows; r += 1) {
    const h = gap * (1 + r * 0.55);
    let x = from - rnd() * 30;
    while (x < to) {
      const w = 18 + rnd() * 34 * (1 + r * 0.3);
      const x2 = Math.min(to + 20, x + w);
      const k = Math.floor(rnd() * tints.length);
      paths[k] += `M${r1(x)},${r1(yAt(x, o))}L${r1(x2)},${r1(yAt(x2, o))}L${r1(x2 + h * 0.6)},${r1(yAt(x2, o + h))}L${r1(x + h * 0.6)},${r1(yAt(x, o + h))}Z`;
      if (rnd() < 0.6) hedges += `M${r1(x2)},${r1(yAt(x2, o))}L${r1(x2 + h * 0.6)},${r1(yAt(x2, o + h))}`;
      x = x2;
    }
    hedges += `M${r1(from)},${r1(yAt(from, o + h))}${Array.from({ length: 12 }, (_, i) => {
      const xx = from + ((to - from) * (i + 1)) / 12;
      return `L${r1(xx)},${r1(yAt(xx, o + h))}`;
    }).join('')}`;
    o += h;
  }
  return { paths, hedges };
}

/** Broken horizontal glints: a light reflected in moving water. */
function streaks(x, y, w, h, seed) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let yy = 0; yy < h; yy += 1.6) {
    const k = 1 - yy / h;
    const len = w * (0.3 + rnd() * 0.7) * (0.5 + k * 0.5);
    d += `M${r1(x - len / 2 + (rnd() - 0.5) * w * 0.3)},${r1(y + yy)}h${r1(len)}`;
  }
  return d;
}

/** Soft patches of cloud shadow drifting over the land. list: [cx, cy, rx, ry] */
function CloudShadows({ uid, list, op = 0.22, motion }) {
  return (
    <g opacity={op} pointerEvents="none">
      {motion && <animateTransform attributeName="transform" type="translate" values="0 0;-14 0;0 0" dur="90s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
      {list.map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}-scorch)`} />
      ))}
    </g>
  );
}

function AftermathGrade({ uid, L }) {
  return (
    <g pointerEvents="none">
      <ellipse cx="170" cy="58" rx="230" ry="40" fill={`url(#${uid}-smoke)`} opacity={0.6 * L.smokeOp} />
      <ellipse cx="320" cy="92" rx="140" ry="26" fill={`url(#${uid}-smoke)`} opacity={0.45 * L.smokeOp} />
      <rect x="-10" y="-10" width="420" height="245" fill={mix(C.ember600, C.ink, 0.55)} opacity={L.glow > 0.8 ? 0.12 : 0.16} />
    </g>
  );
}

/** Colour grade: a soft wash of the key light's hue over everything. */
function Grade({ T }) {
  return <rect x="-10" y="-10" width="420" height="245" fill={T.grade} opacity={T.gradeOp} pointerEvents="none" />;
}

function Debris({ seed, x, y, w, L }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < 11; i += 1) {
    const dx = x + rnd() * w;
    const dy = y + rnd() * 6;
    const a = rnd() * 3;
    d += `M${r1(dx)},${r1(dy)}l${r1(3 + a)},${r1(-0.6 - a * 0.3)}l0.5,1l${r1(-3 - a)},${r1(0.6 + a * 0.3)}Z`;
  }
  return <path d={d} fill={L.woodDark} />;
}

function BrokenSpears({ list, L }) {
  return (
    <path
      d={list.map(([x, y, h, a]) => `M${x},${y}l${r1(Math.sin(a) * h)},${r1(-Math.cos(a) * h)}`).join('')}
      stroke={L.woodDark}
      strokeWidth="0.8"
      strokeLinecap="round"
    />
  );
}

/** Dark framing trees / rocks with a thin rim of key light. */
function FirFrame({ seed, from, to, count, base, hMin, hMax, L, snow = false, color }) {
  const f = firBelt(seed, { from, to, count, baseAt: () => base, hMin, hMax, snow, width: 0.36 });
  return (
    <g>
      <path d={f.body} fill={color || L.fgDeep} />
      <path d={f.lit} fill={L.rim} opacity={L.rimOp * 0.16} />
      {snow && <path d={f.snow} fill={L.snow} opacity="0.8" />}
    </g>
  );
}

function Boulders({ seed, list, L, color }) {
  const b = boulders(seed, list);
  return (
    <g>
      <path d={b.body} fill={color || L.fgDeep} />
      <path d={b.lit} fill={L.rim} opacity={L.rimOp * 0.28} />
      <path d={b.shade} fill={L.shade} opacity="0.4" />
    </g>
  );
}

/** Squared, broken masonry: a lit top, a lit east face, a shadowed west face, moss/frost caps. */
function Rubble({ seed, x0, x1, y, L, count = 8, size = 3 }) {
  const rnd = mulberry32(seed);
  let body = '';
  let top = '';
  let east = '';
  for (let i = 0; i < count; i += 1) {
    const x = x0 + (x1 - x0) * ((i + 0.2 + rnd() * 0.6) / count);
    const w = size * (0.7 + rnd() * 0.7);
    const h = size * (0.45 + rnd() * 0.45);
    const k = (rnd() - 0.5) * 0.5;
    const bx = x - w / 2;
    body += `M${r1(bx)},${r1(y)}L${r1(bx + w * 0.06)},${r1(y - h)}L${r1(bx + w * 0.92)},${r1(y - h - k * h)}L${r1(bx + w)},${r1(y)}Z`;
    top += `M${r1(bx + w * 0.06)},${r1(y - h)}L${r1(bx + w * 0.92)},${r1(y - h - k * h)}L${r1(bx + w * 0.86)},${r1(y - h * 0.78 - k * h)}L${r1(bx + w * 0.12)},${r1(y - h * 0.8)}Z`;
    east += `M${r1(bx + w * 0.78)},${r1(y - h * 0.9 - k * h)}L${r1(bx + w * 0.92)},${r1(y - h - k * h)}L${r1(bx + w)},${r1(y)}L${r1(bx + w * 0.8)},${r1(y)}Z`;
  }
  return (
    <g>
      <path d={body} fill={L.stoneDark} />
      <path d={east} fill={mix(L.stone, L.rim, 0.25)} opacity="0.9" />
      <path d={top} fill={L.season === 'winter' ? L.snow : mix(L.stone, L.mid, 0.35)} opacity="0.85" />
    </g>
  );
}

function Grove({ seed, L, T, haze = 0, ...opts }) {
  const g = grove(seed, opts);
  const body = mix(L.near, L.haze, haze);
  return (
    <g>
      <path d={g.body} fill={body} />
      <path d={g.shade} fill={L.shade} opacity={0.25 * (1 - haze)} />
      <path d={g.lit} fill={mix(body, T.grassLit, 0.35)} opacity="0.85" />
    </g>
  );
}

function Firs({ seed, L, color, snow = false, litOp = 0.18, ...opts }) {
  const f = firBelt(seed, { snow, ...opts });
  return (
    <g>
      <path d={f.body} fill={color} />
      <path d={f.lit} fill={L.rim} opacity={L.rimOp * litOp} />
      {snow && <path d={f.snow} fill={mix(L.snow, L.rim, 0.15)} opacity="0.92" />}
    </g>
  );
}

function birdsColor(L) {
  return mix(L.figure, L.sky[1], 0.25);
}

// ================================================================= ROAD
export function RoadBeat({ uid, L, T, st, tod, motion, monuments, lite }) {
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const far = { seed: 3, y: 126, amp: 3.5, bumps: [{ x: 300, w: 30, h: 17 }] };
  const mid = { seed: 5, y: 146, amp: 5, bumps: [{ x: 70, w: 70, h: 8 }] };
  const near = { seed: 9, y: 174, amp: 4, waves: [[1.1, 1], [2.7, 0.4]] };
  const keepY = ridgeHeightAt(far, 300) + 1.5;
  const road = makeRoad([104, 236], [168, 184], [262, 156], [300, keepY + 0.5], 170, 3);
  const at = road.at;
  const fieldSet = fields(13, mid, {
    from: -10,
    to: 410,
    rows: 4,
    start: 3,
    gap: 3.2,
    tints: [mix(L.mid, C.gold500, 0.2), mix(L.mid, L.near, 0.4), mix(L.mid, L.far, 0.35), mix(L.mid, C.gold300, 0.12)],
  });
  const cottages = [
    [258, ridgeHeightAt(far, 258) + 2.5, 0.8],
    [247, ridgeHeightAt(far, 247) + 3, 0.65],
    [342, ridgeHeightAt(far, 342) + 2.5, 0.78],
    [355, ridgeHeightAt(far, 355) + 3, 0.62],
  ];

  const travellers = [];
  if (st === 'STABLE') {
    const [x1, y1] = at(0.6);
    const [x2, y2] = at(0.7);
    travellers.push([x1 + 5, y1, 7.5, 'civilian', 1], [x2 - 2, y2, 6, 'civilian', -1], [x2 + 3, y2 - 1, 5.4, 'cloak', -1]);
  }
  if (fortified) {
    for (let i = 0; i < 9; i += 1) {
      const [x, y, w] = at(0.28 + i * 0.035);
      const h = 13 - i * 0.7;
      travellers.push([x - w * 0.12, y, h, 'soldier', 1]);
      if (i % 2 === 0) travellers.push([x + w * 0.14, y + 0.5, h * 0.98, 'soldier', 1]);
    }
  }
  const wounded = [];
  const bandages = [];
  if (after) {
    const [x1, y1, w1] = at(0.2);
    wounded.push([x1 + w1 * 0.55, y1 - 2, 14, 'sitting', -1], [x1 + w1 * 0.55 + 12, y1 - 1, 13, 'wounded', -1], [x1 + w1 * 0.62 + 26, y1, 15, 'lying', 1]);
    bandages.push([x1 + w1 * 0.55, y1 - 2 - 14 * 0.62 + 0.5, 3.4], [x1 + w1 * 0.55 + 12, y1 - 1 - 13 * 0.62 + 0.5, 3.2]);
  }
  const nearAt = (x) => ridgeHeightAt(near, x);

  return (
    <g>
      <SkyDome uid={uid} L={L} T={T} seed={7} clouds={after ? 0.8 : 0.6} horizonY={116} motion={motion} />
      {!after && !lite && <Birds list={[[150, 58, 1], [158, 54, 0.8], [165, 61, 0.9], [173, 56, 0.7], [142, 63, 0.75]]} motion={motion} color={birdsColor(L)} op={0.55} />}
      <Range uid={uid} id="a" L={L} T={T} seed={21} y={104} amp={34} snow={0.5} haze={0.75} base={132} op={0.9} />
      <Range uid={uid} id="b" L={L} T={T} seed={22} y={116} amp={16} snow={0.15} haze={0.6} base={134} />
      <FogBand uid={uid} y={98} h={34} />
      <Land uid={uid} id="far" L={L} T={T} ridge={far} color={L.far} haze={0.35} mist={0.3} rim={0.6} />
      <Firs seed={31} L={L} color={mix(L.far, L.near, 0.35)} from={-10} to={230} count={34} baseAt={(x) => ridgeHeightAt(far, x) + 1.5} hMin={4} hMax={8} litOp={0.1} />
      <Village uid={uid} list={cottages} L={L} motion={motion} smoke={after ? [] : [0, 2]} damaged={after} />
      <Keep uid={uid} x={300} y={keepY} s={0.86} L={L} motion={motion} damaged={after} fortified={fortified} />
      {after && <Smoke uid={uid} x={298} y={keepY - 26} s={1.3} motion={motion} rise={90} />}
      {after && <Smoke uid={uid} x={256} y={keepY - 2} s={0.8} motion={motion} rise={70} dur={10} op={0.8} />}
      <Mist uid={uid} y={134} op={0.55} seed={4} count={5} rx={60} ry={5} motion={motion} />
      <Land uid={uid} id="mid" L={L} T={T} ridge={mid} color={L.mid} haze={0.12} mist={0.15} rim={0.55} />
      {fieldSet.paths.map((d, i) => (
        <path key={i} d={d} fill={[mix(L.mid, C.gold500, 0.2), mix(L.mid, L.near, 0.4), mix(L.mid, L.far, 0.35), mix(L.mid, C.gold300, 0.12)][i]} opacity="0.75" />
      ))}
      <path d={fieldSet.hedges} stroke={mix(L.near, L.fg, 0.4)} strokeWidth="0.7" fill="none" opacity="0.6" />
      <Grove seed={33} L={L} T={T} haze={0.15} from={0} to={250} count={13} baseAt={(x) => ridgeHeightAt(mid, x) + 4} rMin={2.4} rMax={4.4} />
      {tod !== 'night' && <CloudShadows uid={uid} list={[[60, 156, 50, 5], [340, 152, 44, 4]]} motion={motion} />}
      <Land uid={uid} id="near" L={L} T={T} ridge={near} color={L.near} mist={0.05} rim={0.5} />
      {tod !== 'night' && <CloudShadows uid={uid} list={[[330, 190, 90, 9], [40, 196, 70, 8]]} op={0.28} motion={motion} />}
      <Grass seed={71} from={-10} to={410} count={160} baseAt={nearAt} h={3} spread={30} color={T.grass} lit={T.grassLit} litOp={0.35} width={0.45} />
      {/* the road */}
      <path d={road.d} fill={`url(#${uid}-road)`} />
      <path d={road.edgeL} stroke={L.roadDark} strokeWidth="1.4" fill="none" opacity="0.55" />
      <path d={road.edgeR} stroke={mix(L.road, L.rim, 0.35)} strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d={road.ruts} stroke={L.roadDark} strokeWidth="1.3" fill="none" opacity="0.6" />
      <path d={road.crown} stroke={mix(L.road, L.rim, 0.3)} strokeWidth="2.2" fill="none" opacity="0.25" />
      {fortified && (
        <g>
          {/* the Marches walled in: a palisade ringing the keep's hill, ward-lanterns along it,
              pylons flanking the road where it passes through (reads even on a small card) */}
          <Palisade x={232} y={keepY + 9} w={60} h={7} L={L} />
          <Palisade x={310} y={keepY + 9} w={60} h={7} L={L} />
          <WardLanterns uid={uid} L={L} points={[[234, keepY - 1], [292, keepY - 1]]} gap={19} post={9} motion={motion} />
          <WardLanterns uid={uid} L={L} points={[[310, keepY - 1], [368, keepY - 1]]} gap={19} post={9} motion={motion} />
          <Pylon uid={uid} x={293} y={keepY + 11} s={0.85} L={L} motion={motion} />
          <Pylon uid={uid} x={309} y={keepY + 11} s={0.85} L={L} motion={motion} />
          <Crowd list={[[288, keepY + 10, 6.5, 'guard', 1], [314, keepY + 10, 6.5, 'soldier', -1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
        </g>
      )}
      {after && (
        <g>
          {/* the fight reached the walls: a burnt wagon and the dead on the verge below the keep */}
          <Scorch uid={uid} x={at(0.74)[0] - 10} y={at(0.74)[1]} rx={18} ry={3} />
          <Cart x={at(0.74)[0] - 16} y={at(0.74)[1] + 1} s={0.9} L={L} broken facing={1} />
          <Glow uid={uid} x={at(0.74)[0] - 16} y={at(0.74)[1] - 3} r={10} op={0.55} motion={motion} flicker />
          <Flame x={at(0.74)[0] - 17} y={at(0.74)[1] - 1} h={3.4} motion={motion} />
          <Smoke uid={uid} x={at(0.74)[0] - 16} y={at(0.74)[1] - 4} s={0.9} motion={motion} rise={80} dur={9.5} />
          <Smoke uid={uid} x={342} y={ridgeHeightAt(far, 342) - 2} s={0.9} motion={motion} rise={80} dur={10.5} op={0.85} />
        </g>
      )}
      <Grass seed={72} from={0} to={400} count={180} baseAt={(x) => (x < 200 ? 200 + (200 - x) * 0.1 : 200)} h={4} spread={30} color={L.fg} lit={T.grassLit} litOp={0.25} width={0.55} />
      {/* milestones */}
      {[0.16, 0.4, 0.64].map((t) => {
        const [x, y, w] = at(t);
        const s = 1.45 - t;
        const mx = x + w * 0.58;
        return (
          <g key={t}>
            <path d={`M${r1(mx)},${r1(y)}v${r1(-5 * s)}q${r1(1.6 * s)},${r1(-1.6 * s)} ${r1(3.2 * s)},0v${r1(5 * s)}Z`} fill={`url(#${uid}-stone)`} />
            <path d={`M${r1(mx + 2.2 * s)},${r1(y)}v${r1(-5.5 * s)}`} stroke={L.rim} strokeWidth={0.4 * s} opacity={L.rimOp * 0.6} />
          </g>
        );
      })}
      {st === 'STABLE' && <Cart x={at(0.5)[0] + 4} y={at(0.5)[1]} s={1.05} L={L} ox facing={1} />}
      {fortified && (
        <>
          <Cart x={at(0.15)[0] - 8} y={at(0.15)[1]} s={1.5} L={L} ox facing={1} />
          <Cart x={at(0.62)[0]} y={at(0.62)[1]} s={0.85} L={L} ox facing={1} />
          <Barricade x={at(0.52)[0] - 30} y={at(0.52)[1] + 1} w={18} s={0.8} L={L} />
          <Barricade x={at(0.52)[0] + 12} y={at(0.52)[1] + 1} w={18} s={0.8} L={L} />
          <WardLanterns uid={uid} L={L} points={[[at(0.4)[0] - 70, at(0.4)[1] - 14], [at(0.4)[0], at(0.4)[1] - 18], [at(0.4)[0] + 70, at(0.4)[1] - 12]]} motion={motion} />
          <Pylon uid={uid} x={at(0.4)[0] - 70} y={at(0.4)[1] + 2} s={1} L={L} motion={motion} />
          <Pylon uid={uid} x={at(0.4)[0] + 70} y={at(0.4)[1] + 4} s={1} L={L} motion={motion} />
          <Banner uid={uid} x={at(0.3)[0] + 50} y={at(0.3)[1]} h={26} len={12} hgt={5} L={L} motion={motion} />
          <Torch uid={uid} x={at(0.52)[0] - 32} y={at(0.52)[1]} s={1} L={L} motion={motion} />
          <Torch uid={uid} x={at(0.52)[0] + 32} y={at(0.52)[1]} s={1} L={L} motion={motion} />
        </>
      )}
      <Crowd list={travellers} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.7} shadow={L.shade} />
      {after && (
        <>
          <Scorch uid={uid} x={at(0.36)[0]} y={at(0.36)[1]} rx={24} ry={4.4} />
          <Scorch uid={uid} x={at(0.58)[0] + 6} y={at(0.58)[1]} rx={12} ry={2.4} />
          <Cart x={at(0.38)[0] - 30} y={at(0.38)[1] + 2} s={1.3} L={L} broken facing={-1} />
          <Glow uid={uid} x={at(0.38)[0] - 30} y={at(0.38)[1] - 3} r={12} op={0.6} motion={motion} flicker />
          <Flame x={at(0.38)[0] - 31} y={at(0.38)[1] - 1} h={4} motion={motion} />
          <Smoke uid={uid} x={at(0.38)[0] - 30} y={at(0.38)[1] - 6} s={1} motion={motion} rise={90} dur={9} />
          <Debris seed={61} x={at(0.3)[0] - 20} y={at(0.3)[1] - 2} w={50} L={L} />
          <path d={`M${at(0.48)[0] + 30},${at(0.48)[1]}l14,-16`} stroke={L.woodDark} strokeWidth="1.1" />
          <path d={`M${at(0.48)[0] + 43},${at(0.48)[1] - 15}l-8,3l2,4l7,-3Z`} fill={C.navy700} opacity="0.9" />
          <Crowd list={wounded} fill={L.figure} bandages={bandages} rim={L.rim} rimOp={L.rimOp * 0.6} shadow={L.shade} />
        </>
      )}
      <Monuments uid={uid} items={monuments} x={262} y={198} s={1.1} L={L} motion={motion} />
      {tod === 'night' && !after && <Lantern uid={uid} x={at(0.5)[0] + 13} y={at(0.5)[1] - 9} s={1} L={L} motion={motion} />}
      {/* light through the clouds */}
      {tod !== 'night' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={112} a1={168} count={7} len={300} op={after ? 0.5 : 1} motion={motion} />}
      <Bloom uid={uid} L={L} T={T} />
      {/* foreground framing */}
      <FirFrame seed={41} from={-26} to={36} count={4} base={228} hMin={92} hMax={134} L={L} />
      <FirFrame seed={42} from={396} to={432} count={2} base={230} hMin={84} hMax={112} L={L} />
      <Boulders seed={43} list={[[380, 226, 1.8], [398, 228, 1.2], [362, 229, 0.9]]} L={L} />
      <Grass seed={73} from={200} to={410} count={70} baseAt={() => 212} h={7} spread={14} color={L.fgDeep} lit={T.grassLit} litOp={0.3} width={0.7} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

// ================================================================= CHECKPOINT
export function CheckpointBeat({ uid, L, T, st, tod, motion, monuments, lite }) {
  const far = { seed: 12, y: 122, amp: 5 };
  const back = { seed: 16, y: 134, amp: 3, waves: [[1.4, 1], [3.3, 0.4]] };
  const mid = { seed: 14, y: 150, amp: 2.4, waves: [[1.2, 1], [3, 0.3]] };
  const GX = 292;
  const GY = 152;
  const road = makeRoad([160, 236], [180, 200], [262, 168], [GX, GY], 150, 13);
  const at = road.at;
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const backAt = (x) => ridgeHeightAt(back, x);
  const tentsBehind = [
    [150, 0.72],
    [176, 0.9],
    [204, 0.78],
    [232, 0.86],
    [340, 0.84],
    [366, 0.92],
    [394, 0.76],
  ].map(([x, s]) => [x, backAt(x) + 2, s]);
  // the queue: families walking up to the gate (the leading line), a mule, a cart
  const queue = [];
  const kinds = ['bundle', 'child', 'hood', 'elder', 'bundle', 'hood', 'child', 'bundle', 'hood', 'bundle'];
  const queueN = after ? 5 : kinds.length;
  for (let i = 0; i < queueN; i += 1) {
    const t = 0.3 + i * 0.058;
    const [x, y, w] = at(t);
    const h = (kinds[i] === 'child' ? 10 : 15.5) * (1.3 - t * 0.9);
    queue.push([x - w * 0.16 + ((i * 7) % 5) - 2, y, h, kinds[i], 1]);
  }
  const [mx, my, mw] = at(0.47);
  const mule = after ? '' : mulePath(mx - mw * 0.3, my, 0.95 * (1.3 - 0.47 * 0.9), 1);
  // a mother arguing with the sergeant at the desk
  const GS = 1.3;
  if (!after) queue.push([GX + 13 * GS, GY, 13.4, 'mother', 1], [GX + 10.6 * GS, GY, 8, 'child', 1]);
  const cartAt = at(0.4);
  const cartS = 1.25;
  const wheel = [cartAt[0] + 14 - 4.5 * cartS, cartAt[1] - 2.2 * cartS - 2.6 * cartS];
  const guards = [];
  guards.push([GX - 18 * GS, GY, 11, 'guard', 1]);
  if (fortified) {
    guards.push([at(0.6)[0] + 26, at(0.6)[1], 12, 'soldier', -1], [at(0.48)[0] - 34, at(0.48)[1], 13, 'soldier', 1], [at(0.48)[0] + 40, at(0.48)[1], 13.5, 'soldier', -1]);
    guards.push([at(0.75)[0] + 22, at(0.75)[1], 10, 'officer', -1]);
  }
  const wounded = [];
  const bandages = [];
  if (after) {
    wounded.push([96, 198, 15, 'sitting', 1], [118, 196, 14, 'wounded', 1], [74, 202, 15, 'lying', 1]);
    bandages.push([96, 198 - 15 * 0.62 + 0.5, 3.4], [118, 196 - 14 * 0.62 + 0.5, 3.2]);
  }
  const midAt = (x) => ridgeHeightAt(mid, x);
  return (
    <g>
      <SkyDome uid={uid} L={L} T={T} seed={9} clouds={after ? 0.85 : 0.55} horizonY={118} motion={motion} />
      {!after && !lite && <Birds list={[[214, 70, 0.9], [221, 66, 0.75], [228, 71, 0.8], [206, 73, 0.7]]} motion={motion} color={birdsColor(L)} op={0.5} dur={60} />}
      <Range uid={uid} id="a" L={L} T={T} seed={27} y={108} amp={28} snow={0.45} haze={0.8} base={134} op={0.85} />
      <FogBand uid={uid} y={100} h={34} />
      <Land uid={uid} id="far" L={L} T={T} ridge={far} color={L.far} haze={0.4} mist={0.3} rim={0.5} />
      <Firs seed={51} L={L} color={mix(L.far, L.pineMid, 0.4)} from={-10} to={410} count={46} baseAt={(x) => ridgeHeightAt(far, x) + 1} hMin={5} hMax={11} litOp={0.12} />
      <Mist uid={uid} y={126} op={0.5} seed={8} count={5} rx={70} ry={5} motion={motion} />
      <Land uid={uid} id="back" L={L} T={T} ridge={back} color={mix(L.far, L.mid, 0.5)} haze={0.2} mist={0.2} rim={0.4} />
      {/* refugee camp behind the walls */}
      {tentsBehind.map(([x, y, s]) => (
        <Tent key={x} uid={uid} x={x} y={y} s={s} L={L} lit={L.glow > 0.5} torn={after} color={[mix(L.canvas, L.haze, 0.2), L.canvasDark]} />
      ))}
      {!after && <Smoke uid={uid} x={214} y={backAt(214) - 4} s={0.55} motion={motion} op={0.45} rise={60} />}
      {!after && <Smoke uid={uid} x={372} y={backAt(372) - 4} s={0.5} motion={motion} op={0.4} rise={60} />}
      {after && <Smoke uid={uid} x={206} y={backAt(206) - 4} s={1.3} motion={motion} rise={90} />}
      {after && <Smoke uid={uid} x={360} y={backAt(360) - 4} s={1.1} motion={motion} rise={90} dur={9.5} />}
      <Land uid={uid} id="mid" L={L} T={T} ridge={mid} color={L.mid} haze={0.05} mist={0.1} rim={0.5} />
      <Grass seed={81} from={-10} to={410} count={150} baseAt={midAt} h={2.6} spread={40} color={T.grass} lit={T.grassLit} litOp={0.3} width={0.4} />
      {/* walls */}
      <Palisade x={-10} y={GY} w={GX - 26} h={14} L={L} gapFrom={after ? 120 : null} gapTo={after ? 142 : null} />
      <Palisade x={GX + 26} y={GY} w={410 - GX - 26} h={14} L={L} />
      {after && <Scorch uid={uid} x={130} y={GY - 6} rx={16} ry={7} />}
      {fortified && (
        <g>
          <rect x="120" y={GY - 34} width="1.4" height="34" fill={L.woodDark} />
          <rect x="134" y={GY - 34} width="1.4" height="34" fill={L.woodDark} />
          <path d={`M120,${GY - 12}L135,${GY - 24}M135,${GY - 12}L120,${GY - 24}`} stroke={L.woodDark} strokeWidth="0.8" />
          <rect x="116" y={GY - 37} width="23" height="5" fill={L.wood} />
          <path d={`M114,${GY - 37}L127.5,${GY - 46}L141,${GY - 37}Z`} fill={L.woodDark} />
          <path d={`M127.5,${GY - 46}L141,${GY - 37}`} stroke={L.rim} strokeWidth="0.5" opacity={L.rimOp * 0.7} />
          <Crowd list={[[127.5, GY - 37, 7, 'soldier', 1]]} fill={L.figure} />
          <Torch uid={uid} x={139} y={GY - 37} s={0.8} L={L} motion={motion} pole={false} />
        </g>
      )}
      {fortified && (
        <>
          <WardLanterns uid={uid} L={L} points={[[0, GY - 17], [GX - 26, GY - 18], [GX + 26, GY - 18], [400, GY - 17]]} motion={motion} />
          <Pylon uid={uid} x={GX - 30} y={GY + 3} s={1} L={L} motion={motion} />
          <Pylon uid={uid} x={GX + 30} y={GY + 3} s={1} L={L} motion={motion} />
        </>
      )}
      <CheckpointGate uid={uid} x={GX} y={GY} s={GS} L={L} motion={motion} state={st} />
      <path d={road.d} fill={`url(#${uid}-road)`} />
      <path d={road.edgeL} stroke={L.roadDark} strokeWidth="1.3" fill="none" opacity="0.5" />
      <path d={road.edgeR} stroke={mix(L.road, L.rim, 0.35)} strokeWidth="0.6" fill="none" opacity="0.45" />
      <path d={road.ruts} stroke={L.roadDark} strokeWidth="1.2" fill="none" opacity="0.5" />
      <path d={road.crown} stroke={mix(L.road, L.rim, 0.3)} strokeWidth="2" fill="none" opacity="0.22" />
      <Torch uid={uid} x={GX - 26 * GS} y={GY} s={1} L={L} motion={motion} />
      {!after && <Cart x={cartAt[0] + 14} y={cartAt[1]} s={cartS} L={L} facing={1} />}
      {fortified && (
        <>
          <Barricade x={at(0.42)[0] - 80} y={at(0.42)[1] + 2} w={34} s={1.1} L={L} />
          <Barricade x={at(0.42)[0] + 46} y={at(0.42)[1] + 2} w={30} s={1.1} L={L} />
          <Cart x={at(0.7)[0] + 34} y={at(0.7)[1] + 1} s={0.9} L={L} ox facing={-1} />
        </>
      )}
      {/* the queue: shadows, silhouettes, a rim of key light */}
      <path d={queue.map(([x, y, h]) => `M${r1(x - h * 0.24)},${r1(y + 0.3)}h${r1(h * 0.56)}`).join('')} stroke={L.shade} strokeWidth="1" opacity="0.35" />
      <path d={refugeePath(queue) + mule} fill={L.figure} />
      <path d={refugeePath(queue.map(([x, y, h, k, f]) => [x + Math.max(0.3, h * 0.035), y, h, k, f]))} fill="none" stroke={L.rim} strokeWidth="0.3" opacity={L.rimOp * 0.7} />
      {mule && <path d={mulePath(mx - mw * 0.3 + 0.4, my, 0.95 * (1.3 - 0.47 * 0.9), 1)} fill="none" stroke={L.rim} strokeWidth="0.3" opacity={L.rimOp * 0.6} />}
      {/* a girl sitting on the cart wheel */}
      {!after && <path d={refugeePath([[wheel[0], wheel[1], 5.6, 'child', 1]])} fill={L.figure} />}
      {!after && <rect x={r1(wheel[0] - 1.2)} y={r1(wheel[1] - 4)} width="2" height="0.8" fill={C.crimson500} opacity="0.85" />}
      <Crowd list={guards} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.7} shadow={L.shade} />
      {after && (
        <>
          <Cart x={at(0.55)[0] - 18} y={at(0.55)[1] + 1} s={1.2} L={L} broken facing={1} />
          <Debris seed={66} x={at(0.46)[0] - 10} y={at(0.46)[1] - 3} w={40} L={L} />
          <Scorch uid={uid} x={at(0.3)[0] + 10} y={at(0.3)[1]} rx={26} ry={5} />
          <Crowd list={wounded} fill={L.figure} bandages={bandages} rim={L.rim} rimOp={L.rimOp * 0.6} shadow={L.shade} />
        </>
      )}
      <Monuments uid={uid} items={monuments} x={250} y={202} s={1.15} L={L} motion={motion} />
      {tod !== 'night' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={104} a1={150} count={6} len={260} op={after ? 0.45 : 0.9} seed={9} motion={motion} />}
      <Bloom uid={uid} L={L} T={T} />
      <Grass seed={74} from={-10} to={170} count={60} baseAt={() => 206} h={7} spread={18} color={L.fgDeep} lit={T.grassLit} litOp={0.3} width={0.7} />
      <FirFrame seed={45} from={-30} to={22} count={3} base={232} hMin={96} hMax={128} L={L} />
      <Boulders seed={44} list={[[12, 228, 2], [34, 230, 1.1]]} L={L} />
      <FirFrame seed={47} from={392} to={430} count={2} base={230} hMin={100} hMax={124} L={L} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

// ================================================================= WILDS
export function WildsBeat({ uid, L, T, st, tod, motion, lite }) {
  const farG = { seed: 33, y: 134, amp: 3.5 };
  const midG = { seed: 35, y: 154, amp: 5, waves: [[1.4, 1], [3.3, 0.4]] };
  const nearG = { seed: 37, y: 182, amp: 5, waves: [[1.1, 1], [2.4, 0.5]] };
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const day = tod === 'day';
  const wolves = wolfTones(L, tod);
  const eyeList = [
    [168, 143, 0.8, 0.4],
    [204, 147, 0.9, 1.7],
    [185, 152, 1, 2.9],
  ];
  if (after || fortified) eyeList.push([222, 142, 0.75, 3.6]);
  if (after) eyeList.push([150, 149, 0.85, 0.9], [238, 150, 0.95, 2.2]);
  const rockX = 292;
  const rockY = ridgeHeightAt(midG, rockX) - 4;
  const snowFar = mix(L.snowShade, L.haze, 0.35);
  const midAt = (x) => ridgeHeightAt(midG, x);
  const nearAt = (x) => ridgeHeightAt(nearG, x);
  // a trampled path winding from us into the forest gap
  const trail = `M150,232C170,214 212,206 204,192S176,170 192,158`;
  return (
    <g>
      <SkyDome uid={uid} L={L} T={T} seed={13} clouds={day ? 0.5 : 0.75} horizonY={112} motion={motion} />
      {tod === 'dusk' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={196} a1={262} count={8} len={300} op={1.1} seed={13} motion={motion} />}
      <Range uid={uid} id="a" L={L} T={T} seed={31} y={106} amp={52} snow={0.62} haze={0.55} base={138} rim={1} />
      <Range uid={uid} id="b" L={L} T={T} seed={34} y={122} amp={22} snow={0.4} haze={0.7} base={140} op={0.95} />
      <FogBand uid={uid} y={104} h={36} />
      <Land uid={uid} id="far" L={L} T={T} ridge={farG} color={snowFar} haze={0.2} mist={0.2} rim={0.7} />
      <Firs seed={81} L={L} color={mix(L.pineFar, L.haze, 0.25)} from={-10} to={410} count={70} baseAt={(x) => ridgeHeightAt(farG, x)} hMin={6} hMax={13} snow litOp={0.12} />
      <Mist uid={uid} y={138} op={0.7} seed={6} count={6} rx={60} ry={5} motion={motion} />
      <Land uid={uid} id="mid" L={L} T={T} ridge={midG} color={L.snowShade} haze={0.08} mist={0.1} rim={0.8} />
      {/* dark forest gap where the eyes are */}
      <Firs seed={84} L={L} color={mix(L.pineNear, L.shade, 0.35)} from={124} to={256} count={26} baseAt={(x) => midAt(x) + 3} hMin={12} hMax={24} litOp={0.08} />
      <Mist uid={uid} y={midAt(190) + 4} op={0.45} seed={7} count={3} rx={50} ry={3} motion={motion} />
      <Firs seed={83} L={L} color={L.pineMid} from={-10} to={146} count={18} baseAt={midAt} hMin={22} hMax={40} snow litOp={0.25} />
      <Firs seed={85} L={L} color={L.pineMid} from={236} to={410} count={20} baseAt={midAt} hMin={22} hMax={42} snow litOp={0.25} />
      {day && <Firs seed={86} L={L} color={L.pineNear} from={262} to={326} count={5} baseAt={(x) => midAt(x) + 2} hMin={34} hMax={50} snow litOp={0.2} />}
      <Eyes uid={uid} list={eyeList} motion={motion} />
      {/* outcrop + the alpha */}
      <path d={`M${rockX - 26},${rockY + 10}L${rockX - 16},${rockY - 6}L${rockX + 2},${rockY - 11}L${rockX + 20},${rockY - 5}L${rockX + 30},${rockY + 10}Z`} fill={mix(L.stoneDark, L.shade, 0.35)} />
      <path d={`M${rockX + 2},${rockY - 11}L${rockX + 20},${rockY - 5}L${rockX + 30},${rockY + 10}L${rockX + 12},${rockY + 2}Z`} fill={L.stone} opacity="0.7" />
      <path d={`M${rockX - 16},${rockY - 6}L${rockX + 2},${rockY - 11}L${rockX + 12},${rockY - 7.5}L${rockX - 12},${rockY - 4}Z`} fill={L.snow} />
      <Glow uid={uid} x={rockX - 4} y={rockY - 26} r={36} op={day ? 0.0 : 0.22} kind="lattice" />
      <Wolf uid={uid} x={rockX + 2} y={rockY - 8.6} s={0.86} tones={wolves} rimOp={0.55 + L.rimOp * 0.6} motion={motion} breath shadow={L.shade} />
      <Land uid={uid} id="near" L={L} T={T} ridge={nearG} color={L.snow} mist={0} rim={0.9} rimW={1.1} />
      {/* wind-carved drifts in blue shadow */}
      <g fill={mix(L.snowShade, L.sky[1], 0.25)} opacity="0.45">
        <path d={`M-10,206Q60,196 130,204T260,202T410,198V212H-10Z`} />
        <path d={`M40,224Q120,214 210,222T410,216V232H40Z`} opacity="0.7" />
      </g>
      <path d={`M-10,206Q60,196 130,204T260,202T410,198`} stroke={L.rim} strokeWidth="0.6" fill="none" opacity={L.rimOp * 0.6} />
      <path d={trail} stroke={L.snowShade} strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d={trail} stroke={mix(L.snowShade, L.shade, 0.25)} strokeWidth="2.4" fill="none" strokeDasharray="1.5 3" opacity="0.5" />
      <Grass seed={91} from={-10} to={410} count={70} baseAt={nearAt} h={3} spread={20} color={mix(L.pineNear, L.snowShade, 0.3)} width={0.4} />
      {/* the pack, fanned across the path between the forest and the travellers */}
      <WolfPack
        uid={uid}
        tones={wolves}
        shadow={L.shade}
        rimOp={0.5 + L.rimOp * 0.6}
        list={
          fortified
            ? [[200, 172, 0.34, 1], [232, 170, 0.32, 1], [262, 173, 0.36, 1]]
            : [[150, 178, 0.36, 1], [178, 174, 0.33, 1], [204, 183, 0.42, 1], [234, 176, 0.35, 1], [258, 186, 0.46, 1], ...(after ? [[226, 192, 0.5, 1]] : [])]
        }
      />
      {fortified && (
        <>
          <Palisade x={60} y={178} w={90} h={11} L={L} />
          <Palisade x={250} y={180} w={110} h={11} L={L} />
          <WardLanterns uid={uid} L={L} points={[[40, 166], [150, 162], [250, 164], [380, 162]]} motion={motion} />
          <Pylon uid={uid} x={150} y={180} s={1.1} L={L} motion={motion} />
          <Pylon uid={uid} x={250} y={182} s={1.1} L={L} motion={motion} />
          <Torch uid={uid} x={100} y={180} s={1.2} L={L} motion={motion} />
          <Torch uid={uid} x={312} y={182} s={1.2} L={L} motion={motion} />
          <Crowd list={[[176, 186, 15, 'soldier', 1], [214, 188, 15.5, 'guard', -1], [330, 184, 14, 'soldier', -1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} shadow={L.shade} />
        </>
      )}
      {st === 'STABLE' && (
        <>
          <Crowd list={[[118, 190, 13, 'cloak', 1], [131, 191, 9, 'child', 1], [104, 192, 14, 'refugee', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} shadow={L.shade} />
          <Lantern uid={uid} x={124} y={182} s={0.9} L={L} motion={motion} />
        </>
      )}
      {after && (
        <>
          {/* burnt watch post */}
          <path d="M96,186V152M112,186V154M94,158L114,152M95,172L111,168" stroke={C.ink} strokeWidth="2" />
          <path d="M92,152L104,144L116,153" stroke={C.ink} strokeWidth="1.6" fill="none" />
          <Glow uid={uid} x={104} y={152} r={14} op={0.6} motion={motion} flicker />
          <Smoke uid={uid} x={104} y={148} s={1.2} motion={motion} rise={85} />
          <Embers x={104} y={154} s={1} motion={motion} count={5} seed={9} />
          <Scorch uid={uid} x={104} y={188} rx={26} ry={5} />
          <Scorch uid={uid} x={236} y={192} rx={18} ry={3.6} />
          <BrokenSpears list={[[180, 194, 16, 0.5], [196, 196, 12, -0.4], [262, 192, 14, 0.7], [276, 194, 10, -0.9]]} L={L} />
          <Crowd list={[[300, 198, 14, 'lying', 1]]} fill={L.figure} />
        </>
      )}
      <Bloom uid={uid} L={L} T={T} op={0.8} />
      <FirFrame seed={87} from={-24} to={44} count={3} base={230} hMin={124} hMax={152} L={L} snow color={L.pineNear} />
      <FirFrame seed={89} from={372} to={424} count={2} base={230} hMin={112} hMax={142} L={L} snow color={L.pineNear} />
      {!lite && <Snowfall motion={motion} L={L} seed={11} count={44} dur={18} size={0.55} op={0.5} drift={-24} />}
      <Snowfall motion={motion} L={L} seed={12} count={16} dur={9} size={1.1} op={0.75} drift={-30} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

// ================================================================= RUIN
export function RuinBeat({ uid, L, T, st, tod, motion }) {
  const far = { seed: 41, y: 124, amp: 5 };
  const mid = { seed: 43, y: 152, amp: 4 };
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const PY = 172;
  const midAt = (x) => ridgeHeightAt(mid, x);
  const MX = 208;
  const SY = PY - 9 - 58 * 1.1 * 0.62;
  const intensity = after ? 1.4 : fortified ? 1.15 : 1;
  return (
    <g>
      <SkyDome uid={uid} L={L} T={T} seed={17} clouds={tod === 'night' ? 0.45 : 0.6} horizonY={116} motion={motion} />
      <Range uid={uid} id="a" L={L} T={T} seed={45} y={110} amp={30} snow={0.4} haze={0.7} base={134} op={0.85} />
      <FogBand uid={uid} y={100} h={36} />
      <Land uid={uid} id="far" L={L} T={T} ridge={far} color={L.far} haze={0.35} mist={0.35} rim={0.5} />
      <Firs seed={92} L={L} color={mix(L.pineFar, L.haze, 0.2)} from={-10} to={410} count={56} baseAt={(x) => ridgeHeightAt(far, x) + 1} hMin={6} hMax={13} litOp={0.1} />
      <Mist uid={uid} y={134} op={0.65} seed={12} count={6} rx={70} ry={6} motion={motion} />
      <Land uid={uid} id="mid" L={L} T={T} ridge={mid} color={L.mid} haze={0.1} mist={0.25} rim={0.5} />
      {/* the sun's shafts fall behind the ruin, so the stones stand solid in front of them */}
      {tod !== 'night' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={110} a1={160} count={6} len={200} op={0.7} seed={17} motion={motion} />}
      <Firs seed={93} L={L} color={L.pineMid} from={304} to={420} count={7} baseAt={(x) => midAt(x) + 2} hMin={28} hMax={50} litOp={0.22} />
      <Firs seed={95} L={L} color={L.pineMid} from={-20} to={64} count={6} baseAt={(x) => midAt(x) + 2} hMin={26} hMax={44} litOp={0.22} />
      {/* the monolith's light reaching the trees */}
      <Glow uid={uid} x={MX} y={PY - 40} r={120} op={0.25 * intensity} kind="lattice" />
      {/* the stone's light: a shaft rising behind the stones, so they stand solid in front of it */}
      <defs>
        <radialGradient id={`${uid}-mono`} gradientUnits="userSpaceOnUse" cx={MX} cy={SY} r="120">
          <stop offset="0" stopColor={C.lattice200} stopOpacity="0.9" />
          <stop offset="0.4" stopColor={C.lattice300} stopOpacity="0.3" />
          <stop offset="1" stopColor={C.gold400} stopOpacity="0" />
        </radialGradient>
      </defs>
      <GodRays uid={uid} T={{ rayOp: 0.32 }} x={MX} y={SY} a0={236} a1={304} count={6} len={130} op={intensity} seed={41} motion={motion} fill={`url(#${uid}-mono)`} />
      {/* platform + steps */}
      <path d={`M66,${PY}L96,${PY - 10}H306L336,${PY}Z`} fill={L.stoneDark} />
      <path d={`M96,${PY - 10}H306L310,${PY - 8}H92Z`} fill={L.stone} opacity="0.8" />
      <path d={`M306,${PY - 10}L336,${PY}H326L302,${PY - 8}Z`} fill={L.rim} opacity={L.rimOp * 0.35} />
      <path d={`M150,${PY}v-3h100v3M160,${PY - 3}v-3h80v3`} fill="none" stroke={L.stone} strokeWidth="0.8" opacity="0.6" />
      <path d={Array.from({ length: 12 }, (_, i) => `M${r1(100 + i * 18)},${PY - 9}l${r1(-2 - i * 0.4)},9`).join('')} stroke={L.shade} strokeWidth="0.35" opacity="0.5" />
      {/* arch fragment */}
      <path d={`M82,${PY - 8}V118h9V${PY - 8}Z M118,${PY - 8}V124h9V${PY - 8}Z`} fill={`url(#${uid}-cyl)`} />
      <path d="M80,120Q104,92 129,124L127,128Q104,102 82,124Z" fill={L.stone} />
      <path d="M104,104Q118,108 129,124L127,128Q118,113 104,108Z" fill={L.rim} opacity={L.rimOp * 0.4} />
      <path d="M118,124L122,113L129,124Z" fill={L.stoneDark} />
      <path d="M86,107l3,3M95,100l1,4M106,99l-1,4M115,103l-2,3" stroke={L.stoneDark} strokeWidth="0.5" />
      <Column uid={uid} x={142} y={PY - 10} h={50} L={L} />
      <Column uid={uid} x={164} y={PY - 10} h={30} L={L} broken={5} />
      <Column uid={uid} x={252} y={PY - 10} h={38} L={L} broken={7} />
      <Column uid={uid} x={274} y={PY - 10} h={56} L={L} />
      <Column uid={uid} x={296} y={PY - 10} h={22} L={L} broken={4} />
      {/* lintel on the tall pair */}
      <rect x="136" y={PY - 64} width="14" height="4" fill={L.stone} transform={`rotate(-6 143 ${PY - 62})`} />
      {/* broken circle of standing stones */}
      <StandingStone uid={uid} x={180} y={PY - 9} w={5} h={16} lean={-1} L={L} seed={3} />
      <StandingStone uid={uid} x={236} y={PY - 9} w={5.5} h={18} lean={1} L={L} seed={4} />
      {fortified && (
        <g>
          {/* research scaffold */}
          <path d={`M264,${PY - 10}V${PY - 72}M286,${PY - 10}V${PY - 72}M262,${PY - 30}H288M262,${PY - 52}H288M264,${PY - 10}L286,${PY - 52}M286,${PY - 30}L264,${PY - 72}`} stroke={L.wood} strokeWidth="1.1" />
          <rect x="260" y={PY - 74} width="30" height="2.4" fill={L.wood} />
          <Lantern uid={uid} x={275} y={PY - 66} s={1} L={L} motion={motion} />
          <Tent uid={uid} x={112} y={PY - 9} s={1.3} L={L} lit pennant motion={motion} />
          <Torch uid={uid} x={186} y={PY - 10} s={1.1} L={L} motion={motion} />
          <Crowd list={[[196, PY - 10, 12, 'officer', -1], [318, PY - 2, 14, 'soldier', -1], [84, PY + 2, 14, 'guard', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} shadow={L.shade} />
        </g>
      )}
      {/* a warm edge on every pillar facing the stone */}
      <ellipse cx={MX} cy={PY - 9} rx={90} ry={9} fill={`url(#${uid}-mono)`} opacity={0.55 * intensity} />
      <path
        d={[[142, 50], [164, 30], [252, 38], [274, 56], [296, 22]]
          .map(([cx, h]) => {
            const ex = cx < MX ? cx + 2.4 : cx - 3;
            return `M${ex},${PY - 12}v${-(h - 6)}`;
          })
          .join('')}
        stroke={C.lattice300}
        strokeWidth="0.9"
        opacity={0.4 * intensity}
      />
      <Glow uid={uid} x={MX} y={SY + 4} r={34} op={0.5 * intensity} motion={motion} flicker />
      <Monolith uid={uid} x={MX} y={PY - 9} s={1.1} L={L} motion={motion} intensity={intensity} />
      <Glow uid={uid} x={MX} y={SY} r={12} op={0.55 * intensity} />
      {fortified && (
        <>
          <WardLanterns uid={uid} L={L} points={[[150, PY - 26], [MX, PY - 36], [270, PY - 26]]} motion={motion} />
          <Pylon uid={uid} x={150} y={PY - 9} s={1.05} L={L} motion={motion} />
          <Pylon uid={uid} x={262} y={PY - 9} s={1.05} L={L} motion={motion} />
        </>
      )}
      {after && (
        <>
          <path d={`M252,${PY - 10}L296,${PY - 46}M262,${PY - 10}L306,${PY - 40}M246,${PY - 26}L310,${PY - 20}`} stroke={L.woodDark} strokeWidth="1.2" />
          <Scorch uid={uid} x={128} y={PY - 6} rx={26} ry={4} />
          <Glow uid={uid} x={118} y={PY - 10} r={14} op={0.55} motion={motion} flicker />
          <Flame x={118} y={PY - 8} h={4} motion={motion} />
          <Smoke uid={uid} x={118} y={PY - 12} s={1.1} motion={motion} rise={90} />
          <path d={`M166,${PY - 9}l7,-4l8,2l2,4Z M226,${PY - 9}l5,-5l9,1l1,5Z`} fill={L.stone} />
          <Crowd list={[[300, PY + 18, 14, 'sitting', -1]]} fill={L.figure} bandages={[[300, PY + 18 - 14 * 0.62 + 0.5, 3.3]]} />
        </>
      )}
      <Mist uid={uid} y={PY + 2} op={0.45} seed={14} count={5} rx={60} ry={4} motion={motion} dur={64} />
      {/* rubble breaking the platform's front edge, fallen blocks half sunk in the turf */}
      <Rubble seed={56} x0={98} x1={304} y={PY - 9.2} L={L} count={9} size={3.4} />
      <Rubble seed={57} x0={70} x1={334} y={PY + 0.5} L={L} count={13} size={3.6} />
      <Rubble seed={59} x0={96} x1={136} y={194} L={L} count={3} size={6.5} />
      <Rubble seed={61} x0={272} x1={304} y={193} L={L} count={2} size={6} />
      <Land uid={uid} id="fg" L={L} T={T} ridge={{ seed: 47, y: 206, amp: 4 }} color={L.fg} rim={0.6} />
      <Grass seed={75} from={-10} to={410} count={120} baseAt={() => 202} h={6} spread={22} color={L.fgDeep} lit={T.grassLit} litOp={0.35} width={0.6} />
      <Grass seed={76} from={90} to={310} count={60} baseAt={() => 192} h={4.5} spread={6} color={mix(L.mid, L.fgDeep, 0.5)} lit={T.grassLit} litOp={0.3} width={0.5} />
      <FirFrame seed={49} from={-30} to={16} count={2} base={232} hMin={96} hMax={124} L={L} />
      <Boulders seed={46} list={[[18, 226, 1.6], [384, 228, 1.9], [400, 222, 1]]} L={L} />
      <Bloom uid={uid} L={L} T={T} op={0.6} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

// ================================================================= CHAMPION
// Greywater Ford: the river crosses the frame; a Syndicate walker stands
// knee-deep in it with its lamps lit; their depot sits on the far bank.
export function ChampionBeat({ uid, L, T, st, tod, motion }) {
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const far = { seed: 51, y: 128, amp: 4 };
  const bankFar = { seed: 53, y: 160, amp: 1.6, waves: [[1.1, 1], [2.9, 0.3]] };
  const nearBank = { seed: 55, y: 190, amp: 3, waves: [[1.2, 1], [2.6, 0.4]] };
  const RT = 162;
  const RB = 186;
  const WX = 236;
  const WY = 190;
  const WL = 177; // the water line on the walker's legs
  // the royal party on the near bank, inside the phone crop, where the lamp finds them
  const PARTY = [126, ridgeHeightAt(nearBank, 126) + 7];
  const PARTY_AIM = [PARTY[0] - 4, PARTY[1] - 10];
  const burning = after || tod === 'night';
  const water = T.water;
  const waterDark = T.waterDark;
  const nearAt = (x) => ridgeHeightAt(nearBank, x);
  const river = `M-10,${RT}${Array.from({ length: 22 }, (_, i) => `L${i * 20},${r1(RT + Math.sin(i * 0.9) * 0.8)}`).join('')}L410,${RT}V${RB + 30}H-10Z`;
  const ripples = (() => {
    const rnd = mulberry32(58);
    let d = '';
    for (let i = 0; i < 40; i += 1) {
      const y = RT + 2 + (RB - RT + 6) * rnd() ** 0.8;
      const k = (y - RT) / (RB - RT);
      const x = rnd() * 410;
      const len = 4 + 16 * k * rnd() + 3;
      d += `M${r1(x)},${r1(y)}h${r1(len)}`;
    }
    return d;
  })();
  const syndicateStacks = `M330,${far.y - 4}V98h2.4V${far.y - 4}ZM346,${far.y - 4}V90h3V${far.y - 4}ZM366,${far.y - 4}V100h2.4V${far.y - 4}Z`;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-riverclip`}>
          <path d={river} />
        </clipPath>
        <clipPath id={`${uid}-wlclip`}>
          <rect x={WX - 34} y={WL} width="62" height="40" />
        </clipPath>
        <linearGradient id={`${uid}-water`} gradientUnits="userSpaceOnUse" x1="0" y1={RT} x2="0" y2={RB + 6}>
          <stop offset="0" stopColor={mix(water, L.haze, 0.25)} />
          <stop offset="0.3" stopColor={mix(water, waterDark, 0.35)} />
          <stop offset="1" stopColor={waterDark} />
        </linearGradient>
      </defs>
      <SkyDome uid={uid} L={L} T={T} seed={19} clouds={0.7} horizonY={122} motion={motion} />
      <Range uid={uid} id="a" L={L} T={T} seed={57} y={114} amp={26} snow={0.42} haze={0.75} base={138} op={0.8} />
      {/* Syndicate stacks smoking beyond the border */}
      <path d={syndicateStacks} fill={mix(L.far, L.shade, 0.25)} />
      <circle cx="347.5" cy="92" r="1" fill={C.ember400} opacity={0.4 + L.glow * 0.5} />
      <Smoke uid={uid} x={347} y={90} s={1} motion={motion} rise={50} drift={-40} dur={11} op={0.6} />
      <Smoke uid={uid} x={331} y={98} s={0.7} motion={motion} rise={40} drift={-34} dur={12} op={0.5} />
      <FogBand uid={uid} y={106} h={34} />
      <Land uid={uid} id="far" L={L} T={T} ridge={far} color={L.far} haze={0.35} mist={0.3} rim={0.5} />
      <Firs seed={96} L={L} color={mix(L.pineFar, L.haze, 0.2)} from={-10} to={300} count={40} baseAt={(x) => ridgeHeightAt(far, x) + 1} hMin={5} hMax={10} litOp={0.1} />
      <Mist uid={uid} y={142} op={0.5} seed={9} count={5} rx={70} ry={5} motion={motion} />
      <Land uid={uid} id="bank" L={L} T={T} ridge={bankFar} color={L.mid} haze={0.08} mist={0.1} rim={0.5} />
      <Fence x={250} y={160} w={160} L={L} broken={after} />
      <Depot uid={uid} x={312} y={160} s={0.8} L={L} motion={motion} damaged={after} burning={burning} />
      {/* the ford */}
      <path d={river} fill={`url(#${uid}-water)`} />
      <g clipPath={`url(#${uid}-riverclip)`}>
        {/* sky and fire reflected in the water */}
        <rect x="-10" y={RT} width="420" height="4" fill={T.horizon} opacity="0.35" />
        <path d={streaks(L.sun.x, RT + 1, 12, 20, 57)} stroke={T.silver} strokeWidth="0.7" opacity={tod === 'night' ? 0.45 : 0.35} />
        {burning && <path d={streaks(316, RT + 1, 14, 18, 59)} stroke={C.ember300} strokeWidth="0.9" opacity="0.6" />}
        {!after && <path d={streaks(WX - 22, RT + 4, 6, 12, 61)} stroke={C.ember300} strokeWidth="0.8" opacity="0.5" />}
        <path d={ripples} stroke={mix(water, L.rim, 0.5)} strokeWidth="0.5" opacity="0.55" />
        <path d={ripples} stroke={waterDark} strokeWidth="0.5" opacity="0.4" transform="translate(3 1.2)" />
      </g>
      {/* the burning depot lights the water */}
      {burning && <ellipse cx="318" cy={RT + 7} rx="56" ry="9" fill={`url(#${uid}-warm)`} opacity={0.55} clipPath={`url(#${uid}-riverclip)`} />}
      {/* the walker, knee-deep: legs vanish under the surface, a broken reflection below */}
      <g clipPath={`url(#${uid}-riverclip)`} opacity="0.35">
        <path d={`M${WX - 30},${WL + 1}h52l-4,14h-44Z`} fill={waterDark} />
        <path d={streaks(WX - 4, WL + 2, 26, 14, 63)} stroke={mix(C.iron500, water, 0.5)} strokeWidth="0.8" />
      </g>
      <Walker uid={uid} x={WX} y={WY} s={1} L={L} motion={motion} damaged={after} beam={false} ember={burning ? 1 : 0} />
      <path d={`M-10,${WL}H410V${RB + 40}H-10Z`} fill={`url(#${uid}-water)`} opacity="0.94" clipPath={`url(#${uid}-wlclip)`} />
      <g clipPath={`url(#${uid}-riverclip)`}>
        {burning && <path d={streaks(316, WL + 1, 16, 12, 65)} stroke={C.ember300} strokeWidth="0.8" opacity="0.5" />}
        <path d={streaks(WX - 6, WL + 1, 10, 9, 67)} stroke={mix(water, L.rim, 0.5)} strokeWidth="0.5" opacity="0.5" />
      </g>
      <g fill="none" stroke={mix(water, L.rim, 0.65)} strokeWidth="0.6" opacity="0.85">
        {[WX - 8, WX + 10].map((lx, i) => (
          <g key={lx}>
            <ellipse cx={lx} cy={WL + 0.2} rx="6" ry="1.1">
              {motion && <animate attributeName="rx" values={i ? '7;4.5;7' : '4.5;8;4.5'} dur="3s" repeatCount="indefinite" />}
            </ellipse>
            <ellipse cx={lx} cy={WL + 0.8} rx="10" ry="1.6" opacity="0.45" />
          </g>
        ))}
      </g>
      <path d={`M${WX - 16},${WL}h5M${WX - 2},${WL}h5M${WX + 16},${WL}h5`} stroke={C.lattice200} strokeWidth="0.7" opacity="0.6" />
      {/* near bank: the Elvian line */}
      <Land uid={uid} id="near" L={L} T={T} ridge={nearBank} color={L.near} mist={0} rim={0.7} />
      <Grass seed={77} from={-10} to={410} count={130} baseAt={nearAt} h={4} spread={20} color={L.fg} lit={T.grassLit} litOp={0.3} width={0.5} />
      {st === 'STABLE' && <Torch uid={uid} x={98} y={206} s={1.4} L={L} motion={motion} />}
      {fortified && (
        <>
          <Barricade x={10} y={200} w={60} s={1.4} L={L} />
          <Barricade x={110} y={204} w={44} s={1.4} L={L} />
          <WardLanterns uid={uid} L={L} points={[[0, 182], [84, 174], [170, 180]]} motion={motion} />
          <Pylon uid={uid} x={84} y={196} s={1.4} L={L} motion={motion} />
          <Pylon uid={uid} x={170} y={200} s={1.3} L={L} motion={motion} />
          <Torch uid={uid} x={104} y={204} s={1.5} L={L} motion={motion} />
          <Crowd list={[[24, 214, 20, 'soldier', 1], [104, 216, 20, 'soldier', 1], [140, 216, 19, 'soldier', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.7} shadow={L.shade} />
        </>
      )}
      {after && (
        <>
          <Flame x={120} y={198} h={6} motion={motion} />
          <Glow uid={uid} x={120} y={194} r={14} op={0.6} motion={motion} flicker />
          <Smoke uid={uid} x={120} y={192} s={1} motion={motion} rise={80} />
          <Barricade x={20} y={204} w={56} s={1.4} L={L} broken />
          <Debris seed={68} x={150} y={202} w={70} L={L} />
          <Crowd list={[[108, 216, 18, 'sitting', 1], [132, 218, 17, 'wounded', 1], [30, 220, 20, 'lying', 1]]} fill={L.figure} bandages={[[108, 216 - 18 * 0.62 + 0.6, 3.8], [132, 218 - 17 * 0.62 + 0.6, 3.6]]} />
          <BrokenSpears list={[[150, 210, 18, 0.6], [168, 212, 14, -0.5]]} L={L} />
        </>
      )}
      {/* the royal party on the near bank, caught in the walker's lamp */}
      {!after && <WalkerBeam uid={uid} x={WX} y={WY} s={1} L={L} motion={motion} to={PARTY_AIM} />}
      <RoyalParty uid={uid} x={PARTY[0]} y={PARTY[1]} s={1.05} L={L} motion={motion} lit={after ? 0 : 1} torn={after} />
      <Bloom uid={uid} L={L} T={T} />
      {tod !== 'night' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={tod === 'dusk' ? 196 : 112} a1={tod === 'dusk' ? 250 : 160} count={6} len={260} op={0.8} seed={19} motion={motion} />}
      {/* reeds framing the lower left */}
      <Grass seed={79} from={-12} to={40} count={40} baseAt={() => 230} h={22} spread={6} color={L.fgDeep} lit={T.grassLit} litOp={0.2} width={0.9} />
      <Boulders seed={48} list={[[386, 228, 2], [366, 230, 1.1]]} L={L} />
      <Grass seed={78} from={-10} to={410} count={50} baseAt={() => 216} h={7} spread={10} color={L.fgDeep} lit={T.grassLit} litOp={0.25} width={0.7} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

// ================================================================= CAMP
export function CampBeat({ uid, L, T, st, tod, motion }) {
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const valleyFar = { seed: 61, y: 113, amp: 4 };
  const valley = { seed: 63, y: 126, amp: 3, waves: [[1.2, 1], [3.4, 0.35]] };
  const crest = { seed: 65, y: 160, amp: 7, waves: [[0.9, 1], [2.1, 0.35]], bumps: [{ x: 190, w: 120, h: 6 }] };
  const crestAt = (x) => ridgeHeightAt(crest, x);
  const lights = (() => {
    const rnd = mulberry32(69);
    const pts = [];
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      const x = 20 + t * 360;
      const y = 134 + Math.sin(t * 6 + 1) * 4 + t * 2;
      if (rnd() > 0.35) pts.push([r1(x + (rnd() - 0.5) * 6), r1(y + (rnd() - 0.5) * 2)]);
    }
    return pts;
  })();
  const nightish = L.glow > 0.5;
  const tents = [
    [52, 0.95, true],
    [86, 1.1, false],
    [312, 1.05, true],
    [350, 1.2, false],
  ];
  if (fortified) tents.push([18, 0.9, false], [128, 0.85, true], [384, 1, true]);
  const fireX = 196;
  const fireY = crestAt(fireX) + 26;
  const seated = [
    [fireX - 24, fireY + 2, 19, 'sitting', 1],
    [fireX + 25, fireY + 3, 18, 'sitting', -1],
  ];
  if (!after) seated.push([fireX + 9, fireY + 14, 17, 'sitting', -1]);
  const sentries = [[256, crestAt(256) + 4, 17, 'guard', 1]];
  if (fortified) sentries.push([150, crestAt(150) + 4, 16, 'soldier', -1], [292, crestAt(292) + 5, 16, 'soldier', 1]);
  const riverD = 'M-5,144 C60,136 110,150 170,140 S290,132 405,144';
  return (
    <g>
      <SkyDome uid={uid} L={L} T={T} seed={23} clouds={0.5} horizonY={110} motion={motion} />
      <Range uid={uid} id="a" L={L} T={T} seed={67} y={100} amp={34} snow={0.5} haze={0.65} base={124} op={0.9} />
      <FogBand uid={uid} y={90} h={34} />
      <Land uid={uid} id="far" L={L} T={T} ridge={valleyFar} color={L.far} haze={0.35} mist={0.3} rim={0.5} />
      {/* the distant keep, dropped into the haze so the camp holds the eye */}
      <g opacity="0.42">
        <Keep uid={uid} x={352} y={ridgeHeightAt(valleyFar, 352) + 1} s={0.3} L={L} motion={false} damaged={after} />
      </g>
      <Mist uid={uid} y={120} op={0.55} seed={15} count={6} rx={70} ry={5} motion={motion} />
      <Land uid={uid} id="valley" L={L} T={T} ridge={valley} color={L.mid} haze={0.15} mist={0.2} rim={0.4} />
      {/* patchwork fields, the river and the road through the Marches */}
      {(() => {
        const tints = [mix(L.mid, C.gold500, 0.18), mix(L.mid, L.near, 0.35), mix(L.mid, L.far, 0.3)];
        const f = fields(71, valley, { from: -10, to: 410, rows: 5, start: 3, gap: 2.6, tints });
        return (
          <g>
            {f.paths.map((d, i) => (
              <path key={i} d={d} fill={tints[i]} opacity="0.7" />
            ))}
            <path d={f.hedges} stroke={mix(L.near, L.fg, 0.4)} strokeWidth="0.6" fill="none" opacity="0.5" />
          </g>
        );
      })()}
      <path d={riverD} stroke={mix(L.near, L.shade, 0.3)} strokeWidth="3.4" fill="none" opacity="0.5" />
      {/* the river and the road are quiet threads in the valley, not lit ribbons */}
      <path d={riverD} stroke={mix(T.water, L.mid, nightish ? 0.45 : 0.2)} strokeWidth="1.3" fill="none" opacity={nightish ? 0.35 : 0.55} />
      {!nightish && <path d={riverD} stroke={T.silver} strokeWidth="0.35" fill="none" opacity="0.18" strokeDasharray="6 14" />}
      <path d="M-5,133 C70,140 150,128 220,135 S330,141 405,132" stroke={L.road} strokeWidth="0.6" fill="none" opacity="0.18" strokeDasharray="5 1.5" />
      <Village uid={uid} list={[[318, 133, 0.55], [326, 134, 0.5], [306, 132.5, 0.6], [62, 132, 0.5]]} L={L} motion={motion} smoke={after ? [] : [2]} damaged={after} />
      {nightish && (
        <g fill={C.lattice300}>
          {lights.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5" opacity="0.8" />
          ))}
          {lights.map(([x, y]) => (
            <circle key={`g${x}-${y}`} cx={x} cy={y} r="2.6" fill={`url(#${uid}-warm)`} opacity="0.3" />
          ))}
        </g>
      )}
      {after && <Smoke uid={uid} x={110} y={134} s={0.9} motion={motion} rise={60} drift={-30} op={0.7} />}
      {/* the crest we stand on */}
      <Land uid={uid} id="crest" L={L} T={T} ridge={crest} color={L.fg} mist={0} rim={0.4} rimW={0.7} />
      <Grass seed={92} from={-10} to={410} count={140} baseAt={crestAt} h={3.5} spread={26} color={L.fgDeep} lit={T.grassLit} litOp={0.3} width={0.5} />
      {fortified && (
        <>
          <Palisade x={-10} y={crestAt(60) + 6} w={130} h={12} L={L} />
          <Palisade x={270} y={crestAt(330) + 6} w={150} h={12} L={L} />
          <WardLanterns uid={uid} L={L} points={[[0, crestAt(0) - 8], [140, crestAt(140) - 14], [260, crestAt(260) - 14], [400, crestAt(400) - 8]]} motion={motion} />
          <Pylon uid={uid} x={140} y={crestAt(140) + 2} s={1.1} L={L} motion={motion} />
          <Pylon uid={uid} x={260} y={crestAt(260) + 2} s={1.1} L={L} motion={motion} />
          <Banner uid={uid} x={232} y={crestAt(232) + 8} h={32} len={15} hgt={6} L={L} motion={motion} />
        </>
      )}
      {tents.map(([x, s, lit]) => (
        <Tent key={x} uid={uid} x={x} y={crestAt(x) + 15 * s} s={s * 2.05} L={L} lit={lit && nightish} torn={after && x === 86} pennant={x === 312 || x === 52} motion={motion} />
      ))}
      <Banner uid={uid} x={118} y={crestAt(118) + 12} h={34} len={15} hgt={6} L={L} motion={motion} torn={after} />
      <Crowd list={sentries} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.7} shadow={L.shade} />
      {after ? (
        <>
          <CampfireMark uid={uid} x={fireX} y={fireY} s={1.7} L={L} motion={motion} big={0.5} />
          <Smoke uid={uid} x={fireX} y={fireY - 6} s={1} motion={motion} rise={90} />
          <Cart x={334} y={crestAt(334) + 34} s={1.6} L={L} broken facing={-1} />
          <Crowd
            list={[[54, crestAt(54) + 38, 17, 'lying', 1], [96, crestAt(96) + 34, 17, 'wounded', 1], [128, crestAt(128) + 40, 16, 'sitting', 1]]}
            fill={L.figure}
            bandages={[[96, crestAt(96) + 34 - 17 * 0.62 + 0.6, 3.8], [128, crestAt(128) + 40 - 16 * 0.62 + 0.6, 3.6]]}
          />
        </>
      ) : (
        <CampfireMark uid={uid} x={fireX} y={fireY} s={1.7} L={L} motion={motion} big={tod === 'day' ? 0.8 : 1} />
      )}
      <Crowd list={seated} fill={L.figure} rim={C.ember300} rimOp={0.3 + 0.5 * L.glow} />
      {!after && fortified && <Cart x={350} y={crestAt(350) + 38} s={1.5} L={L} facing={-1} />}
      <Bloom uid={uid} L={L} T={T} />
      {tod !== 'night' && <GodRays uid={uid} T={T} x={L.sun.x} y={L.sun.y} a0={tod === 'dusk' ? 196 : 112} a1={tod === 'dusk' ? 250 : 160} count={6} len={260} op={0.8} seed={23} motion={motion} />}
      <Grass seed={79} from={-10} to={410} count={60} baseAt={() => 214} h={7} spread={10} color={L.fgDeep} lit={T.grassLit} litOp={0.25} width={0.7} />
      <FirFrame seed={66} from={392} to={430} count={2} base={232} hMin={92} hMax={120} L={L} />
      {after && <AftermathGrade uid={uid} L={L} />}
      <Grade T={T} />
    </g>
  );
}

export const BEATS = {
  road: RoadBeat,
  checkpoint: CheckpointBeat,
  wilds: WildsBeat,
  ruin: RuinBeat,
  champion: ChampionBeat,
  camp: CampBeat,
};
