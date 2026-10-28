// Persistent game chrome: who reigns, when, and the doors to the Chronicle, Council, saves, settings.

import { useGame } from './GameProvider.jsx';
import { IconButton, cx } from '../kit/kit.jsx';
import { Sigil } from '../art/Ornaments.jsx';
import { sovereignTitle, seasonLabel, TURNS_PER_CYCLE } from '../../game/core/state.js';

export function TopBar({ className, subtitle }) {
  const { state, openOverlay } = useGame();
  if (!state) return null;
  const pending = state.chronicle.filter((e) => e.cycle === state.cycle.number && !e.approved && e.kind !== 'campfire').length;
  return (
    <header className={cx('flex items-center gap-2 py-2', className)}>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 font-display text-[0.95rem] text-gold-200 text-engraved sm:text-base">
          <Sigil name="crown" size={14} className="shrink-0 text-gold-400 drop-shadow-[0_0_6px_rgb(227_196_99/0.45)]" />
          <span className="truncate">
            {sovereignTitle(state)}
            <span className="sr-only text-gold-500/80 sm:not-sr-only"> · Reign {romanize(state.cycle.number)}</span>
          </span>
        </p>
        <p className="truncate text-[0.85rem] text-parchment-300">
          {subtitle ?? (
            <>
              {seasonLabel(state)} ·{' '}
              <span aria-hidden="true" className="sm:hidden">
                {Math.min(state.turn, TURNS_PER_CYCLE)}/{TURNS_PER_CYCLE}
              </span>
              <span className="sr-only sm:not-sr-only">
                Turn {Math.min(state.turn, TURNS_PER_CYCLE)} of {TURNS_PER_CYCLE}
              </span>
            </>
          )}
        </p>
      </div>
      <nav aria-label="Game menu" className="flex shrink-0 gap-1 sm:gap-1.5 [&>button]:max-sm:size-11">
        <IconButton icon="chronicle" label="The Chronicle" onClick={() => openOverlay('chronicle')} badge={pending > 0 ? pending : null} />
        <IconButton icon="council" label="Council and factions" onClick={() => openOverlay('dossier')} />
        <IconButton icon="saves" label="Save and load" onClick={() => openOverlay('saves')} />
        <IconButton icon="settings" label="Settings" onClick={() => openOverlay('settings')} />
      </nav>
    </header>
  );
}

export function romanize(n) {
  const map = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = Math.max(1, Math.floor(n));
  for (const [k, s] of map) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}
