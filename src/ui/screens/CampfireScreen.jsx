// The campfire (Master Build §23–25): a quiet scene at a believable pause. Enter for the full
// conversation, take a short moment, or skip — skipping never costs anything.
// Lines are paced with CSS animation delays (instant under reduced motion), never with timers.

import { useEffect, useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { TopBar } from '../game/TopBar.jsx';
import { Button, cx } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { CampfireScene, Portrait } from '../art/index.js';
import { smartQuotes } from './expedition/words.js';

const STEP = 650; // ms between paced lines

function Lines({ lines, start = 0, className }) {
  return (
    <div className={cx('space-y-4', className)}>
      {lines.map((l, i) => (
        <p
          key={i}
          className="font-serif text-[1.22rem] leading-relaxed text-parchment-50 animate-fade-up"
          style={{ animationDelay: `${start + i * STEP}ms`, animationDuration: '1.1s' }}
        >
          {smartQuotes(l)}
        </p>
      ))}
    </div>
  );
}

function Sparky({ text, delay }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-acid-600/30 bg-navy-950/55 p-4 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Portrait id="sparky" size={52} mood="warm" label="Sparky" />
      <p className="font-serif text-[1.15rem] italic leading-relaxed text-parchment-100">{text}</p>
    </div>
  );
}

function Choose({ offer, onPick }) {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <p className="font-display text-[0.8rem] uppercase tracking-[0.24em] text-ember-300">By the fire · {offer.topic}</p>
        <p className="mt-3 font-serif text-[1.35rem] italic leading-snug text-parchment-50">{offer.prompt}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <li>
          <button type="button" onClick={() => onPick('enter')} className="order-card h-full !items-start">
            <span className="order-card__key" aria-hidden="true">
              <Icon name="fire" size={20} />
            </span>
            <span className="order-card__body">
              <span className="order-card__title">Sit with Mara</span>
              <span className="order-card__desc">The whole conversation. Say what you mean.</span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onPick('short')} className="order-card h-full !items-start">
            <span className="order-card__key" aria-hidden="true">
              <Icon name="heart" size={20} />
            </span>
            <span className="order-card__body">
              <span className="order-card__title">A short moment</span>
              <span className="order-card__desc">Sit a while. Not every night needs words.</span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onPick('skip')} className="order-card h-full !items-start">
            <span className="order-card__key" aria-hidden="true">
              <Icon name="forward" size={20} />
            </span>
            <span className="order-card__body">
              <span className="order-card__title">Skip the fire</span>
              <span className="order-card__desc">Skipping costs nothing. The fire will be there another night.</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}

function Conversation({ scene, onRespond }) {
  const afterLines = scene.lines.length * STEP;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-up">
        <Portrait id="mara" size={60} mood="warm" label="General Mara Voss" />
        <p className="font-display text-[0.8rem] uppercase tracking-[0.24em] text-ember-300">By the fire · {scene.topic}</p>
      </div>
      <Lines lines={scene.lines} start={200} />
      <p className="font-serif text-[1.4rem] italic leading-snug text-gold-100 animate-fade-up" style={{ animationDelay: `${200 + afterLines}ms` }}>
        {smartQuotes(scene.question)}
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2 animate-fade-up" style={{ animationDelay: `${450 + afterLines}ms` }} aria-label="Your answer">
        {scene.responses.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onRespond(r)}
              className="flex min-h-14 w-full flex-col items-start gap-0.5 rounded-xl border border-ember-500/35 bg-navy-950/70 px-4 py-3 text-left transition hover:border-ember-300/80 hover:bg-navy-900/80 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200"
            >
              <span className="font-display text-[0.72rem] uppercase tracking-[0.22em] text-ember-300">{r.tone}</span>
              <span className="font-serif text-[1.15rem] leading-snug text-parchment-50">{r.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reply({ response, scene, extra, onBank }) {
  const n = response.reply.length;
  return (
    <div className="space-y-6" aria-live="polite">
      <p className="font-serif text-[1.2rem] italic text-gold-200 animate-fade-up">{smartQuotes(response.label)}</p>
      <Lines lines={response.reply} start={200} />
      <Sparky text={scene.sparky?.text} delay={300 + n * STEP} />
      {extra?.length ? (
        <div className="animate-fade-up" style={{ animationDelay: `${500 + n * STEP}ms` }}>
          <Lines lines={extra} />
          <p className="mt-2 text-[0.85rem] text-parchment-400">Narrated by Claude</p>
        </div>
      ) : null}
      <div className="animate-fade-up" style={{ animationDelay: `${600 + n * STEP}ms` }}>
        <Button icon="fire" onClick={onBank}>
          Bank the fire
        </Button>
      </div>
    </div>
  );
}

function Short({ scene, onBank }) {
  const n = scene.lines.length;
  return (
    <div className="space-y-6" aria-live="polite">
      <Lines lines={scene.lines} start={200} />
      <Sparky text={scene.sparky?.text} delay={300 + n * STEP} />
      <div className="animate-fade-up" style={{ animationDelay: `${500 + n * STEP}ms` }}>
        <Button icon="fire" onClick={onBank}>
          Bank the fire
        </Button>
      </div>
    </div>
  );
}

export function CampfireScreen() {
  const { state, view, act, aiOn, generators } = useGame();
  const [mode, setMode] = useState(null); // null | 'enter' | 'short'
  const [response, setResponse] = useState(null);
  const [extra, setExtra] = useState(null);

  // Optional narrator voices after an answer: never blocks; authored text stands alone.
  useEffect(() => {
    if (!response || !aiOn || !view?.scene) return undefined;
    let live = true;
    generators
      .campfire({ state, participants: ['mara', 'sparky'], topic: view.scene.topic, mood: response.tone }, () => null)
      .then((r) => {
        if (!live || r?.source === 'fallback' || !r?.output?.lines?.length) return;
        setExtra(r.output.lines);
        if (r.proposals?.length) act({ type: 'APPLY_AI_EFFECTS', effects: r.proposals });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // Run once per chosen answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  if (!view?.offer) return null;
  const pick = (m) => {
    if (m === 'skip') act({ type: 'CAMPFIRE_COMPLETE', mode: 'skip' });
    else setMode(m);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-navy-950" aria-labelledby="cf-title">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <CampfireScene intensity={0.7} />
        <div className="absolute inset-0 bg-[radial-gradient(130%_85%_at_50%_100%,transparent_35%,rgb(5_7_12/0.7)_80%)]" />
        <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-navy-950/85 via-navy-950/45 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 sm:px-6" style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <TopBar subtitle="The camp, after dark" />
        <h1 id="cf-title" className="mt-8 font-display text-[2.2rem] leading-tight text-gilded text-glow-ember sm:text-5xl animate-fade-in">
          The Fire
        </h1>
        <div className="mt-6 flex-1">
          {mode === null ? <Choose offer={view.offer} onPick={pick} /> : null}
          {mode === 'enter' && !response ? <Conversation scene={view.scene} onRespond={setResponse} /> : null}
          {mode === 'enter' && response ? (
            <Reply response={response} scene={view.scene} extra={extra} onBank={() => act({ type: 'CAMPFIRE_COMPLETE', mode: 'enter', responseId: response.id })} />
          ) : null}
          {mode === 'short' ? <Short scene={view.shortScene} onBank={() => act({ type: 'CAMPFIRE_COMPLETE', mode: 'short' })} /> : null}
        </div>
      </div>
    </main>
  );
}
