// Resolution (Master Build §20): the cinematic report of what the Crown's order did, then the
// choice of what comes next. Every number and sentence comes from the simulation's report.

import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { Eyebrow, ResourceHud } from '../kit/kit.jsx';
import { RegionScene } from '../art/index.js';
import { GiltCorners, ScreenShell } from './warroom/shared.jsx';
import { categoryWords } from './warroom/words.js';
import { Outcome, Events, Changes, Memories, Voices, NewChronicle, MarchSummary } from './resolution/Report.jsx';
import { Decisions } from './resolution/Decisions.jsx';
import { TitleRule } from './warroom/ornate.jsx';

// Which stretch of the Marches the hero view shows, by the order's kind (presentation only).
const HERO_BEAT = { military: 'checkpoint', clandestine: 'wilds', research: 'ruin', economic: 'road', diplomacy: 'road' };

// The sticky HUD sits over a still backdrop here, but keep it opaque and unblurred anyway: a
// backdrop-filter re-blurs everything under it on every scrolled frame.
const CHROME = {
  background: 'var(--elvia-brush), linear-gradient(180deg, #0f1b2d 0%, #0b1424 100%)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
};

// The hero art falls away into the page at its foot (a static mask: the art never animates).
const HERO_FADE = 'linear-gradient(180deg, #000 0%, #000 52%, rgb(0 0 0 / 0.45) 78%, transparent 100%)';

/** A view of the Marches at dusk under the HUD; the headline is set over its foot. */
function HeroView({ report, region }) {
  const first = String(report.category ?? '').split('+')[0];
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ WebkitMaskImage: HERO_FADE, maskImage: HERO_FADE }}>
      <RegionScene
        beat={report.custom ? 'road' : (HERO_BEAT[first] ?? 'road')}
        regionState={report.regionAfter ?? region.state}
        timeOfDay="dusk"
        monuments={region.monuments}
        animated={false}
        vignette={false}
        className="absolute inset-0 h-full w-full"
      />
      {/* shade the sky edge and the lower half so the gilt lettering reads */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, rgb(7 13 24 / 0.5) 0%, transparent 26%, transparent 38%, rgb(7 13 24 / 0.72) 66%, rgb(7 13 24 / 0.9) 100%)',
            'radial-gradient(120% 90% at 50% 35%, transparent 55%, rgb(3 5 10 / 0.5) 100%)',
          ].join(','),
        }}
      />
    </div>
  );
}

function Headline({ report, region }) {
  const custom = report.custom;
  return (
    <header className="relative -mx-4 mb-6 sm:mx-0 sm:mt-4 sm:overflow-hidden sm:rounded-[0.9rem] sm:border sm:border-gold-600/40 sm:bg-navy-950/40 sm:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)]">
      <HeroView report={report} region={region} />
      <GiltCorners className="hidden sm:block" />
      <div className="relative px-4 pb-6 pt-[8.5rem] sm:px-8 sm:pb-8 sm:pt-[10rem] lg:pt-[11.5rem]">
        <Eyebrow className="!text-gold-300 animate-fade-up">
          <span style={{ textShadow: '0 1px 0 rgb(0 0 0 / 0.9), 0 0 10px rgb(7 13 24 / 0.9)' }}>
            {report.season} · {custom ? 'A royal decree' : `Order ${report.orderId} · ${categoryWords(report.category)}`}
          </span>
        </Eyebrow>
        <h1
          id="rs-title"
          className="relative mt-2 max-w-3xl font-display text-[2.2rem] leading-[1.05] text-gilded text-glow-gold sm:text-5xl animate-fade-up"
          style={{ animationDelay: '60ms', filter: 'drop-shadow(0 2px 0 rgb(0 0 0 / 0.6)) drop-shadow(0 8px 16px rgb(0 0 0 / 0.7))' }}
        >
          {custom ? 'Royal Decree' : report.orderLabel}
        </h1>
        <TitleRule className="mt-3 max-w-3xl animate-fade-up" />
        {custom ? (
          <blockquote className="mt-4 max-w-2xl border-l-2 border-gold-500/70 pl-4 font-serif text-[1.3rem] italic leading-snug text-gold-100 animate-fade-up" style={{ animationDelay: '120ms' }}>
            &ldquo;{custom.text}&rdquo;
          </blockquote>
        ) : null}
      </div>
    </header>
  );
}

export function ResolutionScreen() {
  const { state, view, act } = useGame();
  const report = view?.report;
  if (!report) return null;
  const region = state.regions.southern_marches;

  return (
    <ScreenShell
      labelledBy="rs-title"
      backdrop={
        // one static layer: a warm key light from above, navy below, the vignette in the same gradient
        <div
          className="absolute inset-0"
          style={{
            background: [
              'radial-gradient(80% 38% at 70% 0%, rgb(255 214 150 / 0.09), transparent 70%)',
              'radial-gradient(130% 90% at 50% 35%, transparent 50%, rgb(3 5 10 / 0.7) 100%)',
              'linear-gradient(180deg, #0f1b2d 0%, #0b1424 40%, #070d18 100%)',
            ].join(','),
          }}
        />
      }
    >
      <div className="sticky top-0 z-30 -mx-4 chrome-bar px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={CHROME}>
        <TopBar />
        <ResourceHud resources={state.resources} deltas={report.resourceDeltas} compact />
      </div>

      <Headline report={report} region={region} />

      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <MarchSummary expedition={view.expedition} />
          <Outcome report={report} />
          <Events events={report.events} />
          <Voices voices={report.voices} />
          <Memories memories={report.newMemories} characters={state.characters} />
        </div>
        <div className="min-w-0">
          <Changes report={report} state={state} />
          <NewChronicle entries={report.newChronicle} state={state} onApprove={(e) => act({ type: 'APPROVE_CHRONICLE', entryId: e.id })} />
        </div>
      </div>

      <Decisions view={view} state={state} act={act} />
    </ScreenShell>
  );
}
