import { memo } from 'react';
import { useUid } from './util.js';

const f = (n) => n.toFixed(2);

function gearPath(cx, cy, teeth, rOuter, rInner, toothFrac = 0.5) {
  const step = (Math.PI * 2) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i += 1) {
    const a0 = i * step - step * 0.5;
    const t0 = a0 + step * (0.5 - toothFrac / 2);
    const t1 = a0 + step * (0.5 + toothFrac / 2);
    const bevel = step * 0.06;
    const pts = [
      [rInner, a0],
      [rInner, t0 - bevel],
      [rOuter, t0 + bevel],
      [rOuter, t1 - bevel],
      [rInner, t1 + bevel],
    ];
    pts.forEach(([r, a], j) => {
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += `${i === 0 && j === 0 ? 'M' : 'L'}${f(x)},${f(y)}`;
    });
  }
  return `${d}Z`;
}

function starPoints(cx, cy, n, rOut, rIn, rot = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i * Math.PI) / n;
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`;
  }
  return `${d}Z`;
}


// ---------------------------------------------------------------- shared metalwork
// A cast rim catches the key light (upper left) and falls into shadow (lower right).
function Bevel({ id, cx, cy, r, width = 2.4, light = '#fffaf0', dark = '#1f1810', opacity = 0.85 }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={light} stopOpacity="0.95" />
          <stop offset="0.42" stopColor={light} stopOpacity="0" />
          <stop offset="0.58" stopColor={dark} stopOpacity="0" />
          <stop offset="1" stopColor={dark} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={width} opacity={opacity} />
    </>
  );
}

// Enamel depth + glaze: an inner shadow ring and a soft crescent of reflected light, clipped to the field.
function Glaze({ id, cx, cy, r, strength = 1 }) {
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <radialGradient id={`${id}-depth`} cx="50%" cy="50%" r="50%">
          <stop offset="0.72" stopColor="#04070d" stopOpacity="0" />
          <stop offset="1" stopColor="#04070d" stopOpacity={0.55 * strength} />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" stopOpacity={0.26 * strength} />
          <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-depth)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <ellipse cx={cx - r * 0.18} cy={cy - r * 0.62} rx={r * 0.95} ry={r * 0.55} fill={`url(#${id}-gloss)`} />
      </g>
    </>
  );
}

// ---------------------------------------------------------------- Elvia
function ElviaCrest({ uid }) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI * 2) / 16 - Math.PI / 2;
    const long = i % 2 === 0;
    const r0 = 13;
    const r1 = long ? 24 : 19.5;
    const w = long ? 0.11 : 0.08;
    return `M${f(50 + Math.cos(a - w) * r0)},${f(56 + Math.sin(a - w) * r0)}L${f(50 + Math.cos(a) * r1)},${f(56 + Math.sin(a) * r1)}L${f(50 + Math.cos(a + w) * r0)},${f(56 + Math.sin(a + w) * r0)}Z`;
  }).join('');
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbefc2" />
          <stop offset="0.45" stopColor="#e3c463" />
          <stop offset="1" stopColor="#9a7818" />
        </linearGradient>
        <radialGradient id={`${uid}-field`} cx="50%" cy="40%" r="62%">
          <stop offset="0" stopColor="#24395c" />
          <stop offset="1" stopColor="#0b1424" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffe9ae" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#e3c463" stopOpacity="0.1" />
          <stop offset="1" stopColor="#e3c463" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.6" stopColor="#ffe9ae" />
          <stop offset="1" stopColor="#e3c463" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="44.6" fill="#2a2006" />
      <circle cx="50" cy="52" r="44" fill={`url(#${uid}-g)`} />
      <Bevel id={`${uid}-rim`} cx={50} cy={52} r={42} width={3.6} />
      <circle cx="50" cy="52" r="40.6" fill="#04070d" />
      <circle cx="50" cy="52" r="39.5" fill={`url(#${uid}-field)`} />
      <circle cx="50" cy="56" r="30" fill={`url(#${uid}-halo)`} />
      <circle cx="50" cy="52" r="39.5" fill="none" stroke="#c9a227" strokeOpacity="0.55" strokeWidth="0.8" />
      {/* arcane circle */}
      <circle cx="50" cy="56" r="27" fill="none" stroke="#e3c463" strokeWidth="1.2" strokeOpacity="0.85" />
      <circle cx="50" cy="56" r="24.5" fill="none" stroke="#e3c463" strokeWidth="0.6" strokeDasharray="1.2 2.2" strokeOpacity="0.8" />
      <path d={starPoints(50, 56, 4, 27, 11, -Math.PI / 4)} fill="none" stroke="#e3c463" strokeWidth="0.6" strokeOpacity="0.55" />
      {/* sun */}
      <path d={rays} fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="56" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="56" r="11" fill="none" stroke="#4f3d0d" strokeWidth="0.6" />
      <circle cx="50" cy="56" r="8" fill={`url(#${uid}-core)`} />
      <circle cx="47.6" cy="53.4" r="2.2" fill="#fffdf7" opacity="0.85" />
      <Glaze id={`${uid}-gz`} cx={50} cy={52} r={39.5} />
      {/* crown */}
      <g transform="translate(0 -2)">
        <path
          d="M30,30 L33,14 L40.5,23 L45,9.5 L50,20 L55,9.5 L59.5,23 L67,14 L70,30 Z"
          fill={`url(#${uid}-g)`}
          stroke="#4f3d0d"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <rect x="29" y="29" width="42" height="6" rx="1.2" fill={`url(#${uid}-g)`} stroke="#4f3d0d" strokeWidth="0.9" />
        <circle cx="33" cy="13.5" r="2" fill="#fbefc2" stroke="#4f3d0d" strokeWidth="0.6" />
        <circle cx="45" cy="9" r="2" fill="#fbefc2" stroke="#4f3d0d" strokeWidth="0.6" />
        <circle cx="55" cy="9" r="2" fill="#fbefc2" stroke="#4f3d0d" strokeWidth="0.6" />
        <circle cx="67" cy="13.5" r="2" fill="#fbefc2" stroke="#4f3d0d" strokeWidth="0.6" />
        <path d="M50,21 l2.4,4 l-2.4,4 l-2.4,-4Z" fill="#9e2b25" stroke="#4f3d0d" strokeWidth="0.5" />
        <circle cx="38" cy="32" r="1.3" fill="#9e2b25" />
        <circle cx="62" cy="32" r="1.3" fill="#9e2b25" />
        <circle cx="50" cy="32" r="1.5" fill="#1f3150" stroke="#fbefc2" strokeWidth="0.4" />
        {/* light catching the crown's upper edges */}
        <path d="M33,14.5 L40.5,23.6 M45,10.6 L50,20.8 L55,10.6 M67,14.5 L59.5,23.6" fill="none" stroke="#fffaf0" strokeWidth="0.7" strokeOpacity="0.75" strokeLinecap="round" />
        <path d="M30,30.2 H70" stroke="#fffaf0" strokeWidth="0.6" strokeOpacity="0.6" />
        <path d="M29.6,34.6 H70.4" stroke="#4f3d0d" strokeWidth="0.8" strokeOpacity="0.8" />
        <circle cx="49.4" cy="24" r="0.6" fill="#fffaf0" opacity="0.9" />
      </g>
    </>
  );
}

// ---------------------------------------------------------------- Iron Syndicate
function SyndicateCrest({ uid }) {
  const rivets = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12 + Math.PI / 12;
    return [50 + Math.cos(a) * 31.5, 50 + Math.sin(a) * 31.5];
  });
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#eef2f5" />
          <stop offset="0.4" stopColor="#9aa0a8" />
          <stop offset="1" stopColor="#3b3f45" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e9bd" />
          <stop offset="0.35" stopColor="#d6b47a" />
          <stop offset="0.7" stopColor="#b08d57" />
          <stop offset="1" stopColor="#6a5230" />
        </linearGradient>
        <linearGradient id={`${uid}-edge`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#eef2f5" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#eef2f5" stopOpacity="0" />
          <stop offset="1" stopColor="#0e0f11" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={`${uid}-heat`} cx="50%" cy="58%" r="50%">
          <stop offset="0" stopColor="#e0782b" stopOpacity="0.7" />
          <stop offset="0.55" stopColor="#8a3a1c" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0e0f11" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={gearPath(50, 50, 12, 48, 39, 0.5)} fill={`url(#${uid}-b)`} stroke="#15171a" strokeWidth="1.4" strokeLinejoin="round" />
      <path d={gearPath(50, 50, 12, 46.8, 39.8, 0.44)} fill="none" stroke={`url(#${uid}-edge)`} strokeWidth="1" strokeLinejoin="round" />
      <Bevel id={`${uid}-rim`} cx={50} cy={50} r={38} width={3.4} light="#fffaf0" dark="#1b1d21" />
      <circle cx="50" cy="50" r="35.6" fill="#0e0f11" stroke="#04070d" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="35.6" fill={`url(#${uid}-heat)`} />
      <circle cx="50" cy="50" r="32.6" fill="none" stroke="#b08d57" strokeWidth="1.1" strokeOpacity="0.8" />
      {rivets.filter((_, i) => i % 2 === 0).map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="2.2" fill="#6a5230" />
          <circle cx={x - 0.5} cy={y - 0.5} r="1.1" fill="#f6e9bd" />
        </g>
      ))}
      {/* inner cog behind hammer: iron with a lit edge, an ember heart */}
      <path d={gearPath(50, 50, 8, 22, 17, 0.5)} fill="#5d636b" stroke="#0e0f11" strokeWidth="1" />
      <path d={gearPath(50, 50, 8, 21.2, 17.6, 0.44)} fill="none" stroke="#c3c7cc" strokeOpacity="0.55" strokeWidth="0.7" />
      <circle cx="50" cy="50" r="7.5" fill="#e0782b" stroke="#6a5230" strokeWidth="1.2" />
      <circle cx="48.6" cy="48.6" r="2.4" fill="#f9c99a" opacity="0.8" />
      {/* hammer, diagonal */}
      <g transform="rotate(-38 50 50)">
        <rect x="47.4" y="30" width="5.2" height="44" rx="1.4" fill={`url(#${uid}-b)`} stroke="#3d2f1a" strokeWidth="0.9" />
        <rect x="46.6" y="64" width="6.8" height="2.2" fill="#33373d" />
        <rect x="46.6" y="68" width="6.8" height="2.2" fill="#33373d" />
        <path d="M33,20 h34 l3,4 v8 l-3,4 h-34 l-3,-4 v-8 Z" fill={`url(#${uid}-m)`} stroke="#0e0f11" strokeWidth="1.1" strokeLinejoin="round" />
        <rect x="45" y="20" width="10" height="16" fill={`url(#${uid}-b)`} stroke="#3d2f1a" strokeWidth="0.8" />
        <circle cx="38" cy="28" r="1.3" fill="#c3c7cc" />
        <circle cx="62" cy="28" r="1.3" fill="#c3c7cc" />
        <path d="M34,22.5 h11" stroke="#d4d8dd" strokeWidth="0.8" strokeOpacity="0.7" />
        <path d="M55,22.5 h11" stroke="#d4d8dd" strokeWidth="0.6" strokeOpacity="0.4" />
        <path d="M48.4,38 V62" stroke="#f6e9bd" strokeWidth="0.7" strokeOpacity="0.55" strokeLinecap="round" />
      </g>
      <Glaze id={`${uid}-gz`} cx={50} cy={50} r={36.5} strength={0.75} />
    </>
  );
}

// ---------------------------------------------------------------- Frost Wargs
function WargCrest({ uid }) {
  const icicles = Array.from({ length: 20 }, (_, i) => {
    const a = (i * Math.PI * 2) / 20 - Math.PI / 2;
    const len = i % 2 === 0 ? 7 : 4;
    const w = 0.12;
    const r0 = 42;
    return `M${f(50 + Math.cos(a - w) * r0)},${f(50 + Math.sin(a - w) * r0)}L${f(50 + Math.cos(a) * (r0 + len))},${f(50 + Math.sin(a) * (r0 + len))}L${f(50 + Math.cos(a + w) * r0)},${f(50 + Math.sin(a + w) * r0)}Z`;
  }).join('');
  const flake = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const x2 = 50 + Math.cos(a) * 36;
    const y2 = 52 + Math.sin(a) * 36;
    const bx = 50 + Math.cos(a) * 26;
    const by = 52 + Math.sin(a) * 26;
    const s1 = a + 0.6;
    const s2 = a - 0.6;
    return `M50,52L${f(x2)},${f(y2)}M${f(bx)},${f(by)}L${f(bx + Math.cos(s1) * 7)},${f(by + Math.sin(s1) * 7)}M${f(bx)},${f(by)}L${f(bx + Math.cos(s2) * 7)},${f(by + Math.sin(s2) * 7)}`;
  }).join('');
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-night`} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#2b4268" />
          <stop offset="1" stopColor="#0b1424" />
        </radialGradient>
        <linearGradient id={`${uid}-silver`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#eef2f5" />
          <stop offset="0.5" stopColor="#b8c6d1" />
          <stop offset="1" stopColor="#7c8fa0" />
        </linearGradient>
        <linearGradient id={`${uid}-fur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f8fa" />
          <stop offset="0.6" stopColor="#d9e2e8" />
          <stop offset="1" stopColor="#9fb0be" />
        </linearGradient>
      </defs>
      <path d={icicles} fill="#d9e2e8" opacity="0.9" />
      <circle cx="50" cy="50" r="43.6" fill="#1f3150" />
      <circle cx="50" cy="50" r="43" fill={`url(#${uid}-silver)`} />
      <Bevel id={`${uid}-rim`} cx={50} cy={50} r={41.6} width={3.4} light="#fffdf7" dark="#1f3150" />
      <circle cx="50" cy="50" r="40.5" fill="#04070d" />
      <circle cx="50" cy="50" r="39.6" fill={`url(#${uid}-night)`} />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#d9e2e8" strokeOpacity="0.45" strokeWidth="0.8" />
      <path d={flake} stroke="#b8c6d1" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* wolf head, front-facing */}
      <path
        d="M50,82 L41,74 L33,62 L29,47 L27,26 L37,37 L44,34 L50,35 L56,34 L63,37 L73,26 L71,47 L67,62 L59,74 Z"
        fill={`url(#${uid}-fur)`}
        stroke="#0b1424"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* inner ears */}
      <path d="M30.5,31 L36,38.5 L33.5,42 Z M69.5,31 L64,38.5 L66.5,42 Z" fill="#7c8fa0" />
      {/* brow + muzzle shading */}
      <path d="M50,40 L44,46 L46,62 L50,70 L54,62 L56,46 Z" fill="#eef2f5" />
      <path d="M33,50 L41,48 L44,54 L40,60 Z M67,50 L59,48 L56,54 L60,60 Z" fill="#9fb0be" opacity="0.8" />
      {/* eyes */}
      <path d="M37.5,49.5 L44.5,51 L40.5,53.5 Z M62.5,49.5 L55.5,51 L59.5,53.5 Z" fill="#ffe9ae" stroke="#0b1424" strokeWidth="0.7" />
      {/* nose */}
      <path d="M46.5,69 h7 l-3.5,4 Z" fill="#0b1424" />
      {/* scar */}
      <path d="M58,42 L64,57" stroke="#7a1f1a" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
      {/* moonlight on the brow and ear rims */}
      <path d="M27.6,27.5 L36.6,37.2 L44,34.2 L50,35.2" fill="none" stroke="#fffdf7" strokeWidth="0.8" strokeOpacity="0.85" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="41.6" cy="51" r="0.55" fill="#fffdf7" />
      <circle cx="58.4" cy="51" r="0.55" fill="#fffdf7" />
      <Glaze id={`${uid}-gz`} cx={50} cy={50} r={40.5} strength={0.7} />
    </>
  );
}

const CRESTS = {
  elvia: ElviaCrest,
  iron_syndicate: SyndicateCrest,
  frost_wargs: WargCrest,
};

const LABELS = {
  elvia: 'Crest of Elvia',
  iron_syndicate: 'Crest of the Iron Syndicate',
  frost_wargs: 'Crest of the Frost Wargs',
};

function FactionCrestImpl({ id = 'elvia', size = 48, className = '', title, style }) {
  const uid = useUid('fc');
  const Crest = CRESTS[id] || ElviaCrest;
  const label = title ?? LABELS[id];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
      role="img"
      aria-label={label}
      focusable="false"
    >
      <Crest uid={uid} />
    </svg>
  );
}

export const FactionCrest = memo(FactionCrestImpl);
export default FactionCrest;
