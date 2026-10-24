// <RegionScene beat regionState timeOfDay monuments className />
// Cinematic Southern Marches vignette. Wide 400x220 viewBox, sliced to fill
// whatever box it is given (hero banners, cards, full-bleed backdrops).
import { memo, useEffect, useRef, useState } from 'react';
import { LIGHT } from './palette.js';
import { clamp, useReducedMotion, useSvgPause, useUid } from './util.js';
import { SceneDefs } from './scene/parts.jsx';
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

// Focal point per beat (viewBox units). When the container is narrower or
// shorter than 400:220 we crop around this instead of the plain centre, so the
// keep / gate / walker / fire stays in frame on a portrait phone.
const FOCUS = {
  road: [236, 132],
  checkpoint: [244, 140],
  wilds: [218, 142],
  ruin: [205, 136],
  champion: [212, 150],
  camp: [198, 152],
};
const W = 400;
const H = 220;

function cropBox(ar, [fx, fy]) {
  if (!ar || !Number.isFinite(ar)) return [0, 0, W, H];
  let w = W;
  let h = H;
  if (ar < W / H) w = H * ar;
  else h = W / ar;
  w = Math.max(60, w);
  h = Math.max(40, h);
  const x0 = clamp(fx - w / 2, 0, W - w);
  const y0 = clamp(fy - h / 2, 0, H - h);
  return [Math.round(x0 * 10) / 10, Math.round(y0 * 10) / 10, Math.round(w * 10) / 10, Math.round(h * 10) / 10];
}

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
  animated = true,
  vignette = true,
  fade = true,
}) {
  const uid = useUid('rs');
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const motion = Boolean(animated) && !reduced;
  useSvgPause(ref, motion);
  const ar = useAspect(ref);

  const b = normalizeBeat(beat);
  const st = normalizeRegionState(regionState);
  const tod = normalizeTimeOfDay(timeOfDay);
  const L = LIGHT[tod];
  const Beat = BEATS[b] || BEATS.road;
  const list = Array.isArray(monuments) ? monuments.filter(Boolean) : [];
  const aria = label === true ? `View of ${BEAT_LABEL[b]}, ${STATE_LABEL[st]}, at ${tod}.` : label;
  const [x0, y0, vw, vh] = cropBox(ar, FOCUS[b] || [W / 2, H / 2]);

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
    >
      <SceneDefs uid={uid} L={L} />
      {/* key: remount SMIL timelines cleanly when the scene changes */}
      <g key={`${b}-${st}-${tod}-${motion ? 1 : 0}`}>
        <Beat uid={uid} L={L} st={st} tod={tod} motion={motion} monuments={list} />
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
