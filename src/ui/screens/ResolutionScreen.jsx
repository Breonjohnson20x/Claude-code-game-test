// Resolution (Master Build §20): the cinematic report of what the Crown's order did, then the
// choice of what comes next. Every number and sentence comes from the simulation's report.

import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { Eyebrow, ResourceHud } from '../kit/kit.jsx';
import { RegionScene } from '../art/index.js';
import { ScreenShell } from './warroom/shared.jsx';
import { categoryWords } from './warroom/words.js';
import { Outcome, Events, Changes, Memories, Voices, NewChronicle, MarchSummary } from './resolution/Report.jsx';
import { Decisions } from './resolution/Decisions.jsx';

function Headline({ report }) {
  const custom = report.custom;
  return (
    <header className="relative pb-6 pt-8 sm:pt-12">
      <Eyebrow className="!text-gold-300 animate-fade-up">
        {report.season} · {custom ? 'A royal decree' : `Order ${report.orderId} · ${categoryWords(report.category)}`}
      </Eyebrow>
      <h1 id="rs-title" className="mt-3 max-w-3xl font-display text-[2.2rem] leading-[1.05] text-gilded text-glow-gold sm:text-5xl animate-fade-up" style={{ animationDelay: '60ms' }}>
        {custom ? 'Royal Decree' : report.orderLabel}
      </h1>
      {custom ? (
        <blockquote className="mt-4 max-w-2xl border-l-2 border-gold-500/70 pl-4 font-serif text-[1.3rem] italic leading-snug text-gold-100 animate-fade-up" style={{ animationDelay: '120ms' }}>
          &ldquo;{custom.text}&rdquo;
        </blockquote>
      ) : null}
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
        <>
          <RegionScene beat="road" regionState={region.state} timeOfDay="dusk" monuments={region.monuments} className="h-full w-full opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 via-navy-950/85 to-navy-950" />
        </>
      }
    >
      <div className="sticky top-0 z-30 -mx-4 chrome-bar px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <TopBar />
        <ResourceHud resources={state.resources} deltas={report.resourceDeltas} compact />
      </div>

      <Headline report={report} />

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
