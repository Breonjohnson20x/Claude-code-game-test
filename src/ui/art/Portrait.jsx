// <Portrait id size mood label className />
// Painted heraldic bust portraits in one consistent style: frontal bust, key light
// from the upper right (rim light on the right edge), a deep backdrop with a
// faction-tinted glow and a bevelled, engraved gold ring. Faces are built in
// value planes (form shadow, core shadow, reflected light, highlight) with soft
// brushes, so each character reads at 40px and rewards a look at 160px.
// The painting kit and the characters live in ./portrait/.
import { memo } from 'react';
import { MOOD_TINT } from './palette.js';
import { useUid } from './util.js';
import { LG, RG, SoftFilters } from './portrait/kit.jsx';
import { Cassian, Mara, Mika, Nyra, Vale, Vex } from './portrait/people.jsx';
import { Chronicler, Skaela, Sovereign, Sparky, Unknown } from './portrait/others.jsx';

const CHARACTERS = {
  mara: Mara,
  vale: Vale,
  cassian: Cassian,
  sparky: Sparky,
  mika: Mika,
  nyra: Nyra,
  vex: Vex,
  skaela: Skaela,
  sovereign: Sovereign,
  chronicler: Chronicler,
};

export const PORTRAIT_IDS = Object.keys(CHARACTERS);

const NAMES = {
  mara: 'General Mara Voss',
  vale: 'Dr. Elias Vale',
  cassian: 'Director Cassian Rey',
  sparky: 'Sparky the acid drake',
  mika: 'Mika',
  nyra: 'Lieutenant Nyra Kell',
  vex: 'Chancellor Adrian Vex',
  skaela: 'Warg Queen Skaela',
  sovereign: 'The Sovereign',
  chronicler: 'The Chronicler',
};

// Points on the frame ring (angle in degrees, 0 = right, clockwise).
const ringPt = (deg, r = 47) => {
  const a = (deg * Math.PI) / 180;
  return [Math.round((50 + Math.cos(a) * r) * 10) / 10, Math.round((50 + Math.sin(a) * r) * 10) / 10];
};
const SPEC_A = ringPt(-78, 47.4);
const SPEC_B = ringPt(-14, 47.4);
const GLINT = ringPt(-44, 47.6);
const STUDS = [180, 0, 270].map((d) => ringPt(d, 47));

// Display utilities a caller may pass in className (e.g. "hidden sm:block" for a
// size that only shows on wider screens). An inline display would override them.
const DISPLAY_BARE = /(^|\s)(hidden|block|inline|inline-block|flex|inline-flex|grid|contents)(?=\s|$)/;
const DISPLAY_VARIANT = /(^|\s)[\w-]+:(hidden|block|inline|inline-block|flex|inline-flex|grid|contents)(?=\s|$)/;

// ---------------------------------------------------------------- component
function PortraitImpl({ id, size = 64, mood = 'neutral', label, className = '', style, ring = true }) {
  const uid = useUid('pt');
  const key = String(id ?? '').toLowerCase();
  const Char = CHARACTERS[key] || Unknown;
  const m = MOOD_TINT[mood] !== undefined ? mood : 'neutral';
  const { bg, art, glow, under, zoom = 1.12 } = Char({ uid, mood: m });
  const tint = MOOD_TINT[m];
  const aria = label === true ? NAMES[key] || 'Unknown figure' : label;
  const g = glow || '#ffe9ae';
  // Block by default; defer to the caller's display classes when it passes any.
  const bare = DISPLAY_BARE.test(className);
  const variant = !bare && DISPLAY_VARIANT.test(className);
  const cls = variant ? `block ${className}` : className;
  const display = bare || variant ? {} : { display: 'block' };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cls}
      style={{ ...display, flex: 'none', ...style }}
      role={aria ? 'img' : undefined}
      aria-label={aria || undefined}
      aria-hidden={aria ? undefined : true}
      focusable="false"
      data-portrait={CHARACTERS[key] ? key : 'unknown'}
    >
      <defs>
        <SoftFilters uid={uid} />
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="45.2" />
        </clipPath>
        <LG id={`${uid}-rimg`} x1={0.5} x2={0.68} stops={[[0, '#000'], [1, '#fff']]} />
        <mask id={`${uid}-rim`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-rimg)`} />
        </mask>
        <RG id={`${uid}-bg`} cx="64%" cy="30%" r="78%" stops={[[0, bg[0]], [0.55, bg[1], 0.85], [1, bg[1]]]} />
        <RG id={`${uid}-glow`} stops={[[0, g, 0.42], [0.45, g, 0.14], [1, g, 0]]} />
        <RG id={`${uid}-under`} stops={[[0, under || '#e0782b', 0.45], [1, under || '#e0782b', 0]]} />
        <RG id={`${uid}-key`} cx="82%" cy="12%" r="70%" stops={[[0, '#fff4d6', 0.2], [0.5, '#fff4d6', 0.05], [1, '#fff4d6', 0]]} />
        <RG id={`${uid}-vig`} cx="54%" cy="42%" r="56%" stops={[[0.62, '#04070d', 0], [0.86, '#04070d', 0.42], [1, '#04070d', 0.85]]} />
        <LG id={`${uid}-ring`} x1={0.85} y1={0} x2={0.15} y2={1} stops={[[0, '#fffaf0'], [0.18, '#f0dc95'], [0.38, '#c9a227'], [0.55, '#7d6114'], [0.72, '#a8841b'], [0.88, '#4f3d0d'], [1, '#7d6114']]} />
        <LG id={`${uid}-ring2`} x1={0.15} y1={0} x2={0.85} y2={1} stops={[[0, '#fff4d6', 0.35], [0.35, '#fff4d6', 0], [0.7, '#2a2008', 0], [1, '#2a2008', 0.45]]} />
        <LG id={`${uid}-gem`} x1={0.2} y1={0} x2={0.8} y2={1} stops={[[0, '#fffaf0'], [0.4, g], [1, '#4f3d0d']]} />
        {tint && (
          <RG
            id={`${uid}-mood`}
            cx={m === 'warm' ? '75%' : '30%'}
            cy={m === 'warm' ? '20%' : '85%'}
            r="90%"
            stops={[
              [0, tint.color, tint.op * 1.6],
              [1, tint.color, tint.op * 0.4],
            ]}
          />
        )}
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-bg)`} />
        {/* depth: a soft backlight behind the head, out-of-focus motes, a darker floor */}
        <g filter={`url(#${uid}-soft2)`}>
          <ellipse cx="57" cy="36" rx="24" ry="22" fill={`url(#${uid}-glow)`} />
          <circle cx="80" cy="30" r="3.2" fill={g} opacity="0.18" />
          <circle cx="22" cy="24" r="2.4" fill={g} opacity="0.12" />
          <circle cx="74" cy="58" r="2" fill={g} opacity="0.14" />
          <circle cx="28" cy="52" r="1.6" fill={g} opacity="0.1" />
          <ellipse cx="50" cy="104" rx="56" ry="14" fill="#04070d" opacity="0.55" />
        </g>
        <circle cx="50" cy="44" r="31" fill="none" stroke="#e3c463" strokeWidth="0.5" opacity="0.12" />
        <circle cx="50" cy="44" r="27.5" fill="none" stroke="#e3c463" strokeWidth="0.4" strokeDasharray="0.8 2.4" opacity="0.16" />
        <circle cx="68" cy="24" r="34" fill={`url(#${uid}-glow)`} opacity="0.7" />
        {under && <circle cx="30" cy="100" r="44" fill={`url(#${uid}-under)`} />}
        {/* a touch closer than the 100-unit layout: bigger faces read better at 40px */}
        <g transform={`translate(50 46) scale(${zoom}) translate(-50 -48)`}>{art}</g>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-key)`} />
        {tint && <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-mood)`} style={{ mixBlendMode: 'multiply' }} />}
        {m === 'warm' && <circle cx="72" cy="22" r="40" fill={`url(#${uid}-glow)`} opacity="0.55" />}
        {/* inner shadow of the frame */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-vig)`} />
        <circle cx="50" cy="50" r="44.6" fill="none" stroke="#04070d" strokeWidth="1.6" opacity="0.55" filter={`url(#${uid}-soft)`} />
      </g>
      {ring && (
        <g fill="none">
          {/* bevelled band: dark outer lip, polished band, engraved knurl, bright bevel edges */}
          <circle cx="50" cy="50" r="48.6" stroke="#1a1206" strokeWidth="1.8" />
          <circle cx="50" cy="50" r="47" stroke={`url(#${uid}-ring)`} strokeWidth="4" />
          <circle cx="50" cy="50" r="47" stroke={`url(#${uid}-ring2)`} strokeWidth="4" />
          <circle cx="50" cy="50" r="47" stroke="#4f3d0d" strokeWidth="1.5" strokeDasharray="0.4 1.15" opacity="0.5" />
          <circle cx="50" cy="50" r="48.75" stroke="#fbefc2" strokeWidth="0.35" opacity="0.5" />
          <circle cx="50" cy="50" r="45.45" stroke="#fff4d6" strokeWidth="0.35" opacity="0.55" />
          <circle cx="50" cy="50" r="44.95" stroke="#0b0905" strokeWidth="0.7" opacity="0.9" />
          {/* specular highlight where the key light hits the ring */}
          <path d={`M${SPEC_A[0]},${SPEC_A[1]}A47.4,47.4 0 0 1 ${SPEC_B[0]},${SPEC_B[1]}`} stroke="#fffaf0" strokeWidth="2.6" strokeLinecap="round" opacity="0.35" filter={`url(#${uid}-soft)`} />
          <path d={`M${SPEC_A[0]},${SPEC_A[1]}A47.4,47.4 0 0 1 ${SPEC_B[0]},${SPEC_B[1]}`} stroke="#fffaf0" strokeWidth="0.75" strokeLinecap="round" opacity="0.85" />
          <path d={`M${GLINT[0] - 2.2},${GLINT[1]}h4.4M${GLINT[0]},${GLINT[1] - 2.2}v4.4`} stroke="#fffaf0" strokeWidth="0.35" strokeLinecap="round" opacity="0.8" />
          <circle cx={GLINT[0]} cy={GLINT[1]} r="0.7" fill="#fffaf0" />
          {/* studs */}
          {STUDS.map(([sx, sy]) => (
            <g key={`${sx},${sy}`}>
              <circle cx={sx} cy={sy} r="1.35" fill={`url(#${uid}-ring)`} stroke="#2a2008" strokeWidth="0.4" />
              <circle cx={sx + 0.35} cy={sy - 0.35} r="0.4" fill="#fffaf0" opacity="0.85" />
            </g>
          ))}
          {/* keystone gem */}
          <path d="M50,93.6l3.1,3.1l-3.1,3.1l-3.1,-3.1Z" fill={`url(#${uid}-ring)`} stroke="#2a2008" strokeWidth="0.5" />
          <path d="M50,95.2l1.5,1.5l-1.5,1.5l-1.5,-1.5Z" fill={`url(#${uid}-gem)`} />
          <circle cx="50.5" cy="96.1" r="0.3" fill="#fffaf0" />
        </g>
      )}
    </svg>
  );
}

export const Portrait = memo(PortraitImpl);
export default Portrait;
