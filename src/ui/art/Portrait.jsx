// <Portrait id size mood label className />
// Painted heraldic bust portraits in one consistent style: frontal bust, key light
// from the upper right (rim light on the right edge), a warm ember bounce on the
// shadow side, a deep backdrop with a faction-tinted glow behind the head and a
// bevelled, engraved gold ring. Faces are built in value planes (form shadow, core
// shadow, reflected light, highlight) with soft brushes, so each character reads at
// 40px and rewards a look at 160px. The painting kit and the characters live in
// ./portrait/.
//
// Level of detail by rendered size:
//   >= 64px  the full jewel ring (knurl, studs, glint, keystone gem), art zoom as authored
//   < 64px   a thin polished band, no knurl or studs, art zoomed in so the head fills the disc
//   <= 34px  a tight head crop with a brass hairline and no backdrop motes
// Moods tint the backdrop only; the face carries the mood through brows, eyes and mouth.
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
const arc = (r, a0 = -78, a1 = -14) => {
  const [ax, ay] = ringPt(a0, r);
  const [bx, by] = ringPt(a1, r);
  return `M${ax},${ay}A${r},${r} 0 0 1 ${bx},${by}`;
};
const SPEC = arc(47.4);
const SPEC_THIN = arc(48.1);
const GLINT = ringPt(-44, 47.6);
const STUDS = [180, 0, 270].map((d) => ringPt(d, 47));
// out-of-focus motes in the backdrop: [cx, cy, r, opacity]
const MOTES = [
  [80, 30, 4.2, 0.2],
  [22, 24, 3.2, 0.14],
  [74, 58, 2.8, 0.15],
  [28, 52, 2.4, 0.11],
];

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
  const { bg, art, glow, under, zoom = 1.12, focus = 44, halo = 0.42 } = Char({ uid, mood: m });
  const tint = MOOD_TINT[m];
  const aria = label === true ? NAMES[key] || 'Unknown figure' : label;
  const g = glow || '#ffe9ae';
  const px = Number(size) || 64;
  const full = px >= 64;
  const tiny = px <= 34;
  // closer framing as the portrait gets smaller, centred on the character's head
  const z = tiny ? zoom * 1.42 : full ? zoom : zoom * 1.12;
  const fy = tiny ? focus : full ? 48 : (48 + focus) / 2;
  const clipR = ring ? (full ? 45.2 : 46.6) : 49.6;
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
          <circle cx="50" cy="50" r={clipR} />
        </clipPath>
        <LG id={`${uid}-rimg`} x1={0.5} x2={0.68} stops={[[0, '#000'], [1, '#fff']]} />
        <mask id={`${uid}-rim`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-rimg)`} />
        </mask>
        <LG id={`${uid}-rimgl`} x1={0.46} x2={0.3} stops={[[0, '#000'], [1, '#fff']]} />
        <mask id={`${uid}-rimL`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-rimgl)`} />
        </mask>
        <RG id={`${uid}-bg`} cx="64%" cy="30%" r="78%" stops={[[0, bg[0]], [0.55, bg[1], 0.85], [1, bg[1]]]} />
        <RG id={`${uid}-glow`} stops={[[0, g, 0.42], [0.45, g, 0.14], [1, g, 0]]} />
        {/* the backlight behind the head: a soft, pre-feathered pool (no blur filter) */}
        <RG id={`${uid}-halo`} stops={[[0, g, halo], [0.35, g, halo * 0.55], [0.7, g, halo * 0.16], [1, g, 0]]} />
        <RG id={`${uid}-mote`} stops={[[0, g, 1], [0.45, g, 0.55], [1, g, 0]]} />
        <RG id={`${uid}-floor`} stops={[[0, '#04070d', 0.6], [0.6, '#04070d', 0.35], [1, '#04070d', 0]]} />
        <RG id={`${uid}-under`} stops={[[0, under || '#e0782b', 0.45], [1, under || '#e0782b', 0]]} />
        <RG id={`${uid}-key`} cx="82%" cy="12%" r="70%" stops={[[0, '#fff4d6', 0.2], [0.5, '#fff4d6', 0.05], [1, '#fff4d6', 0]]} />
        <RG
          id={`${uid}-vig`}
          cx="50%"
          cy="50%"
          r="50%"
          stops={
            tiny
              ? [[0.8, '#04070d', 0], [1, '#04070d', 0.5]]
              : [[0.66, '#04070d', 0], [0.86, '#04070d', 0.34], [0.95, '#04070d', 0.62], [1, '#04070d', 0.9]]
          }
        />
        <LG id={`${uid}-ring`} x1={0.85} y1={0} x2={0.15} y2={1} stops={[[0, '#fffaf0'], [0.18, '#f0dc95'], [0.38, '#c9a227'], [0.55, '#7d6114'], [0.72, '#a8841b'], [0.88, '#4f3d0d'], [1, '#7d6114']]} />
        <LG id={`${uid}-ring2`} x1={0.15} y1={0} x2={0.85} y2={1} stops={[[0, '#fff4d6', 0.35], [0.35, '#fff4d6', 0], [0.7, '#2a2008', 0], [1, '#2a2008', 0.45]]} />
        {full && ring && <LG id={`${uid}-gem`} x1={0.2} y1={0} x2={0.8} y2={1} stops={[[0, '#fffaf0'], [0.4, g], [1, '#4f3d0d']]} />}
        {tint && (
          <RG
            id={`${uid}-mood`}
            cx={m === 'warm' ? '75%' : '50%'}
            cy={m === 'warm' ? '20%' : '40%'}
            r="80%"
            stops={[
              [0, tint.color, tint.op * (m === 'warm' ? 1.6 : 0.6)],
              [0.6, tint.color, tint.op * 1.6],
              [1, tint.color, tint.op * 2.4],
            ]}
          />
        )}
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-bg)`} />
        {/* the mood colours the room, never the skin */}
        {tint && <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-mood)`} style={{ mixBlendMode: 'multiply' }} />}
        {/* depth: a soft backlight behind the head, out-of-focus motes, a darker floor */}
        <ellipse cx="55" cy={focus - 6} rx="34" ry="32" fill={`url(#${uid}-halo)`} />
        {!tiny && MOTES.map(([cx, cy, r, op]) => <circle key={cx} cx={cx} cy={cy} r={r} fill={`url(#${uid}-mote)`} opacity={op} />)}
        <ellipse cx="50" cy="104" rx="62" ry="20" fill={`url(#${uid}-floor)`} />
        {!tiny && (
          <>
            <circle cx="50" cy="44" r="31" fill="none" stroke="#e3c463" strokeWidth="0.5" opacity="0.12" />
            <circle cx="50" cy="44" r="27.5" fill="none" stroke="#e3c463" strokeWidth="0.4" strokeDasharray="0.8 2.4" opacity="0.16" />
          </>
        )}
        <circle cx="68" cy="24" r="34" fill={`url(#${uid}-glow)`} opacity={m === 'warm' ? 1 : 0.7} />
        {under && <circle cx="30" cy="100" r="44" fill={`url(#${uid}-under)`} />}
        {/* a touch closer than the 100-unit layout: bigger faces read better at 40px */}
        <g transform={`translate(50 ${tiny ? 50 : 46}) scale(${z}) translate(-50 -${fy})`}>{art}</g>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-key)`} />
        {/* inner shadow of the frame */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-vig)`} />
      </g>
      {ring && full && (
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
          <path d={SPEC} stroke="#fffaf0" strokeWidth="2.6" strokeLinecap="round" opacity="0.14" />
          <path d={SPEC} stroke="#fffaf0" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
          <path d={SPEC} stroke="#fffaf0" strokeWidth="0.75" strokeLinecap="round" opacity="0.85" />
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
      {ring && !full && (
        <g fill="none">
          {/* small sizes: one clean polished band, so the frame never competes with the face */}
          <circle cx="50" cy="50" r="48.1" stroke="#1a1206" strokeWidth="3.6" />
          <circle cx="50" cy="50" r="48.1" stroke={`url(#${uid}-ring)`} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="48.1" stroke={`url(#${uid}-ring2)`} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="46.75" stroke="#0b0905" strokeWidth="0.6" opacity="0.8" />
          <path d={SPEC_THIN} stroke="#fffaf0" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
        </g>
      )}
      {!ring && (
        // no ring: a brass hairline about one device pixel wide keeps the disc off the card
        <circle cx="50" cy="50" r={49.6 - 50 / px} fill="none" stroke="#b08d57" strokeWidth={Math.max(0.5, 100 / px)} opacity="0.75" />
      )}
    </svg>
  );
}

export const Portrait = memo(PortraitImpl);
export default Portrait;
