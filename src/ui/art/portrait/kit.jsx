// Shared painting kit for the portraits: gradients, metals, the soft-brush filter,
// procedural hair strands, rim light and cloth shading. Everything lives in the
// 100×100 portrait viewBox and is keyed by the portrait's uid so several
// portraits can share a page.
import { strands } from './geometry.js';

export function LG({ id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 0 }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  );
}

export function RG({ id, stops, cx = '50%', cy = '50%', r = '50%', fx, fy, units }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx} fy={fy} gradientUnits={units}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </radialGradient>
  );
}

/** 3-tone side-lit fill: shadow on the left, light on the right (key light upper right). */
export function Lit3({ id, c: [shade, base, light], hard = false }) {
  return (
    <LG
      id={id}
      x2={1}
      y2={0.22}
      stops={hard ? [[0, shade], [0.47, shade], [0.55, base], [1, light]] : [[0, shade], [0.34, shade], [0.64, base], [1, light]]}
    />
  );
}

/** Diagonal fill for hair and fur: deep at the lower left, lit at the upper right. */
export function Diag3({ id, c: [deep, base, light] }) {
  return <LG id={id} x1={0.05} y1={0.95} x2={0.95} y2={0.1} stops={[[0, deep], [0.42, base], [0.8, light], [1, light]]} />;
}

// Polished metals: banded stops read as a reflection of the room, not a flat fill.
const METALS = {
  gold: ['#fffaf0', '#f0dc95', '#c9a227', '#7d6114', '#e3c463', '#4f3d0d'],
  brass: ['#fff4d6', '#d6b47a', '#b08d57', '#5a4426', '#c9a46a', '#3d2f1a'],
  iron: ['#eef2f5', '#c3c7cc', '#5d636b', '#1b1d21', '#9aa0a8', '#33373d'],
  silver: ['#fffaf0', '#d9e2e8', '#8f929a', '#383d48', '#b5b6ba', '#2a2f3a'],
};
export function Metal({ id, kind = 'gold', x1 = 0.85, y1 = 0, x2 = 0.2, y2 = 1 }) {
  const [hi, light, base, dark, bounce, deep] = METALS[kind] || METALS.gold;
  return (
    <LG
      id={id}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stops={[
        [0, hi],
        [0.16, light],
        [0.42, base],
        [0.6, dark],
        [0.78, bounce],
        [1, deep],
      ]}
    />
  );
}

/**
 * The one soft-brush filter, in user space so the softness scales with the portrait size.
 * Only the skin planes of a human face use it; everything else is feathered with
 * gradients, so a page of a dozen portraits pays for at most one blur each.
 */
export function SoftFilters({ uid }) {
  return (
    <filter id={`${uid}-soft`} x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation="1.15" />
    </filter>
  );
}

/**
 * Painted hair (or fur) mass: diagonal fill, strand groups clipped to the shape and a soft
 * sheen band where the key light lands.
 */
export function Hair({ uid, name, d, tones, fan, sheen, sheenW = 1.8, w = 0.32, sheenOp = 0.6, edge, so = 1 }) {
  const [deep, base, light, glint] = tones;
  const [dk, lt] = fan ? strands(fan) : ['', ''];
  const cid = `${uid}-hr${name}c`;
  return (
    <>
      <defs>
        <clipPath id={cid}>
          <path d={d} />
        </clipPath>
        <Diag3 id={`${uid}-hr${name}g`} c={[deep, base, light]} />
      </defs>
      <path d={d} fill={`url(#${uid}-hr${name}g)`} />
      <g clipPath={`url(#${cid})`} fill="none" strokeLinecap="round">
        {dk && <path d={dk} stroke={deep} strokeWidth={w * 1.3} opacity={0.42 * so} />}
        {lt && <path d={lt} stroke={light} strokeWidth={w} opacity={0.36 * so} />}
        {sheen && <path d={sheen} stroke={glint || light} strokeWidth={sheenW * 1.6} opacity={sheenOp * 0.18} />}
        {sheen && <path d={sheen} stroke={glint || light} strokeWidth={sheenW * 0.8} opacity={sheenOp * 0.32} />}
        {sheen && <path d={sheen} stroke={glint || light} strokeWidth={sheenW * 0.3} opacity={sheenOp * 0.9} />}
      </g>
      {edge && <path d={d} fill="none" stroke={edge} strokeWidth="0.35" opacity="0.5" />}
    </>
  );
}

/** Ember bounce from below-left on the shadow edge of a shape: the counterpart of Rim. */
export function Bounce({ uid, d, color = '#e0782b', op = 0.45, w = 1.4 }) {
  return (
    <g mask={`url(#${uid}-rimL)`} fill="none" strokeLinejoin="round">
      <path d={d} stroke={color} strokeOpacity={op * 0.25} strokeWidth={w * 2.2} />
      <path d={d} stroke={color} strokeOpacity={op * 0.7} strokeWidth={w * 0.6} />
    </g>
  );
}

/** Rim light on the right edge of a shape: a soft bloom plus a crisp line, faded in across the middle. */
export function Rim({ uid, d, color = '#fff3d0', op = 0.55, w = 1.2 }) {
  return (
    <g mask={`url(#${uid}-rim)`} fill="none" strokeLinejoin="round">
      <path d={d} stroke={color} strokeOpacity={op * 0.14} strokeWidth={w * 2.4} />
      <path d={d} stroke={color} strokeOpacity={op * 0.22} strokeWidth={w * 1.3} />
      <path d={d} stroke={color} strokeOpacity={op * 0.9} strokeWidth={w * 0.55} />
    </g>
  );
}

/**
 * Cloth shading for the bust: clip to the garment and paint soft form shadow on the left,
 * the cast shadow of the head and neck, and a key-light sheen on the right shoulder.
 * The soft shapes are pre-feathered radial gradients, so no blur filter is needed.
 */
export function ClothShade({ uid, name, d, deep = '#04070d', light = '#fff4d6', neckY = 72, op = 1, folds }) {
  const cid = `${uid}-cs${name}`;
  return (
    <>
      <defs>
        <clipPath id={cid}>
          <path d={d} />
        </clipPath>
        <RG id={`${cid}d`} stops={[[0, deep, 0.6 * op], [0.55, deep, 0.4 * op], [1, deep, 0]]} />
        <RG id={`${cid}l`} stops={[[0, light, 0.3 * op], [0.55, light, 0.16 * op], [1, light, 0]]} />
      </defs>
      <g clipPath={`url(#${cid})`}>
        <ellipse cx="14" cy="100" rx="36" ry="32" fill={`url(#${cid}d)`} />
        <ellipse cx="47" cy={neckY + 1} rx="17" ry="7" fill={`url(#${cid}d)`} />
        <ellipse cx="78" cy={neckY + 6} rx="17" ry="8" fill={`url(#${cid}l)`} />
        {folds && (
          <g fill="none" strokeLinecap="round">
            <path d={folds} stroke={deep} strokeWidth="2.6" opacity={0.12 * op} />
            <path d={folds} stroke={deep} strokeWidth="1.2" opacity={0.3 * op} />
            <path d={folds} stroke={light} strokeWidth="0.35" opacity={0.18 * op} transform="translate(0.9 -0.3)" />
          </g>
        )}
      </g>
    </>
  );
}
