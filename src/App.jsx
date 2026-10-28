import { useEffect } from 'react';
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

const PHASE_SCREENS = {
  [PHASES.WAR_ROOM]: WarRoomScreen,
  [PHASES.RESOLUTION]: ResolutionScreen,
  [PHASES.EXPEDITION]: ExpeditionScreen,
  [PHASES.CAMPFIRE]: CampfireScreen,
  [PHASES.PASSING]: PassingScreen,
};

function Shell() {
  const { state, overlay, closeOverlay, toasts, training } = useGame();
  const Screen = state ? PHASE_SCREENS[state.phase] ?? WarRoomScreen : training ? TrainingScreen : TitleScreen;
  const screenKey = state ? `${state.cycle.number}-${state.turn}-${state.phase}` : training ? 'training' : 'title';
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screenKey]);
  return (
    <>
      <Screen key={screenKey} />
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
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
