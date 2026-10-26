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
        <span className="flex items-center gap-2 font-display text-[1.08rem] leading-tight text-gold-100">
          <Sigil name={locked ? 'diamond' : 'star'} size={16} className={locked ? 'text-stone-500' : 'text-gold-400'} />
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
      <li className="animate-fade-up rounded-[var(--radius-panel)] border border-stone-600/40 bg-navy-950/70 p-4 opacity-75" style={{ animationDelay: `${index * 60}ms` }}>
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
          'block h-full w-full rounded-[var(--radius-panel)] border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
          chosen
            ? 'border-gold-400 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(255_233_174/0.18),transparent_60%),rgb(22_36_58/0.95)] shadow-[0_0_0_1px_rgb(227_196_99/0.35),0_0_30px_-8px_rgb(227_196_99/0.5)]'
            : 'border-gold-700/45 bg-navy-900/85 hover:border-gold-500/80',
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
