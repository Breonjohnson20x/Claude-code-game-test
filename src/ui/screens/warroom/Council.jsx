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
        'relative flex w-[78vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-[var(--radius-panel)] border p-4 animate-fade-up sm:w-auto sm:max-w-none',
        action ? 'border-acid-600/35 bg-navy-900/70' : 'border-gold-700/35 bg-navy-900/75',
      )}
      style={{ animationDelay: `${120 + index * 90}ms` }}
    >
      <div className="flex items-center gap-3">
        <Portrait id={advisor.id} size={52} mood={action ? 'warm' : 'neutral'} />
        <div className="min-w-0">
          <p className="truncate font-display text-[1rem] leading-tight text-gold-200">{name}</p>
          <p className="truncate text-[0.85rem] text-parchment-300">{character?.role}</p>
        </div>
      </div>
      <p className={cx('mt-3 font-serif text-[1.12rem] leading-snug', action ? 'italic text-parchment-200' : 'text-parchment-100')}>{advisor.line}</p>
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
