// Painted human faces for the portraits. Key light from the upper right, so the
// form shadow, core shadow and reflected light sit on the left and the highlights
// (forehead, cheekbone, nose bridge, chin) on the right. Skin gets subsurface
// warmth on the cheeks, nose and ears. Eyes have whites, irises, pupils, a lash
// line and a catchlight.
import { r1 } from '../util.js';
import { LG } from './kit.jsx';

/** Geometry shared by the skin painter and the features, so shadows land under the features. */
function faceGeo(f, o, x) {
  const { cx, cy, rx, ry } = f;
  const k = rx / 12.5;
  const eyeY = cy + (o.eyeDy ?? 0) * k;
  return {
    cx,
    cy,
    rx,
    ry,
    k,
    eyeY,
    ex: (o.eyeSep ?? 5.2) * k,
    ew: (o.eyeW ?? 2.9) * k,
    eh: (o.eyeH ?? 1.75) * k * Math.min(1.3, x.open),
    browY: eyeY - (o.browGap ?? 3.6) * k,
    noseY: cy + ry * (o.noseAt ?? 0.36),
    mouthY: cy + ry * (o.mouthAt ?? 0.62),
    mw: (o.mouthW ?? 3.4) * k,
  };
}

/**
 * The painted head: base skin, then soft planes (form shadow, core shadow, reflected
 * light, eye sockets, warmth, highlights), then crisp nose accents, then the features.
 * skin: { deep, shade, base, light, hi, blood, bounce }.
 */
export function Face({ uid, f, head, skin, x, o = {} }) {
  const g = faceGeo(f, o, x);
  const { cx, cy, rx, ry, k, eyeY, ex, noseY, mouthY } = g;
  const hard = !!o.hard;
  const s = skin;
  const hc = `${uid}-hc`;
  return (
    <>
      <defs>
        <clipPath id={hc}>
          <path d={head} />
        </clipPath>
        <LG
          id={`${uid}-skn`}
          x2={1}
          y2={0.25}
          stops={[
            [0, s.shade],
            [0.24, s.shade],
            [0.44, s.base],
            [0.72, s.light],
            [1, s.light],
          ]}
        />
      </defs>
      <path d={head} fill={`url(#${uid}-skn)`} />
      <g clipPath={`url(#${hc})`}>
        <g filter={`url(#${uid}-soft)`}>
          {/* form shadow, core shadow, reflected light on the far (left) edge */}
          <ellipse cx={cx - rx * (hard ? 0.62 : 0.92)} cy={cy + ry * 0.1} rx={rx * (hard ? 0.72 : 0.74)} ry={ry * 1.35} fill={s.shade} opacity={hard ? 1 : 0.95} />
          <ellipse cx={cx - rx * (hard ? 0.3 : 0.5)} cy={cy + ry * 0.16} rx={rx * 0.17} ry={ry * 0.9} fill={s.deep} opacity={hard ? 0.75 : 0.42} />
          <ellipse cx={cx - rx * 1.02} cy={cy + ry * 0.32} rx={rx * 0.18} ry={ry * 0.5} fill={s.bounce} opacity={hard ? 0.35 : 0.55} />
          {/* the jaw turning under, deepest on the shadow side */}
          <ellipse cx={cx - rx * 0.38} cy={cy + ry * 0.78} rx={rx * 0.62} ry={ry * 0.2} fill={s.deep} opacity="0.32" />
          <ellipse cx={cx + rx * 0.62} cy={cy + ry * 0.66} rx={rx * 0.26} ry={ry * 0.16} fill={s.shade} opacity="0.35" />
          {/* temples */}
          <ellipse cx={cx - rx * 0.86} cy={cy - ry * 0.28} rx={rx * 0.22} ry={ry * 0.3} fill={s.deep} opacity="0.35" />
          {/* hairline / brow cast shadow and the turn under the chin */}
          <ellipse cx={cx + rx * 0.05} cy={cy - ry * 1.02} rx={rx * 1.25} ry={ry * (o.hairShadow ?? 0.32)} fill={s.deep} opacity="0.6" />
          <ellipse cx={cx - rx * 0.1} cy={cy + ry * 1.04} rx={rx * 0.75} ry={ry * 0.16} fill={s.deep} opacity="0.5" />
          {/* eye sockets */}
          <ellipse cx={cx - ex} cy={eyeY - 0.5 * k} rx={3.5 * k} ry={2.5 * k} fill={s.shade} opacity={o.hideLeft ? 0.9 : 0.75} />
          <ellipse cx={cx + ex} cy={eyeY - 0.5 * k} rx={3.3 * k} ry={2.3 * k} fill={s.shade} opacity="0.5" />
          {/* subsurface warmth: cheeks, nose, lips */}
          <ellipse cx={cx - ex - 0.4 * k} cy={eyeY + 4.8 * k} rx={2.9 * k} ry={2.1 * k} fill={s.blood} opacity={0.3 + x.blush * 0.6} />
          <ellipse cx={cx + ex + 0.4 * k} cy={eyeY + 4.8 * k} rx={2.9 * k} ry={2.1 * k} fill={s.blood} opacity={0.22 + x.blush * 0.6} />
          <ellipse cx={cx + 0.2 * k} cy={noseY + 0.2 * k} rx={1.7 * k} ry={1.3 * k} fill={s.blood} opacity="0.28" />
          {/* nose: shadow on the left flank and under the tip */}
          <path
            d={`M${r1(cx - 0.1 * k)},${r1(eyeY + 0.8 * k)}L${r1(cx - 2.5 * k)},${r1(noseY + 0.9 * k)}L${r1(cx - 0.2 * k)},${r1(noseY + 1.2 * k)}Z`}
            fill={s.shade}
            opacity="0.85"
          />
          <ellipse cx={cx - 0.5 * k} cy={noseY + 1.7 * k} rx={2.3 * k} ry={0.8 * k} fill={s.deep} opacity="0.5" />
          {/* lips sit in a little shadow, the chin catches light */}
          <ellipse cx={cx - 0.3 * k} cy={mouthY + 2.1 * k} rx={2.5 * k} ry={0.95 * k} fill={s.shade} opacity="0.6" />
          {/* cheek planes: the hollow under each cheekbone, the temple turning away */}
          <ellipse cx={cx - rx * 0.6} cy={eyeY + 7.2 * k} rx={2.6 * k} ry={3.4 * k} fill={s.shade} opacity="0.45" />
          <ellipse cx={cx + rx * 0.66} cy={eyeY + 7.6 * k} rx={1.9 * k} ry={3 * k} fill={s.shade} opacity="0.28" />
          <ellipse cx={cx + rx * 0.86} cy={cy - ry * 0.3} rx={1.4 * k} ry={3 * k} fill={s.base} opacity="0.5" />
          {/* highlights: forehead, cheekbone, chin */}
          <ellipse cx={cx + rx * 0.34} cy={cy - ry * 0.5} rx={3.8 * k} ry={2.5 * k} fill={s.hi} opacity={o.foreheadHi ?? 0.6} />
          <ellipse cx={cx + rx * 0.5} cy={eyeY + 3.1 * k} rx={2.8 * k} ry={1.6 * k} fill={s.hi} opacity="0.62" />
          <ellipse cx={cx + 0.7 * k} cy={eyeY + 2.6 * k} rx={0.7 * k} ry={2.6 * k} fill={s.hi} opacity="0.4" />
          <ellipse cx={cx + 0.9 * k} cy={cy + ry * 0.85} rx={1.7 * k} ry={0.9 * k} fill={s.hi} opacity="0.4" />
        </g>
        {/* crisp nose accents */}
        {o.nose !== false && (
          <g fill="none" strokeLinecap="round">
            <path d={`M${r1(cx + 0.45 * k)},${r1(eyeY + 1.5 * k)}Q${r1(cx + 0.9 * k)},${r1(noseY - 1.6 * k)} ${r1(cx + 0.7 * k)},${r1(noseY - 0.5 * k)}`} stroke={s.hi} strokeWidth={0.6 * k} opacity="0.6" />
            <path d={`M${r1(cx - 2.2 * k)},${r1(noseY + 0.4 * k)}Q${r1(cx - 2.4 * k)},${r1(noseY + 1.4 * k)} ${r1(cx - 1.1 * k)},${r1(noseY + 1.35 * k)}`} stroke={s.deep} strokeWidth={0.55 * k} opacity="0.7" />
            <path d={`M${r1(cx + 2.1 * k)},${r1(noseY + 0.4 * k)}Q${r1(cx + 2.3 * k)},${r1(noseY + 1.4 * k)} ${r1(cx + 1.1 * k)},${r1(noseY + 1.35 * k)}`} stroke={s.shade} strokeWidth={0.45 * k} opacity="0.55" />
            <ellipse cx={cx - 0.75 * k} cy={noseY + 1.25 * k} rx={0.5 * k} ry={0.28 * k} fill={s.deep} opacity="0.8" />
            <ellipse cx={cx + 0.85 * k} cy={noseY + 1.25 * k} rx={0.45 * k} ry={0.25 * k} fill={s.deep} opacity="0.6" />
            <circle cx={cx + 0.6 * k} cy={noseY - 0.1 * k} r={0.42 * k} fill={s.hi} opacity="0.85" />
          </g>
        )}
        {o.lines && <path d={o.lines(g)} fill="none" stroke={s.deep} strokeWidth={0.38 * k} strokeLinecap="round" opacity="0.5" />}
        {o.freckles && <Freckles g={g} color={o.freckles} />}
      </g>
      <Features g={g} x={x} o={o} skin={s} uid={uid} />
    </>
  );
}

function Freckles({ g, color }) {
  const { cx, eyeY, k } = g;
  const pts = [
    [-6.6, 3.6], [-5.2, 4.6], [-4, 3.8], [-6, 5.6], [-3.2, 5.2], [-1.8, 3.4], [1.8, 3.2], [3.4, 4.8], [4.4, 3.6], [5.8, 4.6], [6.8, 3.8], [5, 5.8], [0.4, 2.6],
  ];
  return (
    <g fill={color} opacity="0.55">
      {pts.map(([dx, dy], i) => (
        <circle key={i} cx={r1(cx + dx * k)} cy={r1(eyeY + dy * k)} r={r1((0.22 + (i % 3) * 0.06) * k)} />
      ))}
    </g>
  );
}

/** Eyes, brows and lips. */
function Features({ g, x, o, skin, uid }) {
  const { cx, k, eyeY, ex, ew, eh, browY, mouthY, mw } = g;
  const lash = o.ink || '#140d09';
  const white = o.white || '#e6dccb';
  const iris = o.iris || '#4a3420';
  const browC = o.brow || '#2a1a10';
  const lipC = o.lip || '#8a4a3a';
  const lipD = o.lipDark || skin.deep;
  const eyes = [-1, 1].map((side) => {
    const X = cx + side * ex;
    if (side === -1 && o.hideLeft) {
      // lost in shadow: only the wet glint of the eye survives
      return (
        <g key={side}>
          <path d={`M${r1(X - ew)},${r1(eyeY)}Q${r1(X)},${r1(eyeY - eh * 1.1)} ${r1(X + ew)},${r1(eyeY)}`} stroke="#000" strokeOpacity="0.5" strokeWidth={0.7 * k} fill="none" />
          <circle cx={X + 0.5 * k} cy={eyeY - 0.2 * k} r={0.42 * k} fill={o.glint || '#e3c463'} opacity="0.75" />
        </g>
      );
    }
    const up = eh * 1.2;
    const dn = eh * 0.85;
    // outer corner sits a touch higher than the inner one
    const ix = X - side * ew;
    const ox = X + side * ew;
    const oy = eyeY - 0.25 * k;
    const almond = `M${r1(ix)},${r1(eyeY)}Q${r1(X)},${r1(eyeY - up)} ${r1(ox)},${r1(oy)}Q${r1(X)},${r1(eyeY + dn)} ${r1(ix)},${r1(eyeY)}Z`;
    const upper = `M${r1(ix - side * 0.2 * k)},${r1(eyeY + 0.1 * k)}Q${r1(X)},${r1(eyeY - up - 0.15 * k)} ${r1(ox + side * 0.55 * k)},${r1(oy - 0.1 * k)}`;
    const ir = Math.min(eh * 0.95, ew * 0.56);
    const icx = X + (o.look ?? 0.15) * k;
    const icy = eyeY - 0.05 * k;
    const clip = `${uid}-eye${side}`;
    return (
      <g key={side}>
        <clipPath id={clip}>
          <path d={almond} />
        </clipPath>
        <path d={almond} fill={white} />
        <g clipPath={`url(#${clip})`}>
          <circle cx={icx} cy={icy} r={ir} fill={iris} />
          <circle cx={icx} cy={icy} r={ir} fill="none" stroke={lash} strokeWidth={0.32 * k} opacity="0.75" />
          <circle cx={icx + 0.25 * ir} cy={icy + 0.3 * ir} r={ir * 0.55} fill={o.irisLight || '#ffffff'} opacity="0.16" />
          <circle cx={icx} cy={icy} r={ir * 0.46} fill={lash} />
          {/* lid shadow on the eyeball, darker on the left */}
          <ellipse cx={X - 0.6 * k} cy={eyeY - up * 0.75} rx={ew * 1.2} ry={eh * 0.75} fill={skin.deep} opacity={side === -1 ? 0.55 : 0.4} />
        </g>
        <circle cx={icx + ir * 0.42} cy={icy - ir * 0.42} r={Math.max(0.32 * k, ir * 0.3)} fill="#fffaf0" opacity={side === 1 ? 0.95 : 0.7} />
        <path d={upper} stroke={lash} strokeWidth={(o.lashW ?? 0.85) * k} strokeLinecap="round" fill="none" />
        {/* lid crease and the lower lid catching light */}
        <path d={`M${r1(ix + side * 0.2 * k)},${r1(eyeY - up * 0.55)}Q${r1(X)},${r1(eyeY - up * 1.45)} ${r1(ox + side * 0.1 * k)},${r1(oy - up * 0.45)}`} stroke={skin.deep} strokeWidth={0.38 * k} fill="none" opacity="0.55" />
        <path d={`M${r1(ix + side * 0.4 * k)},${r1(eyeY + 0.3 * k)}Q${r1(X)},${r1(eyeY + dn + 0.25 * k)} ${r1(ox)},${r1(oy + 0.15 * k)}`} stroke={side === 1 ? skin.hi : skin.light} strokeWidth={0.32 * k} fill="none" opacity="0.6" />
        {o.lids && <path d={`M${r1(ix - side * 0.4 * k)},${r1(eyeY + dn * 0.9 + 0.7 * k)}Q${r1(X)},${r1(eyeY + dn + 1.4 * k)} ${r1(ox + side * 0.4 * k)},${r1(oy + 0.6 * k)}`} stroke={o.lids} strokeWidth={0.4 * k} fill="none" opacity="0.7" />}
      </g>
    );
  });
  // tapered brows: thick at the inner end, fine at the outer end
  const brows = [-1, 1]
    .filter((s) => !(s === -1 && o.hideLeft))
    .map((s) => {
      const ix = cx + s * 1.6 * k;
      const ox = cx + s * (ex + ew * 1.2);
      const iy = browY + x.bi * k * 0.9;
      const oy = browY - 0.5 * k + x.bo * k * 0.9;
      const mx = ix + (ox - ix) * 0.45;
      const my = Math.min(iy, oy) - (o.browArch ?? 0.9) * k;
      const t = (o.browW ?? 1.35) * k;
      return (
        <g key={s}>
          <path
            d={`M${r1(ix)},${r1(iy - t * 0.55)}Q${r1(mx)},${r1(my - t * 0.5)} ${r1(ox)},${r1(oy)}Q${r1(mx)},${r1(my + t * 0.55)} ${r1(ix)},${r1(iy + t * 0.5)}Z`}
            fill={browC}
          />
          <path d={`M${r1(ix + s * 0.6 * k)},${r1(iy - t * 0.2)}Q${r1(mx)},${r1(my - t * 0.15)} ${r1(ox - s * 0.8 * k)},${r1(oy - t * 0.05)}`} stroke={o.browLit || skin.hi} strokeWidth={0.22 * k} fill="none" opacity={s === 1 ? 0.45 : 0.15} />
        </g>
      );
    });
  let mouth;
  if (x.mouth === 'open') {
    mouth = (
      <g>
        <ellipse cx={cx} cy={mouthY + 0.5 * k} rx={mw * 0.5} ry={1.5 * k} fill="#2a1410" />
        <path d={`M${r1(cx - mw * 0.38)},${r1(mouthY - 0.35 * k)}Q${r1(cx)},${r1(mouthY - 0.7 * k)} ${r1(cx + mw * 0.38)},${r1(mouthY - 0.35 * k)}L${r1(cx + mw * 0.3)},${r1(mouthY + 0.15 * k)}Q${r1(cx)},${r1(mouthY - 0.1 * k)} ${r1(cx - mw * 0.3)},${r1(mouthY + 0.15 * k)}Z`} fill="#e6dccb" opacity="0.85" />
        <path d={`M${r1(cx - mw * 0.5)},${r1(mouthY + 0.2 * k)}Q${r1(cx)},${r1(mouthY - 1.4 * k)} ${r1(cx + mw * 0.5)},${r1(mouthY + 0.2 * k)}`} stroke={lipC} strokeWidth={0.6 * k} fill="none" />
        <path d={`M${r1(cx - mw * 0.45)},${r1(mouthY + 1.4 * k)}Q${r1(cx)},${r1(mouthY + 2.6 * k)} ${r1(cx + mw * 0.45)},${r1(mouthY + 1.4 * k)}`} stroke={lipC} strokeWidth={0.8 * k} fill="none" opacity="0.8" />
      </g>
    );
  } else {
    const c = x.mouth;
    const corner = -c * 0.75 * k;
    const L = [cx - mw, mouthY + corner];
    const R = [cx + mw, mouthY + corner];
    const midY = mouthY + c * 1.1 * k + 0.3;
    const lipOp = o.lipOp ?? 0.75;
    const upper =
      `M${r1(L[0])},${r1(L[1])}Q${r1(cx - mw * 0.55)},${r1(midY - 1.25 * k)} ${r1(cx - 0.35 * k)},${r1(midY - 1.05 * k)}` +
      `L${r1(cx)},${r1(midY - 0.75 * k)}L${r1(cx + 0.35 * k)},${r1(midY - 1.05 * k)}Q${r1(cx + mw * 0.55)},${r1(midY - 1.25 * k)} ${r1(R[0])},${r1(R[1])}` +
      `Q${r1(cx)},${r1(midY)} ${r1(L[0])},${r1(L[1])}Z`;
    const lower = `M${r1(L[0] + 0.3 * k)},${r1(L[1])}Q${r1(cx)},${r1(midY)} ${r1(R[0] - 0.3 * k)},${r1(R[1])}Q${r1(cx + 0.3 * k)},${r1(midY + (o.lowerLip ?? 1.7) * k)} ${r1(L[0] + 0.3 * k)},${r1(L[1])}Z`;
    mouth = (
      <g>
        <path d={lower} fill={lipC} opacity={lipOp * 0.8} />
        <path d={upper} fill={lipD} opacity={lipOp * 0.75} />
        <path d={`M${r1(L[0])},${r1(L[1])}Q${r1(cx)},${r1(midY)} ${r1(R[0])},${r1(R[1])}`} stroke="#2a1410" strokeWidth={0.55 * k} strokeLinecap="round" fill="none" opacity="0.9" />
        <ellipse cx={cx + 0.9 * k} cy={midY + 0.85 * k} rx={0.9 * k} ry={0.3 * k} fill={skin.hi} opacity={0.45 * lipOp} />
        {/* corners pressed in */}
        <circle cx={L[0] - 0.1 * k} cy={L[1]} r={0.32 * k} fill={skin.deep} opacity="0.5" />
        <circle cx={R[0] + 0.1 * k} cy={R[1]} r={0.3 * k} fill={skin.deep} opacity="0.35" />
      </g>
    );
  }
  return (
    <g>
      {eyes}
      {brows}
      {mouth}
    </g>
  );
}

/** Ear with an inner fold and subsurface glow. side -1 (shadow) or 1 (lit). */
export function Ear({ cx, cy, side, skin, rx = 1.9, ry = 3.1 }) {
  const lit = side === 1;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={lit ? skin.base : skin.shade} />
      <ellipse cx={cx + side * 0.25} cy={cy - 0.2} rx={rx * 0.55} ry={ry * 0.62} fill={skin.blood} opacity={lit ? 0.45 : 0.35} />
      <path d={`M${r1(cx + side * 0.5)},${r1(cy - ry * 0.6)}Q${r1(cx - side * 0.6)},${r1(cy)} ${r1(cx + side * 0.2)},${r1(cy + ry * 0.55)}`} stroke={skin.deep} strokeWidth="0.45" fill="none" opacity="0.7" />
      {lit && <path d={`M${r1(cx + rx * 0.6)},${r1(cy - ry * 0.7)}Q${r1(cx + rx * 1.05)},${r1(cy)} ${r1(cx + rx * 0.5)},${r1(cy + ry * 0.75)}`} stroke={skin.hi} strokeWidth="0.45" fill="none" opacity="0.7" />}
    </g>
  );
}

/** Neck with the jaw's cast shadow and a lit right edge. */
export function Neck({ uid, cx = 50, top, bottom, w, skin }) {
  // a slight taper, then the trapezius flaring into the shoulders
  const h = bottom - top;
  const W = w / 2;
  const fy = top + h * 0.42;
  const d =
    `M${r1(cx - W)},${top}L${r1(cx + W)},${top}L${r1(cx + W + 0.3)},${r1(fy)}` +
    `Q${r1(cx + W + 1.4)},${r1(bottom - 3)} ${r1(cx + W + 9)},${bottom}L${r1(cx - W - 9)},${bottom}Q${r1(cx - W - 1.4)},${r1(bottom - 3)} ${r1(cx - W - 0.3)},${r1(fy)}Z`;
  // neck muscles converging on the notch between the collarbones
  const notch = top + h * 0.78;
  const muscles = `M${r1(cx - W + 0.8)},${r1(top + h * 0.12)}Q${r1(cx - 2)},${r1(notch - 3)} ${r1(cx - 0.9)},${r1(notch)}M${r1(cx + W - 0.8)},${r1(top + h * 0.12)}Q${r1(cx + 2)},${r1(notch - 3)} ${r1(cx + 0.9)},${r1(notch)}`;
  return (
    <>
      <defs>
        <clipPath id={`${uid}-nk`}>
          <path d={d} />
        </clipPath>
        <LG id={`${uid}-nkg`} x2={1} y2={0} stops={[[0, skin.deep], [0.4, skin.shade], [0.85, skin.base], [1, skin.light]]} />
      </defs>
      <path d={d} fill={`url(#${uid}-nkg)`} />
      <g clipPath={`url(#${uid}-nk)`}>
        <g filter={`url(#${uid}-soft)`}>
          <ellipse cx={cx - 1} cy={top + 4.5} rx={w * 0.85} ry="5.2" fill={skin.deep} opacity="0.85" />
          <ellipse cx={cx + W * 0.7} cy={top + h * 0.55} rx={1.6} ry={h * 0.3} fill={skin.light} opacity="0.5" />
          <ellipse cx={cx} cy={notch + 0.6} rx="1.6" ry="1" fill={skin.deep} opacity="0.6" />
        </g>
        <path d={muscles} fill="none" stroke={skin.deep} strokeWidth="0.9" opacity="0.22" filter={`url(#${uid}-soft)`} />
      </g>
    </>
  );
}
