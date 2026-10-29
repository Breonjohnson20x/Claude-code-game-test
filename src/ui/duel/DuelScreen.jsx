// The duel (Cycle doc §6): real-time, direct control, no menus. The engine (src/game/duel/engine.js)
// owns every rule; this screen feeds it input at a fixed timestep, hands each frame to the renderer
// (./render), and shows "what you misread" afterwards.
//
// Touch: tap the arena to strike, swipe to strike that way; the arrows dodge, hold the shield to
// guard; Arc Pulse, Shield Ward and Royal Command sit above. Keyboard: arrow keys strike, A/D dodge,
// hold Space or S to guard, E Arc Pulse, R Royal Command, hold Shift to ward, Esc withdraws (when
// allowed). Gamepad: stick strikes, LB/RB dodge, A guard, Y Arc, X Royal, RT ward.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDuel, stepDuel, getDuelResult, guardActive, drillProgress } from '../../game/duel/engine.js';
import { ARCHETYPES } from '../../game/duel/archetypes.js';
import { summarizeDuel } from '../../game/duel/analysis.js';
import { audio, haptic } from '../audio/audio.js';
import { Button, cx } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { ArchitectSymbol } from '../art/index.js';
import { useReducedMotion } from '../art/util.js';
import { createDuelRenderer } from './render/index.js';
import { TELE_COLORS } from './colors.js';
import { Controls, FoePlate, Hints } from './hud.jsx';

const MAX_DT = 50;
const SWIPE_PX = 26;
const TAP_MS = 280;
const STAKES_LABEL = {
  drill: 'Training yard drill',
  practice: 'Practice',
  march: 'On the march',
  champion: 'Champion duel',
  last_stand: 'Last stand: defeat ends this life',
};
const DIR_WORD = { left: 'from the left', right: 'from the right', overhead: 'from above', thrust: 'straight at you' };
const KEY_STRIKE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up' };
const GOOD_FX = { perfect_parry: 'Perfect parry', feint_read: 'Read it! Strike the opening', poise_break: 'Guard broken: punish!' };

function speakerLabel(speaker, duel) {
  if (speaker === 'enemy') return duel.def.name;
  if (speaker === 'narrator') return null;
  return { mara: 'Mara', sparky: 'Sparky', cassian: 'Cassian' }[speaker] ?? null;
}

function teleAnnouncement(tg) {
  if (!tg) return '';
  if (tg.isFeint) return `Flicker ${DIR_WORD[tg.dir] ?? ''}: a feint. Wait.`;
  const side = tg.dodgeSides.length === 1 ? `dodge ${tg.dodgeSides[0]}` : 'dodge either way';
  if (tg.isHeavy) return `Heavy ${DIR_WORD[tg.dir] ?? ''}: ${side}.`;
  return `Strike ${DIR_WORD[tg.dir] ?? ''}: parry or ${side}.`;
}

// ── Result ───────────────────────────────────────────────────────────────────────────────

function drillVerdict(result, goalLabel) {
  const { value, target, met } = result.drill;
  if (met) return { title: 'Drill complete', line: `${goalLabel}: done. Mara nods once, which is all the praise she gives.` };
  return { title: 'Not yet', line: `${value} of ${target}. Nobody bleeds here. Again.` };
}

function ResultView({ result, config, onContinue, goalLabel, continueLabel = 'Continue' }) {
  const def = ARCHETYPES[config.archetypeId];
  const summary = summarizeDuel(result, def);
  const lastStand = config.modifiers?.stakes === 'last_stand';
  const drill = result.drill ? drillVerdict(result, goalLabel ?? 'The drill') : null;
  if (drill) {
    summary.title = drill.title;
    summary.line = drill.line;
  }
  const won = result.outcome === 'victory';
  const defeatLine = drill
    ? drill.line
    : lastStand
      ? 'This is where this life ends. The Lattice will weave you again.'
      : 'The Sovereign withdraws: wounded, noted, remembered. This is not the end.';
  const stats = [
    ['Clean hits', result.cleanHits],
    ['Perfect parries', result.perfectParries],
    ['Best combo', result.maxCombo],
    ['Poise breaks', result.poiseBreaks],
  ];
  return (
    <div className="relative z-40 mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-10" aria-live="polite">
      <div className="text-center animate-fade-up">
        <ArchitectSymbol size={64} glow={won ? 0.9 : 0.3} className="mx-auto" />
        <p className="mt-3 font-display text-[0.8rem] uppercase tracking-[0.24em] text-gold-400">{config.title || def?.name}</p>
        <h1 className={cx('mt-1 font-display text-[2.6rem] leading-tight sm:text-5xl', won ? 'text-gilded text-glow-gold' : 'text-parchment-50')}>{summary.title}</h1>
        <p className="mt-2 font-serif text-[1.25rem] italic text-parchment-200">{won ? summary.line : result.outcome === 'retreat' ? summary.line : defeatLine}</p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-gold-700/40 bg-navy-950/70 px-3 py-2 text-center">
            <dt className="text-[0.78rem] uppercase tracking-wider text-gold-400/90">{k}</dt>
            <dd className="font-display text-[1.4rem] text-parchment-50">{v}</dd>
          </div>
        ))}
      </dl>
      {summary.tips?.length ? (
        <section aria-labelledby="duel-misread" className={cx('mt-6 rounded-[var(--radius-panel)] border p-4', won ? 'border-gold-700/40 bg-navy-950/70' : 'border-crimson-400/50 bg-[rgb(36_22_27/0.85)]')}>
          <h2 id="duel-misread" className={cx('font-display text-[0.85rem] uppercase tracking-[0.2em]', won ? 'text-gold-300' : 'text-ember-300')}>
            {won ? 'Sharpen next time' : 'What you misread'}
          </h2>
          <ul className="mt-2 space-y-2">
            {summary.tips.map((m) => (
              <li key={m.kind} className="text-[1rem] leading-snug text-parchment-100">
                {m.advice}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {summary.lesson ? <p className="mt-4 text-center font-serif text-[1.1rem] italic text-parchment-300">{summary.lesson}</p> : null}
      <Button icon="forward" className="mx-auto mt-8 min-w-56" onClick={onContinue} autoFocus>
        {continueLabel}
      </Button>
    </div>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────────────────

/**
 * `brief` ({ eyebrow, title, text }) heads the intro card (training drills); `goalLabel` names a
 * drill's goal on the result screen and `hudLabel` counts it on the HUD; `continueLabel` labels the
 * result screen's button; `withdrawText` is the Withdraw confirmation's body.
 */
export function DuelScreen({
  config,
  onComplete,
  showHints = true,
  brief = null,
  goalLabel = null,
  hudLabel = null,
  continueLabel,
  withdrawText = 'The realm will remember that you chose to live. It is recorded.',
  quality = null,
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const duelRef = useRef(null);
  if (!duelRef.current) duelRef.current = createDuel(config);
  const rendererRef = useRef(null);
  // `quality` (dev and tests only) pins the renderer's quality tier instead of letting it adapt
  if (!rendererRef.current) rendererRef.current = createDuelRenderer({ config, archetypeId: duelRef.current.archetypeId, reduced, quality });
  const inputs = useRef([]);
  const held = useRef({ guard: new Set(), ward: new Set() });
  const gestures = useRef(new Map());
  const pausedRef = useRef(false);
  // `intro`: the renderer's opening name card is up, so the nameplate waits its turn
  const [hud, setHud] = useState(() => ({ ...snapshot(duelRef.current), intro: rendererRef.current.introShowing(0) }));
  const [caption, setCaption] = useState(null);
  const [callout, setCallout] = useState(null);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState(null);
  const [hints, setHints] = useState(showHints);
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const hintsRef = useRef(showHints);
  const dismissHints = useCallback(() => {
    hintsRef.current = false;
    setHints(false);
  }, []);
  const push = useCallback(
    (input) => {
      inputs.current.push(input);
      dismissHints();
      if (input.type === 'dodge') haptic(12);
      else if (input.type === 'strike') haptic(6);
    },
    [dismissHints],
  );
  // The intro holds the fight (the engine's own grace period starts after it).
  useEffect(() => {
    const t = setTimeout(dismissHints, 6000);
    return () => clearTimeout(t);
  }, [dismissHints]);
  const setHeld = useCallback(
    (kind, source, down) => {
      const set = held.current[kind];
      const was = set.size > 0;
      if (down) set.add(source);
      else set.delete(source);
      const now = set.size > 0;
      if (was !== now) push({ type: kind, down: now });
    },
    [push],
  );

  // Dev only: the e2e harness reads the live duel (read-only) to play by keyboard.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    globalThis.__elviaDuel = {
      get current() {
        return duelRef.current;
      },
    };
    return () => {
      delete globalThis.__elviaDuel;
    };
  }, []);

  useEffect(() => {
    const before = audio.getTheme();
    audio.ambient('duel');
    return () => audio.ambient(before);
  }, []);

  // The loop: fixed-step engine, real dt clamped, paused when hidden or confirming retreat. A
  // hitstop holds the engine for a few frames after the biggest blows; both sides freeze.
  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    const renderer = rendererRef.current;
    if (!cv || !wrap) return undefined;
    const ctx = cv.getContext('2d');
    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let lastTele = null;
    let overAt = 0;
    let hitstopUntil = 0;
    // the canvas resolution follows the renderer's quality tier (it steps down on slow devices)
    let dprCap = renderer.dprCap;
    const size = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      dprCap = renderer.dprCap;
      const dpr = Math.min(dprCap, globalThis.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.resize(r.width, r.height, dpr);
    };
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    ro?.observe(wrap);
    const padPrev = { buttons: [], stick: false };

    const pollPad = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const gp = [...pads].find(Boolean);
      if (!gp) return;
      const b = (i) => Boolean(gp.buttons[i]?.pressed);
      const edge = (i) => b(i) && !padPrev.buttons[i];
      const [ax, ay] = [gp.axes[0] ?? 0, gp.axes[1] ?? 0];
      const mag = Math.hypot(ax, ay);
      if (mag > 0.75 && !padPrev.stick) push({ type: 'strike', dir: Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : ay < 0 ? 'up' : 'down' });
      padPrev.stick = mag > 0.5;
      if (edge(4)) push({ type: 'dodge', side: 'left' });
      if (edge(5)) push({ type: 'dodge', side: 'right' });
      if (edge(3)) push({ type: 'arc' });
      if (edge(2)) push({ type: 'royal' });
      setHeld('guard', 'pad', b(0));
      setHeld('ward', 'pad', (gp.buttons[7]?.value ?? 0) > 0.5);
      padPrev.buttons = gp.buttons.map((x) => x.pressed);
    };

    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(MAX_DT, ms - last) : 16;
      last = ms;
      if (pausedRef.current || document.hidden) return;
      pollPad();
      if (renderer.dprCap !== dprCap) size();
      const prev = duelRef.current;
      if (hintsRef.current && !inputs.current.length) {
        renderer.frame(ctx, prev, ms, { guarding: false, hold: true });
        return;
      }
      let d = prev;
      if (ms >= hitstopUntil) {
        const batch = inputs.current;
        inputs.current = [];
        d = stepDuel(prev, batch, dt);
        duelRef.current = d;
        const { hitstopMs } = renderer.events(d.events, ms);
        if (hitstopMs) hitstopUntil = ms + hitstopMs;
        for (const ev of d.events) {
          if (ev.type === 'sfx') audio.sfx(ev.name);
          else if (ev.type === 'fx') {
            if (ev.name === 'perfect_parry') haptic([12, 30, 12]);
            else if (ev.name === 'parry') haptic(10);
            else if (ev.name === 'player_hit' || ev.name === 'hurt') haptic(28);
            else if (ev.name === 'strike_hit') haptic(8);
            if (GOOD_FX[ev.name]) setCallout({ text: GOOD_FX[ev.name], at: ms, good: true });
          } else if (ev.type === 'line') setCaption({ who: speakerLabel(ev.speaker, d), text: ev.text, at: ms });
          else if (ev.type === 'misread') setCallout({ text: ev.label, at: ms, good: false });
        }
      }
      const tg = d.telegraph;
      if (tg && tg.stepId !== lastTele) setAnnounce(teleAnnouncement(tg));
      lastTele = tg?.stepId ?? null;
      renderer.frame(ctx, d, ms, { guarding: guardActive(d.player) });
      if (ms - lastHud > 100) {
        lastHud = ms;
        setHud({ ...snapshot(d), intro: renderer.introShowing(ms) });
      }
      if (d.phase === 'over') {
        if (!overAt) overAt = ms;
        if (ms - overAt > (reduced ? 200 : 1300)) {
          cancelAnimationFrame(raf);
          setHud({ ...snapshot(d), intro: false });
          setResult(getDuelResult(d));
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [push, setHeld, reduced]);

  // Keyboard.
  useEffect(() => {
    if (result) return undefined;
    const down = (e) => {
      if (confirmRetreat) return;
      const k = e.key;
      if (KEY_STRIKE[k]) {
        e.preventDefault();
        if (!e.repeat) push({ type: 'strike', dir: KEY_STRIKE[k] });
      } else if (k === 'a' || k === 'A') {
        if (!e.repeat) push({ type: 'dodge', side: 'left' });
      } else if (k === 'd' || k === 'D') {
        if (!e.repeat) push({ type: 'dodge', side: 'right' });
      } else if (k === ' ' || k === 's' || k === 'S') {
        e.preventDefault();
        if (!e.repeat) setHeld('guard', `key:${k.toLowerCase()}`, true);
      } else if (k === 'Shift') {
        setHeld('ward', 'key:shift', true);
      } else if (k === 'e' || k === 'E') {
        push({ type: 'arc' });
      } else if (k === 'r' || k === 'R') {
        push({ type: 'royal' });
      } else if (k === 'Escape' && duelRef.current.config.allowRetreat) {
        pausedRef.current = true;
        setConfirmRetreat(true);
      }
    };
    const up = (e) => {
      const k = e.key;
      if (k === ' ' || k === 's' || k === 'S') setHeld('guard', `key:${k.toLowerCase()}`, false);
      else if (k === 'Shift') setHeld('ward', 'key:shift', false);
    };
    const blur = () => {
      for (const src of [...held.current.guard]) if (src.startsWith('key')) setHeld('guard', src, false);
      for (const src of [...held.current.ward]) if (src.startsWith('key')) setHeld('ward', src, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [push, setHeld, result, confirmRetreat]);

  // Gestures on the arena: a tap strikes straight, a swipe strikes the way it travels, and the
  // finger leaves a trail of light either way.
  const local = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = local(e);
    gestures.current.set(e.pointerId, { x0: p[0], y0: p[1], t0: performance.now(), fired: false, trail: null, pts: [p] });
  };
  const onPointerMove = (e) => {
    const g = gestures.current.get(e.pointerId);
    if (!g) return;
    const p = local(e);
    g.pts.push(p);
    if (g.trail) {
      g.trail.pts.push(p);
      g.trail.t0 = performance.now();
    }
    if (g.fired) return;
    const dx = p[0] - g.x0;
    const dy = p[1] - g.y0;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    g.fired = true;
    push({ type: 'strike', dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down' });
    g.trail = rendererRef.current.swipe(g.pts, performance.now());
  };
  const onPointerEnd = (e) => {
    const g = gestures.current.get(e.pointerId);
    gestures.current.delete(e.pointerId);
    if (!g || g.fired || e.type === 'pointercancel') return;
    if (performance.now() - g.t0 <= TAP_MS) {
      push({ type: 'strike', dir: 'up' });
      const [x, y] = local(e);
      rendererRef.current.swipe([[x, y + 18], [x, y - 18]], performance.now());
    }
  };

  const finish = () => onComplete(result);
  const retreat = () => {
    setConfirmRetreat(false);
    pausedRef.current = false;
    push({ type: 'retreat' });
  };
  const resume = () => {
    setConfirmRetreat(false);
    pausedRef.current = false;
  };

  const d = duelRef.current;
  const stakes = d.config.modifiers.stakes;
  const name = d.config.title || d.def.name;
  const epithet = d.config.subtitle || d.def.epithet;
  // rAF timestamps and performance.now() share a timebase.
  const capOn = caption && hud.now - caption.at < 3500;
  const tele = hud.tele ? TELE_COLORS[hud.tele.color] : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-navy-950 text-parchment-50 select-none" style={{ touchAction: 'none' }}>
      <div
        ref={wrapRef}
        className="absolute inset-0"
        onPointerDown={result ? undefined : onPointerDown}
        onPointerMove={result ? undefined : onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className={cx('block h-full w-full transition duration-500', result && 'opacity-35 blur-[3px]')} aria-hidden="true" />
      </div>

      {import.meta.env?.DEV && globalThis.location?.search?.includes('nohud') ? null : result ? (
        <div className="absolute inset-0 overflow-y-auto bg-navy-950/55">
          <ResultView result={result} config={d.config} onContinue={finish} goalLabel={goalLabel} continueLabel={continueLabel} />
        </div>
      ) : (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="relative mx-auto max-w-3xl px-12">
              {/* the opening name card owns this slot until it rises away; then the plate fades in */}
              <div className={cx('transition-opacity duration-500 motion-reduce:transition-none', hud.intro ? 'opacity-0' : 'opacity-100')}>
                <FoePlate stakesLabel={STAKES_LABEL[stakes] ?? 'Single combat'} name={name} epithet={epithet} hud={hud} hudLabel={hudLabel} />
              </div>
              {d.config.allowRetreat ? (
                <button
                  type="button"
                  aria-label="Withdraw from the duel"
                  title="Withdraw"
                  className="pointer-events-auto absolute left-0 top-0 grid size-11 place-items-center rounded-full border border-gold-700/60 bg-navy-950/75 text-parchment-200 shadow-panel"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    pausedRef.current = true;
                    setConfirmRetreat(true);
                  }}
                >
                  <Icon name="back" size={20} />
                </button>
              ) : null}
            </div>
          </header>

          {capOn ? (
            <p key={caption.at} className="pointer-events-none absolute inset-x-6 top-[24%] z-20 mx-auto max-w-md text-center font-serif text-[1.15rem] italic leading-snug text-parchment-50 drop-shadow-[0_2px_6px_rgb(0_0_0/0.95)] animate-fade-in">
              {caption.who ? <span className="mr-1 font-display not-italic text-gold-300">{caption.who}:</span> : null}
              {caption.text}
            </p>
          ) : null}
          {callout && hud.now - callout.at < 1500 ? (
            <p
              key={callout.at}
              className={cx(
                'pointer-events-none absolute inset-x-0 top-[44%] z-20 text-center font-display text-[1.3rem] uppercase tracking-[0.08em] drop-shadow-[0_2px_8px_rgb(0_0_0/0.95)] animate-fade-in',
                callout.good ? 'text-gold-200 text-glow-gold' : 'text-ember-200 text-glow-ember',
              )}
            >
              {callout.text}
            </p>
          ) : null}
          {tele ? (
            <p
              className="pointer-events-none absolute left-1/2 top-[34%] z-10 -translate-x-1/2 rounded-full border bg-navy-950/70 px-4 py-1 font-display text-[0.92rem] uppercase tracking-[0.2em] shadow-panel"
              style={{ color: tele.core, borderColor: `${tele.glow}0.6)` }}
              aria-hidden="true"
            >
              {tele.label}
            </p>
          ) : null}
          <p className="sr-only" aria-live="assertive">
            {announce}
          </p>

          <footer
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(0deg,rgb(4_7_13/0.92)_0%,rgb(4_7_13/0.6)_55%,rgb(4_7_13/0)_100%)] px-4 pt-10"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <Controls hud={hud} push={push} setHeld={setHeld} />
          </footer>

          {hints ? <Hints touch={touch} allowRetreat={d.config.allowRetreat} onDismiss={dismissHints} brief={brief} /> : null}

          {confirmRetreat ? (
            <div role="dialog" aria-modal="true" aria-labelledby="retreat-title" className="absolute inset-0 z-50 grid place-items-center bg-navy-950/80 px-6">
              <div className="panel w-full max-w-sm p-5 text-center">
                <h2 id="retreat-title" className="font-display text-xl text-gold-200">
                  Withdraw from the circle?
                </h2>
                <p className="mt-2 text-[0.98rem] text-parchment-200">{withdrawText}</p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button variant="ghost" onClick={resume} autoFocus>
                    Fight on
                  </Button>
                  <Button variant="danger" onClick={retreat}>
                    Withdraw
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function snapshot(d) {
  const p = d.player;
  const e = d.enemy;
  return {
    now: typeof performance !== 'undefined' ? performance.now() : 0,
    timeMs: d.timeMs,
    hp: p.hp,
    maxHp: p.maxHp,
    stamina: p.stamina,
    maxStamina: p.maxStamina,
    combo: p.combo,
    arc: p.arcCharge,
    royalUsed: p.royalUsed,
    guard: guardActive(p),
    ward: p.wardHeld && p.wardBrokenMs <= 0,
    enemyHp: e.hp,
    enemyMaxHp: e.maxHp,
    poise: e.poise,
    maxPoise: e.maxPoise,
    tele: d.telegraph ? { color: d.telegraph.telegraphColor } : null,
    drill: drillProgress(d),
  };
}

export default DuelScreen;
