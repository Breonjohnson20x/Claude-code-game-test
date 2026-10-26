// The march's progress rail: road → checkpoint → wilds → ruin → champion → camp.
// Done beats are struck in gold with a check, the current beat glows, the rest wait in stone.

import { cx } from '../../kit/kit.jsx';
import { BEAT_RAIL_LABEL } from './words.js';

function Node({ status }) {
  // A small cut-gem diamond, drawn so it reads at 28px.
  const done = status === 'done';
  const current = status === 'current';
  return (
    <svg
      viewBox="0 0 28 28"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
      className={cx('relative z-10 block', current && 'drop-shadow-[0_0_8px_rgb(227_196_99/0.65)]')}
    >
      <path d="M14 2.5 25.5 14 14 25.5 2.5 14Z" fill={done ? '#c9a227' : current ? '#16243a' : '#0b1424'} stroke={done || current ? '#f0dc95' : '#4a4f5a'} strokeWidth={current ? 1.8 : 1.3} />
      {current ? <path d="M14 8.5 19.5 14 14 19.5 8.5 14Z" fill="#f0dc95" /> : null}
      {done ? <path d="m9.6 14.2 3 3 5.8-6.4" fill="none" stroke="#0b1424" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {!done && !current ? <path d="M14 10.5 17.5 14 14 17.5 10.5 14Z" fill="#2a2f3a" /> : null}
    </svg>
  );
}

export function MarchRail({ beats, index, className }) {
  if (!beats?.length) return null;
  const n = beats.length;
  const current = Math.min(index, n - 1);
  const edge = `calc(100% / ${2 * n})`; // centre of the first / last column
  return (
    <nav aria-label="March progress" className={cx('w-full', className)}>
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {/* the road itself: gold up to the current beat, stone after it */}
        <span aria-hidden="true" className="absolute top-[13.5px] h-px bg-stone-600/80" style={{ left: edge, right: edge }} />
        <span
          aria-hidden="true"
          className="absolute top-[13.5px] h-px bg-gradient-to-r from-gold-700 via-gold-500 to-gold-300 shadow-[0_0_6px_rgb(227_196_99/0.5)] transition-[width] duration-700"
          style={{ left: edge, width: n > 1 ? `calc((100% - 100% / ${n}) * ${current / (n - 1)})` : 0 }}
        />
        {beats.map((id, i) => {
          const status = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <li key={`${id}-${i}`} aria-current={status === 'current' ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center">
              <Node status={status} />
              <span
                className={cx(
                  'mt-1.5 whitespace-nowrap font-display text-[0.74rem] uppercase tracking-[0.14em]',
                  status === 'current' ? 'text-gold-200 text-glow-gold' : status === 'done' ? 'text-gold-500' : 'text-stone-400',
                  // On phones only the current label is printed; the rest are announced.
                  status === 'current' ? '' : 'max-sm:sr-only',
                )}
              >
                {BEAT_RAIL_LABEL[id] ?? id}
                <span className="sr-only">{status === 'done' ? ', done' : status === 'current' ? `, you are here, step ${i + 1} of ${n}` : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
