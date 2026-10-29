import { useRef, useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Sheet, Button, Eyebrow, cx } from '../kit/kit.jsx';

const REASON = {
  before_resolution: 'before a decision',
  after_resolution: 'after a decision',
  after_campfire: 'after a campfire',
  cycle_start: 'at the start of a reign',
  expedition: 'on the march',
  import: 'imported',
};

function when(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function SavesSheet({ open, onClose, mode = 'game' }) {
  const { slots, state, saveSlot, loadSlot, removeSlot, exportSlot, importSlot } = useGame();
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef(null);
  const importTarget = useRef(1);

  const download = (slot) => {
    const json = exportSlot(slot);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elvia-${slot === 'auto' ? 'autosave' : `slot-${slot}`}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importSlot(importTarget.current, await file.text());
  };

  // One gold button per sheet: in a reign, "Save here" on the first empty slot; from the title,
  // "Load" on the most recent save. Every other action stays brass-edged glass.
  const saveTarget = mode === 'game' && state ? slots.find((s) => s.slot !== 'auto' && !s.summary && !s.corrupt)?.slot : undefined;
  const loadTarget =
    mode === 'title'
      ? [...slots].filter((s) => s.summary && !s.corrupt).sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))[0]?.slot
      : undefined;

  return (
    <Sheet open={open} onClose={onClose} title="The Royal Archive" eyebrow="Save & load" wide>
      <p className="mb-4 text-[0.95rem] leading-relaxed text-parchment-300">
        Saves hold a reign. The dynasty record above them holds everything the world remembers — loading an older save never makes Elvia forget.
      </p>
      <ul className="space-y-3">
        {slots.map((s) => {
          const label = s.slot === 'auto' ? 'Autosave' : `Slot ${s.slot}`;
          const sum = s.summary;
          return (
            <li key={String(s.slot)} className={cx(sum || s.corrupt ? 'tablet p-3.5 sm:p-4' : 'well p-3.5 sm:p-4')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Eyebrow>{label}</Eyebrow>
                {s.savedAt ? <span className="text-[0.88rem] tabular-nums text-parchment-300">{when(s.savedAt)}</span> : null}
              </div>
              {s.corrupt ? (
                <p className="mt-1 text-crimson-300">This save is damaged and cannot be loaded.</p>
              ) : sum ? (
                <div className="mt-1">
                  <p className="font-display text-[1.05rem] text-gold-100 text-engraved">{sum.sovereign}</p>
                  <p className="text-[0.95rem] text-parchment-200">
                    {sum.label}
                    {s.reason ? ` · ${REASON[s.reason] ?? s.reason}` : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-1 font-serif text-[1.1rem] italic text-parchment-300">Empty</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {mode === 'game' && state && s.slot !== 'auto' ? (
                  <Button variant={!sum && s.slot === saveTarget ? 'royal' : 'ghost'} onClick={() => (sum ? setConfirm({ kind: 'overwrite', slot: s.slot }) : saveSlot(s.slot))}>
                    {sum ? 'Overwrite' : 'Save here'}
                  </Button>
                ) : null}
                {sum && !s.corrupt ? (
                  <Button variant={s.slot === loadTarget ? 'royal' : 'ghost'} onClick={() => (state ? setConfirm({ kind: 'load', slot: s.slot }) : loadSlot(s.slot))}>
                    Load
                  </Button>
                ) : null}
                {sum && !s.corrupt ? (
                  <Button variant="ghost" icon="download" onClick={() => download(s.slot)} aria-label={`Export ${label}`}>
                    Export
                  </Button>
                ) : null}
                {s.slot !== 'auto' ? (
                  <Button
                    variant="ghost"
                    icon="upload"
                    aria-label={`Import into ${label}`}
                    onClick={() => {
                      importTarget.current = s.slot;
                      fileRef.current?.click();
                    }}
                  >
                    Import
                  </Button>
                ) : null}
                {sum || s.corrupt ? (
                  <Button variant="danger" icon="trash" aria-label={`Delete ${label}`} onClick={() => setConfirm({ kind: 'delete', slot: s.slot })}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'delete' ? 'Delete this save?' : confirm?.kind === 'load' ? 'Load this save?' : 'Overwrite this save?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.kind === 'delete' ? 'danger' : 'royal'}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c.kind === 'delete') removeSlot(c.slot);
                if (c.kind === 'overwrite') saveSlot(c.slot);
                if (c.kind === 'load') loadSlot(c.slot);
              }}
            >
              {confirm?.kind === 'delete' ? 'Delete' : confirm?.kind === 'load' ? 'Load' : 'Overwrite'}
            </Button>
          </>
        }
      >
        <p className="text-parchment-200">
          {confirm?.kind === 'load'
            ? 'Your current reign will be replaced by this save. What the dynasty has already earned stays remembered.'
            : confirm?.kind === 'delete'
              ? 'This cannot be undone.'
              : 'The save in this slot will be replaced.'}
        </p>
      </Sheet>
    </Sheet>
  );
}
