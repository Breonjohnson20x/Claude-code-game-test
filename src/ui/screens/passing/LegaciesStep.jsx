// Step III — What Survives You (Cycle doc §3): all eight Legacies, earned ones selectable, at most
// two carried across. Choosing none is allowed: everything becomes history instead.

import { useState } from 'react';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { Icon } from '../../kit/icons.jsx';
import { Sigil } from '../../art/index.js';
import { MAX_LEGACIES } from '../../../game/content/legacies.js';
import { ActionBar } from './ActionBar.jsx';
import { StepHeader } from './StepHeader.jsx';
import { LEGACY_PROMPT, NONE_LINE } from './copy.js';

function LegacyCard({ legacy, chosen, full, onToggle, index }) {
  const locked = !legacy.earned;
  const disabled = locked || (full && !chosen);
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2.5 font-display text-[1.1rem] leading-tight text-gold-100 text-engraved">
          <span
            aria-hidden="true"
            className={cx(
              'grid size-9 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgb(255_244_214/0.15),0_2px_6px_rgb(0_0_0/0.5)]',
              locked ? 'border-stone-600/70 text-stone-500' : chosen ? 'border-gold-300 text-gold-200 shadow-[0_0_18px_rgb(227_196_99/0.55)]' : 'border-gold-500/70 text-gold-300',
            )}
            style={{ background: locked ? 'radial-gradient(circle at 35% 30%, #2a2f3a, #12151b 75%)' : 'radial-gradient(circle at 35% 30%, #2b4268, #0b1424 75%)' }}
          >
            <Sigil name={locked ? 'diamond' : 'star'} size={17} />
          </span>
          {legacy.name}
        </span>
        {locked ? (
          <span className="chip chip--iron !min-h-7 shrink-0 !text-[0.75rem]">Not earned</span>
        ) : chosen ? (
          <span className="chip chip--gold !min-h-7 shrink-0 !text-[0.75rem]">
            <Icon name="check" size={13} /> Carried
          </span>
        ) : (
          <span className="chip !min-h-7 shrink-0 !text-[0.75rem]">Earned</span>
        )}
      </span>
      <span className="mt-2 block text-[0.98rem] leading-snug text-parchment-100">{legacy.effect}</span>
      <span className="mt-2 block text-[0.92rem] leading-snug text-ember-200">
        <span className="font-semibold">The cost: </span>
        {legacy.cost}
      </span>
      <span className="mt-2 block border-t border-gold-800/40 pt-2 text-[0.88rem] leading-snug text-parchment-300">
        {legacy.earn}
        {legacy.progress ? <span className="block text-parchment-400">{legacy.progress}</span> : null}
      </span>
    </>
  );
  if (locked) {
    return (
      <li
        className="animate-fade-up rounded-[0.9rem] border border-stone-600/40 p-4 opacity-80"
        style={{ animationDelay: `${index * 60}ms`, background: 'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.015) 0 6px, transparent 6px 12px), linear-gradient(180deg, #12151b, #0b1018)' }}
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
          'relative block h-full w-full overflow-hidden rounded-[0.9rem] border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-gold-300 before:via-gold-500/50 before:to-transparent',
          chosen
            ? 'border-gold-400 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(255_233_174/0.2),transparent_60%),linear-gradient(180deg,#24324a,#121b2d)] shadow-[0_0_0_1px_rgb(227_196_99/0.4),0_0_34px_-8px_rgb(227_196_99/0.6)]'
            : 'border-gold-700/55 bg-[radial-gradient(100%_80%_at_0%_0%,rgb(227_196_99/0.08),transparent_60%),linear-gradient(180deg,#1b2639,#0f1726)] shadow-[inset_0_1px_0_rgb(255_244_214/0.08),0_14px_28px_-16px_rgb(0_0_0/0.9)] hover:border-gold-500/80 before:opacity-40',
        )}
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
