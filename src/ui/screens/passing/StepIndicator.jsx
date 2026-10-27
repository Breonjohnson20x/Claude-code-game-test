import { cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';
import { STEPS, stepIndex } from './copy.js';

/** The four steps of the Passing as engraved medallions joined by a gold thread. */
export function StepIndicator({ step, className }) {
  const at = stepIndex(step);
  return (
    <nav aria-label="Steps of the Passing" className={className}>
      <ol className="flex items-start">
        {STEPS.map((s, i) => {
          const done = i < at;
          const current = i === at;
          return (
            <li key={s.id} aria-current={current ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute right-1/2 top-[1.05rem] h-px w-full -translate-y-1/2',
                    i <= at ? 'bg-[linear-gradient(90deg,#a8841b,#e3c463)] shadow-[0_0_6px_rgb(227_196_99/0.5)]' : 'bg-gold-700/35',
                  )}
                  style={{ marginRight: '1.25rem', width: 'calc(100% - 2.5rem)' }}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cx(
                  'relative z-10 grid size-[2.1rem] place-items-center rounded-full border font-display text-[0.8rem] font-bold transition-colors',
                  done && 'border-gold-400 bg-[radial-gradient(circle_at_35%_30%,#fbefc2,#e3c463_45%,#a8841b)] text-navy-950',
                  current && 'border-gold-300 bg-navy-950 text-gold-200 shadow-[0_0_0_3px_rgb(227_196_99/0.18),0_0_18px_rgb(227_196_99/0.45)]',
                  !done && !current && 'border-gold-700/50 bg-navy-950/80 text-gold-600',
                )}
              >
                {done ? <Icon name="check" size={16} /> : s.numeral}
              </span>
              <span
                className={cx(
                  'mt-1.5 px-0.5 font-display text-[0.7rem] uppercase leading-tight tracking-[0.12em] sm:text-[0.76rem]',
                  current ? 'text-gold-200' : done ? 'text-gold-400/80' : 'text-parchment-400/70',
                  !current && 'max-sm:sr-only',
                )}
              >
                <span className="sr-only">
                  Step {s.numeral}
                  {done ? ', done' : current ? ', current' : ''}:{' '}
                </span>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
