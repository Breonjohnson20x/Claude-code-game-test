import { useState } from 'react';
import { cx } from '../../kit/kit.jsx';
import { Portrait } from '../../art/index.js';
import { CHARACTER_IDS } from '../../../game/core/state.js';
import { relationshipLabel, relationshipNotes } from '../../../game/core/relationships.js';
import { romanNumeral } from '../chronicle/meta.js';
import { isDead, joinAnd, sentimentOf, statusWord, tierChip } from './words.js';

const SHOW = 3;

/** A memory that quotes another ("…") nests it in single quotes inside the outer quote marks. */
function nested(text) {
  return String(text).replace(/"([^"]*)"/g, '‘$1’');
}

function MemoryMark({ tone }) {
  const label = tone === 'warm' ? 'A warm memory' : tone === 'cold' ? 'A cold memory' : 'A mixed memory';
  return (
    <span className="mt-1.5 shrink-0" title={label}>
      <span className="sr-only">{label}: </span>
      <span
        aria-hidden="true"
        className={cx(
          'block size-2.5 rotate-45 rounded-[2px]',
          tone === 'warm' && 'bg-[linear-gradient(135deg,#f9c99a,#e0782b)] shadow-[0_0_8px_rgb(224_120_43/0.7)]',
          tone === 'cold' && 'border border-frost-300/80 bg-navy-700',
          tone === 'mixed' && 'bg-stone-400/70',
        )}
      />
    </span>
  );
}

function Memories({ ch, memories, cycle }) {
  const [all, setAll] = useState(false);
  if (!memories.length) {
    return <p className="mt-3 text-[0.95rem] italic text-parchment-400">Nothing you have done has stayed with {ch.short} yet.</p>;
  }
  const shown = all ? memories : memories.slice(0, SHOW);
  return (
    <div className="mt-3">
      <p className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-400/90">What {ch.short} remembers</p>
      <ul className="mt-2 space-y-2">
        {shown.map((m) => {
          const tone = sentimentOf(m);
          const older = m.cycle !== cycle;
          return (
            <li key={m.id} className="flex gap-2.5">
              <MemoryMark tone={tone} />
              <p className="min-w-0 font-serif text-[1.1rem] leading-snug text-parchment-100">
                <q className="italic [quotes:'“'_'”'_'‘'_'’']">{nested(m.description)}</q>
                {older || m.type === 'inherited' ? (
                  <span className="ml-2 whitespace-nowrap align-middle font-body text-[0.78rem] not-italic text-parchment-400">
                    {m.type === 'inherited' ? 'family story' : `reign ${romanNumeral(m.cycle)}`}
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      {memories.length > SHOW ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-[0.92rem] font-semibold text-gold-300 underline decoration-gold-600/60 underline-offset-4 hover:text-gold-200 focus-visible:outline-2 focus-visible:outline-lattice-200"
        >
          {all ? `Show fewer of ${ch.short}’s memories` : `Show all ${memories.length} of ${ch.short}’s memories`}
        </button>
      ) : null}
    </div>
  );
}

function CharacterCard({ ch, memories, cycle, index }) {
  const dead = isDead(ch);
  const tier = relationshipLabel(ch.rel);
  const notes = relationshipNotes(ch.rel);
  return (
    <li
      className={cx('animate-fade-up rounded-xl border p-4 sm:p-5', dead ? 'border-stone-600/50 bg-stone-950/60' : 'border-gold-700/35 bg-navy-900/60')}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="flex gap-3.5 sm:gap-4">
        <Portrait id={ch.id} size={68} mood={dead ? 'grim' : 'neutral'} className={cx('shrink-0', dead && 'grayscale-[0.85] opacity-80')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 font-display text-[1.08rem] leading-snug text-gold-200">{ch.name}</h3>
            {dead ? <span className="chip chip--iron">Remembered</span> : <span className={tierChip(tier)}>{tier}</span>}
          </div>
          <p className="mt-0.5 text-[0.95rem] leading-snug text-parchment-200">{ch.role}</p>
          <p className="mt-1 text-[0.9rem] text-parchment-300">
            {dead ? statusWord(ch) : `${statusWord(ch)} · age ${ch.age}`}
          </p>
        </div>
      </div>
      {dead ? (
        <p className="mt-3 border-l-2 border-stone-500/60 pl-3 font-serif text-[1.1rem] italic leading-snug text-parchment-300">
          {ch.short} does not come back. The Chronicle keeps what you did; the world keeps how it felt.
        </p>
      ) : (
        <p className="mt-3 text-[0.98rem] leading-relaxed text-parchment-200">
          {notes.length ? `${ch.short} ${joinAnd(notes)}.` : `${ch.short} has not made up their mind about you yet.`}
        </p>
      )}
      <Memories ch={ch} memories={memories} cycle={cycle} />
    </li>
  );
}

export function CouncilTab({ state }) {
  const people = CHARACTER_IDS.map((id) => state.characters[id]).filter((ch) => ch && ch.status !== 'unmet');
  const byChar = (id) =>
    state.memories
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.characterId === id)
      .sort((a, b) => b.m.cycle - a.m.cycle || b.m.turn - a.m.turn || b.i - a.i)
      .map(({ m }) => m);
  return (
    <>
      <p className="max-w-prose text-[0.95rem] leading-relaxed text-parchment-300">
        Those who know the Crown, and how they feel about you. Companions age, retire and have children; their heirs inherit an opinion of you.
      </p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {people.map((ch, i) => (
          <CharacterCard key={ch.id} ch={ch} memories={byChar(ch.id)} cycle={state.cycle.number} index={i} />
        ))}
      </ul>
    </>
  );
}
