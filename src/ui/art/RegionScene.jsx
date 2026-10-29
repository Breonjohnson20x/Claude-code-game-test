// <RegionScene beat regionState timeOfDay season monuments className label animated card />
// Cinematic Southern Marches vignette. Wide 400x220 viewBox, sliced to fill
// whatever box it is given (hero banners, cards, full-bleed backdrops).
//
// Motion: a labelled scene (a hero vista people look at) animates by default; an
// unlabelled, decorative one (a dimmed backdrop under text, a card) renders still
// unless `animated` is passed explicitly. A full-screen SMIL backdrop under
// scrims and blurred bars costs a phone a third of its frame budget for drift
// nobody can see. Reduced motion always wins.
import { memo, useEffect, useRef, useState } from 'react';
import { C, LIGHT } from './palette.js';
import { useReducedMotion, useSvgPause, useUid } from './util.js';
import { CARD_FOCUS, FOCUS, SCENE_W as W, SCENE_H as H, cropBox } from './scene/frame.js';
import { SceneDefs } from './scene/parts.jsx';
import { AtmosDefs } from './scene/atmos.jsx';
import { dayRig, normalizeSeason, seasonal, tone } from './scene/tone.js';
import { BEATS } from './scene/beats.jsx';

const BEAT_ALIAS = {
  road: 'road',
  march: 'road',
  travel: 'road',
  checkpoint: 'checkpoint',
  gate: 'checkpoint',
  refugees: 'checkpoint',
  wilds: 'wilds',
  forest: 'wilds',
  north: 'wilds',
  ruin: 'ruin',
  ruins: 'ruin',
  symbol: 'ruin',
  champion: 'champion',
  skirmish: 'champion',
  last_stand: 'champion',
  duel: 'champion',
  border: 'champion',
  camp: 'camp',
  campfire: 'camp',
};

const STATES = new Set(['STABLE', 'FORTIFIED', 'AFTERMATH']);

export function normalizeBeat(beat) {
  const k = String(beat ?? 'road').toLowerCase().replace(/[\s-]+/g, '_');
  return BEAT_ALIAS[k] || 'road';
}

export function normalizeRegionState(state) {
  const k = String(state ?? 'STABLE').toUpperCase();
  return STATES.has(k) ? k : 'STABLE';
}

export function normalizeTimeOfDay(tod) {
  const k = String(tod ?? 'day').toLowerCase();
  if (k === 'evening' || k === 'dawn' || k === 'sunset') return 'dusk';
  return LIGHT[k] ? k : 'day';
}

const BEAT_LABEL = {
  road: 'the military road through the Southern Marches',
  checkpoint: 'the refugee checkpoint gate',
  wilds: 'the snowbound northern wilds',
  ruin: 'an ancient ruin with a glowing monolith',
  champion: 'the scarred border field where an Iron Syndicate walker stands',
  camp: 'the forward camp overlooking the Marches',
};
const STATE_LABEL = { STABLE: 'calm', FORTIFIED: 'fortified', AFTERMATH: 'in the aftermath of battle' };

/** Track the rendered aspect ratio of an element (null until measured). */
function useAspect(ref) {
  const [ar, setAr] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const next = Math.round((r.width / r.height) * 100) / 100;
        setAr((prev) => (prev === next ? prev : next));
      }
    };
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [ref]);
  return ar;
}

function RegionSceneImpl({
  beat = 'road',
  regionState = 'STABLE',
  timeOfDay = 'day',
  monuments = [],
  className = '',
  style,
  label,
  animated,
  season,
  card,
  vignette = true,
  fade = true,
}) {
  const uid = useUid('rs');
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const decorative = !label;
  const motion = Boolean(animated ?? !decorative) && !reduced;
  useSvgPause(ref, motion);
  const ar = useAspect(ref);

  const b = normalizeBeat(beat);
  const st = normalizeRegionState(regionState);
  const tod = normalizeTimeOfDay(timeOfDay);
  const sea = normalizeSeason(season);
  const L = seasonal(dayRig(LIGHT[tod], tod), sea);
  const T0 = tone(L, tod);
  const T = sea === 'winter' ? { ...T0, grade: C.frost300, gradeOp: T0.gradeOp + 0.05 } : sea === 'autumn' ? { ...T0, grade: C.ember400, gradeOp: T0.gradeOp + 0.03 } : T0;
  const Beat = BEATS[b] || BEATS.road;
  const list = Array.isArray(monuments) ? monuments.filter(Boolean) : [];
  const aria = label === true ? `View of ${BEAT_LABEL[b]}, ${STATE_LABEL[st]}${sea ? ` in ${sea}` : ''}, at ${tod}.` : label;
  // a short wide unlabelled box is a card: zoom in so the state change reads
  const isCard = card ?? (decorative && ar != null && ar > 2.05);
  const [x0, y0, vw, vh] = cropBox(ar, (isCard && CARD_FOCUS[b]) || FOCUS[b] || [W / 2, H / 2], { card: isCard });
  // still, decorative scenes drop the purely kinetic extras (birds, fine snow)
  const lite = decorative && !motion;

  return (
    <svg
      ref={ref}
      viewBox={`${x0} ${y0} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      className={className}
      style={{ display: 'block', ...style }}
      role={aria ? 'img' : undefined}
      aria-label={aria || undefined}
      aria-hidden={aria ? undefined : true}
      focusable="false"
      data-beat={b}
      data-region-state={st}
      data-time={tod}
      data-season={sea || undefined}
    >
      <SceneDefs uid={uid} L={L} T={T} />
      <AtmosDefs uid={uid} L={L} T={T} />
      {/* ground under the painting, for frames that overscan past its bottom edge */}
      <rect x="-10" y="200" width="420" height="80" fill={L.fgDeep} />
      {/* key: remount SMIL timelines cleanly when the scene changes */}
      <g key={`${b}-${st}-${tod}-${sea}-${motion ? 1 : 0}`}>
        <Beat uid={uid} L={L} T={T} st={st} tod={tod} motion={motion} monuments={list} lite={lite} card={isCard} season={sea} />
      </g>
      {vignette && (
        <g pointerEvents="none">
          <rect x={x0 - 1} y={y0 - 1} width={vw + 2} height={vh + 2} fill={`url(#${uid}-vig)`} />
          {fade && <rect x={x0 - 1} y={y0 + vh * 0.72} width={vw + 2} height={vh * 0.28 + 1} fill={`url(#${uid}-fade)`} />}
        </g>
      )}
    </svg>
  );
}

function monumentsKey(list) {
  if (!Array.isArray(list)) return '';
  return list.map((m) => `${m?.id ?? ''}|${m?.title ?? ''}`).join(',');
}

function sameProps(a, b) {
  for (const k of Object.keys({ ...a, ...b })) {
    if (k === 'monuments') {
      if (monumentsKey(a.monuments) !== monumentsKey(b.monuments)) return false;
    } else if (k === 'style') {
      if (JSON.stringify(a.style ?? null) !== JSON.stringify(b.style ?? null)) return false;
    } else if (a[k] !== b[k]) return false;
  }
  return true;
}

export const RegionScene = memo(RegionSceneImpl, sameProps);
export default RegionScene;
