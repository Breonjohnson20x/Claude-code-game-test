import { useEffect, useRef, useState } from 'react';
import { Button, cx } from '../../kit/kit.jsx';
import { FactionCrest, GoldDivider, PanelCorners, Sigil } from '../../art/index.js';
import { ActionBar } from './ActionBar.jsx';
import { StepHeader } from './StepHeader.jsx';

/** An illuminated initial: the first letter set in a gilded, framed square. */
function DropCap({ text }) {
  const first = text.trim().charAt(0);
  const rest = text.trim().slice(1);
  return (
    <>
      <span
        aria-hidden="true"
        className="float-left mr-2.5 mt-1 grid size-[3.4rem] place-items-center rounded-[0.35rem] border border-gold-700/70 bg-[radial-gradient(circle_at_30%_25%,#2b4268,#0b1424_75%)] font-display text-[2.3rem] leading-none text-gold-300 shadow-[inset_0_0_0_2px_rgb(227_196_99/0.25),0_2px_4px_rgb(60_40_10/0.4)]"
      >
        {first}
      </span>
      <span className="sr-only">{first}</span>
      {rest}
    </>
  );
}

function ReadbackLine({ line, index }) {
  return (
    <li className="animate-fade-up py-5 first:pt-3 last:pb-2" style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}>
      <article aria-labelledby={`rb-${line.id}`}>
        <p className="font-serif text-[1.12rem] italic leading-snug text-crimson-600">{line.voice}&thinsp;&mdash;</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 id={`rb-${line.id}`} className="font-display text-[1.08rem] leading-snug text-ink-900 sm:text-[1.15rem]">
            {line.title}
          </h3>
          <span className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-ink-500">{line.year} E.R.</span>
        </div>
        <p className="mt-1.5 font-serif text-[1.18rem] leading-relaxed text-ink-700">{index === 0 ? <DropCap text={line.text} /> : line.text}</p>
        {line.approved && line.detail ? (
          <p className="clear-left mt-3 flex gap-2.5 rounded-r-md border-l-2 border-gold-600/70 bg-gold-200/30 py-2 pl-3 pr-2 font-serif text-[1.06rem] italic leading-relaxed text-ink-700">
            <Sigil name="quill" size={17} className="mt-1 shrink-0 text-gold-700" />
            <span>
              <span className="mr-1 not-italic font-display text-[0.72rem] uppercase tracking-[0.16em] text-gold-800">Approved · recorded in full</span>
              <br />
              {line.detail}
            </span>
          </p>
        ) : null}
      </article>
    </li>
  );
}

function Verdicts({ verdicts }) {
  return (
    <section aria-labelledby="verdicts-title" className="panel p-4 sm:p-5">
      <p className="font-display text-[0.72rem] uppercase tracking-[0.22em] text-gold-400/90">Civilization memory</p>
      <h2 id="verdicts-title" className="font-display text-[1.15rem] text-gold-200">
        How the world will remember this reign
      </h2>
      <ul className="mt-3 space-y-3">
        {verdicts.map((v, i) => (
          <li key={v.faction} className="animate-fade-up flex gap-3.5 rounded-xl border border-gold-700/30 bg-navy-950/60 p-3.5" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <FactionCrest id={v.faction} size={52} className="shrink-0" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[1rem] text-parchment-50">{v.name}</span>
                <span className={cx('chip !min-h-7 !text-[0.78rem]', v.label === 'Unwritten' ? 'chip--iron' : v.label === 'Oathbreaker' || v.label === 'Conqueror' ? 'chip--crimson' : 'chip--gold')}>
                  {v.label}
                </span>
              </p>
              <p className="mt-1 text-[0.98rem] leading-snug text-parchment-200">{v.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.9rem] leading-snug text-parchment-400">These names carry into every reign that follows. Waiting does not wash them out.</p>
    </section>
  );
}

/** Optional Claude narration of the reign; never blocks the authored read-back. */
function ScribesNarration({ state, cause, aiOn, generators }) {
  const [status, setStatus] = useState(aiOn ? 'writing' : 'off');
  const [paragraphs, setParagraphs] = useState([]);
  const asked = useRef(false);

  useEffect(() => {
    if (!aiOn || asked.current || !generators?.chronicle) return undefined;
    asked.current = true;
    let alive = true;
    const entries = state.chronicle.filter((e) => e.cycle === state.cycle.number);
    generators
      .chronicle({ state, entries, cause }, () => null)
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r?.output?.paragraphs) ? r.output.paragraphs.filter(Boolean) : [];
        setParagraphs(list);
        setStatus(list.length && r.source !== 'fallback' ? 'done' : 'none');
      })
      .catch(() => alive && setStatus('none'));
    return () => {
      alive = false;
    };
    // Ask once per Passing; the authored read-back stands on its own meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOn]);

  if (!aiOn || status === 'off' || status === 'none') return null;
  return (
    <section aria-labelledby="scribes-title" aria-live="polite" className="relative mb-5 rounded-xl border border-gold-600/40 bg-[radial-gradient(120%_100%_at_50%_0%,rgb(227_196_99/0.12),transparent_60%),rgb(11_20_36/0.82)] p-4 sm:p-5">
      <h2 id="scribes-title" className="flex flex-wrap items-baseline gap-x-2 font-display text-[0.8rem] uppercase tracking-[0.2em] text-gold-300">
        As the scribes tell it
        <span className="font-body text-[0.78rem] normal-case tracking-normal text-parchment-400">— narrated by Claude</span>
      </h2>
      {status === 'writing' ? (
        <p className="mt-2 flex items-center gap-2 font-serif text-[1.12rem] italic text-parchment-300">
          <Sigil name="quill" size={16} className="text-gold-400 animate-slow-glow" />
          The scribes are writing…
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="animate-fade-up font-serif text-[1.18rem] leading-relaxed text-parchment-100" style={{ animationDelay: `${i * 120}ms` }}>
              {p}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Step II — the Chronicle read back in the world's words. */
export function ChronicleStep({ view, state, tone, onNext, headingRef, aiOn, generators }) {
  const rb = view.readback ?? { lines: [], verdicts: [] };
  const approved = rb.lines.filter((l) => l.approved).length;
  return (
    <div>
      <StepHeader headingRef={headingRef} eyebrow={tone.eyebrow(view.sovereign)} title="The Chronicle" seal="Read back in the world’s words." lead={tone.chronicle} />

      <div className="mt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="min-w-0">
          <ScribesNarration state={state} cause={view.passing.cause} aiOn={aiOn} generators={generators} />
          <section aria-labelledby="manuscript-title" className="panel-parchment relative px-5 pb-4 pt-7 sm:px-9 sm:pt-9">
            <PanelCorners size={26} inset={9} color="#7d6114" opacity={0.7} />
            <header className="text-center">
              <p className="font-display text-[0.72rem] uppercase tracking-[0.26em] text-ink-500">The Chronicle of Elvia</p>
              <h2 id="manuscript-title" className="mt-1 font-display text-[1.45rem] leading-tight text-ink-900 sm:text-[1.7rem]">
                The Reign of {rb.sovereign}
              </h2>
              <p className="mt-1 font-serif text-[1.1rem] italic text-ink-500">{rb.years}</p>
            </header>
            <GoldDivider className="mx-auto mt-4 max-w-sm" />
            {rb.lines.length ? (
              <ol className="divide-y divide-ink-500/20">
                {rb.lines.map((l, i) => (
                  <ReadbackLine key={l.id} line={l} index={i} />
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center font-serif text-[1.18rem] italic text-ink-500">The Chronicle of this reign is short. Nothing was written that the world repeats.</p>
            )}
            <p className="mt-2 border-t border-ink-500/20 pt-3 text-center text-[0.88rem] text-ink-500">
              {approved
                ? `${approved} ${approved === 1 ? 'entry was' : 'entries were'} approved and recorded in full. Words said by the fire stay by the fire.`
                : 'Words said by the fire stay by the fire. Nothing here is ever rewritten.'}
            </p>
          </section>
        </div>
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
          <Verdicts verdicts={rb.verdicts} />
          <ActionBar className="max-lg:hidden">
            <Button icon="forward" onClick={onNext} className="w-full">
              Continue to what survives you
            </Button>
          </ActionBar>
        </div>
      </div>

      <ActionBar className="lg:hidden">
        <Button icon="forward" onClick={onNext}>
          Continue to what survives you
        </Button>
      </ActionBar>
    </div>
  );
}
