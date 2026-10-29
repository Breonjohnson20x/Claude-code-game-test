// Shared presentation components for the War Room and the Resolution report.
// Pure presentation: glyphs, the page frame, the Crown's seal. No game logic lives here.

import { Icon } from '../../kit/icons.jsx';
import { cx } from '../../kit/kit.jsx';

/** The full-height page frame both screens share (wider than kit Screen, for two columns). */
export function ScreenShell({ backdrop, children, labelledBy, className, bottomPad = false }) {
  return (
    <main className="relative min-h-dvh overflow-x-clip bg-navy-950" aria-labelledby={labelledBy}>
      {backdrop ? (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          {backdrop}
        </div>
      ) : null}
      <div
        className={cx('relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)}
        style={{
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          paddingBottom: bottomPad ? 'calc(7rem + env(safe-area-inset-bottom))' : 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </main>
  );
}

/** Section heading: engraved display caps with a hairline that runs to the edge. */
export function SectionHeading({ id, children, icon, aside, className, tone = 'gold' }) {
  return (
    <div className={cx('mb-3 flex items-center gap-3', className)}>
      {icon ? (
        <span
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgb(255_244_214/0.12),0_2px_6px_rgb(0_0_0/0.5)]',
            tone === 'ember' ? 'border-ember-400/60 text-ember-300' : 'border-gold-500/60 text-gold-300',
          )}
          style={{ background: tone === 'ember' ? 'radial-gradient(circle at 35% 30%, #3a2018, #0b1424 75%)' : 'radial-gradient(circle at 35% 30%, #24324a, #0b1424 75%)' }}
        >
          <Icon name={icon} size={17} />
        </span>
      ) : null}
      <h2 id={id} className={cx('font-display text-[0.95rem] uppercase tracking-[0.2em] text-engraved', tone === 'ember' ? 'text-ember-200' : 'text-gold-300')}>
        {children}
      </h2>
      <span className="flex min-w-6 flex-1 items-center" aria-hidden="true">
        <span className={cx('size-1.5 shrink-0 rotate-45', tone === 'ember' ? 'bg-ember-400/70' : 'bg-gold-500/70')} />
        <span className={cx('h-px flex-1 bg-gradient-to-r to-transparent', tone === 'ember' ? 'from-ember-400/50' : 'from-gold-500/55')} />
      </span>
      {aside}
    </div>
  );
}

const LATTICE_STAR = 'M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7M12 7.2 16.8 12 12 16.8 7.2 12 12 7.2Z';
const CATEGORY_ICON = { diplomacy: 'scroll', military: 'sword', clandestine: 'intel', economic: 'map' };

/** Line glyph per order category, in the kit's engraved style. */
export function CategoryIcon({ category, size = 16, className }) {
  const first = String(category ?? '').split('+')[0];
  if (first === 'research') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
        <path d={LATTICE_STAR} />
        <circle cx="12" cy="12" r="9.5" strokeOpacity="0.45" />
      </svg>
    );
  }
  return <Icon name={CATEGORY_ICON[first] ?? 'crown'} size={size} className={className} />;
}

/** A small mark for an advisor's reaction (approve / doubt / object / neutral). Decorative. */
export function ReactionMark({ reaction, size = 14, className }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false', className };
  if (reaction === 'approves') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7.2" fill="#c9a227" stroke="#0b1424" strokeWidth="1.2" />
        <path d="M4.6 8.3 7 10.6l4.4-5" fill="none" stroke="#0b1424" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (reaction === 'doubts') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7.2" fill="#b4532a" stroke="#0b1424" strokeWidth="1.2" />
        <path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4" fill="none" stroke="#fbf8f0" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.9" r="0.95" fill="#fbf8f0" />
      </svg>
    );
  }
  if (reaction === 'objects') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7.2" fill="#9e2b25" stroke="#0b1424" strokeWidth="1.2" />
        <path d="M5.4 5.4l5.2 5.2m0-5.2-5.2 5.2" stroke="#fbf8f0" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="7.2" fill="#2a2f3a" stroke="#0b1424" strokeWidth="1.2" />
      <path d="M5 8h6" stroke="#b5b6ba" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Treasury / manpower cost as icon + number. */
export function CostLine({ cost, className, size = 16 }) {
  const t = cost?.treasury ?? 0;
  const m = cost?.manpower ?? 0;
  if (!t && !m) return <span className={cx('text-parchment-300', className)}>No cost</span>;
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums', className)}>
      {t ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="treasury" size={size} className="text-gold-400" />
          {t.toLocaleString('en-US')}
          <span className="sr-only"> treasury</span>
        </span>
      ) : null}
      {m ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="manpower" size={size} className="text-gold-400" />
          {m.toLocaleString('en-US')}
          <span className="sr-only"> manpower</span>
        </span>
      ) : null}
    </span>
  );
}

// Irregular wax-blob outline, built once (deterministic geometry, no randomness).
const WAX_PATH = (() => {
  const pts = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const r = 54 + 2.6 * Math.sin(a * 7 + 0.6) + 1.8 * Math.sin(a * 11 + 2.1) + 1.2 * Math.cos(a * 17);
    pts.push([60 + r * Math.cos(a), 60 + r * Math.sin(a)]);
  }
  return `M${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`;
})();

const CROWN = 'M37 70 33 46l10.5 9L60 34l16.5 21L87 46l-4 24Z';

/** The Crown's wax seal: crimson wax, gold-leaf crown, engraved legend. Decorative. */
export function WaxSeal({ size = 120, className, style, legend = 'BY THE CROWN OF ELVIA' }) {
  const id = `ws${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-wax`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#d65a50" />
          <stop offset="0.38" stopColor="#a9302a" />
          <stop offset="0.8" stopColor="#6e1a16" />
          <stop offset="1" stopColor="#3f0e0b" />
        </radialGradient>
        <radialGradient id={`${id}-well`} cx="55%" cy="60%" r="60%">
          <stop offset="0" stopColor="#8c231e" />
          <stop offset="1" stopColor="#5a1511" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbefc2" />
          <stop offset="0.45" stopColor="#e3c463" />
          <stop offset="1" stopColor="#8a6a17" />
        </linearGradient>
        <path id={`${id}-arc`} d="M60,60 m-31,0 a31,31 0 1,1 62,0 a31,31 0 1,1 -62,0" />
      </defs>
      <path d={WAX_PATH} fill="#2a0806" opacity="0.55" transform="translate(1.5 3)" />
      <path d={WAX_PATH} fill={`url(#${id}-wax)`} />
      <circle cx="60" cy="60" r="42" fill={`url(#${id}-well)`} />
      <circle cx="60" cy="60" r="42" fill="none" stroke="#2a0806" strokeWidth="1.6" opacity="0.7" />
      <circle cx="60" cy="60" r="43.4" fill="none" stroke="#f08d7f" strokeWidth="0.8" opacity="0.35" />
      <circle cx="60" cy="60" r="24" fill="none" stroke="#2a0806" strokeWidth="0.8" opacity="0.55" />
      <text fontFamily="Cinzel, Georgia, serif" fontSize="7.4" letterSpacing="1.6" fill="#f3b3a8" opacity="0.75">
        <textPath href={`#${id}-arc`} startOffset="0">
          {legend} · {legend.split(' ').pop()} ·
        </textPath>
      </text>
      <path d={CROWN} fill="#2a0806" opacity="0.5" transform="translate(0.8 1.6)" />
      <path d={CROWN} fill={`url(#${id}-gold)`} stroke="#5a4210" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="37" y="72.5" width="46" height="4.2" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a4210" strokeWidth="0.6" />
      <circle cx="60" cy="33" r="2.6" fill="#fbefc2" />
      <circle cx="33" cy="45" r="2" fill="#fbefc2" />
      <circle cx="87" cy="45" r="2" fill="#fbefc2" />
      <path d="M30 34c6-10 18-16 30-16" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** A full-screen moment: the seal comes down on the order. */
export function SealOverlay({ label }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center" role="status" aria-live="assertive">
      <div className="absolute inset-0 bg-navy-950/75 animate-fade-in" />
      <div
        className="absolute left-1/2 top-1/2 size-[34rem] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full animate-fade-in"
        style={{ background: 'radial-gradient(circle, rgb(255 233 174 / 0.28), rgb(224 120 43 / 0.08) 45%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <WaxSeal size={168} className="animate-seal-press drop-shadow-[0_18px_30px_rgba(0,0,0,0.65)]" />
        <p className="font-display text-sm uppercase tracking-[0.3em] text-gold-200 animate-fade-in">{label}</p>
      </div>
    </div>
  );
}

/** Small gilt corner brackets for hero frames. Decorative. */
export function GiltCorners({ className }) {
  const c = 'absolute size-4 border-gold-500/70';
  return (
    <span className={cx('pointer-events-none absolute inset-2', className)} aria-hidden="true">
      <span className={cx(c, 'left-0 top-0 border-l border-t')} />
      <span className={cx(c, 'right-0 top-0 border-r border-t')} />
      <span className={cx(c, 'bottom-0 left-0 border-b border-l')} />
      <span className={cx(c, 'bottom-0 right-0 border-b border-r')} />
    </span>
  );
}
