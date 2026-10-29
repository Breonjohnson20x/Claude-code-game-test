// Story actors for RegionScene: the Frost Warg alpha and its pack, the Iron
// Syndicate walker, the royal party, refugees, the checkpoint gate and the
// Aegis ward lanterns. Pure SVG, drawn at the origin and placed with a
// transform so a pack of six costs six small groups. Key light: upper right.
import { C } from '../palette.js';
import { mulberry32, r1 } from '../util.js';
import { mix } from './tone.js';
import { Banner, Flame, Glow, Smoke } from './parts.jsx';

const pts = (list) => list.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(y)}`).join('') + 'Z';

// ---------------------------------------------------------------- the wolf
/** Closed Catmull-Rom spline through points, as cubic Béziers (organic outlines). */
function blob(list, k = 1 / 6) {
  const n = list.length;
  const P = (i) => list[(i + n) % n];
  let d = `M${r1(list[0][0])},${r1(list[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = P(i - 1);
    const [x1, y1] = P(i);
    const [x2, y2] = P(i + 1);
    const [x3, y3] = P(i + 2);
    d += `C${r1(x1 + (x2 - x0) * k)},${r1(y1 + (y2 - y0) * k)} ${r1(x2 - (x3 - x1) * k)},${r1(y2 - (y3 - y1) * k)} ${r1(x2)},${r1(y2)}`;
  }
  return `${d}Z`;
}

// A timber wolf facing left, feet on y=0, ~52 units nose to tail tip, withers
// ~23 high. Stalking: head carried below the back, hackles raised, tail low and
// bushy, a deep chest over a tucked belly, jointed legs (elbow, wrist; stifle,
// hock). Coat in three values: dark saddle, grey-blue flanks, frost-white ruff.
const WOLF_TORSO = blob([
  [14, -19.6], [8, -19.9], [2, -20.6], [-3, -22.4], [-7, -22.6], [-10.6, -21], [-13.4, -19.7],
  [-16.4, -19.5], [-18.8, -18.3], [-22.4, -16.6], [-25.2, -15.5], [-26.1, -14.5], [-25.5, -13.4], [-22.6, -12.9], [-19.8, -12.3],
  [-16.8, -11.6], [-13.8, -11.2], [-11.6, -9.8], [-9.2, -9.4], [-5, -10.6], [1, -12], [6, -12.6], [9.6, -12.4], [13.4, -11.4],
  [16, -13.6], [16.4, -17.2],
]);
const WOLF_EARS = pts([[-13.1, -19.2], [-12.2, -24.4], [-15.4, -20]]) + pts([[-14.6, -19.6], [-15.2, -23.6], [-16.6, -19.8]]);
const WOLF_LEGS = pts([
  // near foreleg: elbow, straight forearm, wrist, paw
  [-12.2, -12], [-12.3, -7], [-12.6, -3.4], [-13.4, -1.5], [-15.4, -0.4], [-15.2, 0], [-11.2, 0], [-10.6, -1], [-10.3, -3.4], [-9.5, -8], [-8.4, -12],
]) + pts([
  // near hind leg: stifle forward, gaskin sloping back to the hock, long metatarsus
  [8.6, -14], [6.8, -9.6], [7.4, -7.4], [10.4, -4.6], [10.2, -1.4], [8.8, -0.4], [9, 0], [12.6, 0], [12.9, -1.4], [13.6, -4.6], [14.4, -6.2], [15.6, -10.2], [15.8, -14],
]);
const WOLF_FAR = pts([
  [-7.2, -11], [-6.8, -6.4], [-7.6, -3], [-8.8, -0.5], [-8.6, 0], [-5.2, 0], [-5, -1.2], [-4.7, -4], [-4.2, -8], [-4, -11],
]) + pts([[12, -13], [12.6, -8], [15.2, -5.2], [15.6, -1.4], [15, -0.4], [15.2, 0], [18.6, 0], [18.5, -1.2], [17.9, -5], [17.2, -8.8], [16.6, -13]]);
const WOLF_TAIL = blob([
  [14.4, -19.2], [18.2, -18.6], [21.8, -16.2], [24.2, -12.6], [25.4, -8.6], [25.4, -5.4], [23.8, -4.2], [22.6, -6.6], [21.2, -10], [18.6, -13.6], [15.6, -15.6],
]);
const WOLF_TAILTIP = blob([[25.4, -7.8], [25.4, -5.4], [23.8, -4.2], [22.8, -5.8], [24, -7.2]]);
// dark saddle along the back, and the raised hackles over the withers
const WOLF_SADDLE = blob([
  [-9.4, -20.6], [-3, -22], [3, -20.4], [9, -19.6], [14.6, -19.2], [16, -16.8], [12, -16.2], [6, -16.6], [0, -17.4], [-5, -18.6],
]);
const WOLF_HACKLES = pts([
  [-12, -20.2], [-11.2, -22.8], [-10, -21.4], [-8.8, -24.2], [-7.6, -22.4], [-6, -24.8], [-4.8, -22.6], [-3.2, -24.4], [-2.2, -22.2], [-0.6, -23.2],
  [0.8, -20.6], [-3, -20.2], [-8, -20.2],
]);
// frost-white cheek, throat and chest ruff with a ragged fringe
const WOLF_RUFF = pts([
  [-15.8, -17.4], [-18.6, -15.8], [-22.6, -13.8], [-19.8, -12.3], [-17.6, -11.4], [-16.4, -9.6], [-15.4, -11.1], [-14.2, -9.2], [-13.2, -10.8],
  [-11.8, -8.8], [-11.4, -11.2], [-9.6, -13.8], [-9.4, -16.6], [-11.4, -18.4], [-13.6, -18.6],
]);
// pale fronts of the near legs (the leg furnishings of a timber wolf)
const WOLF_SOCKS = pts([[-12.3, -7], [-12.6, -3.4], [-13.4, -1.5], [-15.4, -0.4], [-15.2, 0], [-13, 0], [-11.8, -3.2], [-11.4, -7]]) +
  pts([[10.4, -4.6], [10.2, -1.4], [8.8, -0.4], [9, 0], [11.2, 0], [11.6, -3.6]]);
// key light from the upper right: the back, the rump, the top of the tail, the back of the hind leg
const WOLF_RIM = 'M-13.4,-19.7C-11,-21 -9,-22.4 -7,-22.6C-4,-22.6 -1,-21.4 2,-20.6C6,-19.9 10,-19.8 14.2,-19.5C17.6,-18.8 20.6,-17.2 22.6,-15.2';
const WOLF_RIM_LEG = 'M16.4,-17.2C16.4,-15.6 16.2,-14.6 15.8,-14L15.6,-10.2L14.4,-6.2M12.9,-1.4L13.6,-4.6';
const WOLF_FACE = 'M-25.6,-13.7L-21.6,-13.2M-17.8,-18.2L-16.2,-18.9';

/** Colours for a timber wolf in this light: dark saddle, grey-blue coat, frost ruff, navy core. */
export function wolfTones(L, tod) {
  if (tod === 'day')
    return { coat: mix(C.frost500, C.navy700, 0.3), saddle: mix(C.iron700, C.navy800, 0.4), far: mix(C.frost500, C.navy900, 0.62), ruff: mix(C.frost100, C.frost200, 0.5), core: C.navy900, rim: mix(L.rim, C.gold200, 0.4) };
  if (tod === 'dusk')
    return { coat: mix(C.frost500, L.figure, 0.5), saddle: mix(L.figure, C.navy950, 0.3), far: mix(L.figure, C.navy900, 0.3), ruff: mix(C.frost200, C.ember200, 0.4), core: mix(L.figure, C.navy950, 0.5), rim: C.ember200 };
  return { coat: mix(C.frost500, C.navy800, 0.5), saddle: C.navy900, far: mix(C.navy800, C.navy950, 0.4), ruff: mix(C.frost300, C.navy700, 0.2), core: C.navy950, rim: C.frost100 };
}

/** One wolf. facing -1 turns it to the right. `eye` lights the eye (lattice glow). */
export function Wolf({ uid, x, y, s = 1, facing = 1, tones, rimOp = 0.8, eye = true, shadow, motion, breath = false }) {
  const t = tones;
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${r1(s * facing * 100) / 100} ${r1(s * 100) / 100})`}>
      {shadow && <ellipse cx="2" cy="0.4" rx="21" ry="1.7" fill={shadow} opacity="0.38" />}
      <path d={WOLF_FAR} fill={t.far} />
      <path d={WOLF_TAIL} fill={t.coat} />
      <path d={WOLF_TAILTIP} fill={t.saddle} />
      <path d={WOLF_LEGS} fill={t.coat} />
      <path d={WOLF_TORSO} fill={t.coat} />
      <path d={WOLF_EARS} fill={t.saddle} />
      {/* belly and chest-floor core shadow */}
      <path d="M-11.6,-9.8C-8,-9.2 -4,-10.6 1,-12C5,-12.8 9,-12.6 13.4,-11.4C14,-13.4 12,-14.6 8,-14.8C3,-15 -3,-14 -9,-12.6Z" fill={t.core} opacity="0.5" />
      <path d={WOLF_SOCKS} fill={t.ruff} opacity="0.55" />
      <path d={WOLF_SADDLE} fill={t.saddle} opacity="0.9" />
      <path d={WOLF_HACKLES} fill={t.saddle} />
      <path d={WOLF_RUFF} fill={t.ruff} opacity="0.95" />
      <path d={WOLF_FACE} stroke={t.core} strokeWidth="0.45" fill="none" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="-25.5" cy="-14.6" rx="0.9" ry="0.7" fill={t.core} />
      <path d={WOLF_RIM} stroke={t.rim} strokeWidth="0.7" fill="none" strokeLinecap="round" opacity={rimOp} />
      <path d={WOLF_RIM_LEG} stroke={t.rim} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity={rimOp * 0.6} />
      {eye && (
        <g>
          {uid && <circle cx="-18.8" cy="-16.4" r="2.6" fill={`url(#${uid}-lattice)`} opacity="0.7" />}
          <path d="M-19.8,-16.4Q-18.8,-17.2 -17.6,-16.8Q-18.6,-16 -19.8,-16.4Z" fill={C.lattice200} />
        </g>
      )}
      {breath && (
        <ellipse cx="-28.4" cy="-13.4" rx="2.4" ry="1.3" fill={C.frost100} opacity={motion ? 0 : 0.3}>
          {motion && (
            <>
              <animate attributeName="opacity" values="0;0.5;0" dur="3.4s" repeatCount="indefinite" />
              <animate attributeName="cx" values="-27;-34" dur="3.4s" repeatCount="indefinite" />
              <animate attributeName="rx" values="1.4;4.4" dur="3.4s" repeatCount="indefinite" />
            </>
          )}
        </ellipse>
      )}
    </g>
  );
}

/** The pack fanned across the snow: list of [x, y, s, facing]. Back to front. */
export function WolfPack({ uid, list, tones, shadow, rimOp }) {
  const sorted = [...list].sort((a, b) => a[1] - b[1]);
  return (
    <g>
      {sorted.map(([x, y, s, f], i) => (
        <Wolf key={i} uid={uid} x={x} y={y} s={s} facing={f} tones={tones} shadow={shadow} rimOp={rimOp} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- the walker
/**
 * Iron Syndicate walker, facing left. Feet at y (usually under water). An
 * armoured cockpit with a glowing viewport, a boiler hump with twin exhaust
 * stacks, a chin searchlight, a cannon pod and two digitigrade legs with brass
 * pistons. `beamTo` aims the searchlight; `ember` adds a second light on the
 * right flank (a fire behind it).
 */
export function Walker({ uid, x, y, s = 1, L, motion, damaged = false, beamTo = null, ember = 0, beam = true }) {
  const X = (v) => r1(x + v * s);
  const Y = (v) => r1(y + v * s);
  const P = (dx, dy) => `${X(dx)},${Y(dy)}`;
  const poly = (list) => `M${list.map(([a, b]) => P(a, b)).join('L')}Z`;
  const tilt = damaged ? 8 : 0;
  // legs: hip → knee (bent back) → ankle → splayed foot
  const leg = (hx, kx, ky, ax, ay, fx) => ({
    thigh: `M${P(hx, -40)}L${P(kx, ky)}`,
    shin: `M${P(kx, ky)}L${P(ax, ay)}`,
    foot: poly([[ax - 1.5, ay], [fx - 7, -0.4], [fx - 8, 1], [fx + 6, 1], [fx + 5, -1.2], [ax + 2.5, ay - 1]]),
    knee: [kx, ky],
    ankle: [ax, ay],
    piston: `M${P(hx - 3.5, -36)}L${P((kx + ax) / 2 - 2.6, (ky + ay) / 2)}`,
  });
  const far = damaged ? leg(8, 20, -26, 10, -9, 10) : leg(9, 19, -25, 12, -8, 9);
  const near = damaged ? leg(-6, -18, -20, -30, -8, -34) : leg(-5, 6, -24, -4, -8, -7);
  const hull = poly([[-31, -51], [-24, -62], [-8, -67], [10, -66], [21, -59], [25, -48], [19, -39], [-10, -37], [-26, -42]]);
  const belly = poly([[-26, -42], [-10, -37], [19, -39], [25, -48], [20, -44], [-8, -41.5]]);
  const brow = poly([[-24, -62], [-8, -67], [10, -66], [8, -63.6], [-8, -64.4], [-22, -59.6]]);
  const visor = poly([[-29.4, -52], [-21, -58.6], [-13, -57.4], [-14.6, -50.4], [-27.6, -48.4]]);
  const cheek = poly([[-31, -51], [-27.6, -48.4], [-14.6, -50.4], [-12, -45], [-26, -42]]);
  const boiler = `M${P(4, -64)}V${Y(-74)}Q${P(4, -78)} ${P(9, -78)}H${X(19)}Q${P(23, -78)} ${P(23, -73)}V${Y(-60)}Z`;
  const lamp = [-27.5, -43.5];
  const bx = x + lamp[0] * s;
  const by = y + lamp[1] * s;
  const aim = beamTo ? (Math.atan2(beamTo[1] - by, beamTo[0] - bx) * 180) / Math.PI : 160;
  const reach = beamTo ? Math.hypot(beamTo[0] - bx, beamTo[1] - by) : 120 * s;
  const iron = `url(#${uid}-iron)`;
  const lit = L.glow > 0.4;
  const rimOp = L.rimOp;
  return (
    <g>
      {/* searchlight: a cone from the chin lamp, a pool where it lands */}
      {!damaged && beam && (
        <g pointerEvents="none" transform={`rotate(${r1(aim)} ${r1(bx)} ${r1(by)})`}>
          <g>
            {motion && <animateTransform attributeName="transform" type="rotate" values={`-3 ${r1(bx)} ${r1(by)};3 ${r1(bx)} ${r1(by)};-3 ${r1(bx)} ${r1(by)}`} dur="11s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
            <path d={`M${r1(bx)},${r1(by - 1.6 * s)}L${r1(bx + reach * 1.04)},${r1(by - reach * 0.16)}L${r1(bx + reach * 1.04)},${r1(by + reach * 0.16)}L${r1(bx)},${r1(by + 1.6 * s)}Z`} fill={`url(#${uid}-beamf)`} opacity={0.28 + L.glow * 0.3} />
            <path d={`M${r1(bx)},${r1(by - 0.7 * s)}L${r1(bx + reach)},${r1(by - reach * 0.07)}L${r1(bx + reach)},${r1(by + reach * 0.07)}L${r1(bx)},${r1(by + 0.7 * s)}Z`} fill={`url(#${uid}-beamf)`} opacity={0.3 + L.glow * 0.3} />
            <ellipse cx={r1(bx + reach)} cy={r1(by)} rx={r1(reach * 0.09)} ry={r1(reach * 0.2)} fill={`url(#${uid}-lattice)`} opacity={0.3 + L.glow * 0.45} />
          </g>
        </g>
      )}
      <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
        {/* far leg, in shadow */}
        <g stroke={C.iron900} strokeLinecap="round" fill="none">
          <path d={far.thigh} strokeWidth={7.4 * s} />
          <path d={far.shin} strokeWidth={5.4 * s} />
          <path d={far.piston} stroke={C.brass700} strokeWidth={1.1 * s} />
        </g>
        <path d={far.foot} fill={C.iron900} />
        <circle cx={X(far.knee[0])} cy={Y(far.knee[1])} r={3.4 * s} fill={C.iron900} stroke={C.brass700} strokeWidth={0.6 * s} />
        {/* cannon pod under the far side */}
        {!damaged && (
          <g>
            <path d={poly([[6, -50], [-36, -47], [-36, -43.4], [6, -44.6]])} fill={C.iron700} />
            <rect x={X(-40)} y={Y(-48)} width={r1(5 * s)} height={r1(5.2 * s)} fill={C.iron900} />
            <path d={`M${P(6, -50)}L${P(-36, -47)}`} stroke={L.rim} strokeWidth={0.4 * s} opacity={rimOp * 0.5} />
            <path d={`M${P(-18, -48.6)}v${r1(4 * s)}M${P(-8, -49.4)}v${r1(4.4 * s)}`} stroke={C.brass500} strokeWidth={0.9 * s} />
          </g>
        )}
        {/* boiler hump and stacks */}
        <path d={boiler} fill={`url(#${uid}-ironh)`} />
        <path d={`M${P(8, -77.6)}V${Y(-61)}M${P(15, -78)}V${Y(-61)}`} stroke={C.brass500} strokeWidth={1.1 * s} />
        <path d={`M${P(23, -73)}V${Y(-60)}`} stroke={L.rim} strokeWidth={0.6 * s} opacity={rimOp * 0.7} />
        <rect x={X(6)} y={Y(-90)} width={r1(4 * s)} height={r1(14 * s)} fill={C.iron900} />
        <rect x={X(13)} y={Y(-86)} width={r1(3.4 * s)} height={r1(10 * s)} fill={C.iron900} />
        <rect x={X(5.4)} y={Y(-90.6)} width={r1(5.2 * s)} height={r1(1.6 * s)} fill={C.brass500} />
        <rect x={X(12.4)} y={Y(-86.4)} width={r1(4.6 * s)} height={r1(1.4 * s)} fill={C.brass500} />
        {/* hull: armoured cockpit with a heavy brow */}
        <path d={hull} fill={iron} />
        <path d={belly} fill={C.iron900} opacity="0.75" />
        <path d={brow} fill={mix(C.iron500, L.rim, 0.15)} opacity="0.9" />
        <path d={cheek} fill={C.iron700} />
        {/* plate seams and the flank armour */}
        <path d={`M${P(-8, -67)}L${P(-12, -45)}M${P(4, -66.4)}L${P(2, -38)}M${P(-26, -42)}L${P(-12, -45)}L${P(24, -47)}M${P(12, -63)}L${P(20, -45)}`} stroke={C.iron900} strokeWidth={0.6 * s} fill="none" opacity="0.85" />
        <path d={poly([[6, -62], [19, -57], [22, -48], [18, -46], [15.6, -55], [5, -59]])} fill={C.brass500} opacity="0.7" />
        <path d={poly([[-6, -60], [2, -60.4], [1.6, -50], [-7, -49.4]])} fill={C.iron500} opacity="0.35" />
        {[[-20, -60], [-6, -64.6], [8, -64], [18, -55], [21, -47], [-22, -44], [-4, -40.6], [12, -41.2], [-1, -56], [-1, -52]].map(([rx, ry], i) => (
          <circle key={i} cx={X(rx)} cy={Y(ry)} r={r1(0.6 * s)} fill={C.iron300} opacity="0.7" />
        ))}
        {/* rim light along the roof and back (key light upper right) */}
        <path d={`M${P(-24, -62)}L${P(-8, -67)}L${P(10, -66)}L${P(21, -59)}L${P(25, -48)}`} stroke={L.rim} strokeWidth={(lit ? 1.1 : 0.9) * s} fill="none" opacity={Math.min(1, rimOp * (lit ? 1.15 : 0.75))} />
        {ember > 0 && <path d={`M${P(21, -59)}L${P(25, -48)}L${P(19, -39)}M${P(23, -73)}V${Y(-61)}`} stroke={C.ember300} strokeWidth={1.2 * s} fill="none" opacity={0.7 * ember} />}
        {/* viewport: brass frame, ember glass with a lit pilot shadow */}
        {!damaged && <circle cx={X(-21)} cy={Y(-53)} r={r1(12 * s)} fill={`url(#${uid}-warm)`} opacity={0.35 + L.glow * 0.35} />}
        <path d={visor} fill={damaged ? C.iron900 : C.ember400} stroke={C.brass500} strokeWidth={0.9 * s} strokeLinejoin="round">
          {motion && !damaged && <animate attributeName="opacity" values="0.82;1;0.86;0.82" dur="3.1s" repeatCount="indefinite" />}
        </path>
        {!damaged && <path d={poly([[-27, -50.6], [-21.6, -56.4], [-16, -55.6], [-17.2, -51.2]])} fill={C.lattice300} opacity="0.55" />}
        {!damaged && <path d={`M${P(-21, -50)}q${r1(0.4 * s)},${r1(-3.2 * s)} ${r1(2.2 * s)},${r1(-3.6 * s)}q${r1(2 * s)},${r1(0.2 * s)} ${r1(1.8 * s)},${r1(3.4 * s)}Z`} fill={C.iron900} opacity="0.85" />}
        {/* chin searchlight and two running lamps */}
        <path d={poly([[-30.6, -46.4], [-25, -46.6], [-24.6, -40.6], [-30, -40.6]])} fill={C.brass700} />
        {!damaged && <circle cx={r1(bx)} cy={r1(by)} r={r1(2.1 * s)} fill={C.lattice100} />}
        {!damaged && <circle cx={r1(bx)} cy={r1(by)} r={r1(8 * s)} fill={`url(#${uid}-lattice)`} opacity={0.6 + L.glow * 0.3} />}
        {[[2, -45], [10, -44.6]].map(([px, py]) => (
          <g key={px}>
            <circle cx={X(px)} cy={Y(py)} r={r1(1.6 * s)} fill={C.brass700} />
            <circle cx={X(px)} cy={Y(py)} r={r1(1 * s)} fill={damaged ? C.iron900 : C.ember300} />
            {!damaged && lit && <circle cx={X(px)} cy={Y(py)} r={r1(4 * s)} fill={`url(#${uid}-warm)`} opacity="0.6" />}
          </g>
        ))}
        {/* near leg, lit edge toward the key light */}
        <g strokeLinecap="round" fill="none">
          <path d={near.thigh} stroke={C.iron700} strokeWidth={7.8 * s} />
          <path d={near.shin} stroke={C.iron700} strokeWidth={5.8 * s} />
          <path d={near.thigh} stroke={mix(C.iron500, L.rim, 0.2)} strokeWidth={1.2 * s} opacity={0.4 + rimOp * 0.4} transform={`translate(${r1(1.8 * s)} ${r1(-0.6 * s)})`} />
          <path d={near.piston} stroke={C.brass500} strokeWidth={1.2 * s} />
        </g>
        <path d={poly([[near.knee[0] - 1.6, near.knee[1] + 3], [near.ankle[0] + 2.2, near.ankle[1] - 3], [near.ankle[0] - 0.6, near.ankle[1] - 2], [near.knee[0] - 3.6, near.knee[1] + 3.4]])} fill={C.iron500} opacity="0.7" />
        <path d={near.foot} fill={C.iron700} />
        <circle cx={X(-5)} cy={Y(-40)} r={r1(4.2 * s)} fill={C.iron700} stroke={C.brass500} strokeWidth={0.8 * s} />
        <circle cx={X(near.knee[0])} cy={Y(near.knee[1])} r={r1(3.6 * s)} fill={C.iron700} stroke={C.brass500} strokeWidth={0.7 * s} />
        <circle cx={X(near.knee[0] + 0.8)} cy={Y(near.knee[1] - 0.8)} r={r1(1.2 * s)} fill={C.brass300} opacity="0.7" />
        <circle cx={X(near.ankle[0])} cy={Y(near.ankle[1])} r={r1(2.4 * s)} fill={C.iron900} stroke={C.brass700} strokeWidth={0.5 * s} />
        {/* exhaust */}
        <Smoke uid={uid} x={x + 8 * s} y={y - 91 * s} s={s * (damaged ? 1.6 : 0.85)} motion={motion} puffs={damaged ? 6 : 4} rise={damaged ? 70 : 48} op={damaged ? 1 : 0.75} />
        <Smoke uid={uid} x={x + 14.7 * s} y={y - 87 * s} s={s * 0.6} motion={motion} puffs={3} rise={38} dur={7} op={0.6} />
        {!damaged && <Glow uid={uid} x={x + 8 * s} y={y - 91 * s} r={4 * s} op={0.5} motion={motion} flicker />}
        {damaged && (
          <>
            <Flame x={x - 2 * s} y={y - 66 * s} h={8 * s} motion={motion} />
            <Glow uid={uid} x={x - 2 * s} y={y - 68 * s} r={18 * s} op={0.7} motion={motion} flicker />
          </>
        )}
      </g>
    </g>
  );
}

/** The walker's searchlight on its own, for drawing over terrain in front of the walker. */
export function WalkerBeam({ uid, x, y, s = 1, L, motion, to }) {
  const bx = x - 27.5 * s;
  const by = y - 43.5 * s;
  const aim = (Math.atan2(to[1] - by, to[0] - bx) * 180) / Math.PI;
  const reach = Math.hypot(to[0] - bx, to[1] - by);
  const R = r1(reach);
  return (
    <g pointerEvents="none" transform={`rotate(${r1(aim)} ${r1(bx)} ${r1(by)})`}>
      <g>
        {motion && <animateTransform attributeName="transform" type="rotate" values={`-2.5 ${r1(bx)} ${r1(by)};2.5 ${r1(bx)} ${r1(by)};-2.5 ${r1(bx)} ${r1(by)}`} dur="11s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
        <path d={`M${r1(bx)},${r1(by - 1.6 * s)}L${r1(bx + reach * 1.06)},${r1(by - reach * 0.15)}L${r1(bx + reach * 1.06)},${r1(by + reach * 0.15)}L${r1(bx)},${r1(by + 1.6 * s)}Z`} fill={`url(#${uid}-beamf)`} opacity={0.3 + L.glow * 0.3} />
        <path d={`M${r1(bx)},${r1(by - 0.7 * s)}L${r1(bx + reach)},${r1(by - reach * 0.06)}L${r1(bx + reach)},${r1(by + reach * 0.06)}L${r1(bx)},${r1(by + 0.7 * s)}Z`} fill={`url(#${uid}-beamf)`} opacity={0.32 + L.glow * 0.3} />
        <ellipse cx={r1(bx + R)} cy={r1(by)} rx={r1(reach * 0.07)} ry={r1(reach * 0.17)} fill={`url(#${uid}-lattice)`} opacity={0.35 + L.glow * 0.45} />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------- people
/** A royal standard-bearer, the Sovereign and two guards, facing right. Base at y. */
export function RoyalParty({ uid, x, y, s = 1, L, motion, lit = 0, torn = false }) {
  const fig = L.figure;
  const S = (v) => r1(v * s);
  const person = (px, h, kind) => {
    const hr = h * 0.11;
    const top = y - h;
    let d = `M${r1(px - hr)},${r1(top + hr)}a${r1(hr)},${r1(hr)} 0 1 0 ${r1(hr * 2)},0a${r1(hr)},${r1(hr)} 0 1 0 ${r1(-hr * 2)},0Z`;
    // cloak flaring to the ground
    d += `M${r1(px - h * 0.16)},${r1(top + h * 0.22)}Q${r1(px)},${r1(top + h * 0.17)} ${r1(px + h * 0.16)},${r1(top + h * 0.22)}L${r1(px + h * 0.25)},${r1(y)}L${r1(px - h * 0.27)},${r1(y)}Z`;
    if (kind === 'guard') d += `M${r1(px + h * 0.24)},${r1(y)}v${r1(-h * 1.3)}h${r1(h * 0.05)}v${r1(h * 1.3)}Z M${r1(px + h * 0.265)},${r1(y - h * 1.42)}l${r1(h * 0.06)},${r1(h * 0.14)}h${r1(-h * 0.12)}Z`;
    return d;
  };
  const H = 19 * s;
  const d = person(x, H * 1.02, 'sov') + person(x + S(9), H, 'guard') + person(x - S(10), H * 0.98, 'guard') + person(x - S(18), H * 0.96, 'bearer');
  const crown = `M${r1(x - 1.4 * s)},${r1(y - H * 1.02 - 0.2 * s)}l${S(0.5)},${S(-1.6)}l${S(0.45)},${S(1)}l${S(0.45)},${S(-1.4)}l${S(0.45)},${S(1.4)}l${S(0.45)},${S(-1)}l${S(0.5)},${S(1.6)}Z`;
  const rim = lit > 0 ? C.lattice200 : L.rim;
  return (
    <g>
      <ellipse cx={x - S(4)} cy={y + S(0.4)} rx={S(18)} ry={S(1.6)} fill={L.shade} opacity="0.4" />
      <Banner uid={uid} x={x - S(15)} y={y} h={S(36)} len={S(15)} hgt={S(6.5)} motion={motion} L={L} torn={torn} />
      <path d={d} fill={fig} />
      <path d={d} fill="none" stroke={rim} strokeWidth={0.32 * s} opacity={lit > 0 ? 0.25 + lit * 0.25 : L.rimOp * 0.6} transform={`translate(${S(lit > 0 ? 0.35 : 0.4)} 0)`} />
      <path d={crown} fill={C.gold400} />
      {/* royal cloak: navy with a gold hem */}
      <path d={`M${r1(x - H * 0.14)},${r1(y - H * 0.78)}L${r1(x + H * 0.23)},${r1(y)}H${r1(x - H * 0.25)}Z`} fill={C.navy700} opacity="0.9" />
      <path d={`M${r1(x - H * 0.25)},${r1(y - 0.6 * s)}H${r1(x + H * 0.23)}`} stroke={C.gold500} strokeWidth={0.7 * s} />
    </g>
  );
}

// A cloaked figure, facing +x, feet on 0, height 1: hood over a head, a narrow
// neck and shoulders (so a head reads at any size), cloak flaring to the hem,
// a notch between the feet. [dx, dy] with dy up.
const CLOAK = [
  [-0.09, 0.72], [-0.115, 0.86], [-0.065, 0.97], [0.02, 1.0], [0.09, 0.955], [0.125, 0.87], [0.105, 0.8], [0.075, 0.765],
  [0.15, 0.71], [0.175, 0.46], [0.215, 0.06], [0.12, 0.06], [0.1, 0], [0.03, 0], [0.025, 0.07], [-0.02, 0.07], [-0.04, 0],
  [-0.11, 0], [-0.13, 0.06], [-0.2, 0.06], [-0.165, 0.5], [-0.135, 0.68],
];

/**
 * Refugees as readable silhouettes, one path. list: [x, y, h, kind, facing]
 * with kind in 'hood' | 'bundle' | 'child' | 'mother' | 'elder'.
 */
export function refugeePath(list) {
  let d = '';
  for (const [x, y, h, kind, f = 1] of list) {
    const stoop = kind === 'elder' ? 0.1 : kind === 'bundle' ? 0.05 : 0;
    const P = (dx, dy) => `${r1(x + (dx + stoop * Math.max(0, dy - 0.45)) * h * f)},${r1(y - dy * h)}`;
    d += `M${CLOAK.map(([a, b]) => P(a, b)).join('L')}Z`;
    if (kind === 'bundle') d += `M${P(-0.13, 0.78)}Q${P(-0.36, 0.8)} ${P(-0.36, 0.6)}Q${P(-0.35, 0.4)} ${P(-0.15, 0.42)}Z`;
    if (kind === 'elder') d += `M${P(0.22, 0)}L${P(0.25, 0.92)}L${P(0.28, 0.92)}L${P(0.25, 0)}Z`;
    if (kind === 'mother') d += `M${P(0.14, 0.68)}L${P(0.4, 0.86)}L${P(0.43, 0.82)}L${P(0.18, 0.6)}Z`; // arm raised, arguing
    if (kind === 'child') d += `M${P(-0.13, 0.64)}L${P(-0.3, 0.85)}L${P(-0.26, 0.88)}L${P(-0.1, 0.7)}Z`; // reaching up for a hand
  }
  return d;
}

/** A pack mule with panniers, facing f. Feet at y; s=1 is ~23 units nose to tail. */
export function mulePath(x, y, s = 1, f = 1) {
  const P = (dx, dy) => `${r1(x + dx * s * f)},${r1(y + dy * s)}`;
  const body = [
    [-6, -9], [5, -9.4], [7, -10.6], [9, -14], [9.2, -16.8], [9.9, -14.8], [10.6, -16.6], [10.9, -14.3], [12.6, -12.4], [14, -10.4], [13.6, -9.3],
    [11.6, -9.9], [9.2, -9.5], [7.8, -6.8], [7.5, -5.6], [7.7, 0], [6.8, 0], [6.6, -4.8], [5.9, -4.8], [5.9, 0], [5, 0], [4.8, -5.4], [-4, -5.6],
    [-4.2, 0], [-5, 0], [-5.3, -4.6], [-6, -4.5], [-6.4, 0], [-7.2, 0], [-7.3, -5.8], [-7.5, -8.2], [-8.7, -7.8], [-9.2, -4], [-8.5, -4],
    [-7.9, -7.1],
  ];
  const packs = [[-4.4, -9.2], [3.4, -9.4], [3.6, -5.8], [-4.6, -5.6]];
  const roll = `M${P(-3.6, -9.4)}Q${P(-0.4, -12.4)} ${P(2.8, -9.6)}Z`;
  return `M${body.map(([a, b]) => P(a, b)).join('L')}ZM${packs.map(([a, b]) => P(a, b)).join('L')}Z${roll}`;
}

// ---------------------------------------------------------------- checkpoint
/**
 * The Marches checkpoint: two squat stone piers, a timber gate frame with a
 * shingle roof, a barrier pole, and a guard hut with a lantern-lit desk where
 * a tired sergeant sits. Centre x, base y.
 */
export function CheckpointGate({ uid, x, y, s = 1, L, motion, state }) {
  const S = (v) => r1(v * s);
  const X = (v) => r1(x + v * s);
  const Y = (v) => r1(y + v * s);
  const lit = L.glow > 0.4;
  const after = state === 'AFTERMATH';
  const fort = state === 'FORTIFIED';
  const pier = (cx) => (
    <g key={cx}>
      <path d={`M${X(cx - 5)},${Y(0)}L${X(cx - 4.4)},${Y(-20)}H${X(cx + 4.4)}L${X(cx + 5)},${Y(0)}Z`} fill={`url(#${uid}-stone)`} />
      <rect x={X(cx - 5.6)} y={Y(-22)} width={S(11.2)} height={S(2.4)} fill={L.stone} />
      <path d={`M${X(cx - 4.6)},${Y(-6)}H${X(cx + 4.6)}M${X(cx - 4.5)},${Y(-12)}H${X(cx + 4.5)}M${X(cx - 4.4)},${Y(-17)}H${X(cx + 4.4)}M${X(cx - 1)},${Y(0)}V${Y(-6)}M${X(cx + 2)},${Y(-6)}V${Y(-12)}M${X(cx - 2)},${Y(-12)}V${Y(-17)}`} stroke={L.stoneDark} strokeWidth={0.3 * s} opacity="0.6" />
      <rect x={X(cx + 3.2)} y={Y(-20)} width={S(1.2)} height={S(20)} fill={L.rim} opacity={L.rimOp * 0.45} />
    </g>
  );
  // gate frame between the piers
  const beam = `M${X(-14)},${Y(-27)}H${X(14)}V${Y(-24)}H${X(-14)}Z`;
  const roof = `M${X(-17)},${Y(-27)}L${X(0)},${Y(-35)}L${X(17)},${Y(-27)}Z`;
  // guard hut to the right, with an awning over a desk
  const hx = 26;
  const hut = `M${X(hx)},${Y(0)}V${Y(-14)}H${X(hx + 16)}V${Y(0)}Z`;
  const hutRoof = `M${X(hx - 2)},${Y(-14)}L${X(hx + 8)},${Y(-20)}L${X(hx + 18)},${Y(-14)}Z`;
  const awning = `M${X(hx - 9)},${Y(-11)}L${X(hx)},${Y(-13.2)}V${Y(-11.6)}L${X(hx - 9)},${Y(-9.6)}Z`;
  const desk = `M${X(hx - 9)},${Y(-5)}H${X(hx - 1)}V${Y(-4)}H${X(hx - 9)}Z M${X(hx - 8.4)},${Y(-4)}V${Y(0)}H${X(hx - 7.6)}V${Y(-4)}Z M${X(hx - 2.4)},${Y(-4)}V${Y(0)}H${X(hx - 1.6)}V${Y(-4)}Z`;
  const boards = Array.from({ length: 6 }, (_, i) => `M${X(hx + 1.6 + i * 2.6)},${Y(0)}V${Y(-14)}`).join('');
  // the tired sergeant, seated at the desk, facing the queue (left)
  const sgt = `M${X(hx - 4.6)},${Y(-11.6)}a${S(1.2)},${S(1.2)} 0 1 0 ${S(2.4)},0a${S(1.2)},${S(1.2)} 0 1 0 ${S(-2.4)},0Z M${X(hx - 5.6)},${Y(-10)}Q${X(hx - 3.4)},${Y(-10.8)} ${X(hx - 1.4)},${Y(-10)}L${X(hx - 1)},${Y(-5)}H${X(hx - 6)}Z M${X(hx - 4.8)},${Y(-12.6)}h${S(3)}v${S(0.5)}h${S(-3)}Z`;
  return (
    <g>
      <ellipse cx={X(6)} cy={Y(0.6)} rx={S(34)} ry={S(2.2)} fill={L.shade} opacity="0.35" />
      {/* the open gate leaves, swung back */}
      <path d={`M${X(-9)},${Y(0)}L${X(-13.5)},${Y(-2)}V${Y(-17)}L${X(-9)},${Y(-19)}Z M${X(9)},${Y(0)}L${X(13.5)},${Y(-2)}V${Y(-17)}L${X(9)},${Y(-19)}Z`} fill={L.wood} />
      <path d={`M${X(-12)},${Y(-4)}V${Y(-16)}M${X(12)},${Y(-4)}V${Y(-16)}`} stroke={L.woodDark} strokeWidth={0.4 * s} />
      {/* warm light through the gateway at dusk and night */}
      {lit && <rect x={X(-9)} y={Y(-19)} width={S(18)} height={S(19)} fill={C.ember500} opacity={0.25 * L.glow} />}
      {pier(-14)}
      {pier(14)}
      <path d={beam} fill={L.wood} />
      <path d={`M${X(-14)},${Y(-24)}H${X(14)}`} stroke={L.woodDark} strokeWidth={0.5 * s} />
      <path d={roof} fill={after ? L.woodDark : mix(L.wood, C.crimson600, 0.2)} />
      <path d={`M${X(0)},${Y(-35)}L${X(17)},${Y(-27)}`} stroke={L.rim} strokeWidth={0.5 * s} opacity={L.rimOp * 0.7} />
      {/* the crest board over the gate */}
      <path d={`M${X(-3)},${Y(-27.4)}h${S(6)}v${S(-3.6)}l${S(-3)},${S(-1.4)}l${S(-3)},${S(1.4)}Z`} fill={C.navy700} />
      <path d={`M${X(0)},${Y(-30.6)}l${S(1)},${S(1)}l${S(-1)},${S(1)}l${S(-1)},${S(-1)}Z`} fill={C.gold400} />
      {/* barrier pole */}
      {after ? (
        <path d={`M${X(-8)},${Y(-0.6)}L${X(4)},${Y(-2.4)}`} stroke={C.gold700} strokeWidth={1 * s} />
      ) : (
        <g>
          <rect x={X(-10)} y={Y(-6)} width={S(1.4)} height={S(6)} fill={L.woodDark} />
          <path d={`M${X(-9.3)},${Y(-5.4)}L${X(9)},${Y(-6.2)}`} stroke={C.gold500} strokeWidth={1 * s} strokeDasharray={`${S(2)} ${S(2)}`} />
          <path d={`M${X(-9.3)},${Y(-5.4)}L${X(9)},${Y(-6.2)}`} stroke={C.navy700} strokeWidth={1 * s} strokeDasharray={`${S(2)} ${S(2)}`} strokeDashoffset={S(2)} />
        </g>
      )}
      {/* guard hut + lantern-lit desk */}
      <path d={hut} fill={L.wood} />
      <path d={boards} stroke={L.woodDark} strokeWidth={0.35 * s} opacity="0.7" />
      <rect x={X(hx + 14.4)} y={Y(-14)} width={S(1.6)} height={S(14)} fill={L.rim} opacity={L.rimOp * 0.4} />
      <path d={`M${X(hx + 10)},${Y(-10)}h${S(3)}v${S(3)}h${S(-3)}Z`} fill={lit ? L.window : L.shade} opacity={lit ? 1 : 0.8} />
      <path d={hutRoof} fill={after ? L.woodDark : mix(L.wood, C.crimson600, 0.2)} />
      <path d={`M${X(hx + 8)},${Y(-20)}L${X(hx + 18)},${Y(-14)}`} stroke={L.rim} strokeWidth={0.45 * s} opacity={L.rimOp * 0.7} />
      <path d={awning} fill={after ? L.canvasDark : L.canvas} />
      <path d={`M${X(hx - 8.6)},${Y(-9.8)}V${Y(0)}`} stroke={L.woodDark} strokeWidth={0.5 * s} />
      <circle cx={X(hx - 5)} cy={Y(-6.6)} r={S(9)} fill={`url(#${uid}-warm)`} opacity={0.35 + 0.5 * L.glow}>
        {motion && <animate attributeName="opacity" values={`${0.35 + 0.5 * L.glow};${0.45 + 0.5 * L.glow};${0.32 + 0.5 * L.glow};${0.35 + 0.5 * L.glow}`} dur="2.6s" repeatCount="indefinite" />}
      </circle>
      <path d={sgt} fill={L.figure} />
      <path d={`M${X(hx - 1.6)},${Y(-11.2)}L${X(hx - 1)},${Y(-5)}`} stroke={C.ember300} strokeWidth={0.4 * s} opacity={0.4 + 0.4 * L.glow} />
      <path d={desk} fill={L.woodDark} />
      <path d={`M${X(hx - 7)},${Y(-5.5)}h${S(2.6)}`} stroke={C.parch100} strokeWidth={0.5 * s} opacity="0.85" />
      <path d={`M${X(hx - 8.8)},${Y(-6.6)}h${S(1.4)}v${S(1.6)}h${S(-1.4)}Z`} fill={C.lattice300} />
      <path d={`M${X(hx - 8.8)},${Y(-6.6)}h${S(1.4)}M${X(hx - 8.1)},${Y(-6.6)}v${S(-0.8)}`} stroke={C.brass700} strokeWidth={0.4 * s} />
      {/* a pennant on the hut, a lantern on each pier */}
      {!after && <Banner uid={uid} x={X(hx + 8)} y={Y(-20)} h={S(9)} len={S(9)} hgt={S(3.6)} motion={motion} L={L} />}
      {[-14, 14].map((cx) => (
        <g key={cx}>
          <circle cx={X(cx)} cy={Y(-24)} r={S(7)} fill={`url(#${uid}-warm)`} opacity={0.3 + 0.55 * L.glow} />
          <path d={`M${X(cx - 0.9)},${Y(-25.2)}h${S(1.8)}v${S(2.4)}h${S(-1.8)}Z`} fill={C.lattice300} />
        </g>
      ))}
      {fort && <path d={`M${X(-14)},${Y(-22)}V${Y(-29)}M${X(14)},${Y(-22)}V${Y(-29)}`} stroke={L.woodDark} strokeWidth={0.6 * s} />}
    </g>
  );
}

// ---------------------------------------------------------------- the Aegis ward
/**
 * The ward line as a row of discrete ward-lanterns on brass posts with soft
 * amber halos, joined by a faint gold thread. `points` are lantern heights;
 * extra lanterns are spaced along the line every ~`gap` units.
 */
export function WardLanterns({ uid, points, L, motion, gap = 34, post = 9, op = 1 }) {
  const list = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap));
    for (let k = 0; k < n; k += 1) list.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  list.push(points[points.length - 1]);
  const rnd = mulberry32(points.length * 7 + Math.round(points[0][0]));
  const g = 0.35 + L.glow * 0.4;
  const thread = list.map(([x, yy], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(yy + 0.6)}`).join('');
  let posts = '';
  for (const [x, yy] of list) posts += `M${r1(x - 0.35)},${r1(yy + 1.6)}v${post}h0.7v${-post}Z`;
  return (
    <g pointerEvents="none" opacity={op}>
      <path d={thread} stroke={C.gold400} strokeWidth="0.35" fill="none" opacity={0.18 + L.glow * 0.12} />
      <path d={posts} fill={C.brass700} />
      {list.map(([x, yy], i) => {
        const o = g * (0.85 + rnd() * 0.3);
        return (
          <g key={i}>
            <circle cx={r1(x)} cy={r1(yy)} r="4.6" fill={`url(#${uid}-warm)`} opacity={o * 0.75}>
              {motion && <animate attributeName="opacity" values={`${o * 0.75};${o * 0.95};${o * 0.65};${o * 0.75}`} dur={`${r1(2.4 + rnd() * 1.6)}s`} repeatCount="indefinite" />}
            </circle>
            <path d={`M${r1(x - 0.8)},${r1(yy - 1.2)}h1.6v2.6h-1.6Z`} fill={C.lattice400} />
            <path d={`M${r1(x - 1)},${r1(yy - 1.4)}h2M${r1(x - 1)},${r1(yy + 1.6)}h2`} stroke={C.brass500} strokeWidth="0.45" />
          </g>
        );
      })}
    </g>
  );
}
