// The duel (Cycle doc §6): real-time, direct control, no menus. The engine (src/game/duel/engine.js)
// owns every rule; this screen feeds it input at a fixed timestep, draws what it says, and shows
// "what you misread" afterwards. Controls (README): swipe / arrow keys strike, tap an edge / A·D
// dodge, hold the blade / Space·S guard, E Arc Pulse, R Royal Command, hold Shift / the ward
// button for Shield Ward, Esc withdraws (when allowed). Gamepad: stick strikes, LB/RB dodge,
// A guard, Y Arc, X Royal, RT ward.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDuel, stepDuel, getDuelResult, guardActive } from '../../game/duel/engine.js';
import { ARCHETYPES } from '../../game/duel/archetypes.js';
import { summarizeDuel } from '../../game/duel/analysis.js';
import { audio, haptic } from '../audio/audio.js';
import { Button, cx } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { ArchitectSymbol } from '../art/index.js';
import { useReducedMotion } from '../art/util.js';
import { drawArena, drawEnemy, drawFx, drawPlayer, drawTelegraph, layout, spawnFx, TELE_COLORS } from './draw.js';

const MAX_DT = 50;
const SWIPE_PX = 30;
const EDGE = 0.22;
const STAKES_LABEL = {
  practice: 'Practice',
  march: 'On the march',
  champion: 'Champion duel',
  last_stand: 'Last stand — defeat ends this life',
};
const DIR_WORD = { left: 'from the left', right: 'from the right', overhead: 'from above', thrust: 'straight at you' };
const KEY_STRIKE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up' };

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

// ── HUD pieces ───────────────────────────────────────────────────────────────────────────

function Bar({ value, max, tone, label, thin = false }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const fill = { crimson: 'linear-gradient(90deg,#7a1f1a,#c2413a)', gold: 'linear-gradient(90deg,#a8841b,#f0dc95)', frost: 'linear-gradient(90deg,#7c8fa0,#eef2f5)', ember: 'linear-gradient(90deg,#8a3a1c,#f4a35e)' }[tone];
  return (
    <div className={cx('relative w-full overflow-hidden rounded-full border border-black/60 bg-black/50', thin ? 'h-1.5' : 'h-3')} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}

function HoldButton({ label, onDown, onUp, className, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onUp();
      }}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          onDown();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onUp();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function Hints({ touch, allowRetreat, onDismiss }) {
  return (
    <div className="pointer-events-auto absolute inset-x-4 top-1/2 z-30 mx-auto max-w-md -translate-y-1/2 rounded-[var(--radius-panel)] border border-gold-600/50 bg-navy-950/90 p-5 text-center shadow-panel animate-fade-in">
      <p className="font-display text-[0.8rem] uppercase tracking-[0.24em] text-gold-400">Read the wind-up</p>
      <ul className="mt-3 space-y-1.5 text-left text-[0.98rem] text-parchment-100">
        <li>
          <span className="font-semibold text-[#ffb347]">Red-gold glow</span>: dodge.
        </li>
        <li>
          <span className="font-semibold text-frost-100">Steel light</span>: parry or dodge.
        </li>
        <li>
          <span className="font-semibold text-[#e9d9ff]">Flicker</span>: a feint. Wait, then punish.
        </li>
      </ul>
      <p className="mt-3 text-[0.92rem] leading-snug text-parchment-300">
        {touch
          ? 'Swipe to strike. Tap a screen edge to dodge away from that side. Hold the blade to guard. Tap the glowing sigil for Arc Pulse, the crown for Royal Command; hold the shield to ward.'
          : `Arrow keys strike. A / D dodge. Hold Space (or S) to guard. E Arc Pulse, R Royal Command, hold Shift to ward.${allowRetreat ? ' Esc withdraws.' : ''} Mouse: drag to strike, click an edge to dodge, hold the blade to guard.`}
      </p>
      <Button variant="ghost" className="mt-4" onClick={onDismiss}>
        Ready
      </Button>
    </div>
  );
}

// ── Result ───────────────────────────────────────────────────────────────────────────────

function ResultView({ result, config, onContinue }) {
  const def = ARCHETYPES[config.archetypeId];
  const summary = summarizeDuel(result, def);
  const lastStand = config.modifiers?.stakes === 'last_stand';
  const won = result.outcome === 'victory';
  const defeatLine = lastStand ? 'This is where this life ends. The Lattice will weave you again.' : 'The Sovereign withdraws: wounded, noted, remembered. This is not the end.';
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
        Continue
      </Button>
    </div>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────────────────

export function DuelScreen({ config, onComplete, showHints = true }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const duelRef = useRef(null);
  if (!duelRef.current) duelRef.current = createDuel(config);
  const inputs = useRef([]);
  const fxList = useRef([]);
  const held = useRef({ guard: new Set(), ward: new Set() });
  const pointers = useRef(new Map());
  const pausedRef = useRef(false);
  const [hud, setHud] = useState(() => snapshot(duelRef.current));
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
    audio.ambient('duel');
  }, []);

  // The loop: fixed-step engine, real dt clamped, paused when hidden or confirming retreat.
  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return undefined;
    const ctx = cv.getContext('2d');
    let raf = 0;
    let last = 0;
    let L = layout(1, 1);
    let shake = { x: 0, y: 0 };
    let lastHud = 0;
    let lastTele = null;
    let overAt = 0;
    const size = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(r.width, r.height);
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
      if (hintsRef.current && !inputs.current.length) {
        ctx.clearRect(0, 0, L.w, L.h);
        drawArena(ctx, L, ms / 1000, !reduced);
        drawEnemy(ctx, L, duelRef.current, ms / 1000);
        drawPlayer(ctx, L, duelRef.current, ms / 1000, false);
        return;
      }
      const prev = duelRef.current;
      const batch = inputs.current;
      inputs.current = [];
      const d = stepDuel(prev, batch, dt);
      duelRef.current = d;
      for (const ev of d.events) {
        if (ev.type === 'sfx') audio.sfx(ev.name);
        else if (ev.type === 'fx') {
          spawnFx(fxList.current, ev, ms, L);
          if (ev.name === 'perfect_parry') haptic([12, 30, 12]);
          else if (ev.name === 'parry') haptic(10);
          else if (ev.name === 'player_hit' || ev.name === 'hurt') haptic(28);
        } else if (ev.type === 'line') setCaption({ who: speakerLabel(ev.speaker, d), text: ev.text, at: ms });
        else if (ev.type === 'misread') setCallout({ text: ev.label, at: ms });
      }
      const tg = d.telegraph;
      if (tg && tg.stepId !== lastTele) setAnnounce(teleAnnouncement(tg));
      lastTele = tg?.stepId ?? null;
      // draw
      const t = ms / 1000;
      ctx.save();
      ctx.clearRect(0, 0, L.w, L.h);
      ctx.translate(shake.x, shake.y);
      drawArena(ctx, L, t, !reduced);
      drawEnemy(ctx, L, d, t);
      drawTelegraph(ctx, L, d, t);
      drawPlayer(ctx, L, d, t, guardActive(d.player));
      shake = drawFx(ctx, L, fxList.current, ms, !reduced);
      ctx.restore();
      if (ms - lastHud > 100) {
        lastHud = ms;
        setHud(snapshot(d));
      }
      if (d.phase === 'over') {
        if (!overAt) overAt = ms;
        if (ms - overAt > (reduced ? 200 : 1100)) {
          cancelAnimationFrame(raf);
          setHud(snapshot(d));
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

  // Pointer: edge tap = dodge, swipe = strike, hold the blade = guard (multi-touch aware).
  const onPointerDown = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (x < EDGE || x > 1 - EDGE) {
      push({ type: 'dodge', side: x < EDGE ? 'left' : 'right' });
      pointers.current.set(e.pointerId, { done: true });
      return;
    }
    const onBlade = y > 0.7 && x > 0.4;
    if (onBlade) setHeld('guard', `ptr:${e.pointerId}`, true);
    pointers.current.set(e.pointerId, { x0: e.clientX, y0: e.clientY, guard: onBlade, done: false });
  };
  const onPointerMove = (e) => {
    const p = pointers.current.get(e.pointerId);
    if (!p || p.done) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    if (p.guard) setHeld('guard', `ptr:${e.pointerId}`, false);
    push({ type: 'strike', dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down' });
    p.done = true;
  };
  const onPointerEnd = (e) => {
    const p = pointers.current.get(e.pointerId);
    if (p?.guard) setHeld('guard', `ptr:${e.pointerId}`, false);
    pointers.current.delete(e.pointerId);
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
        <canvas ref={canvasRef} className={cx('block h-full w-full', result && 'opacity-30 blur-[2px]')} aria-hidden="true" />
      </div>

      {result ? (
        <div className="absolute inset-0 overflow-y-auto bg-navy-950/60">
          <ResultView result={result} config={d.config} onContinue={finish} />
        </div>
      ) : (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="mx-auto flex max-w-3xl items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[0.72rem] uppercase tracking-[0.22em] text-gold-400">{STAKES_LABEL[stakes] ?? 'Single combat'}</p>
                <h1 className="truncate font-display text-[1.35rem] leading-tight text-gold-100 text-engraved">{name}</h1>
                <p className="truncate text-[0.9rem] text-parchment-300">{epithet}</p>
                <div className="mt-2 space-y-1">
                  <Bar value={hud.enemyHp} max={hud.enemyMaxHp} tone="crimson" label={`${name}'s strength`} />
                  <Bar value={hud.poise} max={hud.maxPoise} tone="frost" label={`${name}'s poise`} thin />
                </div>
              </div>
              {d.config.allowRetreat ? (
                <button
                  type="button"
                  className="pointer-events-auto inline-flex min-h-11 min-w-11 items-center gap-1 rounded-lg border border-gold-700/50 bg-navy-950/70 px-3 text-[0.85rem] text-parchment-200"
                  onClick={() => {
                    pausedRef.current = true;
                    setConfirmRetreat(true);
                  }}
                >
                  <Icon name="back" size={16} /> Withdraw
                </button>
              ) : null}
            </div>
          </header>

          {capOn ? (
            <p key={caption.at} className="pointer-events-none absolute inset-x-6 top-[28%] z-20 mx-auto max-w-md text-center font-serif text-[1.15rem] italic leading-snug text-parchment-50 drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)] animate-fade-in">
              {caption.who ? <span className="mr-1 font-display not-italic text-gold-300">{caption.who}:</span> : null}
              {caption.text}
            </p>
          ) : null}
          {callout && hud.now - callout.at < 1500 ? (
            <p key={callout.at} className="pointer-events-none absolute inset-x-0 top-[45%] z-20 text-center font-display text-[1.25rem] uppercase tracking-[0.08em] text-ember-200 text-glow-ember animate-fade-in">
              {callout.text}
            </p>
          ) : null}
          {hud.tele ? (
            <p className="pointer-events-none absolute inset-x-0 top-[37%] z-10 text-center font-display text-[0.95rem] uppercase tracking-[0.2em]" style={{ color: TELE_COLORS[hud.tele.color]?.core }} aria-hidden="true">
              {TELE_COLORS[hud.tele.color]?.label}
            </p>
          ) : null}
          <p className="sr-only" aria-live="assertive">
            {announce}
          </p>

          {/* dodge edges */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-[22%] left-0 z-10 flex w-[22%] items-center justify-start pl-2 text-gold-300/35">
            <Icon name="back" size={28} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-[22%] right-0 z-10 flex w-[22%] items-center justify-end pr-2 text-gold-300/35">
            <Icon name="forward" size={28} />
          </div>

          <footer className="absolute inset-x-0 bottom-0 z-20 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto flex max-w-3xl items-end gap-3">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  aria-label={hud.arc >= 1 ? 'Arc Pulse (charged)' : `Arc Pulse (${Math.round(hud.arc * 100)}% charged)`}
                  disabled={hud.arc < 1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => push({ type: 'arc' })}
                  className={cx(
                    'relative grid size-16 place-items-center rounded-full border-2 transition',
                    hud.arc >= 1 ? 'border-lattice-300 bg-gold-700/50 text-lattice-100 shadow-[0_0_24px_rgb(255_217_122/0.7)]' : 'border-gold-700/60 bg-navy-950/80 text-gold-600',
                  )}
                  style={{ background: hud.arc < 1 ? `conic-gradient(rgb(201 162 39 / 0.45) ${hud.arc * 360}deg, rgb(7 13 24 / 0.85) 0)` : undefined }}
                >
                  <ArchitectSymbol size={34} glow={hud.arc >= 1} />
                </button>
                <HoldButton
                  label="Shield Ward (hold)"
                  onDown={() => setHeld('ward', 'btn', true)}
                  onUp={() => setHeld('ward', 'btn', false)}
                  className={cx('grid size-14 place-items-center rounded-full border-2', hud.ward ? 'border-lattice-300 bg-gold-600/40 text-lattice-100' : 'border-gold-700/60 bg-navy-950/80 text-gold-300')}
                >
                  <Icon name="readiness" size={24} />
                </HoldButton>
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="mb-1 flex items-baseline justify-between text-[0.85rem]">
                  <span className="font-display text-gold-200">The Sovereign</span>
                  {hud.combo >= 2 ? <span className="font-display text-gold-300">Combo ×{hud.combo}</span> : null}
                </div>
                <Bar value={hud.hp} max={hud.maxHp} tone="gold" label="Your strength" />
                <div className="mt-1">
                  <Bar value={hud.stamina} max={hud.maxStamina} tone="ember" label="Stamina" thin />
                </div>
                <HoldButton
                  label="Guard (hold)"
                  onDown={() => setHeld('guard', 'btn', true)}
                  onUp={() => setHeld('guard', 'btn', false)}
                  className={cx('mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border text-[0.9rem] font-display uppercase tracking-[0.14em]', hud.guard ? 'border-gold-300 bg-gold-600/35 text-gold-100' : 'border-gold-700/50 bg-navy-950/70 text-gold-300')}
                >
                  <Icon name="sword" size={18} /> Hold to guard
                </HoldButton>
              </div>
              <button
                type="button"
                aria-label={hud.royalUsed ? 'Royal Command (used)' : 'Royal Command'}
                disabled={hud.royalUsed}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => push({ type: 'royal' })}
                className={cx('grid size-16 place-items-center rounded-full border-2', hud.royalUsed ? 'border-stone-600 bg-navy-950/70 text-stone-500' : 'border-gold-400 bg-gold-700/40 text-gold-100 shadow-[0_0_18px_rgb(227_196_99/0.45)]')}
              >
                <Icon name="crown" size={28} />
              </button>
            </div>
          </footer>

          {hints ? <Hints touch={touch} allowRetreat={d.config.allowRetreat} onDismiss={dismissHints} /> : null}

          {confirmRetreat ? (
            <div role="dialog" aria-modal="true" aria-labelledby="retreat-title" className="absolute inset-0 z-50 grid place-items-center bg-navy-950/80 px-6">
              <div className="panel w-full max-w-sm p-5 text-center">
                <h2 id="retreat-title" className="font-display text-xl text-gold-200">
                  Withdraw from the circle?
                </h2>
                <p className="mt-2 text-[0.98rem] text-parchment-200">The realm will remember that you chose to live. It is recorded.</p>
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
  };
}

export default DuelScreen;
