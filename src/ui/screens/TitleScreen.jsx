import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Button, Eyebrow, Sheet } from '../kit/kit.jsx';
import { ArchitectSymbol } from '../art/index.js';
import { StageBackdrop } from '../duel/StageBackdrop.jsx';
import { audio } from '../audio/audio.js';
import { promptInstall, useInstallState } from '../pwa.js';
import { useReducedMotion } from '../art/util.js';
import { LightRays, Motes } from '../art/Atmosphere.jsx';
import { Filigree } from './warroom/ornate.jsx';

// Only opacity breathes, on one small layer; the scene behind is a canvas that animates itself.
const TITLE_STYLE = `@keyframes title-bloom { 0%,100% { opacity: .72 } 50% { opacity: 1 } }`;

/** Fine engraved flourish under the title: two scrolled hairlines meeting at a lozenge. */
function TitleFlourish({ className }) {
  return (
    <svg viewBox="0 0 320 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tf-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a227" stopOpacity="0" />
          <stop offset="0.3" stopColor="#c9a227" />
          <stop offset="0.5" stopColor="#f6e9bd" />
          <stop offset="0.7" stopColor="#c9a227" />
          <stop offset="1" stopColor="#c9a227" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#tf-gold)" strokeLinecap="round">
        <path d="M4 12H128c8 0 10-7 16-7s7 6 3 7-5-1-4-3" strokeWidth="1.1" />
        <path d="M316 12H192c-8 0-10-7-16-7s-7 6-3 7 5-1 4-3" strokeWidth="1.1" />
        <path d="M40 16H124M280 16H196" strokeWidth="0.5" opacity="0.7" />
      </g>
      <path d="M160 3l9 9-9 9-9-9Z" fill="#c9a227" stroke="#f6e9bd" strokeWidth="0.8" />
      <path d="M160 7.5l4.5 4.5-4.5 4.5-4.5-4.5Z" fill="#f6e9bd" opacity="0.7" />
      <circle cx="141" cy="12" r="1.4" fill="#e3c463" />
      <circle cx="179" cy="12" r="1.4" fill="#e3c463" />
    </svg>
  );
}

export function TitleScreen() {
  const { hasAnySave, slots, loadSlot, startNewGame, openOverlay, openTraining, notify } = useGame();
  const install = useInstallState();
  const reduced = useReducedMotion();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('Aurelian');
  const latest = slots
    .filter((s) => s.summary && !s.corrupt)
    .sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))[0];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-navy-950" aria-labelledby="title-heading">
      <style>{TITLE_STYLE}</style>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* the living ruin (its own canvas animates the lights and embers) */}
        <StageBackdrop stage="ruin" noSymbol className="block h-full w-full" />
        {/* one static grade: a warm key light from above, the vignette and the floor falling into
            night, all plain alpha gradients (no blend modes, no inset shadows over the canvas) */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              'radial-gradient(60% 34% at 56% 0%, rgb(255 233 174 / 0.1), transparent 75%)',
              'linear-gradient(0deg, #070d18 0%, rgb(7 13 24 / 0.78) 26%, transparent 55%)',
              'radial-gradient(125% 80% at 50% 40%, rgb(7 13 24 / 0.08) 0%, rgb(7 13 24 / 0.5) 52%, rgb(4 7 13 / 0.94) 100%)',
            ].join(','),
          }}
        />
      </div>
      <div
        className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative mb-5 grid place-items-center" aria-hidden="true">
          {/* a few soft shafts falling on the emblem from above; gone before the title */}
          <LightRays
            className="absolute bottom-[-1.5rem] left-1/2 h-[19rem] w-[22rem] -translate-x-1/2 sm:h-[22rem] sm:w-[28rem]"
            style={{ WebkitMaskImage: 'linear-gradient(180deg, #000 55%, transparent 100%)', maskImage: 'linear-gradient(180deg, #000 55%, transparent 100%)' }}
            rays={5}
            strength={0.3}
            spread={20}
          />
          <span
            className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgb(255 233 174 / 0.3), rgb(224 120 43 / 0.07) 50%, transparent 70%)', animation: reduced ? 'none' : 'title-bloom 6s ease-in-out infinite' }}
          />
          {/* a faint halo ring */}
          <span className="absolute left-1/2 top-1/2 size-[9.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-400/15" />
          {/* dust in the light, on a canvas the size of the emblem's glow */}
          <span className="absolute left-1/2 top-1/2 size-60 -translate-x-1/2 -translate-y-[58%]">
            <Motes count={15} seed={5} rise={1.4} opacity={0.85} />
          </span>
          <ArchitectSymbol size={104} glow animated className="relative" />
        </div>
        <div className="flex w-full max-w-sm items-center gap-3">
          <Filigree className="flex-1 [&>span:last-child]:hidden" center={false} />
          <Eyebrow className="!tracking-[0.42em]">OmniStrategy</Eyebrow>
          <Filigree className="flex-1 [&>span:first-child]:hidden" center={false} />
        </div>
        <h1
          id="title-heading"
          className="mt-3 font-display text-[2.85rem] leading-[1.02] tracking-[0.02em] text-gold-200 text-gilded sm:text-[4.4rem]"
          style={{ filter: 'drop-shadow(0 2px 0 rgb(0 0 0 / 0.6)) drop-shadow(0 0 22px rgb(227 196 99 / 0.35)) drop-shadow(0 12px 24px rgb(0 0 0 / 0.6))' }}
        >
          Empire of Elvia
        </h1>
        <TitleFlourish className="mt-3 h-6 w-72 sm:w-80" />
        <p
          className="mt-4 max-w-md font-serif text-[1.2rem] font-medium leading-snug text-parchment-100 sm:text-[1.28rem]"
          style={{ textShadow: '0 1px 0 rgb(0 0 0 / 0.7), 0 2px 12px rgb(0 0 0 / 0.85)' }}
        >
          You are the God-King. Command the War Room, walk the border in person, prove the crown with one blade — and when you fall, return to a world that
          remembers.
        </p>
        <div className="relative mt-7 flex w-full max-w-xs flex-col gap-3 sm:max-w-sm">
          {hasAnySave && latest ? (
            <Button
              onClick={() => {
                audio.unlock();
                loadSlot(latest.slot);
              }}
              icon="crown"
            >
              Continue
            </Button>
          ) : null}
          <Button
            variant={hasAnySave ? 'ghost' : 'royal'}
            onClick={() => {
              audio.unlock();
              audio.sfx('click');
              setNaming(true);
            }}
          >
            Begin a new reign
          </Button>
          {hasAnySave ? (
            <Button variant="ghost" onClick={() => openOverlay('saves')}>
              Load a save
            </Button>
          ) : null}
          <Button variant="ghost" icon="sword" onClick={openTraining}>
            Training yard
          </Button>
          <Button variant="ghost" onClick={() => openOverlay('settings')}>
            Settings
          </Button>
          {install.canPrompt ? (
            <Button
              variant="ghost"
              icon="download"
              onClick={async () => {
                if (await promptInstall()) notify('Installed. Elvia now opens from your home screen, even offline.');
              }}
            >
              Install on this device
            </Button>
          ) : null}
        </div>
        {latest ? <p className="mt-5 text-[0.95rem] text-parchment-300">Last reign: {latest.summary.sovereign} · {latest.summary.label}</p> : null}
        {install.iosHint ? (
          <p className="mt-6 max-w-sm text-[0.95rem] text-parchment-300">To install: tap Share, then Add to Home Screen.</p>
        ) : null}
        <p className="mt-8 max-w-sm text-[0.95rem] leading-relaxed text-parchment-300">
          Plays entirely offline once loaded. An optional Claude narrator can be turned on in Settings. Original world and art; no assets from other games.
        </p>
      </div>
      <Sheet
        open={naming}
        onClose={() => setNaming(false)}
        title="Name the first incarnation"
        eyebrow="A new reign"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button onClick={() => startNewGame({ sovereignName: name.trim().slice(0, 24) || 'Aurelian' })} icon="crown">
              Take the crown
            </Button>
          </>
        }
      >
        <label htmlFor="sovereign-name" className="block font-display text-gold-200">
          Regnal name
        </label>
        <input
          id="sovereign-name"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{M}' -]/gu, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') startNewGame({ sovereignName: name.trim() || 'Aurelian' });
          }}
          className="mt-2 h-12 w-full rounded-lg border border-gold-700/50 bg-navy-950 px-3 font-display text-lg text-parchment-50"
        />
        <p className="mt-3 text-[0.92rem] text-parchment-300">
          The God-King of Elvia does not truly die. When this body falls, the Lattice will weave you again — decades later, in a world that kept living without you.
        </p>
      </Sheet>
    </main>
  );
}
