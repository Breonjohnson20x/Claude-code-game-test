// War Room: the Council speaks. Each advisor's line comes straight from the crisis; Sparky's
// "line" is stage direction, so it is set as an action, not a quote.

import { Portrait } from '../../art/index.js';
import { cx } from '../../kit/kit.jsx';
import { SectionHeading } from './shared.jsx';

function AdvisorCard({ advisor, character, index }) {
  const action = advisor.id === 'sparky';
  const name = character?.name ?? advisor.id;
  return (
    <li
      className={cx(
        'relative isolate flex w-[80vw] max-w-[21rem] shrink-0 snap-start flex-col overflow-hidden rounded-[0.9rem] border p-4 pt-3.5 animate-fade-up sm:w-auto sm:max-w-none',
        'shadow-[inset_0_1px_0_rgb(255_244_214/0.08),0_14px_28px_-16px_rgb(0_0_0/0.9)]',
        action ? 'border-acid-600/35' : 'border-gold-700/50',
      )}
      style={{
        animationDelay: `${120 + index * 90}ms`,
        background: [
          'var(--elvia-grain)',
          action ? 'radial-gradient(90% 70% at 0% 0%, rgb(111 154 30 / 0.12), transparent 60%)' : 'radial-gradient(90% 70% at 0% 0%, rgb(227 196 99 / 0.12), transparent 60%)',
          'linear-gradient(180deg, #1b2639 0%, #121b2b 60%, #0d1523 100%)',
        ].join(','),
      }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] -z-10 rounded-[0.7rem] border border-gold-500/12" />
      {/* a large engraved quotation mark behind the words */}
      {!action ? (
        <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-5 -z-10 font-serif text-[7rem] leading-none text-gold-500/10">
          &rdquo;
        </span>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="relative shrink-0 rounded-full shadow-[0_0_18px_-2px_rgb(227_196_99/0.35)]">
          <Portrait id={advisor.id} size={56} mood={action ? 'warm' : 'neutral'} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[1.02rem] leading-tight text-gold-200 text-engraved">{name}</p>
          <p className="truncate text-[0.88rem] text-parchment-300">{character?.role}</p>
        </div>
      </div>
      <span aria-hidden="true" className="mt-3 h-px w-full bg-gradient-to-r from-gold-600/50 via-gold-700/20 to-transparent" />
      <p className={cx('mt-3 font-serif text-[1.14rem] leading-snug', action ? 'italic text-parchment-200' : 'text-parchment-50')}>{advisor.line}</p>
    </li>
  );
}

export function Council({ advisors, characters }) {
  if (!advisors?.length) return null;
  return (
    <section aria-labelledby="wr-council-title" className="mb-8">
      <SectionHeading id="wr-council-title" icon="council">
        The Council speaks
      </SectionHeading>
      <ul className="scroll-elvia -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {advisors.map((a, i) => (
          <AdvisorCard key={a.id} advisor={a} character={characters[a.id]} index={i} />
        ))}
      </ul>
    </section>
  );
}
