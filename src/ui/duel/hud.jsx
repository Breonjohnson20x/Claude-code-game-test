// The duel's heads-up display and controls. Everything here is DOM over the canvas: the foe's
// nameplate, your strength and stamina, and the controls under your thumbs:
//
//            [Arc] [Ward]                [Royal]
//      [◀ Dodge]       [ GUARD (hold) ]       [Dodge ▶]
//
// Strikes are gestures on the arena itself (tap = straight strike, swipe = strike that way), so
// the buttons never compete with them.

import { Button, cx } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { ArchitectSymbol } from '../art/index.js';

// ── bars ────────────────────────────────────────────────────────────────────────────────────

const FILLS = {
  crimson: 'linear-gradient(180deg,#e0564d 0%,#b8322b 55%,#7a1f1a 100%)',
  gold: 'linear-gradient(180deg,#f6e9bd 0%,#e3c463 50%,#a8841b 100%)',
  frost: 'linear-gradient(180deg,#ffffff 0%,#dbe5ef 60%,#94a6b8 100%)',
  ember: 'linear-gradient(180deg,#f9c99a 0%,#e0782b 60%,#8a3a1c 100%)',
};

export function Bar({ value, max, tone, label, size = 'md', chip = false }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const h = size === 'lg' ? 'h-3.5' : size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div
      className={cx('relative w-full overflow-hidden rounded-full border border-gold-700/70 bg-[rgb(6_8_14/0.85)] shadow-[inset_0_1px_3px_rgb(0_0_0/0.8)]', h)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      {chip ? <span className="absolute inset-y-0 left-0 rounded-full bg-[rgb(255_236_200/0.55)] transition-[width] delay-200 duration-700 ease-out" style={{ width: `${pct}%` }} /> : null}
      <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100" style={{ width: `${pct}%`, background: FILLS[tone] }} />
      <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/15" />
    </div>
  );
}

// ── the foe's nameplate ─────────────────────────────────────────────────────────────────────

export function FoePlate({ stakesLabel, name, epithet, hud, hudLabel }) {
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <p className="font-display text-[0.7rem] uppercase tracking-[0.28em] text-gold-400 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">{stakesLabel}</p>
      <h1 className={cx('truncate font-display leading-tight text-gold-100 text-engraved drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)]', name.length > 18 ? 'text-[1.12rem] sm:text-[1.45rem]' : 'text-[1.45rem]')}>{name}</h1>
      {epithet ? <p className="truncate text-[0.9rem] text-parchment-200 drop-shadow-[0_1px_3px_rgb(0_0_0/0.95)]">{epithet}</p> : null}
      <div className="mx-auto mt-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/70" aria-hidden="true" />
        <span className="size-2 rotate-45 bg-gold-400" aria-hidden="true" />
        <div className="w-[68%] space-y-1">
          <Bar value={hud.enemyHp} max={hud.enemyMaxHp} tone="crimson" label={`${name}'s strength`} size="lg" chip />
          <Bar value={hud.poise} max={hud.maxPoise} tone="frost" label={`${name}'s poise`} size="sm" />
        </div>
        <span className="size-2 rotate-45 bg-gold-400" aria-hidden="true" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/70" aria-hidden="true" />
      </div>
      {hud.drill ? (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold-600/50 bg-navy-950/80 px-3 py-1 text-[0.95rem] text-parchment-100" role="status">
          {hudLabel ?? 'Goal'}
          <span className="font-display text-gold-200">
            {hud.drill.value} / {hud.drill.target}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// ── controls ────────────────────────────────────────────────────────────────────────────────

const stop = (e) => e.stopPropagation();

/** A button that acts on press (not release) and repeats nothing: dodges must feel instant. */
function PressButton({ label, onPress, className, children, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={className}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!disabled) onPress();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onPress();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function HoldButton({ label, onDown, onUp, className, children }) {
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

const ROUND = 'relative grid place-items-center rounded-full border-2 shadow-[0_6px_18px_rgb(0_0_0/0.55)] backdrop-blur-[2px] transition duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lattice-200';
const IDLE = 'border-gold-600/70 bg-[radial-gradient(circle_at_50%_35%,rgb(40_52_78/0.92),rgb(7_10_18/0.92))] text-gold-200';

function ShieldIcon({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 2.8 4.5 5.6v5.8c0 4.7 3.2 8.5 7.5 9.8 4.3-1.3 7.5-5.1 7.5-9.8V5.6L12 2.8Z" />
      <path d="M12 6.5v10M9 9.5h6" />
    </svg>
  );
}

function WardIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M3.5 18.5a8.5 8.5 0 0 1 17 0" />
      <path d="M7 18.5a5 5 0 0 1 10 0M12 10v-6M8.5 11.2 6 7M15.5 11.2 18 7" />
    </svg>
  );
}

function DodgeIcon({ dir }) {
  const d = dir === 'left' ? 'M14.5 5.5 8 12l6.5 6.5M19 5.5 12.5 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5M5 5.5 11.5 12 5 18.5';
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

function Caption({ children }) {
  return <span className="pointer-events-none mt-1 block text-center font-display text-[0.62rem] uppercase tracking-[0.18em] text-gold-300/90 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">{children}</span>;
}

export function Controls({ hud, push, setHeld }) {
  const arcReady = hud.arc >= 1;
  return (
    <div className="pointer-events-none mx-auto w-full max-w-md select-none lg:ml-0 lg:max-w-sm" onPointerDown={stop}>
      {/* your strength */}
      <div className="pointer-events-none mb-3 px-1">
        <div className="mb-1 flex items-baseline justify-between text-[0.85rem]">
          <span className="font-display text-gold-200 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">The Sovereign</span>
          {hud.combo >= 2 ? <span className="font-display text-gold-300 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">Combo ×{hud.combo}</span> : null}
        </div>
        <Bar value={hud.hp} max={hud.maxHp} tone="gold" label="Your strength" chip />
        <div className="mt-1">
          <Bar value={hud.stamina} max={hud.maxStamina} tone="ember" label="Stamina" size="sm" />
        </div>
      </div>

      {/* abilities */}
      <div className="mb-2 flex items-end justify-between px-1">
        <div className="pointer-events-auto flex items-end gap-2">
          <div>
            <PressButton
              label={arcReady ? 'Arc Pulse (charged)' : `Arc Pulse (${Math.round(hud.arc * 100)}% charged)`}
              disabled={!arcReady}
              onPress={() => push({ type: 'arc' })}
              className={cx(ROUND, 'size-[3.25rem]', arcReady ? 'border-lattice-300 bg-gold-700/60 text-lattice-100 shadow-[0_0_26px_rgb(255_217_122/0.75)] animate-slow-glow' : 'border-gold-700/60 text-gold-600')}
            >
              <span className="absolute inset-0 rounded-full" style={{ background: arcReady ? undefined : `conic-gradient(rgb(201 162 39 / 0.5) ${hud.arc * 360}deg, rgb(7 13 24 / 0.9) 0)` }} aria-hidden="true" />
              <ArchitectSymbol size={30} glow={arcReady} className="relative" />
            </PressButton>
            <Caption>Arc</Caption>
          </div>
          <div>
            <HoldButton
              label="Shield Ward (hold)"
              onDown={() => setHeld('ward', 'btn', true)}
              onUp={() => setHeld('ward', 'btn', false)}
              className={cx(ROUND, 'size-[3.25rem]', hud.ward ? 'border-lattice-300 bg-gold-600/45 text-lattice-100 shadow-[0_0_22px_rgb(255_217_122/0.55)]' : IDLE)}
            >
              <WardIcon />
            </HoldButton>
            <Caption>Ward</Caption>
          </div>
        </div>
        <div className="pointer-events-auto">
          <PressButton
            label={hud.royalUsed ? 'Royal Command (used)' : 'Royal Command'}
            disabled={hud.royalUsed}
            onPress={() => push({ type: 'royal' })}
            className={cx(ROUND, 'size-[3.25rem]', hud.royalUsed ? 'border-stone-600 bg-navy-950/80 text-stone-500' : 'border-gold-400 bg-[radial-gradient(circle_at_50%_35%,rgb(168_132_27/0.75),rgb(40_30_8/0.9))] text-gold-100 shadow-[0_0_20px_rgb(227_196_99/0.5)]')}
          >
            <Icon name="crown" size={24} />
          </PressButton>
          <Caption>Royal</Caption>
        </div>
      </div>

      {/* the core: dodge, guard, dodge */}
      <div className="flex items-end justify-between px-1">
        <div className="pointer-events-auto">
          <PressButton label="Dodge left" onPress={() => push({ type: 'dodge', side: 'left' })} className={cx(ROUND, 'size-[4.25rem]', IDLE)}>
            <DodgeIcon dir="left" />
          </PressButton>
          <Caption>Dodge</Caption>
        </div>
        <div className="pointer-events-auto">
          <HoldButton
            label="Guard (hold)"
            onDown={() => setHeld('guard', 'btn', true)}
            onUp={() => setHeld('guard', 'btn', false)}
            className={cx(
              ROUND,
              'size-[5.5rem] border-[3px]',
              hud.guard
                ? 'border-gold-200 bg-[radial-gradient(circle_at_50%_35%,rgb(227_196_99/0.6),rgb(79_61_13/0.9))] text-parchment-50 shadow-[0_0_30px_rgb(255_217_122/0.6)]'
                : 'border-gold-500 bg-[radial-gradient(circle_at_50%_35%,rgb(52_64_92/0.95),rgb(7_10_18/0.95))] text-gold-100',
            )}
          >
            <ShieldIcon />
          </HoldButton>
          <Caption>Hold to guard</Caption>
        </div>
        <div className="pointer-events-auto">
          <PressButton label="Dodge right" onPress={() => push({ type: 'dodge', side: 'right' })} className={cx(ROUND, 'size-[4.25rem]', IDLE)}>
            <DodgeIcon dir="right" />
          </PressButton>
          <Caption>Dodge</Caption>
        </div>
      </div>
    </div>
  );
}

// ── the intro card ──────────────────────────────────────────────────────────────────────────

export function Hints({ touch, allowRetreat, onDismiss, brief }) {
  return (
    <div className="pointer-events-auto absolute inset-x-4 top-1/2 z-30 mx-auto max-w-md -translate-y-1/2 rounded-[var(--radius-panel)] border border-gold-600/50 bg-navy-950/92 p-5 text-center shadow-panel animate-fade-in">
      {brief ? (
        <div className="mb-4 border-b border-gold-700/40 pb-4">
          <p className="font-display text-[0.8rem] uppercase tracking-[0.24em] text-gold-400">{brief.eyebrow}</p>
          <p className="mt-1 font-display text-[1.2rem] text-gold-100">{brief.title}</p>
          <p className="mt-2 text-[0.98rem] leading-snug text-parchment-100">{brief.text}</p>
        </div>
      ) : null}
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
      <p className="mt-3 text-[0.95rem] leading-snug text-parchment-300">
        {touch
          ? 'Tap the arena to strike, or swipe to strike that way. Dodge with the arrows, hold the shield to guard. Arc Pulse and Royal Command sit above.'
          : `Arrow keys strike. A / D dodge. Hold Space (or S) to guard. E Arc Pulse, R Royal Command, hold Shift to ward.${allowRetreat ? ' Esc withdraws.' : ''} Mouse: click to strike, drag to strike that way.`}
      </p>
      <Button variant="ghost" className="mt-4" onClick={onDismiss}>
        Ready
      </Button>
    </div>
  );
}
