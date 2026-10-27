import { memo } from 'react';
import { useReducedMotion, useUid } from './util.js';

// The recurring mystery: a broken circle surrounding a small star.
// Deliberately unexplained. Drawn as if cut into stone and lit from within.

const CX = 50;
const CY = 50;
const R = 33;
// gap centred at ~1 o'clock
const GAP_START = -78; // degrees, 0 = 3 o'clock, clockwise positive (SVG)
const GAP_END = -38;

function pt(deg, r = R) {
  const a = (deg * Math.PI) / 180;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}

const [ax, ay] = pt(GAP_END);
const [bx, by] = pt(GAP_START + 360);
// large arc going the long way round from the end of the gap to its start
const ARC = `M${ax.toFixed(2)},${ay.toFixed(2)}A${R},${R} 0 1 1 ${bx.toFixed(2)},${by.toFixed(2)}`;

// four-pointed star, slightly taller than wide
const STAR =
  'M50,38.5 C51.1,45.6 52.4,47.6 58.6,50 C52.4,52.4 51.1,54.4 50,61.5 C48.9,54.4 47.6,52.4 41.4,50 C47.6,47.6 48.9,45.6 50,38.5Z';

// faint notches along the ring — reads as ancient engineering, not decoration
const TICKS = Array.from({ length: 24 }, (_, i) => i * 15)
  .filter((d) => {
    const n = ((d + 180) % 360) - 180;
    return !(n > GAP_START - 6 && n < GAP_END + 6);
  })
  .map((d) => {
    const [x1, y1] = pt(d, R + 5.5);
    const [x2, y2] = pt(d, R + 8);
    return `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
  })
  .join('');

function ArchitectSymbolImpl({
  size = 64,
  glow = true,
  animated = false,
  color = '#fff4d6',
  ticks = true,
  className = '',
  title,
  style,
}) {
  const uid = useUid('as');
  const reduced = useReducedMotion();
  const animate = animated && !reduced;
  const g = glow === true ? 1 : glow === false ? 0 : Math.max(0, Math.min(1, Number(glow) || 0));
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-bloom`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffaf0" stopOpacity={0.9} />
          <stop offset="22%" stopColor="#ffe9ae" stopOpacity={0.55} />
          <stop offset="55%" stopColor="#e3c463" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#e3c463" stopOpacity={0} />
        </radialGradient>
        {g > 0 && (
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        )}
      </defs>

      {g > 0 && (
        <g opacity={g}>
          <circle cx={CX} cy={CY} r={49} fill={`url(#${uid}-bloom)`}>
            {animate && (
              <animate attributeName="opacity" values="0.55;1;0.55" dur="5.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
            )}
          </circle>
          <g filter={`url(#${uid}-soft)`} stroke="#ffe9ae" fill="none" opacity={0.85}>
            <path d={ARC} strokeWidth={6} />
            <path d={STAR} fill="#ffe9ae" stroke="none" />
          </g>
        </g>
      )}

      <g transform="translate(50 50)">
        {animate && (
          <animateTransform attributeName="transform" type="scale" additive="sum" values="1;1.03;1" dur="5.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
        )}
        <g transform="translate(-50 -50)">
          {ticks && <path d={TICKS} stroke={color} strokeWidth={1.4} opacity={0.38} strokeLinecap="round" />}
          <path d={ARC} stroke={color} strokeWidth={4.2} fill="none" strokeLinecap="butt" />
          <path d={ARC} stroke="#fffdf7" strokeWidth={1.1} fill="none" opacity={0.7} />
          <path d={STAR} fill={color} />
          <circle cx={CX} cy={CY} r={1.6} fill="#fffdf7" />
        </g>
      </g>
    </svg>
  );
}

export const ArchitectSymbol = memo(ArchitectSymbolImpl);
export default ArchitectSymbol;
