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
      className="tablet animate-fade-up p-4 sm:p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-4">
        {/* the crest is drawn for 64px and shown larger where there is room, so its metalwork reads */}
        <FactionCrest id={f.id} size={64} className="size-16 shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.6)] sm:size-[88px]" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.12rem] leading-snug text-gold-200 text-engraved sm:text-[1.2rem]">{f.name}</h3>
          <p className="mt-0.5 text-[0.95rem] text-parchment-200">
            <span className="text-parchment-400">Led by </span>
            {f.leader}
          </p>
        </div>
      </div>

      {/* attitude and tension share one well, stacked, so neither box is ever half empty */}
      <dl className="well mt-4 divide-y divide-black/40 px-3.5">
        <div className="py-3">
          <dt className="label-engraved">Attitude to Elvia</dt>
          <dd className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={attitudeTone(attitude)}>{attitude}</span>
            <span className="text-[0.95rem] leading-snug text-parchment-200">{ATTITUDE_GLOSS[attitude]}</span>
          </dd>
        </div>
        <div className="py-3 shadow-[inset_0_1px_0_rgb(255_244_214/0.05)]">
          <dt className="label-engraved">Tension</dt>
          <dd className="mt-1.5">
            <p className={cx('font-display text-[1.02rem]', tensionTone(f.tension) === 'crimson' ? 'text-crimson-300' : tensionTone(f.tension) === 'ember' ? 'text-ember-300' : 'text-gold-300')}>
              {tension}
            </p>
            <Meter value={f.tension} label={`Tension with ${f.name}: ${tension}`} tone={tensionTone(f.tension)} className="mt-2" />
          </dd>
        </div>
      </dl>

      <div className="well well--lit mt-3 px-3.5 py-3">
        <p className="label-engraved">How they remember Elvia</p>
        <p className="mt-1 font-display text-[1.15rem] text-gold-200">{civ.label}</p>
        <p className="font-serif text-[1.1rem] italic leading-snug text-parchment-200">{civ.gloss[0].toUpperCase() + civ.gloss.slice(1)}.</p>
        <p className="mt-1.5 text-[0.95rem] leading-snug text-parchment-300">Civilization memory outlives the Sovereign. It carries into every reign and does not fade by waiting.</p>
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
