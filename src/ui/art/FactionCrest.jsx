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
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.6" stopColor="#ffe9ae" />
          <stop offset="1" stopColor="#e3c463" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="44" fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="52" r="41" fill="#0b1424" />
      <circle cx="50" cy="52" r="39.5" fill={`url(#${uid}-field)`} />
      <circle cx="50" cy="52" r="39.5" fill="none" stroke="#c9a227" strokeOpacity="0.5" strokeWidth="0.8" />
      {/* arcane circle */}
      <circle cx="50" cy="56" r="27" fill="none" stroke="#e3c463" strokeWidth="1.2" strokeOpacity="0.85" />
      <circle cx="50" cy="56" r="24.5" fill="none" stroke="#e3c463" strokeWidth="0.6" strokeDasharray="1.2 2.2" strokeOpacity="0.8" />
      <path d={starPoints(50, 56, 4, 27, 11, -Math.PI / 4)} fill="none" stroke="#e3c463" strokeWidth="0.6" strokeOpacity="0.55" />
      {/* sun */}
      <path d={rays} fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="56" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="56" r="8" fill={`url(#${uid}-core)`} />
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
          <stop offset="0" stopColor="#a7adb5" />
          <stop offset="0.45" stopColor="#5d636b" />
          <stop offset="1" stopColor="#25282d" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6c890" />
          <stop offset="0.5" stopColor="#b08d57" />
          <stop offset="1" stopColor="#6a5230" />
        </linearGradient>
        <radialGradient id={`${uid}-heat`} cx="50%" cy="58%" r="50%">
          <stop offset="0" stopColor="#e0782b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1b1d21" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={gearPath(50, 50, 12, 47, 39, 0.46)} fill={`url(#${uid}-m)`} stroke="#15171a" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="36.5" fill="#1b1d21" stroke="#0e0f11" strokeWidth="1" />
      <circle cx="50" cy="50" r="36.5" fill={`url(#${uid}-heat)`} />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#b08d57" strokeWidth="1" strokeOpacity="0.75" />
      {rivets.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="1.9" fill="#3b3f45" />
          <circle cx={x - 0.45} cy={y - 0.45} r="0.85" fill="#c3c7cc" />
        </g>
      ))}
      {/* inner cog behind hammer */}
      <path d={gearPath(50, 50, 8, 21, 16.5, 0.5)} fill="#33373d" stroke="#0e0f11" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="7.5" fill="#1b1d21" stroke="#b08d57" strokeWidth="0.9" />
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
      </g>
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
        <linearGradient id={`${uid}-fur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f8fa" />
          <stop offset="0.6" stopColor="#d9e2e8" />
          <stop offset="1" stopColor="#9fb0be" />
        </linearGradient>
      </defs>
      <path d={icicles} fill="#d9e2e8" opacity="0.9" />
      <circle cx="50" cy="50" r="43" fill="#b8c6d1" />
      <circle cx="50" cy="50" r="40.5" fill={`url(#${uid}-night)`} />
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
