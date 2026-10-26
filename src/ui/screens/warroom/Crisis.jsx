// War Room: the crisis hero (title, season, era treatment, world threads), the memory of
// earlier reigns, the briefing and the question before the Crown.

import { Chip, Eyebrow, cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';
import { GiltCorners, SectionHeading } from './shared.jsx';
import { roman, threadUrgency } from './words.js';

const BORDER_CHIPS = {
  siege: { tone: 'crimson', text: 'The siege has begun' },
  peace: { tone: 'gold', text: 'Peace within reach' },
  armed: { tone: 'iron', text: 'An armed peace' },
};

/** Five season marks for the reign's arc, the current one lit. */
function ReignProgress({ turn, total, cycle }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`Reign ${roman(cycle)}, turn ${Math.min(turn, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < turn;
        const now = n === turn;
        return (
          <span
            key={n}
            aria-hidden="true"
            className={cx(
              'size-2.5 rotate-45 border transition',
              now ? 'border-gold-200 bg-gold-400 shadow-[0_0_10px_rgb(227_196_99/0.7)]' : done ? 'border-gold-600 bg-gold-700' : 'border-gold-700/60 bg-transparent',
              n === total && 'size-3',
            )}
          />
        );
      })}
    </div>
  );
}

export function CrisisHero({ view, state, headingId }) {
  const { crisis } = view;
  const threads = Object.values(state.threads).filter((t) => t.visibility !== 'hidden');
  const border = crisis.era ? BORDER_CHIPS[crisis.borderOutcome] : null;
  return (
    <header className="relative pb-6 pt-8 sm:pt-12 lg:pb-8 lg:pt-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 animate-fade-up">
        <Eyebrow className="!text-gold-300">
          {crisis.season} <span aria-hidden="true">·</span> Turn {Math.min(view.turn, view.turnsPerCycle)} of {view.turnsPerCycle}
        </Eyebrow>
        <ReignProgress turn={view.turn} total={view.turnsPerCycle} cycle={view.cycle} />
      </div>
      {crisis.era ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold-400/70 bg-gradient-to-r from-gold-700/70 via-gold-600/40 to-transparent py-1 pl-2 pr-4 font-display text-[0.8rem] uppercase tracking-[0.22em] text-gold-200 shadow-[0_0_24px_-6px_rgb(227_196_99/0.6)] animate-fade-up">
          <Icon name="crown" size={16} className="text-gold-200" />
          Era milestone
        </p>
      ) : null}
      <h1
        id={headingId}
        className="mt-3 max-w-3xl font-display text-[2.35rem] leading-[1.05] text-gilded text-glow-gold sm:text-5xl lg:text-[3.6rem] animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        {crisis.title}
      </h1>
      <p className="mt-3 flex items-center gap-2 text-[0.95rem] text-parchment-200 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <Icon name="map" size={16} className="text-gold-400" />
        {crisis.location}
      </p>
      {crisis.era ? (
        <p className="mt-2 max-w-xl font-serif text-[1.18rem] italic leading-snug text-gold-200/90 animate-fade-up" style={{ animationDelay: '160ms' }}>
          Whatever the Crown decides this season is how this reign will be remembered.
        </p>
      ) : null}
      <ul className="mt-5 flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: '200ms' }} aria-label="World threads">
        {border ? (
          <li>
            <Chip tone={border.tone}>
              <Icon name="flag" size={14} />
              {border.text}
            </Chip>
          </li>
        ) : null}
        {threads.map((t) => {
          const u = threadUrgency(t);
          return (
            <li key={t.id}>
              <Chip tone={u.tone} className="!whitespace-normal">
                <span className="font-semibold">{t.title}</span>
                <span aria-hidden="true" className="opacity-60">
                  ·
                </span>
                <span className="font-normal opacity-90">{u.word}</span>
              </Chip>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

/** Reign II+: the first briefing lines are history. They should read like memory. */
export function ChronicleRemembers({ lines, cycle }) {
  if (!lines.length) return null;
  return (
    <section aria-labelledby="wr-memory-title" className="relative mb-6 overflow-hidden rounded-[var(--radius-panel)] border border-gold-500/60 p-5 shadow-panel animate-fade-up sm:p-6"
      style={{
        background:
          'radial-gradient(120% 90% at 0% 0%, rgb(255 233 174 / 0.16), transparent 55%), radial-gradient(90% 80% at 100% 100%, rgb(224 120 43 / 0.10), transparent 60%), linear-gradient(180deg, #221c12 0%, #17140f 55%, #0f0d0b 100%)',
      }}
    >
      <GiltCorners />
      <svg className="pointer-events-none absolute -right-10 -top-10 size-56 text-gold-500/10" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" />
        <path d="M50 4v92M4 50h92M17 17l66 66M83 17 17 83" stroke="currentColor" strokeWidth="0.5" />
      </svg>
      <div className="relative flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border border-gold-400/70 bg-gold-800/40 text-gold-200">
          <Icon name="quill" size={20} />
        </span>
        <div>
          <p className="font-display text-xs uppercase tracking-[0.24em] text-gold-400">Reign {roman(cycle)} · from the dynasty&rsquo;s record</p>
          <h2 id="wr-memory-title" className="font-display text-xl text-gilded">
            The Chronicle remembers
          </h2>
        </div>
      </div>
      <ol className="relative mt-4 space-y-3 border-l border-gold-600/40 pl-4">
        {lines.map((line, i) => (
          <li
            key={`${i}-${line.slice(0, 20)}`}
            className="relative font-serif text-[1.18rem] italic leading-relaxed text-parchment-100 animate-fade-up"
            style={{ animationDelay: `${120 + i * 110}ms` }}
          >
            <span className="absolute -left-[1.38rem] top-[0.62rem] size-2 rotate-45 border border-gold-300 bg-gold-600" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Briefing({ intro, lines }) {
  return (
    <section aria-labelledby="wr-briefing-title" className="mb-6">
      {intro.length ? (
        <div className="mb-5 space-y-3">
          {intro.map((line, i) => (
            <p key={i} className="font-serif text-[1.25rem] italic leading-relaxed text-lattice-200 animate-fade-up">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <div className="panel p-5 sm:p-6">
        <SectionHeading id="wr-briefing-title" icon="scroll">
          The briefing
        </SectionHeading>
        <div className="max-w-prose space-y-4">
          {lines.map((line, i) => (
            <p
              key={`${i}-${line.slice(0, 16)}`}
              className={cx(
                'font-serif text-[1.18rem] leading-relaxed text-parchment-100 animate-fade-up',
                i === 0 && 'first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-display first-letter:text-[3.1rem] first-letter:leading-[0.8] first-letter:text-gold-300',
              )}
              style={{ animationDelay: `${Math.min(i, 8) * 80}ms` }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Conflict({ text }) {
  return (
    <section aria-label="The question before the Crown" className="relative mb-8 px-5 py-6 text-center animate-fade-up sm:px-10">
      <GiltCorners className="!inset-0" />
      <p className="font-display text-xs uppercase tracking-[0.26em] text-gold-400">The question before the Crown</p>
      <p className="mx-auto mt-2 max-w-2xl font-serif text-[1.4rem] italic leading-snug text-gold-100 text-gold-200 sm:text-[1.6rem]">{text}</p>
    </section>
  );
}
