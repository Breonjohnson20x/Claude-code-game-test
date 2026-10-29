// Shared UI kit. Everything here is presentational; game state comes from useGame().

import { useEffect, useId, useRef } from 'react';
import { Icon } from './icons.jsx';
import { HUD_KEYS } from '../../game/core/state.js';

export const RESOURCE_META = {
  treasury: { label: 'Treasury', icon: 'treasury', format: (v) => v.toLocaleString('en-US'), hint: 'Crown silver for orders' },
  manpower: { label: 'Manpower', icon: 'manpower', format: (v) => v.toLocaleString('en-US'), hint: 'Soldiers and levies' },
  readiness: { label: 'Readiness', icon: 'readiness', format: (v) => `${v}%`, hint: 'How ready the army is to fight' },
  stability: { label: 'Stability', icon: 'stability', format: (v) => `${v}%`, hint: 'Faith in the Crown' },
  unrest: { label: 'Unrest', icon: 'unrest', format: (v) => `${v}%`, hint: 'Anger in the streets — lower is better' },
  intel: { label: 'Intelligence', icon: 'intel', format: (v) => `${v}%`, hint: "Cassian's reach" },
};

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** A signed number for display: "+5", "−5" (a true minus sign U+2212, never a hyphen). */
export function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : '0';
}

export function Button({ variant = 'royal', icon, children, className, ...rest }) {
  const base = variant === 'royal' ? 'btn-royal' : variant === 'danger' ? 'btn-ghost btn-danger' : 'btn-ghost';
  return (
    <button type="button" className={cx(base, className)} {...rest}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, badge, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('btn-icon size-12', className)}
      {...rest}
    >
      <Icon name={icon} size={22} />
      {badge ? <span className="btn-icon__badge">{badge}</span> : null}
    </button>
  );
}

export function Panel({ as: Tag = 'section', parchment = false, tight = false, className, children, ...rest }) {
  return (
    <Tag className={cx(parchment ? 'panel-parchment' : 'panel', tight && 'panel-tight', 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }) {
  // tighter tracking on phones so a kicker wraps (if at all) into balanced lines, not one orphan word
  return <p className={cx('font-display text-xs uppercase tracking-[0.14em] text-balance text-gold-400/90 sm:tracking-[0.22em]', className)}>{children}</p>;
}

export function Title({ children, className, as: Tag = 'h1' }) {
  return <Tag className={cx('font-display text-2xl leading-tight text-gold-200 sm:text-3xl text-engraved', className)}>{children}</Tag>;
}

export function Rule({ className }) {
  return <div className={cx('gold-rule my-4', className)} role="presentation" />;
}

/** Paragraphs of authored prose, fading in one after another. */
export function Prose({ lines = [], className, serif = true, stagger = true }) {
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  return (
    <div className={cx('space-y-3', className)}>
      {list.map((line, i) => (
        <p
          key={`${i}-${String(line).slice(0, 16)}`}
          className={cx(serif ? 'font-serif text-[1.18rem] leading-relaxed' : 'text-base leading-relaxed', 'text-parchment-100 animate-fade-up')}
          style={stagger ? { animationDelay: `${Math.min(i, 8) * 90}ms` } : undefined}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function Chip({ tone = 'gold', children, className, title }) {
  return (
    <span className={cx('chip', `chip--${tone}`, className)} title={title}>
      {children}
    </span>
  );
}

export function Meter({ value, max = 100, label, tone = 'gold', className }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === 'crimson' ? 'linear-gradient(90deg,#7a1f1a,#c2413a)' : tone === 'ember' ? 'linear-gradient(90deg,#8a3a1c,#e0782b)' : undefined;
  return (
    <div className={cx('meter relative', className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${pct}%`, ...(fill ? { background: fill } : {}) }} />
    </div>
  );
}

/** Toggle switch (role="switch"): a recessed channel with a struck brass knob. */
export function Toggle({ checked, onChange, label, id, className }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('switch', className)}>
      <span className="switch__knob" aria-hidden="true" />
    </button>
  );
}

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
  const current = options.some((o) => o.id === value) ? value : options[0]?.id;
  return (
    <div role="radiogroup" aria-label={label} className={cx('seg', className)}>
      {options.map((o, i) => {
        const on = current === o.id;
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
            className="seg__opt"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Live resource strip (Master Build §17: the five visible resources). */
export function ResourceHud({ resources, deltas = {}, compact = false, className }) {
  return (
    <dl className={cx('grid grid-cols-5 gap-1.5 sm:gap-2', className)} aria-label="Realm resources">
      {HUD_KEYS.map((key) => {
        const meta = RESOURCE_META[key];
        const d = deltas[key];
        const bad = key === 'unrest' ? d > 0 : d < 0;
        return (
          <div key={key} className="plaque relative min-w-0 px-1.5 py-1.5 text-center" title={`${meta.label}: ${meta.hint}`}>
            <dt className="plaque__label flex items-center justify-center gap-1 text-[0.68rem] uppercase tracking-wider">
              <Icon name={meta.icon} size={14} />
              <span className={compact ? 'sr-only lg:not-sr-only' : 'sr-only sm:not-sr-only'}>{meta.label}</span>
              {compact ? null : (
                <span aria-hidden="true" className="sm:hidden">
                  {meta.label.slice(0, 4)}
                </span>
              )}
            </dt>
            <dd className="plaque__value mt-0.5 truncate font-display text-[0.98rem] font-semibold tabular-nums">{meta.format(resources[key])}</dd>
            {d ? (
              <span className={cx('plaque__delta', bad ? 'plaque__delta--bad' : 'plaque__delta--good')}>{signed(d)}</span>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

// Stack of open sheets so only the top-most one handles Escape / Tab.
const SHEET_STACK = [];

/** Modal sheet: a bottom sheet on phones, a centred dialog on wider screens. */
export function Sheet({ open, onClose, title, eyebrow, children, footer, wide = false, labelledBy }) {
  const ref = useRef(null);
  const fallbackId = useId();
  const titleId = labelledBy ?? `${fallbackId}-title`;
  // Latest onClose without re-running the focus trap (and stealing focus) when the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => [...(el?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter((n) => !n.disabled);
    (focusables()[0] ?? el)?.focus?.();
    const token = {};
    SHEET_STACK.push(token);
    const onKey = (e) => {
      if (SHEET_STACK[SHEET_STACK.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = SHEET_STACK.indexOf(token);
      if (i >= 0) SHEET_STACK.splice(i, 1);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-950/80 animate-fade-in" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'panel relative z-10 flex max-h-[92dvh] w-full flex-col rounded-b-none p-0 animate-fade-up sm:rounded-b-[var(--radius-panel)]',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="relative flex items-start gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 id={titleId} className="font-display text-xl text-gold-200">
                {title}
              </h2>
            ) : null}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} className="size-11 shrink-0" />
          <span aria-hidden="true" className="gold-rule pointer-events-none absolute inset-x-4 -bottom-[0.45rem] !my-0" />
        </header>
        <div className="scroll-elvia min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-gold-700/40 bg-navy-950/40 px-5 py-3 shadow-[inset_0_1px_0_rgb(255_244_214/0.05)]">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** Full-height screen with an optional art backdrop behind the content column. */
export function Screen({ backdrop, children, className, wide = false, labelledBy }) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-navy-950" aria-labelledby={labelledBy}>
      {backdrop ? <div className="pointer-events-none fixed inset-0 z-0">{backdrop}</div> : null}
      <div
        className={cx('relative z-10 mx-auto w-full px-4 sm:px-6', wide ? 'max-w-5xl' : 'max-w-3xl', className)}
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </main>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto max-w-md px-4 py-3 text-[0.95rem] animate-fade-up',
            t.tone === 'error' ? 'rounded-xl border border-crimson-400/70 bg-crimson-700/95 text-parchment-50 shadow-panel' : 'panel panel-tight text-parchment-100',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** A short labelled list item for reports: "Mara — Cordial → Fond". */
export function Shift({ label, from, to, good }) {
  return (
    <li className="plaque flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-parchment-100">{label}</span>
      <span className={cx('text-sm font-semibold', good === undefined ? 'text-gold-300' : good ? 'text-gold-300' : 'text-crimson-300')}>
        {from} <span aria-hidden="true">→</span>
        <span className="sr-only">to</span> {to}
      </span>
    </li>
  );
}
