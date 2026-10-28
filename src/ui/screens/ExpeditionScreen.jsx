// The march (Cycle doc §7: "the castle run becomes Elvia's march"; Master Build §8: the region's
// state changes the scene). A cinematic beat: the place, who speaks, what you can do. Duels take
// the whole screen. Never shows a choice's result before it is chosen.

import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { Button, Sheet } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { Portrait, RegionScene } from '../art/index.js';
import { DuelScreen } from '../duel/DuelScreen.jsx';
import { MarchRail } from './expedition/MarchRail.jsx';
import { ChoiceList } from './expedition/ChoiceList.jsx';
import { DuelOutcome, FallenNames } from './expedition/DuelOutcome.jsx';
import { smartQuotes, speakerName, unquote } from './expedition/words.js';

function Hero({ beat, region }) {
  return (
    <div className="relative -mx-4 h-[38vh] min-h-56 overflow-hidden sm:-mx-6 sm:h-[44vh] sm:rounded-b-[var(--radius-panel)] lg:mx-0 lg:mt-2 lg:rounded-[var(--radius-panel)]">
      <RegionScene
        beat={beat.scene?.beat ?? beat.id}
        regionState={region.state}
        timeOfDay={beat.scene?.timeOfDay ?? 'day'}
        monuments={region.monuments}
        className="absolute inset-0 h-full w-full"
        label={`${beat.title}, ${region.name}`}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-6">
        <p className="font-display text-[0.78rem] uppercase tracking-[0.22em] text-gold-300 text-engraved">{beat.subtitle}</p>
        <h1 id="ex-title" className="mt-1 font-display text-[2.1rem] leading-[1.05] text-gilded text-glow-gold sm:text-5xl">
          {beat.title}
        </h1>
      </div>
    </div>
  );
}

function Speaker({ speaker, state, text }) {
  if (!speaker) return null;
  const line = unquote(speaker.line);
  const echoed = text.some((t) => t.includes(line));
  return (
    <figure className="mb-5 flex items-start gap-3 animate-fade-up">
      <Portrait id={speaker.id} size={64} mood={speaker.id === 'sparky' ? 'warm' : 'neutral'} label={speakerName(state, speaker.id)} />
      <div className="min-w-0 pt-1">
        <figcaption className="font-display text-[0.95rem] text-gold-200">{speakerName(state, speaker.id)}</figcaption>
        {echoed ? null : <blockquote className="mt-1 font-serif text-[1.25rem] italic leading-snug text-parchment-50">{smartQuotes(speaker.line)}</blockquote>}
      </div>
    </figure>
  );
}

function LastResult({ result, beatId }) {
  if (!result || !result.lines?.length || result.beat !== beatId) return null;
  return (
    <div aria-live="polite" className="mb-5 rounded-[var(--radius-panel)] border border-gold-600/45 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(227_196_99/0.12),transparent_60%),rgb(11_20_36/0.8)] p-4 animate-fade-up">
      <p className="font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">{result.label}</p>
      <div className="mt-2 space-y-2">
        {result.lines.map((l, i) => (
          <p key={i} className="font-serif text-[1.15rem] leading-relaxed text-parchment-50">
            {smartQuotes(l)}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ExpeditionScreen() {
  const { state, view, act, settings } = useGame();
  const [retreating, setRetreating] = useState(false);
  const exp = view?.expedition;
  const beat = view?.beat;
  if (!exp || !beat) return null;

  if (exp.pendingDuel) {
    return (
      <DuelScreen
        key={`${exp.id}-${beat.id}-${exp.duels.length}`}
        config={exp.pendingDuel}
        showHints={settings.showHints}
        onComplete={(result) => act({ type: 'EXPEDITION_DUEL_COMPLETE', result })}
      />
    );
  }

  const region = state.regions.southern_marches;
  const afterDuel = exp.phase !== 'main' && exp.lastDuel;
  const isCamp = beat.id === 'camp';
  const pick = (choice) => act({ type: 'EXPEDITION_CHOICE', choiceId: choice.id });

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-navy-950" aria-labelledby="ex-title">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="sticky top-0 z-30 -mx-4 chrome-bar px-4 pb-1 sm:-mx-6 sm:px-6" style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}>
          <TopBar subtitle={exp.title} />
        </div>
        <Hero beat={beat} region={region} />
        <MarchRail beats={exp.beats} index={exp.index} className="mt-4" />

        <div className="mt-6 grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            {afterDuel ? (
              <div className="mb-5">
                <DuelOutcome lastDuel={exp.lastDuel} beatId={beat.id} />
              </div>
            ) : null}
            <LastResult result={exp.lastResult} beatId={beat.id} />
            <Speaker speaker={beat.speaker} state={state} text={beat.text} />
            <div className="mb-6 max-w-prose space-y-4">
              {beat.text.map((t, i) => (
                <p key={i} className="font-serif text-[1.2rem] leading-relaxed text-parchment-100 animate-fade-up" style={{ animationDelay: `${80 + i * 90}ms` }}>
                  {smartQuotes(t)}
                </p>
              ))}
            </div>
            {isCamp && exp.fallen?.length ? (
              <div className="mb-6">
                <FallenNames names={exp.fallen} title="The roll at the camp" />
              </div>
            ) : null}
          </div>
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <ChoiceList choices={beat.choices} onPick={pick} isFinalBeat={isCamp} />
            {view.canRetreat ? (
              <div className="mt-6 border-t border-gold-800/40 pt-4">
                <Button variant="ghost" icon="back" onClick={() => setRetreating(true)}>
                  Turn back to the War Room
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet
        open={retreating}
        onClose={() => setRetreating(false)}
        eyebrow="Retreat is recorded"
        title="Turn back?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetreating(false)}>
              Keep marching
            </Button>
            <Button variant="danger" icon="back" onClick={() => act({ type: 'EXPEDITION_RETREAT' })}>
              Turn back
            </Button>
          </>
        }
      >
        <p className="flex gap-2 font-serif text-[1.15rem] leading-relaxed text-parchment-100">
          <Icon name="alert" size={20} className="mt-1 shrink-0 text-ember-300" />
          The Chronicle will record that the Sovereign turned back. Mara will remember it, and champions will hear of it.
        </p>
      </Sheet>
    </main>
  );
}
