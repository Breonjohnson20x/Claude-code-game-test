import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Button, Eyebrow, Rule, Sheet } from '../kit/kit.jsx';
import { ArchitectSymbol } from '../art/index.js';
import { StageBackdrop } from '../duel/StageBackdrop.jsx';
import { audio } from '../audio/audio.js';
import { promptInstall, useInstallState } from '../pwa.js';

export function TitleScreen() {
  const { hasAnySave, slots, loadSlot, startNewGame, openOverlay, openTraining, notify } = useGame();
  const install = useInstallState();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('Aurelian');
  const latest = slots
    .filter((s) => s.summary && !s.corrupt)
    .sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))[0];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-navy-950" aria-labelledby="title-heading">
      <div className="absolute inset-0" aria-hidden="true">
        <StageBackdrop stage="ruin" noSymbol className="block h-full w-full" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_42%,rgb(7_13_24/0.15)_0%,rgb(7_13_24/0.55)_55%,rgb(7_13_24/0.92)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-950 via-navy-950/70 to-transparent" />
      </div>
      <div
        className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <ArchitectSymbol size={88} glow animated className="mb-4" />
        <Eyebrow>OmniStrategy</Eyebrow>
        <h1 id="title-heading" className="mt-2 font-display text-[2.6rem] leading-[1.05] text-gold-200 text-gilded sm:text-6xl">
          Empire of Elvia
        </h1>
        <p className="mt-4 max-w-md font-serif text-[1.25rem] leading-snug text-parchment-200">
          You are the God-King. Command the War Room, walk the border in person, prove the crown with one blade — and when you fall, return to a world that
          remembers.
        </p>
        <Rule className="w-48" />
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
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
        {latest ? <p className="mt-4 text-[0.88rem] text-parchment-300">Last reign: {latest.summary.sovereign} · {latest.summary.label}</p> : null}
        {install.iosHint ? (
          <p className="mt-6 max-w-sm text-[0.95rem] text-parchment-300">To install: tap Share, then Add to Home Screen.</p>
        ) : null}
        <p className="mt-8 max-w-sm text-[0.8rem] text-parchment-400">
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
