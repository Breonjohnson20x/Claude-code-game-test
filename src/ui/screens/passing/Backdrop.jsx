import { useEffect, useState } from 'react';
import { cx } from '../../kit/kit.jsx';
import { ArchitectSymbol, CampfireScene } from '../../art/index.js';

// Cause shades the light: a fall burns low and red, an abdication is moonlit stone, an era is gold.
const ACCENT_WASH = {
  ember: 'radial-gradient(90% 60% at 50% 100%, rgb(158 43 37 / 0.22), transparent 70%)',
  stone: 'radial-gradient(90% 60% at 50% 0%, rgb(184 198 209 / 0.08), transparent 70%)',
  gold: 'radial-gradient(90% 60% at 50% 0%, rgb(227 196 99 / 0.08), transparent 70%)',
};

// The Passing's wide layout (lg and up): a max-w-6xl container with px-8, and step I's two columns
// at 5fr / 7fr with a 3rem gap. The last fire sits under the middle of the left column.
function leftColumnCentre(w) {
  const box = Math.min(w, 1152);
  const inner = box - 64;
  const col = ((inner - 48) * 5) / 12;
  return (w - box) / 2 + 32 + col / 2;
}

function useLeftColumnCentre(on) {
  const read = () => (typeof window === 'undefined' ? 0.27 : Math.round((leftColumnCentre(window.innerWidth) / window.innerWidth) * 200) / 200);
  const [x, setX] = useState(read);
  useEffect(() => {
    if (!on) return undefined;
    const update = () => setX(read());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [on]);
  return x;
}

/** Fixed, decorative backdrop for each step of the Passing. */
export function PassingBackdrop({ step, accent = 'gold', reduced = false }) {
  const fireX = useLeftColumnCentre(step === 'campfire');
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-navy-950">
      {step === 'campfire' ? (
        <>
          {/* The Last Fire, on a wide screen: a struck camp under frost, the Sovereign alone by a low
              red-gold fire, set in the empty lower half of the left column so no card ever covers it.
              On a phone the fire burns in a strip of its own inside the step (CampfireStep). */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_105%,rgb(158_43_37/0.2),transparent_70%),linear-gradient(180deg,#0b1424,#070d18_60%)] lg:hidden" />
          <CampfireScene
            intensity={0.55}
            variant="last"
            fireX={fireX}
            fireY={0.9}
            moon={[0.92, 0.17]}
            className="hidden lg:block"
            scrim={
              <>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_13_24/0.55)_0%,rgb(7_13_24/0.28)_40%,rgb(7_13_24/0)_68%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_13_24/0)_38%,rgb(7_13_24/0.45)_55%,rgb(7_13_24/0.45)_100%)]" />
              </>
            }
          />
        </>
      ) : null}

      {step === 'chronicle' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,rgb(224_120_43/0.16),transparent_70%),radial-gradient(60%_50%_at_85%_60%,rgb(227_196_99/0.07),transparent_70%),linear-gradient(180deg,#0f1b2d,#0b1424_45%,#070d18)]" />
          <ArchitectSymbol size={720} glow={0.15} ticks className="absolute -right-56 top-24 opacity-[0.05]" />
        </>
      ) : null}

      {step === 'legacies' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_0%,rgb(227_196_99/0.12),transparent_70%),linear-gradient(180deg,#0f1b2d,#0b1424_50%,#070d18)]" />
          <ArchitectSymbol size={560} glow={0.3} animated={!reduced} className="absolute left-1/2 top-[-120px] -translate-x-1/2 opacity-[0.09]" />
        </>
      ) : null}

      {step === 'mantle' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_42%,rgb(227_196_99/0.2),transparent_70%),radial-gradient(120%_70%_at_50%_120%,rgb(224_120_43/0.18),transparent_60%),linear-gradient(180deg,#0b1424,#070d18)]" />
          <div className={cx('absolute left-1/2 top-[40%] size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-500/10', !reduced && 'animate-slow-glow')} />
          <div className="absolute left-1/2 top-[40%] size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-500/10" />
        </>
      ) : null}

      <div className="absolute inset-0" style={{ background: ACCENT_WASH[accent] ?? ACCENT_WASH.gold }} />
      {/* the last fire's scene darkens its own edges; a vignette over it would dim the fire */}
      <div className={cx('vignette absolute inset-0', step === 'campfire' && 'lg:hidden')} />
    </div>
  );
}
