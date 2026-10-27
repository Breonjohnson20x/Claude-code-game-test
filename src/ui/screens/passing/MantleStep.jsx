// Step IV — The Mantle Passes: the reign summed up, then one great button. A short, skippable
// transition (gold light, "The Lattice weaves you again…") plays before the new reign; under
// reduced motion the new reign begins at once.

import { useEffect, useState } from 'react';
import { Button } from '../../kit/kit.jsx';
import { ArchitectSymbol, Sigil } from '../../art/index.js';
import { legacyName, LEGACIES } from '../../../game/content/legacies.js';
import { causeWord } from '../../overlays/chronicle/meta.js';
import { StepHeader } from './StepHeader.jsx';
import { WEAVE_LINE } from './copy.js';

const WEAVE_MS = 1800;

function Weave({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, WEAVE_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="The Lattice weaves you again. Continue now"
      className="fixed inset-0 z-[80] grid cursor-pointer place-items-center bg-navy-950 animate-fade-in"
      style={{ animationDuration: '0.9s' }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_45%,rgb(255_233_174/0.28),transparent_70%)]" aria-hidden="true" />
      <span className="relative flex flex-col items-center gap-6 px-6 text-center">
        <ArchitectSymbol size={140} glow animated />
        <span className="font-serif text-[1.6rem] italic text-gold-100 animate-fade-up" style={{ animationDelay: '300ms' }}>
          {WEAVE_LINE}
        </span>
      </span>
    </button>
  );
}

export function MantleStep({ view, state, tone, reduced, onPass, headingRef }) {
  const [weaving, setWeaving] = useState(false);
  const entry = state.history.at(-1);
  const chosen = view.passing.chosen ?? [];
  const pass = () => {
    if (reduced) onPass();
    else setWeaving(true);
  };

  return (
    <div className="mx-auto max-w-2xl text-center">
      <StepHeader center headingRef={headingRef} eyebrow={tone.eyebrow(view.sovereign)} title="The Mantle Passes" seal={tone.seal} lead={tone.mantle} />
      <section aria-label="The reign that was" className="panel mt-8 p-5 text-left sm:p-6">
        <p className="font-display text-[0.75rem] uppercase tracking-[0.22em] text-gold-400">The reign that was</p>
        <p className="mt-1 font-display text-[1.5rem] text-gold-100">{entry?.sovereign ?? view.sovereign}</p>
        <p className="text-[1rem] text-parchment-200">
          {entry ? `${entry.startYear}–${entry.endYear} E.R. · ${causeWord(entry.cause)}` : causeWord(view.passing.cause)}
        </p>
        {entry?.highlights?.length ? (
          <ul className="mt-3 space-y-1 font-serif text-[1.1rem] italic text-parchment-100">
            {entry.highlights.slice(0, 4).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-5 font-display text-[0.75rem] uppercase tracking-[0.22em] text-gold-400">Carried across</p>
        {chosen.length ? (
          <ul className="mt-2 space-y-2">
            {chosen.map((id) => (
              <li key={id} className="flex items-start gap-2.5">
                <Sigil name="star" size={16} className="mt-1 shrink-0 text-gold-400" />
                <span>
                  <span className="font-display text-[1rem] text-gold-200">{legacyName(id)}</span>
                  <span className="block text-[0.95rem] text-parchment-200">{LEGACIES[id]?.effect}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-serif text-[1.1rem] italic text-parchment-200">Nothing. Everything became history instead.</p>
        )}
      </section>
      <div className="mt-10 flex flex-col items-center gap-4 pb-6">
        <ArchitectSymbol size={72} glow={0.6} animated={!reduced} />
        <Button icon="crown" className="min-w-64 !text-[1.1rem]" onClick={pass}>
          Pass the mantle
        </Button>
        <p className="max-w-sm text-[0.92rem] text-parchment-300">Decades will pass. The world will have kept living without you.</p>
      </div>
      {weaving ? <Weave onDone={onPass} /> : null}
    </div>
  );
}
