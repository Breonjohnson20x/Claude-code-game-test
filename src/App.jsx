import { lazy, Suspense, useEffect, useState } from 'react';
import { GameProvider, useGame } from './ui/game/GameProvider.jsx';
import { PHASES } from './game/core/state.js';
import { Toasts } from './ui/kit/kit.jsx';
import { ensureFonts } from './ui/art/index.js';
import { TitleScreen } from './ui/screens/TitleScreen.jsx';
import { WarRoomScreen } from './ui/screens/WarRoomScreen.jsx';
import { ResolutionScreen } from './ui/screens/ResolutionScreen.jsx';
import { ExpeditionScreen } from './ui/screens/ExpeditionScreen.jsx';
import { CampfireScreen } from './ui/screens/CampfireScreen.jsx';
import { PassingScreen } from './ui/screens/PassingScreen.jsx';
import { TrainingScreen } from './ui/screens/TrainingScreen.jsx';
import { SettingsSheet } from './ui/overlays/SettingsSheet.jsx';
import { SavesSheet } from './ui/overlays/SavesSheet.jsx';
import { ChronicleSheet } from './ui/overlays/ChronicleSheet.jsx';
import { DossierSheet } from './ui/overlays/DossierSheet.jsx';

// Dev only: /?lab=duel renders the duel lab (src/ui/dev/DuelLab.jsx); never part of a build.
const DuelLab = import.meta.env.DEV ? lazy(() => import('./ui/dev/DuelLab.jsx')) : null;
const FpsLab = import.meta.env.DEV ? lazy(() => import('./ui/dev/FpsLab.jsx')) : null;
// The first-person mission ships three.js: loaded only when it is opened.
const FpsScreen = lazy(() => import('./ui/fps/FpsScreen.jsx'));
const LAB_NAME = import.meta.env.DEV ? new URLSearchParams(globalThis.location?.search ?? '').get('lab') : null;
const LAB = LAB_NAME === 'duel';

const PHASE_SCREENS = {
  [PHASES.WAR_ROOM]: WarRoomScreen,
  [PHASES.RESOLUTION]: ResolutionScreen,
  [PHASES.EXPEDITION]: ExpeditionScreen,
  [PHASES.CAMPFIRE]: CampfireScreen,
  [PHASES.PASSING]: PassingScreen,
};

function Shell() {
  const { state, overlay, closeOverlay, toasts, training, fps, openFps, closeFps, act } = useGame();
  const [fpsRun, setFpsRun] = useState(0);
  const Screen = state ? PHASE_SCREENS[state.phase] ?? WarRoomScreen : training ? TrainingScreen : TitleScreen;
  const screenKey = state ? `${state.cycle.number}-${state.turn}-${state.phase}` : training ? 'training' : 'title';
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screenKey]);
  if (fps && (!state || fps.campaign)) {
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const params = { ...fps };
    // dev and test hooks: /?fps&stage=depot&autostart=1&quality=low
    for (const k of ['stage', 'quality', 'difficulty']) if (q.get(k) && params[k] == null) params[k] = q.get(k);
    if (q.get('autostart') === '1') params.autostart = true;
    if (q.get('showfps') === '1') params.showFps = true;
    if (import.meta.env.DEV && q.get('god') === '1') params.god = true;
    return (
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-navy-950 font-display tracking-widest text-gold-300">Loading the Greywater Front…</div>}>
        <FpsScreen
          key={fpsRun}
          params={params}
          onComplete={fps.campaign ? (result) => act({ type: 'GREYWATER_COMPLETE', result }) : undefined}
          onExit={(why) => {
            if (why === 'restart') {
              setFpsRun((n) => n + 1);
              openFps(fps);
            } else closeFps();
          }}
        />
        <Toasts toasts={toasts} />
      </Suspense>
    );
  }
  return (
    <>
      <Screen key={screenKey} />
      <div key={`veil-${screenKey}`} className="screen-veil" aria-hidden="true" />
      <SettingsSheet open={overlay === 'settings'} onClose={closeOverlay} />
      <SavesSheet open={overlay === 'saves'} onClose={closeOverlay} mode={state ? 'game' : 'title'} />
      {state ? <ChronicleSheet open={overlay === 'chronicle'} onClose={closeOverlay} /> : null}
      {state ? <DossierSheet open={overlay === 'dossier'} onClose={closeOverlay} /> : null}
      <Toasts toasts={toasts} />
    </>
  );
}

export default function App() {
  useEffect(() => {
    ensureFonts();
  }, []);
  if (LAB_NAME === 'fps' && FpsLab) {
    return (
      <Suspense fallback={null}>
        <FpsLab />
      </Suspense>
    );
  }
  if (LAB && DuelLab) {
    return (
      <Suspense fallback={null}>
        <DuelLab />
      </Suspense>
    );
  }
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
