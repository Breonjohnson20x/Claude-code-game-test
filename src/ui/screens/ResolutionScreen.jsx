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
import { Filigree } from './warroom/ornate.jsx';

function Headline({ report }) {
  const custom = report.custom;
  return (
    <header className="relative pb-6 pt-8 sm:pt-12">
      <Eyebrow className="!text-gold-300 animate-fade-up">
        {report.season} · {custom ? 'A royal decree' : `Order ${report.orderId} · ${categoryWords(report.category)}`}
      </Eyebrow>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-8 -top-6 h-[150%] w-[min(40rem,110%)]"
          style={{ background: 'radial-gradient(closest-side, rgb(255 214 150 / 0.14), rgb(224 120 43 / 0.04) 60%, transparent)' }}
        />
        <h1
          id="rs-title"
          className="relative mt-3 max-w-3xl font-display text-[2.2rem] leading-[1.05] text-gilded text-glow-gold sm:text-5xl animate-fade-up"
          style={{ animationDelay: '60ms', filter: 'drop-shadow(0 2px 0 rgb(0 0 0 / 0.55)) drop-shadow(0 10px 18px rgb(0 0 0 / 0.55))' }}
        >
          {custom ? 'Royal Decree' : report.orderLabel}
        </h1>
      </div>
      <Filigree className="mt-3 max-w-[22rem] animate-fade-up [&>span:first-child]:hidden" />
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
          <RegionScene beat="road" regionState={region.state} timeOfDay="dusk" monuments={region.monuments} className="h-full w-full opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/45 via-navy-950/85 to-navy-950" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_40%_at_75%_0%,rgb(255_214_150/0.12),transparent_70%)] mix-blend-screen" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_30px_rgb(3_5_10/0.8)]" />
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
