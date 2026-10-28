// The training yard (from the title screen): drills that each teach one read of the telegraph,
// and practice bouts against every foe. Outside any reign: nothing here changes a save or the
// Chronicle. The drills and their goals live in src/game/duel/drills.js.

import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Button, Eyebrow, IconButton, cx } from '../kit/kit.jsx';
import { Icon } from '../kit/icons.jsx';
import { Portrait, RegionScene } from '../art/index.js';
import { DuelScreen } from '../duel/DuelScreen.jsx';
import { TELE_COLORS } from '../duel/draw.js';
import { DRILLS, drillConfig, SPARRING, sparringConfig } from '../../game/duel/drills.js';
import { LEGACY_NAMES } from '../../game/duel/archetypes.js';
import { Segmented } from '../overlays/chronicle/Segmented.jsx';
import { SectionHeading } from './warroom/shared.jsx';
import { loadRecords, recordResult } from './training/records.js';

const FOE_ART = { blade_adept: 'nyra', warg_alpha: 'skaela', fallen_champion: 'sovereign' };
const STYLE_LABEL = { aegis_mastery: 'Aegis', warg_truce: 'Warg', oathbreakers_shadow: 'Shadow' };
const WITHDRAW_TEXT = 'Leave the circle. Nothing in the yard is written down.';

function newSeed() {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

function Swatch({ telegraph }) {
  const c = TELE_COLORS[telegraph];
  return (
    <span
      aria-hidden="true"
      className="inline-block size-9 shrink-0 rounded-full border border-black/40"
      style={{ background: `radial-gradient(circle at 50% 45%, ${c.core}, ${c.glow}0.55) 55%, ${c.glow}0) 75%)`, boxShadow: `0 0 18px ${c.glow}0.55)` }}
    />
  );
}

function LastBout({ last, onAgain }) {
  if (!last) return null;
  const r = last.result;
  const passed = last.kind === 'drill' ? r?.drill?.met : r?.outcome === 'victory';
  const tip = r?.misreads?.[0]?.advice;
  const headline =
    last.kind === 'drill'
      ? passed
        ? `${last.title}: passed`
        : `${last.title}: ${r?.drill?.value ?? 0} of ${r?.drill?.target ?? '?'}`
      : `${last.title}: ${r?.outcome === 'victory' ? 'you won the bout' : r?.outcome === 'retreat' ? 'you left the circle' : 'you were bested'}`;
  return (
    <div
      aria-live="polite"
      className={cx('mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] border px-4 py-3', passed ? 'border-gold-500/60 bg-gold-800/25' : 'border-ember-500/45 bg-ember-600/10')}
    >
      <Icon name={passed ? 'check' : 'sword'} size={20} className={passed ? 'text-gold-300' : 'text-ember-300'} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[1rem] text-gold-100">{headline}</p>
        {tip && !passed ? <p className="mt-0.5 text-[0.95rem] leading-snug text-parchment-200">{tip}</p> : null}
      </div>
      <Button variant="ghost" onClick={onAgain}>
        {passed ? 'Go again' : 'Try again'}
      </Button>
    </div>
  );
}

function DrillCard({ drill, record, onStart }) {
  const passed = Boolean(record?.passed);
  return (
    <li className="flex flex-col rounded-[var(--radius-panel)] border border-gold-700/40 bg-navy-900/80 p-4 shadow-panel">
      <div className="flex items-center gap-3">
        <Swatch telegraph={drill.telegraph} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.1rem] leading-tight text-gold-100">{drill.title}</h3>
          <p className="text-[0.95rem] font-semibold" style={{ color: TELE_COLORS[drill.telegraph].core }}>
            {drill.answer}
          </p>
        </div>
        {passed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/60 bg-gold-800/30 px-2.5 py-0.5 text-[0.85rem] font-semibold text-gold-200">
            <Icon name="check" size={14} /> Passed
          </span>
        ) : null}
      </div>
      <p className="mt-3 flex-1 text-[1rem] leading-snug text-parchment-100">{drill.instruction}</p>
      <p className="mt-3 text-[0.95rem] text-parchment-300">
        <span className="font-display text-gold-300">Goal:</span> {drill.goalLabel}
      </p>
      <Button icon="sword" className="mt-4 w-full" onClick={onStart}>
        {passed ? `Run ${drill.title} again` : `Start: ${drill.title}`}
      </Button>
    </li>
  );
}

function SparCard({ spar, record, mirror, onMirror, onStart }) {
  return (
    <li className="flex flex-col rounded-[var(--radius-panel)] border border-gold-700/40 bg-navy-900/80 p-4 shadow-panel">
      <div className="flex items-center gap-3">
        <Portrait id={FOE_ART[spar.archetypeId]} size={56} mood="grim" />
        <div className="min-w-0">
          <h3 className="font-display text-[1.05rem] leading-tight text-gold-100">{spar.name}</h3>
          <p className="text-[0.92rem] text-parchment-300">{spar.check}</p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-[0.98rem] leading-snug text-parchment-200">{spar.lesson}</p>
      {spar.styles ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[0.9rem] text-parchment-300">Fights in the style of a Legacy:</p>
          <Segmented
            label={`${spar.name}: style`}
            options={spar.styles.map((s) => ({ id: s, label: STYLE_LABEL[s] }))}
            value={mirror}
            onChange={onMirror}
            className="w-full justify-between"
          />
          <p className="mt-1.5 text-[0.9rem] text-parchment-300">{LEGACY_NAMES[mirror]}</p>
        </div>
      ) : null}
      {record?.bouts ? (
        <p className="mt-3 text-[0.92rem] text-parchment-300">
          Won {record.wins} of {record.bouts} {record.bouts === 1 ? 'bout' : 'bouts'}
        </p>
      ) : null}
      <Button variant="ghost" icon="sword" className="mt-4 w-full" onClick={onStart}>
        Spar with the {spar.name.replace(/^The /, '')}
      </Button>
    </li>
  );
}

export function TrainingScreen() {
  const { closeTraining, settings } = useGame();
  const [records, setRecords] = useState(loadRecords);
  const [bout, setBout] = useState(null);
  const [last, setLast] = useState(null);
  const [mirror, setMirror] = useState('aegis_mastery');

  const startDrill = (drill) =>
    setBout({
      kind: 'drill',
      id: drill.id,
      title: drill.title,
      config: drillConfig(drill.id, newSeed()),
      brief: { eyebrow: 'Drill', title: `${drill.title}: ${drill.answer.toLowerCase()}`, text: `${drill.instruction} Goal: ${drill.goalLabel.toLowerCase()}.` },
      goalLabel: drill.goalLabel,
      hudLabel: drill.hudLabel,
    });
  const startSpar = (spar) =>
    setBout({
      kind: 'spar',
      id: spar.archetypeId,
      title: spar.name,
      config: sparringConfig(spar.archetypeId, newSeed(), { mirror: spar.styles ? mirror : null }),
    });
  const again = () => {
    if (!last) return;
    if (last.kind === 'drill') startDrill(DRILLS.find((d) => d.id === last.id));
    else startSpar(SPARRING.find((s) => s.archetypeId === last.id));
  };

  if (bout) {
    return (
      <DuelScreen
        key={bout.config.seed}
        config={bout.config}
        brief={bout.brief}
        goalLabel={bout.goalLabel}
        hudLabel={bout.hudLabel}
        showHints={bout.kind === 'drill' || settings.showHints}
        continueLabel="Back to the yard"
        withdrawText={WITHDRAW_TEXT}
        onComplete={(result) => {
          setRecords((r) => recordResult(r, bout, result));
          setLast({ kind: bout.kind, id: bout.id, title: bout.title, result });
          setBout(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const passedCount = DRILLS.filter((d) => records.drills[d.id]?.passed).length;

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-navy-950" aria-labelledby="yard-heading">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <RegionScene beat="champion" regionState="FORTIFIED" timeOfDay="dusk" className="h-full w-full opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-navy-950/80 to-navy-950" />
      </div>
      <div
        className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          <IconButton icon="back" label="Back to the title" onClick={closeTraining} />
          <Eyebrow>Beneath the Citadel</Eyebrow>
        </div>
        <header className="mt-5">
          <h1 id="yard-heading" className="font-display text-[2.3rem] leading-tight text-gold-200 text-gilded sm:text-5xl">
            The Training Yard
          </h1>
          <div className="mt-4 flex items-start gap-3">
            <Portrait id="mara" size={60} mood="warm" label="General Mara Voss" />
            <p className="font-serif text-[1.2rem] italic leading-snug text-parchment-100">
              “Nobody bleeds here and nothing is written down. Learn to read the light, Majesty, and the blade will follow.”
            </p>
          </div>
        </header>

        <LastBout last={last} onAgain={again} />

        <section aria-labelledby="yard-drills" className="mt-8">
          <SectionHeading
            id="yard-drills"
            icon="flag"
            aside={
              <span className="text-[0.92rem] text-parchment-300">
                {passedCount} of {DRILLS.length} passed
              </span>
            }
          >
            Drills
          </SectionHeading>
          <p className="mb-4 max-w-prose text-[1rem] leading-snug text-parchment-200">
            Each drill teaches one colour of the wind-up. The partner repeats the same pattern until you meet the goal.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {DRILLS.map((d) => (
              <DrillCard key={d.id} drill={d} record={records.drills[d.id]} onStart={() => startDrill(d)} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="yard-spar" className="mt-10">
          <SectionHeading id="yard-spar" icon="sword">
            Sparring
          </SectionHeading>
          <p className="mb-4 max-w-prose text-[1rem] leading-snug text-parchment-200">
            The foes of the Marches, with blunted blades. They fight the way they will when it matters.
          </p>
          <ul className="grid gap-4 lg:grid-cols-3">
            {SPARRING.map((s) => (
              <SparCard key={s.id} spar={s} record={records.spars[s.archetypeId]} mirror={mirror} onMirror={setMirror} onStart={() => startSpar(s)} />
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-[0.95rem] text-parchment-400">Your progress in the yard is kept on this device only.</p>
      </div>
    </main>
  );
}
