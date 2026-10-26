import { cx, Meter } from '../../kit/kit.jsx';
import { RegionScene, Sigil } from '../../art/index.js';
import { THREAD_IDS } from '../../../game/core/state.js';
import { LEGACIES, legacyName } from '../../../game/content/legacies.js';
import { causeWord, romanNumeral } from '../chronicle/meta.js';
import { REGION_STATE_WORD, THREAD_STATUS_WORD, urgencyWord } from './words.js';

const REGION_GLOSS = {
  STABLE: 'Roads open, markets trading, the garrison at ordinary strength.',
  FORTIFIED: 'Walls raised and wards lit. Safer, and everyone can see it.',
  AFTERMATH: 'Smoke over the fields. The Marches are rebuilding.',
};

function Section({ id, title, eyebrow, children, className }) {
  return (
    <section aria-labelledby={id} className={cx('mt-6 first:mt-0', className)}>
      {eyebrow ? <p className="font-display text-[0.72rem] uppercase tracking-[0.22em] text-gold-400/90">{eyebrow}</p> : null}
      <h3 id={id} className="font-display text-[1.12rem] text-gold-200">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Threads({ state }) {
  const threads = THREAD_IDS.map((id) => state.threads[id])
    .concat(Object.values(state.threads).filter((t) => !THREAD_IDS.includes(t.id)))
    .filter((t) => t && t.visibility !== 'hidden');
  if (!threads.length) return <p className="text-[0.95rem] italic text-parchment-400">Nothing stirs that the Crown can see.</p>;
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {threads.map((t) => {
        const resolved = t.status === 'resolved';
        const word = resolved ? 'Settled' : urgencyWord(t.urgency);
        return (
          <li key={t.id} className={cx('rounded-xl border p-3.5', resolved ? 'border-stone-600/50 bg-stone-950/50' : 'border-gold-700/30 bg-navy-900/60')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 font-display text-[1rem] leading-snug text-parchment-50">{t.title}</p>
              <span className={t.visibility === 'rumored' ? 'chip chip--frost !text-[0.8rem]' : 'chip chip--iron !text-[0.8rem]'}>
                {t.visibility === 'rumored' ? 'Rumored' : 'Known'}
              </span>
            </div>
            <p className="mt-1 text-[0.92rem] text-parchment-300">
              {THREAD_STATUS_WORD[t.status] ?? 'Unfolding'} · <span className={cx(!resolved && t.urgency >= 70 ? 'text-crimson-300' : !resolved && t.urgency >= 40 ? 'text-ember-300' : 'text-gold-300')}>{word}</span>
            </p>
            {resolved ? null : <Meter value={t.urgency} label={`Urgency of ${t.title}: ${word}`} tone={t.urgency >= 70 ? 'crimson' : t.urgency >= 40 ? 'ember' : 'gold'} className="mt-2" />}
          </li>
        );
      })}
    </ul>
  );
}

function Marches({ region }) {
  const word = REGION_STATE_WORD[region.state] ?? region.state;
  const monuments = region.monuments ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-gold-700/35 bg-navy-900/60">
      <div className="relative h-32 sm:h-40">
        <RegionScene beat="road" regionState={region.state} timeOfDay="dusk" monuments={monuments} animated={false} className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-3">
          <div className="min-w-0">
            <p className="font-display text-[1.08rem] leading-tight text-gold-200 text-engraved">{region.name}</p>
            <p className="text-[0.88rem] text-parchment-200">{region.subtitle}</p>
          </div>
          <span className={cx('chip', region.state === 'AFTERMATH' ? 'chip--crimson' : region.state === 'FORTIFIED' ? 'chip--gold' : 'chip--iron')}>{word}</span>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        <p className="text-[0.95rem] leading-relaxed text-parchment-200">{REGION_GLOSS[region.state]}</p>
        <p className="mt-2 flex items-start gap-2 text-[0.95rem] text-parchment-200">
          <Sigil name="sword" size={16} className="mt-1 shrink-0 text-gold-500" />
          {region.casualties > 0
            ? `${region.casualties} ${region.casualties === 1 ? 'name is' : 'names are'} on the wall at Greywater this reign.`
            : 'No soldier of the Marches has been lost this reign.'}
        </p>
        <p className="mt-4 font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-400/90">Monuments</p>
        {monuments.length ? (
          <ul className="mt-2 space-y-2">
            {monuments.map((m) => (
              <li key={m.id} className="flex gap-3 rounded-lg border border-gold-700/25 bg-navy-950/50 p-3">
                <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-stone-500/50 bg-stone-800 text-stone-200">
                  <Sigil name="diamond" size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[0.98rem] text-parchment-50">{m.title}</p>
                  <p className="font-serif text-[1.08rem] leading-snug text-parchment-200">
                    {m.text[0].toUpperCase() + m.text.slice(1)}
                    {m.year ? <span className="ml-2 whitespace-nowrap font-body text-[0.8rem] text-parchment-400">raised {m.year} E.R.</span> : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.95rem] italic text-parchment-400">Nothing has been raised in stone yet. The Marches remember with monuments, not words.</p>
        )}
      </div>
    </div>
  );
}

function ActiveLegacies({ ids }) {
  if (!ids.length) {
    return <p className="text-[0.95rem] italic text-parchment-400">No Legacy was carried into this reign. Whatever you earn now, you may carry at the Passing.</p>;
  }
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {ids.map((id) => (
        <li key={id} className="rounded-xl border border-gold-500/45 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(227_196_99/0.14),transparent_60%),rgb(11_20_36/0.7)] p-3.5">
          <p className="flex items-center gap-2 font-display text-[1rem] text-gold-200">
            <Sigil name="star" size={14} className="text-gold-400" />
            {legacyName(id)}
          </p>
          <p className="mt-1 text-[0.95rem] leading-snug text-parchment-200">{LEGACIES[id]?.effect}</p>
        </li>
      ))}
    </ul>
  );
}

function PastReigns({ history }) {
  if (!history.length) {
    return <p className="text-[0.95rem] italic text-parchment-400">This is the first reign. When it ends, it will be remembered here.</p>;
  }
  const list = [...history].sort((a, b) => b.cycle - a.cycle);
  return (
    <ol className="space-y-2.5">
      {list.map((h) => (
        <li key={h.cycle} className="flex gap-3.5 rounded-xl border border-gold-700/30 bg-navy-900/60 p-3.5">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-700/60 bg-[radial-gradient(circle_at_35%_30%,#fbefc2,#e3c463_40%,#a8841b_85%)] font-display text-[0.95rem] font-bold text-navy-950"
          >
            {romanNumeral(h.cycle)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.02rem] text-gold-200">
              <span className="sr-only">Reign {romanNumeral(h.cycle)}: </span>
              {h.sovereign}
            </p>
            <p className="text-[0.92rem] text-parchment-300">
              {h.startYear}–{h.endYear} E.R. · {causeWord(h.cause)}
            </p>
            <p className="mt-1.5 text-[0.92rem] text-parchment-200">
              {h.legacies?.length ? (
                <>
                  <span className="text-parchment-400">Carried on: </span>
                  {h.legacies.map(legacyName).join(' · ')}
                </>
              ) : (
                <span className="italic text-parchment-400">Carried nothing across. Everything became history.</span>
              )}
            </p>
            {h.highlights?.length ? (
              <p className="mt-1 font-serif text-[1.05rem] italic leading-snug text-parchment-300">{h.highlights.slice(0, 3).join(' · ')}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WorldTab({ state }) {
  return (
    <>
      <Section id="world-threads" eyebrow="What the Crown can see" title="Threads in motion">
        <Threads state={state} />
      </Section>
      <Section id="world-marches" eyebrow="The frontier" title="The Southern Marches">
        <Marches region={state.regions.southern_marches} />
      </Section>
      <Section id="world-legacies" eyebrow="Carried across the Passing" title="Legacies in effect">
        <ActiveLegacies ids={state.cycle.activeLegacies ?? []} />
      </Section>
      <Section id="world-reigns" eyebrow="The dynasty" title="Past reigns">
        <PastReigns history={state.history ?? []} />
      </Section>
    </>
  );
}
