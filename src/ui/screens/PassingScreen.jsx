// The Passing (Cycle doc §2, §8): the four-step ceremony that ends a reign. I The Last Fire ·
// II The Chronicle · III What Survives You · IV The Mantle Passes. The cause (fall, abdication,
// era) shades every step. The game drives the step; this screen only presents it.

import { useCallback, useEffect, useRef } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { useReducedMotion } from './warroom/words.js';
import { PassingBackdrop } from './passing/Backdrop.jsx';
import { StepIndicator } from './passing/StepIndicator.jsx';
import { CampfireStep } from './passing/CampfireStep.jsx';
import { ChronicleStep } from './passing/ChronicleStep.jsx';
import { LegaciesStep } from './passing/LegaciesStep.jsx';
import { MantleStep } from './passing/MantleStep.jsx';
import { toneFor } from './passing/copy.js';

export function PassingScreen() {
  const { state, view, act, aiOn, generators } = useGame();
  const reduced = useReducedMotion();
  const headingRef = useRef(null);
  const step = view?.passing?.step ?? 'campfire';

  // Each new step starts at the top, with focus on its heading.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const next = useCallback(() => act({ type: 'PASSING_NEXT' }), [act]);
  const pass = useCallback(() => act({ type: 'BEGIN_NEXT_CYCLE' }), [act]);
  if (!view?.passing) return null;
  const tone = toneFor(view.passing.cause);

  return (
    <main className="relative min-h-dvh overflow-x-clip" aria-labelledby="passing-heading">
      <PassingBackdrop step={step} accent={tone.accent} reduced={reduced} />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8" style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <TopBar subtitle="The Passing" />
        <StepIndicator step={step} className="mx-auto mb-8 mt-4 max-w-2xl" />
        {step === 'campfire' ? <CampfireStep view={view} tone={tone} reduced={reduced} onNext={next} headingRef={headingRef} /> : null}
        {step === 'chronicle' ? (
          <ChronicleStep view={view} state={state} tone={tone} onNext={next} headingRef={headingRef} aiOn={aiOn} generators={generators} />
        ) : null}
        {step === 'legacies' ? <LegaciesStep view={view} tone={tone} onChoose={(ids) => act({ type: 'PASSING_CHOOSE_LEGACIES', ids })} headingRef={headingRef} /> : null}
        {step === 'mantle' ? <MantleStep view={view} state={state} tone={tone} reduced={reduced} onPass={pass} headingRef={headingRef} /> : null}
      </div>
    </main>
  );
}
