// Ornate presentation pieces shared by the War Room, the Resolution report, the Passing and the
// title: engraved letter medallions and filigree rules. Decorative only (aria-hidden); no game
// logic. Category tones live in tones.js; light shafts and motes in src/ui/art/Atmosphere.jsx.

import { memo } from 'react';
import { useUid } from '../../art/util.js';
import { cx } from '../../kit/kit.jsx';
import { CATEGORY_TONE } from './tones.js';

// ------------------------------------------------------------------ medallion
const KNURL = (() => {
  let d = '';
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const r0 = 45.2;
    const r1 = i % 4 === 0 ? 41.6 : 43.4;
    d += `M${(50 + Math.cos(a) * r0).toFixed(2)},${(50 + Math.sin(a) * r0).toFixed(2)}L${(50 + Math.cos(a) * r1).toFixed(2)},${(50 + Math.sin(a) * r1).toFixed(2)}`;
  }
  return d;
})();

/**
 * A struck brass medallion with an engraved letter (order keys A–E, step numerals).
 * `tone` is a CATEGORY_TONE entry (accent ring); `lit` brightens it for the selected state.
 */
export const Medallion = memo(function Medallion({ letter, size = 60, tone = CATEGORY_TONE.diplomacy, lit = false, dim = false, className }) {
  const id = useUid('md');
  const fs = String(letter).length > 2 ? 26 : String(letter).length > 1 ? 32 : 40;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cx('shrink-0 overflow-visible', className)}
      style={{ filter: dim ? 'saturate(0.35) brightness(0.75)' : undefined }}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fbefc2" />
          <stop offset="0.28" stopColor="#e3c463" />
          <stop offset="0.6" stopColor="#a8841b" />
          <stop offset="1" stopColor="#4f3d0d" />
        </linearGradient>
        <linearGradient id={`${id}-rim2`} x1="0.85" y1="1" x2="0.15" y2="0">
          <stop offset="0" stopColor="#f6e9bd" />
          <stop offset="0.45" stopColor="#a8841b" />
          <stop offset="1" stopColor="#4f3d0d" />
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={lit ? '#2b4268' : '#1f3150'} />
          <stop offset="0.6" stopColor="#0f1b2d" />
          <stop offset="1" stopColor="#070d18" />
        </radialGradient>
        <linearGradient id={`${id}-letter`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.42" stopColor="#f0dc95" />
          <stop offset="1" stopColor="#a8841b" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor={`rgb(${tone.glow})`} stopOpacity="0.55" />
          <stop offset="1" stopColor={`rgb(${tone.glow})`} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit ? <circle cx="50" cy="50" r="62" fill={`url(#${id}-glow)`} /> : null}
      {/* cast shadow */}
      <circle cx="51.5" cy="54" r="47" fill="#000" opacity="0.5" />
      {/* rim, knurled edge, bevel */}
      <circle cx="50" cy="50" r="47" fill={`url(#${id}-rim)`} />
      <path d={KNURL} stroke="#4f3d0d" strokeWidth="1.1" opacity="0.55" />
      <circle cx="50" cy="50" r="40.5" fill={`url(#${id}-rim2)`} />
      {/* category accent ring */}
      <circle cx="50" cy="50" r="38.2" fill="none" stroke={tone.accent} strokeWidth="2.2" opacity={lit ? 1 : 0.75} />
      {/* enamel field */}
      <circle cx="50" cy="50" r="36" fill={`url(#${id}-field)`} />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#c9a227" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="1 2.6" />
      {/* engraved letter: shadow, then a gilt face, then a top highlight */}
      <text x="50" y="51" dy="0.35em" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize={fs} fill="#000" opacity="0.75" transform="translate(0.8 1.6)">
        {letter}
      </text>
      <text x="50" y="51" dy="0.35em" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize={fs} fill={`url(#${id}-letter)`} stroke="#4f3d0d" strokeWidth="0.6">
        {letter}
      </text>
      {/* specular sweep on the rim (key light upper right) */}
      <path d="M62 8.5a42 42 0 0 1 29 30" fill="none" stroke="#fffaf0" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 70a42 42 0 0 0 12 14" fill="none" stroke="#fffaf0" strokeOpacity="0.2" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
});

// ------------------------------------------------------------------ filigree rule
/** A gilt hairline with a lozenge and scroll curls. Decorative, stretches to its box. */
export function Filigree({ className, color = '#c9a227', center = true }) {
  return (
    <div className={cx('flex items-center gap-2', className)} aria-hidden="true">
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${color}aa)` }} />
      {center ? (
        <svg width="74" height="14" viewBox="0 0 74 14" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round">
          <path d="M2 7h14c4 0 5-4 8-4s3 3 1 4-3 0-3-1" opacity="0.8" />
          <path d="M72 7H58c-4 0-5-4-8-4s-3 3-1 4 3 0 3-1" opacity="0.8" />
          <path d="M37 1.5 42.5 7 37 12.5 31.5 7Z" fill={color} fillOpacity="0.85" stroke="#fbefc2" strokeOpacity="0.6" strokeWidth="0.6" />
          <circle cx="27.5" cy="7" r="1.1" fill={color} stroke="none" />
          <circle cx="46.5" cy="7" r="1.1" fill={color} stroke="none" />
        </svg>
      ) : null}
      <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${color}aa)` }} />
    </div>
  );
}


/**
 * The rule under a page title: a gilt lozenge and a short double hairline at the title's left edge,
 * then a single hairline that runs the full width of the title block and fades out.
 */
export function TitleRule({ className, color = '#c9a227' }) {
  return (
    <div className={cx('flex items-center', className)} aria-hidden="true">
      <svg width="58" height="14" viewBox="0 0 58 14" fill="none" className="shrink-0" focusable="false">
        <path d="M6.5 1.5 12 7 6.5 12.5 1 7Z" fill={color} stroke="#fbefc2" strokeOpacity="0.55" strokeWidth="0.6" />
        <path d="M15 7h43" stroke={color} strokeWidth="1" />
        <path d="M15 10h26" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
        <circle cx="15.5" cy="7" r="1.3" fill="#e3c463" />
      </svg>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}55 45%, transparent)` }} />
    </div>
  );
}
