// War Room: orders A–E as tactile cards, and the confirm sheet where the Crown seals one.
// Never shows an order's outcome or effects before it is chosen (the simulation decides).

import { useState } from 'react';
import { Portrait } from '../../art/index.js';
import { Icon } from '../../kit/icons.jsx';
import { Button, Sheet, cx } from '../../kit/kit.jsx';
import { useReducedMotion, reactionWord, ADVISOR_IDS } from './words.js';
import { CategoryIcon, CostLine, ReactionMark, SealOverlay, SectionHeading } from './shared.jsx';

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

function OrderCard({ order, characters, onOpen, index }) {
  const danger = Boolean(order.warning);
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${160 + index * 70}ms` }}>
      <button
        type="button"
        className={cx('order-card min-h-[5.5rem]', danger && 'order-card--danger')}
        onClick={() => onOpen(order)}
        aria-disabled={order.locked ? true : undefined}
        aria-describedby={`order-${order.id}-meta`}
      >
        <span className="order-card__key" aria-hidden="true">
          {order.id}
        </span>
        <span className="order-card__body">
          <span className="flex items-center gap-2 font-display text-[0.72rem] uppercase tracking-[0.18em] text-gold-500">
            <CategoryIcon category={order.category} size={14} />
            {order.categoryName}
          </span>
          <span className="order-card__title">{order.label}</span>
          <span className="order-card__desc line-clamp-3">{order.text}</span>
          <span id={`order-${order.id}-meta`} className="order-card__meta mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <CostLine cost={order.cost} size={15} className="text-parchment-200" />
            <Reactions reactions={order.reactions} characters={characters} />
            {!order.affordable ? (
              <span className="inline-flex items-center gap-1 text-ember-300">
                <Icon name="alert" size={14} /> Underfunded
              </span>
            ) : null}
          </span>
          {order.warning ? (
            <span className="mt-1 inline-flex items-start gap-1.5 text-[0.9rem] font-semibold text-crimson-300">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
              {order.warning}
            </span>
          ) : null}
          {order.locked ? <span className="mt-1 text-[0.9rem] text-stone-300">{order.locked}</span> : null}
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
          <OrderCard key={o.id} order={o} characters={characters} onOpen={setOpen} index={i} />
        ))}
      </ol>
      <OrderSheet order={open} characters={characters} onClose={() => setOpen(null)} onSeal={seal} />
      {sealing ? <SealOverlay label={`Sealed · ${sealing.label}`} /> : null}
    </section>
  );
}

export { Reactions };
