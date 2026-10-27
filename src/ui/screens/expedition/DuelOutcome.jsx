// After a duel on the march: what happened, and — on a defeat — the "name why you lost" moment
// (Cycle doc success test: loses the first duel, can name why, wins the rematch).

import { Icon } from '../../kit/icons.jsx';
import { cx } from '../../kit/kit.jsx';
import { duelBanner, duelLessons } from './words.js';

const TONE = {
  victory: {
    frame: 'border-gold-500/70 shadow-[0_0_0_1px_rgb(227_196_99/0.25),0_0_36px_-10px_rgb(227_196_99/0.55)]',
    bg: 'radial-gradient(120% 120% at 0% 0%, rgb(227 196 99 / 0.2), transparent 55%), linear-gradient(180deg, #1f2a3e, #121b2b)',
    eyebrow: 'text-gold-300',
    title: 'text-gilded',
    icon: 'crown',
    seal: 'bg-[radial-gradient(circle_at_35%_30%,#fbefc2,#e3c463_35%,#b38c1f_75%,#7d6114)] text-navy-950',
  },
  defeat: {
    frame: 'border-crimson-400/70 shadow-[0_0_0_1px_rgb(194_65_58/0.25),0_0_36px_-12px_rgb(158_43_37/0.6)]',
    bg: 'radial-gradient(120% 120% at 0% 0%, rgb(158 43 37 / 0.32), transparent 55%), linear-gradient(180deg, #24161b, #140f17)',
    eyebrow: 'text-crimson-300',
    title: 'text-parchment-50',
    icon: 'sword',
    seal: 'bg-[radial-gradient(circle_at_35%_30%,#e07a70,#c2413a_35%,#9e2b25_70%,#521410)] text-parchment-50',
  },
  retreat: {
    frame: 'border-iron-300/50',
    bg: 'radial-gradient(120% 120% at 0% 0%, rgb(154 160 168 / 0.14), transparent 55%), linear-gradient(180deg, #1c2029, #12151b)',
    eyebrow: 'text-iron-200',
    title: 'text-parchment-50',
    icon: 'flag',
    seal: 'bg-[radial-gradient(circle_at_35%_30%,#c3c7cc,#9aa0a8_40%,#5d636b_80%)] text-navy-950',
  },
};

export function DuelOutcome({ lastDuel, beatId }) {
  const banner = duelBanner(lastDuel, beatId);
  if (!banner) return null;
  const t = TONE[banner.tone];
  const lessons = duelLessons(lastDuel);
  const [first, ...rest] = lessons;
  const isDefeat = banner.tone === 'defeat';
  return (
    <section
      aria-labelledby="duel-outcome-title"
      className={cx('relative isolate overflow-hidden rounded-[var(--radius-panel)] border p-4 sm:p-5 animate-fade-up', t.frame)}
      style={{ background: `var(--elvia-grain), ${t.bg}` }}
    >
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className={cx('grid size-12 shrink-0 place-items-center rounded-full shadow-[inset_0_1px_1px_rgb(255_252_240/0.6),0_0_0_2px_#0b1424,0_0_0_3px_rgb(201_162_39/0.5)] animate-seal-press', t.seal)}>
          <Icon name={t.icon} size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx('font-display text-[0.74rem] uppercase tracking-[0.22em]', t.eyebrow)}>{banner.eyebrow}</p>
          <h2 id="duel-outcome-title" className={cx('mt-0.5 font-display text-[1.3rem] leading-tight sm:text-2xl', t.title)}>
            {banner.title}
          </h2>
          {banner.line ? <p className="mt-1 text-[1rem] text-parchment-200">{banner.line}</p> : null}
        </div>
      </div>

      {first ? (
        <div className={cx('mt-4 rounded-xl border px-4 py-3', isDefeat ? 'border-crimson-400/40 bg-navy-950/60' : 'border-gold-700/35 bg-navy-950/45')}>
          <p className={cx('font-display text-[0.74rem] uppercase tracking-[0.2em]', isDefeat ? 'text-ember-300' : 'text-gold-400')}>
            {isDefeat ? 'What you misread' : 'One thing to sharpen'}
          </p>
          <p className="mt-1 font-display text-[1.05rem] text-gold-200">{first.title}</p>
          <p className="mt-1 text-[1rem] leading-relaxed text-parchment-100">{first.advice}</p>
          {isDefeat && rest.length ? (
            <ul className="mt-3 space-y-1.5 border-t border-gold-800/40 pt-3">
              {rest.slice(0, 2).map((m) => (
                <li key={m.kind} className="text-[0.95rem] leading-snug text-parchment-300">
                  <span className="font-semibold text-parchment-200">{m.title}.</span> {m.advice}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastDuel.fallen?.length ? <FallenNames names={lastDuel.fallen} compact /> : null}
    </section>
  );
}

/** A solemn roll of names. `compact` inside the duel banner; full at the camp. */
export function FallenNames({ names, compact = false, title }) {
  if (!names?.length) return null;
  return (
    <div className={cx(compact ? 'mt-4 border-t border-gold-800/40 pt-3' : 'panel p-5 text-center sm:p-6')}>
      <p className={cx('font-display uppercase tracking-[0.22em] text-parchment-300', compact ? 'text-[0.74rem]' : 'text-[0.8rem]')}>
        {title ?? (names.length === 1 ? 'Did not come back' : `${names.length} did not come back`)}
      </p>
      {!compact ? (
        <div className="mx-auto my-3 flex items-center justify-center gap-3 text-gold-600" aria-hidden="true">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-600/70" />
          <CandleGlyph />
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-600/70" />
        </div>
      ) : null}
      <ul className={cx(compact ? 'mt-1.5 flex flex-wrap gap-x-4 gap-y-1' : 'space-y-1.5')}>
        {names.map((n, i) => (
          <li
            key={n}
            className={cx('font-serif text-parchment-100', compact ? 'text-[1.05rem]' : 'text-[1.25rem] leading-snug animate-fade-up')}
            style={compact ? undefined : { animationDelay: `${300 + i * 260}ms`, animationDuration: '1s' }}
          >
            {n}
          </li>
        ))}
      </ul>
      {!compact ? <p className="mt-4 text-[0.95rem] text-parchment-300">Their names go to the wall at Greywater.</p> : null}
    </div>
  );
}

function CandleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M12 2.5c1.6 2.3 2.4 3.6 2.4 4.9A2.4 2.4 0 0 1 12 9.8a2.4 2.4 0 0 1-2.4-2.4c0-1.3.8-2.6 2.4-4.9Z" fill="#f4a35e" className="animate-torch-flicker" />
      <path d="M9.5 11h5v10h-5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 21h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
