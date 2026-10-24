// The one place where the pure game meets the browser: state, saves, the dynasty commit,
// the optional Claude narrator, audio cues. Screens call `act(action)` and render `view`.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dispatch as dispatchGame, getView, newGame as createGame } from '../../game/actions.js';
import { PHASES } from '../../game/core/state.js';
import { createSaveSystem, SaveError } from '../../game/save/saveSystem.js';
import { createGenerators, subscribeAiStatus, getAiStatus } from '../../game/ai/generators.js';
import { audio, haptic } from '../audio/audio.js';
import { loadSettings, saveSettings, applyDocumentSettings } from './settings.js';

const GameContext = createContext(null);

const ACTION_SFX = {
  ISSUE_ORDER: 'order',
  ISSUE_CUSTOM_ORDER: 'order',
  CONTINUE: 'turn',
  BEGIN_DEPLOYMENT: 'confirm',
  EXPEDITION_CHOICE: 'page',
  START_CAMPFIRE: 'fire',
  CAMPFIRE_COMPLETE: 'page',
  APPROVE_CHRONICLE: 'chronicle',
  ABDICATE: 'passing',
  PASSING_NEXT: 'page',
  PASSING_CHOOSE_LEGACIES: 'legacy',
  BEGIN_NEXT_CYCLE: 'passing',
  TRIAL_START: 'confirm',
};

const PHASE_AMBIENT = {
  [PHASES.WAR_ROOM]: 'war_room',
  [PHASES.RESOLUTION]: 'war_room',
  [PHASES.EXPEDITION]: 'march',
  [PHASES.CAMPFIRE]: 'campfire',
  [PHASES.PASSING]: 'passing',
};

function randomSeed() {
  // Dev only: /?seed=<n> makes "New reign" reproducible for the e2e harness.
  if (import.meta.env.DEV) {
    const fixed = Number(new URLSearchParams(globalThis.location?.search ?? '').get('seed'));
    if (Number.isInteger(fixed) && fixed > 0) return fixed;
  }
  try {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] || 1;
  } catch {
    return (Date.now() >>> 0) || 1;
  }
}

let toastSeq = 0;

export function GameProvider({ children, storage }) {
  const saves = useMemo(() => createSaveSystem({ storage }), [storage]);
  const [settings, setSettingsState] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const generators = useMemo(() => createGenerators({ getSettings: () => settingsRef.current }), []);
  const [aiStatus, setAiStatus] = useState(getAiStatus);
  const [state, setState] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [slots, setSlots] = useState(() => saves.listSlots());
  const [overlay, setOverlay] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => subscribeAiStatus(setAiStatus), []);

  // Dev only: /?scenario=<name> jumps straight to a phase (see src/game/dev/scenarios.js).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = new URLSearchParams(globalThis.location?.search ?? '').get('scenario');
    if (!name) return;
    import('../../game/dev/scenarios.js').then((m) => {
      const s = m.buildScenario(name);
      if (s) {
        stateRef.current = s;
        setState(s);
      }
    });
  }, []);

  // Dev only: read-only window.__elvia.state for the e2e harness (scripts/e2e.mjs).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    globalThis.__elvia = {
      get state() {
        return stateRef.current;
      },
    };
    return () => {
      delete globalThis.__elvia;
    };
  }, []);

  useEffect(() => {
    applyDocumentSettings(settings);
    audio.setMuted(settings.muted);
    audio.setVolume(settings.volume);
  }, [settings]);

  const ambientTheme = state ? PHASE_AMBIENT[state.phase] ?? null : 'title';
  useEffect(() => {
    audio.ambient(ambientTheme);
  }, [ambientTheme]);

  const notify = useCallback((text, tone = 'info') => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3800);
  }, []);

  const refreshSlots = useCallback(() => setSlots(saves.listSlots()), [saves]);

  const performIo = useCallback(
    (prev, next, io) => {
      if (io.autosaveBefore) saves.autosave(prev, io.autosaveBefore);
      if (io.commitDynasty) {
        try {
          saves.commitDynasty(next);
        } catch (err) {
          notify(`The dynasty record could not be written: ${err.message}`, 'error');
        }
      }
      if (io.autosave) {
        const ok = saves.autosave(next, io.autosave);
        if (!ok) notify(saves.getLastError()?.message ?? 'Autosave failed.', 'error');
      }
      if (io.autosave || io.autosaveBefore || io.commitDynasty) refreshSlots();
    },
    [saves, notify, refreshSlots],
  );

  /** Dispatch a game action. Returns the controller result ({ state, io, error, report }). */
  const act = useCallback(
    (action) => {
      const prev = stateRef.current;
      if (!prev) return { error: 'No reign in progress.' };
      const result = dispatchGame(prev, action);
      if (result.error) {
        notify(result.error, 'error');
        return result;
      }
      stateRef.current = result.state;
      setState(result.state);
      setLastResult(result);
      performIo(prev, result.state, result.io ?? {});
      const cue = ACTION_SFX[action.type];
      if (cue) audio.sfx(cue);
      if (action.type === 'ISSUE_ORDER' || action.type === 'ISSUE_CUSTOM_ORDER') haptic(18);
      return result;
    },
    [notify, performIo],
  );

  const startNewGame = useCallback(
    (options = {}) => {
      audio.unlock();
      const s = createGame({ seed: options.seed ?? randomSeed(), sovereignName: options.sovereignName || 'Aurelian' });
      stateRef.current = s;
      setState(s);
      setOverlay(null);
      saves.autosave(s, 'cycle_start');
      refreshSlots();
      audio.sfx('confirm');
    },
    [saves, refreshSlots],
  );

  const loadSlot = useCallback(
    (slot) => {
      audio.unlock();
      try {
        const s = saves.load(slot);
        stateRef.current = s;
        setState(s);
        setOverlay(null);
        notify(slot === 'auto' ? 'Autosave restored.' : `Slot ${slot} loaded.`);
        audio.sfx('page');
        return true;
      } catch (err) {
        notify(err instanceof SaveError ? err.message : `Could not load: ${err.message}`, 'error');
        return false;
      }
    },
    [saves, notify],
  );

  const saveSlot = useCallback(
    (slot) => {
      if (!stateRef.current) return false;
      try {
        saves.save(slot, stateRef.current);
        refreshSlots();
        notify(`Saved to slot ${slot}.`);
        audio.sfx('chronicle');
        return true;
      } catch (err) {
        notify(err.message, 'error');
        return false;
      }
    },
    [saves, refreshSlots, notify],
  );

  const removeSlot = useCallback(
    (slot) => {
      saves.remove(slot);
      refreshSlots();
    },
    [saves, refreshSlots],
  );

  const exportSlot = useCallback(
    (slot) => {
      try {
        return saves.exportSave(slot);
      } catch (err) {
        notify(err.message, 'error');
        return null;
      }
    },
    [saves, notify],
  );

  const importSlot = useCallback(
    (slot, json) => {
      try {
        saves.importSave(slot, json);
        refreshSlots();
        notify(`Imported into slot ${slot}.`);
        return true;
      } catch (err) {
        notify(err.message, 'error');
        return false;
      }
    },
    [saves, refreshSlots, notify],
  );

  const quitToTitle = useCallback(() => {
    if (stateRef.current) saves.autosave(stateRef.current, 'after_resolution');
    stateRef.current = null;
    setState(null);
    setOverlay(null);
    refreshSlots();
  }, [saves, refreshSlots]);

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const view = useMemo(() => (state ? getView(state) : null), [state]);

  const value = useMemo(
    () => ({
      state,
      view,
      act,
      lastResult,
      settings,
      updateSettings,
      slots,
      refreshSlots,
      hasAnySave: slots.some((s) => s.summary && !s.corrupt),
      startNewGame,
      loadSlot,
      saveSlot,
      removeSlot,
      exportSlot,
      importSlot,
      quitToTitle,
      overlay,
      openOverlay: setOverlay,
      closeOverlay: () => setOverlay(null),
      toasts,
      notify,
      generators,
      aiStatus,
      aiOn: settings.aiEnabled && Boolean(settings.apiKey),
    }),
    [state, view, act, lastResult, settings, updateSettings, slots, refreshSlots, startNewGame, loadSlot, saveSlot, removeSlot, exportSlot, importSlot, quitToTitle, overlay, toasts, notify, generators, aiStatus],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
