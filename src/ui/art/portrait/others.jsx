// Sparky, Queen Skaela, the Sovereign and the hooded figures (the Chronicler and
// the unknown silhouette). Same light rig as the people: key light upper right, an
// ember bounce from below left, soft painted masses rather than hard vector shapes.
import { r1 } from '../util.js';
import { Bounce, ClothShade, Hair, LG, Lit3, Metal, RG, Rim } from './kit.jsx';
import { headPath, locks, shoulders, strands } from './geometry.js';

// ---------------------------------------------------------------- Sparky
export function Sparky({ uid, mood }) {
  const alarmed = mood === 'alarmed';
  const grim = mood === 'grim';
  const warm = mood === 'warm';
  const eyeR = alarmed ? 5 : grim ? 4.3 : 4.7;
  const pupil = alarmed ? 0.55 : grim ? 0.8 : 1;
  const lid = grim ? 0.42 : alarmed ? 0 : warm ? 0.26 : 0.1; // upper lid cover, fraction of the eye
  const browDy = grim ? 1.8 : alarmed ? -1.6 : 0;
  const smile = warm ? 3.4 : grim ? 0.4 : alarmed ? -0.4 : 2.2;
  const neckD = 'M17,104C19,88 28,74 40,66L64,68C68,80 72,92 76,104Z';
  const cranium = 'M34,43.5A17,15 0 1 1 68,43.5A17,15 0 1 1 34,43.5Z';
  const snout = 'M47,53A12,8.4 0 1 1 71,53A12,8.4 0 1 1 47,53Z';
  const belly = 'M44,70C48,82 53,93 56,104L68,104C64,92 60,80 57,69Z';
  // a folded wing rising behind the near shoulder, kept inside the frame
  const wing = 'M30,78C26,70 22,62 20.6,52C24,55 26,56.4 28,56.6C26.6,50 26.8,44 28.6,38.6C31,44 33.4,48 36,50.4L38,66Z';
  const plates = [75.5, 81.5, 87.6, 93.6, 99.6];
  return {
    bg: ['#4a5a34', '#070a06'],
    glow: '#d4f57a',
    focus: 46,
    halo: 0.38,
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-sc`} c={['#24301a', '#4b6236', '#8fae62']} />
          <LG id={`${uid}-bel`} x1={0} y1={0} x2={1} y2={0.15} stops={[[0, '#6e5e38'], [0.3, '#b8a670'], [0.66, '#f0e4b8'], [0.86, '#d6c48a'], [1, '#7a6a40']]} />
          <LG id={`${uid}-horn`} x1={0} y1={1} x2={1} y2={0} stops={[[0, '#6e6250'], [0.4, '#c9bc9a'], [0.8, '#f0e8d2'], [1, '#fbf4e2']]} />
          <LG id={`${uid}-wing`} x1={0} y1={0} x2={1} y2={1} stops={[[0, '#3d4f2a'], [0.6, '#22301a'], [1, '#141b0e']]} />
          <RG id={`${uid}-eye`} cx="42%" cy="38%" r="62%" stops={[[0, '#f6ffd0'], [0.3, '#d4f57a'], [0.7, '#6f9a1e'], [1, '#2e4210']]} />
          <RG id={`${uid}-ball`} cx="50%" cy="50%" r="50%" stops={[[0.6, '#000', 0], [1, '#000', 0.55]]} />
          <RG id={`${uid}-acid`} stops={[[0, '#d4f57a', 0.85], [1, '#b4e83f', 0]]} />
          <RG id={`${uid}-hdsh`} cx="22%" cy="60%" r="60%" stops={[[0, '#0e1408', 0.6], [1, '#0e1408', 0]]} />
          <RG id={`${uid}-hdlt`} stops={[[0, '#e6f7b8', 0.4], [1, '#e6f7b8', 0]]} />
          <pattern id={`${uid}-scales`} width="3.2" height="2.6" patternUnits="userSpaceOnUse">
            <path d="M0,2.6A1.6,1.6 0 0 1 3.2,2.6M-1.6,1.3A1.6,1.6 0 0 1 1.6,1.3M1.6,1.3A1.6,1.6 0 0 1 4.8,1.3" fill="none" stroke="#1b2614" strokeWidth="0.35" />
            <path d="M0.4,2.3A1.3,1.3 0 0 1 2,1.5" fill="none" stroke="#b4d07c" strokeWidth="0.25" />
          </pattern>
          <clipPath id={`${uid}-hd`}>
            <path d={cranium} />
            <path d={snout} />
          </clipPath>
          <clipPath id={`${uid}-nkc`}>
            <path d={neckD} />
          </clipPath>
          <clipPath id={`${uid}-wc`}>
            <path d={wing} />
          </clipPath>
        </defs>
        {/* folded membrane wing behind the shoulder, finger bones and a lit leading edge */}
        <path d={wing} fill={`url(#${uid}-wing)`} />
        <g clipPath={`url(#${uid}-wc)`} fill="none" strokeLinecap="round">
          <path d="M37,66L20.6,52M37,66L28.6,38.6M37,64L28,56.6" stroke="#5f7e46" strokeWidth="1" />
          <path d="M37,66L28.6,38.6" stroke="#b4d07c" strokeWidth="0.35" opacity="0.6" transform="translate(0.6 0)" />
          <path d="M21,53Q27,62 33,70" stroke="#0e1408" strokeWidth="2.4" opacity="0.35" />
        </g>
        <path d="M28.6,38.6C31,44 33.4,48 36,50.4" stroke="#b4d07c" strokeWidth="0.5" fill="none" opacity="0.7" />
        {/* neck: scales only where the light falls, deep shade on the far side */}
        <path d={neckD} fill={`url(#${uid}-sc)`} />
        <g clipPath={`url(#${uid}-nkc)`}>
          <rect x="0" y="60" width="100" height="44" fill={`url(#${uid}-scales)`} opacity="0.55" mask={`url(#${uid}-rim)`} />
          <ellipse cx="22" cy="98" rx="20" ry="26" fill={`url(#${uid}-hdsh)`} />
          <ellipse cx="50" cy="69" rx="16" ry="6" fill="#070a06" opacity="0.4" />
        </g>
        {/* belly plates: a cylinder of overlapping bands, each with a lit top edge */}
        <path d={belly} fill={`url(#${uid}-bel)`} />
        {plates.map((y, i) => (
          <g key={y}>
            <path d={`M${45.6 + i * 2.4},${y}l${11.8 + i * 0.2},-1.6`} stroke="#5a4a28" strokeWidth="1" />
            <path d={`M${46 + i * 2.4},${y + 0.8}l${11.6 + i * 0.2},-1.6`} stroke="#fff4d6" strokeWidth="0.35" opacity="0.55" />
          </g>
        ))}
        <path d="M24,84l-4.4,-2.2l3.2,-2.8ZM28,76l-4.4,-2.6l3.6,-2.6ZM33,69.6l-3.8,-3l4,-2Z" fill="#26321b" />
        <path d="M19.6,81.8l3.2,-2.8M23.6,73.4l3.6,-2.6M29.2,66.6l4,-2" stroke="#86a35a" strokeWidth="0.3" opacity="0.6" />
        {/* frills */}
        <path d="M35.5,40L22.5,33L27,40L20.5,44.5L29.5,46.5L35,49Z" fill="#26321b" />
        <path d="M68,38L80.5,30.5L77.5,38L84,41.5L75,45.5L68.6,46.6Z" fill="#5f7e46" />
        <path d="M35.5,40L22.5,33M35.5,42L20.5,44.5M68,38L80.5,30.5M68.4,42L84,41.5" stroke="#9cba68" strokeWidth="0.45" opacity="0.6" />
        {/* horns with growth rings */}
        <path d="M41.5,31.5C37.5,25 35.6,20.5 36.6,15.5C39.8,19.6 43.8,24.6 46.4,29.5Z" fill={`url(#${uid}-horn)`} />
        <path d="M58.4,30C61.4,23 64.2,19.6 67.8,17.2C67.2,22.6 64.6,27.8 62.4,32Z" fill={`url(#${uid}-horn)`} />
        <path d="M38.6,24.6l3.8,-1.4M40.4,27.6l3.8,-1.4M37.4,21l3,-1.6M60.4,26.4l3.4,1.4M62.2,23.2l3,1.4M64.2,20.4l2.6,1.4" stroke="#8a7d63" strokeWidth="0.4" />
        {/* head: cranium + round snout, modelled with soft pools of shade and light */}
        <path d={cranium} fill={`url(#${uid}-sc)`} />
        <path d={snout} fill={`url(#${uid}-sc)`} />
        <g clipPath={`url(#${uid}-hd)`}>
          <rect x="30" y="26" width="44" height="40" fill={`url(#${uid}-scales)`} opacity="0.45" mask={`url(#${uid}-rim)`} />
          <ellipse cx="34" cy="48" rx="12" ry="20" fill={`url(#${uid}-hdsh)`} />
          <ellipse cx="62" cy="31" rx="11" ry="5.5" fill={`url(#${uid}-hdlt)`} />
          <ellipse cx="66" cy="50" rx="7" ry="3.6" fill={`url(#${uid}-hdlt)`} />
          <ellipse cx="51" cy="35" rx="12" ry="4.6" fill={`url(#${uid}-hdsh)`} opacity="0.6" />
        </g>
        <Bounce uid={uid} d={cranium} op={0.28} />
        <path d="M47,56.5C52,60.6 62,61.6 70,55.6C68,60.6 62,62.8 56,62.4C51.4,62 48.4,59.6 47,56.5Z" fill={`url(#${uid}-bel)`} />
        {/* scale freckles catching light */}
        <g fill="#b4d07c" opacity="0.7">
          <circle cx="63" cy="34" r="0.9" />
          <circle cx="66" cy="37" r="0.7" />
          <circle cx="60.5" cy="31.6" r="0.7" />
          <circle cx="66.5" cy="47" r="0.8" />
          <circle cx="69" cy="50" r="0.6" />
        </g>
        {/* nostrils */}
        <path d="M63.2,49.2q1.2,-1 2.4,0M57.4,49.8q1,-0.9 2,0" stroke="#0e1408" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* eyes: wet glass spheres in deep sockets, lidded from above */}
        {[
          [44.2, 42.4, eyeR * 0.88, 0.75],
          [59.6, 41.2, eyeR, 1],
        ].map(([cx, cy, r, lit]) => {
          const ec = `${uid}-e${Math.round(cx)}`;
          return (
            <g key={cx}>
              <circle cx={cx} cy={cy} r={r + 2.8} fill={`url(#${uid}-acid)`} opacity={0.4 * lit} />
              <circle cx={cx} cy={cy} r={r + 1} fill="#0b1008" />
              <clipPath id={ec}>
                <circle cx={cx} cy={cy} r={r} />
              </clipPath>
              <g clipPath={`url(#${ec})`}>
                <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-eye)`} />
                <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke="#2e4210" strokeWidth="0.3" opacity="0.5" />
                <ellipse cx={cx + 0.2} cy={cy + 0.2} rx={pupil} ry={r * 0.72} fill="#070a05" />
                <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-ball)`} />
                {/* the upper lid and its shadow on the eyeball */}
                <rect x={cx - r} y={cy - r} width={r * 2} height={r * (0.25 + lid * 2)} fill="#3a4e28" />
                <ellipse cx={cx} cy={cy - r + r * (0.25 + lid * 2)} rx={r} ry={r * 0.32} fill="#0b1008" opacity="0.5" />
              </g>
              <path d={`M${r1(cx - r * 0.95)},${r1(cy - r + r * (0.25 + lid * 2))}Q${cx},${r1(cy - r + r * (0.25 + lid * 2) + r * 0.3)} ${r1(cx + r * 0.95)},${r1(cy - r + r * (0.25 + lid * 2))}`} stroke="#0b1008" strokeWidth="0.7" fill="none" />
              <path d={`M${r1(cx - r * 0.7)},${r1(cy + r * 0.82)}Q${cx},${r1(cy + r * 1.12)} ${r1(cx + r * 0.75)},${r1(cy + r * 0.78)}`} stroke="#b4d07c" strokeWidth="0.4" fill="none" opacity={0.6 * lit} />
              {/* wet catchlights: a soft window and a pin of light */}
              <ellipse cx={cx + r * 0.36} cy={cy - r * 0.05 + lid * r} rx={r * 0.32} ry={r * 0.22} fill="#fffaf0" opacity="0.35" />
              <circle cx={cx + r * 0.4} cy={cy - r * 0.08 + lid * r} r={r * 0.13} fill="#fffaf0" />
              <circle cx={cx - r * 0.35} cy={cy + r * 0.48} r={r * 0.08} fill="#fffaf0" opacity="0.7" />
            </g>
          );
        })}
        {/* brow ridges */}
        <path d={`M38.6,${36.4 + browDy * 0.4}Q44,${33.6 - browDy * 0.3} 48.6,${36.2 + browDy}M54.6,${35.4 + browDy}Q60,${32.2 - browDy * 0.3} 65.4,${35 + browDy * 0.4}`} stroke="#0e1408" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d={`M55.4,${34.6 + browDy}Q60,${31.6 - browDy * 0.3} 65,${34.2 + browDy * 0.4}`} stroke="#b4d07c" strokeWidth="0.45" fill="none" strokeLinecap="round" opacity="0.7" />
        {/* smile + fang + acid drip */}
        <path d={`M49,56.4Q59,${57.6 + smile} 69.4,${54.8 - smile * 0.2}`} stroke="#0e1408" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d={`M55.6,${57.4 + smile * 0.5}l1.2,2.8l1.2,-2.7Z`} fill="#fbf4e2" />
        <path d={`M63.6,${57.2 + smile * 0.35}l0.9,2l0.9,-2Z`} fill="#e0d4b6" />
        {alarmed && <ellipse cx="60" cy="58.6" rx="2.6" ry="1.4" fill="#0e1408" />}
        <path d="M49.6,57.2C49.2,59.2 48.4,60.4 48.4,61.6C48.4,62.8 49.4,63.4 50.2,62.6C50.8,62 50.6,60.6 49.6,57.2Z" fill="#c8f060" />
        <circle cx="49.9" cy="61.4" r="0.4" fill="#fffaf0" />
        <circle cx="49.4" cy="61.8" r="2.8" fill={`url(#${uid}-acid)`} opacity="0.55" />
        <Rim uid={uid} d="M51,28.5A17,15 0 0 1 68,43.5A12,8.4 0 0 1 71,53" color="#e6f7b8" op={0.55} w={1.1} />
        <Rim uid={uid} d="M64,68C68,80 72,92 76,104" color="#e6f7b8" op={0.4} w={1} />
      </>
    ),
  };
}

// ---------------------------------------------------------------- Skaela
export function Skaela({ uid, mood }) {
  const grim = mood === 'grim';
  const alarmed = mood === 'alarmed';
  const warm = mood === 'warm';
  const eyeH = alarmed ? 3.4 : warm ? 2.1 : grim ? 1.8 : 2.6;
  const brow = grim ? 1.4 : alarmed ? -1.3 : warm ? -0.4 : 0;
  // fur values capped at #d8dde6 so she never outshines the faces around her
  const fur = ['#1e2a38', '#5a6a7e', '#a6b2c2', '#d8dde6'];
  const skull =
    'M50,27C59,27 65.4,30 68.8,35.6C72.4,41.6 73.4,48.6 71.4,55C69.6,61 65,65.6 60,69.6C57,75.6 53.6,79.6 50,80C46.4,79.6 43,75.6 40,69.6C35,65.6 30.4,61 28.6,55C26.6,48.6 27.6,41.6 31.2,35.6C34.6,30 41,27 50,27Z';
  // a broken silhouette: tufts on the cheeks, the crown and the brow
  const tufts =
    locks({ x: 33, y: 57, a0: Math.PI * 0.55, a1: Math.PI * 1.1, n: 5, rIn: 2, rOut: 12, w: 0.36, bend: -0.35, seed: 61 }) +
    locks({ x: 67, y: 57, a0: -Math.PI * 0.1, a1: Math.PI * 0.45, n: 5, rIn: 2, rOut: 12, w: 0.36, bend: 0.35, seed: 62 }) +
    locks({ x: 50, y: 40, a0: -Math.PI * 0.72, a1: -Math.PI * 0.28, n: 5, rIn: 10, rOut: 16, w: 0.16, bend: 0.2, seed: 63 });
  const earL = 'M32.4,37C29.6,30.4 28.2,24 29.2,18C33.6,20 38,24.4 41.6,29.6Z';
  const earR = 'M67.6,37C70.4,30.4 71.8,24 70.8,18C66.4,20 62,24.4 58.4,29.6Z';
  const ruffCore = 'M8,104C10,88 18,76 30,70C38,74 44,77 50,77.6C56,77 62,74 70,70C82,76 90,88 92,104Z';
  const ruff =
    ruffCore +
    locks({ x: 50, y: 66, a0: -Math.PI * 0.02, a1: Math.PI * 1.02, n: 16, rIn: 14, rOut: 30, w: 0.15, bend: 0.12, seed: 41, jitter: 0.12 }) +
    locks({ x: 50, y: 74, a0: Math.PI * 0.2, a1: Math.PI * 0.8, n: 9, rIn: 4, rOut: 18, w: 0.16, bend: 0.1, seed: 43 });
  const [fd, fl] = strands({ x: 50, y: 58, a0: -Math.PI * 1.05, a1: Math.PI * 0.05, rIn: 14, rOut: 30, n: 40, seed: 31, curl: 1.6, jitter: 0.2 });
  return {
    bg: ['#2b4268', '#04080f'],
    zoom: 1.02,
    focus: 46,
    glow: '#c3ccd8',
    halo: 0.3,
    art: (
      <>
        <defs>
          <RG id={`${uid}-eye`} cx="40%" cy="38%" r="60%" stops={[[0, '#fff4d6'], [0.3, '#ffd97a'], [0.8, '#c9a227'], [1, '#7d6114']]} />
          <RG id={`${uid}-eg`} stops={[[0, '#ffe9ae', 0.55], [1, '#ffe9ae', 0]]} />
          <RG id={`${uid}-sd`} stops={[[0, '#141e2a', 0.85], [0.6, '#141e2a', 0.45], [1, '#141e2a', 0]]} />
          <RG id={`${uid}-lt`} stops={[[0, '#d8dde6', 0.7], [0.6, '#d8dde6', 0.3], [1, '#d8dde6', 0]]} />
          <LG id={`${uid}-muz`} x1={0} x2={1} y1={0} y2={0.3} stops={[[0, '#7c8a9c'], [0.45, '#b6c0cd'], [1, '#d8dde6']]} />
          <LG id={`${uid}-ice`} x1={0.1} y1={1} x2={0.9} y2={0} stops={[[0, '#56677a'], [0.5, '#b8c6d1'], [1, '#e6ecf0']]} />
          <clipPath id={`${uid}-hdc`}>
            <path d={skull} />
          </clipPath>
        </defs>
        {/* ruff: a mane of clumped fur over the shoulders */}
        <Hair
          uid={uid}
          name="rf"
          d={ruff}
          tones={['#1e2a38', '#56677a', '#9aa8b8', '#c3ccd8']}
          fan={{ x: 50, y: 118, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 18, rOut: 56, n: 50, seed: 41, curl: 1.4, jitter: 0.15 }}
          sheen="M70,74Q82,78 90,92"
          sheenW={3}
          w={0.45}
          so={0.6}
        />
        <ellipse cx="22" cy="96" rx="20" ry="18" fill={`url(#${uid}-sd)`} />
        <ellipse cx="50" cy="80" rx="16" ry="6" fill={`url(#${uid}-sd)`} />
        {/* the head, tilted a little: she is weighing you */}
        <g transform="rotate(-5 50 60)">
          {/* ears, inside the frame, with tufted inner fur */}
          <Hair uid={uid} name="el" d={earL} tones={fur} />
          <Hair uid={uid} name="er" d={earR} tones={fur} />
          <path d="M31.6,33.4C30.4,29 29.8,24.6 30.4,20.6C33.4,22.6 36.4,25.8 38.6,29.4Z" fill="#26323f" />
          <path d="M68.4,33.4C69.6,29 70.2,24.6 69.6,20.6C66.6,22.6 63.6,25.8 61.4,29.4Z" fill="#4a5668" />
          <path d="M32,32Q32.6,27 31.6,22.6M34.6,30.6Q34,27 32.8,24M68,32Q67.4,27 68.4,22.6M65.4,30.6Q66,27 67.2,24" stroke="#a6b2c2" strokeWidth="0.35" fill="none" opacity="0.7" />
          {/* notched right ear */}
          <path d="M70.9,22.4l-2.4,1.6l2,1.4Z" fill="#04080f" />
          {/* skull and cheek tufts as one soft mass */}
          <Hair uid={uid} name="tf" d={tufts} tones={fur} />
          <Hair uid={uid} name="hd" d={skull} tones={fur} />
          <g clipPath={`url(#${uid}-hdc)`}>
            {/* soft planes: the far side in shadow, a lit brow and cheek, sockets, the muzzle's shadow */}
            <ellipse cx="27" cy="52" rx="15" ry="34" fill={`url(#${uid}-sd)`} />
            <ellipse cx="62" cy="36" rx="12" ry="8" fill={`url(#${uid}-lt)`} />
            <ellipse cx="66" cy="60" rx="7" ry="9" fill={`url(#${uid}-lt)`} opacity="0.6" />
            <ellipse cx="41" cy="72" rx="7" ry="9" fill={`url(#${uid}-sd)`} />
            <ellipse cx="40.5" cy="49.5" rx="8" ry="6" fill={`url(#${uid}-sd)`} />
            <ellipse cx="59.5" cy="49.5" rx="7" ry="5" fill={`url(#${uid}-sd)`} opacity="0.7" />
            <g fill="none" strokeLinecap="round">
              <path d={fd} stroke="#2b3a4c" strokeWidth="0.45" opacity="0.45" />
              <path d={fl} stroke="#d8dde6" strokeWidth="0.3" opacity="0.4" />
            </g>
          </g>
          <Bounce uid={uid} d={skull} color="#a8786a" op={0.22} />
          {/* blaze and muzzle */}
          <path d="M50,32C47.6,38 45,44 45.4,52C45.8,58 47.4,64 50,70C52.6,64 54.2,58 54.6,52C55,44 52.4,38 50,32Z" fill="#c3ccd8" opacity="0.35" />
          <path d="M41.6,60C42.6,71 46.6,78.4 50,79.4C53.4,78.4 57.4,71 58.4,60C55.6,63 52.8,64 50,64C47.2,64 44.4,63 41.6,60Z" fill={`url(#${uid}-muz)`} />
          <path d="M41.6,60C42.6,71 46.6,78.4 50,79.4C48,74 46.6,66 47.4,63.6C45.4,63.2 43.4,62 41.6,60Z" fill="#56677a" opacity="0.45" />
          {/* whisker pads */}
          <g fill="#3d4b5c" opacity="0.7">
            <circle cx="45" cy="70.4" r="0.35" />
            <circle cx="46.4" cy="72" r="0.35" />
            <circle cx="44.6" cy="72.8" r="0.35" />
            <circle cx="55" cy="70.4" r="0.35" />
            <circle cx="53.6" cy="72" r="0.35" />
            <circle cx="55.4" cy="72.8" r="0.35" />
          </g>
          {/* nose: wet leather with a highlight */}
          <path d="M45.4,68.8C45.4,66.4 54.6,66.4 54.6,68.8C54.6,71 51.9,73.4 50,73.4C48.1,73.4 45.4,71 45.4,68.8Z" fill="#070d18" />
          <path d="M47.6,69.8q1,-0.6 1.8,0.2M52.4,69.8q-1,-0.6 -1.8,0.2" stroke="#2b3a4c" strokeWidth="0.6" fill="none" />
          <ellipse cx="52" cy="67.6" rx="1.6" ry="0.6" fill="#d8dde6" opacity="0.7" />
          <path d="M50,73.4V75.6M50,75.6C48.2,77.4 45.6,77.4 44,75.8M50,75.6C51.8,77.4 54.4,77.4 56,75.8" stroke="#070d18" strokeWidth="0.95" fill="none" strokeLinecap="round" />
          {grim && (
            <g>
              <path d="M43.4,76.4C46,79.4 54,79.4 56.6,76.4L55.2,80C52.6,81.6 47.4,81.6 44.8,80Z" fill="#2a1418" />
              <path d="M45.6,77.4l0.8,2.6l0.9,-2.4ZM54.4,77.4l-0.8,2.6l-0.9,-2.4Z" fill="#e6ecf0" />
              <path d="M44,58.6q2.4,2 4,1.2M56,58.6q-2.4,2 -4,1.2" stroke="#3d4b5c" strokeWidth="0.7" fill="none" />
            </g>
          )}
          {warm && <path d="M44,76.2Q50,78.6 56,76.2" stroke="#3d4b5c" strokeWidth="0.5" fill="none" opacity="0.7" />}
          {/* eyes: amber glass, slanted, rimmed in dark fur, lidded from above */}
          {[
            [40.6, -1],
            [59.4, 1],
          ].map(([ex, s]) => {
            const ec = `${uid}-ey${s}`;
            const d = `M${ex - s * 4.6},${49.6 - 0.6}Q${ex - s * 0.6},${49.6 - eyeH * 1.05} ${ex + s * 4.2},${49.2 - eyeH * 0.3}Q${ex + s * 0.4},${49.6 + eyeH * 0.9} ${ex - s * 4.6},${49.6 - 0.6}Z`;
            return (
              <g key={s}>
                <circle cx={ex} cy="49.4" r="5.6" fill={`url(#${uid}-eg)`} opacity={s === 1 ? 0.8 : 0.5} />
                <clipPath id={ec}>
                  <path d={d} />
                </clipPath>
                <path d={d} fill={`url(#${uid}-eye)`} />
                <g clipPath={`url(#${ec})`}>
                  <ellipse cx={ex + s * 0.2} cy="49.4" rx={alarmed ? 0.6 : 0.95} ry={eyeH * 0.55} fill="#070d18" />
                  <ellipse cx={ex} cy={49.6 - eyeH * 0.9} rx="5" ry={eyeH * 0.5} fill="#3d2f1a" opacity="0.55" />
                </g>
                <path d={d} fill="none" stroke="#070d18" strokeWidth="0.9" strokeLinejoin="round" />
                <circle cx={ex + 1.1} cy={49.2 - eyeH * 0.15} r="0.5" fill="#fffaf0" opacity={s === 1 ? 0.95 : 0.7} />
              </g>
            );
          })}
          {/* brow fur */}
          <path d={`M34.6,${45 + brow * 0.6}L45,${46.6 + brow}M65.4,${45 + brow * 0.6}L55,${46.6 + brow}`} stroke="#2b3a4c" strokeWidth="1.6" strokeLinecap="round" />
          <path d={`M64.8,${44.4 + brow * 0.6}L56,${45.8 + brow}`} stroke="#d8dde6" strokeWidth="0.4" strokeLinecap="round" opacity="0.7" />
          {/* old claw scars cut into the fur across her right eye: a dark groove, a pale healed lip */}
          <g strokeLinecap="round" fill="none">
            <path d="M55.6,37.8Q60,47 63.4,58.4M59.2,36.8Q63.2,45.4 66.6,56M62.8,37Q66,44.4 69,52.4" stroke="#141e2a" strokeWidth="0.95" opacity="0.6" />
            <path d="M55.6,37.8Q60,47 63.4,58.4M59.2,36.8Q63.2,45.4 66.6,56M62.8,37Q66,44.4 69,52.4" stroke="#6a4a58" strokeWidth="0.45" opacity="0.6" />
            <path d="M56.2,37.6Q60.6,46.8 64,58.2M59.8,36.6Q63.8,45.2 67.2,55.8M63.4,36.8Q66.6,44.2 69.6,52.2" stroke="#d8dde6" strokeWidth="0.35" opacity="0.75" />
            {/* fur parting around the scars */}
            <path d="M57.4,42l-1.4,-0.6M61,40.6l-1.2,-0.8M59.6,49.4l-1.6,-0.2M64.6,47.6l-1.4,-0.4" stroke="#2b3a4c" strokeWidth="0.35" opacity="0.6" />
          </g>
          {/* ice diadem: faceted crystals */}
          <path d="M41,31.4Q50,27.4 59,31.4" stroke="#56677a" strokeWidth="0.9" fill="none" />
          <path d="M42.6,30.6L44,24.4L45.6,30.2ZM48.2,28.8L50,20.6L51.8,28.8ZM54.4,30.2L56,24.4L57.4,30.6Z" fill={`url(#${uid}-ice)`} stroke="#3d4b5c" strokeWidth="0.35" />
          <path d="M42.6,30.6L44,24.4L44.2,30.4ZM48.2,28.8L50,20.6L50.2,28.8ZM54.4,30.2L56,24.4L56.2,30.4Z" fill="#3d4b5c" opacity="0.45" />
          <circle cx="50.3" cy="22.6" r="0.55" fill="#fffaf0" />
          <Rim uid={uid} d="M50,27C59,27 65.4,30 68.8,35.6C72.4,41.6 73.4,48.6 71.4,55C69.6,61 65,65.6 60,69.6" color="#e6ecf0" op={0.55} w={1} />
          <Rim uid={uid} d={earR} color="#e6ecf0" op={0.45} w={0.8} />
        </g>
      </>
    ),
  };
}

// ---------------------------------------------------------------- Sovereign
export function Sovereign({ uid }) {
  // the Sovereign wears a gilded mask: modelled as metal, with planes and a hard specular
  const f = { cx: 50, cy: 45, rx: 12.2, ry: 15.4 };
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.28);
  // ten soft, tapered beams through a fading gradient instead of a clip-art sunburst
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI * 2) / 10 + 0.31;
    const len = i % 2 ? 36 : 46;
    const w = 0.11;
    return `M50,40L${r1(50 + Math.cos(a - w) * len)},${r1(40 + Math.sin(a - w) * len)}Q${r1(50 + Math.cos(a) * len * 1.06)},${r1(40 + Math.sin(a) * len * 1.06)} ${r1(50 + Math.cos(a + w) * len)},${r1(40 + Math.sin(a + w) * len)}Z`;
  }).join('');
  const mantle = shoulders(69);
  const ermine = 'M28.6,76C35,69 44,66.6 50,66.6C56,66.6 65,69 71.4,76L73.6,83C65,79 56,77.8 50,77.8C44,77.8 35,79 26.4,83Z';
  const ermineFur = ermine + locks({ x: 50, y: 52, a0: Math.PI * 0.25, a1: Math.PI * 0.75, n: 14, rIn: 24.6, rOut: 29, w: 0.07, bend: 0.03, seed: 71, jitter: 0.06 });
  const tails = [
    [36, 77.6],
    [43.4, 76.2],
    [50.6, 75.8],
    [57.6, 76.4],
    [64.6, 78],
    [31, 80.6],
    [69.6, 81],
  ];
  return {
    bg: ['#6e5414', '#070d18'],
    glow: '#ffe9ae',
    zoom: 1.04,
    focus: 40,
    halo: 0.36,
    art: (
      <g transform="translate(0 5)">
        <defs>
          <LG id={`${uid}-mask`} x2={1} y2={0.15} stops={[[0, '#2a2008'], [0.3, '#5e4a18'], [0.62, '#a8841b'], [0.84, '#e3c463'], [1, '#fff4d6']]} />
          <Lit3 id={`${uid}-mantle`} c={['#070d18', '#1f3150', '#45639a']} />
          <LG id={`${uid}-erm`} x1={0} y1={0} x2={1} y2={0.3} stops={[[0, '#8a7d63'], [0.4, '#d6ccb0'], [0.8, '#efe8d6'], [1, '#d8d2c0']]} />
          <Metal id={`${uid}-gold`} />
          <Metal id={`${uid}-gold2`} x1={0.1} y1={0} x2={0.9} y2={1} />
          <RG id={`${uid}-ray`} cx="50" cy="40" r="46" units="userSpaceOnUse" stops={[[0, '#ffe9ae', 0.5], [0.4, '#ffe9ae', 0.2], [1, '#ffe9ae', 0]]} />
          <RG id={`${uid}-bloom`} stops={[[0, '#fff4d6', 0.7], [0.4, '#ffe9ae', 0.26], [1, '#e3c463', 0]]} />
          <RG id={`${uid}-gem`} cx="35%" cy="30%" r="70%" stops={[[0, '#f9c99a'], [0.3, '#c2413a'], [1, '#4a0f0c']]} />
          <RG id={`${uid}-sap`} cx="35%" cy="30%" r="70%" stops={[[0, '#b8c6d1'], [0.35, '#2b4268'], [1, '#070d18']]} />
          <RG id={`${uid}-ember`} stops={[[0, '#ffd97a', 0.9], [0.5, '#e0782b', 0.4], [1, '#e0782b', 0]]} />
          <clipPath id={`${uid}-fc`}>
            <path d={head} />
          </clipPath>
        </defs>
        <path d={rays} fill={`url(#${uid}-ray)`} />
        <circle cx="50" cy="40" r="27" fill="none" stroke="#e3c463" strokeWidth="0.6" opacity="0.32" />
        <circle cx="50" cy="26" r="20" fill={`url(#${uid}-bloom)`} />
        <path d="M44.75,54L55.25,54L56.5,74L43.5,74Z" fill="#1e171b" />
        <path d="M53,56L56.5,74L54,74Z" fill="#5e4020" opacity="0.6" />
        {/* velvet mantle */}
        <path d={mantle} fill={`url(#${uid}-mantle)`} />
        <ClothShade uid={uid} name="m" d={mantle} neckY={70} folds="M24,90Q26,97 23,104M33,88Q36,96 34,104M67,88Q64,96 66,104M76,90Q74,97 77,104" />
        <path d="M6,104C8,94 12,88 18,84M94,104C92,94 88,88 82,84" stroke={`url(#${uid}-gold)`} strokeWidth="1.2" fill="none" />
        {/* ermine: soft clumps of white fur with black tail tips */}
        <Hair uid={uid} name="er" d={ermineFur} tones={['#7a6e56', '#c2b89c', '#e6dfcc', '#efe8d6']} fan={{ x: 50, y: 50, a0: Math.PI * 0.18, a1: Math.PI * 0.82, rIn: 18, rOut: 32, n: 36, seed: 72, curl: 0.8 }} w={0.3} so={0.6} />
        <path d="M28.6,76C35,69 44,66.6 50,66.6C44,68 36,72 30,79Z" fill="#7a6e56" opacity="0.4" />
        <path d="M71.4,76L73.6,83C69,81 64,79.6 59,78.8" fill="none" stroke="#efe8d6" strokeWidth="0.9" opacity="0.6" />
        {tails.map(([tx, ty]) => (
          <path key={tx} d={`M${tx},${ty}c0.9,0.7 1.1,2.4 0,3.4c-1.1,-1 -0.9,-2.7 0,-3.4Z`} fill="#141518" />
        ))}
        {/* chain of office: linked plates and a jewelled medallion */}
        <path d="M33,85Q50,99 67,85" stroke="#4f3d0d" strokeWidth="2.2" fill="none" />
        <path d="M33,85Q50,99 67,85" stroke={`url(#${uid}-gold2)`} strokeWidth="1.6" strokeDasharray="1.8 0.7" fill="none" />
        <path d="M34,84.6Q50,97.6 66,84.6" stroke="#fffaf0" strokeWidth="0.35" strokeDasharray="0.6 1.9" fill="none" opacity="0.8" />
        <circle cx="50" cy="93" r="4.4" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.5" />
        <circle cx="50" cy="93" r="1.8" fill={`url(#${uid}-gem)`} />
        <circle cx="50.6" cy="92.3" r="0.45" fill="#fffaf0" />
        {/* the gilded mask: brow ridge, nose plane, cheek planes, a hard specular on the lit side */}
        <path d={head} fill={`url(#${uid}-mask)`} />
        <g clipPath={`url(#${uid}-fc)`}>
          <path d="M37,30L63,30L63,38Q50,35.4 37,38Z" fill="#2a2008" opacity="0.55" />
          <path d="M38,40.4Q44,38.4 49.4,40.6L49,43Q44,41.6 38.4,43Z" fill="#7d6114" opacity="0.6" />
          <path d="M51,40.6Q56,38.4 62,40.4L61.6,43Q56,41.6 51.2,43Z" fill="#f0dc95" opacity="0.65" />
          {/* nose: a lit right plane and a shadowed left plane meeting at a hard ridge */}
          <path d="M50,42L50.6,54.6L47,54.4Z" fill="#3d2f0a" opacity="0.7" />
          <path d="M50,42L53.4,54L50.6,54.6Z" fill="#fff4d6" opacity="0.55" />
          {/* cheek planes and the jaw */}
          <path d="M38,48L46,50.6L44.6,58L39.4,55Z" fill="#2a2008" opacity="0.45" />
          <path d="M62,48L54,50.6L55.4,58L60.6,55Z" fill="#fff4d6" opacity="0.28" />
          <path d="M42,60Q50,66 58,60L57,64Q50,62.2 43,64Z" fill="#2a2008" opacity="0.45" />
          <path d="M44.6,58.6Q50,60 55.4,58.6" stroke="#2a2008" strokeWidth="0.8" fill="none" />
          <ellipse cx="58.6" cy="47.4" rx="1.4" ry="3.2" fill="#fffaf0" opacity="0.6" />
          <circle cx="58.8" cy="46.2" r="0.6" fill="#fffaf0" />
        </g>
        <path d="M60.6,40Q62,47 59.6,54" stroke="#ffe9ae" strokeWidth="0.7" fill="none" opacity="0.7" />
        {/* eyes: slits in the gold with an ember light behind them */}
        <circle cx="44.4" cy="45.4" r="2.6" fill={`url(#${uid}-ember)`} opacity="0.55" />
        <circle cx="55.6" cy="45.4" r="2.8" fill={`url(#${uid}-ember)`} opacity="0.8" />
        <path d="M41.6,45.6Q44.4,44 47.2,45.6Q44.4,46.6 41.6,45.6Z" fill="#140b04" />
        <path d="M52.8,45.6Q55.6,44 58.4,45.6Q55.6,46.6 52.8,45.6Z" fill="#140b04" />
        <ellipse cx="55.8" cy="45.4" rx="0.8" ry="0.35" fill="#ffd97a" />
        <ellipse cx="44.4" cy="45.4" rx="0.6" ry="0.3" fill="#e0782b" opacity="0.8" />
        <Rim uid={uid} d={head} color="#ffe9ae" op={0.8} w={1.3} />
        {/* crown, with air above it inside the frame */}
        <ellipse cx="50" cy="34" rx="15" ry="3" fill="#050407" opacity="0.6" />
        <path d="M35.4,33.4L36.8,20.6L42.4,26.4L46,17.4L50,24L54,17.4L57.6,26.4L63.2,20.6L64.6,33.4Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M50,24L54,17.4L57.6,26.4L63.2,20.6L64.6,33.4L50,33.4Z" fill="#fff4d6" opacity="0.18" />
        <path d="M36.8,20.6L38.4,30M46,17.4L47,29.6M54,17.4L53.4,29.6M63.2,20.6L61.8,30" stroke="#7d6114" strokeWidth="0.35" opacity="0.7" />
        <rect x="34.8" y="30.6" width="30.4" height="4.6" rx="1" fill={`url(#${uid}-gold2)`} stroke="#4f3d0d" strokeWidth="0.7" />
        <path d="M35.6,31.4H64.4" stroke="#fffaf0" strokeWidth="0.35" opacity="0.7" />
        <path d="M50,26.4l2,2.6l-2,2.6l-2,-2.6Z" fill={`url(#${uid}-gem)`} stroke="#4f3d0d" strokeWidth="0.3" />
        <circle cx="50.5" cy="28" r="0.35" fill="#fffaf0" />
        <circle cx="42" cy="32.9" r="1.05" fill={`url(#${uid}-sap)`} />
        <circle cx="58" cy="32.9" r="1.05" fill={`url(#${uid}-sap)`} />
        <g fill="#fff4d6">
          <circle cx="36.8" cy="20.2" r="1.05" />
          <circle cx="46" cy="17" r="1.05" />
          <circle cx="54" cy="17" r="1.05" />
          <circle cx="63.2" cy="20.2" r="1.05" />
        </g>
        <circle cx="54.3" cy="16.7" r="0.4" fill="#fffaf0" />
      </g>
    ),
  };
}

// ---------------------------------------------------------------- hooded figures
function Hooded({ uid, palette, quill = false, face = true, ember = false }) {
  const [robeShade, robe, robeLit, inner, trim] = palette;
  // a hood with a soft peak that tips to one side
  const robeD = 'M22,104C20,84 24,60 29,45C32,32 39,23.4 47,20.4C49.4,19.4 51.6,17.8 53.6,15.6C54.6,18.2 56.6,20.6 59.4,22.6C65.4,27.6 69.2,35.4 71,45C76,60 80,84 78,104Z';
  const hollow = 'M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63C60.6,69 56,71 50,71C44,71 39.4,69 36.6,63Z';
  return (
    <>
      <defs>
        <Lit3 id={`${uid}-chin`} c={['#2a1a10', '#6b4a32', '#b48662']} />
        <Lit3 id={`${uid}-vane`} c={['#a39167', '#e8dfc8', '#fbf8f0']} />
        <LG id={`${uid}-hand`} x1={0} y1={0.3} x2={1} y2={0} stops={[[0, '#4a2c1e'], [0.5, '#8a5e44'], [1, '#c8946e']]} />
        <RG id={`${uid}-hol`} cx="55%" cy="72%" r="72%" stops={[[0, inner, 0.55], [0.55, inner], [1, '#020305']]} />
        <RG id={`${uid}-emb`} stops={[[0, '#ffd97a', 0.9], [0.4, '#e0782b', 0.45], [1, '#e0782b', 0]]} />
        <LG id={`${uid}-fold`} x1={0} y1={0} x2={1} y2={0} stops={[[0, robeShade, 0], [0.5, robeShade, 0.6], [1, robeShade, 0]]} />
        <LG id={`${uid}-foldL`} x1={0} y1={0} x2={1} y2={0} stops={[[0, robeLit, 0], [0.5, robeLit, 0.32], [1, robeLit, 0]]} />
        <Metal id={`${uid}-gold`} />
      </defs>
      <Hair
        uid={uid}
        name="rb"
        d={robeD}
        tones={[robeShade, robe, robeLit, robeLit]}
        fan={{ x: 50, y: 6, a0: Math.PI * 0.36, a1: Math.PI * 0.64, rIn: 62, rOut: 104, n: 8, seed: 51, curl: 2, jitter: 0.1 }}
        w={0.6}
        so={0.4}
        sheen="M62,28Q71,40 74,62"
        sheenW={3}
        sheenOp={0.4}
      />
      <ClothShade uid={uid} name="rb2" d={robeD} neckY={70} light={robeLit} />
      {/* broad fold planes falling from the shoulders */}
      <g>
        <path d="M27,104C27,90 29.4,78 34,70L40,72C35.6,80 33.6,92 34,104Z" fill={`url(#${uid}-fold)`} />
        <path d="M44,104C43,92 43.6,82 45.6,74L51,74C49.4,82 49,92 50,104Z" fill={`url(#${uid}-fold)`} />
        <path d="M58,104C58.6,92 58,82 56,73L61.6,71C64,80 65,92 64.6,104Z" fill={`url(#${uid}-foldL)`} />
        <path d="M68,104C68.6,90 67,78 63.6,68L66.4,64C71,74 73.4,88 73.4,104Z" fill={`url(#${uid}-fold)`} />
        <path d="M54,15.6C51,24 46,30 40,34" stroke={robeShade} strokeWidth="1.4" fill="none" opacity="0.45" />
      </g>
      <path d={hollow} fill={`url(#${uid}-hol)`} />
      {ember && (
        <>
          {/* nothing to see in there but a faint ember light where eyes should be */}
          <circle cx="45.6" cy="51" r="2" fill={`url(#${uid}-emb)`} opacity="0.55" />
          <circle cx="54.4" cy="51" r="2.2" fill={`url(#${uid}-emb)`} opacity="0.7" />
          <circle cx="54.6" cy="50.9" r="0.35" fill="#ffd97a" />
        </>
      )}
      {face && (
        <>
          <path d="M41,56C42,63.4 46,67.6 50,68C54,67.6 58,63.4 59,56C56,59.2 53,60.2 50,60.2C47,60.2 44,59.2 41,56Z" fill={`url(#${uid}-chin)`} opacity="0.9" />
          <path d="M53,60C56,59.4 58,57.6 59,56C58.4,61 56,65 53,67Z" fill="#d9a27e" opacity="0.4" />
          <path d="M47.4,63.2Q50,64 52.6,63.2" stroke="#2a1410" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <path d="M44,60.4Q45,64 47.6,66" stroke="#1b110a" strokeWidth="0.4" fill="none" opacity="0.6" />
          {/* spectacles: brass rims, lenses catching the light */}
          <circle cx="45" cy="50" r="2.8" fill="#e3c463" opacity="0.08" />
          <circle cx="55.2" cy="50" r="2.8" fill="#ffe9ae" opacity="0.2" />
          <circle cx="45" cy="50" r="2.8" fill="none" stroke="#a8841b" strokeWidth="0.75" opacity="0.7" />
          <circle cx="55.2" cy="50" r="2.8" fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="0.85" />
          <path d="M47.8,50Q50.1,49 52.4,50" stroke="#a8841b" strokeWidth="0.6" fill="none" opacity="0.8" />
          <path d="M53.6,48.4A2,2 0 0 1 56.8,48.6" stroke="#fffaf0" strokeWidth="0.45" fill="none" strokeLinecap="round" />
          <circle cx="56.4" cy="49" r="0.6" fill="#fffaf0" />
          <circle cx="44.6" cy="50.4" r="0.45" fill="#e3c463" opacity="0.6" />
          <circle cx="55" cy="50.4" r="0.5" fill="#ffe9ae" opacity="0.9" />
        </>
      )}
      {/* hood rim with embroidered trim */}
      <path d="M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63" stroke="#000" strokeOpacity="0.4" strokeWidth="2.4" fill="none" />
      <path d="M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63" stroke={trim} strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63" stroke={robeLit} strokeWidth="0.4" strokeDasharray="0.6 1.2" fill="none" opacity="0.7" transform="translate(0.9 0)" />
      <Rim uid={uid} d={robeD} color={robeLit} op={0.7} w={1.1} />
      <Bounce uid={uid} d={robeD} op={0.35} />
      {quill && (
        <g>
          {/* the quill held across the chest, its vane rising to the right of the hood */}
          <path d="M72.6,52.4C67,58.6 58.6,68 46.4,80.6L45.6,79.8C56,67 64,57.4 72.6,52.4Z" fill={`url(#${uid}-vane)`} />
          <path d="M72.6,52.4C72.4,56 69,61 63.4,67.4L58.6,72C62.6,65 67,58 72.6,52.4Z" fill="#e8dfc8" opacity="0.7" />
          <path d="M72.6,52.4C65.4,60 56.4,70 46,80.2" stroke="#7d6114" strokeWidth="0.5" fill="none" />
          <path d="M69,56.6l-3.4,1.2M65.8,60.2l-3.4,1.2M62.6,64l-3.2,1.2M59.4,67.6l-3,1.1M70.4,57.4l0.8,-2.4M67.2,61l1,-2.4M64,64.8l1,-2.2" stroke="#a39167" strokeWidth="0.35" />
          <path d="M71.4,54.4C66,60 59,67.6 51,76" stroke="#fffaf0" strokeWidth="0.3" fill="none" opacity="0.8" />
          <path d="M46.2,80.4L41.4,86.6L42,87.2L47,81.2Z" fill={`url(#${uid}-gold)`} />
          {/* the writing hand: knuckles lit from the right, a trimmed cuff */}
          <path d="M38.6,80.4C40.6,77.4 45.6,76.8 48.6,78.6C50.4,79.8 50.4,82.4 49,84.2C47,86.6 42.6,87.4 39.8,85.8C38,84.6 37.6,82 38.6,80.4Z" fill={`url(#${uid}-hand)`} />
          <path d="M41,79Q42.6,78 44.2,78.6M44.4,78.4Q46,77.8 47.4,78.8M46.8,79.6Q48.4,79.6 49.2,81" stroke="#e6b597" strokeWidth="0.55" fill="none" strokeLinecap="round" opacity="0.8" />
          <path d="M41.4,81.6Q43.6,80.6 45.6,81.6M45.6,82.2Q47.4,81.8 48.6,83" stroke="#3a2214" strokeWidth="0.4" fill="none" opacity="0.6" />
          <path d="M30.6,92C31.6,86.6 35.4,82.6 39.6,82.4L41.4,87.4C38,88.4 35.6,91 35,94.6Z" fill={robeShade} />
          <path d="M39.6,82.4L41.4,87.4" stroke={trim} strokeWidth="1" />
          <path d="M39.9,82.6L41.6,87.2" stroke="#fff4d6" strokeWidth="0.3" opacity="0.6" />
        </g>
      )}
    </>
  );
}

export function Chronicler({ uid }) {
  return {
    bg: ['#6a4720', '#0e0905'],
    glow: '#f4a35e',
    focus: 50,
    art: <Hooded uid={uid} palette={['#2a1c10', '#6e5236', '#b08a5e', '#140d08', '#c9a227']} quill />,
  };
}

export function Unknown({ uid }) {
  return {
    bg: ['#2b3446', '#070d18'],
    glow: '#8f929a',
    focus: 50,
    art: <Hooded uid={uid} palette={['#141820', '#3e4450', '#7a7f8a', '#1a1f28', '#4a4f5a']} face={false} ember />,
  };
}
