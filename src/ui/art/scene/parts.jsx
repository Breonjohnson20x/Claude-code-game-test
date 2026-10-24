// Scene primitives for RegionScene. Pure SVG; animation via SMIL, only when
// `motion` is true (callers pass !prefersReducedMotion). Key light: upper right.
import { C } from '../palette.js';
import { mulberry32, r1, crowdPath } from '../util.js';

// ---------------------------------------------------------------- defs
export function SceneDefs({ uid, L }) {
  const [s0, s1, s2, s3] = L.sky;
  return (
    <defs>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={s0} />
        <stop offset="0.38" stopColor={s1} />
        <stop offset="0.72" stopColor={s2} />
        <stop offset="1" stopColor={s3} />
      </linearGradient>
      <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={L.sun.halo} stopOpacity={L.sun.haloOp} />
        <stop offset="0.35" stopColor={L.sun.halo} stopOpacity={L.sun.haloOp * 0.45} />
        <stop offset="1" stopColor={L.sun.halo} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-haze`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={L.haze} stopOpacity="0" />
        <stop offset="0.55" stopColor={L.haze} stopOpacity={L.hazeOp} />
        <stop offset="1" stopColor={L.haze} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${uid}-warm`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.lattice300} stopOpacity="0.95" />
        <stop offset="0.18" stopColor={C.ember300} stopOpacity="0.6" />
        <stop offset="0.5" stopColor={C.ember400} stopOpacity="0.22" />
        <stop offset="1" stopColor={C.ember500} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-lattice`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.lattice100} stopOpacity="0.95" />
        <stop offset="0.3" stopColor={C.lattice300} stopOpacity="0.45" />
        <stop offset="1" stopColor={C.gold400} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-smoke`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={L.smoke} stopOpacity="0.9" />
        <stop offset="0.6" stopColor={L.smoke} stopOpacity="0.45" />
        <stop offset="1" stopColor={L.smoke} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-scorch`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#0b0806" stopOpacity="0.85" />
        <stop offset="0.55" stopColor="#1a120c" stopOpacity="0.5" />
        <stop offset="1" stopColor="#1a120c" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-vig`} cx="50%" cy="46%" r="70%">
        <stop offset="0.55" stopColor={L.shade} stopOpacity="0" />
        <stop offset="1" stopColor={L.shade} stopOpacity={L.vignette + 0.25} />
      </radialGradient>
      <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.navy950} stopOpacity="0" />
        <stop offset="1" stopColor={C.navy950} stopOpacity="0.92" />
      </linearGradient>
      <linearGradient id={`${uid}-stone`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={L.stoneDark} />
        <stop offset="0.62" stopColor={L.stone} />
        <stop offset="1" stopColor={L.stone} />
      </linearGradient>
      <linearGradient id={`${uid}-iron`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4a4f57" />
        <stop offset="0.55" stopColor="#2b2f35" />
        <stop offset="1" stopColor="#17191c" />
      </linearGradient>
      <linearGradient id={`${uid}-crystal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.lattice100} />
        <stop offset="1" stopColor={C.gold400} />
      </linearGradient>
    </defs>
  );
}

// ---------------------------------------------------------------- sky
function cloudPath(x, y, w, h) {
  // flat-bottomed cumulus bank
  return `M${r1(x)},${r1(y)}q${r1(w * 0.08)},${r1(-h * 0.9)} ${r1(w * 0.22)},${r1(-h * 0.55)}q${r1(w * 0.1)},${r1(-h * 0.9)} ${r1(w * 0.26)},${r1(-h * 0.35)}q${r1(w * 0.14)},${r1(-h * 0.75)} ${r1(w * 0.26)},${r1(h * 0.1)}q${r1(w * 0.18)},${r1(-h * 0.1)} ${r1(w * 0.26)},${r1(h * 0.8)}Z`;
}

export function Sky({ uid, L, seed = 7, clouds = true }) {
  const rnd = mulberry32(seed);
  let stars = '';
  let brightStars = '';
  if (L.stars > 0) {
    for (let i = 0; i < 70; i += 1) {
      const x = rnd() * 400;
      const y = rnd() * 100 * (0.25 + rnd() * 0.75);
      const r = rnd() < 0.12 ? 0.75 : 0.38;
      const d = `M${r1(x - r)},${r1(y)}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0Z`;
      if (r > 0.5) brightStars += d;
      else stars += d;
    }
  }
  const { sun } = L;
  let cloudD = '';
  if (clouds) {
    cloudD += cloudPath(18, 66, 92, 9);
    cloudD += cloudPath(150, 52, 70, 7);
    cloudD += cloudPath(236, 78, 120, 8);
  }
  return (
    <g>
      <rect x="-5" y="-5" width="410" height="235" fill={`url(#${uid}-sky)`} />
      {L.stars > 0 && (
        <g fill={C.lattice100}>
          <path d={stars} opacity={0.55 * L.stars} />
          <path d={brightStars} opacity={0.9 * L.stars} />
        </g>
      )}
      <circle cx={sun.x} cy={sun.y} r={sun.haloR} fill={`url(#${uid}-halo)`} />
      {sun.moon ? (
        <g>
          <circle cx={sun.x} cy={sun.y} r={sun.r} fill={sun.core} />
          <circle cx={sun.x + sun.r * 0.45} cy={sun.y - sun.r * 0.2} r={sun.r * 0.9} fill={L.sky[1]} opacity="0.9" />
        </g>
      ) : (
        <circle cx={sun.x} cy={sun.y} r={sun.r} fill={sun.core} />
      )}
      {clouds && <path d={cloudD} fill={L.cloud} opacity={L.cloudOp} />}
    </g>
  );
}

export function Haze({ uid, y, h }) {
  return <rect x="-5" y={y} width="410" height={h} fill={`url(#${uid}-haze)`} />;
}

export function Vignette({ uid, fade = true }) {
  return (
    <g pointerEvents="none">
      <rect x="-5" y="-5" width="410" height="235" fill={`url(#${uid}-vig)`} />
      {fade && <rect x="-5" y="170" width="410" height="55" fill={`url(#${uid}-fade)`} />}
    </g>
  );
}

// ---------------------------------------------------------------- fx
export function Glow({ uid, x, y, r, op = 1, kind = 'warm' }) {
  return <circle cx={x} cy={y} r={r} fill={`url(#${uid}-${kind})`} opacity={op} />;
}

export function Smoke({ uid, x, y, s = 1, motion, puffs = 5, drift = -26, rise = 70, dur = 8, op = 1 }) {
  // Overlapping soft puffs so the column reads as one plume, not beads.
  const n = Math.max(6, Math.round(puffs * 1.6));
  const r0 = 4 * s;
  const r1_ = 19 * s;
  const items = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    if (motion) {
      items.push(
        <circle key={i} cx={x} cy={y} r={r0} fill={`url(#${uid}-smoke)`} opacity="0">
          <animate attributeName="cy" values={`${y};${y - rise * 0.55 * s};${y - rise * s}`} keyTimes="0;0.45;1" dur={`${dur}s`} begin={`${-t * dur}s`} repeatCount="indefinite" />
          <animate attributeName="cx" values={`${x};${x + drift * 0.25 * s};${x + drift * s}`} dur={`${dur}s`} begin={`${-t * dur}s`} repeatCount="indefinite" />
          <animate attributeName="r" values={`${r0};${r1_}`} dur={`${dur}s`} begin={`${-t * dur}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`0;${0.62 * op};${0.36 * op};0`} keyTimes="0;0.12;0.55;1" dur={`${dur}s`} begin={`${-t * dur}s`} repeatCount="indefinite" />
        </circle>,
      );
    } else {
      const k = (i + 0.5) / n;
      items.push(
        <circle
          key={i}
          cx={x + drift * s * k * k}
          cy={y - rise * s * (k < 0.45 ? (k / 0.45) * 0.55 : 0.55 + ((k - 0.45) / 0.55) * 0.45)}
          r={r0 + (r1_ - r0) * k}
          fill={`url(#${uid}-smoke)`}
          opacity={op * (0.62 - k * 0.45)}
        />,
      );
    }
  }
  return <g>{items}</g>;
}

export function Scorch({ uid, x, y, rx = 16, ry = 4 }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${uid}-scorch)`} />;
}

export function Embers({ x, y, s = 1, motion, count = 4, seed = 3 }) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const dx = (rnd() - 0.5) * 8 * s;
    const dur = 2.2 + rnd() * 1.6;
    const cx = x + dx;
    out.push(
      <circle key={i} cx={cx} cy={motion ? y : y - (8 + rnd() * 14) * s} r={0.55 * s} fill={C.lattice300} opacity={motion ? 0 : 0.7}>
        {motion && (
          <>
            <animate attributeName="cy" values={`${y};${y - 30 * s}`} dur={`${dur}s`} begin={`${-rnd() * dur}s`} repeatCount="indefinite" />
            <animate attributeName="cx" values={`${cx};${cx - 6 * s};${cx - 2 * s}`} dur={`${dur}s`} begin={`${-rnd() * dur}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${dur}s`} begin={`${-rnd() * dur}s`} repeatCount="indefinite" />
          </>
        )}
      </circle>,
    );
  }
  return <g>{out}</g>;
}

// flame shape anchored at its base (0,0), height 1
const FLAME_OUT = 'M0,0 C-0.42,-0.05 -0.5,-0.45 -0.18,-0.7 C-0.12,-0.48 0,-0.5 0.02,-1 C0.3,-0.68 0.52,-0.42 0.4,-0.16 C0.34,-0.04 0.2,0 0,0Z';
const FLAME_IN = 'M0,0 C-0.24,-0.04 -0.28,-0.3 -0.06,-0.5 C0,-0.38 0.06,-0.4 0.08,-0.68 C0.24,-0.44 0.3,-0.24 0.22,-0.1 C0.16,-0.02 0.1,0 0,0Z';

export function Flame({ x, y, h, motion, dur = 0.9 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g>
        {motion && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values={`${h} ${h};${h * 0.92} ${h * 1.12};${h * 1.06} ${h * 0.9};${h} ${h}`}
            dur={`${dur}s`}
            repeatCount="indefinite"
          />
        )}
        <g transform={motion ? undefined : `scale(${h})`}>
          <path d={FLAME_OUT} fill={C.ember400} />
          <path d={FLAME_IN} fill={C.lattice300} />
        </g>
      </g>
    </g>
  );
}

export function Torch({ uid, x, y, s = 1, L, motion, pole = true }) {
  const g = L.glow;
  return (
    <g>
      {g > 0.2 && (
        <circle cx={x} cy={y - 9 * s} r={16 * s} fill={`url(#${uid}-warm)`} opacity={0.75 * g}>
          {motion && <animate attributeName="opacity" values={`${0.75 * g};${0.95 * g};${0.62 * g};${0.85 * g};${0.75 * g}`} dur="1.9s" repeatCount="indefinite" />}
        </circle>
      )}
      {pole && <rect x={x - 0.45 * s} y={y - 8 * s} width={0.9 * s} height={8 * s} fill={L.woodDark} />}
      <path d={`M${x - 1.6 * s},${y - 8.4 * s}h${3.2 * s}l${-0.7 * s},${1.3 * s}h${-1.8 * s}Z`} fill={L.woodDark} />
      <Flame x={x} y={y - 8.4 * s} h={4.2 * s} motion={motion} />
    </g>
  );
}

// ---------------------------------------------------------------- banners
function flagPath(x, y, len, hgt, phase, amp, tail = true) {
  const steps = 6;
  const top = [];
  const bot = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const off = Math.sin(u * 4.2 + phase) * amp * u;
    const sag = u * u * hgt * 0.18;
    top.push([x - len * u, y + off + sag]);
    bot.push([x - len * u * (tail ? 1 : 1), y + hgt + off * 1.1 + sag * 0.6]);
  }
  let d = `M${r1(top[0][0])},${r1(top[0][1])}`;
  for (let i = 1; i <= steps; i += 1) d += `L${r1(top[i][0])},${r1(top[i][1])}`;
  if (tail) {
    const e = top[steps];
    const b = bot[steps];
    d += `L${r1(e[0] + len * 0.13)},${r1((e[1] + b[1]) / 2)}`;
  }
  for (let i = steps; i >= 0; i -= 1) d += `L${r1(bot[i][0])},${r1(bot[i][1])}`;
  return `${d}Z`;
}

/** Pole with a flag flying left (wind from the east). colors: [field, trim] */
export function Banner({ x, y, h = 24, len = 13, hgt = 6, motion, colors = [C.navy700, C.gold400], torn = false, L, dur = 3.6, pole = true }) {
  const fy = y - h + 0.8;
  const fx = x - 0.5;
  const amp = torn ? 0.6 : 1.4;
  const flen = torn ? len * 0.62 : len;
  const d0 = flagPath(fx, fy, flen, hgt, 0, amp, !torn);
  const d1 = flagPath(fx, fy, flen, hgt, 2.1, amp, !torn);
  const d2 = flagPath(fx, fy, flen, hgt, 4.2, amp, !torn);
  return (
    <g>
      {pole && <rect x={x - 0.55} y={y - h} width="1.1" height={h} fill={L ? L.woodDark : C.stone800} />}
      {pole && <circle cx={x} cy={y - h - 0.6} r="0.9" fill={C.gold400} />}
      <path d={d0} fill={colors[0]} opacity={torn ? 0.85 : 1}>
        {motion && <animate attributeName="d" values={`${d0};${d1};${d2};${d0}`} dur={`${dur}s`} repeatCount="indefinite" />}
      </path>
      <rect x={fx - 3.4} y={fy + hgt * 0.5 - 1.1} width="2.2" height="2.2" transform={`rotate(45 ${fx - 2.3} ${fy + hgt * 0.5})`} fill={colors[1]} />
      <rect x={fx - flen * 0.12} y={fy + 0.3} width={flen * 0.1} height="0.6" fill={colors[1]} opacity="0.8" />
      {torn && <path d={`M${r1(fx - flen)},${r1(fy + hgt * 0.3)}l-2,1.4l1.6,0.6l-1.8,1.6`} stroke={colors[0]} strokeWidth="0.8" fill="none" />}
    </g>
  );
}

/** Vertical hanging gonfalon (for walls/gates). */
export function Gonfalon({ x, y, w = 7, h = 16, colors = [C.navy700, C.gold400], torn = false, motion }) {
  const d = torn
    ? `M${x - w / 2},${y}h${w}v${h * 0.55}l-${w * 0.2},${h * 0.12}l-${w * 0.25},-${h * 0.18}l-${w * 0.2},${h * 0.22}l-${w * 0.35},-${h * 0.14}Z`
    : `M${x - w / 2},${y}h${w}v${h}l-${w / 2},-${h * 0.18}l-${w / 2},${h * 0.18}Z`;
  return (
    <g>
      <rect x={x - w / 2 - 1} y={y - 0.8} width={w + 2} height="1.2" fill={C.gold600} />
      <g>
        {motion && !torn && (
          <animateTransform attributeName="transform" type="skewX" values="0;2.2;-1.2;0" dur="5.5s" repeatCount="indefinite" />
        )}
        <path d={d} fill={colors[0]} />
        <path d={`M${x - w / 2 + 0.8},${y}v${h * (torn ? 0.5 : 0.9)}M${x + w / 2 - 0.8},${y}v${h * (torn ? 0.5 : 0.9)}`} stroke={colors[1]} strokeWidth="0.5" opacity="0.8" />
        {!torn && <path d={`M${x},${y + h * 0.3}l${w * 0.22},${w * 0.22}l-${w * 0.22},${w * 0.22}l-${w * 0.22},-${w * 0.22}Z`} fill={colors[1]} />}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------- magitech ward
export function Pylon({ uid, x, y, s = 1, motion, L }) {
  return (
    <g>
      <circle cx={x} cy={y - 13 * s} r={11 * s} fill={`url(#${uid}-lattice)`} opacity={0.55 + L.glow * 0.4}>
        {motion && <animate attributeName="opacity" values={`${0.5 + L.glow * 0.3};${0.75 + L.glow * 0.25};${0.5 + L.glow * 0.3}`} dur="3.2s" repeatCount="indefinite" />}
      </circle>
      <path d={`M${x - 2.6 * s},${y}L${x - 1.6 * s},${y - 10 * s}H${x + 1.6 * s}L${x + 2.6 * s},${y}Z`} fill={`url(#${uid}-stone)`} />
      <path d={`M${x + 0.6 * s},${y - 10 * s}H${x + 1.6 * s}L${x + 2.6 * s},${y}H${x + 1.4 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.6} />
      <rect x={x - 2 * s} y={y - 6 * s} width={4 * s} height={0.7 * s} fill={C.gold500} />
      <path d={`M${x},${y - 17 * s}L${x + 1.9 * s},${y - 13 * s}L${x},${y - 10.2 * s}L${x - 1.9 * s},${y - 13 * s}Z`} fill={`url(#${uid}-crystal)`} />
    </g>
  );
}

export function WardLine({ points, motion, op = 1 }) {
  const pts = points.map((p) => p.join(',')).join(' ');
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={op}>
      <polyline points={pts} stroke={C.lattice300} strokeWidth="4" opacity="0.18" />
      <polyline points={pts} stroke={C.lattice200} strokeWidth="1.2" opacity="0.55" />
      <polyline points={pts} stroke={C.lattice100} strokeWidth="0.7" strokeDasharray="2 5">
        {motion && <animate attributeName="stroke-dashoffset" values="0;-14" dur="1.6s" repeatCount="indefinite" />}
      </polyline>
    </g>
  );
}

// ---------------------------------------------------------------- military
export function Barricade({ x, y, w = 30, s = 1, L, broken = false }) {
  const n = Math.max(2, Math.round(w / (7 * s)));
  let stakes = '';
  for (let i = 0; i <= n; i += 1) {
    const sx = x + (w * i) / n;
    if (broken && i % 3 === 1) continue;
    stakes += `M${r1(sx - 4 * s)},${r1(y)}L${r1(sx + 3.4 * s)},${r1(y - 8 * s)}L${r1(sx + 4.2 * s)},${r1(y - 7.4 * s)}L${r1(sx - 3.2 * s)},${r1(y + 0.6 * s)}Z`;
    stakes += `M${r1(sx + 4 * s)},${r1(y)}L${r1(sx - 3.4 * s)},${r1(y - 8 * s)}L${r1(sx - 4.2 * s)},${r1(y - 7.4 * s)}L${r1(sx + 3.2 * s)},${r1(y + 0.6 * s)}Z`;
  }
  return (
    <g>
      <path d={stakes} fill={L.wood} />
      <rect x={x - 2 * s} y={y - 4.4 * s} width={w + 4 * s} height={1.8 * s} rx={0.9 * s} fill={L.woodDark} transform={broken ? `rotate(-4 ${x} ${y})` : undefined} />
    </g>
  );
}

export function Palisade({ x, y, w, h = 12, L, gapFrom, gapTo }) {
  let d = '';
  const step = 2.6;
  for (let px = x; px < x + w; px += step) {
    if (gapFrom != null && px > gapFrom && px < gapTo) continue;
    const hh = h * (0.9 + ((px * 13.7) % 1) * 0.15);
    d += `M${r1(px)},${r1(y)}v${r1(-hh)}l${step * 0.45},-2l${step * 0.45},2v${r1(hh)}Z`;
  }
  return (
    <g>
      <path d={d} fill={L.wood} />
      <rect x={x} y={y - h * 0.62} width={w} height="1" fill={L.woodDark} opacity="0.8" />
    </g>
  );
}

export function Tent({ uid, x, y, s = 1, L, lit = false, torn = false, pennant = false, motion, color }) {
  const w = 16 * s;
  const h = 11 * s;
  const front = `M${x - w * 0.42},${y}L${x},${y - h}L${x + w * 0.18},${y}Z`;
  const side = `M${x},${y - h}L${x + w * 0.62},${y - h * 0.92}L${x + w * 0.66},${y}L${x + w * 0.18},${y}Z`;
  const door = `M${x - w * 0.12},${y}L${x - w * 0.02},${y - h * 0.62}L${x + w * 0.06},${y}Z`;
  return (
    <g>
      {lit && L.glow > 0.3 && <circle cx={x} cy={y - 2 * s} r={12 * s} fill={`url(#${uid}-warm)`} opacity={0.45 * L.glow} />}
      <path d={front} fill={color ? color[1] : L.canvasDark} />
      <path d={side} fill={color ? color[0] : L.canvas} />
      <path d={`M${x},${y - h}L${x + w * 0.62},${y - h * 0.92}`} stroke={L.rim} strokeOpacity={L.rimOp * 0.7} strokeWidth={0.6 * s} />
      <path d={door} fill={lit && L.glow > 0.3 ? C.ember300 : L.shade} opacity={lit && L.glow > 0.3 ? 0.95 : 0.75} />
      {torn && <path d={`M${x + w * 0.3},${y - h * 0.7}l${2 * s},${3 * s}l${-1 * s},${1.5 * s}l${2.4 * s},${2 * s}`} stroke={L.shade} strokeWidth={0.8 * s} fill="none" />}
      {pennant && <Banner x={x} y={y - h + 0.5} h={6 * s} len={5 * s} hgt={2.2 * s} motion={motion} L={L} pole />}
    </g>
  );
}

export function Cart({ x, y, s = 1, L, broken = false, cover = true, ox = false, facing = 1 }) {
  const f = facing;
  const wheel = (cx, cy, r) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={L.woodDark} strokeWidth={0.9 * s} />
      <path d={`M${cx - r},${cy}h${r * 2}M${cx},${cy - r}v${r * 2}M${cx - r * 0.7},${cy - r * 0.7}l${r * 1.4},${r * 1.4}M${cx + r * 0.7},${cy - r * 0.7}l${-r * 1.4},${r * 1.4}`} stroke={L.woodDark} strokeWidth={0.4 * s} />
    </g>
  );
  if (broken) {
    return (
      <g>
        <g transform={`rotate(${-16 * f} ${x} ${y})`}>
          <rect x={x - 8 * s} y={y - 7 * s} width={16 * s} height={4 * s} fill={L.wood} />
          <path d={`M${x - 7 * s},${y - 7 * s}q${7 * s},${-7 * s} ${12 * s},${-1 * s}`} fill="none" stroke={L.canvasDark} strokeWidth={1.2 * s} opacity="0.8" />
          {wheel(x + 5 * s, y - 2 * s, 3 * s)}
        </g>
        <ellipse cx={x - 10 * s * f} cy={y} rx={3.2 * s} ry={1 * s} fill="none" stroke={L.woodDark} strokeWidth={0.8 * s} />
        <rect x={x + 9 * s * f - 3 * s} y={y - 0.8 * s} width={7 * s} height={1 * s} fill={L.woodDark} transform={`rotate(${12 * f} ${x + 9 * s * f} ${y})`} />
      </g>
    );
  }
  return (
    <g>
      {ox && (
        <path
          d={`M${x + 9 * s * f},${y - 4 * s}h${7 * s * f}q${2 * s * f},0 ${2.6 * s * f},${-2 * s}l${1.2 * s * f},${0.4 * s}l${-0.4 * s * f},${2.6 * s}l${-1 * s * f},${0.6 * s}v${3 * s}h${-1 * s * f}v${-2.6 * s}h${-5 * s * f}v${2.6 * s}h${-1 * s * f}v${-3.6 * s}Z`}
          fill={L.figure}
        />
      )}
      <path d={`M${x + 8 * s * f},${y - 3.5 * s}h${3 * s * f}`} stroke={L.woodDark} strokeWidth={0.6 * s} />
      <rect x={x - 8 * s} y={y - 7 * s} width={16 * s} height={4 * s} fill={L.wood} />
      <rect x={x - 8 * s} y={y - 7 * s} width={16 * s} height={0.8 * s} fill={L.rim} opacity={L.rimOp * 0.4} />
      {cover && <path d={`M${x - 7.5 * s},${y - 7 * s}q${7.5 * s},${-9 * s} ${15 * s},0Z`} fill={L.canvas} />}
      {cover && <path d={`M${x},${y - 11.4 * s}q${4 * s},${0.2 * s} ${7.5 * s},${4.4 * s}h${-3 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.35} />}
      {wheel(x - 4.5 * s, y - 2.2 * s, 2.6 * s)}
      {wheel(x + 4.5 * s, y - 2.2 * s, 2.6 * s)}
    </g>
  );
}

/** People silhouettes (one path). list: [x, y, h, kind, facing] */
export function Crowd({ list, fill, rim, rimOp = 0.4, bandages = [] }) {
  if (!list.length) return null;
  return (
    <g>
      <path d={crowdPath(list)} fill={fill} />
      {rim && <path d={crowdPath(list.map(([x, y, h, k, f]) => [x + 0.35, y, h, k, f]))} fill="none" stroke={rim} strokeWidth="0.25" opacity={rimOp} />}
      {bandages.map(([bx, by, bw], i) => (
        <rect key={i} x={bx - bw / 2} y={by} width={bw} height={bw * 0.35} fill={C.parch100} opacity="0.9" />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- architecture
/** Royal forward outpost: keep with slate spire, wall, gate. Base at y. */
export function Keep({ uid, x, y, s = 1, L, motion, damaged = false, fortified = false }) {
  const lit = L.glow > 0.4;
  const crenel = (x0, y0, w, n) => {
    let d = `M${x0},${y0}`;
    const cw = w / (n * 2 - 1);
    for (let i = 0; i < n * 2 - 1; i += 1) {
      d += i % 2 === 0 ? `v${-2 * s}h${cw}v${2 * s}` : `h${cw}`;
    }
    return d;
  };
  const tx = x - 6 * s;
  const tw = 12 * s;
  const th = 30 * s;
  const ty = y - th;
  return (
    <g>
      {/* curtain wall */}
      <path d={`${crenel(x - 26 * s, y - 10 * s, 52 * s, 9)}V${y}H${x - 26 * s}Z`} fill={`url(#${uid}-stone)`} />
      <rect x={x - 26 * s} y={y - 10 * s} width={52 * s} height={10 * s} fill={`url(#${uid}-stone)`} />
      {/* side tower */}
      <rect x={x + 14 * s} y={y - 19 * s} width={8 * s} height={19 * s} fill={`url(#${uid}-stone)`} />
      <path d={crenel(x + 14 * s, y - 19 * s, 8 * s, 3) + `V${y - 19 * s}Z`} fill={L.stone} />
      {/* main tower */}
      <rect x={tx} y={ty} width={tw} height={th} fill={`url(#${uid}-stone)`} />
      <rect x={tx + tw - 1.4 * s} y={ty} width={1.4 * s} height={th} fill={L.rim} opacity={L.rimOp * 0.55} />
      {damaged ? (
        <path d={`M${tx - 1 * s},${ty}L${tx + 3 * s},${ty - 4 * s}L${tx + 5 * s},${ty - 1 * s}L${tx + 8 * s},${ty - 6 * s}L${tx + tw + 1 * s},${ty - 1 * s}V${ty}Z`} fill={L.stoneDark} />
      ) : (
        <>
          <path d={`M${tx - 1.5 * s},${ty}L${x},${ty - 15 * s}L${tx + tw + 1.5 * s},${ty}Z`} fill={C.navy700} />
          <path d={`M${x},${ty - 15 * s}L${tx + tw + 1.5 * s},${ty}H${x + 2 * s}Z`} fill={C.navy600} />
          <path d={`M${x},${ty - 15 * s}v${-3.5 * s}`} stroke={C.gold400} strokeWidth={0.7 * s} />
          <Banner x={x} y={ty - 15.5 * s} h={9 * s} len={8 * s} hgt={3.2 * s} motion={motion} L={L} pole={false} />
        </>
      )}
      {/* gate + windows */}
      <path d={`M${x - 3.2 * s},${y}v${-5 * s}a${3.2 * s},${3.2 * s} 0 0 1 ${6.4 * s},0v${5 * s}Z`} fill={lit ? C.ember500 : L.shade} opacity={lit ? 0.9 : 0.85} />
      {[ty + 6 * s, ty + 14 * s].map((wy) => (
        <rect key={wy} x={x - 0.9 * s} y={wy} width={1.8 * s} height={3.2 * s} fill={lit ? L.window : L.shade} opacity={lit ? 1 : 0.7} />
      ))}
      <rect x={x + 17 * s} y={y - 14 * s} width={1.6 * s} height={2.6 * s} fill={lit ? L.window : L.shade} opacity={lit ? 1 : 0.7} />
      {lit && <Glow uid={uid} x={x} y={y - 3 * s} r={14 * s} op={0.55 * L.glow} />}
      {fortified && (
        <>
          <Gonfalon x={x - 16 * s} y={y - 9 * s} w={4.2 * s} h={7.5 * s} motion={motion} />
          <Gonfalon x={x + 8 * s} y={y - 9 * s} w={4.2 * s} h={7.5 * s} motion={motion} />
        </>
      )}
    </g>
  );
}

/** Checkpoint gatehouse: two towers, arch, raised portcullis, barrier pole. Centre x, base y. */
export function Gatehouse({ uid, x, y, s = 1, L, motion, state }) {
  const lit = L.glow > 0.4;
  const torn = state === 'AFTERMATH';
  const tower = (cx) => (
    <g>
      <rect x={cx - 7 * s} y={y - 36 * s} width={14 * s} height={36 * s} fill={`url(#${uid}-stone)`} />
      <rect x={cx + 5.6 * s} y={y - 36 * s} width={1.4 * s} height={36 * s} fill={L.rim} opacity={L.rimOp * 0.5} />
      <path d={`M${cx - 8.5 * s},${y - 36 * s}L${cx},${y - 50 * s}L${cx + 8.5 * s},${y - 36 * s}Z`} fill={C.navy700} />
      <path d={`M${cx},${y - 50 * s}L${cx + 8.5 * s},${y - 36 * s}H${cx + 2 * s}Z`} fill={C.navy600} />
      <path d={`M${cx},${y - 50 * s}v${-3 * s}`} stroke={C.gold400} strokeWidth={0.7 * s} />
      <rect x={cx - 1 * s} y={y - 30 * s} width={2 * s} height={4 * s} fill={lit ? L.window : L.shade} opacity={lit ? 1 : 0.7} />
      <rect x={cx - 8 * s} y={y - 37 * s} width={16 * s} height={1.6 * s} fill={L.stoneDark} />
    </g>
  );
  return (
    <g>
      {/* arch bridge */}
      <path d={`M${x - 13 * s},${y - 27 * s}H${x + 13 * s}V${y}H${x + 7 * s}V${y - 12 * s}A${7 * s},${7 * s} 0 0 0 ${x - 7 * s},${y - 12 * s}V${y}H${x - 13 * s}Z`} fill={`url(#${uid}-stone)`} />
      <path d={`M${x - 7 * s},${y}V${y - 12 * s}A${7 * s},${7 * s} 0 0 1 ${x + 7 * s},${y - 12 * s}V${y}Z`} fill={lit ? '#3a2416' : L.shade} opacity="0.92" />
      {lit && <Glow uid={uid} x={x} y={y - 6 * s} r={16 * s} op={0.6 * L.glow} />}
      {/* raised portcullis teeth */}
      <path d={Array.from({ length: 6 }, (_, i) => `M${r1(x - 6 * s + i * 2.4 * s)},${r1(y - 18 * s)}v${r1(4 * s)}`).join('')} stroke={L.woodDark} strokeWidth={0.7 * s} />
      {tower(x - 19 * s)}
      {tower(x + 19 * s)}
      <Gonfalon x={x - 19 * s} y={y - 25 * s} w={6 * s} h={14 * s} torn={torn} motion={motion} />
      <Gonfalon x={x + 19 * s} y={y - 25 * s} w={6 * s} h={14 * s} torn={torn} motion={motion} />
      <rect x={x - 6 * s} y={y - 26 * s} width={12 * s} height={1.2 * s} fill={C.gold600} opacity="0.85" />
      {/* barrier pole */}
      {state !== 'AFTERMATH' ? (
        <g>
          <rect x={x - 11 * s} y={y - 6 * s} width={1.4 * s} height={6 * s} fill={L.woodDark} />
          <path d={`M${x - 10.3 * s},${y - 5.4 * s}L${x + 10 * s},${y - 6.6 * s}`} stroke={C.gold500} strokeWidth={1 * s} strokeDasharray={`${2 * s} ${2 * s}`} />
          <path d={`M${x - 10.3 * s},${y - 5.4 * s}L${x + 10 * s},${y - 6.6 * s}`} stroke={C.navy700} strokeWidth={1 * s} strokeDasharray={`${2 * s} ${2 * s}`} strokeDashoffset={2 * s} />
        </g>
      ) : (
        <path d={`M${x - 10.3 * s},${y - 0.6 * s}L${x + 2 * s},${y - 2.6 * s}`} stroke={C.gold700} strokeWidth={1 * s} />
      )}
    </g>
  );
}

/** Monument row for the road/checkpoint verges. items: [{id,title}] */
export function Monuments({ uid, items, x, y, s = 1, L, motion }) {
  const list = (items || []).slice(0, 3);
  if (!list.length) return null;
  const kinds = list.map((m, i) => {
    const id = `${m?.id ?? ''} ${m?.title ?? ''}`.toLowerCase();
    if (/fount|well|water|spring/.test(id)) return 'fountain';
    if (/wall|name|memorial|fallen|honou?r/.test(id)) return 'wall';
    if (/statue|hero|mara|sovereign|king|queen|warg|drake|sparky/.test(id)) return 'statue';
    return ['statue', 'fountain', 'wall'][i % 3];
  });
  const lit = L.glow > 0.4;
  return (
    <g>
      {kinds.map((k, i) => {
        const mx = x + i * 26 * s;
        if (k === 'fountain') {
          return (
            <g key={i}>
              <ellipse cx={mx} cy={y} rx={8 * s} ry={2 * s} fill={L.stoneDark} />
              <path d={`M${mx - 8 * s},${y}v${-3 * s}h${16 * s}v${3 * s}Z`} fill={`url(#${uid}-stone)`} />
              <rect x={mx - 1 * s} y={y - 9 * s} width={2 * s} height={6 * s} fill={L.stone} />
              <ellipse cx={mx} cy={y - 9 * s} rx={3 * s} ry={0.9 * s} fill={L.stone} />
              <path d={`M${mx},${y - 10 * s}q${-3 * s},${-3 * s} ${-5 * s},${6 * s}M${mx},${y - 10 * s}q${3 * s},${-3 * s} ${5 * s},${6 * s}`} stroke={C.lattice200} strokeWidth={0.5 * s} fill="none" opacity="0.75">
                {motion && <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.4s" repeatCount="indefinite" />}
              </path>
              <ellipse cx={mx} cy={y - 3.2 * s} rx={6.5 * s} ry={0.8 * s} fill={C.lattice200} opacity="0.4" />
            </g>
          );
        }
        if (k === 'wall') {
          return (
            <g key={i}>
              <path d={`M${mx - 9 * s},${y}v${-7 * s}l${2 * s},${-1.5 * s}h${14 * s}l${2 * s},${1.5 * s}v${7 * s}Z`} fill={`url(#${uid}-stone)`} />
              <path d={Array.from({ length: 4 }, (_, j) => `M${mx - 6.5 * s},${y - 6 * s + j * 1.4 * s}h${13 * s}`).join('')} stroke={L.stoneDark} strokeWidth={0.35 * s} strokeDasharray={`${1.2 * s} ${0.6 * s}`} />
              {[-6, 0, 6].map((cx) => (
                <g key={cx}>
                  {lit && <circle cx={mx + cx * s} cy={y - 1 * s} r={4 * s} fill={`url(#${uid}-warm)`} opacity={0.7 * L.glow} />}
                  <rect x={mx + cx * s - 0.4 * s} y={y - 1.8 * s} width={0.8 * s} height={1.8 * s} fill={C.parch100} />
                  <circle cx={mx + cx * s} cy={y - 2.2 * s} r={0.45 * s} fill={C.lattice300} />
                </g>
              ))}
            </g>
          );
        }
        return (
          <g key={i}>
            <path d={`M${mx - 5 * s},${y}v${-4 * s}h${10 * s}v${4 * s}Z`} fill={`url(#${uid}-stone)`} />
            <rect x={mx - 6 * s} y={y - 5 * s} width={12 * s} height={1.2 * s} fill={L.stone} />
            <path d={`M${mx},${y - 17 * s}a${1.4 * s},${1.4 * s} 0 1 1 0.01,0Z`} fill={L.stone} />
            <path d={`M${mx - 2.4 * s},${y - 5 * s}l${0.4 * s},${-7 * s}q${2 * s},${-2.4 * s} ${4 * s},0l${0.4 * s},${7 * s}Z`} fill={L.stone} />
            <path d={`M${mx + 1.8 * s},${y - 12 * s}l${2.6 * s},${-6.5 * s}`} stroke={L.stone} strokeWidth={0.8 * s} />
            <path d={`M${mx + 0.6 * s},${y - 5 * s}l${0.4 * s},${-7 * s}q${0.9 * s},${-0.4 * s} ${1.4 * s},${0.3 * s}l${0.2 * s},${6.7 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.5} />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------- wilds
export function Snowfall({ motion, L, seed = 11, count = 34, dur = 14, size = 0.7, op = 0.75 }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * 420 - 10;
    const y = rnd() * 220;
    const r = size * (0.5 + rnd() * 0.7);
    const p = `M${r1(x - r)},${r1(y)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;
    d += p;
  }
  const fill = L.snow;
  return (
    <g opacity={op} fill={fill}>
      <g>
        {motion && <animateTransform attributeName="transform" type="translate" values="0 0;-18 220" dur={`${dur}s`} repeatCount="indefinite" />}
        <path d={d} />
        <path d={d} transform="translate(18 -220)" />
      </g>
    </g>
  );
}

export function Eyes({ list, motion }) {
  return (
    <g>
      {list.map(([x, y, s, delay], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={4 * s} fill={C.lattice300} opacity="0.12" />
          <g>
            {motion && (
              <animate attributeName="opacity" values="1;1;0;1;1" keyTimes="0;0.9;0.93;0.96;1" dur={`${5 + delay}s`} begin={`${-delay}s`} repeatCount="indefinite" />
            )}
            <path d={`M${x - 2.4 * s},${y}l${1.5 * s},${-0.7 * s}l${0.4 * s},${0.9 * s}Z M${x + 2.4 * s},${y}l${-1.5 * s},${-0.7 * s}l${-0.4 * s},${0.9 * s}Z`} fill={C.lattice300} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** Frost warg in profile facing left. Feet at y. */
export function Warg({ x, y, s = 1, L, howl = false, fill, outline }) {
  const P = (dx, dy) => `${r1(x + dx * s)},${r1(y + dy * s)}`;
  const head = howl
    ? `L${P(-15, -16)}L${P(-19, -25)}L${P(-21, -31)}L${P(-19.5, -31.5)}L${P(-17, -27)}L${P(-15.5, -30)}L${P(-14, -26.5)}L${P(-11.5, -24)}`
    : `L${P(-16, -18)}L${P(-21, -20.5)}L${P(-27, -19.5)}L${P(-27.5, -18)}L${P(-21, -15.5)}L${P(-19, -14)}L${P(-17.5, -23)}L${P(-16, -26)}L${P(-14.5, -22.5)}L${P(-12, -23)}`;
  const d = `M${P(14, -2)}L${P(16, -12)}Q${P(17, -18)} ${P(10, -19)}L${P(2, -20)}Q${P(-6, -23)} ${P(-10, -22)}${head}Q${P(-9, -14)} ${P(-11, -10)}L${P(-12, -1)}L${P(-13, 0)}L${P(-9.5, 0)}L${P(-8.5, -8)}L${P(-6, -9)}L${P(-5.5, 0)}L${P(-2.5, 0)}L${P(-3, -10)}L${P(5, -10)}L${P(7, -1)}L${P(8, 0)}L${P(11, 0)}L${P(10.5, -6)}L${P(12.5, -1)}L${P(13.5, 0)}L${P(16.5, 0)}Z`;
  const tail = `M${P(16, -12)}Q${P(24, -12)} ${P(27, -4)}Q${P(22, -7)} ${P(16.5, -7)}Z`;
  return (
    <g>
      {outline && <path d={tail + d} fill="none" stroke={outline} strokeWidth={1.1 * s} strokeLinejoin="round" opacity="0.75" />}
      <path d={tail} fill={fill || L.figure} />
      <path d={d} fill={fill || L.figure} />
      <path d={`M${P(-10, -22)}Q${P(0, -23.5)} ${P(10, -19)}Q${P(16, -18)} ${P(16, -12)}`} fill="none" stroke={C.frost100} strokeWidth={0.8 * s} opacity={0.35 + L.rimOp * 0.5} />
      <path d={`M${P(-14.5, -25.5)}l${-0.8 * s},${0.3 * s}`} stroke={C.lattice300} strokeWidth={0.9 * s} />
    </g>
  );
}

// ---------------------------------------------------------------- ruins
export function Column({ uid, x, y, h, w = 6, L, broken = 0 }) {
  const top = y - h;
  const brokenTop = broken
    ? `M${x - w / 2},${top + 2}L${x - w * 0.2},${top - broken}L${x + w * 0.1},${top + 1}L${x + w * 0.35},${top - broken * 0.5}L${x + w / 2},${top + 2}V${y}H${x - w / 2}Z`
    : `M${x - w / 2},${top + 2}H${x + w / 2}V${y}H${x - w / 2}Z`;
  return (
    <g>
      <path d={brokenTop} fill={`url(#${uid}-stone)`} />
      <path d={`M${x - w * 0.2},${top + 3}V${y - 2}M${x + w * 0.12},${top + 3}V${y - 2}`} stroke={L.stoneDark} strokeWidth="0.45" opacity="0.7" />
      <rect x={x + w / 2 - 1.1} y={top + 2} width="1.1" height={h - 4} fill={L.rim} opacity={L.rimOp * 0.45} />
      {!broken && <rect x={x - w / 2 - 1.4} y={top} width={w + 2.8} height="2.4" fill={L.stone} />}
      <rect x={x - w / 2 - 1.4} y={y - 2.2} width={w + 2.8} height="2.2" fill={L.stoneDark} />
    </g>
  );
}

const SYMBOL_ARC_R = 6;
function symbolPaths(cx, cy, r = SYMBOL_ARC_R) {
  const a0 = (-38 * Math.PI) / 180;
  const a1 = (-78 * Math.PI) / 180;
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const k = r / 6;
  const star = `M${cx},${cy - 2.2 * k}C${cx + 0.2 * k},${cy - 0.9 * k} ${cx + 0.5 * k},${cy - 0.5 * k} ${cx + 1.6 * k},${cy}C${cx + 0.5 * k},${cy + 0.5 * k} ${cx + 0.2 * k},${cy + 0.9 * k} ${cx},${cy + 2.2 * k}C${cx - 0.2 * k},${cy + 0.9 * k} ${cx - 0.5 * k},${cy + 0.5 * k} ${cx - 1.6 * k},${cy}C${cx - 0.5 * k},${cy - 0.5 * k} ${cx - 0.2 * k},${cy - 0.9 * k} ${cx},${cy - 2.2 * k}Z`;
  return { arc: `M${r1(x0)},${r1(y0)}A${r},${r} 0 1 1 ${r1(x1)},${r1(y1)}`, star };
}

/** Ancient monolith with the broken-circle symbol faintly lit from within. */
export function Monolith({ uid, x, y, s = 1, L, motion, intensity = 1 }) {
  const w = 16 * s;
  const h = 58 * s;
  const sym = symbolPaths(x, y - h * 0.62, 6.5 * s);
  const glowOp = (0.35 + L.glow * 0.4) * intensity;
  return (
    <g>
      <path d={`M${x - w * 0.55},${y}L${x - w * 0.45},${y - h * 0.9}L${x - w * 0.1},${y - h}L${x + w * 0.3},${y - h * 0.96}L${x + w * 0.46},${y - h * 0.86}L${x + w * 0.55},${y}Z`} fill={`url(#${uid}-stone)`} />
      <path d={`M${x + w * 0.3},${y - h * 0.96}L${x + w * 0.46},${y - h * 0.86}L${x + w * 0.55},${y}H${x + w * 0.4}Z`} fill={L.rim} opacity={L.rimOp * 0.45} />
      <path d={`M${x - w * 0.3},${y - h * 0.3}l${w * 0.15},${h * 0.1}l${-w * 0.05},${h * 0.12}M${x + w * 0.1},${y - h * 0.15}l${w * 0.12},${h * 0.08}`} stroke={L.stoneDark} strokeWidth={0.5 * s} fill="none" />
      <circle cx={x} cy={y - h * 0.62} r={16 * s} fill={`url(#${uid}-lattice)`} opacity={glowOp}>
        {motion && <animate attributeName="opacity" values={`${glowOp * 0.6};${glowOp};${glowOp * 0.6}`} dur="6s" repeatCount="indefinite" />}
      </circle>
      <g stroke={C.lattice200} fill="none" opacity={0.55 + 0.45 * intensity}>
        <path d={sym.arc} strokeWidth={1.3 * s} />
        <path d={sym.star} fill={C.lattice200} stroke="none" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------- Iron Syndicate
/** Halted Iron Syndicate walker, facing left. Feet at y. */
export function Walker({ uid, x, y, s = 1, L, motion, damaged = false }) {
  const P = (dx, dy) => `${r1(x + dx * s)},${r1(y + dy * s)}`;
  const tilt = damaged ? 9 : 0;
  const lit = L.glow > 0.3;
  const hull = `M${P(-22, -62)}L${P(-28, -50)}L${P(-24, -36)}L${P(14, -34)}L${P(22, -44)}L${P(20, -60)}L${P(6, -68)}L${P(-14, -68)}Z`;
  const plate = `M${P(-28, -50)}L${P(-24, -36)}L${P(-6, -35.4)}L${P(-9, -52)}Z`;
  const visor = `M${P(-25, -54)}L${P(-12, -55)}L${P(-12.5, -51.5)}L${P(-24, -51)}Z`;
  const legL = damaged
    ? `M${P(-14, -36)}L${P(-22, -22)}L${P(-34, -10)}L${P(-38, -3)}L${P(-30, 0)}L${P(-26, -6)}L${P(-16, -18)}L${P(-8, -34)}Z`
    : `M${P(-14, -36)}L${P(-4, -22)}L${P(-16, -6)}L${P(-21, 0)}L${P(-8, 0)}L${P(-8, -5)}L${P(2, -21)}L${P(-6, -36)}Z`;
  const legR = `M${P(4, -36)}L${P(16, -22)}L${P(8, -6)}L${P(4, 0)}L${P(17, 0)}L${P(16, -6)}L${P(22, -22)}L${P(12, -36)}Z`;
  const rivets = [[-18, -64], [-6, -65], [6, -64], [16, -56], [18, -46], [-20, -40], [0, -38]];
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
      <path d={legR} fill="#1d2024" />
      {/* cannon arm */}
      <path d={damaged ? `M${P(14, -54)}L${P(26, -40)}L${P(32, -26)}L${P(28, -24)}L${P(20, -38)}L${P(10, -48)}Z` : `M${P(10, -56)}L${P(-34, -50)}L${P(-34, -46)}L${P(10, -48)}Z`} fill="#2a2e33" />
      {!damaged && <rect x={x - 38 * s} y={y - 50.5 * s} width={5 * s} height={5 * s} fill="#1d2024" />}
      <path d={hull} fill={`url(#${uid}-iron)`} />
      <path d={plate} fill="#3a3f46" />
      <path d={`M${P(6, -68)}L${P(20, -60)}L${P(22, -44)}L${P(19, -44)}L${P(17.5, -58)}L${P(5, -65)}Z`} fill={C.brass500} opacity="0.55" />
      <path d={`M${P(-22, -62)}L${P(-14, -68)}L${P(6, -68)}`} fill="none" stroke={L.rim} strokeOpacity={L.rimOp * 0.45} strokeWidth={0.8 * s} />
      <path d={legL} fill="#2a2e33" />
      {/* knee pistons */}
      <circle cx={x + (damaged ? -22 : -4) * s} cy={y - 22 * s} r={2.2 * s} fill={C.brass700} />
      <circle cx={x + 16 * s} cy={y - 22 * s} r={2.2 * s} fill={C.brass700} />
      {/* smokestacks */}
      <rect x={x + 4 * s} y={y - 78 * s} width={4 * s} height={12 * s} fill="#25282c" />
      <rect x={x + 10 * s} y={y - 75 * s} width={3.4 * s} height={9 * s} fill="#25282c" />
      <rect x={x + 3.6 * s} y={y - 78 * s} width={4.8 * s} height={1.4 * s} fill={C.brass500} />
      {rivets.map(([rx, ry], i) => (
        <circle key={i} cx={x + rx * s} cy={y + ry * s} r={0.65 * s} fill={C.iron300} opacity="0.75" />
      ))}
      {/* visor / furnace glow */}
      {!damaged && <circle cx={x - 18 * s} cy={y - 53 * s} r={10 * s} fill={`url(#${uid}-warm)`} opacity={0.35 + (lit ? 0.4 : 0.1)} />}
      <path d={visor} fill={damaged ? '#121315' : C.ember400}>
        {motion && !damaged && <animate attributeName="opacity" values="0.75;1;0.8;0.75" dur="3.1s" repeatCount="indefinite" />}
      </path>
      <rect x={x - 4 * s} y={y - 44 * s} width={10 * s} height={4 * s} fill={damaged ? '#121315' : C.ember500} opacity="0.85" />
      <Smoke uid={uid} x={x + 6 * s} y={y - 79 * s} s={s * (damaged ? 1.6 : 0.8)} motion={motion} puffs={damaged ? 6 : 4} rise={damaged ? 70 : 45} op={damaged ? 1 : 0.7} />
      {damaged && <Flame x={x - 2 * s} y={y - 66 * s} h={7 * s} motion={motion} />}
    </g>
  );
}

export function Depot({ uid, x, y, s = 1, L, motion, damaged = false }) {
  const crate = (cx, cy, w) => (
    <g key={`${cx}-${cy}`}>
      <rect x={cx} y={cy - w} width={w} height={w} fill={L.wood} />
      <path d={`M${cx},${cy - w}l${w},${w}M${cx + w},${cy - w}l${-w},${w}`} stroke={L.woodDark} strokeWidth={0.5 * s} />
      <rect x={cx + w - 0.8 * s} y={cy - w} width={0.8 * s} height={w} fill={L.rim} opacity={L.rimOp * 0.4} />
    </g>
  );
  const tank = (cx, cy, w, h) => (
    <g key={`t${cx}`}>
      <rect x={cx} y={cy - h} width={w} height={h} rx={h / 2} fill="#30343a" />
      <rect x={cx + w * 0.25} y={cy - h} width={1 * s} height={h} fill={C.brass500} opacity="0.8" />
      <rect x={cx + w * 0.7} y={cy - h} width={1 * s} height={h} fill={C.brass500} opacity="0.8" />
      <rect x={cx + 2 * s} y={cy - h + 0.8 * s} width={w - 4 * s} height={0.8 * s} fill={L.rim} opacity={L.rimOp * 0.35} />
    </g>
  );
  return (
    <g>
      {/* gantry crane */}
      <path d={`M${x + 34 * s},${y}V${y - 40 * s}M${x + 42 * s},${y}V${y - 40 * s}M${x + 30 * s},${y - 40 * s}H${x + 8 * s}M${x + 34 * s},${y - 10 * s}L${x + 42 * s},${y - 20 * s}L${x + 34 * s},${y - 30 * s}L${x + 42 * s},${y - 40 * s}M${x + 14 * s},${y - 40 * s}v${10 * s}`} stroke="#25282c" strokeWidth={1.2 * s} fill="none" transform={damaged ? `rotate(-14 ${x + 38 * s} ${y})` : undefined} />
      <rect x={x + 11 * s} y={y - 30 * s} width={6 * s} height={4 * s} fill={L.wood} transform={damaged ? `rotate(-14 ${x + 38 * s} ${y})` : undefined} />
      {tank(x, y, 22 * s, 8 * s)}
      {tank(x + 2 * s, y - 8 * s, 18 * s, 7 * s)}
      {crate(x + 24 * s, y, 7 * s)}
      {crate(x + 31.5 * s, y, 6 * s)}
      {crate(x + 26 * s, y - 7 * s, 6 * s)}
      <Banner x={x - 6 * s} y={y} h={24 * s} len={10 * s} hgt={5 * s} motion={motion} L={L} colors={['#3b3f45', C.brass500]} torn={damaged} />
    </g>
  );
}

export function Fence({ x, y, w, L, broken = false }) {
  let posts = '';
  for (let px = x; px <= x + w; px += 9) {
    if (broken && Math.round(px) % 27 === 0) continue;
    posts += `M${r1(px)},${r1(y)}v-6.5h0.8v6.5Z`;
  }
  const wire = `M${x},${y - 5.5}${Array.from({ length: Math.ceil(w / 4.5) }, (_, i) => `l2.25,${i % 2 ? 0.8 : -0.8}l2.25,${i % 2 ? -0.8 : 0.8}`).join('')}`;
  return (
    <g>
      <path d={posts} fill={L.woodDark} />
      <path d={wire} stroke={L.woodDark} strokeWidth="0.35" fill="none" />
      <path d={`M${x},${y - 3}h${w}`} stroke={L.woodDark} strokeWidth="0.35" fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- camp
export function CampfireMark({ uid, x, y, s = 1, L, motion, big = 1 }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={40 * s * big} ry={10 * s * big} fill={`url(#${uid}-warm)`} opacity={0.4 + 0.5 * L.glow} />
      <circle cx={x} cy={y - 5 * s} r={26 * s * big} fill={`url(#${uid}-warm)`} opacity={0.35 + 0.55 * L.glow}>
        {motion && <animate attributeName="opacity" values={`${0.35 + 0.5 * L.glow};${0.45 + 0.55 * L.glow};${0.3 + 0.5 * L.glow};${0.35 + 0.5 * L.glow}`} dur="1.6s" repeatCount="indefinite" />}
      </circle>
      <path d={`M${x - 6 * s},${y + 0.6 * s}L${x + 5 * s},${y - 2.2 * s}L${x + 6 * s},${y - 1 * s}L${x - 5 * s},${y + 1.6 * s}Z M${x + 6 * s},${y + 0.6 * s}L${x - 5 * s},${y - 2.2 * s}L${x - 6 * s},${y - 1 * s}L${x + 5 * s},${y + 1.6 * s}Z`} fill={L.woodDark} />
      <Flame x={x - 1.6 * s} y={y - 1 * s} h={8 * s * big} motion={motion} dur={0.8} />
      <Flame x={x + 1.8 * s} y={y - 0.8 * s} h={6 * s * big} motion={motion} dur={1.1} />
      <Embers x={x} y={y - 8 * s} s={s} motion={motion} count={5} />
    </g>
  );
}
