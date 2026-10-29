import { memo } from 'react';
import { useUid } from './util.js';

// Small ornamental helpers: sigils, an ornate gold divider, panel corner filigree.

const SIGILS = {
  diamond: (
    <>
      <path d="M12,2 L22,12 L12,22 L2,12 Z" fill="currentColor" />
      <path d="M12,6.5 L17.5,12 L12,17.5 L6.5,12 Z" fill="#0b1424" opacity="0.55" />
      <path d="M12,9 L15,12 L12,15 L9,12 Z" fill="currentColor" />
    </>
  ),
  star: <path d="M12,1.5 C12.9,9 15,11.1 22.5,12 C15,12.9 12.9,15 12,22.5 C11.1,15 9,12.9 1.5,12 C9,11.1 11.1,9 12,1.5Z" fill="currentColor" />,
  crown: (
    <>
      <path d="M3,17 L4.5,7 L9,11.5 L12,4.5 L15,11.5 L19.5,7 L21,17 Z" fill="currentColor" />
      <rect x="3" y="17.5" width="18" height="3" rx="0.8" fill="currentColor" />
    </>
  ),
  ward: (
    <>
      <path d="M12,2 L21,6 V12 C21,17 17,20.5 12,22 C7,20.5 3,17 3,12 V6 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12,7 L13.4,10.6 L17,12 L13.4,13.4 L12,17 L10.6,13.4 L7,12 L10.6,10.6 Z" fill="currentColor" />
    </>
  ),
  ember: <path d="M12,2 C14,7 19,9 18,15 C17.4,19 14.8,22 12,22 C9.2,22 6.6,19 6,15 C5.4,11.5 8,10 9,7 C10.5,9 11,10 12.2,10.4 C12.6,7.5 12,5 12,2Z" fill="currentColor" />,
  quill: (
    <>
      <path d="M20.5,2.5 C13,4 7.5,9.5 5.5,17 L7,18.5 C14.5,16.5 20,11 21.5,3.5 Z" fill="currentColor" />
      <path d="M5.5,17 L2.5,21.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  sword: (
    <>
      <path d="M12,1.5 L13.6,4 V15 H10.4 V4 Z" fill="currentColor" />
      <rect x="6.5" y="15" width="11" height="2" rx="1" fill="currentColor" />
      <rect x="11" y="17" width="2" height="4" fill="currentColor" />
      <circle cx="12" cy="22" r="1.5" fill="currentColor" />
    </>
  ),
};

/** Tiny ornamental glyph. name: diamond | star | crown | ward | ember | quill | sword */
function SigilImpl({ name = 'diamond', size = 16, className = '', color, title, style }) {
  const glyph = SIGILS[name] || SIGILS.diamond;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', color: color || undefined, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {glyph}
    </svg>
  );
}
export const Sigil = memo(SigilImpl);

/** Ornate gold divider: tapered brass rails, scroll flourishes and a set jewel. Stretches to its width
 *  (the rails stretch; the centre ornament keeps its proportions at any width). */
function GoldDividerImpl({ className = '', height = 14, style }) {
  const uid = useUid('gd');
  const w = Math.round((height / 14) * 76);
  // a rail tapers to a point at its outer end; a 1px dark line under it engraves it into the surface
  const rail = (dir) => ({
    flex: '1 1 0',
    minWidth: 0,
    height: Math.max(2, height * 0.2),
    background: `linear-gradient(${dir}, rgb(201 162 39 / 0) 0%, rgb(201 162 39 / 0.7) 55%, #f0dc95 100%)`,
    clipPath: dir === '90deg' ? 'polygon(0 50%, 100% 0, 100% 100%)' : 'polygon(0 0, 100% 50%, 0 100%)',
    filter: 'drop-shadow(0 1px 0 rgb(0 0 0 / 0.55))',
  });
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', width: '100%', height, ...style }} aria-hidden="true">
      <span style={rail('90deg')} />
      <svg viewBox="0 0 76 14" width={w} height={height} style={{ display: 'block', flex: 'none', overflow: 'visible' }} focusable="false">
        <defs>
          <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbefc2" />
            <stop offset="0.45" stopColor="#e3c463" />
            <stop offset="1" stopColor="#7d6114" />
          </linearGradient>
          <radialGradient id={`${uid}-j`} cx="0.42" cy="0.36" r="0.7">
            <stop offset="0" stopColor="#f9c99a" />
            <stop offset="0.35" stopColor="#e0782b" />
            <stop offset="1" stopColor="#8a3a1c" />
          </radialGradient>
        </defs>
        {/* scroll flourishes */}
        <path d="M1,7 H14 C18,7 19,2.6 23,2.6 C26.4,2.6 27.6,5.6 25.6,7 C27.6,8.4 26.4,11.4 23,11.4 C19,11.4 18,7 14,7" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="1" strokeLinecap="round" />
        <path d="M75,7 H62 C58,7 57,2.6 53,2.6 C49.6,2.6 48.4,5.6 50.4,7 C48.4,8.4 49.6,11.4 53,11.4 C57,11.4 58,7 62,7" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="1" strokeLinecap="round" />
        <circle cx="30" cy="7" r="1.15" fill="#e3c463" />
        <circle cx="46" cy="7" r="1.15" fill="#e3c463" />
        {/* the jewel: a gold collet with an ember stone, facets catching the light */}
        <path d="M38,0.2 L44.8,7 L38,13.8 L31.2,7 Z" fill={`url(#${uid}-m)`} stroke="#4f3d0d" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M38,3 L42,7 L38,11 L34,7 Z" fill={`url(#${uid}-j)`} stroke="#4f3d0d" strokeWidth="0.5" />
        <path d="M38,3 L42,7 L38,7 Z" fill="#fff4d6" opacity="0.35" />
        <path d="M34,7 L38,11 L38,7 Z" fill="#1f1810" opacity="0.25" />
        <path d="M33.2,6.2 L37.2,2.2" stroke="#fffaf0" strokeWidth="0.6" strokeLinecap="round" opacity="0.8" />
      </svg>
      <span style={rail('270deg')} />
    </div>
  );
}
export const GoldDivider = memo(GoldDividerImpl);

const CORNER = (uid) => (
  <>
    {/* outer bracket following the panel radius */}
    <path d="M1.5,31 V9 Q1.5,1.5 9,1.5 H31" fill="none" stroke={`url(#${uid})`} strokeWidth="1.5" strokeLinecap="round" />
    {/* inner fine line */}
    <path d="M5.5,25 V11 Q5.5,5.5 11,5.5 H25" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.65" />
    {/* acanthus scroll */}
    <path d="M9.5,20 C9.5,13.5 13.5,9.5 20,9.5 M14,9.6 C14.6,12.6 12.6,14.6 9.6,14" fill="none" stroke="currentColor" strokeWidth="0.85" strokeLinecap="round" opacity="0.9" />
    <path d="M20,9.5 C22.5,9.5 23.5,11 22.6,12.2 C21.8,13.2 20.3,12.5 20.6,11.3 M9.5,20 C9.5,22.5 11,23.5 12.2,22.6 C13.2,21.8 12.5,20.3 11.3,20.6" fill="none" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.85" />
    {/* set stone on the corner */}
    <path d="M6.4,2.6 L10.2,6.4 L6.4,10.2 L2.6,6.4 Z" fill={`url(#${uid})`} stroke="#1f1810" strokeOpacity="0.6" strokeWidth="0.6" />
    <path d="M6.4,4.8 L8,6.4 L6.4,8 L4.8,6.4 Z" fill="#1f1810" opacity="0.45" />
    <circle cx="1.5" cy="31" r="1" fill="currentColor" />
    <circle cx="31" cy="1.5" r="1" fill="currentColor" />
  </>
);

/**
 * Gold filigree in the four corners of its positioned parent.
 * <div class="panel relative"><PanelCorners />…</div>
 */
function PanelCornersImpl({ size = 22, inset = 6, color = '#c9a227', opacity = 0.85, className = '' }) {
  const uid = useUid('pc');
  const base = { position: 'absolute', width: size, height: size, color, opacity, pointerEvents: 'none' };
  const pos = [
    { top: inset, left: inset },
    { top: inset, right: inset, transform: 'scaleX(-1)' },
    { bottom: inset, left: inset, transform: 'scaleY(-1)' },
    { bottom: inset, right: inset, transform: 'scale(-1,-1)' },
  ];
  return (
    <>
      {pos.map((p, i) => (
        <svg key={i} viewBox="0 0 32 32" className={`panel-corners ${className}`.trim()} style={{ ...base, ...p }} aria-hidden="true" focusable="false">
          <defs>
            {/* metal: a light catch travels along the bracket */}
            <linearGradient id={`${uid}-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={color} />
              <stop offset="0.22" stopColor="#f0dc95" stopOpacity="0.9" />
              <stop offset="0.45" stopColor={color} />
              <stop offset="1" stopColor={color} stopOpacity="0.65" />
            </linearGradient>
          </defs>
          {CORNER(`${uid}-${i}`)}
        </svg>
      ))}
    </>
  );
}
export const PanelCorners = memo(PanelCornersImpl);
