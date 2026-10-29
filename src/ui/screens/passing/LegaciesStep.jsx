// Step III — What Survives You (Cycle doc §3): all eight Legacies, earned ones selectable, at most
// two carried across. Choosing none is allowed: everything becomes history instead.

import { useState } from 'react';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';
import { Medallion } from '../warroom/ornate.jsx';
import { WaxSeal } from '../warroom/shared.jsx';
import { roman } from '../warroom/words.js';
import { MAX_LEGACIES } from '../../../game/content/legacies.js';
import { ActionBar } from './ActionBar.jsx';
import { StepHeader } from './StepHeader.jsx';
import { LEGACY_PROMPT, NONE_LINE } from './copy.js';

/** A pressed-wax "not earned" mark: a small dull seal and the words, like a clerk's stamp. */
function NotEarnedStamp() {
  return (
    <span className="ml-0.5 inline-flex shrink-0 -rotate-3 items-center gap-1.5 rounded-[0.35rem] border border-crimson-400/55 px-2 py-1 font-display text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-crimson-300 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.35)]">
      <WaxSeal size={20} className="shrink-0 opacity-80 saturate-50" legend="ELVIA" />
      Not earned
    </span>
  );
}

function LegacyCard({ legacy, chosen, full, onToggle, index }) {
  const locked = !legacy.earned;
  const disabled = locked || (full && !chosen);
  const numeral = roman(index + 1);
  const body = (
    <>
      <span className="flex items-center gap-3">
        <Medallion letter={numeral} size={46} lit={chosen} dim={locked} />
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          <span className={cx('font-display text-[1.1rem] leading-tight text-engraved', locked ? 'text-parchment-300' : 'text-gold-100')}>{legacy.name}</span>
          {locked ? (
            <NotEarnedStamp />
          ) : chosen ? (
            <span className="chip chip--gold !min-h-7 !text-[0.78rem]">
              <Icon name="check" size={13} /> Carried
            </span>
          ) : (
            <span className="chip !min-h-7 !text-[0.78rem]">Earned</span>
          )}
        </span>
      </span>
      <span className={cx('mt-3 block text-[0.98rem] leading-snug', locked ? 'text-parchment-300' : 'text-parchment-100')}>{legacy.effect}</span>
      <span className={cx('mt-2 block text-[0.95rem] leading-snug', locked ? 'text-ember-200/75' : 'text-ember-200')}>
        <span className="font-semibold">The cost: </span>
        {legacy.cost}
      </span>
      <span className="mt-2.5 block border-t border-gold-800/40 pt-2 text-[0.95rem] leading-snug text-parchment-300">
        {legacy.earn}
        {legacy.progress ? <span className="block text-parchment-400">{legacy.progress}</span> : null}
      </span>
    </>
  );
  if (locked) {
    // dimmed, desaturated parchment: the page exists, the deed was never written on it
    return (
      <li
        className="relative animate-fade-up overflow-hidden rounded-[0.9rem] border border-stone-600/45 p-4 shadow-[inset_0_1px_0_rgb(255_244_214/0.04)]"
        style={{
          animationDelay: `${index * 60}ms`,
          background: 'var(--elvia-grain), radial-gradient(110% 80% at 0% 0%, rgb(184 170 140 / 0.07), transparent 60%), linear-gradient(180deg, #1b1a17 0%, #141310 60%, #0f0e0c 100%)',
        }}
      >
        {body}
      </li>
    );
  }
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <button
        type="button"
        aria-pressed={chosen}
        disabled={disabled}
        onClick={() => onToggle(legacy.id)}
        className={cx(
          'relative block h-full w-full overflow-hidden rounded-[0.9rem] border p-4 pl-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
          // a brass edge down the spine of an earned page
          'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-gradient-to-b before:from-gold-200 before:via-gold-500 before:to-brass-700',
          chosen
            ? 'border-gold-400 shadow-[0_0_0_1px_rgb(227_196_99/0.4),0_0_34px_-8px_rgb(227_196_99/0.6)]'
            : 'border-gold-700/60 shadow-[inset_0_1px_0_rgb(255_244_214/0.1),0_14px_28px_-16px_rgb(0_0_0/0.9)] hover:border-gold-500/80',
        )}
        style={{
          background: chosen
            ? 'var(--elvia-grain), radial-gradient(120% 110% at 0% 0%, rgb(255 233 174 / 0.22), transparent 60%), linear-gradient(180deg, #2a2216 0%, #1d1810 60%, #14110c 100%)'
            : 'var(--elvia-grain), radial-gradient(110% 80% at 0% 0%, rgb(255 233 174 / 0.12), transparent 60%), linear-gradient(180deg, #221c12 0%, #17140f 60%, #0f0d0b 100%)',
        }}
      >
        <span className="sr-only">{legacy.name}. </span>
        {body}
      </button>
    </li>
  );
}

export function LegaciesStep({ view, tone, onChoose, headingRef }) {
  const [chosen, setChosen] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const legacies = view.legacies ?? [];
  const earned = legacies.filter((l) => l.earned);
  const full = chosen.length >= MAX_LEGACIES;
  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_LEGACIES ? c : [...c, id]));
  const names = chosen.map((id) => legacies.find((l) => l.id === id)?.name ?? id);
  const label = chosen.length ? `Carry ${chosen.length === 1 ? 'this Legacy' : 'these Legacies'}` : 'Carry nothing across';

  return (
    <div>
      <StepHeader headingRef={headingRef} eyebrow={tone.eyebrow(view.sovereign)} title="What Survives You" seal={tone.legacies} lead={LEGACY_PROMPT} />
      <p className="mt-5 text-[1rem] text-parchment-200" aria-live="polite">
        {earned.length
          ? `You earned ${earned.length} of 8 this reign. Choose up to ${MAX_LEGACIES}. Chosen: ${chosen.length} of ${MAX_LEGACIES}.`
          : 'You earned none this reign. Everything you did becomes history instead, and history is remembered.'}
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {legacies.map((l, i) => (
          <LegacyCard key={l.id} legacy={l} chosen={chosen.includes(l.id)} full={full} onToggle={toggle} index={i} />
        ))}
      </ul>
      <ActionBar note={chosen.length ? names.join(' · ') : NONE_LINE}>
        <Button icon="crown" onClick={() => setConfirm(true)}>
          {label}
        </Button>
      </ActionBar>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        eyebrow="This cannot be undone"
        title={chosen.length ? 'Carry these across the Passing?' : 'Carry nothing across?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Choose again
            </Button>
            <Button icon="crown" onClick={() => onChoose(chosen)}>
              Seal the choice
            </Button>
          </>
        }
      >
        {chosen.length ? (
          <ul className="space-y-3">
            {chosen.map((id) => {
              const l = legacies.find((x) => x.id === id);
              return (
                <li key={id} className="rounded-lg border border-gold-600/45 bg-navy-950/60 p-3">
                  <p className="font-display text-[1.02rem] text-gold-200">{l?.name}</p>
                  <p className="mt-1 text-[0.95rem] text-parchment-100">{l?.effect}</p>
                  <p className="mt-1 text-[0.9rem] text-ember-200">{l?.cost}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="font-serif text-[1.15rem] leading-relaxed text-parchment-100">{NONE_LINE} Nothing crosses with you but what the world remembers.</p>
        )}
      </Sheet>
    </div>
  );
}
