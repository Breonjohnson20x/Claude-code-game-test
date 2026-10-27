import { Icon } from '../../kit/icons.jsx';
import { cx } from '../../kit/kit.jsx';
import { kindMeta } from './meta.js';

// A few engraved glyphs the kit does not carry (24×24, currentColor, same stroke language).
const LOCAL = {
  stone: 'M7 21V9.5a5 5 0 0 1 10 0V21M5 21h14M12 9.5v6M9.5 12h5',
  circle: 'M15.6 4.9A8 8 0 1 1 9 4.6M12 8.6c.4 2.3.9 2.9 3.4 3.4-2.5.5-3 1-3.4 3.4-.4-2.4-.9-2.9-3.4-3.4 2.5-.5 3-1.1 3.4-3.4Z',
  seal: 'M12 3.5 14 6l3.1-.4.4 3.1L20 10.5 18.6 13l.9 3-3 .9L15 19.6l-3-1.3-3 1.3-1.5-2.7-3-.9.9-3L4 10.5l2.5-1.8.4-3.1L10 6l2-2.5ZM9.2 12l2 2 3.6-4',
};

function Glyph({ d, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/** Small brass medallion with the entry kind's glyph. Decorative; the kind word is given as text nearby. */
export function KindIcon({ kind, size = 18, className, tone = 'ink' }) {
  const meta = kindMeta(kind);
  const local = LOCAL[meta.icon];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full',
        tone === 'ink'
          ? 'size-9 border border-gold-700/50 bg-[radial-gradient(circle_at_35%_30%,#fbf3d8,#e8d9b0_55%,#cdb57d)] text-ink-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(60_40_10/0.35)]'
          : 'size-9 border border-gold-600/50 bg-navy-900/80 text-gold-300',
        className,
      )}
    >
      {local ? <Glyph d={local} size={size} /> : <Icon name={meta.icon} size={size} />}
    </span>
  );
}

export function LocalGlyph({ name, size = 18 }) {
  return LOCAL[name] ? <Glyph d={LOCAL[name]} size={size} /> : <Icon name={name} size={size} />;
}
