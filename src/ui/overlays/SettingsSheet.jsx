import { useState } from 'react';
import { useGame } from '../game/GameProvider.jsx';
import { Sheet, Button, Eyebrow, Rule, cx } from '../kit/kit.jsx';
import { TEXT_SIZES, MODEL_OPTIONS } from '../game/settings.js';
import { audio } from '../audio/audio.js';

function Row({ label, hint, children, htmlFor }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="font-display text-[0.98rem] text-gold-200">
          {label}
        </label>
        {hint ? <p className="text-[0.88rem] text-parchment-300">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-gold-700/40 bg-navy-950/60 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'min-h-11 min-w-11 rounded-lg px-3 text-[0.9rem] font-semibold transition',
            value === o.id ? 'bg-gold-500 text-navy-950' : 'text-gold-300 hover:bg-gold-500/15',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-11 w-[4.75rem] shrink-0 rounded-full border transition', checked ? 'border-gold-400 bg-gold-500' : 'border-gold-700/60 bg-navy-950')}
    >
      <span className={cx('absolute top-[3px] size-9 rounded-full bg-parchment-50 shadow transition-all', checked ? 'left-[35px]' : 'left-[3px]')} />
    </button>
  );
}

export function SettingsSheet({ open, onClose }) {
  const { settings, updateSettings, aiStatus, state, quitToTitle } = useGame();
  const [showKey, setShowKey] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Settings" eyebrow="The Royal Household" wide>
      <Eyebrow>Reading & motion</Eyebrow>
      <Row label="Text size" hint="Scales every word in the game.">
        <Segmented label="Text size" options={TEXT_SIZES} value={settings.textSize} onChange={(v) => updateSettings({ textSize: v })} />
      </Row>
      <Row label="Reduce motion" hint="Calmer scenes, no screen shake. 'System' follows your device.">
        <Segmented
          label="Reduce motion"
          options={[
            { id: 'system', label: 'System' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ]}
          value={settings.reducedMotion}
          onChange={(v) => updateSettings({ reducedMotion: v })}
        />
      </Row>
      <Row label="Control hints" hint="Show input hints at the start of duels." htmlFor="set-hints">
        <Toggle id="set-hints" label="Control hints" checked={settings.showHints} onChange={(v) => updateSettings({ showHints: v })} />
      </Row>
      <Rule />
      <Eyebrow>Sound & touch</Eyebrow>
      <Row label="Sound" hint="Procedural score and effects." htmlFor="set-sound">
        <Toggle
          id="set-sound"
          label="Sound"
          checked={!settings.muted}
          onChange={(v) => {
            audio.unlock();
            updateSettings({ muted: !v });
          }}
        />
      </Row>
      <Row label="Volume" htmlFor="set-volume">
        <input
          id="set-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
          onPointerUp={() => audio.sfx('click')}
          className="h-11 w-48 accent-[#c9a227]"
        />
      </Row>
      <Row label="Haptics" hint="Vibration on phones that support it." htmlFor="set-haptics">
        <Toggle id="set-haptics" label="Haptics" checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
      </Row>
      <Rule />
      <Eyebrow>Claude narrator (optional)</Eyebrow>
      <p className="mt-1 text-[0.92rem] text-parchment-300">
        The whole game plays without AI. Turn this on and Claude interprets your custom decrees, adds voices at the campfire and reads the Chronicle back at the
        Passing. Claude only <em>requests</em> small changes — the simulation validates and caps every one. Your key is stored only in this browser and sent only to
        Anthropic. Server-side refusal fallbacks are enabled, so a refused request falls back to another model instead of failing.
      </p>
      <Row label="Use Claude" htmlFor="set-ai">
        <Toggle id="set-ai" label="Use Claude" checked={settings.aiEnabled} onChange={(v) => updateSettings({ aiEnabled: v })} />
      </Row>
      <Row label="Anthropic API key" hint="Stored on this device only." htmlFor="set-key">
        <div className="flex gap-2">
          <input
            id="set-key"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={settings.apiKey}
            placeholder="sk-ant-…"
            onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })}
            className="h-12 w-56 rounded-lg border border-gold-700/50 bg-navy-950 px-3 text-parchment-50 placeholder:text-stone-500"
          />
          <Button variant="ghost" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'Hide' : 'Show'}
          </Button>
        </div>
      </Row>
      <Row label="Model" htmlFor="set-model">
        <select
          id="set-model"
          value={settings.model}
          onChange={(e) => updateSettings({ model: e.target.value })}
          className="h-12 rounded-lg border border-gold-700/50 bg-navy-950 px-3 text-parchment-50"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Calls per session" hint="Cost control: the narrator stops after this many calls and the authored text takes over." htmlFor="set-budget">
        <input
          id="set-budget"
          type="number"
          min={0}
          max={200}
          value={settings.aiBudget}
          onChange={(e) => updateSettings({ aiBudget: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
          className="h-12 w-24 rounded-lg border border-gold-700/50 bg-navy-950 px-3 text-parchment-50"
        />
      </Row>
      <p className="rounded-lg border border-gold-700/30 bg-navy-950/60 px-3 py-2 text-[0.88rem] text-parchment-300" aria-live="polite">
        Narrator: {settings.aiEnabled ? (settings.apiKey ? 'on' : 'waiting for a key') : 'off — authored text only'}
        {aiStatus ? ` · ${aiStatus.callsThisSession ?? 0} of ${settings.aiBudget} calls used` : ''}
        {aiStatus?.keyRejected ? ' · the key was rejected' : ''}
        {aiStatus?.lastError ? ` · last issue: ${aiStatus.lastError}` : ''}
      </p>
      {state ? (
        <>
          <Rule />
          <Button variant="ghost" icon="back" onClick={quitToTitle}>
            Save and return to title
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}
