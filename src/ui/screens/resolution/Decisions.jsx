// Resolution: what the Sovereign does next — walk the border, sit by the fire, or let the
// season turn. Danger and irreversible steps go through a confirm sheet.

import { useState } from 'react';
import { Portrait } from '../../art/index.js';
import { Icon } from '../../kit/icons.jsx';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { SEASONS } from '../../../game/core/state.js';
import { SectionHeading } from '../warroom/shared.jsx';

function nextSeason(state) {
  const season = SEASONS[state.turn % SEASONS.length];
  const year = season === SEASONS[0] ? state.year + 1 : state.year;
  return `${season} ${year} E.R.`;
}

function DeploymentCard({ d, characters, onChoose }) {
  const danger = Boolean(d.danger);
  return (
    <li
      className={cx(
        'relative isolate flex flex-col overflow-hidden rounded-[0.9rem] border p-4 shadow-panel sm:p-5',
        danger ? 'border-crimson-400/60' : 'border-gold-600/55',
      )}
      style={{
        background: danger
          ? 'var(--elvia-grain), radial-gradient(100% 70% at 0% 0%, rgb(194 65 58 / 0.25), transparent 60%), linear-gradient(180deg, #2a1418, #0f0d14)'
          : 'var(--elvia-grain), radial-gradient(100% 70% at 100% 0%, rgb(255 214 150 / 0.14), transparent 60%), linear-gradient(180deg, #1f3150 0%, #121b2d 60%, #0b1424 100%)',
      }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] -z-10 rounded-[0.7rem] border border-gold-500/15" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: danger ? 'linear-gradient(90deg, #d9726b, transparent 80%)' : 'linear-gradient(90deg, #f0dc95, rgb(201 162 39 / 0.4) 50%, transparent 90%)' }}
      />
      <p className="font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">
        {d.kind === 'march' ? 'Leave the War Room' : d.kind === 'skirmish' ? 'The deployment that matters' : 'Last stand'}
      </p>
      <p className="mt-1 font-display text-[1.3rem] leading-tight text-gold-100 text-engraved">{d.title}</p>
      <p className="mt-2 text-[1rem] leading-relaxed text-parchment-200">{d.text}</p>
      {d.line ? (
        <div className="mt-3 flex items-start gap-3">
          <Portrait id={d.recommender} size={44} />
          <p className="font-serif text-[1.1rem] italic leading-snug text-parchment-50">
            {d.line}
            <span className="mt-0.5 block font-body text-[0.85rem] not-italic text-parchment-300">— {characters[d.recommender]?.name ?? d.recommender}</span>
          </p>
        </div>
      ) : null}
      {danger ? (
        <p className="mt-3 flex gap-2 font-semibold text-crimson-300">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          Defeat here ends this life. The Passing would follow.
        </p>
      ) : null}
      <Button variant={danger ? 'danger' : 'royal'} icon={d.kind === 'march' ? 'map' : 'sword'} className="mt-4 self-start" onClick={() => onChoose(d)}>
        {d.title}
      </Button>
    </li>
  );
}

export function Decisions({ view, state, act }) {
  const [confirmDeploy, setConfirmDeploy] = useState(null);
  const [confirmEra, setConfirmEra] = useState(false);
  const deployments = view.deployments ?? [];

  const choose = (d) => {
    if (d.danger) setConfirmDeploy(d);
    else act({ type: 'BEGIN_DEPLOYMENT', kind: d.kind });
  };

  return (
    <section aria-labelledby="rs-next-title" className="mb-4">
      <SectionHeading id="rs-next-title" icon="forward">
        What the Sovereign does next
      </SectionHeading>

      {deployments.length ? (
        <ul className="mb-4 grid gap-3 lg:grid-cols-2">
          {deployments.map((d) => (
            <DeploymentCard key={d.kind} d={d} characters={state.characters} onChoose={choose} />
          ))}
        </ul>
      ) : null}

      {view.campfire ? (
        <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-ember-400/50 bg-[radial-gradient(120%_120%_at_0%_100%,rgb(224_120_43/0.25),transparent_60%),rgb(11_20_36/0.9)] p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-ember-400/60 text-ember-300 glow-ember">
            <Icon name="fire" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.05rem] text-ember-200">{view.campfire.topic}</p>
            <p className="font-serif text-[1.12rem] italic leading-snug text-parchment-100">{view.campfire.prompt}</p>
          </div>
          <Button variant="ghost" icon="fire" onClick={() => act({ type: 'START_CAMPFIRE' })}>
            Sit by the fire
          </Button>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-gold-700/30 bg-navy-950/92 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {view.isFinalTurn ? (
          <Button icon="crown" className="w-full sm:w-auto" onClick={() => setConfirmEra(true)}>
            Close the era
          </Button>
        ) : (
          <Button
            variant={deployments.length || view.campfire ? 'ghost' : 'royal'}
            icon="forward"
            className="w-full sm:w-auto"
            onClick={() => act({ type: 'CONTINUE' })}
          >
            Continue to {nextSeason(state)}
          </Button>
        )}
      </div>

      <Sheet
        open={Boolean(confirmDeploy)}
        onClose={() => setConfirmDeploy(null)}
        eyebrow="A last stand"
        title={confirmDeploy?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeploy(null)}>
              Not yet
            </Button>
            <Button variant="danger" icon="sword" onClick={() => act({ type: 'BEGIN_DEPLOYMENT', kind: confirmDeploy.kind })}>
              Ride out
            </Button>
          </>
        }
      >
        <p className="font-serif text-[1.15rem] leading-relaxed text-parchment-100">
          If the Sovereign falls here, this reign ends and the Passing begins. The Lattice will weave you again; Elvia will remember where you fell.
        </p>
      </Sheet>

      <Sheet
        open={confirmEra}
        onClose={() => setConfirmEra(false)}
        eyebrow="The end of a reign"
        title="Close the era?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEra(false)}>
              Not yet
            </Button>
            <Button icon="crown" onClick={() => act({ type: 'CONTINUE' })}>
              Begin the Passing
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-serif text-[1.15rem] leading-relaxed text-parchment-100">
          <p>The thaw has come and this reign is ending. What follows is the Passing: a last fire with those who stood with you, the Chronicle read back, and the choice of what survives you.</p>
          <p>You can still read the Chronicle and the Council&rsquo;s dossier before you go.</p>
        </div>
      </Sheet>
    </section>
  );
}
