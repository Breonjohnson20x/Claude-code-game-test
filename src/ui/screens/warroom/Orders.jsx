// War Room: orders A–E as tactile cards, and the confirm sheet where the Crown seals one.
// Never shows an order's outcome or effects before it is chosen (the simulation decides).

import { useState } from 'react';
import { Portrait } from '../../art/index.js';
import { Icon } from '../../kit/icons.jsx';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { useReducedMotion, reactionWord, ADVISOR_IDS } from './words.js';
import { CategoryIcon, CostLine, ReactionMark, SealOverlay, SectionHeading } from './shared.jsx';
import { CATEGORY_TONE, Medallion, categoryTone } from './ornate.jsx';

function Reactions({ reactions, characters, size = 26, withWords = false }) {
  const ids = ADVISOR_IDS.filter((id) => reactions?.[id]);
  if (!ids.length) return null;
  if (withWords) {
    return (
      <ul className="space-y-2">
        {ids.map((id) => (
          <li key={id} className="flex items-center gap-3">
            <span className="relative shrink-0">
              <Portrait id={id} size={40} ring={false} />
              <ReactionMark reaction={reactions[id]} size={16} className="absolute -bottom-0.5 -right-0.5" />
            </span>
            <p className="text-[0.98rem] text-parchment-100">
              <span className="font-semibold text-gold-200">{characters[id]?.short ?? id}</span> {reactionWord(reactions[id])}.
            </p>
          </li>
        ))}
      </ul>
    );
  }
  const summary = ids.map((id) => `${characters[id]?.short ?? id} ${reactionWord(reactions[id])}`).join(', ');
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={summary}>
      {ids.map((id) => (
        <span key={id} className="relative" aria-hidden="true">
          <Portrait id={id} size={size} ring={false} />
          <ReactionMark reaction={reactions[id]} size={12} className="absolute -bottom-1 -right-1" />
        </span>
      ))}
    </span>
  );
}

/** An order as a sealed dossier: an engraved letter medallion, a category accent, the cost plate. */
function OrderCard({ order, characters, onOpen, index, selected }) {
  const danger = Boolean(order.warning);
  const tone = categoryTone(order.category);
  const edge = danger ? '194 65 58' : tone.glow;
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${160 + index * 70}ms` }}>
      <button
        type="button"
        className={cx(
          'group relative isolate flex w-full min-h-[5.5rem] items-start gap-3.5 overflow-hidden rounded-[0.9rem] border p-3.5 pr-4 text-left transition duration-200 sm:gap-4 sm:p-4',
          'shadow-[inset_0_1px_0_rgb(255_244_214/0.08),0_14px_28px_-16px_rgb(0_0_0/0.9),0_2px_5px_rgb(0_0_0/0.45)]',
          'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-lattice-200 active:translate-y-[2px]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
          selected
            ? 'border-gold-400 shadow-[0_0_0_1px_rgb(227_196_99/0.45),0_0_34px_-10px_rgb(227_196_99/0.7),0_14px_28px_-16px_rgb(0_0_0/0.9)]'
            : danger
              ? 'border-crimson-400/60 hover:border-crimson-300'
              : 'border-gold-700/55 hover:-translate-y-0.5 hover:border-gold-500/80',
        )}
        style={{
          background: [
            'var(--elvia-grain)',
            `radial-gradient(120% 90% at 0% 0%, rgb(${edge} / ${selected ? 0.2 : 0.11}), transparent 55%)`,
            'radial-gradient(90% 70% at 100% 0%, rgb(255 244 214 / 0.06), transparent 60%)',
            danger ? 'linear-gradient(180deg, #2a1418 0%, #170f16 60%, #0f0d14 100%)' : 'linear-gradient(180deg, #1d293d 0%, #141e30 58%, #0e1625 100%)',
          ].join(','),
        }}
        onClick={() => onOpen(order)}
        aria-pressed={selected}
        aria-disabled={order.locked ? true : undefined}
        aria-describedby={`order-${order.id}-meta`}
      >
        {/* inner engraved frame and a category accent along the top edge */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] -z-10 rounded-[0.7rem] border border-gold-500/15 group-hover:border-gold-400/25" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, rgb(${edge} / 0.95), rgb(${edge} / 0.35) 45%, transparent 85%)` }}
        />
        {/* dossier tab notch, top right */}
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-0 h-2.5 w-10 rounded-b-[4px] border-x border-b border-gold-700/50 bg-navy-950/70" />
        <span className="relative mt-0.5 shrink-0">
          <Medallion letter={order.id} size={58} tone={danger ? CATEGORY_TONE.military : tone} lit={selected} dim={Boolean(order.locked)} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-start gap-2 pr-11 font-display text-[0.74rem] leading-snug uppercase tracking-[0.2em]" style={{ color: danger ? '#d9726b' : tone.accent }}>
            <CategoryIcon category={order.category} size={14} />
            <span>{order.categoryName}</span>
          </span>
          <span className="mt-1 font-display text-[1.14rem] leading-[1.2] text-gold-100 text-engraved sm:text-[1.2rem]">{order.label}</span>
          <span className="mt-1.5 line-clamp-3 text-[0.98rem] leading-snug text-parchment-200">{order.text}</span>
          <span id={`order-${order.id}-meta`} className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gold-700/30 pt-2.5">
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex min-h-8 items-center rounded-md border border-brass-500/45 bg-[linear-gradient(180deg,rgb(122_95_54/0.38),rgb(11_20_36/0.6))] px-2.5 shadow-[inset_0_1px_0_rgb(255_244_214/0.12)]">
                <CostLine cost={order.cost} size={15} className="text-[0.98rem] font-semibold text-parchment-50" />
              </span>
              {!order.affordable ? (
                <span className="inline-flex items-center gap-1 text-[0.92rem] font-semibold text-ember-300">
                  <Icon name="alert" size={14} /> Underfunded
                </span>
              ) : null}
            </span>
            <Reactions reactions={order.reactions} characters={characters} />
          </span>
          {order.warning ? (
            <span className="mt-2 inline-flex items-start gap-1.5 text-[0.92rem] font-semibold text-crimson-300">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
              {order.warning}
            </span>
          ) : null}
          {order.locked ? <span className="mt-2 text-[0.92rem] text-stone-300">{order.locked}</span> : null}
        </span>
      </button>
    </li>
  );
}

/** The confirm sheet: full order text, cost, the Council's reactions, then the seal. */
function OrderSheet({ order, characters, onClose, onSeal }) {
  return (
    <Sheet
      open={Boolean(order)}
      onClose={onClose}
      eyebrow={order ? `Order ${order.id} · ${order.categoryName}` : ''}
      title={order?.label}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button icon="crown" onClick={() => onSeal(order)} disabled={Boolean(order?.locked)}>
            Seal the order
          </Button>
        </>
      }
    >
      {order ? (
        <div className="space-y-5">
          <p className="font-serif text-[1.22rem] leading-relaxed text-parchment-50">{order.text}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gold-700/30 bg-navy-950/60 px-4 py-3">
            <span className="font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">Cost</span>
            <CostLine cost={order.cost} size={18} className="text-[1.05rem] text-parchment-50" />
          </div>
          {!order.affordable ? (
            <p className="flex gap-2 rounded-lg border border-ember-500/50 bg-ember-600/15 px-4 py-3 text-[0.98rem] text-ember-200">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              The treasury cannot cover this in full. The order will go out underfunded, at reduced strength.
            </p>
          ) : null}
          {order.warning ? (
            <p className="flex gap-2 rounded-lg border border-crimson-400/60 bg-crimson-600/20 px-4 py-3 text-[0.98rem] font-semibold text-crimson-300">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              {order.warning}
            </p>
          ) : null}
          <div>
            <p className="mb-2 font-display text-[0.75rem] uppercase tracking-[0.2em] text-gold-400">The Council</p>
            <Reactions reactions={order.reactions} characters={characters} withWords />
          </div>
          <p className="text-[0.92rem] text-parchment-300">Once sealed, the season turns. The Chronicle will remember what you chose.</p>
        </div>
      ) : null}
    </Sheet>
  );
}

export function Orders({ crisis, characters, onIssue }) {
  const [open, setOpen] = useState(null);
  const [sealing, setSealing] = useState(null);
  const reduced = useReducedMotion();

  const seal = (order) => {
    setOpen(null);
    if (reduced) {
      onIssue(order);
      return;
    }
    setSealing(order);
    // A short, weighty beat; the action never waits on more than this.
    setTimeout(() => onIssue(order), 850);
  };

  return (
    <section aria-labelledby="wr-orders-title" className="mb-8">
      <SectionHeading id="wr-orders-title" icon="crown" aside={<span className="text-[0.85rem] text-parchment-300">Choose one</span>}>
        Royal orders
      </SectionHeading>
      <ol className="space-y-3">
        {crisis.orders.map((o, i) => (
          <OrderCard key={o.id} order={o} characters={characters} onOpen={setOpen} index={i} selected={(open ?? sealing)?.id === o.id} />
        ))}
      </ol>
      <OrderSheet order={open} characters={characters} onClose={() => setOpen(null)} onSeal={seal} />
      {sealing ? <SealOverlay label={`Sealed · ${sealing.label}`} /> : null}
    </section>
  );
}

export { Reactions };
