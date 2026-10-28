import { cx } from '../../kit/kit.jsx';
import { ArchitectSymbol, CampfireScene } from '../../art/index.js';

// Cause shades the light: a fall burns low and red, an abdication is moonlit stone, an era is gold.
const ACCENT_WASH = {
  ember: 'radial-gradient(90% 60% at 50% 100%, rgb(158 43 37 / 0.22), transparent 70%)',
  stone: 'radial-gradient(90% 60% at 50% 0%, rgb(184 198 209 / 0.08), transparent 70%)',
  gold: 'radial-gradient(90% 60% at 50% 0%, rgb(227 196 99 / 0.08), transparent 70%)',
};

/** Fixed, decorative backdrop for each step of the Passing. */
export function PassingBackdrop({ step, accent = 'gold', reduced = false }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-navy-950">
      {step === 'campfire' ? (
        <>
          {/* The last fire burns low in the middle distance; text and cards sit over a scrim that
              keeps the sky and the fire's glow alive between them. */}
          <CampfireScene intensity={0.55} fireY={[0.7, 0.72]} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_13_24/0.6)_0%,rgb(7_13_24/0.42)_30%,rgb(7_13_24/0.55)_55%,rgb(7_13_24/0.8)_82%,#070d18_100%)]" />
          <div className="absolute inset-y-0 left-1/2 hidden w-[56rem] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_35%,rgb(7_13_24/0.4),transparent_100%)] sm:block" />
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
      <div className="vignette absolute inset-0" />
    </div>
  );
}
