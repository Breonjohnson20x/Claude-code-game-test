// The Chronicle (Cycle doc §4, §8): the dynasty's write-only record, grouped by reign.
// This reign's entries can be approved (APPROVE_CHRONICLE), which feeds The Chronicler's Pen.

import { useEffect, useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Sheet, cx } from '../kit/kit.jsx';
import { GoldDivider, Sigil } from '../art/index.js';
import { legacyName } from '../../game/content/legacies.js';
import { ChronicleEntry } from './chronicle/ChronicleEntry.jsx';
import { Segmented } from './chronicle/Segmented.jsx';
import { isApprovable, PEN_GOAL, reignGroups } from './chronicle/meta.js';

const SCOPES = [
  { id: 'reign', label: 'This reign' },
  { id: 'all', label: 'All reigns' },
];

function PenProgress({ state }) {
  const n = state.counters.chronicleApproved ?? 0;
  const done = n >= PEN_GOAL;
  const inEffect = state.cycle.activeLegacies?.includes('chroniclers_pen');
  const left = PEN_GOAL - n;
  return (
    <section aria-labelledby="pen-title" className={cx('tablet mt-4 p-4', done && 'shadow-[0_0_0_1px_#04070d,0_0_24px_-8px_rgb(227_196_99/0.55)]')}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="socket size-11 shrink-0">
          <Sigil name="quill" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 id="pen-title" className="font-display text-[1.02rem] text-gold-200 text-engraved">
              The Chronicler&rsquo;s Pen
            </h3>
            <p className="flex items-center gap-2.5 text-[0.95rem] text-parchment-200">
              <span aria-hidden="true" className="flex gap-2 px-0.5">
                {Array.from({ length: PEN_GOAL }, (_, i) => (
                  <span key={i} className={cx('pip', i < n && 'pip--on')} />
                ))}
              </span>
              <span className="font-semibold tabular-nums">
                {Math.min(n, PEN_GOAL)} of {PEN_GOAL}
              </span>
              <span className="sr-only">entries approved this reign</span>
            </p>
          </div>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-parchment-300">
            {done
              ? 'Earned this reign. At the Passing you may carry The Chronicler’s Pen into the next life.'
              : `Approving an entry asks the Chronicler to record it in full — the season’s order and its witnesses. Approve ${left} more this reign to earn The Chronicler’s Pen, a Legacy you may carry at the Passing.`}
          </p>
          {inEffect ? <p className="mt-1.5 text-[0.95rem] text-gold-300">The Pen is in effect this reign: the Chronicle records more detail.</p> : null}
        </div>
      </div>
    </section>
  );
}

function ReignPage({ group, state, onApprove, fresh }) {
  const { info, entries } = group;
  return (
    <section aria-labelledby={`reign-${info.cycle}`} className="panel-parchment mt-5 px-4 pb-3 pt-5 sm:px-7 sm:pt-6">
      <header className="flex items-center gap-3 sm:gap-4">
        <span
          aria-hidden="true"
          className="coin size-12 shrink-0 text-[1.05rem]"
        >
          {info.numeral}
        </span>
        <div className="min-w-0">
          <h3 id={`reign-${info.cycle}`} className="font-display text-[1.15rem] leading-tight text-ink-900 sm:text-[1.3rem]">
            <span className="sr-only">Reign {info.numeral}: </span>
            {info.sovereign}
          </h3>
          <p className="mt-0.5 text-[0.95rem] text-ink-500">
            {[info.years, info.status].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>
      {info.legacies.length ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.88rem] text-ink-700">
          <span className="font-display text-[0.74rem] uppercase tracking-[0.18em] text-ink-500">{info.current ? 'Carried in' : 'Carried on'}</span>
          {info.legacies.map((id) => (
            <span key={id} className="chip chip--parchment !min-h-7 !text-[0.8rem]">
              {legacyName(id)}
            </span>
          ))}
        </p>
      ) : null}
      <GoldDivider className="mt-3 opacity-80" />
      {entries.length ? (
        <ol className="divide-y divide-ink-500/20">
          {entries.map((e) => (
            <ChronicleEntry key={e.id} entry={e} canApprove={isApprovable(state, e)} onApprove={onApprove} fresh={fresh === e.id} />
          ))}
        </ol>
      ) : (
        <p className="py-5 font-serif text-[1.15rem] italic text-ink-500">Nothing is written yet this reign. The Chronicle opens with your first decree.</p>
      )}
    </section>
  );
}

export function ChronicleSheet({ open, onClose }) {
  const { state, act } = useGame();
  const [scope, setScope] = useState('reign');
  const [fresh, setFresh] = useState(null);
  const [announce, setAnnounce] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  // Forget the last approval when the sheet closes (adjusting state during render, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setFresh(null);
      setAnnounce('');
    }
  }

  useEffect(() => {
    if (!fresh) return;
    document.querySelector(`[data-entry="${CSS.escape(fresh)}"]`)?.focus?.();
  }, [fresh]);

  if (!state) return null;
  const groups = reignGroups(state, scope);
  const pending = state.chronicle.filter((e) => isApprovable(state, e)).length;

  const approve = (entry) => {
    const r = act({ type: 'APPROVE_CHRONICLE', entryId: entry.id });
    if (r?.error) return;
    const n = r.state.counters.chronicleApproved ?? 0;
    setFresh(entry.id);
    setAnnounce(
      `Approved: ${entry.title}. ${Math.min(n, PEN_GOAL)} of ${PEN_GOAL} toward The Chronicler’s Pen${n >= PEN_GOAL ? ' — earned this reign' : ''}.`,
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="The Chronicle" eyebrow="Write-only · never overwritten" wide>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-prose text-[0.95rem] leading-relaxed text-parchment-300">
          The dynasty&rsquo;s record, in the order it was written. Every reign stays readable; the world can only cite what is written here.
          {pending ? ` ${pending} ${pending === 1 ? 'entry awaits' : 'entries await'} your approval.` : ''}
        </p>
        <Segmented label="Show entries from" options={SCOPES} value={scope} onChange={setScope} className="shrink-0 self-start sm:self-auto" />
      </div>
      <PenProgress state={state} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {groups.map((g) => (
        <ReignPage key={g.info.cycle} group={g} state={state} onApprove={approve} fresh={fresh} />
      ))}
      {scope === 'all' && groups.length === 1 ? (
        <p className="mt-4 text-center text-[0.95rem] italic text-parchment-300">Earlier reigns appear here once a reign has passed.</p>
      ) : null}
      {scope === 'reign' && state.history.length ? (
        <p className="mt-4 text-center text-[0.95rem] text-parchment-300">
          {state.history.length === 1 ? 'One earlier reign is' : `${state.history.length} earlier reigns are`} kept under &ldquo;All reigns&rdquo;.
        </p>
      ) : null}
    </Sheet>
  );
}
