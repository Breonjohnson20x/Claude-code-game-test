import { cx } from '../../kit/kit.jsx';
import { Sigil } from '../../art/index.js';
import { KindIcon, LocalGlyph } from './KindIcon.jsx';
import { entryWhen, isPrivate, kindMeta, tagLabel } from './meta.js';

/** Wax-seal stamp shown on approved entries. */
export function ApprovedSeal({ fresh = false }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-crimson-500/45 bg-crimson-500/10 py-1 pl-1.5 pr-3 font-display text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-crimson-600',
        fresh && 'animate-seal-press',
      )}
    >
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d9726b,#9e2b25_60%,#521410)] text-parchment-50 shadow-[0_1px_2px_rgb(60_10_5/0.5)]">
        <LocalGlyph name="check" size={14} />
      </span>
      Approved
    </span>
  );
}

/**
 * One Chronicle entry on a parchment page.
 * Props: entry, canApprove, onApprove(entry), fresh (just approved), headingRef
 */
export function ChronicleEntry({ entry, canApprove, onApprove, fresh = false }) {
  const meta = kindMeta(entry.kind);
  const tags = (entry.tags ?? []).filter((t) => t !== entry.kind);
  const headingId = `chron-${entry.id}`;
  return (
    <li className="py-4 first:pt-2 last:pb-1">
      <article aria-labelledby={headingId} className="flex gap-3 sm:gap-4">
        <KindIcon kind={entry.kind} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-display text-[0.78rem] uppercase tracking-[0.16em] text-ink-500">
            <span>{entryWhen(entry)}</span>
            <span aria-hidden="true">·</span>
            <span>{meta.label}</span>
          </p>
          <h4 id={headingId} tabIndex={-1} data-entry={entry.id} className="mt-0.5 font-display text-[1.06rem] leading-snug text-ink-900 outline-none focus-visible:underline">
            {entry.title}
          </h4>
          <p className="mt-1 font-serif text-[1.15rem] leading-relaxed text-ink-700">{entry.text}</p>
          {entry.approved && entry.detail ? (
            <p className="mt-2.5 flex gap-2 rounded-r-md border-l-2 border-gold-600/70 bg-gold-200/25 py-1.5 pl-3 pr-2 font-serif text-[1.06rem] italic leading-relaxed text-ink-700">
              <Sigil name="quill" size={16} className="mt-1 shrink-0 text-gold-700" />
              <span>
                <span className="sr-only">Recorded in full: </span>
                {entry.detail}
              </span>
            </p>
          ) : null}
          {tags.length || isPrivate(entry) || entry.approved || canApprove ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {tags.map((t) => (
                <span key={t} className="chip chip--parchment !min-h-7 !text-[0.8rem]">
                  {tagLabel(t)}
                </span>
              ))}
              {isPrivate(entry) ? <span className="chip chip--parchment !min-h-7 !text-[0.8rem] italic">Private · stays by the fire</span> : null}
              {entry.approved ? <ApprovedSeal fresh={fresh} /> : null}
              {canApprove ? (
                <button
                  type="button"
                  onClick={() => onApprove?.(entry)}
                  aria-label={`Approve “${entry.title}”`}
                  className="ml-auto inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg border border-ink-700/70 bg-[linear-gradient(180deg,#3b2f22,#1f1810)] px-3.5 font-display text-[0.88rem] font-semibold tracking-wide text-gold-200 shadow-[inset_0_1px_0_rgb(255_244_214/0.15),0_2px_4px_rgb(40_25_5/0.35)] transition hover:text-gold-100 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                >
                  <Sigil name="quill" size={15} />
                  Approve
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
