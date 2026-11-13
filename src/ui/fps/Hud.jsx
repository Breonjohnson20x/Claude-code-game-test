// Heads-up display and touch controls for the first-person mode. Regal, quiet, readable: brass
// and parchment on night, nothing neon. The crosshair, hit marker and stick are moved by the
// game loop directly (refs); everything else re-renders about twelve times a second.

import { SPEAKERS } from '../../game/fps/lore.js';
import { cx } from '../kit/kit.jsx';

const SHADOW = { textShadow: '0 1px 2px rgb(0 0 0 / 0.9), 0 0 10px rgb(0 0 0 / 0.6)' };

function Bar({ value, max, tone, label, className }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === 'ward' ? 'from-gold-500 to-lattice-300' : pct < 30 ? 'from-crimson-600 to-ember-400' : 'from-parchment-300 to-parchment-100';
  return (
    <div className={className} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <div className="h-2.5 overflow-hidden rounded-sm border border-black/60 bg-black/50 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]">
        <div className={cx('h-full bg-gradient-to-r transition-[width] duration-150', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function Compass({ heading, bearing }) {
  // heading: yaw (0 = looking down the road, which runs south)
  const deg = ((-heading * 180) / Math.PI + 180 + 3600) % 360;
  const marks = [];
  for (let i = 0; i < 8; i += 1) {
    let d = i * 45 - deg;
    d = ((d + 540) % 360) - 180;
    if (Math.abs(d) > 70) continue;
    marks.push(
      <span key={i} className={cx('absolute top-0 -translate-x-1/2 font-display text-[13px] tracking-widest', i % 2 ? 'text-parchment-300/70' : 'text-parchment-100')} style={{ left: `${50 + (d / 70) * 50}%`, ...SHADOW }}>
        {POINTS[i]}
      </span>,
    );
  }
  const b = bearing == null ? null : Math.max(-70, Math.min(70, (bearing * 180) / Math.PI));
  return (
    <div className="relative mx-auto h-9 w-[min(72vw,26rem)]" aria-hidden="true">
      <div className="absolute inset-x-0 top-[22px] h-px bg-gradient-to-r from-transparent via-parchment-200/60 to-transparent" />
      {marks}
      <span className="absolute left-1/2 top-[19px] h-2 w-px -translate-x-1/2 bg-parchment-100" />
      {b != null ? (
        <span className="absolute top-[17px] -translate-x-1/2 text-gold-300 drop-shadow-[0_0_6px_rgb(227_196_99/0.9)]" style={{ left: `${50 + (b / 70) * 50}%` }}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 0 L11 6 L6 12 L1 6 Z" fill="currentColor" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

export function Hud({ hud, lines, toast, fxRef, mode, touch, showFps }) {
  const line = lines[0];
  return (
    <div className="pointer-events-none absolute inset-0" data-fps-hud>
      {/* top: compass and objective */}
      <div className="absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] text-center">
        <Compass heading={hud.heading} bearing={hud.bearing} />
        <p className="mx-auto mt-0.5 max-w-[80vw] font-display text-[15px] tracking-wide text-parchment-100" style={SHADOW}>
          <span className="text-gold-300">◆</span> {hud.objective}
          {hud.distance != null ? <span className="ml-2 text-parchment-300">{Math.round(hud.distance)} m</span> : null}
        </p>
        {hud.gate != null ? (
          <div className="mx-auto mt-1.5 w-56">
            <div className="h-1.5 overflow-hidden rounded-sm border border-black/60 bg-black/50">
              <div className="h-full bg-gradient-to-r from-gold-600 to-gold-300" style={{ width: `${Math.round(hud.gate * 100)}%` }} />
            </div>
            <p className="mt-0.5 font-display text-[12px] uppercase tracking-[0.2em] text-gold-300" style={SHADOW}>
              Gate rising
            </p>
          </div>
        ) : null}
        {hud.boss ? (
          <div className="mx-auto mt-2 w-[min(80vw,30rem)]" role="group" aria-label={`${hud.boss.name}: ${Math.round(hud.boss.hp * 100)} percent`}>
            <p className="font-display text-[15px] tracking-[0.14em] text-parchment-100" style={SHADOW}>
              {hud.boss.name}
              {hud.boss.kneeling ? <span className="ml-2 text-gold-300">kneeling: strike the hatch</span> : null}
            </p>
            <div className="mt-1 h-3 overflow-hidden rounded-sm border border-black/70 bg-black/55 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]">
              <div className="h-full bg-gradient-to-r from-ember-600 via-ember-400 to-gold-300 transition-[width] duration-150" style={{ width: `${hud.boss.hp * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-center gap-6 font-display text-[12px] uppercase tracking-[0.18em] text-parchment-200" style={SHADOW}>
              {hud.boss.legs.map((l, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i === 0 ? 'Left knee' : 'Right knee'}
                  <span className="inline-block h-1.5 w-14 overflow-hidden rounded-sm border border-black/60 bg-black/50">
                    <span className={cx('block h-full', l <= 0 ? 'bg-crimson-500' : 'bg-parchment-200')} style={{ width: `${Math.max(l <= 0 ? 100 : 0, l * 100)}%` }} />
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* centre: crosshair, hit marker, where it hurts from */}
      <div ref={(el) => (fxRef.current.cross = el)} className="fps-cross absolute left-1/2 top-1/2" aria-hidden="true" style={{ '--gap': '6px' }}>
        <i style={{ transform: 'translate(-50%, calc(-100% - var(--gap)))', width: 2, height: 9 }} />
        <i style={{ transform: 'translate(-50%, var(--gap))', width: 2, height: 9 }} />
        <i style={{ transform: 'translate(calc(-100% - var(--gap)), -50%)', width: 9, height: 2 }} />
        <i style={{ transform: 'translate(var(--gap), -50%)', width: 9, height: 2 }} />
        <i style={{ transform: 'translate(-50%, -50%)', width: 2, height: 2 }} />
      </div>
      <div ref={(el) => (fxRef.current.hit = el)} className="fps-hit absolute left-1/2 top-1/2" aria-hidden="true" style={{ opacity: 0 }}>
        <i style={{ transform: 'translate(-50%,-50%) rotate(45deg) translateY(-13px)' }} />
        <i style={{ transform: 'translate(-50%,-50%) rotate(135deg) translateY(-13px)' }} />
        <i style={{ transform: 'translate(-50%,-50%) rotate(225deg) translateY(-13px)' }} />
        <i style={{ transform: 'translate(-50%,-50%) rotate(315deg) translateY(-13px)' }} />
      </div>
      <div ref={(el) => (fxRef.current.hurt = el)} className="absolute left-1/2 top-1/2 h-0 w-0" aria-hidden="true" style={{ opacity: 0 }}>
        <svg width="220" height="220" viewBox="-110 -110 220 220" className="absolute -left-[110px] -top-[110px]">
          <path d="M -46 -88 A 100 100 0 0 1 46 -88 L 34 -74 A 82 82 0 0 0 -34 -74 Z" fill="rgb(194 65 58 / 0.85)" />
        </svg>
      </div>

      {/* the Sunlance's glass: shown by the game loop while aiming */}
      <div ref={(el) => (fxRef.current.scope = el)} className="fps-scope absolute inset-0" aria-hidden="true" style={{ opacity: 0 }}>
        <svg className="absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2" viewBox="-100 -100 200 200">
          <circle r="83" fill="none" stroke="rgb(0 0 0 / 0.9)" strokeWidth="3" />
          <circle r="81" fill="none" stroke="rgb(201 162 74 / 0.5)" strokeWidth="0.5" />
          <g strokeLinecap="butt">
            <path d="M-81 0 H-20 M20 0 H81 M0 20 V81" stroke="rgb(240 220 149 / 0.25)" strokeWidth="1.9" />
            <path d="M-81 0 H-20 M20 0 H81 M0 20 V81" stroke="rgb(6 8 14 / 0.95)" strokeWidth="1.4" />
            <path d="M-20 0 H-3 M3 0 H20 M0 3 V20 M0 -10 V-3" stroke="rgb(240 220 149 / 0.9)" strokeWidth="0.3" />
            <path d="M-15 -1.4 V1.4 M-9 -1.4 V1.4 M9 -1.4 V1.4 M15 -1.4 V1.4 M-1.4 9 H1.4 M-2 15 H2" stroke="rgb(240 220 149 / 0.9)" strokeWidth="0.3" />
          </g>
          <circle r="0.5" fill="rgb(244 163 94)" />
        </svg>
      </div>

      {hud.prompt && mode === 'playing' ? (
        <p className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded border border-gold-500/60 bg-navy-950/75 px-3 py-1.5 font-display text-[15px] tracking-wide text-gold-200">
          <span className="mr-2 rounded border border-gold-400/70 px-1.5 text-parchment-100">{touch ? 'Use' : 'E'}</span>
          {hud.prompt.text}
        </p>
      ) : null}

      {/* subtitles */}
      {line ? (
        <div className={cx("absolute inset-x-0 flex justify-center px-4", touch ? "top-[4.6rem]" : "bottom-[22%] sm:bottom-[18%]")} aria-live="polite">
          <p key={line.id} className="fps-line max-w-2xl rounded bg-navy-950/72 px-4 py-2 text-center font-serif text-[1.12rem] leading-snug text-parchment-100">
            <span className="mr-2 font-display text-[13px] uppercase tracking-[0.16em] text-gold-300">{SPEAKERS[line.who] ?? line.who}</span>
            {line.text}
          </p>
        </div>
      ) : null}
      {toast ? (
        <p className="absolute left-1/2 top-[30%] -translate-x-1/2 rounded bg-navy-950/70 px-3 py-1 font-display text-[15px] tracking-wide text-gold-200" role="status">
          {toast}
        </p>
      ) : null}

      {/* bottom left: the body */}
      <div className={cx('absolute', touch ? 'left-[calc(max(0.5rem,env(safe-area-inset-left))+3.4rem)] top-[max(0.5rem,env(safe-area-inset-top))] w-[7.5rem] portrait:left-[max(0.5rem,env(safe-area-inset-left))] portrait:top-[calc(max(0.5rem,env(safe-area-inset-top))+6.5rem)]' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] w-[min(40vw,15rem)]')}>
        <p className="flex items-baseline justify-between font-display text-[13px] uppercase tracking-[0.2em] text-parchment-200" style={SHADOW}>
          <span>Ward</span>
          {hud.warding ? <span className="text-gold-300">raised</span> : null}
        </p>
        <Bar value={hud.ward} max={hud.maxWard} tone="ward" label="Shield Ward" />
        <p className="mt-1.5 flex items-baseline justify-between font-display text-[13px] uppercase tracking-[0.2em] text-parchment-200" style={SHADOW}>
          <span>{touch ? 'Health' : 'The Sovereign'}</span>
          <span className={cx('text-[17px] tracking-normal', hud.hp < 30 ? 'text-ember-300' : 'text-parchment-100')}>{Math.ceil(hud.hp)}</span>
        </p>
        <Bar value={hud.hp} max={hud.maxHp} label="Health" />
      </div>

      {/* bottom right: the weapon */}
      <div className={cx('absolute', touch ? 'bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-center' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] text-right')}>
        <p className="font-display text-[13px] uppercase tracking-[0.2em] text-parchment-200" style={SHADOW}>
          {hud.weaponName}
        </p>
        <p className="font-display leading-none" style={SHADOW}>
          <span className={cx(touch ? 'text-[1.9rem]' : 'text-[2.4rem]', hud.lowAmmo ? 'text-ember-300' : 'text-parchment-100')}>{hud.mag}</span>
          <span className="ml-1 text-xl text-parchment-300">/ {hud.reserve}</span>
        </p>
        {hud.reloading != null ? (
          <div className={cx('mt-1 h-1 w-28 overflow-hidden rounded-sm bg-black/50', touch ? 'mx-auto' : 'ml-auto')}>
            <div className="h-full bg-gold-300" style={{ width: `${hud.reloading * 100}%` }} />
          </div>
        ) : hud.lowAmmo && hud.reserve > 0 ? (
          <p className="font-display text-[13px] uppercase tracking-[0.18em] text-ember-300" style={SHADOW}>
            Reload
          </p>
        ) : null}
        {touch ? null : (
          <div className="mt-1.5 flex items-center justify-end gap-2" style={SHADOW}>
            <span className="font-display text-[13px] uppercase tracking-[0.18em] text-parchment-200">Arc Pulse</span>
            <span className="inline-block h-1.5 w-16 overflow-hidden rounded-sm border border-black/60 bg-black/50">
              <span className={cx('block h-full', hud.pulse >= 1 ? 'bg-gold-300' : 'bg-parchment-300/60')} style={{ width: `${Math.max(0, Math.min(1, hud.pulse)) * 100}%` }} />
            </span>
          </div>
        )}
        {showFps ? <p className="mt-1 text-[13px] text-parchment-300">{hud.fps} fps</p> : null}
      </div>
    </div>
  );
}

// ── touch controls ──────────────────────────────────────────────────────────
// An action-game layout: the stick under the left thumb, one large Fire button under the right,
// and everything else on two arcs around Fire so the thumb reaches each by rolling, not hunting.

const ICONS = {
  fire: <path d="M12 2v5M12 17v5M2 12h5M17 12h5M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />,
  ads: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 4v5M12 15v5M4 12h5M15 12h5" />,
  reload: <path d="M19 12a7 7 0 1 1-2.3-5.2M17 3v4h-4" />,
  jump: <path d="M5 14l7-7 7 7M5 20l7-7 7 7" />,
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  ward: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />,
  melee: <path d="M19 3L8 14l2 2L21 5V3h-2ZM7 13l4 4M5 19l3-3" />,
  pulse: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />,
  crouch: <path d="M5 4l7 7 7-7M5 10l7 7 7-7M4 21h16" />,
};

function Pad({ name, input, label, caption, className, style, size = 54, active, dim }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        'fps-pad pointer-events-auto absolute flex flex-col items-center justify-center rounded-full border bg-navy-950/50 text-parchment-100 shadow-[0_2px_8px_rgb(0_0_0/0.5)] active:scale-95 active:bg-gold-500/40',
        active ? 'border-gold-300 bg-gold-500/40' : 'border-parchment-100/40',
        dim && 'opacity-55',
        className,
      )}
      style={{ touchAction: 'none', width: size, height: size, ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // a pointer that is already gone: the press still counts
        }
        input.buttonDown(name, e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        input.buttonUp(name, e);
      }}
      onPointerCancel={(e) => input.buttonUp(name, e)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width={size > 70 ? 34 : 22} height={size > 70 ? 34 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[name]}
      </svg>
      {caption ? <span className="mt-px font-display text-[9px] uppercase leading-none tracking-wider text-parchment-200">{caption}</span> : null}
    </button>
  );
}

// Fire's centre, measured from the bottom-right corner, and the two arcs around it.
const FIRE = { x: 92, y: 90, size: 84 };
const INNER = 96;
const OUTER = 166;

/** A button's place on an arc: 0° points right, 90° straight up, 180° left. */
function arc(radius, deg, size = 54) {
  const a = (deg * Math.PI) / 180;
  return { right: `calc(${(FIRE.x - Math.cos(a) * radius - size / 2).toFixed(1)}px + env(safe-area-inset-right))`, bottom: `calc(${(FIRE.y + Math.sin(a) * radius - size / 2).toFixed(1)}px + env(safe-area-inset-bottom))` };
}

export function TouchControls({ input, hud, onPause, fxRef }) {
  if (!input) return null;
  const st = input.state();
  return (
    <div className="pointer-events-none absolute inset-0" data-fps-touch>
      {/* the stick: resting bottom-left, it jumps to wherever the left thumb lands (moved by the game loop) */}
      <div ref={(el) => (fxRef.current.stick = el)} className="absolute left-0 top-0 h-32 w-32 rounded-full border-2 border-parchment-100/35 bg-navy-950/35 shadow-[inset_0_0_18px_rgb(0_0_0/0.55)]" style={{ opacity: 0.55 }} aria-hidden="true">
        <div ref={(el) => (fxRef.current.knob = el)} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border border-gold-300/80 bg-gold-500/40 shadow-[0_2px_6px_rgb(0_0_0/0.6)]" />
      </div>

      <Pad name="fire" input={input} label="Fire" size={FIRE.size} className="border-gold-400/80 bg-ember-600/40" style={arc(0, 0, FIRE.size)} />
      <Pad name="jump" input={input} label="Jump" caption="Jump" style={arc(INNER, 48)} />
      <Pad name="ads" input={input} label="Aim" caption="Aim" active={st.ads} style={arc(INNER, 94)} />
      <Pad name="swap" input={input} label="Swap weapon" caption="Swap" style={arc(INNER, 140)} />
      <Pad name="reload" input={input} label="Reload" caption="Load" active={hud.lowAmmo && hud.reserve > 0} style={arc(INNER, 186)} />
      <Pad name="pulse" input={input} label="Arc Pulse" caption="Pulse" active={hud.pulse >= 1} dim={hud.pulse < 1} style={arc(OUTER, 100)} />
      <Pad name="melee" input={input} label="Blade" caption="Blade" style={arc(OUTER, 133)} />
      <Pad name="ward" input={input} label="Shield Ward (hold)" caption="Ward" active={hud.warding} style={arc(OUTER, 166)} />
      <Pad name="crouch" input={input} label="Crouch" caption="Duck" active={st.crouch} style={arc(OUTER, 198)} />

      {hud.prompt ? (
        <button
          type="button"
          aria-label={hud.prompt.text}
          className="fps-pad pointer-events-auto absolute left-1/2 top-[66%] flex h-[52px] w-[120px] -translate-x-1/2 items-center justify-center rounded-lg border border-gold-400/80 bg-gold-500/30 font-display text-[15px] uppercase tracking-wider text-parchment-100 active:bg-gold-500/50"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            input.buttonDown('interact', e);
          }}
          onPointerUp={(e) => input.buttonUp('interact', e)}
          onPointerCancel={(e) => input.buttonUp('interact', e)}
        >
          Use
        </button>
      ) : null}
      <button type="button" aria-label="Pause" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPause(); }} onClick={(e) => { if (e.detail === 0) onPause(); }} style={{ touchAction: 'none' }} className="pointer-events-auto absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border border-parchment-100/35 bg-navy-950/45 text-parchment-100">
        <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          <rect x="1" y="1" width="4" height="14" fill="currentColor" />
          <rect x="9" y="1" width="4" height="14" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
