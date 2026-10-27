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

/** Ornate gold divider: hairlines, scroll flourishes, centre diamond. Stretches to its width. */
function GoldDividerImpl({ className = '', height = 14, style }) {
  const uid = useUid('gd');
  return (
    <svg
      viewBox="0 0 320 14"
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-l`} x1="0" x2="1">
          <stop offset="0" stopColor="#c9a227" stopOpacity="0" />
          <stop offset="0.7" stopColor="#c9a227" stopOpacity="0.8" />
          <stop offset="1" stopColor="#e3c463" />
        </linearGradient>
        <linearGradient id={`${uid}-r`} x1="1" x2="0">
          <stop offset="0" stopColor="#c9a227" stopOpacity="0" />
          <stop offset="0.7" stopColor="#c9a227" stopOpacity="0.8" />
          <stop offset="1" stopColor="#e3c463" />
        </linearGradient>
      </defs>
      <rect x="0" y="6.5" width="136" height="1" fill={`url(#${uid}-l)`} />
      <rect x="184" y="6.5" width="136" height="1" fill={`url(#${uid}-r)`} />
      <path d="M138,7 C144,1.5 150,1.5 152,7 C150,12.5 144,12.5 138,7 Z M182,7 C176,1.5 170,1.5 168,7 C170,12.5 176,12.5 182,7 Z" fill="none" stroke="#c9a227" strokeWidth="0.9" />
      <path d="M160,1 L166,7 L160,13 L154,7 Z" fill="#e3c463" stroke="#4f3d0d" strokeWidth="0.6" />
      <path d="M160,4.2 L162.8,7 L160,9.8 L157.2,7 Z" fill="#0b1424" opacity="0.6" />
    </svg>
  );
}
export const GoldDivider = memo(GoldDividerImpl);

const CORNER = (
  <>
    <path d="M1,30 V8 Q1,1 8,1 H30" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5,24 V10 Q5,5 10,5 H24" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.7" />
    <path d="M9,9 m-3,0 l3,-3 l3,3 l-3,3 Z" fill="currentColor" />
    <path d="M12,15 C16,15 17,12 17,9 M15,12 C15,16 12,17 9,17" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.8" />
  </>
);

/**
 * Gold filigree in the four corners of its positioned parent.
 * <div class="panel relative"><PanelCorners />…</div>
 */
function PanelCornersImpl({ size = 22, inset = 6, color = '#c9a227', opacity = 0.85, className = '' }) {
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
        <svg key={i} viewBox="0 0 32 32" className={className} style={{ ...base, ...p }} aria-hidden="true" focusable="false">
          {CORNER}
        </svg>
      ))}
    </>
  );
}
export const PanelCorners = memo(PanelCornersImpl);
