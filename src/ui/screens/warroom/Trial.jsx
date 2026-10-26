// War Room: the Trial of Blades (Cycle doc §10, "practice with stakes"). Pick a sparring foe,
// fight in the torch-lit circle; the first win each season is rewarded. Never ends the turn.

import { useState } from 'react';
import { Portrait } from '../../art/index.js';
import { Icon } from '../../kit/icons.jsx';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { TRIAL_FOES } from '../../../game/actions.js';
import { ARCHETYPES } from '../../../game/duel/archetypes.js';
import { SectionHeading } from './shared.jsx';
import { outcomeWord } from './words.js';

const FOE_ART = { blade_adept: 'nyra', warg_alpha: 'skaela', fallen_champion: 'sovereign' };
const FOE_STYLE = {
  blade_adept: 'Fast, with feints',
  warg_alpha: 'Slow, crushing blows',
  fallen_champion: 'Your own style, mirrored',
};

export function TrialSheet({ open, onClose, onFight, rewardAvailable }) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="The torch-lit circle" title="Trial of Blades" wide>
      <p className="max-w-prose text-[1rem] leading-relaxed text-parchment-200">
        Spar in the circle beneath the Citadel. It does not end the season.{' '}
        {rewardAvailable
          ? 'Your first victory this season raises the army’s readiness and Mara will remember it; a loss costs a little readiness.'
          : 'You have already fought for stakes this season. Fight again for practice: nothing is won or lost.'}
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {Object.entries(TRIAL_FOES).map(([id, foe]) => (
          <li key={id} className="flex flex-col rounded-[var(--radius-panel)] border border-gold-700/40 bg-navy-900/80 p-4">
            <div className="flex items-center gap-3">
              <Portrait id={FOE_ART[id]} size={56} mood="grim" />
              <div className="min-w-0">
                <p className="font-display text-[1.02rem] leading-tight text-gold-200">{foe.name}</p>
                <p className="text-[0.85rem] text-parchment-300">{FOE_STYLE[id]}</p>
              </div>
            </div>
            <p className="mt-3 font-serif text-[1.05rem] italic leading-snug text-parchment-200">{foe.epithet}.</p>
            <p className="mt-3 flex-1 text-[0.92rem] leading-snug text-parchment-300">{ARCHETYPES[id]?.lesson}</p>
            <Button icon="sword" className="mt-4 w-full" onClick={() => onFight(id)}>
              Fight {foe.name}
            </Button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** The last trial's result: one line of what to read better next time. */
export function TrialResult({ last }) {
  if (!last) return null;
  const tip = last.misreads?.[0];
  const won = last.outcome === 'victory';
  return (
    <div
      aria-live="polite"
      className={cx(
        'mt-3 rounded-lg border px-4 py-3',
        won ? 'border-gold-600/50 bg-gold-800/20' : last.outcome === 'defeat' ? 'border-ember-500/45 bg-ember-600/10' : 'border-stone-600/50 bg-navy-950/50',
      )}
    >
      <p className="flex items-center gap-2 font-display text-[0.95rem] text-gold-200">
        <Icon name="sword" size={16} />
        {outcomeWord(last.outcome)} against {last.foe}
        {last.stakes ? '' : ' · practice only'}
      </p>
      {tip ? <p className="mt-1 text-[0.95rem] leading-snug text-parchment-200">{tip.advice}</p> : null}
    </div>
  );
}

export function TrialAndAbdication({ rewardAvailable, last, onOpenTrial, onAbdicate }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-labelledby="wr-more-title" className="mb-8">
      <SectionHeading id="wr-more-title" icon="sword">
        Beyond the table
      </SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="font-display text-[1.02rem] text-gold-200">Trial of Blades</p>
          <p className="mt-1 text-[0.95rem] text-parchment-300">
            {rewardAvailable ? 'Spar before the season turns. The first win this season is rewarded.' : 'Practice in the circle. This season’s stakes are already settled.'}
          </p>
          <Button variant="ghost" icon="sword" className="mt-3" onClick={onOpenTrial}>
            Enter the circle
          </Button>
          <TrialResult last={last} />
        </div>
        <div className="panel p-4">
          <p className="font-display text-[1.02rem] text-gold-200">Lay down the crown</p>
          <p className="mt-1 text-[0.95rem] text-parchment-300">Abdication ends this reign now. Rare, powerful, and remembered differently from a fall.</p>
          <Button variant="danger" className="mt-3" onClick={() => setConfirm(true)}>
            Abdicate…
          </Button>
        </div>
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        eyebrow="This cannot be undone"
        title="Abdicate the throne?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep the crown
            </Button>
            <Button variant="danger" onClick={() => onAbdicate()}>
              Abdicate
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-serif text-[1.15rem] leading-relaxed text-parchment-100">
          <p>The reign ends today. The Passing begins: the last fire, the Chronicle read back, and the choice of what survives you.</p>
          <p>Elvia will remember that you chose to go. A fall is mourned; an abdication is argued about for generations.</p>
        </div>
      </Sheet>
    </section>
  );
}
