// The beat's choices. Three weights, three looks:
//   talk    — quiet secondary buttons; the march stays on this beat
//   advance — engraved order cards; the march moves on
//   duel    — dramatic sword cards; single combat
// Each button's accessible name is exactly the authored label; hints and warnings are descriptions.

import { useId } from 'react';
import { Icon } from '../../kit/icons.jsx';
import { cx } from '../../kit/kit.jsx';

function TalkButton({ choice, onPick, disabled }) {
  const id = useId();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(choice)}
      aria-labelledby={`${id}-l`}
      aria-describedby={choice.warning ? `${id}-w` : undefined}
      className={cx(
        'group relative flex min-h-12 w-full items-center gap-3 rounded-xl border border-gold-700/35 bg-navy-900/55 px-4 py-3 text-left',
        'shadow-[inset_0_1px_0_rgb(255_244_214/0.05)] transition-colors duration-200',
        'hover:border-gold-500/70 hover:bg-navy-800/70 active:translate-y-px active:bg-navy-800',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200 disabled:opacity-50',
      )}
    >
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-gold-700/50 text-gold-400 transition-colors group-hover:border-gold-400 group-hover:text-gold-200">
        <SpeechGlyph />
      </span>
      <span className="min-w-0 flex-1">
        <span id={`${id}-l`} className="block text-[1rem] leading-snug text-parchment-100">
          {choice.label}
        </span>
        {choice.warning ? (
          <span id={`${id}-w`} className="mt-0.5 flex items-center gap-1.5 text-[0.9rem] text-crimson-300">
            <Icon name="alert" size={15} />
            {choice.warning}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SpeechGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5h-7L7.5 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function AdvanceCard({ choice, onPick, disabled, final }) {
  const id = useId();
  const described = [choice.hint && `${id}-h`, choice.warning && `${id}-w`].filter(Boolean).join(' ') || undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(choice)}
      aria-labelledby={`${id}-l`}
      aria-describedby={described}
      className={cx('order-card group min-h-16 items-center', choice.warning && 'order-card--danger')}
    >
      <span className="order-card__key" aria-hidden="true">
        <Icon name={final ? 'fire' : choice.warning ? 'alert' : 'forward'} size={20} strokeWidth={2} />
      </span>
      <span className="order-card__body flex-1">
        <span id={`${id}-l`} className="order-card__title">
          {choice.label}
        </span>
        {choice.hint ? (
          <span id={`${id}-h`} className="order-card__desc">
            {choice.hint}
          </span>
        ) : null}
        {choice.warning ? (
          <span id={`${id}-w`} className="mt-0.5 flex items-center gap-1.5 text-[0.92rem] font-semibold text-crimson-300">
            <Icon name="alert" size={15} />
            {choice.warning}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function CrossedBlades({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <g strokeWidth="2.2">
        <path d="M22 22 84 84M84 84l8 8M76 92l16-16M98 98l8 8" />
        <path d="M98 22 36 84M36 84l-8 8M44 92 28 76M22 98l-8 8" />
      </g>
      <circle cx="60" cy="60" r="44" strokeWidth="0.8" strokeDasharray="2 5" />
      <path d="M60 10v8M60 102v8M10 60h8M102 60h8" strokeWidth="1" />
    </svg>
  );
}

function DuelCard({ choice, onPick, disabled }) {
  const id = useId();
  const described = [choice.hint && `${id}-h`, choice.warning && `${id}-w`].filter(Boolean).join(' ') || undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(choice)}
      aria-labelledby={`${id}-l`}
      aria-describedby={described}
      className="order-card order-card--danger group relative min-h-[5.5rem] items-center overflow-hidden !border-ember-600/80 !py-4 hover:!border-ember-400"
      style={{
        background:
          'var(--elvia-grain), radial-gradient(120% 140% at 0% 50%, rgb(224 120 43 / 0.22), transparent 55%), radial-gradient(80% 120% at 100% 0%, rgb(158 43 37 / 0.28), transparent 60%), linear-gradient(180deg, #2a1a1c 0%, #1a1420 55%, #120f18 100%)',
      }}
    >
      <CrossedBlades className="pointer-events-none absolute -right-5 top-1/2 size-32 -translate-y-1/2 text-ember-300/15 transition-colors duration-300 group-hover:text-ember-300/25" />
      <span className="order-card__key !size-12 shadow-[0_0_18px_rgb(224_120_43/0.45)]" aria-hidden="true">
        <Icon name="sword" size={22} strokeWidth={2} />
      </span>
      <span className="order-card__body relative flex-1">
        <span className="font-display text-[0.7rem] uppercase tracking-[0.24em] text-ember-300" aria-hidden="true">
          Single combat
        </span>
        <span id={`${id}-l`} className="font-display text-[1.18rem] font-bold leading-tight tracking-[0.03em] text-gold-200 text-engraved">
          {choice.label}
        </span>
        {choice.hint ? (
          <span id={`${id}-h`} className="text-[0.95rem] text-parchment-200">
            {choice.hint}
          </span>
        ) : null}
        {choice.warning ? (
          <span id={`${id}-w`} className="mt-0.5 flex items-center gap-1.5 text-[0.92rem] font-semibold text-crimson-300">
            <Icon name="alert" size={15} />
            {choice.warning}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * @param {{ choices: Array, onPick: (choice) => void, disabled?: boolean, isFinalBeat?: boolean }} props
 */
export function ChoiceList({ choices, onPick, disabled = false, isFinalBeat = false }) {
  const talk = choices.filter((c) => c.kind === 'talk');
  const deeds = choices.filter((c) => c.kind !== 'talk');
  return (
    <div className="space-y-6">
      {talk.length ? (
        <section aria-labelledby="march-talk-heading" className="animate-fade-up" style={{ animationDelay: '260ms' }}>
          <h2 id="march-talk-heading" className="mb-2.5 flex items-baseline justify-between gap-3 font-display text-[0.8rem] uppercase tracking-[0.2em] text-gold-400">
            <span>Speak</span>
            <span className="font-body text-[0.82rem] normal-case tracking-normal text-parchment-300">The march waits while you talk</span>
          </h2>
          <ul className="space-y-2">
            {talk.map((c) => (
              <li key={c.id}>
                <TalkButton choice={c} onPick={onPick} disabled={disabled} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {deeds.length ? (
        <section aria-labelledby="march-deeds-heading" className="animate-fade-up" style={{ animationDelay: '340ms' }}>
          <h2 id="march-deeds-heading" className="mb-2.5 font-display text-[0.8rem] uppercase tracking-[0.2em] text-gold-400">
            {deeds.some((c) => c.kind === 'duel') ? 'Decide' : isFinalBeat ? 'The night' : 'Move on'}
          </h2>
          <ul className="space-y-3">
            {deeds.map((c) => (
              <li key={c.id}>
                {c.kind === 'duel' ? (
                  <DuelCard choice={c} onPick={onPick} disabled={disabled} />
                ) : (
                  <AdvanceCard choice={c} onPick={onPick} disabled={disabled} final={isFinalBeat} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
