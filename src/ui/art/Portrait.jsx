// <Portrait id size mood label className />
// Heraldic bust portraits in one consistent style: frontal bust, key light from
// the upper right (rim light on the right edge), gold ring frame. Built from
// bold shapes so each character reads at 40px and rewards a look at 96px+.
import { memo } from 'react';
import { MOOD_TINT } from './palette.js';
import { r1, useUid } from './util.js';

// ---------------------------------------------------------------- tiny kit
function LG({ id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 0 }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  );
}
function RG({ id, stops, cx = '50%', cy = '50%', r = '50%', fx, fy }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx} fy={fy}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </radialGradient>
  );
}
/** 3-tone side-lit fill: shadow on the left, light on the right. */
const lit3 = (id, [shade, base, light], hard = false) => (
  <LG
    id={id}
    x2={1}
    y2={0.18}
    stops={hard ? [[0, shade], [0.47, shade], [0.55, base], [1, light]] : [[0, shade], [0.36, shade], [0.62, base], [1, light]]}
  />
);

/** Egg-shaped head. jx/jy = jaw corner, cw = chin width (fractions of rx/ry). */
function headPath(cx, cy, rx, ry, jx = 0.74, jy = 0.7, cw = 0.26) {
  const n = (v) => r1(v);
  return (
    `M${n(cx)},${n(cy - ry)}` +
    `C${n(cx + rx * 0.56)},${n(cy - ry)} ${n(cx + rx)},${n(cy - ry * 0.6)} ${n(cx + rx)},${n(cy - ry * 0.05)}` +
    `C${n(cx + rx)},${n(cy + ry * 0.32)} ${n(cx + rx * (jx + 0.12))},${n(cy + ry * (jy - 0.18))} ${n(cx + rx * jx)},${n(cy + ry * jy)}` +
    `C${n(cx + rx * (jx - 0.2))},${n(cy + ry * (jy + 0.18))} ${n(cx + rx * cw)},${n(cy + ry)} ${n(cx)},${n(cy + ry)}` +
    `C${n(cx - rx * cw)},${n(cy + ry)} ${n(cx - rx * (jx - 0.2))},${n(cy + ry * (jy + 0.18))} ${n(cx - rx * jx)},${n(cy + ry * jy)}` +
    `C${n(cx - rx * (jx + 0.12))},${n(cy + ry * (jy - 0.18))} ${n(cx - rx)},${n(cy + ry * 0.32)} ${n(cx - rx)},${n(cy - ry * 0.05)}` +
    `C${n(cx - rx)},${n(cy - ry * 0.6)} ${n(cx - rx * 0.56)},${n(cy - ry)} ${n(cx)},${n(cy - ry)}Z`
  );
}

const EXPR = {
  neutral: { bi: 0, bo: 0, mouth: 0, open: 1, blush: 0 },
  grim: { bi: 1.3, bo: -0.3, mouth: -1, open: 0.7, blush: 0 },
  warm: { bi: -0.5, bo: -0.2, mouth: 1, open: 0.88, blush: 0.4 },
  alarmed: { bi: -1.9, bo: -1.1, mouth: 'open', open: 1.4, blush: 0 },
};

function exprFor(mood, base = {}) {
  const e = EXPR[mood] || EXPR.neutral;
  return {
    bi: e.bi + (base.bi || 0),
    bo: e.bo + (base.bo || 0),
    mouth: e.mouth === 'open' ? 'open' : e.mouth + (base.mouth || 0),
    open: e.open * (base.open || 1),
    blush: Math.max(e.blush, base.blush || 0),
  };
}

/**
 * Human facial features. Light from the upper right: nose shadow falls left.
 * f: { cx, cy, rx, ry } head box. o: options.
 */
function Features({ f, x, o = {} }) {
  const { cx, cy, rx, ry } = f;
  const k = rx / 12.5;
  const eyeY = cy + (o.eyeDy ?? 0) * k;
  const ex = (o.eyeSep ?? 5.2) * k;
  const ew = (o.eyeW ?? 2.9) * k;
  const eh = (o.eyeH ?? 1.75) * k * Math.min(1.25, x.open);
  const ink = o.ink || '#1b130d';
  const browC = o.brow || '#2a1a10';
  const browY = eyeY - (o.browGap ?? 3.6) * k;
  const noseY = cy + ry * 0.36;
  const mouthY = cy + ry * (o.mouthAt ?? 0.62);
  const mw = (o.mouthW ?? 3.4) * k;
  const lip = o.lip || '#5a2a22';
  const big = o.irisEyes || x.mouth === 'open';
  const eyes = [];
  [-1, 1].forEach((side) => {
    if (side === -1 && o.hideLeft) {
      eyes.push(<circle key="gl" cx={cx - ex + 0.4} cy={eyeY} r={0.45 * k} fill={o.glint || '#e3c463'} opacity="0.55" />);
      return;
    }
    const exX = cx + side * ex;
    const almond = `M${r1(exX - ew)},${r1(eyeY)}Q${r1(exX)},${r1(eyeY - eh * 1.15)} ${r1(exX + ew)},${r1(eyeY)}Q${r1(exX)},${r1(eyeY + eh * 0.85)} ${r1(exX - ew)},${r1(eyeY)}Z`;
    if (big) {
      eyes.push(
        <g key={side}>
          <path d={almond} fill={o.white || '#efe6d6'} />
          <circle cx={exX + 0.15 * k} cy={eyeY - 0.05} r={Math.min(eh, ew) * 0.78} fill={o.iris || '#3b2a1c'} />
          <circle cx={exX + 0.15 * k} cy={eyeY - 0.05} r={Math.min(eh, ew) * 0.42} fill={ink} />
          <circle cx={exX + 0.75 * k} cy={eyeY - 0.6 * k} r={0.5 * k} fill="#fffaf0" />
          <path d={`M${r1(exX - ew)},${r1(eyeY)}Q${r1(exX)},${r1(eyeY - eh * 1.15)} ${r1(exX + ew)},${r1(eyeY)}`} stroke={ink} strokeWidth={0.75 * k} fill="none" />
        </g>,
      );
    } else {
      eyes.push(
        <g key={side}>
          <path d={almond} fill={ink} />
          <circle cx={exX + 0.7 * k} cy={eyeY - 0.35 * k} r={0.42 * k} fill="#fff4d6" opacity={side === 1 ? 0.95 : 0.55} />
        </g>,
      );
    }
    if (o.lids) {
      eyes.push(
        <path key={`l${side}`} d={`M${r1(exX - ew * 1.05)},${r1(eyeY - eh * 0.2)}Q${r1(exX)},${r1(eyeY - eh * 1.6)} ${r1(exX + ew * 1.1)},${r1(eyeY - eh * 0.3)}`} stroke={o.lids} strokeWidth={0.55 * k} fill="none" opacity="0.8" />,
      );
    }
  });
  // brows: inner end at cx ± 1.6, outer end at cx ± ex + ew
  const brows = [-1, 1]
    .filter((s) => !(s === -1 && o.hideLeft))
    .map((s) => {
      const ix = cx + s * 1.7 * k;
      const ox = cx + s * (ex + ew * 1.15);
      const iy = browY + x.bi * k * 0.9;
      const oy = browY - 0.5 * k + x.bo * k * 0.9;
      const mx = (ix + ox) / 2;
      const my = Math.min(iy, oy) - (o.browArch ?? 0.9) * k;
      return `M${r1(ix)},${r1(iy)}Q${r1(mx)},${r1(my)} ${r1(ox)},${r1(oy)}`;
    })
    .join('');
  let mouth;
  if (x.mouth === 'open') {
    mouth = <ellipse cx={cx} cy={mouthY + 0.5 * k} rx={mw * 0.42} ry={1.35 * k} fill="#2a1410" />;
  } else {
    const c = x.mouth;
    const corner = -c * 0.75 * k;
    mouth = (
      <path
        d={`M${r1(cx - mw)},${r1(mouthY + corner)}Q${r1(cx)},${r1(mouthY + c * 1.1 * k + 0.3)} ${r1(cx + mw)},${r1(mouthY + corner)}`}
        stroke={lip}
        strokeWidth={0.95 * k}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <g>
      {x.blush > 0 && (
        <g fill={o.blushC || '#d4705f'} opacity={x.blush * (o.blushK ?? 1)}>
          <ellipse cx={cx - ex - 0.6 * k} cy={eyeY + 5 * k} rx={2.4 * k} ry={1.4 * k} />
          <ellipse cx={cx + ex + 0.6 * k} cy={eyeY + 5 * k} rx={2.4 * k} ry={1.4 * k} />
        </g>
      )}
      {o.nose !== false && (
        <g fill="none" strokeLinecap="round">
          <path d={`M${r1(cx - 0.4 * k)},${r1(eyeY + 1.6 * k)}Q${r1(cx - 1.7 * k)},${r1(noseY - 1 * k)} ${r1(cx - 1.8 * k)},${r1(noseY)}`} stroke={o.shade || '#6b4030'} strokeWidth={0.8 * k} opacity="0.75" />
          <path d={`M${r1(cx - 2 * k)},${r1(noseY + 0.3 * k)}Q${r1(cx)},${r1(noseY + 1.6 * k)} ${r1(cx + 1.8 * k)},${r1(noseY + 0.3 * k)}`} stroke={o.shade || '#6b4030'} strokeWidth={0.75 * k} opacity="0.6" />
          <path d={`M${r1(cx + 0.7 * k)},${r1(eyeY + 2.4 * k)}L${r1(cx + 1 * k)},${r1(noseY - 1.4 * k)}`} stroke={o.lit || '#ffe2c4'} strokeWidth={0.7 * k} opacity="0.5" />
        </g>
      )}
      {eyes}
      {brows && <path d={brows} stroke={browC} strokeWidth={(o.browW ?? 1.35) * k} strokeLinecap="round" fill="none" />}
      {mouth}
    </g>
  );
}

/** Rim light on the right edge of a shape (needs `${uid}-rim` clipPath). */
function Rim({ uid, d, color = '#fff3d0', op = 0.55, w = 1.3 }) {
  return <path d={d} fill="none" stroke={color} strokeOpacity={op} strokeWidth={w} clipPath={`url(#${uid}-rim)`} />;
}

const neck = (cx, top, bottom, w) => `M${cx - w / 2},${top}L${cx + w / 2},${top}L${cx + w / 2 + 1},${bottom}L${cx - w / 2 - 1},${bottom}Z`;
const shoulders = (top = 70, spread = 1, cx = 50) =>
  `M${cx - 46 * spread},104C${cx - 44 * spread},${top + 14} ${cx - 32 * spread},${top + 4} ${cx - 14},${top}L${cx + 14},${top}C${cx + 32 * spread},${top + 4} ${cx + 44 * spread},${top + 14} ${cx + 46 * spread},104Z`;

// ================================================================ characters
// Each returns { bg: [inner, outer], glow?, art }.

function Mara({ uid, mood }) {
  const f = { cx: 50, cy: 43, rx: 12.2, ry: 15.6 };
  const x = exprFor(mood, { bi: 0.6 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.8, 0.68, 0.3);
  return {
    bg: ['#30486f', '#0b1424'],
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#7d4f3a', '#b07a5a', '#d9a27e'])}
          {lit3(`${uid}-coat`, ['#0f182a', '#1f3150', '#3a5684'])}
          {lit3(`${uid}-lap`, ['#16243a', '#2b4268', '#4a6898'])}
          <LG id={`${uid}-gold`} x2={0.6} y2={1} stops={[[0, '#fbefc2'], [0.45, '#e3c463'], [1, '#8a6a16']]} />
        </defs>
        <path d={neck(50, 52, 76, 11)} fill={`url(#${uid}-skin)`} />
        <ellipse cx="50" cy="60" rx="7" ry="3" fill="#4a2a1e" opacity="0.55" />
        <path d={shoulders(70)} fill={`url(#${uid}-coat)`} />
        {/* tunic + gorget */}
        <path d="M42,71L50,92L58,71Z" fill="#0f1b2d" />
        <path d="M46.2,74.5L50,77.6L53.8,74.5L52.6,80L50,82L47.4,80Z" fill={`url(#${uid}-gold)`} />
        {/* turned-up greatcoat collar */}
        <path d="M37,68L27,79L38,94L47.5,77Z" fill={`url(#${uid}-lap)`} stroke="#c9a227" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M63,68L73,79L62,94L52.5,77Z" fill={`url(#${uid}-lap)`} stroke="#e3c463" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M32.5,79.5l1.8,-1.8l1.8,1.8l-1.8,1.8Z M67.5,79.5l-1.8,-1.8l-1.8,1.8l1.8,1.8Z" fill="#f0dc95" />
        {/* epaulettes + fringe */}
        <g>
          <ellipse cx="22" cy="78" rx="10" ry="3.4" transform="rotate(24 22 78)" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.5" />
          <ellipse cx="78" cy="78" rx="10" ry="3.4" transform="rotate(-24 78 78)" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.5" />
          <path d="M14,79v4M16.5,80.5v4.4M19,82v4.6M21.5,83.4v4.6M24,84.6v4.2M86,79v4M83.5,80.5v4.4M81,82v4.6M78.5,83.4v4.6M76,84.6v4.2" stroke="#a8841b" strokeWidth="1" strokeLinecap="round" />
        </g>
        {/* aiguillette */}
        <path d="M76,82Q70,94 59,92M76,82Q72,90 61,89" stroke="#e3c463" strokeWidth="0.9" fill="none" />
        <circle cx="45.5" cy="97" r="1.3" fill="#e3c463" />
        <circle cx="54.5" cy="97" r="1.3" fill="#e3c463" />
        {/* head */}
        <ellipse cx="37.8" cy="45.5" rx="1.9" ry="3.1" fill="#7d4f3a" />
        <ellipse cx="62.2" cy="45.5" rx="1.9" ry="3.1" fill="#c18a68" />
        <path d={head} fill={`url(#${uid}-skin)`} />
        <Features f={f} x={x} o={{ shade: '#6e4130', lit: '#f2c6a0', brow: '#3a2418', lip: '#7a3d30' }} />
        {/* scar through the left brow and cheek (lit side) */}
        <path d="M57.4,35.6L59.2,41.2M59.9,44.4L61.3,50.6" stroke="#f0c7ad" strokeWidth="0.95" strokeLinecap="round" />
        <path d="M57,36L58.7,41.6M59.4,44.8L60.8,51" stroke="#6e3a2c" strokeWidth="0.45" strokeLinecap="round" opacity="0.8" />
        {/* cropped hair, side-swept */}
        <path
          d="M37.4,44C36.3,36.4 37.4,29.4 43,26.8C48.2,24.6 56.4,24.9 60.8,28.1C63.9,30.4 64.2,35.4 63,41.2L61.9,39.2C61.4,35.2 59.6,32.5 56.5,31.7C52,33.8 46,34.4 41.2,33.3C39.8,35.7 39,39.2 38.8,44Z"
          fill="#3a2418"
        />
        <path d="M52.5,26.2C58,25.9 62,28.7 62.9,33.4C60.7,30.2 57,28.1 52.5,27.6Z" fill="#7a4a2c" />
        <path d="M62.6,35.5L62.8,39.5M38.2,38L38.4,42.5" stroke="#a8a29a" strokeWidth="0.8" strokeLinecap="round" opacity="0.85" />
        <Rim uid={uid} d={head} color="#ffd9b0" op={0.55} />
      </>
    ),
  };
}

function Vale({ uid, mood }) {
  const f = { cx: 50, cy: 42, rx: 11, ry: 16.2 };
  const x = exprFor(mood, { mouth: 0.6, bi: -0.4 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.68, 0.7, 0.2);
  return {
    bg: ['#6a5530', '#17110b'],
    glow: '#ffd97a',
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#a57a60', '#d9b08f', '#f3d1ae'])}
          {lit3(`${uid}-shirt`, ['#8a7d63', '#cfc2a2', '#efe6cf'])}
          {lit3(`${uid}-lea`, ['#3b2716', '#5e3f26', '#8a6038'])}
          {lit3(`${uid}-hair`, ['#4a210e', '#7a3a18', '#c06a2e'])}
          <RG id={`${uid}-lens`} cx="38%" cy="35%" r="70%" stops={[[0, '#fff4d6'], [0.3, '#f4a35e'], [1, '#8a3a1c']]} />
        </defs>
        {/* wild hair behind */}
        <path
          d="M37,47L31.5,41.5L35.5,39.5L30,31L36,31.8L33,22.5L40,26.5L40.6,17L46,23.6L50.4,15L53.6,23L59.6,16.6L59.8,25.4L67.2,20.6L65,29.6L71.4,30L65.8,36L70,40.4L63.4,42.4Z"
          fill={`url(#${uid}-hair)`}
        />
        <path d={neck(50, 52, 78, 8.6)} fill={`url(#${uid}-skin)`} />
        <ellipse cx="50" cy="58.5" rx="5.6" ry="2.6" fill="#7a5040" opacity="0.5" />
        <path d={shoulders(74, 0.92)} fill={`url(#${uid}-shirt)`} />
        <path d="M44,73L50,84L56,73Z" fill={`url(#${uid}-skin)`} />
        <path d="M42.5,72.5L47,71.5L50,84L45,79Z M57.5,72.5L53,71.5L50,84L55,79Z" fill="#e8dfc8" stroke="#8a7d63" strokeWidth="0.4" />
        {/* leather apron / waistcoat */}
        <path d="M28,104L33,82L44.5,80L48,104Z" fill={`url(#${uid}-lea)`} />
        <path d="M72,104L67,82L55.5,80L52,104Z" fill={`url(#${uid}-lea)`} />
        <path d="M33,82L44.5,80M67,82L55.5,80" stroke="#b08d57" strokeWidth="0.6" />
        <rect x="37.5" y="87" width="4.4" height="3.2" rx="0.6" fill="none" stroke="#d6b47a" strokeWidth="1" />
        <rect x="58.1" y="87" width="4.4" height="3.2" rx="0.6" fill="none" stroke="#f0d49a" strokeWidth="1" />
        {/* brass tools in the breast pocket */}
        <path d="M60,92h10.5v8h-10.5Z" fill="#4a3220" />
        <path d="M63,92V80.5" stroke="#d6b47a" strokeWidth="1.5" />
        <path d="M60.4,79.6a2.7,2.7 0 1 1 5.2,0l-1.3,0.2l-0.5,-1.6h-1.6l-0.5,1.6Z" fill="#e3c463" stroke="#7a5f36" strokeWidth="0.4" />
        <path d="M67.6,92V82.8" stroke="#c3c7cc" strokeWidth="1" />
        <rect x="66.6" y="84.8" width="2" height="3.6" rx="0.5" fill="#b08d57" />
        <path d="M60,92h10.5" stroke="#8a6038" strokeWidth="0.7" />
        {/* head */}
        <ellipse cx="39.2" cy="44.5" rx="1.7" ry="3" fill="#a57a60" />
        <ellipse cx="60.8" cy="44.5" rx="1.7" ry="3" fill="#e3bc98" />
        <path d={head} fill={`url(#${uid}-skin)`} />
        <Features f={f} x={x} o={{ shade: '#8a5e46', lit: '#fff0d8', brow: '#6e3518', lip: '#8a4a3a', eyeSep: 5.4, eyeW: 2.7 }} />
        {/* messy fringe */}
        <path
          d="M38.4,36L41.6,29.4L43.8,33.2L46.6,27.6L49.2,32.4L52.4,27.2L54.6,31.8L58.2,28.2L58.6,33.4L61.8,30.8L61.4,37C55.6,33.2 45,33.2 38.4,36Z"
          fill={`url(#${uid}-hair)`}
        />
        {/* goggles pushed up */}
        <path d="M38.4,32.8C45,29.4 55,29.4 61.8,32.8" stroke="#2e2117" strokeWidth="2.3" fill="none" />
        <circle cx="44.6" cy="30.6" r="3.7" fill={`url(#${uid}-lens)`} stroke="#b08d57" strokeWidth="1.6" />
        <circle cx="55.6" cy="30.6" r="3.7" fill={`url(#${uid}-lens)`} stroke="#e3c463" strokeWidth="1.6" />
        <path d="M48.3,30.6h3.6" stroke="#7a5f36" strokeWidth="1.2" />
        <circle cx="56.6" cy="29.4" r="0.9" fill="#fffaf0" />
        <Rim uid={uid} d={head} color="#fff0d0" op={0.5} />
      </>
    ),
  };
}

function Cassian({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 11.8, ry: 16 };
  const x = exprFor(mood, { bi: 0.4, mouth: -0.2, open: 0.85 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.7, 0.68, 0.16);
  return {
    bg: ['#22365a', '#05090f'],
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#24191c', '#a4765b', '#d8aa88'], true)}
          {lit3(`${uid}-coat`, ['#0c0e13', '#1c2029', '#3a404d'], true)}
          <LG id={`${uid}-sh`} stops={[[0, '#000', 0.6], [0.42, '#000', 0.38], [0.52, '#000', 0]]} />
        </defs>
        <path d={neck(50, 52, 74, 10)} fill={`url(#${uid}-skin)`} />
        <path d={shoulders(71)} fill={`url(#${uid}-coat)`} />
        {/* tall stand collar to the jaw */}
        <path d="M38.6,57L37,75C42,78.6 58,78.6 63,75L61.4,57C57.6,60.4 42.4,60.4 38.6,57Z" fill={`url(#${uid}-coat)`} />
        <path d="M38.6,57C42.4,60.4 57.6,60.4 61.4,57" stroke="#a8841b" strokeWidth="0.8" fill="none" />
        <path d="M50,60.4V77" stroke="#05070a" strokeWidth="0.9" />
        <path d="M38.2,64C42,67.4 58,67.4 61.8,64" stroke="#2e3440" strokeWidth="0.5" fill="none" />
        {/* lapel seams + intelligence pin */}
        <path d="M37,75L44,104M63,75L56,104" stroke="#3a404d" strokeWidth="0.6" />
        <path d="M60.6,86.4q2.6,-2.4 5.2,0q-2.6,2.4 -5.2,0Z" fill="#e3c463" />
        <circle cx="63.2" cy="86.4" r="0.8" fill="#0b1424" />
        {/* head */}
        <ellipse cx="61.6" cy="45" rx="1.7" ry="3" fill="#b8896a" />
        <path d={head} fill={`url(#${uid}-skin)`} />
        <Features f={f} x={x} o={{ hideLeft: true, shade: '#3a2420', lit: '#ffe0c0', brow: '#14161c', lip: '#6a3a30', eyeW: 2.8, eyeH: 1.4, mouthW: 3, browArch: 0.3 }} />
        {/* cheekbone plane */}
        <path d="M55.5,48.5Q59.5,49.5 61,53" stroke="#8a5e46" strokeWidth="0.7" fill="none" opacity="0.6" />
        {/* slicked hair */}
        <path d="M37.8,41C37,30.6 42,26 50,25.6C58.6,25.3 63.4,30.2 62.3,41L61.3,37.2C60.4,32.8 56.6,30.6 50.6,31.4L48.4,29.9C44.2,31.2 40.4,33.8 38.9,41Z" fill="#12141a" />
        <path d="M51.5,27.4C56.5,27.6 60.2,30 61.5,34.4M53,26.4C57.8,26.8 61.6,29.6 62.3,33.2" stroke="#4b5363" strokeWidth="0.6" fill="none" />
        <Rim uid={uid} d={head} color="#ffd9b0" op={0.65} w={1.1} />
        {/* the shadow that owns half his face */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-sh)`} />
      </>
    ),
  };
}

function Sparky({ uid, mood }) {
  const alarmed = mood === 'alarmed';
  const grim = mood === 'grim';
  const warm = mood === 'warm';
  const eyeR = alarmed ? 5.2 : grim ? 4.3 : 4.8;
  const pupil = alarmed ? 0.7 : grim ? 0.9 : 1.15;
  const browDy = grim ? 1.8 : alarmed ? -1.4 : 0;
  const smile = warm ? 3.4 : grim ? 0.6 : alarmed ? -0.4 : 2.2;
  return {
    bg: ['#3d4a2b', '#0b100a'],
    glow: '#d4f57a',
    art: (
      <>
        <defs>
          {lit3(`${uid}-sc`, ['#24301b', '#4b6236', '#86a35a'])}
          {lit3(`${uid}-bel`, ['#9a8754', '#d6c48a', '#f3e6b8'])}
          {lit3(`${uid}-horn`, ['#a8977a', '#e0d4b6', '#fbf4e2'])}
          <RG id={`${uid}-eye`} cx="45%" cy="40%" r="60%" stops={[[0, '#efffb0'], [0.45, '#b4e83f'], [1, '#5f8a17']]} />
          <RG id={`${uid}-acid`} stops={[[0, '#d4f57a', 0.9], [1, '#b4e83f', 0]]} />
        </defs>
        {/* wing behind */}
        <path d="M24,80L7,58L14,61.5L11.5,48L20,57.5L22.5,46L29,62Z" fill="#1d2716" />
        <path d="M14,61.5L22,74M20,57.5L25,72M22.5,46L27,68" stroke="#3b4a2b" strokeWidth="0.7" />
        {/* neck */}
        <path d="M17,104C19,88 28,74 40,66L64,68C68,80 72,92 76,104Z" fill={`url(#${uid}-sc)`} />
        <path d="M44,70C48,82 53,93 56,104L68,104C64,92 60,80 57,69Z" fill={`url(#${uid}-bel)`} />
        <path d="M45.6,75.5l11.8,-1.6M47.8,81.5l12.2,-1.8M50.2,87.6l12.4,-1.8M52.6,93.6l12.6,-1.8M55,99.6l12.6,-1.8" stroke="#9a8754" strokeWidth="0.7" />
        <path d="M24,84l-4,-2l3,-2.6ZM28,76l-4,-2.4l3.4,-2.4ZM33,69.6l-3.6,-2.8l3.8,-1.8Z" fill="#2f3d22" />
        {/* frills */}
        <path d="M35.5,40L22.5,33L27,40L20.5,44.5L29.5,46.5L35,49Z" fill="#2f3d22" />
        <path d="M68,38L80.5,30.5L77.5,38L84,41.5L75,45.5L68.6,46.6Z" fill="#567241" />
        <path d="M27,40L34,44M29.5,46.5L35,46M77.5,38L70,42M75,45.5L69,44.5" stroke="#86a35a" strokeWidth="0.5" opacity="0.7" />
        {/* horns */}
        <path d="M41.5,31.5C37.5,25 35.6,20.5 36.6,15.5C39.8,19.6 43.8,24.6 46.4,29.5Z" fill={`url(#${uid}-horn)`} />
        <path d="M58.4,30C61.4,23 64.2,19.6 67.8,17.2C67.2,22.6 64.6,27.8 62.4,32Z" fill={`url(#${uid}-horn)`} />
        {/* head: cranium + round snout */}
        <ellipse cx="51" cy="43.5" rx="17" ry="15" fill={`url(#${uid}-sc)`} />
        <ellipse cx="59" cy="53" rx="12" ry="8.4" fill={`url(#${uid}-sc)`} />
        <path d="M47,56.5C52,60.6 62,61.6 70,55.6C68,60.6 62,62.8 56,62.4C51.4,62 48.4,59.6 47,56.5Z" fill={`url(#${uid}-bel)`} />
        {/* scale freckles */}
        <g fill="#9cba68" opacity="0.6">
          <circle cx="63" cy="34" r="0.9" />
          <circle cx="66" cy="37" r="0.7" />
          <circle cx="60.5" cy="31.6" r="0.7" />
          <circle cx="66.5" cy="47" r="0.8" />
          <circle cx="69" cy="50" r="0.6" />
        </g>
        {/* nostrils */}
        <path d="M63.2,49.2q1.2,-1 2.4,0M57.4,49.8q1,-0.9 2,0" stroke="#1d2716" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        {/* eyes */}
        {[
          [44.2, 42.4, eyeR * 0.88],
          [59.6, 41.2, eyeR],
        ].map(([cx, cy, r]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r={r + 2.6} fill={`url(#${uid}-acid)`} opacity="0.55" />
            <circle cx={cx} cy={cy} r={r + 0.7} fill="#141b0e" />
            <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-eye)`} />
            <ellipse cx={cx + 0.2} cy={cy + 0.2} rx={pupil} ry={r * 0.7} fill="#0e1408" />
            <circle cx={cx + r * 0.38} cy={cy - r * 0.42} r={r * 0.3} fill="#fffaf0" />
            <circle cx={cx - r * 0.35} cy={cy + r * 0.4} r={r * 0.12} fill="#fffaf0" opacity="0.8" />
          </g>
        ))}
        {/* brow ridges */}
        <path d={`M38.6,${36.4 + browDy * 0.4}Q44,${33.6 - browDy * 0.3} 48.6,${36.2 + browDy}M54.6,${35.4 + browDy}Q60,${32.2 - browDy * 0.3} 65.4,${35 + browDy * 0.4}`} stroke="#1d2716" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* smile + fang + acid drip */}
        <path d={`M49,56.4Q59,${57.6 + smile} 69.4,${54.8 - smile * 0.2}`} stroke="#1d2716" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d={`M55.6,${57.4 + smile * 0.5}l1.2,2.8l1.2,-2.7Z`} fill="#fbf4e2" />
        {alarmed && <ellipse cx="60" cy="58.6" rx="2.6" ry="1.4" fill="#1d2716" />}
        <path d="M49.6,57.2C49.2,59.2 48.4,60.4 48.4,61.6C48.4,62.8 49.4,63.4 50.2,62.6C50.8,62 50.6,60.6 49.6,57.2Z" fill="#c8f060" />
        <circle cx="49.4" cy="61.8" r="2.6" fill={`url(#${uid}-acid)`} opacity="0.6" />
        <Rim uid={uid} d="M51,28.5A17,15 0 0 1 68,43.5A12,8.4 0 0 1 71,53" color="#d9f0a0" op={0.45} w={1.1} />
      </>
    ),
  };
}

function Mika({ uid, mood }) {
  const f = { cx: 50, cy: 50, rx: 10.2, ry: 11.6 };
  const x = exprFor(mood, { blush: 0.38, open: 1.05 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.8, 0.68, 0.4);
  return {
    bg: ['#2b4268', '#0a1220'],
    glow: '#f4a35e',
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#b8826a', '#e6b597', '#f8d6ba'])}
          {lit3(`${uid}-wool`, ['#6e5f46', '#bba984', '#ece0c2'])}
          {lit3(`${uid}-cloak`, ['#4a3e2c', '#7d6a4c', '#a8916a'])}
          {lit3(`${uid}-scarf`, ['#5a1d18', '#8a2f25', '#c0503e'])}
        </defs>
        {/* cloak */}
        <path d={shoulders(74, 0.95)} fill={`url(#${uid}-cloak)`} />
        {/* hood */}
        <path d="M27.5,60C25.6,37 34,21 50,20.4C66,21 74.4,37 72.5,60C72,67 68.6,72.4 64,76.4L36,76.4C31.4,72.4 28,67 27.5,60Z" fill={`url(#${uid}-wool)`} />
        <path d="M30,48Q34,30 47,24.6M33.5,62Q32,44 40,32" stroke="#8a7a5a" strokeWidth="0.6" fill="none" opacity="0.6" />
        <path d="M62,24.8Q70,31 70.6,44" stroke="#fff6e0" strokeWidth="0.8" fill="none" opacity="0.55" />
        {/* hood opening */}
        <ellipse cx="50" cy="50.5" rx="14.2" ry="15.6" fill="#2a1d14" />
        <path d={neck(50, 58, 74, 8)} fill={`url(#${uid}-skin)`} />
        <path d={head} fill={`url(#${uid}-skin)`} />
        {/* pale hair under the hood */}
        <path d="M39.6,46.4C41,40 46.6,38.2 51.6,39C56.4,38.6 60.4,41 60.8,46C58,43.2 54,42.6 50.6,43.6C47,42.8 42.6,43.6 39.6,46.4Z" fill="#d9b56a" />
        <path d="M52,39.2C56.2,39 59.6,41 60.6,44.6C58.6,42.6 55.6,41.4 52.4,41.2Z" fill="#f4dc9c" />
        <path d="M40.2,46.6C39.4,50 39.6,53 40.6,55.6" stroke="#c9a258" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <Features
          f={f}
          x={x}
          o={{ irisEyes: true, iris: '#5a7a96', eyeSep: 5.4, eyeW: 2.9, eyeH: 2.6, eyeDy: 0.6, browGap: 4.4, brow: '#a8834a', browW: 1, lip: '#a0503f', shade: '#a06a54', lit: '#fff0e0', mouthW: 2.5, mouthAt: 0.6, blushK: 0.9 }}
        />
        {/* knit band around the hood opening */}
        <ellipse cx="50" cy="50.5" rx="14.4" ry="15.8" fill="none" stroke="#7a2a20" strokeWidth="3" />
        <ellipse cx="50" cy="50.5" rx="14.4" ry="15.8" fill="none" stroke="#e8dcc0" strokeWidth="1.1" strokeDasharray="1.1 1.6" opacity="0.8" />
        {/* scarf */}
        <path d="M35.6,71.5C42,77 58,77 64.4,71.5L65.6,78C58,82.4 42,82.4 34.4,78Z" fill={`url(#${uid}-scarf)`} />
        <path d="M54.6,78.4L58.4,96L63.6,94L59.6,78Z" fill={`url(#${uid}-scarf)`} />
        <path d="M58.4,96l0.8,2.4M60.4,95.4l0.8,2.4M62.4,94.6l0.8,2.4" stroke="#8a2f25" strokeWidth="0.8" />
        <Rim uid={uid} d={head} color="#ffd9b0" op={0.45} w={1} />
      </>
    ),
  };
}

function Nyra({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 11.6, ry: 15.2 };
  const x = exprFor(mood, { bi: 1, mouth: -0.4, open: 0.9 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.26);
  return {
    bg: ['#4a4f57', '#111214'],
    under: '#e0782b',
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#4a2c1e', '#7d4c33', '#ad7250'])}
          {lit3(`${uid}-jkt`, ['#1b1d21', '#33373d', '#5d636b'])}
          {lit3(`${uid}-brass`, ['#7a5f36', '#b08d57', '#e6c890'])}
        </defs>
        <path d={neck(50, 52, 74, 10)} fill={`url(#${uid}-skin)`} />
        <ellipse cx="50" cy="59" rx="6.4" ry="2.6" fill="#2a1810" opacity="0.6" />
        <path d={shoulders(72)} fill={`url(#${uid}-jkt)`} />
        {/* padded collar with brass studs */}
        <path d="M37.6,66C42,72 58,72 62.4,66L64.6,73.6C58,78.6 42,78.6 35.4,73.6Z" fill="#26292e" />
        <g fill="#d6b47a">
          <circle cx="38.6" cy="72" r="0.7" />
          <circle cx="44" cy="74.6" r="0.7" />
          <circle cx="50" cy="75.4" r="0.7" />
          <circle cx="56" cy="74.6" r="0.7" />
          <circle cx="61.4" cy="72" r="0.7" />
        </g>
        {/* iron pauldron */}
        <path d="M6,94C8,80 18,74 30,73.6L29,83.6C20,84.6 12,88.6 6,94Z" fill="#4a4f57" stroke="#1b1d21" strokeWidth="0.6" />
        <path d="M9,90C14,85 21,82 29,81" stroke="#9aa0a8" strokeWidth="0.6" fill="none" />
        <circle cx="14" cy="85.4" r="0.8" fill="#c3c7cc" />
        <circle cx="22" cy="80" r="0.8" fill="#c3c7cc" />
        {/* harness straps + buckle */}
        <path d="M27,78L68,104M73,78L32,104" stroke="#4a2f1c" strokeWidth="4.2" />
        <path d="M27,78L68,104M73,78L32,104" stroke="#8a6038" strokeWidth="0.45" strokeDasharray="1.2 1" />
        <rect x="46.6" y="86.6" width="6.8" height="5.6" rx="0.8" fill={`url(#${uid}-brass)`} stroke="#3d2f1a" strokeWidth="0.5" />
        <rect x="48.4" y="88.2" width="3.2" height="2.4" fill="#1b1d21" />
        {/* head */}
        <ellipse cx="38.4" cy="45" rx="1.8" ry="3" fill="#4a2c1e" />
        <path d={head} fill={`url(#${uid}-skin)`} />
        <Features f={f} x={x} o={{ shade: '#3a2016', lit: '#e8b088', brow: '#120e0c', lip: '#4a2418', ink: '#0e0a08', eyeW: 2.8, eyeH: 1.6 }} />
        {/* soot smudge */}
        <ellipse cx="57.6" cy="50.4" rx="2.8" ry="1" transform="rotate(-18 57.6 50.4)" fill="#1b1d21" opacity="0.45" />
        {/* cropped hair, undercut */}
        <path d="M38,41C37.4,30.4 42.4,26.4 50,26C58,25.6 63,30 62.4,41L61.4,37C60,32.4 56,30.8 50,30.8C44,30.8 40,32.4 38.9,41Z" fill="#141110" />
        <path d="M43,27.4C47,23 55.4,23 58.8,26.8C54.4,25.6 48.6,25.8 43,27.4Z" fill="#141110" />
        <path d="M38.2,36L38.6,41M61.8,36L61.6,41" stroke="#3a302a" strokeWidth="1.4" opacity="0.7" />
        <path d="M51,25.6C55.6,25.4 59.6,27.6 61,31" stroke="#4a3e36" strokeWidth="0.8" fill="none" />
        {/* comms headset */}
        <circle cx="62" cy="45" r="3.4" fill={`url(#${uid}-brass)`} stroke="#3d2f1a" strokeWidth="0.6" />
        <circle cx="62" cy="45" r="1.4" fill="#33373d" />
        <path d="M61.4,48.2Q60.4,56.4 54.6,57" stroke="#b08d57" strokeWidth="0.9" fill="none" />
        <circle cx="54.2" cy="57" r="0.9" fill="#1b1d21" />
        <Rim uid={uid} d={head} color="#ffcf9a" op={0.55} />
      </>
    ),
  };
}

function Vex({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 12.2, ry: 15.8 };
  const x = exprFor(mood, { mouth: 0.25, open: 0.82 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.28);
  return {
    bg: ['#46505e', '#0f1216'],
    art: (
      <>
        <defs>
          {lit3(`${uid}-skin`, ['#86604e', '#c29a80', '#e2bea2'])}
          {lit3(`${uid}-suit`, ['#2a2e34', '#4b5058', '#737a84'])}
          {lit3(`${uid}-lap`, ['#23272c', '#3c4148', '#646b75'])}
          {lit3(`${uid}-hair`, ['#6e7076', '#a3a6ac', '#e2e3e5'])}
        </defs>
        <path d={neck(50, 52, 74, 10.5)} fill={`url(#${uid}-skin)`} />
        <path d={shoulders(70.5)} fill={`url(#${uid}-suit)`} />
        {/* shirt + tie */}
        <path d="M41.5,69.6L50,92L58.5,69.6Z" fill="#e8e4da" />
        <path d="M41.5,69.6L50,92L46,72Z" fill="#b8b2a6" />
        <path d="M42.6,66.6L50,73L45.6,76.6Z M57.4,66.6L50,73L54.4,76.6Z" fill="#f3efe6" stroke="#9a958c" strokeWidth="0.35" />
        <path d="M47.8,72.6L52.2,72.6L51.3,76.2L48.7,76.2Z" fill="#26292e" />
        <path d="M48.7,76.2L51.3,76.2L53,91L50,94.6L47,91Z" fill="#1b1d21" />
        {/* peaked lapels */}
        <path d="M36.4,70.6L42,69.6L50,93L45,104L39.6,104L35.4,87L29.4,81.4L34.6,79Z" fill={`url(#${uid}-lap)`} />
        <path d="M63.6,70.6L58,69.6L50,93L55,104L60.4,104L64.6,87L70.6,81.4L65.4,79Z" fill={`url(#${uid}-lap)`} />
        <path d="M58,69.6L50,93M65.4,79L70.6,81.4" stroke="#9aa0a8" strokeWidth="0.5" />
        {/* brass gear pin + pocket square */}
        <circle cx="62" cy="84" r="2.3" fill="none" stroke="#d6b47a" strokeWidth="1.3" strokeDasharray="0.9 0.6" />
        <circle cx="62" cy="84" r="0.9" fill="#d6b47a" />
        <path d="M68.6,93.6l2,-3.2l2.4,3.2Z" fill="#c9a227" />
        {/* head */}
        <ellipse cx="37.8" cy="45" rx="1.9" ry="3.1" fill="#86604e" />
        <ellipse cx="62.2" cy="45" rx="1.9" ry="3.1" fill="#d2ac90" />
        <path d={head} fill={`url(#${uid}-skin)`} />
        <Features f={f} x={x} o={{ shade: '#6e4c3c', lit: '#fff0dc', brow: '#8a8d93', lip: '#6a4038', lids: '#7a5444', eyeW: 2.7, eyeH: 1.5, mouthAt: 0.66 }} />
        {/* age lines */}
        <path d="M43,33.6Q50,32.6 57,33.6M44.6,35.6Q50,35 55.4,35.6" stroke="#9a7460" strokeWidth="0.45" fill="none" opacity="0.6" />
        <path d="M60.4,41.6l1.6,-0.8M60.6,43l1.6,0" stroke="#9a7460" strokeWidth="0.4" opacity="0.7" />
        {/* trimmed grey beard + moustache */}
        <path d="M38.6,47C39.4,54.2 43,58.6 50,59.6C57,58.6 60.6,54.2 61.4,47L60.4,47.6C59.8,51.2 57.6,53.8 55,54.2C53.4,52.8 51.6,52.6 50,53C48.4,52.6 46.6,52.8 45,54.2C42.4,53.8 40.2,51.2 39.6,47.6Z" fill={`url(#${uid}-hair)`} />
        <path d="M44.8,51.4C46.8,50 49,50.3 50,50.9C51,50.3 53.2,50 55.2,51.4C53,52.2 51.4,52.1 50,51.8C48.6,52.1 47,52.2 44.8,51.4Z" fill="#8f9298" />
        {/* swept-back silver hair, receding */}
        <path d="M37.6,42C37,31 42,26 50,25.8C58,25.6 63.2,30.6 62.4,42L61.2,39C61,34.6 59.6,32.4 57.6,31.4C55,30.6 52.6,31.8 50,31.2C47.4,31.8 45,30.6 42.4,31.4C40.4,32.4 39,34.6 38.8,39Z" fill={`url(#${uid}-hair)`} />
        <path d="M45,28Q52,26.6 58.6,29.6M47,29.6Q53,28.6 59.6,31.6" stroke="#f3f4f5" strokeWidth="0.5" fill="none" opacity="0.6" />
        <Rim uid={uid} d={head} color="#f0e6d8" op={0.55} />
      </>
    ),
  };
}

function Skaela({ uid, mood }) {
  const grim = mood === 'grim';
  const alarmed = mood === 'alarmed';
  const warm = mood === 'warm';
  const eyeH = alarmed ? 4 : warm ? 2.4 : grim ? 2.2 : 3;
  return {
    bg: ['#2b4268', '#060b14'],
    glow: '#d9e2e8',
    art: (
      <>
        <defs>
          {lit3(`${uid}-fur`, ['#56677a', '#b8c6d1', '#f6f8fa'])}
          {lit3(`${uid}-ruff`, ['#3d4b5c', '#8d9fb0', '#d9e2e8'])}
          <RG id={`${uid}-eye`} stops={[[0, '#fffaf0'], [0.4, '#ffd97a'], [1, '#c9a227']]} />
          <RG id={`${uid}-eg`} stops={[[0, '#ffe9ae', 0.7], [1, '#ffe9ae', 0]]} />
        </defs>
        {/* ruff */}
        <path d="M0,104L4,82L12,86L11,72L20,78L21,64L30,70L33,60L50,64L67,60L70,70L79,64L80,78L89,72L88,86L96,82L100,104Z" fill={`url(#${uid}-ruff)`} />
        {/* head */}
        <path d="M50,86L39,78L30.5,66L25.6,52L25,36L20,9L35,25.6L43,24.4L50,25.6L57,24.4L65,25.6L80,9L75,36L74.4,52L69.5,66L61,78Z" fill={`url(#${uid}-fur)`} />
        <path d="M24.6,13.6L33.4,26.8L28.6,32Z" fill="#4a5a6c" />
        <path d="M75.4,13.6L66.6,26.8L71.4,32Z" fill="#8d9aaa" />
        {/* notched right ear */}
        <path d="M76.6,14.6l-2.6,2.4l2.2,1.2Z" fill="#0b1424" />
        {/* cheek tufts */}
        <path d="M25.6,52L19,56L25.4,58.4L21,63.4L29,64ZM74.4,52L81,56L74.6,58.4L79,63.4L71,64Z" fill={`url(#${uid}-fur)`} />
        {/* blaze + muzzle */}
        <path d="M50,32L44.4,44L45.6,62L50,72L54.4,62L55.6,44Z" fill="#f6f8fa" opacity="0.8" />
        <path d="M41.6,60C42.6,71 46.6,78.4 50,79.4C53.4,78.4 57.4,71 58.4,60C55.6,63 52.8,64 50,64C47.2,64 44.4,63 41.6,60Z" fill="#e6ecf0" />
        <path d="M45.6,69C45.6,66.8 54.4,66.8 54.4,69C54.4,71 51.8,73.2 50,73.2C48.2,73.2 45.6,71 45.6,69Z" fill="#0b1424" />
        <path d="M48,67.6q2,-0.8 4,0" stroke="#7c8fa0" strokeWidth="0.6" fill="none" />
        <path d="M50,73.2V75.6M50,75.6C48.2,77.4 45.6,77.4 44,75.8M50,75.6C51.8,77.4 54.4,77.4 56,75.8" stroke="#0b1424" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        {grim && (
          <g>
            <path d="M43.4,76.4C46,79.4 54,79.4 56.6,76.4L55.2,80C52.6,81.6 47.4,81.6 44.8,80Z" fill="#2a1418" />
            <path d="M45.6,77.4l0.8,2.6l0.9,-2.4ZM54.4,77.4l-0.8,2.6l-0.9,-2.4Z" fill="#f6f8fa" />
            <path d="M44,58.6q2.4,2 4,1.2M56,58.6q-2.4,2 -4,1.2" stroke="#56677a" strokeWidth="0.7" fill="none" />
          </g>
        )}
        {/* eyes */}
        <circle cx="40.5" cy="49.6" r="5" fill={`url(#${uid}-eg)`} />
        <circle cx="59.5" cy="49.6" r="5" fill={`url(#${uid}-eg)`} />
        <path d={`M35.8,${48.4 - eyeH * 0.2}L44.6,49.8L40.4,${49.8 + eyeH}Z`} fill={`url(#${uid}-eye)`} stroke="#0b1424" strokeWidth="0.9" strokeLinejoin="round" />
        <path d={`M64.2,${48.4 - eyeH * 0.2}L55.4,49.8L59.6,${49.8 + eyeH}Z`} fill={`url(#${uid}-eye)`} stroke="#0b1424" strokeWidth="0.9" strokeLinejoin="round" />
        <ellipse cx="41" cy={49.8 + eyeH * 0.3} rx="0.6" ry={eyeH * 0.42} fill="#0b1424" />
        <ellipse cx="59" cy={49.8 + eyeH * 0.3} rx="0.6" ry={eyeH * 0.42} fill="#0b1424" />
        {/* brow fur */}
        <path d={`M34.6,${45 + (grim ? 1.2 : alarmed ? -1 : 0)}L45,${46.4 + (grim ? 1.6 : 0)}M65.4,${45 + (grim ? 1.2 : alarmed ? -1 : 0)}L55,${46.4 + (grim ? 1.6 : 0)}`} stroke="#56677a" strokeWidth="1.3" strokeLinecap="round" />
        {/* claw scars across her right eye */}
        <g strokeLinecap="round">
          <path d="M55.4,37.6L63.6,58.6M59,36.6L67,56M62.6,36.8L69.4,52.6" stroke="#7a5a66" strokeWidth="1.5" />
          <path d="M55.9,37.4L64.1,58.4M59.5,36.4L67.5,55.8M63.1,36.6L69.9,52.4" stroke="#fffaf0" strokeWidth="0.45" opacity="0.8" />
        </g>
        {/* ice diadem */}
        <path d="M42.6,30.6L44,24.6L45.6,30.2ZM48.4,28.6L50,20.6L51.6,28.6ZM54.4,30.2L56,24.6L57.4,30.6Z" fill="#eef2f5" stroke="#7c8fa0" strokeWidth="0.4" />
        <circle cx="50" cy="22.6" r="0.9" fill="#fffaf0" />
        <Rim uid={uid} d="M50,25.6L57,24.4L65,25.6L80,9L75,36L74.4,52L69.5,66L61,78" color="#fffaf0" op={0.5} w={1} />
      </>
    ),
  };
}

function Sovereign({ uid }) {
  const f = { cx: 50, cy: 45, rx: 12.2, ry: 15.4 };
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.28);
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI * 2) / 16;
    const len = i % 2 ? 34 : 44;
    const w = 0.05;
    return `M50,40L${r1(50 + Math.cos(a - w) * len)},${r1(40 + Math.sin(a - w) * len)}L${r1(50 + Math.cos(a + w) * len)},${r1(40 + Math.sin(a + w) * len)}Z`;
  }).join('');
  return {
    bg: ['#6e5414', '#0a1220'],
    glow: '#ffe9ae',
    art: (
      <>
        <defs>
          <LG id={`${uid}-face`} x2={1} y2={0.1} stops={[[0, '#0e0b10'], [0.55, '#241c20'], [0.82, '#6b4a24'], [1, '#e3c463']]} />
          {lit3(`${uid}-mantle`, ['#0b1424', '#1f3150', '#3d5683'])}
          <LG id={`${uid}-gold`} x2={0.6} y2={1} stops={[[0, '#fff4d6'], [0.35, '#e3c463'], [1, '#7d6114']]} />
          <RG id={`${uid}-bloom`} stops={[[0, '#fff4d6', 0.75], [0.4, '#ffe9ae', 0.28], [1, '#e3c463', 0]]} />
        </defs>
        <path d={rays} fill="#ffe9ae" opacity="0.16" />
        <circle cx="50" cy="40" r="27" fill="none" stroke="#e3c463" strokeWidth="0.7" opacity="0.4" />
        <circle cx="50" cy="40" r="24.6" fill="none" stroke="#e3c463" strokeWidth="0.5" strokeDasharray="1 1.8" opacity="0.4" />
        <circle cx="50" cy="26" r="18" fill={`url(#${uid}-bloom)`} />
        <path d={neck(50, 54, 74, 10.5)} fill="#151116" />
        <path d={shoulders(69)} fill={`url(#${uid}-mantle)`} />
        {/* ermine collar */}
        <path d="M28.6,76C35,69 44,66.6 50,66.6C56,66.6 65,69 71.4,76L73.6,83C65,79 56,77.8 50,77.8C44,77.8 35,79 26.4,83Z" fill="#e8dfc8" />
        <path d="M71.4,76L73.6,83C69,81 64,79.6 59,78.8" fill="none" stroke="#fffaf0" strokeWidth="0.8" opacity="0.8" />
        <g fill="#1b1d21">
          <path d="M35,74.6l0.7,2.4l0.7,-2.4Z" />
          <path d="M43,71.6l0.7,2.4l0.7,-2.4Z" />
          <path d="M57,71.6l0.7,2.4l0.7,-2.4Z" />
          <path d="M65,74.6l0.7,2.4l0.7,-2.4Z" />
          <path d="M50,70.4l0.7,2.4l0.7,-2.4Z" />
        </g>
        {/* chain of office */}
        <path d="M33,85Q50,99 67,85" stroke="#e3c463" strokeWidth="1.5" strokeDasharray="1.6 0.9" fill="none" />
        <circle cx="50" cy="93" r="3.8" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.5" />
        <circle cx="50" cy="93" r="1.4" fill="#9e2b25" />
        {/* face held in shadow, caught by gold light */}
        <path d={head} fill={`url(#${uid}-face)`} />
        <path d="M60.6,40Q62,47 59.6,54" stroke="#ffe9ae" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M51,45L51.8,52.6" stroke="#e3c463" strokeWidth="0.7" opacity="0.6" />
        <ellipse cx="44.6" cy="45.2" rx="1.6" ry="0.7" fill="#e3c463" opacity="0.35" />
        <ellipse cx="55.6" cy="45.2" rx="1.7" ry="0.75" fill="#ffe9ae" opacity="0.85" />
        <Rim uid={uid} d={head} color="#ffe9ae" op={0.9} w={1.5} />
        {/* crown */}
        <ellipse cx="50" cy="34" rx="15" ry="3" fill="#0b0a0e" opacity="0.6" />
        <path d="M35.4,33.4L36.8,19.6L42.4,26L46,15.8L50,23.6L54,15.8L57.6,26L63.2,19.6L64.6,33.4Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.7" strokeLinejoin="round" />
        <rect x="34.8" y="30.6" width="30.4" height="4.6" rx="1" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.7" />
        <path d="M50,26.4l1.8,2.6l-1.8,2.6l-1.8,-2.6Z" fill="#9e2b25" />
        <circle cx="42" cy="32.9" r="0.9" fill="#1f3150" />
        <circle cx="58" cy="32.9" r="0.9" fill="#1f3150" />
        <g fill="#fffaf0">
          <circle cx="36.8" cy="19" r="1.2" />
          <circle cx="46" cy="15.2" r="1.2" />
          <circle cx="54" cy="15.2" r="1.2" />
          <circle cx="63.2" cy="19" r="1.2" />
        </g>
      </>
    ),
  };
}

function Hooded({ uid, palette, quill = false, face = true }) {
  const [robeShade, robe, robeLit, inner, trim] = palette;
  return (
    <>
      <defs>
        {lit3(`${uid}-robe`, [robeShade, robe, robeLit])}
        {lit3(`${uid}-chin`, ['#2a1a10', '#6b4a32', '#b48662'])}
        {lit3(`${uid}-vane`, ['#a39167', '#e8dfc8', '#fbf8f0'])}
      </defs>
      <path d="M22,104C20,84 24,60 29,45C32.6,29 41,20 50,20C59,20 67.4,29 71,45C76,60 80,84 78,104Z" fill={`url(#${uid}-robe)`} />
      <path d="M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63C60.6,69 56,71 50,71C44,71 39.4,69 36.6,63Z" fill={inner} />
      {face && (
        <>
          <path d="M41,56C42,63.4 46,67.6 50,68C54,67.6 58,63.4 59,56C56,59.2 53,60.2 50,60.2C47,60.2 44,59.2 41,56Z" fill={`url(#${uid}-chin)`} opacity="0.9" />
          <path d="M47.4,63.2Q50,64 52.6,63.2" stroke="#2a1410" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <circle cx="45" cy="50" r="2.7" fill="none" stroke="#c9a227" strokeWidth="0.7" opacity="0.65" />
          <circle cx="55.2" cy="50" r="2.7" fill="none" stroke="#e3c463" strokeWidth="0.8" opacity="0.85" />
          <path d="M47.7,50h4.8" stroke="#a8841b" strokeWidth="0.6" opacity="0.7" />
          <circle cx="56.4" cy="49" r="0.8" fill="#fff4d6" />
        </>
      )}
      <path d="M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63" stroke={trim} strokeWidth="1.1" fill="none" opacity="0.85" />
      <path d="M66,30C70,40 72,52 73,66" stroke={robeLit} strokeWidth="0.8" fill="none" opacity="0.5" />
      {quill && (
        <g>
          <path d="M87,21C80.6,30 73,48 66.4,76.6L65.2,76.2C69,56 75.4,36.4 87,21Z" fill={`url(#${uid}-vane)`} />
          <path d="M87,21C83.4,34 77,55 66.6,76.4" stroke="#7d6114" strokeWidth="0.55" fill="none" />
          <path d="M84,29l-4.6,2.6M81.4,36l-4.6,2.4M78.8,43l-4.4,2.4M76.4,50.2l-4,2.2M74,57.6l-3.6,2" stroke="#a39167" strokeWidth="0.45" />
          <path d="M66.4,76.4L64.4,85.6L65.6,85.8L67.6,76.8Z" fill="#e3c463" />
          <path d="M58,84C60,80 66,79 70,81.6L69.4,89C65,90.4 60,89.4 58,84Z" fill={`url(#${uid}-chin)`} />
          <path d="M55,88C58,84 66,84 73,86.4L74,96L54,97Z" fill={robeShade} />
        </g>
      )}
    </>
  );
}

function Chronicler({ uid }) {
  return {
    bg: ['#6a4720', '#140d07'],
    glow: '#f4a35e',
    art: <Hooded uid={uid} palette={['#3b2a1a', '#6e5236', '#a07a52', '#140d08', '#c9a227']} quill />,
  };
}

function Unknown({ uid }) {
  return {
    bg: ['#2b3446', '#0b1424'],
    art: <Hooded uid={uid} palette={['#1c2029', '#383d48', '#6b6f78', '#07090d', '#4a4f5a']} face={false} />,
  };
}

const CHARACTERS = {
  mara: Mara,
  vale: Vale,
  cassian: Cassian,
  sparky: Sparky,
  mika: Mika,
  nyra: Nyra,
  vex: Vex,
  skaela: Skaela,
  sovereign: Sovereign,
  chronicler: Chronicler,
};

export const PORTRAIT_IDS = Object.keys(CHARACTERS);

const NAMES = {
  mara: 'General Mara Voss',
  vale: 'Dr. Elias Vale',
  cassian: 'Director Cassian Rey',
  sparky: 'Sparky the acid drake',
  mika: 'Mika',
  nyra: 'Lieutenant Nyra Kell',
  vex: 'Chancellor Adrian Vex',
  skaela: 'Warg Queen Skaela',
  sovereign: 'The Sovereign',
  chronicler: 'The Chronicler',
};

// ---------------------------------------------------------------- component
function PortraitImpl({ id, size = 64, mood = 'neutral', label, className = '', style, ring = true }) {
  const uid = useUid('pt');
  const key = String(id ?? '').toLowerCase();
  const Char = CHARACTERS[key] || Unknown;
  const m = MOOD_TINT[mood] !== undefined ? mood : 'neutral';
  const { bg, art, glow, under } = Char({ uid, mood: m });
  const tint = MOOD_TINT[m];
  const aria = label === true ? NAMES[key] || 'Unknown figure' : label;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flex: 'none', ...style }}
      role={aria ? 'img' : undefined}
      aria-label={aria || undefined}
      aria-hidden={aria ? undefined : true}
      focusable="false"
      data-portrait={CHARACTERS[key] ? key : 'unknown'}
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="45.2" />
        </clipPath>
        <clipPath id={`${uid}-rim`}>
          <rect x="55" y="0" width="45" height="100" />
        </clipPath>
        <RG id={`${uid}-bg`} cx="66%" cy="26%" r="80%" stops={[[0, bg[0]], [1, bg[1]]]} />
        <RG id={`${uid}-glow`} cx="50%" cy="50%" r="50%" stops={[[0, glow || '#ffe9ae', 0.32], [1, glow || '#ffe9ae', 0]]} />
        <RG id={`${uid}-under`} cx="50%" cy="50%" r="50%" stops={[[0, under || '#e0782b', 0.42], [1, under || '#e0782b', 0]]} />
        <RG id={`${uid}-vig`} cx="58%" cy="40%" r="62%" stops={[[0.6, '#04070d', 0], [1, '#04070d', 0.72]]} />
        <LG id={`${uid}-ring`} x1={0.85} y1={0} x2={0.15} y2={1} stops={[[0, '#fbefc2'], [0.3, '#e3c463'], [0.62, '#a8841b'], [0.85, '#7d6114'], [1, '#c9a227']]} />
        {tint && <RG id={`${uid}-mood`} cx={m === 'warm' ? '75%' : '30%'} cy={m === 'warm' ? '20%' : '85%'} r="90%" stops={[[0, tint.color, tint.op * 1.6], [1, tint.color, tint.op * 0.4]]} />}
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-bg)`} />
        <circle cx="50" cy="44" r="31" fill="none" stroke="#e3c463" strokeWidth="0.6" opacity="0.14" />
        <circle cx="50" cy="44" r="27.5" fill="none" stroke="#e3c463" strokeWidth="0.4" strokeDasharray="0.8 2.4" opacity="0.18" />
        <circle cx="68" cy="24" r="34" fill={`url(#${uid}-glow)`} />
        {under && <circle cx="30" cy="100" r="44" fill={`url(#${uid}-under)`} />}
        {art}
        {tint && <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-mood)`} style={{ mixBlendMode: 'multiply' }} />}
        {m === 'warm' && <circle cx="72" cy="22" r="40" fill={`url(#${uid}-glow)`} opacity="0.6" />}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-vig)`} />
      </g>
      {ring && (
        <g fill="none">
          <circle cx="50" cy="50" r="47.6" stroke="#2a2008" strokeWidth="1.4" />
          <circle cx="50" cy="50" r="46.9" stroke={`url(#${uid}-ring)`} strokeWidth="3.6" />
          <circle cx="50" cy="50" r="45.3" stroke="#fff4d6" strokeWidth="0.45" opacity="0.45" />
          <circle cx="50" cy="50" r="44.9" stroke="#0b1424" strokeWidth="0.8" opacity="0.9" />
          <path d="M50,94.8l2.6,2.6l-2.6,2.6l-2.6,-2.6Z" fill="#e3c463" stroke="#4f3d0d" strokeWidth="0.5" />
        </g>
      )}
    </svg>
  );
}

export const Portrait = memo(PortraitImpl);
export default Portrait;
