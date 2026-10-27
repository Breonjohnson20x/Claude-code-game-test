// Resolution (Master Build §20 PRESENT RESULT): what the order did, in the world's words.
// Every value here was computed by the simulation; this file only presents it.

import { FactionCrest, Portrait, RegionScene } from '../../art/index.js';
import { Icon } from '../../kit/icons.jsx';
import { RESOURCE_META, cx } from '../../kit/kit.jsx';
import { ChronicleEntry } from '../../overlays/chronicle/ChronicleEntry.jsx';
import { isApprovable, PEN_GOAL } from '../../overlays/chronicle/meta.js';
import { SectionHeading } from '../warroom/shared.jsx';
import { REGION_WORDS, outcomeWord, sentimentWord, signed } from '../warroom/words.js';

export function Outcome({ report }) {
  return (
    <section aria-labelledby="rs-outcome-title" className="panel mb-6 p-5 sm:p-6" aria-live="polite">
      <SectionHeading id="rs-outcome-title" icon="scroll">
        What came of it
      </SectionHeading>
      {report.underfunded ? (
        <p className="mb-4 flex gap-2 rounded-lg border border-ember-500/50 bg-ember-600/15 px-4 py-3 text-[0.98rem] text-ember-200">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          The treasury could not cover it in full. The order went out underfunded and did less than it could have.
        </p>
      ) : null}
      <div className="max-w-prose space-y-4">
        {report.outcome.map((line, i) => (
          <p key={i} className="font-serif text-[1.2rem] leading-relaxed text-parchment-50 animate-fade-up" style={{ animationDelay: `${i * 120}ms` }}>
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

export function Events({ events }) {
  if (!events?.length) return null;
  return (
    <section aria-labelledby="rs-events-title" className="mb-6">
      <SectionHeading id="rs-events-title" icon="alert" tone="ember">
        Meanwhile in Elvia
      </SectionHeading>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="rounded-[var(--radius-panel)] border border-ember-500/45 bg-[linear-gradient(180deg,rgb(138_58_28/0.28),rgb(11_20_36/0.85))] p-4 glow-ember">
            <p className="font-display text-[1.02rem] text-ember-200">{e.title}</p>
            <p className="mt-1 font-serif text-[1.12rem] leading-snug text-parchment-100">{e.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceChanges({ deltas }) {
  const keys = Object.keys(deltas ?? {}).filter((k) => deltas[k] && RESOURCE_META[k]);
  if (!keys.length) return <p className="text-[0.98rem] text-parchment-300">The realm&rsquo;s stores are unchanged.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const d = deltas[k];
        const good = k === 'unrest' ? d < 0 : d > 0;
        const meta = RESOURCE_META[k];
        return (
          <li
            key={k}
            className={cx(
              'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[0.98rem] tabular-nums',
              good ? 'border-gold-500/60 bg-gold-700/25 text-gold-100' : 'border-crimson-400/60 bg-crimson-600/25 text-crimson-200',
            )}
          >
            <Icon name={meta.icon} size={16} />
            <span>{meta.label}</span>
            <span className="font-semibold">{signed(d)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function RelationshipChanges({ shifts, characters }) {
  if (!shifts?.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {shifts.map((r) => (
        <li key={r.character} className="flex items-center gap-3 rounded-lg border border-gold-700/30 bg-navy-950/50 p-3">
          <Portrait id={r.character} size={44} />
          <div className="min-w-0">
            <p className="font-display text-[0.98rem] text-gold-200">{characters[r.character]?.name ?? r.character}</p>
            <p className="text-[0.98rem] text-parchment-100">
              {r.from} <span aria-hidden="true">→</span>
              <span className="sr-only"> to </span> <span className="font-semibold text-gold-200">{r.to}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FactionChanges({ shifts, factions }) {
  if (!shifts?.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {shifts.map((f) => {
        // The resolver reports these as words already (attitudeLabel / tensionLabel).
        const [a0, a1, t0, t1] = [f.from.attitude, f.to.attitude, f.from.tension, f.to.tension].map(String);
        return (
          <li key={f.faction} className="flex items-center gap-3 rounded-lg border border-gold-700/30 bg-navy-950/50 p-3">
            <FactionCrest id={f.faction} size={44} />
            <div className="min-w-0 text-[0.98rem] text-parchment-100">
              <p className="font-display text-[0.98rem] text-gold-200">{factions[f.faction]?.name ?? f.faction}</p>
              <p>
                {a0 === a1 ? `Still ${a1.toLowerCase()}` : `${a0} → ${a1}`}
                <span className="text-parchment-400"> · </span>
                {t0 === t1 ? `tension ${t1.toLowerCase()}` : `tension ${t0.toLowerCase()} → ${t1.toLowerCase()}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RegionChange({ before, after, region }) {
  const words = REGION_WORDS[after] ?? REGION_WORDS.STABLE;
  const changed = before !== after;
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-gold-700/35 bg-navy-900/70">
      <div className="relative h-36 sm:h-44">
        <RegionScene beat="road" regionState={after} timeOfDay="dusk" monuments={region.monuments} animated={false} className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/20 to-transparent" />
        <p className="absolute bottom-3 left-4 font-display text-[1.05rem] text-gold-100 text-engraved">
          {region.name} · {changed ? `${REGION_WORDS[before]?.label ?? before} → ${words.label}` : words.label}
        </p>
      </div>
      <p className="px-4 py-3 text-[0.98rem] leading-relaxed text-parchment-200">{words.line}</p>
    </div>
  );
}

export function Changes({ report, state }) {
  return (
    <section aria-labelledby="rs-changes-title" className="mb-6">
      <SectionHeading id="rs-changes-title" icon="map">
        What changed
      </SectionHeading>
      <div className="space-y-4">
        <ResourceChanges deltas={report.resourceDeltas} />
        <RelationshipChanges shifts={report.relationshipShifts} characters={state.characters} />
        <FactionChanges shifts={report.factionShifts} factions={state.factions} />
        <RegionChange before={report.regionBefore} after={report.regionAfter} region={state.regions.southern_marches} />
      </div>
    </section>
  );
}

export function Memories({ memories, characters }) {
  if (!memories?.length) return null;
  return (
    <section aria-labelledby="rs-memories-title" className="mb-6">
      <SectionHeading id="rs-memories-title" icon="heart">
        They will remember this
      </SectionHeading>
      <ul className="space-y-3">
        {memories.map((m, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-gold-700/30 bg-navy-950/50 p-3">
            <Portrait id={m.characterId} size={44} mood={m.sentiment > 0.15 ? 'warm' : m.sentiment < -0.15 ? 'grim' : 'neutral'} />
            <div className="min-w-0">
              <p className="text-[0.88rem] text-parchment-300">
                <span className="font-display text-gold-200">{characters[m.characterId]?.short ?? m.characterId}</span> · {sentimentWord(m.sentiment)}
              </p>
              <p className="font-serif text-[1.12rem] italic leading-snug text-parchment-50">&ldquo;{m.description}&rdquo;</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Voices({ voices }) {
  if (!voices?.length) return null;
  return (
    <section aria-labelledby="rs-voices-title" className="mb-6">
      <SectionHeading id="rs-voices-title" icon="council">
        Voices of the realm
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {voices.map((v, i) => (
          <li key={i}>
            <figure className="h-full rounded-lg border-l-2 border-gold-600/60 bg-navy-950/45 py-2 pl-4 pr-3">
              <blockquote className="font-serif text-[1.15rem] italic leading-snug text-parchment-50">{v.text}</blockquote>
              <figcaption className="mt-1.5 text-[0.9rem] text-parchment-300">— {v.speaker}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NewChronicle({ entries, state, onApprove }) {
  if (!entries?.length) return null;
  const live = entries.map((e) => state.chronicle.find((x) => x.id === e.id) ?? e);
  const approved = state.counters.chronicleApproved ?? 0;
  return (
    <section aria-labelledby="rs-chronicle-title" className="mb-6">
      <SectionHeading id="rs-chronicle-title" icon="quill">
        Written in the Chronicle
      </SectionHeading>
      <div className="panel-parchment px-4 pb-2 pt-3 sm:px-6">
        <ol className="divide-y divide-ink-500/20">
          {live.map((e) => (
            <ChronicleEntry key={e.id} entry={e} canApprove={isApprovable(state, e)} onApprove={onApprove} />
          ))}
        </ol>
      </div>
      <p className="mt-2 text-[0.92rem] text-parchment-300">
        Approving an entry has the Chronicler record it in full. {Math.min(approved, PEN_GOAL)} of {PEN_GOAL} approved this reign
        {approved >= PEN_GOAL ? ': The Chronicler’s Pen is earned.' : ' toward The Chronicler’s Pen.'}
      </p>
    </section>
  );
}

export function MarchSummary({ expedition }) {
  if (!expedition) return null;
  const duels = expedition.duels ?? [];
  const fallen = expedition.fallen ?? [];
  return (
    <section aria-labelledby="rs-march-title" className="panel mb-6 p-5 sm:p-6">
      <SectionHeading id="rs-march-title" icon="flag">
        {expedition.title ?? 'The march'}
      </SectionHeading>
      {expedition.retreated ? (
        <p className="mb-3 text-[1rem] text-ember-200">The Sovereign turned back before the march was done. The Chronicle records it, and champions will hear of it.</p>
      ) : null}
      {duels.length ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {duels.map((d, i) => (
            <li key={i} className={cx('chip', d.outcome === 'victory' ? 'chip--gold' : d.outcome === 'defeat' ? 'chip--crimson' : 'chip--iron')}>
              <Icon name="sword" size={14} /> {outcomeWord(d.outcome)} · {d.enemyName}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[1rem] text-parchment-200">No blade was drawn on this march.</p>
      )}
      {fallen.length ? (
        <div className="rounded-lg border border-stone-600/50 bg-stone-950/50 p-4">
          <p className="font-display text-[0.8rem] uppercase tracking-[0.2em] text-stone-300">Names for the wall at Greywater</p>
          <ul className="mt-2 space-y-1 font-serif text-[1.1rem] text-parchment-100">
            {fallen.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[1rem] text-parchment-200">Everyone who marched came home.</p>
      )}
    </section>
  );
}
