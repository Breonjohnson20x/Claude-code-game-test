// An illuminated manuscript page: aged parchment, a rubricated double rule, gilt vine margins,
// illuminated corners and a headpiece. Wraps Chronicle text (the Passing read-back and the
// Resolution's new entries). Decorative layers are aria-hidden; the content is untouched.

import { cx } from '../../kit/kit.jsx';

// A gilt vine for the margins, as a tiling SVG (gold stem, leaves, crimson berries). Theme hues only.
const VINE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='64' viewBox='0 0 16 64'>` +
    `<path d='M8 0C3 8 3 16 8 24s5 16 0 24-5 12 0 16' fill='none' stroke='#a8841b' stroke-width='1.2'/>` +
    `<path d='M6.2 12c-4-1-5.5-3.5-5-6 2.6.2 4.6 2.2 5 6Z' fill='#7d6114' opacity='.85'/>` +
    `<path d='M9.6 36c4-1 5.6-3.4 5.2-6-2.7.2-4.8 2.2-5.2 6Z' fill='#7d6114' opacity='.85'/>` +
    `<circle cx='11.5' cy='18' r='1.5' fill='#9e2b25'/><circle cx='4.4' cy='44' r='1.5' fill='#9e2b25'/>` +
    `<circle cx='8' cy='56' r='1' fill='#c9a227'/>` +
    `</svg>`,
)}")`;

/** Illuminated corner: gold quarter-rosette with a navy and crimson inlay. */
function Corner({ className, style }) {
  return (
    <svg viewBox="0 0 48 48" className={cx('absolute size-9 sm:size-11', className)} style={style} aria-hidden="true" focusable="false">
      <path d="M2 2h30c-6 3-10 7-12 12C15 16 9 20 2 30Z" fill="#1f3150" stroke="#a8841b" strokeWidth="1.2" />
      <path d="M2 2h20c-4 2-6 5-7 8-3 1-7 4-13 10Z" fill="#7a1f1a" opacity="0.85" />
      <path d="M2 2 26 26" stroke="#e3c463" strokeWidth="1" opacity="0.8" />
      <circle cx="11" cy="11" r="4.2" fill="#c9a227" stroke="#fbefc2" strokeWidth="0.8" />
      <circle cx="11" cy="11" r="1.6" fill="#fbefc2" />
      <path d="M32 2c4 0 7 2 8 5M2 30c0 4 2 7 5 8" fill="none" stroke="#a8841b" strokeWidth="1" />
      <circle cx="41" cy="8" r="1.4" fill="#a8841b" />
      <circle cx="8" cy="41" r="1.4" fill="#a8841b" />
    </svg>
  );
}

/** The headpiece: a gilt band with the broken circle and star, flanked by scrolled rules. */
export function Headpiece({ className }) {
  return (
    <svg viewBox="0 0 280 34" className={cx('mx-auto block h-8 w-64 sm:w-72', className)} aria-hidden="true" focusable="false">
      <g fill="none" stroke="#a8841b" strokeLinecap="round">
        <path d="M8 17h92c6 0 8-6 13-6s5 5 2 6-4-1-3-2" strokeWidth="1.2" />
        <path d="M272 17H180c-6 0-8-6-13-6s-5 5-2 6 4-1 3-2" strokeWidth="1.2" />
        <path d="M30 21h66M250 21h-66" strokeWidth="0.6" opacity="0.7" stroke="#7a1f1a" />
      </g>
      <circle cx="140" cy="17" r="14" fill="#1f3150" stroke="#a8841b" strokeWidth="1.4" />
      <path d="M137 5.3A12 12 0 1 0 151 10.5" fill="none" stroke="#e3c463" strokeWidth="2" strokeLinecap="round" />
      <path d="M140 10l1.6 5.4L147 17l-5.4 1.6L140 24l-1.6-5.4L133 17l5.4-1.6Z" fill="#f0dc95" />
    </svg>
  );
}

/** The parchment page. `as` sets the element (section by default); other props pass through. */
export function Manuscript({ as: Tag = 'section', className, children, vines = true, ...rest }) {
  return (
    <Tag
      className={cx('relative isolate overflow-hidden rounded-[0.55rem] text-ink-900', className)}
      style={{
        background: [
          'var(--elvia-grain)',
          // foxing: a few age spots
          'radial-gradient(circle at 84% 12%, rgb(163 145 103 / 0.13) 0, transparent 3rem)',
          'radial-gradient(circle at 10% 62%, rgb(163 145 103 / 0.1) 0, transparent 4rem)',
          'radial-gradient(circle at 70% 88%, rgb(163 145 103 / 0.12) 0, transparent 2.5rem)',
          // lamp light from the upper right
          'radial-gradient(120% 70% at 80% 0%, rgb(255 253 247 / 0.55), transparent 60%)',
          'linear-gradient(180deg, #f3eee1 0%, #ebe1c9 55%, #e1d3b2 100%)',
        ].join(','),
        boxShadow: [
          'inset 0 0 0 1px rgb(255 255 255 / 0.35)',
          'inset 0 0 48px 6px rgb(163 145 103 / 0.45)',
          'inset 0 0 6px 1px rgb(94 77 57 / 0.45)',
          '0 22px 44px -18px rgb(0 0 0 / 0.9)',
          '0 2px 6px rgb(0 0 0 / 0.5)',
        ].join(','),
      }}
      {...rest}
    >
      {/* rubricated double rule */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-[9px] -z-10 rounded-[0.3rem] border-[1.5px] border-crimson-600/45" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-[13px] -z-10 rounded-[0.2rem] border border-gold-600/55" />
      {/* gilt vines in the margins (wider screens have the room) */}
      {vines ? (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-12 left-[18px] top-12 -z-10 hidden w-4 opacity-80 sm:block" style={{ backgroundImage: VINE }} />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-12 right-[18px] top-12 -z-10 hidden w-4 -scale-x-100 opacity-80 sm:block" style={{ backgroundImage: VINE }} />
        </>
      ) : null}
      <Corner className="left-[5px] top-[5px]" />
      <Corner className="right-[5px] top-[5px]" style={{ transform: 'scaleX(-1)' }} />
      <Corner className="bottom-[5px] left-[5px]" style={{ transform: 'scaleY(-1)' }} />
      <Corner className="bottom-[5px] right-[5px]" style={{ transform: 'scale(-1, -1)' }} />
      {children}
    </Tag>
  );
}
