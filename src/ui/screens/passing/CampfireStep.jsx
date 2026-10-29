import { useEffect, useState } from 'react';
import { Button, cx } from '../../kit/kit.jsx';
import { CampfireScene, Portrait } from '../../art/index.js';
import { smartQuotes } from '../expedition/words.js';
import { tierChip } from '../../overlays/dossier/words.js';
import { ActionBar } from './ActionBar.jsx';
import { StepHeader } from './StepHeader.jsx';

const REVEAL_MS = 1150;
const WARM = new Set(['Close', 'Trusted', 'Fond']);
const COLD = new Set(['Hostile', 'Wary']);

function Farewell({ f, index }) {
  const mood = WARM.has(f.tier) ? 'warm' : COLD.has(f.tier) ? 'grim' : 'neutral';
  return (
    <li className="animate-fade-up" style={{ animationDelay: '40ms' }}>
      <figure className="relative flex gap-3.5 rounded-2xl border border-ember-500/25 bg-[radial-gradient(120%_100%_at_0%_100%,rgb(224_120_43/0.16),transparent_60%),linear-gradient(180deg,rgb(15_27_45/0.82),rgb(7_13_24/0.88))] p-4 shadow-[0_14px_30px_-16px_rgb(0_0_0/0.9)] sm:gap-5 sm:p-5">
        <Portrait id={f.id} size={64} mood={mood} className="shrink-0 drop-shadow-[0_0_14px_rgb(224_120_43/0.35)] sm:hidden" />
        <Portrait id={f.id} size={84} mood={mood} className="hidden shrink-0 drop-shadow-[0_0_16px_rgb(224_120_43/0.35)] sm:block" />
        <div className="min-w-0 flex-1">
          <figcaption className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-display text-[1.02rem] leading-snug text-gold-200">{f.name}</span>
            <span className={cx(tierChip(f.tier), '!min-h-7 !text-[0.78rem]')}>{f.tier}</span>
          </figcaption>
          <blockquote className="mt-2 font-serif text-[1.18rem] leading-relaxed text-parchment-100">{smartQuotes(f.line)}</blockquote>
        </div>
        <span className="sr-only">Voice {index + 1}</span>
      </figure>
    </li>
  );
}

/** Step I — the final campfire: whoever stands with you, speaks. */
export function CampfireStep({ view, tone, reduced, onNext, headingRef }) {
  const farewells = view.farewells ?? [];
  const [shown, setShown] = useState(() => Math.min(1, farewells.length));
  // Under reduced motion everyone has spoken at once.
  const visible = reduced ? farewells.length : shown;
  const all = visible >= farewells.length;

  useEffect(() => {
    if (reduced || all) return undefined;
    const t = setTimeout(() => setShown((n) => Math.min(n + 1, farewells.length)), REVEAL_MS);
    return () => clearTimeout(t);
  }, [shown, all, reduced, farewells.length]);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <StepHeader headingRef={headingRef} eyebrow={tone.eyebrow(view.sovereign)} title="The Last Fire" seal={tone.seal} lead={tone.campfire} />
        {/* On a phone the last fire burns here, in a strip of its own between the words and the
            voices, so no card ever covers it (wide screens show it in the backdrop). */}
        <div aria-hidden="true" className="relative -mx-4 mt-5 h-[248px] [mask-image:linear-gradient(180deg,transparent,#000_16%,#000_84%,transparent)] sm:-mx-6 sm:h-[300px] lg:hidden">
          <CampfireScene intensity={0.55} variant="last" fireY={0.8} zoom={2.2} moon={[0.68, 0.16]} />
        </div>
        <p className="mt-5 font-display text-[0.95rem] uppercase tracking-[0.2em] text-ember-200 text-glow-ember">Whoever stands with you, speaks</p>
        <ActionBar className="max-lg:hidden" note={<span>Nothing here can be lost by moving on.</span>}>
          <Button icon="forward" onClick={onNext} className="lg:min-w-64">
            Continue to the Chronicle
          </Button>
        </ActionBar>
      </div>

      <div className="mt-6 lg:mt-0">
        {farewells.length ? (
          <>
            <ol className="space-y-3" aria-live="polite" aria-label="Farewells at the last fire">
              {farewells.slice(0, visible).map((f, i) => (
                <Farewell key={f.id} f={f} index={i} />
              ))}
            </ol>
            {!all ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[0.92rem] italic text-parchment-300" aria-hidden="true">
                  <span className="inline-block size-1.5 rounded-full bg-ember-300 shadow-[0_0_8px_rgb(244_163_94/0.9)] animate-torch-flicker" />
                  Someone else is gathering their words…
                </p>
                <button
                  type="button"
                  onClick={() => setShown(farewells.length)}
                  className="inline-flex min-h-11 min-w-11 items-center rounded-lg px-3 text-[0.92rem] font-semibold text-gold-300 underline decoration-gold-600/60 underline-offset-4 hover:text-gold-200 focus-visible:outline-2 focus-visible:outline-lattice-200"
                >
                  Let everyone speak
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl border border-ember-500/25 bg-navy-950/70 p-5 font-serif text-[1.18rem] italic leading-relaxed text-parchment-200">
            No one is left to speak tonight. The fire speaks for them, and then it too goes quiet.
          </p>
        )}
      </div>

      <ActionBar className="lg:hidden" note={<span>Nothing here can be lost by moving on.</span>}>
        <Button icon="forward" onClick={onNext}>
          Continue to the Chronicle
        </Button>
      </ActionBar>
    </div>
  );
}
