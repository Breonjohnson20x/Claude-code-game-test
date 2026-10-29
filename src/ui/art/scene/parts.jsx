// Scene primitives for RegionScene. Pure SVG; animation via SMIL, only when
// `motion` is true (callers pass !prefersReducedMotion). Key light: upper
// right, so west faces sit in shadow and east edges catch a rim of light.
import { C } from '../palette.js';
import { mulberry32, r1, crowdPath } from '../util.js';
import { mix } from './tone.js';

// ---------------------------------------------------------------- defs
export function SceneDefs({ uid, L, T }) {
  const [s0, s1, s2, s3] = (T && T.sky) || L.sky;
  // the key light warms lit stone toward gold leaf by day, ember at dusk
  const stoneLit = T && T.tod === 'day' ? mix(L.stone, C.gold200, 0.45) : T && T.tod === 'dusk' ? mix(L.stone, C.ember200, 0.4) : mix(L.stone, L.rim, 0.22);
  return (
    <defs>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={s0} />
        <stop offset="0.3" stopColor={s1} />
        <stop offset="0.62" stopColor={s2} />
        <stop offset="0.9" stopColor={s3} />
        <stop offset="1" stopColor={T ? T.horizon : s3} />
      </linearGradient>
      <radialGradient id={`${uid}-warm`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.lattice300} stopOpacity="0.95" />
        <stop offset="0.16" stopColor={C.ember300} stopOpacity="0.6" />
        <stop offset="0.48" stopColor={C.ember400} stopOpacity="0.2" />
        <stop offset="1" stopColor={C.ember500} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-lattice`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.lattice100} stopOpacity="0.95" />
        <stop offset="0.25" stopColor={C.lattice300} stopOpacity="0.5" />
        <stop offset="0.6" stopColor={C.gold400} stopOpacity="0.14" />
        <stop offset="1" stopColor={C.gold400} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-smoke`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={L.smoke} stopOpacity="0.85" />
        <stop offset="0.55" stopColor={L.smoke} stopOpacity="0.42" />
        <stop offset="1" stopColor={L.smoke} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-smokelit`} cx="62%" cy="40%" r="55%">
        <stop offset="0" stopColor={mix(L.smoke, L.rim, 0.45)} stopOpacity="0.75" />
        <stop offset="0.6" stopColor={L.smoke} stopOpacity="0.35" />
        <stop offset="1" stopColor={L.smoke} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-scorch`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.ink} stopOpacity="0.88" />
        <stop offset="0.55" stopColor={C.ink} stopOpacity="0.5" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-vig`} cx="50%" cy="44%" r="72%">
        <stop offset="0.5" stopColor={L.shade} stopOpacity="0" />
        <stop offset="0.82" stopColor={L.shade} stopOpacity={L.vignette * 0.55} />
        <stop offset="1" stopColor={L.shade} stopOpacity={L.vignette + 0.28} />
      </radialGradient>
      <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.navy950} stopOpacity="0" />
        <stop offset="0.3" stopColor={C.navy950} stopOpacity="0.16" />
        <stop offset="0.6" stopColor={C.navy950} stopOpacity="0.55" />
        <stop offset="0.85" stopColor={C.navy950} stopOpacity="0.88" />
        <stop offset="1" stopColor={C.navy950} stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${uid}-stone`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={mix(L.stoneDark, L.shade, 0.25)} />
        <stop offset="0.45" stopColor={L.stoneDark} />
        <stop offset="0.8" stopColor={L.stone} />
        <stop offset="1" stopColor={stoneLit} />
      </linearGradient>
      <linearGradient id={`${uid}-cyl`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={mix(L.stoneDark, L.shade, 0.45)} />
        <stop offset="0.35" stopColor={L.stoneDark} />
        <stop offset="0.72" stopColor={L.stone} />
        <stop offset="0.86" stopColor={stoneLit} />
        <stop offset="1" stopColor={mix(L.stone, L.stoneDark, 0.4)} />
      </linearGradient>
      <linearGradient id={`${uid}-wallv`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={L.stone} />
        <stop offset="1" stopColor={mix(L.stoneDark, L.shade, 0.3)} />
      </linearGradient>
      <linearGradient id={`${uid}-slate`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={mix(C.navy800, L.shade, 0.3)} />
        <stop offset="0.5" stopColor={C.navy700} />
        <stop offset="0.5" stopColor={mix(C.navy600, L.rim, 0.12)} />
        <stop offset="1" stopColor={mix(C.navy600, L.rim, 0.28)} />
      </linearGradient>
      <linearGradient id={`${uid}-iron`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={mix(C.iron500, L.rim, 0.12)} />
        <stop offset="0.5" stopColor={C.iron700} />
        <stop offset="1" stopColor={C.iron900} />
      </linearGradient>
      <linearGradient id={`${uid}-ironh`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.iron900} />
        <stop offset="0.55" stopColor={C.iron700} />
        <stop offset="0.85" stopColor={mix(C.iron500, L.rim, 0.25)} />
        <stop offset="1" stopColor={C.iron700} />
      </linearGradient>
      <linearGradient id={`${uid}-crystal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.lattice100} />
        <stop offset="1" stopColor={C.gold400} />
      </linearGradient>
      <linearGradient id={`${uid}-fold`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.navy950} stopOpacity="0.35" />
        <stop offset="0.22" stopColor={C.lattice100} stopOpacity="0.14" />
        <stop offset="0.45" stopColor={C.navy950} stopOpacity="0.28" />
        <stop offset="0.7" stopColor={C.lattice100} stopOpacity="0.12" />
        <stop offset="1" stopColor={C.navy950} stopOpacity="0.32" />
      </linearGradient>
      {/* searchlight cone, drawn along +x from the lamp */}
      <linearGradient id={`${uid}-beamf`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.lattice100} stopOpacity="0.85" />
        <stop offset="0.35" stopColor={C.lattice300} stopOpacity="0.4" />
        <stop offset="1" stopColor={C.lattice300} stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id={`${uid}-road`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={mix(L.road, L.roadDark, 0.55)} />
        <stop offset="0.6" stopColor={L.road} />
        <stop offset="1" stopColor={mix(L.road, L.haze, 0.45)} />
      </linearGradient>
    </defs>
  );
}

// ---------------------------------------------------------------- fx
export function Glow({ uid, x, y, r, op = 1, kind = 'warm', motion, flicker = false }) {
  return (
    <circle cx={x} cy={y} r={r} fill={`url(#${uid}-${kind})`} opacity={op} pointerEvents="none">
      {motion && flicker && <animate attributeName="opacity" values={`${op};${op * 1.15};${op * 0.8};${op * 1.05};${op}`} dur="2.3s" repeatCount="indefinite" />}
    </circle>
  );
}

export function Smoke({ uid, x, y, s = 1, motion, puffs = 5, drift = -26, rise = 70, dur = 8, op = 1 }) {
  // Overlapping soft puffs; each has a sun-lit companion so the column has form.
  const n = Math.max(7, Math.round(puffs * 1.8));
  const r0 = 3.5 * s;
  const r1_ = 20 * s;
  const items = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    const lit = i % 2 === 0;
    const fill = `url(#${uid}-${lit ? 'smokelit' : 'smoke'})`;
    if (motion) {
      const b = `${r1(-t * dur)}s`;
      items.push(
        <circle key={i} cx={x} cy={y} r={r0} fill={fill} opacity="0">
          <animate attributeName="cy" values={`${y};${y - rise * 0.55 * s};${y - rise * s}`} keyTimes="0;0.45;1" dur={`${dur}s`} begin={b} repeatCount="indefinite" />
          <animate attributeName="cx" values={`${x};${x + drift * 0.22 * s};${x + drift * s}`} keyTimes="0;0.45;1" dur={`${dur}s`} begin={b} repeatCount="indefinite" />
          <animate attributeName="r" values={`${r0};${r1_}`} dur={`${dur}s`} begin={b} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`0;${0.62 * op};${0.34 * op};0`} keyTimes="0;0.12;0.55;1" dur={`${dur}s`} begin={b} repeatCount="indefinite" />
        </circle>,
      );
    } else {
      const k = (i + 0.5) / n;
      const yk = k < 0.45 ? (k / 0.45) * 0.55 : 0.55 + ((k - 0.45) / 0.55) * 0.45;
      const xk = k < 0.45 ? (k / 0.45) * 0.22 : 0.22 + ((k - 0.45) / 0.55) * 0.78;
      items.push(<circle key={i} cx={r1(x + drift * s * xk)} cy={r1(y - rise * s * yk)} r={r1(r0 + (r1_ - r0) * k)} fill={fill} opacity={r1(op * (0.62 - k * 0.42) * 100) / 100} />);
    }
  }
  return <g pointerEvents="none">{items}</g>;
}

export function Scorch({ uid, x, y, rx = 16, ry = 4 }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${uid}-scorch)`} />;
}

export function Embers({ x, y, s = 1, motion, count = 4, seed = 3, rise = 30 }) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const dx = (rnd() - 0.5) * 8 * s;
    const dur = 2.2 + rnd() * 1.6;
    const cx = x + dx;
    const b = `${r1(-rnd() * dur)}s`;
    out.push(
      <circle key={i} cx={r1(cx)} cy={r1(motion ? y : y - (8 + rnd() * 14) * s)} r={0.55 * s} fill={C.lattice300} opacity={motion ? 0 : 0.7}>
        {motion && (
          <>
            <animate attributeName="cy" values={`${y};${y - rise * s}`} dur={`${dur}s`} begin={b} repeatCount="indefinite" />
            <animate attributeName="cx" values={`${r1(cx)};${r1(cx - 6 * s)};${r1(cx - 2 * s)}`} dur={`${dur}s`} begin={b} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${dur}s`} begin={b} repeatCount="indefinite" />
          </>
        )}
      </circle>,
    );
  }
  return <g pointerEvents="none">{out}</g>;
}

// flame shape anchored at its base (0,0), height 1
const FLAME_OUT = 'M0,0 C-0.46,-0.04 -0.56,-0.46 -0.2,-0.72 C-0.13,-0.5 0,-0.52 0.02,-1.05 C0.33,-0.7 0.56,-0.42 0.43,-0.16 C0.36,-0.04 0.22,0 0,0Z';
const FLAME_MID = 'M0,0 C-0.34,-0.04 -0.4,-0.36 -0.12,-0.58 C-0.06,-0.42 0.04,-0.44 0.06,-0.82 C0.27,-0.55 0.4,-0.32 0.31,-0.12 C0.26,-0.03 0.15,0 0,0Z';
const FLAME_IN = 'M0,0 C-0.22,-0.04 -0.26,-0.28 -0.05,-0.46 C0,-0.34 0.06,-0.36 0.08,-0.6 C0.22,-0.4 0.27,-0.22 0.2,-0.09 C0.15,-0.02 0.1,0 0,0Z';

export function Flame({ x, y, h, motion, dur = 0.9 }) {
  return (
    <g transform={`translate(${r1(x)} ${r1(y)})`}>
      <g>
        {motion && (
          <animateTransform attributeName="transform" type="scale" values={`${h} ${h};${h * 0.92} ${h * 1.12};${h * 1.06} ${h * 0.9};${h} ${h}`} dur={`${dur}s`} repeatCount="indefinite" />
        )}
        <g transform={motion ? undefined : `scale(${h})`}>
          <path d={FLAME_OUT} fill={C.ember500} opacity="0.85" />
          <path d={FLAME_MID} fill={C.ember400} />
          <path d={FLAME_IN} fill={C.lattice300} />
        </g>
      </g>
    </g>
  );
}

export function Torch({ uid, x, y, s = 1, L, motion, pole = true }) {
  const g = Math.max(0.35, L.glow);
  return (
    <g>
      <circle cx={x} cy={y - 9 * s} r={16 * s} fill={`url(#${uid}-warm)`} opacity={0.75 * g}>
        {motion && <animate attributeName="opacity" values={`${0.75 * g};${0.95 * g};${0.62 * g};${0.85 * g};${0.75 * g}`} dur="1.9s" repeatCount="indefinite" />}
      </circle>
      {pole && <rect x={x - 0.45 * s} y={y - 8 * s} width={0.9 * s} height={8 * s} fill={L.woodDark} />}
      <path d={`M${x - 1.6 * s},${y - 8.4 * s}h${3.2 * s}l${-0.7 * s},${1.3 * s}h${-1.8 * s}Z`} fill={C.brass700} />
      <Flame x={x} y={y - 8.4 * s} h={4.2 * s} motion={motion} />
    </g>
  );
}

/** A hanging lantern: brass cage + warm core. */
export function Lantern({ uid, x, y, s = 1, L, motion }) {
  const g = Math.max(0.3, L.glow);
  return (
    <g>
      <circle cx={x} cy={y} r={9 * s} fill={`url(#${uid}-warm)`} opacity={0.65 * g}>
        {motion && <animate attributeName="opacity" values={`${0.65 * g};${0.85 * g};${0.55 * g};${0.65 * g}`} dur="2.7s" repeatCount="indefinite" />}
      </circle>
      <path d={`M${x - 1.1 * s},${y - 1.5 * s}h${2.2 * s}v${3 * s}h${-2.2 * s}Z`} fill={C.lattice300} />
      <path d={`M${x - 1.4 * s},${y - 1.8 * s}h${2.8 * s}M${x - 1.4 * s},${y + 1.6 * s}h${2.8 * s}M${x},${y - 1.8 * s}v${-1.2 * s}`} stroke={C.brass700} strokeWidth={0.5 * s} />
    </g>
  );
}

// ---------------------------------------------------------------- banners
function flagPath(x, y, len, hgt, phase, amp, tail = true) {
  const steps = 7;
  const top = [];
  const bot = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const off = Math.sin(u * 4.2 + phase) * amp * u;
    const sag = u * u * hgt * 0.18;
    top.push([x - len * u, y + off + sag]);
    bot.push([x - len * u, y + hgt + off * 1.1 + sag * 0.6]);
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

/** Pole with a flag flying west (wind from the east). colors: [field, trim] */
export function Banner({ uid, x, y, h = 24, len = 13, hgt = 6, motion, colors = [C.navy700, C.gold400], torn = false, L, dur = 3.6, pole = true }) {
  const fy = y - h + 0.8;
  const fx = x - 0.5;
  const amp = torn ? 0.6 : Math.max(1.2, hgt * 0.24);
  const flen = torn ? len * 0.62 : len;
  const d0 = flagPath(fx, fy, flen, hgt, 0, amp, !torn);
  const d1 = flagPath(fx, fy, flen, hgt, 2.1, amp, !torn);
  const d2 = flagPath(fx, fy, flen, hgt, 4.2, amp, !torn);
  const vals = `${d0};${d1};${d2};${d0}`;
  const em = Math.max(1.2, hgt * 0.32);
  return (
    <g>
      {pole && <rect x={x - 0.55} y={y - h} width="1.1" height={h} fill={L ? L.woodDark : C.stone800} />}
      {pole && <rect x={x - 0.15} y={y - h} width="0.4" height={h} fill={L ? L.rim : C.gold300} opacity={L ? L.rimOp * 0.6 : 0.4} />}
      {pole && <circle cx={x} cy={y - h - 0.6} r="0.95" fill={C.gold400} />}
      <path d={d0} fill={colors[0]} opacity={torn ? 0.88 : 1}>
        {motion && <animate attributeName="d" values={vals} dur={`${dur}s`} repeatCount="indefinite" />}
      </path>
      {uid && (
        <path d={d0} fill={`url(#${uid}-fold)`} opacity={torn ? 0.6 : 1}>
          {motion && <animate attributeName="d" values={vals} dur={`${dur}s`} repeatCount="indefinite" />}
        </path>
      )}
      <rect x={fx - em * 1.9} y={fy + hgt * 0.5 - em / 2} width={em} height={em} transform={`rotate(45 ${fx - em * 1.4} ${fy + hgt * 0.5})`} fill={colors[1]} />
      <rect x={fx - flen * 0.98} y={fy + 0.15} width={flen * 0.96} height={Math.max(0.35, hgt * 0.08)} fill={colors[1]} opacity="0.55" />
      {torn && <path d={`M${r1(fx - flen)},${r1(fy + hgt * 0.3)}l-2,1.4l1.6,0.6l-1.8,1.6`} stroke={colors[0]} strokeWidth="0.8" fill="none" />}
    </g>
  );
}

/** Vertical hanging gonfalon (for walls/gates). */
export function Gonfalon({ x, y, w = 7, h = 16, colors = [C.navy700, C.gold400], torn = false, motion, L }) {
  const d = torn
    ? `M${x - w / 2},${y}h${w}v${h * 0.55}l-${w * 0.2},${h * 0.12}l-${w * 0.25},-${h * 0.18}l-${w * 0.2},${h * 0.22}l-${w * 0.35},-${h * 0.14}Z`
    : `M${x - w / 2},${y}h${w}v${h}l-${w / 2},-${h * 0.18}l-${w / 2},${h * 0.18}Z`;
  return (
    <g>
      <rect x={x - w / 2 - 1} y={y - 0.8} width={w + 2} height="1.2" fill={C.gold600} />
      <g transform={`translate(${x} ${y})`}>
        {motion && !torn && <animateTransform attributeName="transform" type="rotate" values="0;1.6;-1;0" dur="5.5s" additive="sum" repeatCount="indefinite" />}
        <g transform={`translate(${-x} ${-y})`}>
          <path d={d} fill={colors[0]} />
          <path d={`M${x + w * 0.1},${y}h${w * 0.4}v${h * (torn ? 0.5 : 0.86)}l${-w * 0.4},${h * 0.08}Z`} fill={L ? L.rim : C.lattice100} opacity={L ? L.rimOp * 0.22 : 0.1} />
          <path d={`M${x - w / 2 + 0.8},${y}v${h * (torn ? 0.5 : 0.9)}M${x + w / 2 - 0.8},${y}v${h * (torn ? 0.5 : 0.9)}`} stroke={colors[1]} strokeWidth={Math.max(0.35, w * 0.07)} opacity="0.85" />
          {!torn && <path d={`M${x},${y + h * 0.28}l${w * 0.22},${w * 0.22}l-${w * 0.22},${w * 0.22}l-${w * 0.22},-${w * 0.22}Z`} fill={colors[1]} />}
        </g>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------- magitech ward
export function Pylon({ uid, x, y, s = 1, motion, L }) {
  // a warm ward-light, not a flare: small halo, softer at night
  const g = 0.45 + L.glow * 0.2;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={8 * s} ry={1.8 * s} fill={`url(#${uid}-warm)`} opacity={0.25 + L.glow * 0.25} />
      <circle cx={x} cy={y - 14 * s} r={9 * s} fill={`url(#${uid}-lattice)`} opacity={g}>
        {motion && <animate attributeName="opacity" values={`${g * 0.8};${Math.min(1, g * 1.2)};${g * 0.8}`} dur="3.2s" repeatCount="indefinite" />}
      </circle>
      <path d={`M${x - 3 * s},${y}L${x - 1.7 * s},${y - 10.5 * s}H${x + 1.7 * s}L${x + 3 * s},${y}Z`} fill={`url(#${uid}-stone)`} />
      <path d={`M${x + 0.7 * s},${y - 10.5 * s}H${x + 1.7 * s}L${x + 3 * s},${y}H${x + 1.6 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.55} />
      <rect x={x - 2.3 * s} y={y - 7 * s} width={4.6 * s} height={0.8 * s} fill={C.brass300} />
      <rect x={x - 2.7 * s} y={y - 2.6 * s} width={5.4 * s} height={0.8 * s} fill={C.brass500} />
      <path d={`M${x - 2.4 * s},${y - 10.5 * s}h${4.8 * s}l${-0.6 * s},${-1 * s}h${-3.6 * s}Z`} fill={C.brass500} />
      <path d={`M${x},${y - 18.5 * s}L${x + 2 * s},${y - 14.2 * s}L${x},${y - 11.2 * s}L${x - 2 * s},${y - 14.2 * s}Z`} fill={`url(#${uid}-crystal)`} />
      <path d={`M${x},${y - 18.5 * s}L${x + 2 * s},${y - 14.2 * s}L${x},${y - 11.2 * s}Z`} fill={C.lattice100} opacity="0.7" />
      <circle cx={x} cy={y - 14.5 * s} r={4.6 * s} fill="none" stroke={C.lattice300} strokeWidth={0.35 * s} strokeDasharray={`${1.2 * s} ${0.9 * s}`} opacity="0.75">
        {motion && <animateTransform attributeName="transform" type="rotate" values={`0 ${x} ${y - 14.5 * s};360 ${x} ${y - 14.5 * s}`} dur="18s" repeatCount="indefinite" />}
      </circle>
    </g>
  );
}

// ---------------------------------------------------------------- military
export function Barricade({ x, y, w = 30, s = 1, L, broken = false }) {
  const n = Math.max(2, Math.round(w / (7 * s)));
  let stakes = '';
  let lit = '';
  for (let i = 0; i <= n; i += 1) {
    const sx = x + (w * i) / n;
    if (broken && i % 3 === 1) continue;
    stakes += `M${r1(sx - 4 * s)},${r1(y)}L${r1(sx + 3.4 * s)},${r1(y - 8 * s)}L${r1(sx + 4.2 * s)},${r1(y - 7.4 * s)}L${r1(sx - 3.2 * s)},${r1(y + 0.6 * s)}Z`;
    stakes += `M${r1(sx + 4 * s)},${r1(y)}L${r1(sx - 3.4 * s)},${r1(y - 8 * s)}L${r1(sx - 4.2 * s)},${r1(y - 7.4 * s)}L${r1(sx + 3.2 * s)},${r1(y + 0.6 * s)}Z`;
    lit += `M${r1(sx - 3.6 * s)},${r1(y - 0.2 * s)}L${r1(sx + 3.6 * s)},${r1(y - 7.9 * s)}`;
  }
  return (
    <g>
      <path d={stakes} fill={L.wood} />
      <path d={lit} stroke={L.rim} strokeWidth={0.3 * s} opacity={L.rimOp * 0.6} />
      <rect x={x - 2 * s} y={y - 4.4 * s} width={w + 4 * s} height={1.8 * s} rx={0.9 * s} fill={L.woodDark} transform={broken ? `rotate(-4 ${x} ${y})` : undefined} />
    </g>
  );
}

export function Palisade({ x, y, w, h = 12, L, gapFrom, gapTo }) {
  let d = '';
  let lit = '';
  const step = 2.6;
  for (let px = x; px < x + w; px += step) {
    if (gapFrom != null && px > gapFrom && px < gapTo) continue;
    const hh = h * (0.9 + ((px * 13.7) % 1) * 0.15);
    d += `M${r1(px)},${r1(y)}v${r1(-hh)}l${step * 0.45},-2l${step * 0.45},2v${r1(hh)}Z`;
    lit += `M${r1(px + step * 0.72)},${r1(y)}v${r1(-hh + 0.3)}`;
  }
  return (
    <g>
      <path d={d} fill={L.wood} />
      <path d={lit} stroke={L.rim} strokeWidth="0.45" opacity={L.rimOp * 0.45} />
      <path d={d} fill={L.shade} opacity="0.22" transform={`translate(0 ${h * 0.55}) scale(1 0.45)`} style={{ transformOrigin: `0 ${y}px`, transformBox: 'view-box' }} />
      <rect x={x} y={y - h * 0.66} width={w} height="1" fill={L.woodDark} opacity="0.85" />
      <rect x={x} y={y - h * 0.3} width={w} height="0.8" fill={L.woodDark} opacity="0.7" />
    </g>
  );
}

export function Tent({ uid, x, y, s = 1, L, lit = false, torn = false, pennant = false, motion, color }) {
  const w = 16 * s;
  const h = 11 * s;
  const glow = lit && L.glow > 0.3;
  const front = `M${x - w * 0.42},${y}L${x},${y - h}L${x + w * 0.18},${y}Z`;
  const side = `M${x},${y - h}L${x + w * 0.62},${y - h * 0.92}L${x + w * 0.66},${y}L${x + w * 0.18},${y}Z`;
  const door = `M${x - w * 0.12},${y}L${x - w * 0.02},${y - h * 0.62}L${x + w * 0.06},${y}Z`;
  return (
    <g>
      <ellipse cx={x + w * 0.15} cy={y + 0.3 * s} rx={w * 0.62} ry={1.1 * s} fill={L.shade} opacity="0.35" />
      {glow && <circle cx={x} cy={y - 2 * s} r={13 * s} fill={`url(#${uid}-warm)`} opacity={0.5 * L.glow} />}
      <path d={`M${x - w * 0.42},${y}L${x - w * 0.62},${y + 0.6 * s}M${x + w * 0.66},${y}L${x + w * 0.86},${y + 0.6 * s}M${x},${y - h}L${x - w * 0.55},${y + 0.4 * s}`} stroke={L.woodDark} strokeWidth={0.25 * s} opacity="0.7" />
      <path d={front} fill={color ? color[1] : L.canvasDark} />
      <path d={side} fill={color ? color[0] : L.canvas} />
      {glow && <path d={side} fill={C.ember300} opacity={0.18 * L.glow} />}
      <path d={`M${x + w * 0.2},${y - h * 0.96}L${x + w * 0.24},${y}M${x + w * 0.4},${y - h * 0.94}L${x + w * 0.44},${y}`} stroke={L.canvasDark} strokeWidth={0.3 * s} opacity="0.5" />
      <path d={`M${x},${y - h}L${x + w * 0.62},${y - h * 0.92}`} stroke={L.rim} strokeOpacity={L.rimOp * 0.8} strokeWidth={0.6 * s} />
      <path d={door} fill={glow ? C.ember300 : L.shade} opacity={glow ? 0.95 : 0.75} />
      {glow && <path d={`M${x - w * 0.06},${y}L${x - w * 0.01},${y - h * 0.4}L${x + w * 0.03},${y}Z`} fill={C.lattice300} />}
      <path d={`M${x},${y - h}v${-1.6 * s}`} stroke={L.woodDark} strokeWidth={0.5 * s} />
      {torn && <path d={`M${x + w * 0.3},${y - h * 0.7}l${2 * s},${3 * s}l${-1 * s},${1.5 * s}l${2.4 * s},${2 * s}`} stroke={L.shade} strokeWidth={0.8 * s} fill="none" />}
      {pennant && <Banner uid={uid} x={x} y={y - h + 0.5} h={6 * s} len={5 * s} hgt={2.2 * s} motion={motion} L={L} pole />}
    </g>
  );
}

export function Cart({ x, y, s = 1, L, broken = false, cover = true, ox = false, facing = 1 }) {
  const f = facing;
  const wheel = (cx, cy, r) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={L.woodDark} strokeWidth={0.9 * s} />
      <path d={`M${cx - r},${cy}h${r * 2}M${cx},${cy - r}v${r * 2}M${cx - r * 0.7},${cy - r * 0.7}l${r * 1.4},${r * 1.4}M${cx + r * 0.7},${cy - r * 0.7}l${-r * 1.4},${r * 1.4}`} stroke={L.woodDark} strokeWidth={0.4 * s} />
      <path d={`M${cx + r * 0.3},${cy - r * 0.95}A${r},${r} 0 0 1 ${cx + r},${cy}`} stroke={L.rim} strokeWidth={0.4 * s} fill="none" opacity={L.rimOp * 0.6} />
    </g>
  );
  if (broken) {
    return (
      <g>
        <ellipse cx={x} cy={y + 0.4} rx={12 * s} ry={1.4 * s} fill={L.shade} opacity="0.35" />
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
      <ellipse cx={x + 2 * s * f} cy={y + 0.4} rx={13 * s} ry={1.3 * s} fill={L.shade} opacity="0.35" />
      {ox && (
        <path
          d={`M${x + 9 * s * f},${y - 4 * s}h${7 * s * f}q${2 * s * f},0 ${2.6 * s * f},${-2 * s}l${1.2 * s * f},${0.4 * s}l${-0.4 * s * f},${2.6 * s}l${-1 * s * f},${0.6 * s}v${3 * s}h${-1 * s * f}v${-2.6 * s}h${-5 * s * f}v${2.6 * s}h${-1 * s * f}v${-3.6 * s}Z`}
          fill={L.figure}
        />
      )}
      <path d={`M${x + 8 * s * f},${y - 3.5 * s}h${3 * s * f}`} stroke={L.woodDark} strokeWidth={0.6 * s} />
      <rect x={x - 8 * s} y={y - 7 * s} width={16 * s} height={4 * s} fill={L.wood} />
      <path d={`M${x - 8 * s},${y - 5 * s}h${16 * s}`} stroke={L.woodDark} strokeWidth={0.3 * s} opacity="0.7" />
      <rect x={x - 8 * s} y={y - 7 * s} width={16 * s} height={0.8 * s} fill={L.rim} opacity={L.rimOp * 0.45} />
      {cover && <path d={`M${x - 7.5 * s},${y - 7 * s}q${7.5 * s},${-9 * s} ${15 * s},0Z`} fill={L.canvas} />}
      {cover && <path d={`M${x - 3 * s},${y - 7 * s}q${0.5 * s},${-4 * s} ${1 * s},${-4.3 * s}M${x + 2 * s},${y - 7 * s}q${0.2 * s},${-4 * s} ${0.6 * s},${-4.3 * s}`} stroke={L.canvasDark} strokeWidth={0.3 * s} fill="none" opacity="0.7" />}
      {cover && <path d={`M${x},${y - 11.4 * s}q${4 * s},${0.2 * s} ${7.5 * s},${4.4 * s}h${-3 * s}Z`} fill={L.rim} opacity={L.rimOp * 0.4} />}
      {wheel(x - 4.5 * s, y - 2.2 * s, 2.6 * s)}
      {wheel(x + 4.5 * s, y - 2.2 * s, 2.6 * s)}
    </g>
  );
}

/** People silhouettes (one path) with a rim of key light. list: [x, y, h, kind, facing] */
export function Crowd({ list, fill, rim, rimOp = 0.4, bandages = [], shadow }) {
  if (!list.length) return null;
  return (
    <g>
      {shadow && <path d={list.map(([x, y, h]) => `M${r1(x - h * 0.05)},${r1(y)}a${r1(h * 0.3)},${r1(h * 0.05)} 0 1 0 ${r1(h * 0.6)},0a${r1(h * 0.3)},${r1(h * 0.05)} 0 1 0 ${r1(-h * 0.6)},0Z`).join('')} fill={shadow} opacity="0.4" />}
      <path d={crowdPath(list)} fill={fill} />
      {rim && <path d={crowdPath(list.map(([x, y, h, k, f]) => [x + Math.max(0.25, h * 0.03), y, h, k, f]))} fill="none" stroke={rim} strokeWidth={0.3} opacity={rimOp} />}
      {bandages.map(([bx, by, bw], i) => (
        <rect key={i} x={bx - bw / 2} y={by} width={bw} height={bw * 0.35} fill={C.parch100} opacity="0.9" />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- architecture
function crenels(x0, y0, w, n, mh) {
  // merlons along the top of a wall from x0 to x0+w at y0 (wall top)
  let d = '';
  const cw = w / (n * 2 - 1);
  for (let i = 0; i < n * 2 - 1; i += 2) d += `M${r1(x0 + i * cw)},${r1(y0 + 0.2)}v${r1(-mh)}h${r1(cw)}v${r1(mh)}Z`;
  return d;
}

function courses(x0, y0, w, h, gap, seed = 1) {
  // staggered stone courses
  const rnd = mulberry32(seed);
  let d = '';
  for (let y = y0 + gap; y < y0 + h - 0.2; y += gap) {
    d += `M${r1(x0)},${r1(y)}h${r1(w)}`;
    const off = rnd() * gap * 2;
    for (let x = x0 + off; x < x0 + w; x += gap * 2.4) d += `M${r1(x)},${r1(y)}v${r1(-gap)}`;
  }
  return d;
}

function windowArch(x, y, w, h) {
  return `M${r1(x - w / 2)},${r1(y + h)}V${r1(y + w / 2)}A${r1(w / 2)},${r1(w / 2)} 0 0 1 ${r1(x + w / 2)},${r1(y + w / 2)}V${r1(y + h)}Z`;
}

function Windows({ uid, list, L, lit }) {
  const d = list.map(([x, y, w, h]) => windowArch(x, y, w, h)).join('');
  return (
    <g>
      {lit && list.map(([x, y, w], i) => <circle key={i} cx={x} cy={y + w} r={w * 3.2} fill={`url(#${uid}-warm)`} opacity={0.45 * L.glow} />)}
      <path d={d} fill={lit ? L.window : mix(L.shade, L.stoneDark, 0.3)} opacity={lit ? 1 : 0.85} />
    </g>
  );
}

/** Royal forward outpost: curtain wall, round towers, a keep and a tall spire. Base at y. */
export function Keep({ uid, x, y, s = 1, L, motion, damaged = false, fortified = false }) {
  const lit = L.glow > 0.4;
  const S = (v) => r1(v * s);
  const X = (v) => r1(x + v * s);
  const Y = (v) => r1(y + v * s);
  // curtain wall
  const wallTop = -12;
  const wall = `M${X(-34)},${Y(0)}L${X(-33)},${Y(wallTop)}H${X(33)}L${X(34)},${Y(0)}Z`;
  const tower = (cx, w, h, roof) => {
    const top = -h;
    return (
      <g key={cx}>
        <path d={`M${X(cx - w / 2 - 0.6)},${Y(0)}L${X(cx - w / 2)},${Y(top)}H${X(cx + w / 2)}L${X(cx + w / 2 + 0.6)},${Y(0)}Z`} fill={`url(#${uid}-cyl)`} />
        <path d={courses(x + (cx - w / 2) * s, y + top * s, w * s, -top * s, 2.2 * s, cx + 9)} stroke={L.stoneDark} strokeWidth={0.22 * s} opacity="0.55" />
        <rect x={X(cx - w / 2 - 0.9)} y={Y(top - 0.9)} width={S(w + 1.8)} height={S(1.4)} fill={L.stone} />
        {roof && !damaged ? (
          <>
            <path d={`M${X(cx - w / 2 - 1.4)},${Y(top - 0.9)}L${X(cx)},${Y(top - w * 1.55)}L${X(cx + w / 2 + 1.4)},${Y(top - 0.9)}Z`} fill={`url(#${uid}-slate)`} />
            <path d={`M${X(cx)},${Y(top - w * 1.55)}v${S(-2.4)}`} stroke={C.gold400} strokeWidth={S(0.5)} />
          </>
        ) : (
          <path d={crenels(x + (cx - w / 2 - 0.9) * s, y + (top - 0.9) * s, (w + 1.8) * s, 3, 1.8 * s)} fill={L.stone} />
        )}
        <path d={windowArch(x + cx * s, y + (top + 4) * s, 1.2 * s, 2.6 * s)} fill={lit ? L.window : L.shade} opacity={lit ? 1 : 0.8} />
      </g>
    );
  };
  // keep block with a visible lit east face
  const kx0 = -11;
  const kx1 = 7;
  const kTop = -30;
  const side = 3.2;
  // spire tower
  const sx0 = 1;
  const sx1 = 10;
  const sTop = -48;
  const brokenTop = `M${X(sx0)},${Y(sTop + 8)}L${X(sx0 + 2)},${Y(sTop + 2)}L${X(sx0 + 4)},${Y(sTop + 6)}L${X(sx0 + 6)},${Y(sTop - 1)}L${X(sx1)},${Y(sTop + 5)}V${Y(-12)}H${X(sx0)}Z`;
  return (
    <g>
      {/* ground shadow + warm spill from the gate */}
      <ellipse cx={X(4)} cy={Y(0.6)} rx={S(44)} ry={S(2.4)} fill={L.shade} opacity="0.35" />
      {/* keep */}
      <path d={`M${X(kx0)},${Y(-10)}V${Y(kTop)}H${X(kx1)}V${Y(-10)}Z`} fill={`url(#${uid}-stone)`} />
      <path d={`M${X(kx1)},${Y(-10)}V${Y(kTop)}L${X(kx1 + side)},${Y(kTop + 1.5)}V${Y(-10)}Z`} fill={mix(L.stone, L.rim, 0.3)} />
      <path d={courses(x + kx0 * s, y + kTop * s, (kx1 - kx0) * s, 20 * s, 2.4 * s, 4)} stroke={L.stoneDark} strokeWidth={0.22 * s} opacity="0.5" />
      {damaged ? (
        <path d={`M${X(kx0 - 0.6)},${Y(kTop)}L${X(kx0 + 3)},${Y(kTop - 3)}L${X(kx0 + 5)},${Y(kTop - 1)}L${X(kx0 + 9)},${Y(kTop - 4)}L${X(kx1 + side)},${Y(kTop + 1)}V${Y(kTop + 1.5)}H${X(kx0 - 0.6)}Z`} fill={L.stoneDark} />
      ) : (
        <>
          <path d={`M${X(kx0 - 1)},${Y(kTop)}L${X(-2)},${Y(kTop - 9)}L${X(kx1 + side + 0.8)},${Y(kTop + 1.2)}Z`} fill={`url(#${uid}-slate)`} />
          <path d={crenels(x + (kx0 - 0.6) * s, y + kTop * s, 7 * s, 2, 1.6 * s)} fill={L.stone} />
        </>
      )}
      {/* spire tower */}
      {damaged ? (
        <path d={brokenTop} fill={`url(#${uid}-stone)`} />
      ) : (
        <>
          <path d={`M${X(sx0)},${Y(-12)}V${Y(sTop)}H${X(sx1)}V${Y(-12)}Z`} fill={`url(#${uid}-stone)`} />
          <path d={`M${X(sx1)},${Y(-12)}V${Y(sTop)}L${X(sx1 + 2.2)},${Y(sTop + 1.2)}V${Y(-12)}Z`} fill={mix(L.stone, L.rim, 0.32)} />
          <path d={courses(x + sx0 * s, y + sTop * s, (sx1 - sx0) * s, 34 * s, 2.3 * s, 7)} stroke={L.stoneDark} strokeWidth={0.2 * s} opacity="0.5" />
          {/* machicolation band */}
          <rect x={X(sx0 - 1)} y={Y(sTop - 0.4)} width={S(sx1 - sx0 + 3.4)} height={S(2)} fill={L.stone} />
          <path d={Array.from({ length: 5 }, (_, i) => `M${X(sx0 - 0.4 + i * 2.6)},${Y(sTop + 1.6)}v${S(1.2)}`).join('')} stroke={L.stoneDark} strokeWidth={S(0.8)} />
          <path d={`M${X(sx0 - 1.6)},${Y(sTop - 0.4)}L${X((sx0 + sx1) / 2 + 0.6)},${Y(sTop - 22)}L${X(sx1 + 3)},${Y(sTop - 0.4)}Z`} fill={`url(#${uid}-slate)`} />
          <path d={`M${X((sx0 + sx1) / 2 + 0.6)},${Y(sTop - 22)}L${X(sx1 + 3)},${Y(sTop - 0.4)}`} stroke={L.rim} strokeWidth={S(0.35)} opacity={L.rimOp * 0.8} />
          <Banner uid={uid} x={x + ((sx0 + sx1) / 2 + 0.6) * s} y={y + (sTop - 22) * s} h={11 * s} len={11 * s} hgt={4.4 * s} motion={motion} L={L} />
        </>
      )}
      <Windows
        uid={uid}
        L={L}
        lit={lit}
        list={[
          [x + -6 * s, y + -24 * s, 1.5 * s, 3.4 * s],
          [x + -1.5 * s, y + -24 * s, 1.5 * s, 3.4 * s],
          [x + -6 * s, y + -17 * s, 1.5 * s, 3.4 * s],
          ...(damaged ? [] : [[x + 5.5 * s, y + -40 * s, 1.6 * s, 3.8 * s], [x + 5.5 * s, y + -31 * s, 1.6 * s, 3.8 * s], [x + 5.5 * s, y + -22 * s, 1.6 * s, 3.8 * s]]),
        ]}
      />
      {/* curtain wall + towers in front */}
      <path d={wall} fill={`url(#${uid}-wallv)`} />
      <path d={wall} fill={`url(#${uid}-stone)`} opacity="0.55" />
      <path d={courses(x - 33 * s, y + wallTop * s, 66 * s, 12 * s, 2.2 * s, 2)} stroke={L.stoneDark} strokeWidth={0.22 * s} opacity="0.5" />
      <path d={crenels(x - 33 * s, y + wallTop * s, 66 * s, 13, 1.8 * s)} fill={L.stone} />
      <path d={`M${X(-33)},${Y(wallTop)}H${X(33)}`} stroke={L.rim} strokeWidth={S(0.35)} opacity={L.rimOp * 0.5} />
      {damaged && <path d={`M${X(-20)},${Y(wallTop - 2)}l${S(3)},${S(5)}l${S(3)},${S(-3)}l${S(4)},${S(6)}l${S(3)},${S(-6)}V${Y(wallTop - 2)}Z`} fill={L.shade} opacity="0.9" />}
      {tower(-31, 8, 20, true)}
      {tower(31, 8, 22, true)}
      {/* gate */}
      <path d={`M${X(-4)},${Y(0)}V${Y(-6)}A${S(4)},${S(4)} 0 0 1 ${X(4)},${Y(-6)}V${Y(0)}Z`} fill={lit ? C.ember500 : L.shade} opacity={lit ? 0.95 : 0.88} />
      {lit && <path d={`M${X(-2.6)},${Y(0)}V${Y(-5.4)}A${S(2.6)},${S(2.6)} 0 0 1 ${X(2.6)},${Y(-5.4)}V${Y(0)}Z`} fill={C.ember300} opacity="0.85" />}
      <path d={Array.from({ length: 4 }, (_, i) => `M${X(-3 + i * 2)},${Y(-9.4)}v${S(4.2)}`).join('')} stroke={L.woodDark} strokeWidth={S(0.45)} />
      <path d={`M${X(-4.8)},${Y(-6)}A${S(4.8)},${S(4.8)} 0 0 1 ${X(4.8)},${Y(-6)}`} stroke={L.stone} strokeWidth={S(1)} fill="none" />
      {lit && <Glow uid={uid} x={x} y={y - 3 * s} r={16 * s} op={0.6 * L.glow} motion={motion} flicker />}
      {fortified && (
        <>
          <Gonfalon x={x - 18 * s} y={y - 11 * s} w={4.4 * s} h={8 * s} motion={motion} L={L} />
          <Gonfalon x={x + 16 * s} y={y - 11 * s} w={4.4 * s} h={8 * s} motion={motion} L={L} />
          <Banner uid={uid} x={x - 31 * s} y={y - 32 * s} h={9 * s} len={8 * s} hgt={3.2 * s} motion={motion} L={L} dur={3.1} />
          <Torch uid={uid} x={x - 9 * s} y={y - 12 * s} s={0.55 * s} L={L} motion={motion} pole={false} />
          <Torch uid={uid} x={x + 9 * s} y={y - 12 * s} s={0.55 * s} L={L} motion={motion} pole={false} />
        </>
      )}
      {damaged && (
        <>
          <Glow uid={uid} x={x - 2 * s} y={y - 28 * s} r={14 * s} op={0.55 + L.glow * 0.3} motion={motion} flicker />
          <Flame x={x - 3 * s} y={y - 30 * s} h={6 * s} motion={motion} />
          <Flame x={x + 1 * s} y={y - 29.4 * s} h={4 * s} motion={motion} dur={1.1} />
        </>
      )}
    </g>
  );
}

/** Cottages: [x, y, s, facing]. Plaster walls, pitched roofs, lit windows, chimneys. */
export function Village({ uid, list, L, motion, smoke = [], damaged = false }) {
  const lit = L.glow > 0.4;
  const wall = mix(L.canvas, L.stone, 0.45);
  const wallLit = mix(wall, L.rim, 0.25);
  const roof = mix(L.wood, C.crimson600, 0.25);
  const roofLit = mix(roof, L.rim, 0.25);
  let walls = '';
  let lits = '';
  let roofs = '';
  let roofL = '';
  let wins = '';
  let chim = '';
  list.forEach(([x, y, s]) => {
    const w = 7 * s;
    const h = 4.2 * s;
    const rh = 3.8 * s;
    const d = 2.6 * s;
    walls += `M${r1(x - w / 2)},${r1(y)}V${r1(y - h)}H${r1(x + w / 2)}V${r1(y)}Z`;
    lits += `M${r1(x + w / 2)},${r1(y)}V${r1(y - h)}L${r1(x + w / 2 + d)},${r1(y - h - d * 0.35)}V${r1(y - d * 0.3)}Z`;
    roofs += `M${r1(x - w / 2 - 0.6 * s)},${r1(y - h)}L${r1(x - w / 2 + d * 0.5)},${r1(y - h - rh)}H${r1(x + w / 2 + d * 0.5)}L${r1(x + w / 2 - 0.2 * s)},${r1(y - h)}Z`;
    roofL += `M${r1(x + w / 2 + d * 0.5)},${r1(y - h - rh)}L${r1(x + w / 2 + d + 0.4 * s)},${r1(y - h - d * 0.35)}L${r1(x + w / 2 - 0.2 * s)},${r1(y - h)}Z`;
    wins += `M${r1(x - w * 0.25)},${r1(y - h * 0.62)}h${r1(1.1 * s)}v${r1(1.3 * s)}h${r1(-1.1 * s)}Z M${r1(x + w * 0.12)},${r1(y - h * 0.62)}h${r1(1.1 * s)}v${r1(1.3 * s)}h${r1(-1.1 * s)}Z`;
    chim += `M${r1(x + w * 0.22)},${r1(y - h - rh * 0.4)}v${r1(-rh * 0.75)}h${r1(1.2 * s)}v${r1(rh * 0.75)}Z`;
  });
  return (
    <g>
      <path d={walls} fill={wall} />
      <path d={lits} fill={wallLit} />
      <path d={wins} fill={lit && !damaged ? L.window : L.shade} opacity={lit && !damaged ? 1 : 0.7} />
      <path d={chim} fill={L.stoneDark} />
      <path d={roofs} fill={damaged ? L.woodDark : roof} />
      <path d={roofL} fill={damaged ? L.woodDark : roofLit} />
      {lit && !damaged && list.map(([x, y, s], i) => <circle key={i} cx={x} cy={y - 2.4 * s} r={6 * s} fill={`url(#${uid}-warm)`} opacity={0.35 * L.glow} />)}
      {smoke.map((i) => {
        const v = list[i];
        if (!v) return null;
        const [x, y, s] = v;
        return <Smoke key={i} uid={uid} x={x + 7 * s * 0.22 + 0.6 * s} y={y - 4.2 * s - 3.8 * s * 1.15} s={0.32 * s} motion={motion} rise={70} drift={-36} dur={10 + i} op={0.55} />;
      })}
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
        const shadow = <ellipse cx={mx + 2 * s} cy={y + 0.3 * s} rx={10 * s} ry={1.4 * s} fill={L.shade} opacity="0.4" />;
        if (k === 'fountain') {
          return (
            <g key={i}>
              {shadow}
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
              {shadow}
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
            {shadow}
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
export function Snowfall({ motion, L, seed = 11, count = 34, dur = 14, size = 0.7, op = 0.75, drift = -18 }) {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * 440 - 20;
    const y = rnd() * 230;
    const r = size * (0.5 + rnd() * 0.7);
    d += `M${r1(x - r)},${r1(y)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;
  }
  return (
    <g opacity={op} fill={mix(L.snow, C.lattice100, 0.4)} pointerEvents="none">
      <g>
        {motion && <animateTransform attributeName="transform" type="translate" values={`0 0;${drift} 230`} dur={`${dur}s`} repeatCount="indefinite" />}
        <path d={d} />
        <path d={d} transform={`translate(${-drift} -230)`} />
      </g>
    </g>
  );
}

export function Eyes({ uid, list, motion }) {
  return (
    <g>
      {list.map(([x, y, s, delay], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5 * s} fill={uid ? `url(#${uid}-lattice)` : C.lattice300} opacity={uid ? 0.45 : 0.12} />
          <g>
            {motion && <animate attributeName="opacity" values="1;1;0;1;1" keyTimes="0;0.9;0.93;0.96;1" dur={`${5 + delay}s`} begin={`${-delay}s`} repeatCount="indefinite" />}
            <path d={`M${x - 2.4 * s},${y}l${1.5 * s},${-0.7 * s}l${0.4 * s},${0.9 * s}Z M${x + 2.4 * s},${y}l${-1.5 * s},${-0.7 * s}l${-0.4 * s},${0.9 * s}Z`} fill={C.lattice200} />
          </g>
        </g>
      ))}
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
      <path d={brokenTop} fill={`url(#${uid}-cyl)`} />
      <path d={`M${x - w * 0.28},${top + 3}V${y - 2}M${x - w * 0.05},${top + 3}V${y - 2}M${x + w * 0.18},${top + 3}V${y - 2}`} stroke={L.stoneDark} strokeWidth="0.4" opacity="0.6" />
      <path d={`M${x - w * 0.3},${top + h * 0.4}l${w * 0.2},${h * 0.06}l${-w * 0.1},${h * 0.08}`} stroke={L.shade} strokeWidth="0.35" fill="none" opacity="0.6" />
      {!broken && <rect x={x - w / 2 - 1.4} y={top} width={w + 2.8} height="2.4" fill={L.stone} />}
      {!broken && <rect x={x - w / 2 - 1.4} y={top} width={w + 2.8} height="0.5" fill={L.rim} opacity={L.rimOp * 0.5} />}
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

/** Ancient monolith with the broken-circle symbol lit from within; motes rise from it. */
export function Monolith({ uid, x, y, s = 1, L, motion, intensity = 1 }) {
  const w = 16 * s;
  const h = 58 * s;
  const cy = y - h * 0.62;
  const sym = symbolPaths(x, cy, 6.5 * s);
  const glowOp = Math.min(1, (0.45 + L.glow * 0.4) * intensity);
  const rnd = mulberry32(17);
  const motes = Array.from({ length: 10 }, () => [x + (rnd() - 0.5) * w * 2.4, y - rnd() * h * 1.1, 0.3 + rnd() * 0.5, 4 + rnd() * 5]);
  const outline = `M${x - w * 0.55},${y}L${x - w * 0.45},${y - h * 0.9}L${x - w * 0.1},${y - h}L${x + w * 0.3},${y - h * 0.96}L${x + w * 0.46},${y - h * 0.86}L${x + w * 0.55},${y}Z`;
  return (
    <g>
      {/* light pool on the platform */}
      <ellipse cx={x} cy={y} rx={34 * s} ry={5 * s} fill={`url(#${uid}-lattice)`} opacity={glowOp * 0.8} />
      <circle cx={x} cy={cy} r={44 * s} fill={`url(#${uid}-lattice)`} opacity={glowOp * 0.35} />
      <path d={outline} fill={`url(#${uid}-stone)`} />
      {/* west face in shadow, east edge lit */}
      <path d={`M${x - w * 0.55},${y}L${x - w * 0.45},${y - h * 0.9}L${x - w * 0.1},${y - h}L${x - w * 0.18},${y}Z`} fill={L.shade} opacity="0.3" />
      <path d={`M${x + w * 0.3},${y - h * 0.96}L${x + w * 0.46},${y - h * 0.86}L${x + w * 0.55},${y}H${x + w * 0.4}Z`} fill={L.rim} opacity={L.rimOp * 0.45} />
      <path d={`M${x - w * 0.3},${y - h * 0.3}l${w * 0.15},${h * 0.1}l${-w * 0.05},${h * 0.12}M${x + w * 0.1},${y - h * 0.15}l${w * 0.12},${h * 0.08}M${x - w * 0.2},${y - h * 0.85}l${w * 0.1},${h * 0.07}`} stroke={L.stoneDark} strokeWidth={0.5 * s} fill="none" />
      {/* faint runes down the stone */}
      <path d={Array.from({ length: 5 }, (_, i) => `M${r1(x - 2 * s)},${r1(y - h * 0.4 + i * 3.6 * s)}h${r1(1.2 * s)}m${r1(1 * s)},0h${r1(1.8 * s)}`).join('')} stroke={C.lattice300} strokeWidth={0.4 * s} opacity={0.35 * intensity} />
      <circle cx={x} cy={cy} r={16 * s} fill={`url(#${uid}-lattice)`} opacity={glowOp}>
        {motion && <animate attributeName="opacity" values={`${glowOp * 0.6};${glowOp};${glowOp * 0.6}`} dur="6s" repeatCount="indefinite" />}
      </circle>
      {/* the glyph: a carved rune ring, a gold-leaf arc with a soft bloom, a white-gold star */}
      <circle cx={x} cy={cy} r={9.6 * s} fill="none" stroke={C.gold600} strokeWidth={0.5 * s} strokeDasharray={`${0.8 * s} ${1.1 * s} ${2 * s} ${1.1 * s}`} opacity={0.55 * Math.min(1, intensity)} />
      <circle cx={x} cy={cy} r={8 * s} fill={`url(#${uid}-lattice)`} opacity={Math.min(1, 0.7 * intensity)} />
      <g fill="none" opacity={Math.min(1, 0.65 + 0.35 * intensity)}>
        <path d={sym.arc} stroke={C.gold400} strokeWidth={3.2 * s} opacity="0.35" />
        <path d={sym.arc} stroke={C.gold300} strokeWidth={1.4 * s} />
        <path d={sym.arc} stroke={C.lattice100} strokeWidth={0.45 * s} />
        <path d={sym.star} fill={C.lattice100} stroke={C.gold300} strokeWidth={0.3 * s} />
      </g>
      <g fill={C.lattice200} pointerEvents="none">
        {motes.map(([mx, my, mr, dur], i) => (
          <circle key={i} cx={r1(mx)} cy={r1(my)} r={r1(mr * s)} opacity={motion ? 0 : 0.6}>
            {motion && (
              <>
                <animate attributeName="cy" values={`${r1(y - 2)};${r1(y - h * 1.2)}`} dur={`${r1(dur)}s`} begin={`${r1(-i * 0.7)}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.9;0" dur={`${r1(dur)}s`} begin={`${r1(-i * 0.7)}s`} repeatCount="indefinite" />
              </>
            )}
          </circle>
        ))}
      </g>
    </g>
  );
}

/** A standing stone of the broken circle. Base at y. */
export function StandingStone({ uid, x, y, w = 8, h = 26, lean = 0, L, seed = 1 }) {
  const rnd = mulberry32(seed);
  const tl = [x - w * 0.42 + lean, y - h * (0.92 + rnd() * 0.08)];
  const tr = [x + w * 0.4 + lean, y - h * (0.85 + rnd() * 0.1)];
  const d = `M${r1(x - w / 2)},${y}L${r1(tl[0])},${r1(tl[1])}L${r1(x + lean * 0.5)},${r1(y - h)}L${r1(tr[0])},${r1(tr[1])}L${r1(x + w / 2)},${y}Z`;
  return (
    <g>
      <ellipse cx={x + 1} cy={y + 0.3} rx={w * 0.9} ry={1.2} fill={L.shade} opacity="0.35" />
      <path d={d} fill={`url(#${uid}-stone)`} />
      <path d={`M${r1(tr[0])},${r1(tr[1])}L${r1(x + w / 2)},${y}H${r1(x + w * 0.3)}Z`} fill={L.rim} opacity={L.rimOp * 0.35} />
      <path d={`M${r1(x - w * 0.2)},${r1(y - h * 0.6)}l${r1(w * 0.2)},${r1(h * 0.1)}`} stroke={L.stoneDark} strokeWidth="0.4" />
    </g>
  );
}

// ---------------------------------------------------------------- Iron Syndicate
export function Depot({ uid, x, y, s = 1, L, motion, damaged = false, burning = false }) {
  const crate = (cx, cy, w) => (
    <g key={`${cx}-${cy}`}>
      <rect x={cx} y={cy - w} width={w} height={w} fill={L.wood} />
      <path d={`M${cx},${cy - w}l${w},${w}M${cx + w},${cy - w}l${-w},${w}`} stroke={L.woodDark} strokeWidth={0.5 * s} />
      <rect x={cx + w - 0.8 * s} y={cy - w} width={0.8 * s} height={w} fill={L.rim} opacity={L.rimOp * 0.4} />
    </g>
  );
  const tank = (cx, cy, w, h) => (
    <g key={`t${cx}`}>
      <rect x={cx} y={cy - h} width={w} height={h} rx={h / 2} fill={`url(#${uid}-ironh)`} />
      <rect x={cx + w * 0.25} y={cy - h} width={1 * s} height={h} fill={C.brass500} opacity="0.8" />
      <rect x={cx + w * 0.7} y={cy - h} width={1 * s} height={h} fill={C.brass500} opacity="0.8" />
      <rect x={cx + 2 * s} y={cy - h + 0.8 * s} width={w - 4 * s} height={0.8 * s} fill={L.rim} opacity={L.rimOp * 0.35} />
    </g>
  );
  const fire = burning || damaged;
  return (
    <g>
      {fire && <Glow uid={uid} x={x + 14 * s} y={y - 12 * s} r={46 * s} op={0.75} motion={motion} flicker />}
      {/* gantry crane */}
      <path d={`M${x + 34 * s},${y}V${y - 40 * s}M${x + 42 * s},${y}V${y - 40 * s}M${x + 30 * s},${y - 40 * s}H${x + 8 * s}M${x + 34 * s},${y - 10 * s}L${x + 42 * s},${y - 20 * s}L${x + 34 * s},${y - 30 * s}L${x + 42 * s},${y - 40 * s}M${x + 14 * s},${y - 40 * s}v${10 * s}`} stroke={C.iron900} strokeWidth={1.2 * s} fill="none" transform={damaged ? `rotate(-14 ${x + 38 * s} ${y})` : undefined} />
      <rect x={x + 11 * s} y={y - 30 * s} width={6 * s} height={4 * s} fill={L.wood} transform={damaged ? `rotate(-14 ${x + 38 * s} ${y})` : undefined} />
      {/* shed */}
      <path d={`M${x - 14 * s},${y}V${y - 14 * s}L${x - 6 * s},${y - 19 * s}L${x + 2 * s},${y - 14 * s}V${y}Z`} fill={C.iron700} />
      <path d={`M${x - 6 * s},${y - 19 * s}L${x + 2 * s},${y - 14 * s}V${y}`} stroke={L.rim} strokeWidth={0.4 * s} fill="none" opacity={L.rimOp * 0.5} />
      <rect x={x - 9 * s} y={y - 8 * s} width={5 * s} height={8 * s} fill={fire ? C.ember400 : L.shade} opacity={fire ? 0.9 : 0.7} />
      {tank(x, y, 22 * s, 8 * s)}
      {tank(x + 2 * s, y - 8 * s, 18 * s, 7 * s)}
      {crate(x + 24 * s, y, 7 * s)}
      {crate(x + 31.5 * s, y, 6 * s)}
      {crate(x + 26 * s, y - 7 * s, 6 * s)}
      <Banner uid={uid} x={x - 18 * s} y={y} h={26 * s} len={10 * s} hgt={5 * s} motion={motion} L={L} colors={[C.iron700, C.brass500]} torn={damaged} />
      {fire && (
        <>
          <Flame x={x - 7 * s} y={y - 18 * s} h={9 * s} motion={motion} />
          <Flame x={x - 3 * s} y={y - 16 * s} h={6 * s} motion={motion} dur={1.2} />
          <Flame x={x + 12 * s} y={y - 15 * s} h={7 * s} motion={motion} dur={0.8} />
          <Smoke uid={uid} x={x - 4 * s} y={y - 24 * s} s={1.1 * s} motion={motion} rise={90} drift={-40} dur={9} />
          <Embers x={x} y={y - 18 * s} s={1.2 * s} motion={motion} count={6} seed={21} rise={40} />
        </>
      )}
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
      <path d={wire} stroke={C.iron500} strokeWidth="0.35" fill="none" />
      <path d={`M${x},${y - 3}h${w}`} stroke={C.iron500} strokeWidth="0.35" fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- camp
export function CampfireMark({ uid, x, y, s = 1, L, motion, big = 1 }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={44 * s * big} ry={11 * s * big} fill={`url(#${uid}-warm)`} opacity={0.45 + 0.5 * L.glow} />
      <circle cx={x} cy={y - 5 * s} r={28 * s * big} fill={`url(#${uid}-warm)`} opacity={0.4 + 0.55 * L.glow}>
        {motion && <animate attributeName="opacity" values={`${0.4 + 0.5 * L.glow};${0.5 + 0.5 * L.glow};${0.34 + 0.5 * L.glow};${0.4 + 0.5 * L.glow}`} dur="1.6s" repeatCount="indefinite" />}
      </circle>
      {/* ring of stones */}
      <path d={Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const cx = x + Math.cos(a) * 7.5 * s;
        const cy = y + 0.6 * s + Math.sin(a) * 1.8 * s;
        return `M${r1(cx - 1.4 * s)},${r1(cy)}a${r1(1.4 * s)},${r1(0.9 * s)} 0 1 0 ${r1(2.8 * s)},0a${r1(1.4 * s)},${r1(0.9 * s)} 0 1 0 ${r1(-2.8 * s)},0Z`;
      }).join('')} fill={L.stoneDark} />
      <path d={`M${x - 6 * s},${y + 0.6 * s}L${x + 5 * s},${y - 2.2 * s}L${x + 6 * s},${y - 1 * s}L${x - 5 * s},${y + 1.6 * s}Z M${x + 6 * s},${y + 0.6 * s}L${x - 5 * s},${y - 2.2 * s}L${x - 6 * s},${y - 1 * s}L${x + 5 * s},${y + 1.6 * s}Z`} fill={L.woodDark} />
      <Flame x={x - 1.6 * s} y={y - 1 * s} h={8 * s * big} motion={motion} dur={0.8} />
      <Flame x={x + 1.8 * s} y={y - 0.8 * s} h={6 * s * big} motion={motion} dur={1.1} />
      <Flame x={x + 0.2 * s} y={y - 0.6 * s} h={4.5 * s * big} motion={motion} dur={0.7} />
      <Embers x={x} y={y - 8 * s} s={s} motion={motion} count={7} />
    </g>
  );
}
