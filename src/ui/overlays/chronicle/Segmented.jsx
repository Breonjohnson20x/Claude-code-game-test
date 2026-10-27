import { useRef } from 'react';
import { cx } from '../../kit/kit.jsx';

/** Radio-style segmented control with arrow-key support. options: [{ id, label }] */
export function Segmented({ options, value, onChange, label, className }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex gap-1 rounded-xl border border-gold-700/45 bg-navy-950/70 p-1', className)}>
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'min-h-11 min-w-11 rounded-lg px-4 font-display text-[0.9rem] font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200',
              on ? 'bg-[linear-gradient(180deg,#e3c463,#c9a227)] text-navy-950 shadow-[inset_0_1px_0_rgb(255_252_240/0.7)]' : 'text-gold-300 hover:bg-gold-500/15',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
