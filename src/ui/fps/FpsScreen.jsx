// The Greywater Front: the first-person mode's screen. Owns the canvas, the game loop and the
// menus around it (briefing, pause, a fallen Sovereign, the pilot's surrender, the result). The
// simulation (src/game/fps) decides everything that happens; the renderer (./engine) draws it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createFps, getHud, getResult, resolveSurrender, respawn, stepFps } from '../../game/fps/sim.js';
import { DIFFICULTY, WEAPONS } from '../../game/fps/combat.js';
import { DISPATCHES, MISSION, RADIO, chronicleLine } from '../../game/fps/lore.js';
import { Button, Eyebrow, cx } from '../kit/kit.jsx';
import { audio, haptic } from '../audio/audio.js';
import { useReducedMotion } from '../art/util.js';
import { QUALITY, createFpsRenderer, guessQuality } from './engine/index.js';
import { DEFAULT_SETTINGS, createInput } from './input.js';
import { createFpsSfx } from './sfx.js';
import { Hud, TouchControls } from './Hud.jsx';

const STORE_KEY = 'elvia.fps.v1';

function loadStore() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) ?? '{}') ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveStore(s) {
  try {
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // private mode: settings last for this visit only
  }
}

const fmtTime = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const KEY_HELP = [
  ['Move', 'W A S D'],
  ['Look / fire / aim', 'Mouse · left · right'],
  ['Sprint · crouch · jump', 'Shift · C · Space'],
  ['Reload · swap', 'R · 1 / 2 / wheel'],
  ['Shield Ward (hold)', 'F'],
  ['Arc Pulse · blade', 'Q · V'],
  ['Use', 'E'],
  ['Pause', 'Esc'],
];

export default function FpsScreen({ onExit, onComplete, params }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const game = useRef(null); // { state, renderer, input, sfx, view, mode }
  const reduced = useReducedMotion();
  const [settings, setSettings] = useState(loadStore);
  const settingsRef = useRef(settings);
  const [mode, setModeState] = useState('brief'); // brief | playing | paused | dead | paper | surrender | result
  const modeRef = useRef('brief');
  const [load, setLoad] = useState({ p: 0, label: 'Waking the Lattice', ready: false, error: null });
  const [hud, setHud] = useState(null);
  const [lines, setLines] = useState([]); // subtitles on screen
  const [paper, setPaper] = useState(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [isTouch, setIsTouch] = useState(() => (globalThis.navigator?.maxTouchPoints ?? 0) > 0 && globalThis.matchMedia?.('(pointer: coarse)').matches);
  const fx = useRef({ hit: null, hurt: null, cross: null, stick: null, knob: null });

  const setMode = useCallback((m) => {
    modeRef.current = m;
    setModeState(m);
    const g = game.current;
    if (g) g.input.setEnabled(m === 'playing');
  }, []);

  const update = useCallback((patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      settingsRef.current = next;
      saveStore(next);
      return next;
    });
  }, []);

  // ── build the renderer and the simulation once ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const quality = params?.quality ?? settingsRef.current.quality ?? guessQuality();
    let renderer;
    try {
      renderer = createFpsRenderer({ canvas, quality, reducedMotion: reduced });
    } catch (err) {
      setLoad({ p: 0, label: '', ready: false, error: 'This device could not start 3D graphics (WebGL 2). The rest of the game still works.' });
      void err;
      return undefined;
    }
    const state = createFps({ seed: params?.seed ?? 412, difficulty: params?.difficulty ?? settingsRef.current.difficulty, stage: params?.stage, god: params?.god });
    const input = createInput({
      element: wrapRef.current,
      getSettings: () => settingsRef.current,
      onPause: () => {
        if (modeRef.current === 'playing') pause();
        else if (modeRef.current === 'paused') resume();
      },
      onLockLost: () => {
        if (modeRef.current === 'playing') pause();
      },
      onAnyKey: (code) => {
        if (modeRef.current === 'dead' && (code === 'Space' || code === 'Enter' || code === 'KeyE')) rise();
        if (modeRef.current === 'paper' && (code === 'Space' || code === 'Enter' || code === 'KeyE')) closePaper();
      },
    });
    input.setLook(state.player.yaw, 0);
    const sfx = createFpsSfx();
    const g = { state, renderer, input, sfx, view: { recoilPitch: 0, recoilYaw: 0, zoom: 1.25, hurt: 0, flash: 0, fade: 0, deadFor: 0 }, queue: [], lineT: 0, hudT: 0, hitT: 0, hitKind: '', pendingEvents: state.events.slice(), disposed: false, fpsAcc: 0, fpsN: 0, fps: 60 };
    game.current = g;
    if (import.meta.env.DEV) globalThis.__elviaFps = g;
    let raf = 0;
    let last = performance.now();

    renderer
      .load((p, label) => setLoad((l) => ({ ...l, p, label })))
      .then(() => {
        if (g.disposed) return;
        setLoad((l) => ({ ...l, p: 1, ready: true }));
        setHud(getHud(state));
        if (params?.autostart) begin();
      })
      .catch((err) => setLoad({ p: 0, label: '', ready: false, error: `The mission could not be built: ${String(err?.message ?? err)}` }));

    function say(key) {
      for (const l of RADIO[key] ?? []) g.queue.push(l);
    }

    function handle(ev) {
      switch (ev.type) {
        case 'radio':
          say(ev.key);
          break;
        case 'shot':
          input.kick(ev.recoil * 0.45, (Math.random() - 0.5) * ev.recoil * 0.35);
          g.view.recoilPitch += ev.recoil * 0.55;
          if (ev.enemy) {
            g.hitT = performance.now();
            g.hitKind = ev.killed ? 'kill' : ev.headshot ? 'head' : 'hit';
          }
          if (ev.weapon === 'lance') g.view.flash = 0.05;
          break;
        case 'player_hit':
          g.view.hurt = Math.min(1, 0.35 + ev.dmg / 30);
          haptic(ev.dmg > 15 ? [20, 30, 20] : 14);
          showHurt(ev.angle);
          break;
        case 'ward_block':
          haptic(8);
          break;
        case 'explosion':
          if (Math.hypot(ev.x - state.player.x, ev.z - state.player.z) < 14) g.view.flash = Math.max(g.view.flash, 0.12);
          break;
        case 'dispatch': {
          const calm = !state.enemies.some((e) => e.hp > 0 && !e.dormant && e.alerted && e.type !== 'walker' && Math.hypot(e.x - state.player.x, e.z - state.player.z) < 45);
          if (calm && !params?.autostart) {
            setPaper(ev.lore);
            setMode('paper');
            input.unlock();
          } else flashToast(`Dispatch found: “${DISPATCHES[ev.lore].title}”. Read it from the pause menu.`);
          break;
        }
        case 'pickup':
          if (ev.kind === 'cells') flashToast('Carbine cells');
          else if (ev.kind === 'charges') flashToast('Sunlance charges');
          else if (ev.kind === 'draught') flashToast('Field draught: health restored');
          break;
        case 'checkpoint':
          flashToast('Checkpoint. The Lattice remembers this place.');
          break;
        case 'dead':
          g.view.deadFor = 0;
          setMode('dead');
          haptic([40, 60, 40]);
          break;
        case 'surrender':
          setMode('surrender');
          input.unlock();
          break;
        case 'won':
          finish();
          break;
        default:
      }
    }

    function showHurt(angle) {
      const el = fx.current.hurt;
      if (!el) return;
      el.style.transform = `rotate(${angle}rad)`;
      el.style.opacity = '1';
      el.getAnimations?.().forEach((a) => a.cancel());
      el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!renderer.ready) return;
      const m = modeRef.current;
      const running = m === 'playing' || m === 'dead';
      let events = g.pendingEvents;
      g.pendingEvents = [];
      if (running) {
        const inp = m === 'playing' ? input.read(dt) : { yaw: input.look.yaw, pitch: input.look.pitch };
        const bot = g.bot;
        stepFps(state, bot ? bot.step(state, dt) : inp, dt * 1000);
        if (bot) input.setLook(state.player.yaw, state.player.pitch);
        events = events.concat(state.events);
        for (const ev of state.events) handle(ev);
      }
      // touch and gamepad: the view slows as the crosshair nears an enemy, so thumbs can settle on it
      if (input.usesAssist && settingsRef.current.aimAssist !== false && m === 'playing') {
        const p = state.player;
        const cp = Math.cos(p.pitch);
        const fx = -Math.sin(p.yaw) * cp;
        const fy = Math.sin(p.pitch);
        const fz = -Math.cos(p.yaw) * cp;
        let best = 1;
        for (const e of state.enemies) {
          if (e.hp <= 0 || e.dormant) continue;
          const dx = e.x - p.x;
          const dy = e.y + (e.type === 'walker' ? 4 : 1.0) - (p.y + 1.6);
          const dz = e.z - p.z;
          const d = Math.hypot(dx, dy, dz);
          if (d > 70 || d < 0.5) continue;
          const off = Math.acos(Math.min(1, (dx * fx + dy * fy + dz * fz) / d));
          const reach = e.type === 'walker' ? 0.16 : 0.09;
          if (off < reach) best = Math.min(best, 0.42 + 0.58 * (off / reach));
        }
        input.setAssist(best);
      } else input.setAssist(1);
      const v = g.view;
      v.recoilPitch *= Math.exp(-dt * 11);
      v.hurt *= Math.exp(-dt * 3);
      v.flash *= Math.exp(-dt * 12);
      v.zoom = WEAPONS[state.player.weapon].zoom;
      v.fade = Math.min(1, v.fade + dt * (m === 'brief' ? 0.6 : 1.6));
      if (state.status === 'dead') v.deadFor += dt;
      v.paused = !running;
      renderer.frame(state, events, running ? dt : 0.0001, v);
      sfx.frame(state, events);

      // subtitles: one line at a time, long enough to read
      g.lineT -= dt;
      if (g.lineT <= 0 && g.queue.length && (m === 'playing' || m === 'dead')) {
        const l = g.queue.shift();
        g.lineT = Math.max(2.6, l.text.length * 0.058);
        setLines([{ ...l, id: now }]);
      } else if (g.lineT <= -0.6 && !g.queue.length) {
        g.lineT = 0;
        setLines((cur) => (cur.length ? [] : cur));
      }

      // crosshair, hit marker and stick are moved directly: no React in the hot path
      const { hit, cross, stick, knob } = fx.current;
      if (cross) {
        const p = state.player;
        const gap = 5 + (p.bloom * 900 + Math.hypot(p.vx, p.vz) * 1.6 + (p.grounded ? 0 : 10)) * (1 - p.ads * 0.7);
        cross.style.setProperty('--gap', `${gap.toFixed(1)}px`);
        cross.style.opacity = p.ads > 0.6 && p.weapon === 'lance' ? '0' : m === 'playing' ? '1' : '0';
      }
      if (hit) {
        const age = performance.now() - g.hitT;
        hit.style.opacity = age < 160 ? String(1 - age / 160) : '0';
        hit.dataset.kind = g.hitKind;
      }
      if (stick && knob) {
        const s = input.stick();
        stick.style.opacity = s ? '1' : '0';
        if (s) {
          const r = wrapRef.current.getBoundingClientRect();
          stick.style.transform = `translate(${s.x - r.left - 56}px, ${s.y - r.top - 56}px)`;
          knob.style.transform = `translate(${s.dx * 34}px, ${s.dy * 34}px)`;
        }
      }
      g.frames = (g.frames ?? 0) + 1;
      if (import.meta.env.DEV && g.frames === 5) globalThis.__labReady = true; // screenshot tools wait for this
      g.fpsAcc += dt;
      g.fpsN += 1;
      g.hudT -= dt;
      if (g.hudT <= 0) {
        g.hudT = 0.08;
        if (g.fpsAcc > 0.5) {
          g.fps = Math.round(g.fpsN / g.fpsAcc);
          g.fpsAcc = 0;
          g.fpsN = 0;
        }
        const h = getHud(state);
        h.ads = state.player.ads;
        h.crouch = state.player.crouch > 0.5;
        h.touch = input.touch;
        h.fps = g.fps;
        h.lowAmmo = h.mag <= Math.ceil(h.magSize * 0.2) && !h.reloading;
        setHud(h);
        if (input.touch) setIsTouch(true);
      }
    }
    raf = requestAnimationFrame(frame);

    let toastTimer = 0;
    function flashToast(text) {
      setToast(text);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToast(null), 2600);
    }

    function begin() {
      audio.unlock();
      setMode('playing');
      if (!input.touch) input.lock();
      for (const ev of g.pendingEvents) handle(ev);
    }
    function pause() {
      setMode('paused');
      input.unlock();
    }
    function resume() {
      setMode('playing');
      if (!input.touch) input.lock();
    }
    function rise() {
      if (state.status !== 'dead' || g.view.deadFor < 1.2) return;
      respawn(state);
      input.setLook(state.player.yaw, 0);
      g.pendingEvents = state.events.slice();
      for (const ev of state.events) handle(ev);
      g.view.deadFor = 0;
      setMode('playing');
      if (!input.touch) input.lock();
    }
    function closePaper() {
      setPaper(null);
      setMode('playing');
      if (!input.touch) input.lock();
    }
    function choose(outcome) {
      resolveSurrender(state, outcome);
      for (const ev of state.events) handle(ev);
      finish();
    }
    function finish() {
      const r = getResult(state);
      r.line = chronicleLine({ spared: r.outcome === 'released', deaths: r.deaths, dispatches: r.dispatches.length });
      onComplete?.(r);
      setResult(r);
      setMode('result');
      input.unlock();
      const best = settingsRef.current.best;
      if (!best || r.timeMs < best.timeMs) update({ best: { timeMs: r.timeMs, difficulty: r.difficulty, deaths: r.deaths } });
    }
    Object.assign(g, { begin, pause, resume, rise, closePaper, choose, flashToast });

    // a game surface: no magnifier, no pinch zoom, no double-tap zoom while the fight is on
    const blockGesture = (e) => {
      if (modeRef.current === 'playing' && !e.target.closest?.('[role="dialog"]')) e.preventDefault();
    };
    const wrapEl = wrapRef.current;
    wrapEl.addEventListener('touchstart', blockGesture, { passive: false });
    wrapEl.addEventListener('touchmove', blockGesture, { passive: false });
    wrapEl.addEventListener('gesturestart', blockGesture, { passive: false });
    const onResize = () => renderer.resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(canvas);
    globalThis.addEventListener('resize', onResize);
    const onVis = () => {
      if (document.hidden && modeRef.current === 'playing') pause();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      g.disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      ro?.disconnect();
      globalThis.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      wrapEl.removeEventListener('touchstart', blockGesture);
      wrapEl.removeEventListener('touchmove', blockGesture);
      wrapEl.removeEventListener('gesturestart', blockGesture);
      input.dispose();
      sfx.dispose();
      renderer.dispose();
      if (import.meta.env.DEV && globalThis.__elviaFps === g) globalThis.__elviaFps = null;
    };
    // the mission is built once per mount; restarting remounts the screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = game.current;
  const leave = () => {
    audio.ambient('title');
    onExit?.();
  };
  const dispatchesFound = hud ? game.current?.state.stats.dispatches ?? [] : [];

  return (
    <div ref={wrapRef} className="fixed inset-0 z-40 select-none overflow-hidden bg-navy-950 text-parchment-100" style={{ touchAction: 'none' }} data-fps-mode={mode}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="The Greywater Front, first-person view" />
      <h1 className="sr-only">The Greywater Front</h1>

      {hud && (mode === 'playing' || mode === 'dead' || mode === 'paused') ? <Hud hud={hud} lines={lines} toast={toast} fxRef={fx} mode={mode} touch={isTouch} showFps={!!params?.showFps} /> : null}
      {hud && mode === 'playing' && isTouch ? <TouchControls input={g?.input} hud={hud} onPause={() => g?.pause()} fxRef={fx} /> : null}

      {mode === 'brief' ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-navy-950/70 via-navy-950/45 to-navy-950/80 p-4">
          <div className="panel-surface w-full max-w-2xl rounded-lg border border-gold-600/40 bg-navy-900/85 p-5 shadow-2xl sm:p-7">
            <Eyebrow>
              {MISSION.season} · {MISSION.place}
            </Eyebrow>
            <h2 className="mt-1 font-display text-3xl tracking-wide text-gold-200 sm:text-4xl">{MISSION.title}</h2>
            <div className="mt-3 space-y-2 font-serif text-[1.08rem] leading-snug text-parchment-100">
              {MISSION.brief.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1.5 font-display text-xs uppercase tracking-[0.2em] text-gold-400">Difficulty</legend>
                <div className="flex gap-2">
                  {Object.values(DIFFICULTY).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={settings.difficulty === d.id}
                      onClick={() => {
                        update({ difficulty: d.id });
                        if (game.current) game.current.state.diff = d;
                      }}
                      className={cx('min-h-11 flex-1 rounded border px-2 font-display text-sm tracking-wide', settings.difficulty === d.id ? 'border-gold-400 bg-gold-500/20 text-gold-200' : 'border-navy-600 bg-navy-850 text-parchment-200')}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1.5 font-display text-xs uppercase tracking-[0.2em] text-gold-400">Graphics (applies on restart)</legend>
                <div className="flex gap-2">
                  {Object.values(QUALITY).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={(settings.quality ?? g?.renderer.quality.id) === q.id}
                      onClick={() => update({ quality: q.id })}
                      className={cx('min-h-11 flex-1 rounded border px-2 font-display text-sm tracking-wide', (settings.quality ?? g?.renderer.quality.id) === q.id ? 'border-gold-400 bg-gold-500/20 text-gold-200' : 'border-navy-600 bg-navy-850 text-parchment-200')}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            {isTouch ? (
              <p className="mt-4 text-[15px] text-parchment-200">Left thumb moves. Right thumb looks; hold the fire button and drag to aim while shooting. Turn your phone sideways for the best view.</p>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] sm:grid-cols-2">
                {KEY_HELP.map(([what, keys]) => (
                  <div key={what} className="flex justify-between gap-3 border-b border-navy-700/60 py-0.5">
                    <dt className="text-parchment-200">{what}</dt>
                    <dd className="font-display tracking-wide text-gold-300">{keys}</dd>
                  </div>
                ))}
              </dl>
            )}
            {load.error ? (
              <p role="alert" className="mt-4 rounded border border-crimson-500/60 bg-crimson-600/20 p-3 text-[15px]">
                {load.error}
              </p>
            ) : (
              <div className="mt-5" aria-live="polite">
                <div className="h-1.5 overflow-hidden rounded bg-navy-700">
                  <div className="h-full bg-gradient-to-r from-gold-600 to-gold-300 transition-[width] duration-200" style={{ width: `${Math.round(load.p * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-[15px] text-parchment-200">{load.ready ? 'The road is ready.' : `${load.label}…`}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button disabled={!load.ready} onClick={() => g?.begin()} icon="sword">
                {load.ready ? 'Walk the road' : 'Preparing…'}
              </Button>
              <Button variant="ghost" onClick={leave}>
                Back to the title
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'paused' ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-navy-950/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-gold-600/40 bg-navy-900/90 p-5 shadow-2xl sm:p-6">
            <Eyebrow>Paused</Eyebrow>
            <h2 className="font-display text-2xl tracking-wide text-gold-200">{MISSION.title}</h2>
            <p className="mt-1 text-[15px] text-parchment-200">{hud?.objective}</p>
            <label className="mt-4 block text-[15px]">
              <span className="flex justify-between">
                <span>Look sensitivity</span>
                <span className="text-gold-300">{settings.sensitivity.toFixed(1)}×</span>
              </span>
              <input type="range" min="0.3" max="2.5" step="0.1" value={settings.sensitivity} onChange={(e) => update({ sensitivity: Number(e.target.value) })} className="mt-1 h-11 w-full accent-[#c9a227]" />
            </label>
            <label className="mt-1 flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" checked={settings.invertY} onChange={(e) => update({ invertY: e.target.checked })} className="h-5 w-5 accent-[#c9a227]" />
              Invert vertical look
            </label>
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" checked={settings.aimAssist !== false} onChange={(e) => update({ aimAssist: e.target.checked })} className="h-5 w-5 accent-[#c9a227]" />
              Aim slowdown near enemies (touch and gamepad)
            </label>
            {dispatchesFound.length ? (
              <div className="mt-3">
                <p className="font-display text-xs uppercase tracking-[0.2em] text-gold-400">Dispatches found</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {dispatchesFound.map((id) => (
                    <button key={id} type="button" className="min-h-11 rounded border border-navy-600 bg-navy-850 px-3 text-left text-[15px] text-parchment-100" onClick={() => setPaper(id)}>
                      {DISPATCHES[id].title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => g?.resume()} icon="sword">
                Resume
              </Button>
              <Button variant="ghost" onClick={() => onExit?.('restart')}>
                Restart mission
              </Button>
              <Button variant="ghost" onClick={leave}>
                Leave
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {paper ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-navy-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="paper-title">
          <div className="w-full max-w-md rounded bg-parchment-100 p-6 text-ink shadow-2xl" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 20%, #f8f3e6, #e8dfc8 70%, #d8cba8)' }}>
            <p className="font-display text-xs uppercase tracking-[0.22em] text-ember-600">{DISPATCHES[paper].from}</p>
            <h2 id="paper-title" className="mt-1 font-display text-2xl text-ink">
              {DISPATCHES[paper].title}
            </h2>
            <p className="mt-3 font-serif text-[1.15rem] leading-relaxed">{DISPATCHES[paper].body}</p>
            <button
              type="button"
              autoFocus
              className="mt-5 min-h-11 rounded border border-ink/40 bg-ink px-5 font-display tracking-wide text-parchment-100"
              onClick={() => (mode === 'paper' ? g?.closePaper() : setPaper(null))}
            >
              Fold it away
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'dead' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-navy-950/40 to-navy-950/80 p-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-gold-400">The Sovereign falls</p>
          <h2 className="mt-2 font-display text-3xl text-gold-200 sm:text-4xl">The Lattice holds the thread</h2>
          <p className="mt-2 max-w-md font-serif text-lg text-parchment-100">Falling is not the end. You are woven back in at the last place the road remembers.</p>
          <Button className="mt-6" onClick={() => g?.rise()} icon="crown">
            Rise
          </Button>
        </div>
      ) : null}

      {mode === 'surrender' ? (
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-navy-950/90 via-navy-950/30 to-transparent p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pilot-title">
          <div className="w-full max-w-xl rounded-lg border border-gold-600/40 bg-navy-900/92 p-5 shadow-2xl sm:p-6">
            <Eyebrow>Lance-Corporal Renn Halder · pilot of “Patience”</Eyebrow>
            <h2 id="pilot-title" className="mt-1 font-display text-2xl text-gold-200">
              “They said you never come in person.”
            </h2>
            <p className="mt-2 font-serif text-[1.1rem] leading-snug text-parchment-100">
              She is younger than her voice. Her hands are up and they are shaking, and she is trying to make them stop. Behind you Mara says nothing at all, which is how you know it is yours to decide.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button onClick={() => g?.choose('released')} icon="crown">
                Send her home with her name
              </Button>
              <Button variant="ghost" onClick={() => g?.choose('held')}>
                Hold her for Director Rey
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'result' && result ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-navy-950/85 p-4">
          <div className="w-full max-w-xl rounded-lg border border-gold-600/40 bg-navy-900/92 p-5 text-center shadow-2xl sm:p-7">
            <Eyebrow>{MISSION.season} · {params?.campaign ? 'recorded in your reign' : 'mission report'}</Eyebrow>
            <h2 className="mt-1 font-display text-3xl text-gold-200 sm:text-4xl">Greywater is Elvian ground</h2>
            <p className="mx-auto mt-3 max-w-md font-serif text-[1.15rem] italic leading-snug text-parchment-100">{result.line}</p>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                ['Time', fmtTime(result.timeMs)],
                ['Accuracy', `${Math.round(result.accuracy * 100)}%`],
                ['Headshots', result.headshots],
                ['Enemies down', result.kills],
                ['Times fallen', result.deaths],
                ['Dispatches', `${result.dispatches.length} / ${Object.keys(DISPATCHES).length}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-navy-700 bg-navy-850/80 p-2">
                  <dt className="font-display text-[11px] uppercase tracking-[0.18em] text-gold-400">{k}</dt>
                  <dd className="font-display text-xl text-parchment-100">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[15px] text-parchment-200">
              {DIFFICULTY[result.difficulty]?.label} · {result.outcome === 'released' ? 'The pilot went home.' : 'The pilot is with Director Rey.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {!params?.campaign ? <Button onClick={() => onExit?.('restart')} icon="sword">
                Walk it again
              </Button> : null}
              <Button variant="ghost" onClick={leave}>
                {params?.campaign ? 'Return to the War Room' : 'Back to the title'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
