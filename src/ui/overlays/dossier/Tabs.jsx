import { useRef } from 'react';
import { cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';

/**
 * WAI-ARIA tablist (roving tabindex, arrow keys, Home/End).
 * tabs: [{ id, label, icon? }], idBase: prefix for tab/panel ids.
 */
export function Tabs({ tabs, value, onChange, idBase, label, className }) {
  const refs = useRef([]);
  const select = (i) => {
    const next = (i + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  const onKey = (e, i) => {
    if (e.key === 'ArrowRight') select(i + 1);
    else if (e.key === 'ArrowLeft') select(i - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(tabs.length - 1);
    else return;
    e.preventDefault();
  };
  return (
    <div role="tablist" aria-label={label} className={cx('grid grid-flow-col auto-cols-fr gap-1 rounded-xl border border-gold-700/45 bg-navy-950/70 p-1', className)}>
      {tabs.map((t, i) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idBase}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'inline-flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-lg px-2 font-display text-[0.92rem] font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200 sm:px-4',
              on
                ? 'bg-[linear-gradient(180deg,#e3c463,#c9a227)] text-navy-950 shadow-[inset_0_1px_0_rgb(255_252_240/0.7),0_2px_8px_-2px_rgb(227_196_99/0.5)]'
                : 'text-gold-300 hover:bg-gold-500/15 active:translate-y-px',
            )}
          >
            {t.icon ? <Icon name={t.icon} size={18} /> : null}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
