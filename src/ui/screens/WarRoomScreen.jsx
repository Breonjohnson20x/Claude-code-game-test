// The War Room (Master Build §17, "the heart of the game"): the crisis, the Council, orders A–E,
// a decree of your own, the Trial of Blades and abdication. Renders the view; never decides.

import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { ResourceHud } from '../kit/kit.jsx';
import { WarRoomBackdrop } from '../art/index.js';
import { DuelScreen } from '../duel/DuelScreen.jsx';
import { historyCallbacks } from '../../game/content/crises.js';
import { ScreenShell } from './warroom/shared.jsx';
import { CrisisHero, ChronicleRemembers, Briefing, Conflict } from './warroom/Crisis.jsx';
import { Council } from './warroom/Council.jsx';
import { Orders } from './warroom/Orders.jsx';
import { CustomDecree } from './warroom/CustomDecree.jsx';
import { TrialAndAbdication, TrialSheet } from './warroom/Trial.jsx';

/** Reign II+ opens with a return line and memories of earlier reigns; split them out. */
function splitBriefing(state, briefing) {
  if (state.cycle.number < 2 || state.turn !== 1) return { intro: [], memory: [], lines: briefing };
  const memory = historyCallbacks(state);
  const start = briefing.indexOf(memory[0]);
  if (!memory.length || start < 0) return { intro: [], memory: [], lines: briefing };
  return { intro: briefing.slice(0, start), memory, lines: briefing.slice(start + memory.length) };
}

export function WarRoomScreen() {
  const { state, view, act, aiOn, generators, settings } = useGame();
  const [trialOpen, setTrialOpen] = useState(false);

  if (!view?.crisis) return null;
  const { crisis } = view;

  if (state.trial?.pending) {
    return (
      <DuelScreen
        key={`trial-${state.trial.count}`}
        config={state.trial.pending}
        showHints={settings.showHints}
        onComplete={(result) => act({ type: 'TRIAL_COMPLETE', result })}
      />
    );
  }

  const threats = {
    syndicate: state.threads.IRON_SYNDICATE_BORDER_CRISIS?.urgency,
    wargs: state.threads.FROST_WARG_MIGRATION?.urgency,
    refugees: state.threads.NORTHERN_REFUGEES?.urgency,
  };
  const { intro, memory, lines } = splitBriefing(state, crisis.briefing);
  const advisors = crisis.advisors ?? [];

  return (
    <ScreenShell labelledBy="wr-title" backdrop={<WarRoomBackdrop threats={threats} regionState={state.regions.southern_marches.state} dim />}>
      {/* opaque, unblurred HUD: a backdrop-filter here would re-blur the animated table every frame */}
      <div
        className="sticky top-0 z-30 -mx-4 chrome-bar px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ background: 'var(--elvia-brush), linear-gradient(180deg, #0f1b2d 0%, #0b1424 100%)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <TopBar />
        <ResourceHud resources={state.resources} compact />
      </div>

      <CrisisHero view={view} state={state} headingId="wr-title" />

      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <ChronicleRemembers lines={memory} cycle={state.cycle.number} />
          <Briefing intro={intro} lines={lines} />
          <Conflict text={crisis.conflict} />
          <Council advisors={advisors} characters={state.characters} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <Orders
            crisis={crisis}
            characters={state.characters}
            onIssue={(order) => act({ type: 'ISSUE_ORDER', orderId: order.id })}
          />
          <CustomDecree
            state={state}
            crisis={crisis}
            aiOn={aiOn}
            generators={generators}
            onIssue={({ text, interpretation }) => act({ type: 'ISSUE_CUSTOM_ORDER', text, interpretation })}
          />
          <TrialAndAbdication
            rewardAvailable={view.trialRewardAvailable}
            last={state.trial?.last}
            onOpenTrial={() => setTrialOpen(true)}
            onAbdicate={() => act({ type: 'ABDICATE' })}
          />
        </div>
      </div>

      <TrialSheet
        open={trialOpen}
        rewardAvailable={view.trialRewardAvailable}
        onClose={() => setTrialOpen(false)}
        onFight={(archetypeId) => {
          setTrialOpen(false);
          act({ type: 'TRIAL_START', archetypeId });
        }}
      />
    </ScreenShell>
  );
}
