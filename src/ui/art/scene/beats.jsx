// The six Southern Marches beats. Each composition is layered
// sky → far range → haze → mid → near → foreground, and changes visibly by
// regionState: STABLE (civilian movement) · FORTIFIED (soldiers, barricades,
// convoys, Aegis ward lines) · AFTERMATH (smoke, wreckage, wounded, scorch).
import { C } from '../palette.js';
import { ridgePath, ridgeHeightAt, forest, groveBlobs, mulberry32, r1 } from '../util.js';
import {
  Sky,
  Haze,
  Glow,
  Smoke,
  Scorch,
  Torch,
  Banner,
  Pylon,
  WardLine,
  Barricade,
  Palisade,
  Tent,
  Cart,
  Crowd,
  Keep,
  Gatehouse,
  Monuments,
  Snowfall,
  Eyes,
  Warg,
  Column,
  Monolith,
  Walker,
  Depot,
  Fence,
  CampfireMark,
  Embers,
  Flame,
} from './parts.jsx';

// ---------------------------------------------------------------- helpers
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Perspective road: wide at t=0 (foreground), narrow at t=1. */
function makeRoad(p0, p1, p2, p3, w0, w1, steps = 18) {
  const left = [];
  const right = [];
  const centre = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const [x, y] = bez(p0, p1, p2, p3, t);
    const w = w0 + (w1 - w0) * t ** 0.55;
    left.push([x - w / 2, y]);
    right.push([x + w / 2, y]);
    centre.push([x, y, w]);
  }
  let d = `M${r1(left[0][0])},${r1(left[0][1])}`;
  for (let i = 1; i < left.length; i += 1) d += `L${r1(left[i][0])},${r1(left[i][1])}`;
  for (let i = right.length - 1; i >= 0; i -= 1) d += `L${r1(right[i][0])},${r1(right[i][1])}`;
  d += 'Z';
  // wheel ruts
  let ruts = '';
  [-0.22, 0.22].forEach((k) => {
    ruts += `M${r1(centre[0][0] + centre[0][2] * k)},${r1(centre[0][1])}`;
    for (let i = 1; i < centre.length; i += 1) ruts += `L${r1(centre[i][0] + centre[i][2] * k)},${r1(centre[i][1])}`;
  });
  const at = (t) => {
    const [x, y] = bez(p0, p1, p2, p3, t);
    return [x, y, w0 + (w1 - w0) * t ** 0.55];
  };
  return { d, ruts, at };
}

function grassTufts(seed, { from, to, count, baseAt, h = 3 }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const x = from + (to - from) * rnd();
    const y = baseAt(x) + rnd() * 6;
    const hh = h * (0.6 + rnd() * 0.8);
    d += `M${r1(x - 1.4)},${r1(y)}l${r1(0.6)},${r1(-hh)}l${r1(0.5)},${r1(hh * 0.7)}l${r1(0.5)},${r1(-hh * 0.9)}l${r1(0.4)},${r1(hh * 0.9)}Z`;
  }
  return d;
}

function hedges(seed, { from, to, rows, baseAt }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < rows; i += 1) {
    const x0 = from + (to - from) * rnd() * 0.6;
    const len = 30 + rnd() * 70;
    const y = baseAt(x0) + 2 + rnd() * 8;
    d += `M${r1(x0)},${r1(y)}q${r1(len / 2)},${r1(-2 - rnd() * 3)} ${r1(len)},${r1(-1 + rnd() * 3)}`;
  }
  return d;
}

function Rocks({ x, y, s = 1, L }) {
  return (
    <g>
      <path d={`M${x - 14 * s},${y}l${4 * s},${-9 * s}l${7 * s},${-3 * s}l${6 * s},${4 * s}l${3 * s},${8 * s}Z`} fill={L.fgDeep} />
      <path d={`M${x - 3 * s},${y - 12 * s}l${6 * s},${4 * s}l${3 * s},${8 * s}h${-2 * s}l${-3 * s},${-7 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.25} />
      <path d={`M${x + 4 * s},${y}l${3 * s},${-5 * s}l${5 * s},${-1 * s}l${3 * s},${6 * s}Z`} fill={L.fgDeep} />
    </g>
  );
}

function AftermathGrade({ uid, L }) {
  return (
    <g pointerEvents="none">
      <ellipse cx="170" cy="62" rx="210" ry="34" fill={`url(#${uid}-smoke)`} opacity={0.55 * L.smokeOp} />
      <rect x="-5" y="-5" width="410" height="235" fill="#3a2c22" opacity={L.glow > 0.8 ? 0.1 : 0.14} />
    </g>
  );
}

function Debris({ seed, x, y, w, L }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < 9; i += 1) {
    const dx = x + rnd() * w;
    const dy = y + rnd() * 6;
    const a = rnd() * 3;
    d += `M${r1(dx)},${r1(dy)}l${r1(3 + a)},${r1(-0.6 - a * 0.3)}l${0.5},${1}l${r1(-3 - a)},${r1(0.6 + a * 0.3)}Z`;
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

// ================================================================= ROAD
export function RoadBeat({ uid, L, st, tod, motion, monuments }) {
  const far = { seed: 3, y: 122, amp: 4.5, bumps: [{ x: 300, w: 34, h: 15 }] };
  const mid = { seed: 5, y: 142, amp: 6, bumps: [{ x: 70, w: 70, h: 9 }] };
  const near = { seed: 9, y: 170, amp: 5, waves: [[1.1, 1], [2.7, 0.4]] };
  const keepY = ridgeHeightAt(far, 300) + 2;
  const road = makeRoad([118, 228], [168, 178], [262, 152], [300, keepY], 150, 4);
  const groves = groveBlobs(31, { from: 0, to: 250, count: 16, baseAt: (x) => ridgeHeightAt(mid, x) + 3, rMin: 2.4, rMax: 4.6 });
  const pinesL = forest(41, { from: -16, to: 34, count: 4, baseAt: () => 224, hMin: 86, hMax: 128 });
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const at = road.at;

  const travellers = [];
  if (st === 'STABLE') {
    const [x1, y1] = at(0.62);
    const [x2, y2] = at(0.72);
    travellers.push([x1 + 4, y1, 7, 'civilian', 1], [x2 - 2, y2, 5.5, 'civilian', -1], [x2 + 3, y2 - 1, 5, 'cloak', -1]);
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

  return (
    <g>
      <Sky uid={uid} L={L} seed={7} />
      <path d={ridgePath({ seed: 21, y: 100, amp: 8, waves: [[2.2, 1], [5.1, 0.55], [11, 0.25]], jag: 0.8, step: 9 })} fill={L.mountain} opacity="0.75" />
      <Haze uid={uid} y={86} h={46} />
      <path d={ridgePath(far)} fill={L.far} />
      <Keep uid={uid} x={300} y={keepY} s={0.72} L={L} motion={motion} damaged={after} fortified={fortified} />
      {after && <Smoke uid={uid} x={300} y={keepY - 22} s={1.2} motion={motion} rise={80} />}
      <Haze uid={uid} y={118} h={26} />
      <path d={ridgePath(mid)} fill={L.mid} />
      <path d={hedges(52, { from: 0, to: 400, rows: 9, baseAt: (x) => ridgeHeightAt(mid, x) })} stroke={L.near} strokeWidth="0.8" fill="none" opacity="0.55" />
      <path d={groves.body} fill={L.near} />
      <path d={groves.lit} fill={L.rim} opacity={L.rimOp * 0.3} />
      <path d={ridgePath(near)} fill={L.near} />
      <path d={road.d} fill={L.road} />
      <path d={road.ruts} stroke={L.roadDark} strokeWidth="1.1" fill="none" opacity="0.55" />
      {/* milestones */}
      {[0.18, 0.42, 0.66].map((t) => {
        const [x, y, w] = at(t);
        const s = 1.4 - t;
        return <path key={t} d={`M${r1(x + w * 0.56)},${r1(y)}v${r1(-5 * s)}q${r1(1.6 * s)},${r1(-1.6 * s)} ${r1(3.2 * s)},0v${r1(5 * s)}Z`} fill={L.stone} />;
      })}
      {st === 'STABLE' && <Cart x={at(0.5)[0] + 4} y={at(0.5)[1]} s={1} L={L} ox facing={1} />}
      {fortified && (
        <>
          <Cart x={at(0.15)[0] - 8} y={at(0.15)[1]} s={1.5} L={L} ox facing={1} />
          <Cart x={at(0.62)[0]} y={at(0.62)[1]} s={0.85} L={L} ox facing={1} />
          <Barricade x={at(0.52)[0] - 30} y={at(0.52)[1] + 1} w={18} s={0.8} L={L} />
          <Barricade x={at(0.52)[0] + 12} y={at(0.52)[1] + 1} w={18} s={0.8} L={L} />
          <WardLine points={[[at(0.4)[0] - 70, at(0.4)[1] - 14], [at(0.4)[0], at(0.4)[1] - 18], [at(0.4)[0] + 70, at(0.4)[1] - 12]]} motion={motion} />
          <Pylon uid={uid} x={at(0.4)[0] - 70} y={at(0.4)[1] + 2} s={1} L={L} motion={motion} />
          <Pylon uid={uid} x={at(0.4)[0] + 70} y={at(0.4)[1] + 4} s={1} L={L} motion={motion} />
          <Banner x={at(0.3)[0] + 50} y={at(0.3)[1]} h={26} len={12} hgt={5} L={L} motion={motion} />
          <Torch uid={uid} x={at(0.52)[0] - 32} y={at(0.52)[1]} s={1} L={L} motion={motion} />
          <Torch uid={uid} x={at(0.52)[0] + 32} y={at(0.52)[1]} s={1} L={L} motion={motion} />
        </>
      )}
      <Crowd list={travellers} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
      {after && (
        <>
          <Scorch uid={uid} x={at(0.36)[0]} y={at(0.36)[1]} rx={22} ry={4} />
          <Scorch uid={uid} x={at(0.58)[0] + 6} y={at(0.58)[1]} rx={12} ry={2.4} />
          <Cart x={at(0.38)[0] - 30} y={at(0.38)[1] + 2} s={1.3} L={L} broken facing={-1} />
          <Smoke uid={uid} x={at(0.38)[0] - 30} y={at(0.38)[1] - 6} s={1} motion={motion} rise={90} dur={9} />
          <Debris seed={61} x={at(0.3)[0] - 20} y={at(0.3)[1] - 2} w={50} L={L} />
          <path d={`M${at(0.48)[0] + 30},${at(0.48)[1]}l14,-16`} stroke={L.woodDark} strokeWidth="1.1" />
          <path d={`M${at(0.48)[0] + 43},${at(0.48)[1] - 15}l-8,3l2,4l7,-3Z`} fill={C.navy700} opacity="0.9" />
          <Crowd list={wounded} fill={L.figure} bandages={bandages} rim={L.rim} rimOp={L.rimOp * 0.6} />
        </>
      )}
      <Monuments uid={uid} items={monuments} x={262} y={196} s={1.1} L={L} motion={motion} />
      {/* foreground framing */}
      <path d={pinesL.body} fill={L.fgDeep} />
      <path d={pinesL.lit} fill={L.rim} opacity={L.rimOp * 0.12} />
      <Rocks x={388} y={224} s={1.6} L={L} />
      <path d={grassTufts(71, { from: 200, to: 400, count: 26, baseAt: () => 206, h: 5 })} fill={L.fgDeep} />
      {tod === 'night' && st !== 'AFTERMATH' && <Glow uid={uid} x={at(0.5)[0]} y={at(0.5)[1] - 4} r={10} op={0.5} />}
      {after && <AftermathGrade uid={uid} L={L} />}
    </g>
  );
}

// ================================================================= CHECKPOINT
export function CheckpointBeat({ uid, L, st, motion, monuments }) {
  const far = { seed: 12, y: 118, amp: 5 };
  const mid = { seed: 14, y: 146, amp: 2.4, waves: [[1.2, 1], [3, 0.3]] };
  const GX = 292;
  const GY = 150;
  const road = makeRoad([160, 228], [180, 196], [262, 166], [GX, GY], 140, 13);
  const at = road.at;
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const tentsBehind = [
    [150, 131, 0.72],
    [178, 133, 0.9],
    [206, 130, 0.78],
    [236, 132, 0.86],
    [338, 131, 0.84],
    [366, 133, 0.92],
    [394, 130, 0.76],
  ];
  const queue = [];
  const kinds = ['refugee', 'cloak', 'child', 'refugee', 'cloak', 'refugee', 'child', 'cloak'];
  const queueN = after ? 4 : 8;
  for (let i = 0; i < queueN; i += 1) {
    const t = 0.36 + i * 0.07;
    const [x, y, w] = at(t);
    const h = (kinds[i] === 'child' ? 9 : 14) * (1.25 - t * 0.85);
    queue.push([x - w * 0.18 + ((i * 7) % 5) - 2, y, h, kinds[i], 1]);
  }
  const guards = [];
  const [gx0, gy0, gw0] = at(0.92);
  guards.push([gx0 - gw0 * 0.9 - 4, gy0, 11, 'guard', 1], [gx0 + gw0 * 0.9 + 5, gy0, 11, 'guard', -1]);
  if (fortified) {
    guards.push([at(0.6)[0] + 26, at(0.6)[1], 12, 'soldier', -1], [at(0.48)[0] - 34, at(0.48)[1], 13, 'soldier', 1], [at(0.48)[0] + 40, at(0.48)[1], 13.5, 'soldier', -1]);
    guards.push([at(0.75)[0] + 22, at(0.75)[1], 10, 'officer', -1]);
  }
  const wounded = [];
  const bandages = [];
  if (after) {
    wounded.push([96, 196, 15, 'sitting', 1], [118, 194, 14, 'wounded', 1], [74, 200, 15, 'lying', 1]);
    bandages.push([96, 196 - 15 * 0.62 + 0.5, 3.4], [118, 194 - 14 * 0.62 + 0.5, 3.2]);
  }
  return (
    <g>
      <Sky uid={uid} L={L} seed={9} />
      <path d={ridgePath(far)} fill={L.far} />
      <Haze uid={uid} y={100} h={40} />
      {/* refugee camp behind the walls */}
      {tentsBehind.map(([x, y, s]) => (
        <Tent key={x} uid={uid} x={x} y={y} s={s} L={L} lit={L.glow > 0.5} torn={after} color={[L.canvasDark, L.stoneDark]} />
      ))}
      {!after && <Smoke uid={uid} x={214} y={124} s={0.55} motion={motion} op={0.45} rise={60} />}
      {!after && <Smoke uid={uid} x={372} y={122} s={0.5} motion={motion} op={0.4} rise={60} />}
      {after && <Smoke uid={uid} x={206} y={124} s={1.3} motion={motion} rise={90} />}
      {after && <Smoke uid={uid} x={360} y={122} s={1.1} motion={motion} rise={90} dur={9.5} />}
      <path d={ridgePath(mid)} fill={L.mid} />
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
          <Crowd list={[[127.5, GY - 37, 7, 'soldier', 1]]} fill={L.figure} />
          <Torch uid={uid} x={139} y={GY - 37} s={0.8} L={L} motion={motion} pole={false} />
        </g>
      )}
      {fortified && (
        <>
          <WardLine points={[[0, GY - 17], [GX - 26, GY - 18], [GX + 26, GY - 18], [400, GY - 17]]} motion={motion} />
          <Pylon uid={uid} x={GX - 30} y={GY + 3} s={1} L={L} motion={motion} />
          <Pylon uid={uid} x={GX + 30} y={GY + 3} s={1} L={L} motion={motion} />
        </>
      )}
      <Gatehouse uid={uid} x={GX} y={GY} s={1} L={L} motion={motion} state={st} />
      <path d={road.d} fill={L.road} />
      <path d={road.ruts} stroke={L.roadDark} strokeWidth="1.1" fill="none" opacity="0.5" />
      <Torch uid={uid} x={GX - 14} y={GY} s={1} L={L} motion={motion} />
      <Torch uid={uid} x={GX + 14} y={GY} s={1} L={L} motion={motion} />
      {!after && <Cart x={at(0.5)[0] + 12} y={at(0.5)[1]} s={1.15} L={L} facing={1} />}
      {fortified && (
        <>
          <Barricade x={at(0.42)[0] - 80} y={at(0.42)[1] + 2} w={34} s={1.1} L={L} />
          <Barricade x={at(0.42)[0] + 46} y={at(0.42)[1] + 2} w={30} s={1.1} L={L} />
          <Cart x={at(0.7)[0] + 34} y={at(0.7)[1] + 1} s={0.9} L={L} ox facing={-1} />
        </>
      )}
      <Crowd list={[...queue, ...guards]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
      {after && (
        <>
          <Cart x={at(0.55)[0] - 18} y={at(0.55)[1] + 1} s={1.2} L={L} broken facing={1} />
          <Debris seed={66} x={at(0.46)[0] - 10} y={at(0.46)[1] - 3} w={40} L={L} />
          <Scorch uid={uid} x={at(0.3)[0] + 10} y={at(0.3)[1]} rx={26} ry={5} />
          <Crowd list={wounded} fill={L.figure} bandages={bandages} rim={L.rim} rimOp={L.rimOp * 0.6} />
        </>
      )}
      <Monuments uid={uid} items={monuments} x={250} y={200} s={1.15} L={L} motion={motion} />
      <path d={grassTufts(73, { from: -10, to: 150, count: 22, baseAt: () => 205, h: 5 })} fill={L.fgDeep} />
      <Rocks x={14} y={226} s={1.8} L={L} />
      {after && <AftermathGrade uid={uid} L={L} />}
    </g>
  );
}

// ================================================================= WILDS
export function WildsBeat({ uid, L, st, tod, motion }) {
  const mtn = { seed: 31, y: 96, amp: 15, waves: [[2.6, 1], [6.2, 0.5], [13, 0.2]], jag: 0.8, step: 8 };
  const farG = { seed: 33, y: 132, amp: 4 };
  const midG = { seed: 35, y: 152, amp: 5, waves: [[1.4, 1], [3.3, 0.4]] };
  const nearG = { seed: 37, y: 180, amp: 5, waves: [[1.1, 1], [2.4, 0.5]] };
  const farPines = forest(81, { from: -10, to: 410, count: 70, baseAt: (x) => ridgeHeightAt(farG, x), hMin: 7, hMax: 14, snow: true });
  const midPinesL = forest(83, { from: -10, to: 150, count: 18, baseAt: (x) => ridgeHeightAt(midG, x), hMin: 22, hMax: 38, snow: true });
  const midPinesR = forest(85, { from: 232, to: 410, count: 20, baseAt: (x) => ridgeHeightAt(midG, x), hMin: 22, hMax: 40, snow: true });
  const bigL = forest(87, { from: -20, to: 44, count: 3, baseAt: () => 228, hMin: 120, hMax: 150, snow: true });
  const bigR = forest(89, { from: 372, to: 420, count: 2, baseAt: () => 228, hMin: 110, hMax: 140, snow: true });
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const wargFill = tod === 'day' ? '#d6dde2' : tod === 'dusk' ? '#6f5d70' : '#16213a';
  const wargLine = tod === 'day' ? '#4b5948' : tod === 'dusk' ? '#2a1d30' : null;
  const eyeList = [
    [168, 141, 0.8, 0.4],
    [204, 145, 0.9, 1.7],
    [185, 150, 1, 2.9],
  ];
  if (after || fortified) eyeList.push([222, 140, 0.75, 3.6]);
  if (after) eyeList.push([150, 147, 0.85, 0.9], [238, 148, 0.95, 2.2]);
  const rockX = 290;
  const rockY = ridgeHeightAt(midG, rockX) - 2;
  return (
    <g>
      <Sky uid={uid} L={L} seed={13} clouds={tod !== 'night'} />
      <defs>
        <linearGradient id={`${uid}-mtn`} gradientUnits="userSpaceOnUse" x1="0" y1="68" x2="0" y2="120">
          <stop offset="0" stopColor={L.mountainSnow} />
          <stop offset="0.3" stopColor={L.mountainSnow} />
          <stop offset="0.7" stopColor={L.mountain} />
          <stop offset="1" stopColor={L.mountain} />
        </linearGradient>
      </defs>
      <path d={ridgePath(mtn)} fill={`url(#${uid}-mtn)`} opacity="0.92" />
      <Haze uid={uid} y={96} h={44} />
      <path d={ridgePath(farG)} fill={L.snowShade} />
      <path d={farPines.body} fill={L.pineFar} />
      <path d={farPines.snow} fill={L.snowShade} opacity="0.9" />
      <Haze uid={uid} y={126} h={24} />
      <path d={ridgePath(midG)} fill={L.snowShade} />
      {/* dark forest gap where the eyes are */}
      <path d={`M140,${ridgeHeightAt(midG, 140) + 2}Q190,128 245,${ridgeHeightAt(midG, 245) + 2}Z`} fill={L.pineNear} opacity="0.9" />
      <path d={midPinesL.body} fill={L.pineMid} />
      <path d={midPinesL.lit} fill={L.rim} opacity={L.rimOp * 0.18} />
      <path d={midPinesL.snow} fill={L.snow} />
      <path d={midPinesR.body} fill={L.pineMid} />
      <path d={midPinesR.lit} fill={L.rim} opacity={L.rimOp * 0.18} />
      <path d={midPinesR.snow} fill={L.snow} />
      <Eyes list={eyeList} motion={motion} />
      {/* outcrop + warg */}
      <path d={`M${rockX - 22},${rockY + 6}L${rockX - 14},${rockY - 6}L${rockX + 4},${rockY - 10}L${rockX + 18},${rockY - 4}L${rockX + 26},${rockY + 6}Z`} fill={L.stoneDark} />
      <path d={`M${rockX - 14},${rockY - 6}L${rockX + 4},${rockY - 10}L${rockX + 10},${rockY - 7}L${rockX - 10},${rockY - 4}Z`} fill={L.snow} />
      <Warg x={rockX} y={rockY - 7} s={1.05} L={L} howl={tod !== 'day'} fill={wargFill} outline={wargLine} />
      {after && <Warg x={128} y={ridgeHeightAt(midG, 128) + 2} s={0.6} L={L} fill={wargFill} outline={wargLine} />}
      {after && <Warg x={252} y={ridgeHeightAt(midG, 252) + 3} s={0.55} L={L} fill={wargFill} outline={wargLine} />}
      <path d={ridgePath(nearG)} fill={L.snow} />
      <path d={ridgePath({ ...nearG, seed: 39, y: 192, amp: 3 })} fill={L.snowShade} opacity="0.35" />
      {fortified && (
        <>
          <Palisade x={60} y={176} w={90} h={11} L={L} />
          <Palisade x={250} y={178} w={110} h={11} L={L} />
          <WardLine points={[[40, 164], [150, 160], [250, 162], [380, 160]]} motion={motion} />
          <Pylon uid={uid} x={150} y={178} s={1.1} L={L} motion={motion} />
          <Pylon uid={uid} x={250} y={180} s={1.1} L={L} motion={motion} />
          <Torch uid={uid} x={100} y={178} s={1.2} L={L} motion={motion} />
          <Torch uid={uid} x={312} y={180} s={1.2} L={L} motion={motion} />
          <Crowd list={[[176, 184, 15, 'soldier', 1], [214, 186, 15.5, 'guard', -1], [330, 182, 14, 'soldier', -1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.5} />
        </>
      )}
      {st === 'STABLE' && (
        <Crowd list={[[118, 188, 13, 'cloak', 1], [131, 189, 9, 'child', 1], [104, 190, 14, 'refugee', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.5} />
      )}
      {after && (
        <>
          {/* burnt watch post */}
          <path d="M96,184V150M112,184V152M94,156L114,150M95,170L111,166" stroke="#120d0b" strokeWidth="2" />
          <path d="M92,150L104,142L116,151" stroke="#120d0b" strokeWidth="1.6" fill="none" />
          <Smoke uid={uid} x={104} y={146} s={1.2} motion={motion} rise={85} />
          <Embers x={104} y={152} s={1} motion={motion} count={4} seed={9} />
          <Scorch uid={uid} x={104} y={186} rx={26} ry={5} />
          <Scorch uid={uid} x={236} y={190} rx={18} ry={3.6} />
          <BrokenSpears list={[[180, 192, 16, 0.5], [196, 194, 12, -0.4], [262, 190, 14, 0.7], [276, 192, 10, -0.9]]} L={L} />
          <Crowd list={[[300, 196, 14, 'lying', 1]]} fill={L.figure} />
        </>
      )}
      <path d={bigL.body} fill={L.pineNear} />
      <path d={bigL.snow} fill={L.snow} opacity="0.85" />
      <path d={bigR.body} fill={L.pineNear} />
      <path d={bigR.lit} fill={L.rim} opacity={L.rimOp * 0.15} />
      <path d={bigR.snow} fill={L.snow} opacity="0.85" />
      <Snowfall motion={motion} L={L} seed={11} count={30} dur={16} size={0.6} op={0.55} />
      <Snowfall motion={motion} L={L} seed={12} count={14} dur={9} size={1.1} op={0.7} />
      {after && <AftermathGrade uid={uid} L={L} />}
    </g>
  );
}

// ================================================================= RUIN
export function RuinBeat({ uid, L, st, motion }) {
  const far = { seed: 41, y: 118, amp: 6 };
  const mid = { seed: 43, y: 152, amp: 4 };
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const shrubs = groveBlobs(91, { from: 60, to: 360, count: 12, baseAt: () => 172, rMin: 2.6, rMax: 5 });
  const pines = forest(93, { from: 300, to: 420, count: 6, baseAt: (x) => ridgeHeightAt(mid, x) + 2, hMin: 26, hMax: 44 });
  const pinesL = forest(95, { from: -20, to: 70, count: 5, baseAt: (x) => ridgeHeightAt(mid, x) + 2, hMin: 24, hMax: 40 });
  const PY = 172;
  return (
    <g>
      <Sky uid={uid} L={L} seed={17} />
      <path d={ridgePath({ seed: 45, y: 104, amp: 7, jag: 0.8, step: 10 })} fill={L.mountain} opacity="0.6" />
      <Haze uid={uid} y={90} h={40} />
      <path d={ridgePath(far)} fill={L.far} />
      <Haze uid={uid} y={116} h={30} />
      <path d={ridgePath(mid)} fill={L.mid} />
      <path d={pines.body} fill={L.pineMid} />
      <path d={pines.lit} fill={L.rim} opacity={L.rimOp * 0.18} />
      <path d={pinesL.body} fill={L.pineMid} />
      {/* platform + steps */}
      <path d={`M70,${PY}L96,${PY - 10}H306L332,${PY}Z`} fill={L.stoneDark} />
      <path d={`M96,${PY - 10}H306L310,${PY - 8}H92Z`} fill={L.stone} opacity="0.75" />
      <path d={`M150,${PY}v-3h100v3M160,${PY - 3}v-3h80v3`} fill="none" stroke={L.stone} strokeWidth="0.8" opacity="0.6" />
      {/* arch fragment */}
      <path d={`M82,${PY - 8}V118h9V${PY - 8}Z M118,${PY - 8}V124h9V${PY - 8}Z`} fill={`url(#${uid}-stone)`} />
      <path d="M80,120Q104,92 129,124L127,128Q104,102 82,124Z" fill={L.stone} />
      <path d="M118,124L122,113L129,124Z" fill={L.stoneDark} />
      <Column uid={uid} x={142} y={PY - 10} h={50} L={L} />
      <Column uid={uid} x={164} y={PY - 10} h={30} L={L} broken={5} />
      <Column uid={uid} x={238} y={PY - 10} h={38} L={L} broken={7} />
      <Column uid={uid} x={262} y={PY - 10} h={56} L={L} />
      <Column uid={uid} x={286} y={PY - 10} h={22} L={L} broken={4} />
      {/* lintel on the tall pair */}
      <rect x="136" y={PY - 64} width="14" height="4" fill={L.stone} transform={`rotate(-6 143 ${PY - 62})`} />
      {fortified && (
        <g>
          {/* research scaffold */}
          <path d={`M252,${PY - 10}V${PY - 72}M274,${PY - 10}V${PY - 72}M250,${PY - 30}H276M250,${PY - 52}H276M252,${PY - 10}L274,${PY - 52}M274,${PY - 30}L252,${PY - 72}`} stroke={L.wood} strokeWidth="1.1" />
          <rect x="248" y={PY - 74} width="30" height="2.4" fill={L.wood} />
          <Tent uid={uid} x={112} y={PY - 9} s={1.3} L={L} lit pennant motion={motion} />
          <Torch uid={uid} x={186} y={PY - 10} s={1.1} L={L} motion={motion} />
          <Crowd list={[[196, PY - 10, 12, 'officer', -1], [312, PY - 2, 14, 'soldier', -1], [84, PY + 2, 14, 'guard', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.5} />
        </g>
      )}
      <Monolith uid={uid} x={208} y={PY - 9} s={1.1} L={L} motion={motion} intensity={after ? 1.4 : fortified ? 1.15 : 1} />
      {fortified && (
        <>
          <WardLine points={[[150, PY - 26], [208, PY - 36], [270, PY - 26]]} motion={motion} />
          <Pylon uid={uid} x={150} y={PY - 9} s={1.05} L={L} motion={motion} />
          <Pylon uid={uid} x={270} y={PY - 9} s={1.05} L={L} motion={motion} />
        </>
      )}
      {after && (
        <>
          <path d={`M246,${PY - 10}L290,${PY - 46}M256,${PY - 10}L300,${PY - 40}M240,${PY - 26}L304,${PY - 20}`} stroke={L.woodDark} strokeWidth="1.2" />
          <Scorch uid={uid} x={128} y={PY - 6} rx={26} ry={4} />
          <Smoke uid={uid} x={118} y={PY - 12} s={1.1} motion={motion} rise={90} />
          <path d={`M166,${PY - 9}l7,-4l8,2l2,4Z M226,${PY - 9}l5,-5l9,1l1,5Z`} fill={L.stone} />
          <Crowd list={[[300, PY + 18, 14, 'sitting', -1]]} fill={L.figure} bandages={[[300, PY + 18 - 14 * 0.62 + 0.5, 3.3]]} />
        </>
      )}
      <Haze uid={uid} y={150} h={40} />
      <path d={shrubs.body} fill={L.near} />
      {/* fallen drums */}
      <g>
        <rect x="106" y="186" width="20" height="9" rx="1.5" fill={`url(#${uid}-stone)`} transform="rotate(8 116 190)" />
        <ellipse cx="127" cy="192" rx="2.6" ry="4.6" fill={L.stone} transform="rotate(8 116 190)" />
        <rect x="282" y="184" width="16" height="8" rx="1.5" fill={`url(#${uid}-stone)`} transform="rotate(-10 290 188)" />
      </g>
      <path d={ridgePath({ seed: 47, y: 204, amp: 4 })} fill={L.fg} />
      <path d={grassTufts(75, { from: -10, to: 410, count: 34, baseAt: () => 200, h: 5 })} fill={L.fgDeep} />
      {after && <AftermathGrade uid={uid} L={L} />}
    </g>
  );
}

// ================================================================= CHAMPION
export function ChampionBeat({ uid, L, st, motion }) {
  const far = { seed: 51, y: 122, amp: 4 };
  const mid = { seed: 53, y: 152, amp: 3, waves: [[1.1, 1], [2.9, 0.3]] };
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const scars = (() => {
    const rnd = mulberry32(57);
    let d = '';
    for (let i = 0; i < 14; i += 1) {
      const x = rnd() * 400;
      const y = 160 + rnd() * 40;
      const len = 10 + rnd() * 30;
      d += `M${r1(x)},${r1(y)}q${r1(len / 2)},${r1(-1 - rnd() * 2)} ${r1(len)},${r1(rnd() * 2)}`;
    }
    return d;
  })();
  const craters = [
    [120, 182, 16],
    [196, 196, 11],
    [330, 192, 14],
    [70, 170, 9],
  ];
  return (
    <g>
      <Sky uid={uid} L={L} seed={19} />
      {/* industrial haze beyond the border */}
      <path d={`M322,${far.y - 2}V96h2.4V${far.y - 2}ZM340,${far.y - 2}V90h3V${far.y - 2}ZM362,${far.y - 2}V99h2.4V${far.y - 2}Z`} fill={L.far} />
      <Smoke uid={uid} x={341} y={90} s={1} motion={motion} rise={50} drift={-40} dur={11} op={0.6} />
      <Smoke uid={uid} x={323} y={96} s={0.7} motion={motion} rise={40} drift={-34} dur={12} op={0.5} />
      <path d={ridgePath(far)} fill={L.far} />
      <Haze uid={uid} y={106} h={36} />
      <path d={ridgePath(mid)} fill={L.mid} />
      <path d={ridgePath({ seed: 55, y: 176, amp: 3 })} fill={L.near} />
      <path d={scars} stroke={L.fgDeep} strokeWidth="1" fill="none" opacity="0.55" />
      {craters.map(([x, y, r]) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.28} fill={L.fgDeep} opacity="0.75" />
          <path d={`M${x - r},${y}q${r},${-r * 0.32} ${r * 2},0`} stroke={L.rim} strokeOpacity={L.rimOp * 0.35} strokeWidth="0.7" fill="none" />
        </g>
      ))}
      <Fence x={232} y={166} w={176} L={L} broken={after} />
      <Depot uid={uid} x={296} y={164} s={0.85} L={L} motion={motion} damaged={after} />
      <Walker uid={uid} x={236} y={182} s={1} L={L} motion={motion} damaged={after} />
      {!after && L.glow > 0.3 && <Glow uid={uid} x={214} y={176} r={20} op={0.25 * L.glow} />}
      {st === 'STABLE' && (
        <>
          <Banner x={46} y={200} h={34} len={16} hgt={6.5} L={L} motion={motion} />
          <Crowd list={[[64, 202, 18, 'soldier', 1], [82, 204, 17, 'officer', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
        </>
      )}
      {fortified && (
        <>
          <Barricade x={10} y={196} w={60} s={1.4} L={L} />
          <Barricade x={110} y={200} w={44} s={1.4} L={L} />
          <WardLine points={[[0, 176], [84, 168], [170, 174]]} motion={motion} />
          <Pylon uid={uid} x={84} y={192} s={1.4} L={L} motion={motion} />
          <Pylon uid={uid} x={170} y={196} s={1.3} L={L} motion={motion} />
          <Banner x={40} y={196} h={36} len={16} hgt={6.5} L={L} motion={motion} />
          <Torch uid={uid} x={104} y={200} s={1.5} L={L} motion={motion} />
          <Crowd list={[[24, 210, 20, 'soldier', 1], [56, 208, 19, 'guard', 1], [96, 212, 20, 'soldier', 1], [140, 212, 19, 'soldier', 1]]} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
        </>
      )}
      {after && (
        <>
          <Flame x={120} y={182} h={6} motion={motion} />
          <Glow uid={uid} x={120} y={178} r={14} op={0.6} />
          <Smoke uid={uid} x={120} y={176} s={1} motion={motion} rise={80} />
          <Flame x={330} y={192} h={5} motion={motion} dur={1.1} />
          <Glow uid={uid} x={330} y={188} r={12} op={0.55} />
          <Barricade x={20} y={200} w={56} s={1.4} L={L} broken />
          <Debris seed={68} x={150} y={198} w={70} L={L} />
          <Crowd list={[[52, 210, 19, 'sitting', 1], [76, 212, 18, 'wounded', 1], [100, 214, 20, 'lying', 1]]} fill={L.figure} bandages={[[52, 210 - 19 * 0.62 + 0.6, 4], [76, 212 - 18 * 0.62 + 0.6, 3.8]]} />
          <BrokenSpears list={[[150, 206, 18, 0.6], [168, 208, 14, -0.5]]} L={L} />
        </>
      )}
      <path d={grassTufts(77, { from: -10, to: 410, count: 20, baseAt: () => 212, h: 4 })} fill={L.fgDeep} />
      {after && <AftermathGrade uid={uid} L={L} />}
    </g>
  );
}

// ================================================================= CAMP
export function CampBeat({ uid, L, st, tod, motion }) {
  const fortified = st === 'FORTIFIED';
  const after = st === 'AFTERMATH';
  const valleyFar = { seed: 61, y: 116, amp: 4 };
  const valley = { seed: 63, y: 130, amp: 3, waves: [[1.2, 1], [3.4, 0.35]] };
  const crest = { seed: 65, y: 170, amp: 7, waves: [[0.9, 1], [2.1, 0.35]], bumps: [{ x: 190, w: 120, h: 6 }] };
  const crestAt = (x) => ridgeHeightAt(crest, x);
  const lights = (() => {
    const rnd = mulberry32(69);
    const pts = [];
    for (let i = 0; i < 14; i += 1) {
      const t = i / 13;
      const x = 20 + t * 360;
      const y = 140 + Math.sin(t * 6 + 1) * 4 + t * 2;
      if (rnd() > 0.35) pts.push([x, y]);
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
  const fireY = crestAt(fireX) + 22;
  const seated = [
    [fireX - 20, fireY + 2, 16, 'sitting', 1],
    [fireX + 21, fireY + 3, 15, 'sitting', -1],
  ];
  if (!after) seated.push([fireX + 8, fireY + 12, 14, 'sitting', -1]);
  const sentries = [[256, crestAt(256) + 4, 17, 'guard', 1]];
  if (fortified) sentries.push([150, crestAt(150) + 4, 16, 'soldier', -1], [292, crestAt(292) + 5, 16, 'soldier', 1]);
  return (
    <g>
      <Sky uid={uid} L={L} seed={23} />
      <path d={ridgePath({ seed: 67, y: 98, amp: 10, jag: 0.8, step: 9 })} fill={L.mountain} opacity="0.72" />
      <Haze uid={uid} y={86} h={40} />
      <path d={ridgePath(valleyFar)} fill={L.far} />
      <Haze uid={uid} y={112} h={26} />
      <path d={ridgePath(valley)} fill={L.mid} />
      {/* patchwork fields + river + road through the Marches */}
      <path d={hedges(71, { from: 0, to: 400, rows: 14, baseAt: (x) => ridgeHeightAt(valley, x) + 4 })} stroke={L.near} strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d="M-5,150 C60,142 110,156 170,146 S290,138 405,150" stroke={L.near} strokeWidth="3.2" fill="none" opacity="0.35" />
      <path d="M-5,150 C60,142 110,156 170,146 S290,138 405,150" stroke={L.sky[3]} strokeWidth="1.4" fill="none" opacity={L.glow > 0.8 ? 0.22 : 0.32} />
      <path d="M-5,139 C70,146 150,134 220,141 S330,147 405,138" stroke={L.road} strokeWidth="0.8" fill="none" opacity="0.38" strokeDasharray="5 1.5" />
      {nightish && (
        <g fill={C.lattice300}>
          {lights.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="0.7" />
          ))}
          <path d="M340,137h2v-2h1.4v2h1.2v-3h1.2v3h1.6v-1.6h1.2v1.6h1.4v1.2h-10Z" opacity="0.85" />
        </g>
      )}
      {after && <Smoke uid={uid} x={110} y={140} s={0.9} motion={motion} rise={60} drift={-30} op={0.7} />}
      {/* the crest we stand on */}
      <path d={ridgePath(crest)} fill={L.fg} />
      <path d={`M-12,${crestAt(-12)}${Array.from({ length: 43 }, (_, i) => `L${i * 10 - 10},${r1(crestAt(i * 10 - 10))}`).join('')}`} stroke={L.rim} strokeOpacity={L.rimOp * 0.35} strokeWidth="0.8" fill="none" />
      {fortified && (
        <>
          <Palisade x={-10} y={crestAt(60) + 6} w={130} h={12} L={L} />
          <Palisade x={270} y={crestAt(330) + 6} w={150} h={12} L={L} />
          <WardLine points={[[0, crestAt(0) - 8], [140, crestAt(140) - 14], [260, crestAt(260) - 14], [400, crestAt(400) - 8]]} motion={motion} />
          <Pylon uid={uid} x={140} y={crestAt(140) + 2} s={1.1} L={L} motion={motion} />
          <Pylon uid={uid} x={260} y={crestAt(260) + 2} s={1.1} L={L} motion={motion} />
          <Banner x={232} y={crestAt(232) + 8} h={32} len={15} hgt={6} L={L} motion={motion} />
        </>
      )}
      {tents.map(([x, s, lit]) => (
        <Tent key={x} uid={uid} x={x} y={crestAt(x) + 12 * s} s={s * 1.5} L={L} lit={lit && nightish} torn={after && x === 86} pennant={x === 312 || x === 52} motion={motion} />
      ))}
      <Banner x={118} y={crestAt(118) + 12} h={34} len={15} hgt={6} L={L} motion={motion} torn={after} />
      <Crowd list={sentries} fill={L.figure} rim={L.rim} rimOp={L.rimOp * 0.6} />
      {after ? (
        <>
          <CampfireMark uid={uid} x={fireX} y={fireY} s={1.2} L={L} motion={motion} big={0.5} />
          <Smoke uid={uid} x={fireX} y={fireY - 6} s={1} motion={motion} rise={90} />
          <Cart x={334} y={crestAt(334) + 34} s={1.6} L={L} broken facing={-1} />
          <Crowd
            list={[[54, crestAt(54) + 38, 17, 'lying', 1], [96, crestAt(96) + 34, 17, 'wounded', 1], [128, crestAt(128) + 40, 16, 'sitting', 1]]}
            fill={L.figure}
            bandages={[[96, crestAt(96) + 34 - 17 * 0.62 + 0.6, 3.8], [128, crestAt(128) + 40 - 16 * 0.62 + 0.6, 3.6]]}
          />
        </>
      ) : (
        <CampfireMark uid={uid} x={fireX} y={fireY} s={1.2} L={L} motion={motion} big={tod === 'day' ? 0.8 : 1} />
      )}
      <Crowd list={seated} fill={L.figure} rim={C.ember300} rimOp={0.25 + 0.5 * L.glow} />
      {!after && fortified && <Cart x={350} y={crestAt(350) + 38} s={1.5} L={L} facing={-1} />}
      <path d={grassTufts(79, { from: -10, to: 410, count: 30, baseAt: () => 210, h: 5 })} fill={L.fgDeep} />
      {after && <AftermathGrade uid={uid} L={L} />}
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
