import { cx, Meter } from '../../kit/kit.jsx';
import { FactionCrest } from '../../art/index.js';
import { FACTION_IDS } from '../../../game/core/state.js';
import { attitudeLabel, civilizationLabel, tensionLabel } from '../../../game/core/relationships.js';
import { romanNumeral } from '../chronicle/meta.js';
import { attitudeTone, tensionTone } from './words.js';

const ATTITUDE_GLOSS = {
  Allied: 'They would stand beside Elvia.',
  Warm: 'They are inclined to trust the Crown.',
  Guarded: 'They are watching, and have not decided.',
  Hostile: 'They expect the worst of Elvia.',
  Implacable: 'They want Elvia broken.',
};

function FactionCard({ f, history, index }) {
  const attitude = attitudeLabel(f.attitude);
  const tension = tensionLabel(f.tension);
  const civ = civilizationLabel(f.memory);
  const past = history.filter((h) => h.civilization?.[f.id]);
  return (
    <li
      className="animate-fade-up relative overflow-hidden rounded-xl border border-gold-700/35 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(227_196_99/0.08),transparent_55%),linear-gradient(180deg,rgb(22_36_58/0.75),rgb(11_20_36/0.75))] p-4 sm:p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex gap-4">
        <FactionCrest id={f.id} size={64} className="shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.6)]" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.12rem] leading-snug text-gold-200">{f.name}</h3>
          <p className="mt-0.5 text-[0.95rem] text-parchment-200">
            <span className="text-parchment-400">Led by </span>
            {f.leader}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gold-700/25 bg-navy-950/50 p-3">
          <dt className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-400/90">Attitude to Elvia</dt>
          <dd className="mt-1.5">
            <span className={attitudeTone(attitude)}>{attitude}</span>
            <p className="mt-1.5 text-[0.95rem] leading-snug text-parchment-300">{ATTITUDE_GLOSS[attitude]}</p>
          </dd>
        </div>
        <div className="rounded-lg border border-gold-700/25 bg-navy-950/50 p-3">
          <dt className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-400/90">Tension</dt>
          <dd className="mt-1.5">
            <p className={cx('font-display text-[1.02rem]', tensionTone(f.tension) === 'crimson' ? 'text-crimson-300' : tensionTone(f.tension) === 'ember' ? 'text-ember-300' : 'text-gold-300')}>
              {tension}
            </p>
            <Meter value={f.tension} label={`Tension with ${f.name}: ${tension}`} tone={tensionTone(f.tension)} className="mt-2" />
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded-lg border border-gold-600/35 bg-[linear-gradient(90deg,rgb(79_61_13/0.35),rgb(11_20_36/0.2))] p-3">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-400/90">How they remember Elvia</p>
        <p className="mt-1 font-display text-[1.15rem] text-gold-200">{civ.label}</p>
        <p className="font-serif text-[1.1rem] italic leading-snug text-parchment-200">{civ.gloss[0].toUpperCase() + civ.gloss.slice(1)}.</p>
        <p className="mt-1.5 text-[0.9rem] leading-snug text-parchment-400">Civilization memory outlives the Sovereign. It carries into every reign and does not fade by waiting.</p>
        {past.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label={`How ${f.name} remembered earlier reigns`}>
            {past.map((h) => (
              <li key={h.cycle} className="chip chip--iron !text-[0.82rem]">
                Reign {romanNumeral(h.cycle)} · {h.civilization[f.id]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function FactionsTab({ state }) {
  const factions = FACTION_IDS.map((id) => state.factions[id]).filter(Boolean);
  return (
    <>
      <p className="max-w-prose text-[0.95rem] leading-relaxed text-parchment-300">
        The powers on Elvia&rsquo;s borders. Attitude and tension move with every decree; what they call you lasts for generations.
      </p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {factions.map((f, i) => (
          <FactionCard key={f.id} f={f} history={state.history} index={i} />
        ))}
      </ul>
    </>
  );
}
