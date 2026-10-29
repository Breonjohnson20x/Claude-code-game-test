// Painted human faces for the portraits. Key light from the upper right, so the
// form shadow, core shadow and reflected light sit on the left and the highlights
// (forehead, cheekbone, nose bridge, chin) on the right; an ember bounce from below
// left keeps the shadow side from going black. Skin gets subsurface warmth on the
// cheeks, nose and ears. Eyes have whites, irises, pupils, a lash line and a catchlight.
//
// Each character passes a face recipe in `o` so nobody shares a mannequin:
//   eye: 'almond' | 'wide' | 'narrow' | 'hooded', eyeSep, eyeW, eyeH, eyeDy, look
//   brow colour/weight/arch/gap, browRaise: [left, right] (k units up), browSlope (outer end down)
//   nose: noseAt (length), noseW (wing spread), bridge (highlight width)
//   mouth: mouthW, mouthAt, upperLip, lowerLip, smirk (+ lifts the right corner, - drops the left)
//   marks: lines(g) for creases and age, freckles, crow (crow's feet)
import { r1 } from '../util.js';
import { Bounce, LG } from './kit.jsx';

const EYE = {
  almond: { up: 1.2, dn: 0.85 },
  wide: { up: 1.32, dn: 1.02 },
  narrow: { up: 0.9, dn: 0.58 },
  hooded: { up: 1.1, dn: 0.8 },
};

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
    eh: (o.eyeH ?? 1.75) * k * Math.min(1.35, x.open),
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
  const nw = o.noseW ?? 1;
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
          stops={
            hard
              ? [
                  [0, s.shade],
                  [0.44, s.shade],
                  [0.53, s.base],
                  [0.8, s.light],
                  [1, s.light],
                ]
              : [
                  [0, s.shade],
                  [0.24, s.shade],
                  [0.44, s.base],
                  [0.72, s.light],
                  [1, s.light],
                ]
          }
        />
      </defs>
      <path d={head} fill={`url(#${uid}-skn)`} />
      <g clipPath={`url(#${hc})`}>
        <g filter={`url(#${uid}-soft)`}>
          {/* form shadow, core shadow, reflected light on the far (left) edge */}
          <ellipse cx={cx - rx * (hard ? 0.66 : 0.92)} cy={cy + ry * 0.1} rx={rx * 0.72} ry={ry * 1.35} fill={s.shade} opacity={hard ? 0.95 : 0.9} />
          <ellipse cx={cx - rx * (hard ? 0.3 : 0.5)} cy={cy + ry * 0.16} rx={rx * 0.17} ry={ry * 0.9} fill={s.deep} opacity={hard ? 0.45 : 0.36} />
          <ellipse cx={cx - rx * 1.02} cy={cy + ry * 0.32} rx={rx * 0.22} ry={ry * 0.55} fill={s.bounce} opacity={0.6} />
          {/* the jaw turning under, deepest on the shadow side */}
          <ellipse cx={cx - rx * 0.38} cy={cy + ry * 0.8} rx={rx * 0.62} ry={ry * 0.2} fill={s.deep} opacity="0.3" />
          <ellipse cx={cx + rx * 0.62} cy={cy + ry * 0.66} rx={rx * 0.26} ry={ry * 0.16} fill={s.shade} opacity="0.35" />
          {/* temples */}
          <ellipse cx={cx - rx * 0.86} cy={cy - ry * 0.28} rx={rx * 0.22} ry={ry * 0.3} fill={s.deep} opacity="0.3" />
          {/* hairline / brow cast shadow and the turn under the chin */}
          <ellipse cx={cx + rx * 0.05} cy={cy - ry * 1.02} rx={rx * 1.25} ry={ry * (o.hairShadow ?? 0.32)} fill={s.deep} opacity="0.62" />
          <ellipse cx={cx - rx * 0.1} cy={cy + ry * 1.04} rx={rx * 0.75} ry={ry * 0.16} fill={s.deep} opacity="0.5" />
          {/* eye sockets: deeper under a heavy brow */}
          <ellipse cx={cx - ex} cy={eyeY - 0.5 * k} rx={3.5 * k} ry={2.5 * k} fill={s.shade} opacity={(o.socket ?? 0.75) * (o.hideLeft ? 1.1 : 1)} />
          <ellipse cx={cx + ex} cy={eyeY - 0.5 * k} rx={3.3 * k} ry={2.3 * k} fill={s.shade} opacity={(o.socket ?? 0.75) * 0.66} />
          {/* subsurface warmth: cheeks, nose, lips */}
          <ellipse cx={cx - ex - 0.4 * k} cy={eyeY + 4.8 * k - x.smile * 0.6 * k} rx={2.9 * k} ry={2.1 * k} fill={s.blood} opacity={0.3 + x.blush * 0.6} />
          <ellipse cx={cx + ex + 0.4 * k} cy={eyeY + 4.8 * k - x.smile * 0.6 * k} rx={2.9 * k} ry={2.1 * k} fill={s.blood} opacity={0.22 + x.blush * 0.6} />
          <ellipse cx={cx + 0.2 * k} cy={noseY + 0.2 * k} rx={1.7 * k * nw} ry={1.3 * k} fill={s.blood} opacity="0.28" />
          {/* nose: shadow on the left flank and under the tip */}
          <path
            d={`M${r1(cx - 0.1 * k)},${r1(eyeY + 0.8 * k)}L${r1(cx - 2.5 * k * nw)},${r1(noseY + 0.9 * k)}L${r1(cx - 0.2 * k)},${r1(noseY + 1.2 * k)}Z`}
            fill={s.shade}
            opacity="0.85"
          />
          <ellipse cx={cx - 0.5 * k} cy={noseY + 1.7 * k} rx={2.3 * k * nw} ry={0.8 * k} fill={s.deep} opacity="0.45" />
          {/* lips sit in a little shadow, the chin catches light */}
          <ellipse cx={cx - 0.3 * k} cy={mouthY + 2.1 * k} rx={2.5 * k} ry={0.95 * k} fill={s.shade} opacity="0.6" />
          {/* cheek planes: the hollow under each cheekbone, the temple turning away */}
          <ellipse cx={cx - rx * 0.6} cy={eyeY + 7.2 * k} rx={2.6 * k} ry={3.4 * k} fill={s.shade} opacity={o.hollow ?? 0.45} />
          <ellipse cx={cx + rx * 0.66} cy={eyeY + 7.6 * k} rx={1.9 * k} ry={3 * k} fill={s.shade} opacity={(o.hollow ?? 0.45) * 0.62} />
          <ellipse cx={cx + rx * 0.86} cy={cy - ry * 0.3} rx={1.4 * k} ry={3 * k} fill={s.base} opacity="0.5" />
          {/* highlights: forehead, cheekbone, chin */}
          <ellipse cx={cx + rx * 0.34} cy={cy - ry * 0.5} rx={3.8 * k} ry={2.5 * k} fill={s.hi} opacity={o.foreheadHi ?? 0.6} />
          <ellipse cx={cx + rx * 0.5} cy={eyeY + 3.1 * k} rx={2.8 * k} ry={1.6 * k} fill={s.hi} opacity="0.62" />
          <ellipse cx={cx + 0.7 * k} cy={eyeY + 2.6 * k} rx={0.7 * k * (o.bridge ?? 1)} ry={2.6 * k} fill={s.hi} opacity="0.4" />
          <ellipse cx={cx + 0.9 * k} cy={cy + ry * 0.85} rx={1.7 * k} ry={0.9 * k} fill={s.hi} opacity="0.4" />
        </g>
        {/* ember bounce on the shadow-side cheek and jaw, so the face never sinks into the backdrop */}
        <Bounce uid={uid} d={head} color={o.bounceC || '#e0782b'} op={o.bounceOp ?? 0.42} w={1.5} />
        {/* crisp nose accents */}
        {o.nose !== false && (
          <g fill="none" strokeLinecap="round">
            <path d={`M${r1(cx + 0.45 * k)},${r1(eyeY + 1.5 * k)}Q${r1(cx + 0.9 * k)},${r1(noseY - 1.6 * k)} ${r1(cx + 0.7 * k)},${r1(noseY - 0.5 * k)}`} stroke={s.hi} strokeWidth={0.6 * k * (o.bridge ?? 1)} opacity="0.6" />
            <path d={`M${r1(cx - 2.2 * k * nw)},${r1(noseY + 0.4 * k)}Q${r1(cx - 2.4 * k * nw)},${r1(noseY + 1.4 * k)} ${r1(cx - 1.1 * k)},${r1(noseY + 1.35 * k)}`} stroke={s.deep} strokeWidth={0.55 * k} opacity="0.7" />
            <path d={`M${r1(cx + 2.1 * k * nw)},${r1(noseY + 0.4 * k)}Q${r1(cx + 2.3 * k * nw)},${r1(noseY + 1.4 * k)} ${r1(cx + 1.1 * k)},${r1(noseY + 1.35 * k)}`} stroke={s.shade} strokeWidth={0.45 * k} opacity="0.55" />
            <ellipse cx={cx - 0.75 * k * nw} cy={noseY + 1.25 * k} rx={0.5 * k} ry={0.28 * k} fill={s.deep} opacity="0.8" />
            <ellipse cx={cx + 0.85 * k * nw} cy={noseY + 1.25 * k} rx={0.45 * k} ry={0.25 * k} fill={s.deep} opacity="0.6" />
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

/** Eyes, brows, lips and the mood accents (frown crease, worry lines, smile creases). */
function Features({ g, x, o, skin, uid }) {
  const { cx, k, eyeY, ex, ew, eh, browY, mouthY, mw } = g;
  const lash = o.ink || '#140d09';
  const white = o.white || '#e6dccb';
  const iris = o.iris || '#4a3420';
  const browC = o.brow || '#2a1a10';
  const lipC = o.lip || '#8a4a3a';
  const lipD = o.lipDark || skin.deep;
  const shape = EYE[o.eye] || EYE.almond;
  const raise = o.browRaise || [0, 0];
  const eyes = [-1, 1].map((side) => {
    const X = cx + side * ex;
    const up = eh * shape.up;
    // a smile pushes the cheeks up into the lower lids
    const dn = eh * shape.dn * (1 - x.smile * 0.4);
    // outer corner sits a touch higher than the inner one
    const ix = X - side * ew;
    const ox = X + side * ew;
    const oy = eyeY - (o.eye === 'hooded' ? 0.05 : 0.25) * k;
    const almond = `M${r1(ix)},${r1(eyeY)}Q${r1(X)},${r1(eyeY - up)} ${r1(ox)},${r1(oy)}Q${r1(X)},${r1(eyeY + dn)} ${r1(ix)},${r1(eyeY)}Z`;
    const upper = `M${r1(ix - side * 0.2 * k)},${r1(eyeY + 0.1 * k)}Q${r1(X)},${r1(eyeY - up - 0.15 * k)} ${r1(ox + side * 0.55 * k)},${r1(oy - 0.1 * k)}`;
    const ir = Math.min(eh * (o.eye === 'wide' ? 0.85 : 0.95), ew * 0.56);
    const icx = X + (o.look ?? 0.15) * k;
    const icy = eyeY - 0.05 * k;
    const clip = `${uid}-eye${side}`;
    const dim = side === -1 && o.hideLeft;
    // a heavy lid fold drops over the outer half of the upper lid
    const hood =
      o.eye === 'hooded'
        ? `M${r1(ix - side * 0.3 * k)},${r1(eyeY - up * 0.55)}Q${r1(X + side * 0.4 * k)},${r1(eyeY - up * 1.55)} ${r1(ox + side * 0.9 * k)},${r1(oy + 0.25 * k)}Q${r1(X + side * 0.6 * k)},${r1(eyeY - up * 0.5)} ${r1(ix - side * 0.3 * k)},${r1(eyeY - up * 0.55)}Z`
        : null;
    return (
      <g key={side} opacity={dim ? 0.72 : 1}>
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
          {dim && <rect x={X - ew - k} y={eyeY - up - k} width={ew * 2 + 2 * k} height={up + dn + 2 * k} fill={skin.shade} opacity="0.45" />}
        </g>
        <circle cx={icx + ir * 0.42} cy={icy - ir * 0.42} r={Math.max(0.32 * k, ir * 0.3)} fill="#fffaf0" opacity={side === 1 ? 0.95 : 0.7} />
        <path d={upper} stroke={lash} strokeWidth={(o.lashW ?? 0.85) * k} strokeLinecap="round" fill="none" />
        {hood && <path d={hood} fill={side === 1 ? skin.base : skin.shade} />}
        {hood && <path d={`M${r1(ix - side * 0.3 * k)},${r1(eyeY - up * 0.55)}Q${r1(X + side * 0.6 * k)},${r1(eyeY - up * 0.5)} ${r1(ox + side * 0.9 * k)},${r1(oy + 0.25 * k)}`} stroke={skin.deep} strokeWidth={0.45 * k} fill="none" opacity="0.75" />}
        {/* lid crease and the lower lid catching light */}
        {!hood && <path d={`M${r1(ix + side * 0.2 * k)},${r1(eyeY - up * 0.55)}Q${r1(X)},${r1(eyeY - up * 1.45)} ${r1(ox + side * 0.1 * k)},${r1(oy - up * 0.45)}`} stroke={skin.deep} strokeWidth={0.38 * k} fill="none" opacity="0.55" />}
        <path d={`M${r1(ix + side * 0.4 * k)},${r1(eyeY + 0.3 * k)}Q${r1(X)},${r1(eyeY + dn + 0.25 * k)} ${r1(ox)},${r1(oy + 0.15 * k)}`} stroke={side === 1 ? skin.hi : skin.light} strokeWidth={0.32 * k} fill="none" opacity="0.6" />
        {(o.lids || x.smile > 0) && (
          <path d={`M${r1(ix - side * 0.4 * k)},${r1(eyeY + dn * 0.9 + 0.7 * k)}Q${r1(X)},${r1(eyeY + dn + 1.4 * k)} ${r1(ox + side * 0.4 * k)},${r1(oy + 0.6 * k)}`} stroke={o.lids || skin.deep} strokeWidth={0.4 * k} fill="none" opacity={o.lids ? 0.7 : 0.45} />
        )}
        {/* crow's feet: age, or a real smile */}
        {(o.crow || x.smile > 0) && (
          <path d={`M${r1(ox + side * 0.9 * k)},${r1(oy - 0.5 * k)}l${r1(side * 1.5 * k)},${r1(-0.7 * k)}M${r1(ox + side * 1 * k)},${r1(oy + 0.4 * k)}l${r1(side * 1.6 * k)},${r1(0.2 * k)}M${r1(ox + side * 0.8 * k)},${r1(oy + 1.2 * k)}l${r1(side * 1.3 * k)},${r1(0.9 * k)}`} stroke={skin.deep} strokeWidth={0.32 * k} strokeLinecap="round" fill="none" opacity={o.crow ? 0.55 : 0.4} />
        )}
      </g>
    );
  });
  // tapered brows: thick at the inner end, fine at the outer end
  const brows = [-1, 1].map((s) => {
    const lift = (s === -1 ? raise[0] : raise[1]) * k;
    const ix = cx + s * 1.6 * k;
    const ox = cx + s * (ex + ew * 1.2);
    const iy = browY + x.bi * k * 0.9 - lift;
    const oy = browY - 0.5 * k + x.bo * k * 0.9 + (o.browSlope ?? 0) * k - lift * 1.2;
    const mx = ix + (ox - ix) * 0.45;
    const my = Math.min(iy, oy) - (o.browArch ?? 0.9) * k - lift * 0.4;
    const t = (o.browW ?? 1.35) * k;
    return (
      <g key={s} opacity={s === -1 && o.hideLeft ? 0.7 : 1}>
        <path
          d={`M${r1(ix)},${r1(iy - t * 0.55)}Q${r1(mx)},${r1(my - t * 0.5)} ${r1(ox)},${r1(oy)}Q${r1(mx)},${r1(my + t * 0.55)} ${r1(ix)},${r1(iy + t * 0.5)}Z`}
          fill={browC}
        />
        <path d={`M${r1(ix + s * 0.6 * k)},${r1(iy - t * 0.2)}Q${r1(mx)},${r1(my - t * 0.15)} ${r1(ox - s * 0.8 * k)},${r1(oy - t * 0.05)}`} stroke={o.browLit || skin.hi} strokeWidth={0.22 * k} fill="none" opacity={s === 1 ? 0.45 : 0.15} />
      </g>
    );
  });
  // mood accents on the brow
  const accents = [];
  if (x.crease) {
    const y0 = browY + x.bi * k * 0.9 - 1.6 * k;
    accents.push(
      <path key="crease" d={`M${r1(cx - 0.7 * k)},${r1(y0)}q-0.3,${r1(1.2 * k)} 0.1,${r1(2.4 * k)}M${r1(cx + 0.8 * k)},${r1(y0 + 0.2 * k)}q0.25,${r1(1.1 * k)} -0.1,${r1(2.2 * k)}`} stroke={skin.deep} strokeWidth={0.42 * k} strokeLinecap="round" fill="none" opacity="0.7" />,
    );
  }
  if (x.worry) {
    const y0 = browY - 3.4 * k;
    accents.push(
      <path key="worry" d={`M${r1(cx - 3.6 * k)},${r1(y0 + 0.6 * k)}Q${r1(cx)},${r1(y0 - 1.1 * k)} ${r1(cx + 3.6 * k)},${r1(y0 + 0.6 * k)}M${r1(cx - 2.6 * k)},${r1(y0 + 2 * k)}Q${r1(cx)},${r1(y0 + 0.6 * k)} ${r1(cx + 2.6 * k)},${r1(y0 + 2 * k)}`} stroke={skin.deep} strokeWidth={0.36 * k} strokeLinecap="round" fill="none" opacity="0.55" />,
    );
  }
  let mouth;
  if (x.mouth === 'open') {
    const ow = mw * 0.62;
    mouth = (
      <g>
        <ellipse cx={cx} cy={mouthY + 0.7 * k} rx={ow} ry={1.9 * k} fill="#2a1410" />
        <path d={`M${r1(cx - ow * 0.75)},${r1(mouthY - 0.5 * k)}Q${r1(cx)},${r1(mouthY - 0.9 * k)} ${r1(cx + ow * 0.75)},${r1(mouthY - 0.5 * k)}L${r1(cx + ow * 0.6)},${r1(mouthY + 0.15 * k)}Q${r1(cx)},${r1(mouthY - 0.1 * k)} ${r1(cx - ow * 0.6)},${r1(mouthY + 0.15 * k)}Z`} fill="#e6dccb" opacity="0.85" />
        <path d={`M${r1(cx - ow)},${r1(mouthY + 0.4 * k)}Q${r1(cx)},${r1(mouthY - 1.7 * k)} ${r1(cx + ow)},${r1(mouthY + 0.4 * k)}`} stroke={lipC} strokeWidth={0.7 * k} fill="none" />
        <path d={`M${r1(cx - ow * 0.9)},${r1(mouthY + 1.6 * k)}Q${r1(cx)},${r1(mouthY + 3.2 * k)} ${r1(cx + ow * 0.9)},${r1(mouthY + 1.6 * k)}`} stroke={lipC} strokeWidth={0.9 * k} fill="none" opacity="0.8" />
      </g>
    );
  } else {
    const c = x.mouth;
    const sm = o.smirk ?? 0;
    const corner = -c * 0.85 * k;
    const L = [cx - mw, mouthY + corner + Math.max(0, -sm) * 0.8 * k];
    const R = [cx + mw, mouthY + corner - Math.max(0, sm) * 0.9 * k];
    const midY = mouthY + c * 1.1 * k + 0.3;
    const lipOp = o.lipOp ?? 0.75;
    const ul = o.upperLip ?? 1;
    const upper =
      `M${r1(L[0])},${r1(L[1])}Q${r1(cx - mw * 0.55)},${r1(midY - 1.25 * k * ul)} ${r1(cx - 0.35 * k)},${r1(midY - 1.05 * k * ul)}` +
      `L${r1(cx)},${r1(midY - 0.75 * k * ul)}L${r1(cx + 0.35 * k)},${r1(midY - 1.05 * k * ul)}Q${r1(cx + mw * 0.55)},${r1(midY - 1.25 * k * ul)} ${r1(R[0])},${r1(R[1])}` +
      `Q${r1(cx)},${r1(midY)} ${r1(L[0])},${r1(L[1])}Z`;
    const lower = `M${r1(L[0] + 0.3 * k)},${r1(L[1])}Q${r1(cx)},${r1(midY)} ${r1(R[0] - 0.3 * k)},${r1(R[1])}Q${r1(cx + 0.3 * k)},${r1(midY + (o.lowerLip ?? 1.7) * k)} ${r1(L[0] + 0.3 * k)},${r1(L[1])}Z`;
    mouth = (
      <g>
        <path d={lower} fill={lipC} opacity={lipOp * 0.8} />
        <path d={upper} fill={lipD} opacity={lipOp * 0.75} />
        <path d={`M${r1(L[0])},${r1(L[1])}Q${r1(cx)},${r1(midY)} ${r1(R[0])},${r1(R[1])}`} stroke="#2a1410" strokeWidth={0.55 * k} strokeLinecap="round" fill="none" opacity="0.9" />
        <ellipse cx={cx + 0.9 * k} cy={midY + 0.85 * k} rx={0.9 * k} ry={0.3 * k} fill={skin.hi} opacity={0.45 * lipOp} />
        {/* corners pressed in; a smile digs a crease into the cheek */}
        <circle cx={L[0] - 0.1 * k} cy={L[1]} r={0.32 * k} fill={skin.deep} opacity="0.5" />
        <circle cx={R[0] + 0.1 * k} cy={R[1]} r={0.3 * k} fill={skin.deep} opacity="0.35" />
        {c > 0.8 && (
          <path d={`M${r1(L[0] - 0.4 * k)},${r1(L[1] - 1.6 * k)}q-0.7,${r1(1.2 * k)} 0.1,${r1(2.4 * k)}M${r1(R[0] + 0.4 * k)},${r1(R[1] - 1.6 * k)}q0.7,${r1(1.2 * k)} -0.1,${r1(2.4 * k)}`} stroke={skin.deep} strokeWidth={0.36 * k} strokeLinecap="round" fill="none" opacity="0.45" />
        )}
        {c < -0.8 && (
          <path d={`M${r1(L[0] - 0.2 * k)},${r1(L[1] + 0.2 * k)}l-0.5,${r1(1.4 * k)}M${r1(R[0] + 0.2 * k)},${r1(R[1] + 0.2 * k)}l0.5,${r1(1.4 * k)}`} stroke={skin.deep} strokeWidth={0.36 * k} strokeLinecap="round" fill="none" opacity="0.5" />
        )}
      </g>
    );
  }
  return (
    <g>
      {eyes}
      {brows}
      {accents}
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
      {!lit && <path d={`M${r1(cx - rx * 0.7)},${r1(cy - ry * 0.5)}Q${r1(cx - rx * 1.05)},${r1(cy + ry * 0.1)} ${r1(cx - rx * 0.5)},${r1(cy + ry * 0.75)}`} stroke="#e0782b" strokeWidth="0.45" fill="none" opacity="0.4" />}
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
        <LG id={`${uid}-nks`} x1={0} y1={0} x2={0} y2={1} stops={[[0, skin.deep, 0.9], [0.32, skin.deep, 0.55], [0.55, skin.deep, 0]]} />
      </defs>
      <path d={d} fill={`url(#${uid}-nkg)`} />
      <g clipPath={`url(#${uid}-nk)`}>
        {/* the jaw's cast shadow, a lit tendon, the notch: soft gradients and strokes, no blur */}
        <rect x={cx - W - 10} y={top} width={w + 20} height={h} fill={`url(#${uid}-nks)`} />
        <path d={`M${r1(cx + W * 0.7)},${r1(top + h * 0.3)}V${r1(top + h * 0.8)}`} stroke={skin.light} strokeWidth="2.4" strokeLinecap="round" opacity="0.22" />
        <ellipse cx={cx} cy={notch + 0.6} rx="1.4" ry="0.8" fill={skin.deep} opacity="0.5" />
        <path d={muscles} fill="none" stroke={skin.deep} strokeWidth="0.7" opacity="0.2" />
      </g>
    </>
  );
}
