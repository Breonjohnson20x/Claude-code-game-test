import { useRef } from 'react';
import { cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';

/**
 * WAI-ARIA tablist (roving tabindex, arrow keys, Home/End).
 * tabs: [{ id, label, short?, icon? }], idBase: prefix for tab/panel ids. `short` is shown on phones
 * (the full label stays the accessible name); icons show from the sm breakpoint up.
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
    <div role="tablist" aria-label={label} className={cx('seg grid grid-flow-col auto-cols-fr', className)}>
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
            aria-label={t.short ? t.label : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className="seg__opt min-h-12 whitespace-nowrap !px-2 sm:!px-4"
          >
            {t.icon ? <Icon name={t.icon} size={18} className="max-sm:hidden" /> : null}
            {t.short ? (
              <>
                <span className="sm:hidden">{t.short}</span>
                <span className="max-sm:hidden">{t.label}</span>
              </>
            ) : (
              <span>{t.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
