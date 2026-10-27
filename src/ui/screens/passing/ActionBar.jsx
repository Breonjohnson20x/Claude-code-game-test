import { cx } from '../../kit/kit.jsx';

/** Thumb-reach action bar: sticks to the bottom of the viewport on phones, sits inline on desktop. */
export function ActionBar({ children, note, className }) {
  return (
    <div
      className={cx(
        'sticky bottom-0 z-20 -mx-4 mt-8 border-t border-gold-700/30 bg-[linear-gradient(180deg,rgb(7_13_24/0.82),rgb(7_13_24/0.97))] px-4 pt-3 backdrop-blur-[3px] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-none lg:px-0 lg:backdrop-blur-none',
        className,
      )}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {note ? <div className="mb-2.5 text-center text-[0.92rem] leading-snug text-parchment-300 lg:text-left">{note}</div> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end lg:justify-start">{children}</div>
    </div>
  );
}
