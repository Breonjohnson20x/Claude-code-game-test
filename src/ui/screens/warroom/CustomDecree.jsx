// War Room: "The player is never restricted to A–E" (Master Build §18). The Council (or, when
// enabled, the Claude narrator) reads the decree; the simulation still resolves it exactly
// like any order. The preview uses the same pure functions the controller uses.

import { useId, useState } from 'react';
import { Icon } from '../../kit/icons.jsx';
import { Button, Chip, cx } from '../../kit/kit.jsx';
import { parseOrder, buildCustomOrder } from '../../../game/sim/orderParser.js';
import { CostLine, SectionHeading } from './shared.jsx';
import { CATEGORY_WORDS, TARGET_WORDS, weightWord } from './words.js';

const EXAMPLES = [
  'Send envoys to Kessrin and quietly watch their depots.',
  'Feed the refugees and study the lights under the ice.',
  'Fortify the fords and hunt the warg packs.',
];

export function CustomDecree({ state, crisis, aiOn, generators, onIssue }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(null); // { interp, source, text }
  const [busy, setBusy] = useState(false);

  const interpret = async () => {
    const clean = text.trim();
    if (clean.length < 3) return;
    if (!aiOn) {
      setReading({ interp: parseOrder(clean), source: 'council', text: clean });
      return;
    }
    setBusy(true);
    try {
      const r = await generators.orderInterpreter({ state, crisis, text: clean }, () => parseOrder(clean));
      const interp = r?.output?.actions ? r.output : parseOrder(clean);
      setReading({ interp, source: r?.source === 'ai' || r?.source === 'cache' ? 'claude' : 'council', text: clean });
    } catch {
      setReading({ interp: parseOrder(clean), source: 'council', text: clean });
    } finally {
      setBusy(false);
    }
  };

  const preview = reading?.interp?.understood ? buildCustomOrder(crisis, reading.interp, reading.text) : null;
  const stale = reading && reading.text !== text.trim();

  if (!open) {
    return (
      <section aria-labelledby={`${id}-title`} className="mb-8">
        <h2 id={`${id}-title`} className="sr-only">
          A decree of your own
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-gold-600/50 bg-navy-900/60 px-4 py-3 text-left transition hover:border-gold-400 hover:bg-navy-900/80 focus-visible:outline-2 focus-visible:outline-lattice-200"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-500/60 text-gold-300">
            <Icon name="quill" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[1rem] text-gold-200">Write a decree of your own</span>
            <span className="block text-[0.92rem] text-parchment-300">Not bound to A–E. Say what the Crown wants, in plain words.</span>
          </span>
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="panel mb-8 p-5 sm:p-6">
      <SectionHeading id={`${id}-title`} icon="quill">
        A decree of your own
      </SectionHeading>
      <label htmlFor={`${id}-text`} className="block text-[0.95rem] text-parchment-200">
        Speak it plainly. The Council will tell you how they read it before anything is sealed.
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        rows={3}
        placeholder={EXAMPLES[(state.turn - 1) % EXAMPLES.length]}
        className="mt-3 w-full resize-y rounded-lg border border-gold-700/50 bg-navy-950/80 px-3 py-3 font-serif text-[1.15rem] leading-snug text-parchment-50 placeholder:text-parchment-400/70 focus:border-gold-400 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" icon="scroll" onClick={interpret} disabled={text.trim().length < 3 || busy}>
          {busy ? 'The scribes are reading…' : 'Ask the Council'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {reading ? (
        <div aria-live="polite" className={cx('mt-5 rounded-lg border p-4', stale ? 'border-stone-600/50 opacity-70' : 'border-gold-600/45 bg-navy-950/50')}>
          <p className="font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">
            {reading.source === 'claude' ? 'How the Council reads it · narrated by Claude' : 'How the Council reads it'}
          </p>
          {reading.interp.understood ? (
            <>
              <ul className="mt-3 flex flex-wrap gap-2">
                {reading.interp.actions.map((a, i) => (
                  <li key={i}>
                    <Chip tone={a.covert ? 'iron' : 'gold'}>
                      {CATEGORY_WORDS[a.category] ?? a.category}
                      {a.target ? ` → ${TARGET_WORDS[a.target] ?? a.target.replace(/_/g, ' ')}` : ''}
                      {a.covert ? ' · covert' : ''}
                    </Chip>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.95rem] text-parchment-200">{reading.interp.actions.map((a) => weightWord(a.weight)).join(' · ')}</p>
              {preview?.locked ? (
                <p className="mt-3 text-[0.98rem] text-ember-200">{preview.locked}</p>
              ) : preview ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">Cost</span>
                  <CostLine cost={preview.cost} className="text-parchment-50" />
                </div>
              ) : null}
              {stale ? <p className="mt-3 text-[0.92rem] text-parchment-300">You have changed the words. Ask the Council again before decreeing.</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  icon="crown"
                  disabled={stale || Boolean(preview?.locked)}
                  onClick={() => onIssue({ text: reading.text, interpretation: reading.interp })}
                >
                  Decree it
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[1rem] text-parchment-100">{reading.interp.summary}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
