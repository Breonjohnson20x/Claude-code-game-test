import { cx } from '../../kit/kit.jsx';
import { GoldDivider } from '../../art/index.js';

/** Eyebrow, the screen's one h1 (focused on each new step), the cause's seal line and a lead. */
export function StepHeader({ eyebrow, title, seal, lead, headingRef, center = false, className }) {
  return (
    <header className={cx('animate-fade-up', center && 'text-center', className)}>
      {eyebrow ? <p className="font-display text-[0.78rem] uppercase tracking-[0.24em] text-gold-400/90">{eyebrow}</p> : null}
      <div className="relative">
        <span
          aria-hidden="true"
          className={cx('pointer-events-none absolute -top-8 h-[180%] w-[min(36rem,110%)]', center ? 'left-1/2 -translate-x-1/2' : '-left-10')}
          style={{ background: 'radial-gradient(closest-side, rgb(255 214 150 / 0.15), rgb(224 120 43 / 0.04) 60%, transparent)' }}
        />
        <h1
          ref={headingRef}
          tabIndex={-1}
          id="passing-heading"
          className="relative mt-2 font-display text-[2.05rem] leading-[1.08] text-gold-200 text-gilded outline-none sm:text-[2.6rem] lg:text-[3rem]"
          style={{ filter: 'drop-shadow(0 2px 0 rgb(0 0 0 / 0.55)) drop-shadow(0 10px 18px rgb(0 0 0 / 0.55))' }}
        >
          {title}
        </h1>
      </div>
      {seal ? <p className="mt-3 font-serif text-[1.25rem] italic leading-snug text-gold-300/95 sm:text-[1.35rem]">{seal}</p> : null}
      <GoldDivider className={cx('mt-4 max-w-xs opacity-90', center && 'mx-auto')} />
      {lead ? <p className={cx('mt-4 max-w-prose font-serif text-[1.18rem] leading-relaxed text-parchment-200', center && 'mx-auto')}>{lead}</p> : null}
    </header>
  );
}
