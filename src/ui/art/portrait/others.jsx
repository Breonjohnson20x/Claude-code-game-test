// Sparky, Queen Skaela, the Sovereign and the hooded figures (the Chronicler and
// the unknown silhouette). Same light rig as the people: key light upper right.
import { r1 } from '../util.js';
import { ClothShade, Diag3, Hair, LG, Lit3, Metal, RG, Rim } from './kit.jsx';
import { headPath, shoulders, strands } from './geometry.js';

// ---------------------------------------------------------------- Sparky
export function Sparky({ uid, mood }) {
  const alarmed = mood === 'alarmed';
  const grim = mood === 'grim';
  const warm = mood === 'warm';
  const eyeR = alarmed ? 5.2 : grim ? 4.3 : 4.8;
  const pupil = alarmed ? 0.7 : grim ? 0.9 : 1.15;
  const browDy = grim ? 1.8 : alarmed ? -1.4 : 0;
  const smile = warm ? 3.4 : grim ? 0.6 : alarmed ? -0.4 : 2.2;
  const neckD = 'M17,104C19,88 28,74 40,66L64,68C68,80 72,92 76,104Z';
  const cranium = 'M34,43.5A17,15 0 1 1 68,43.5A17,15 0 1 1 34,43.5Z';
  const snout = 'M47,53A12,8.4 0 1 1 71,53A12,8.4 0 1 1 47,53Z';
  return {
    bg: ['#3d4a2b', '#070a06'],
    glow: '#d4f57a',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-sc`} c={['#1b2414', '#4b6236', '#8fae62']} />
          <Lit3 id={`${uid}-bel`} c={['#7a6a40', '#d6c48a', '#f6ecc4']} />
          <LG id={`${uid}-horn`} x1={0} y1={1} x2={1} y2={0} stops={[[0, '#6e6250'], [0.4, '#c9bc9a'], [0.8, '#fbf4e2'], [1, '#fffaf0']]} />
          <LG id={`${uid}-wing`} x1={0} y1={0} x2={1} y2={1} stops={[[0, '#2f3d22'], [1, '#141b0e']]} />
          <RG id={`${uid}-eye`} cx="40%" cy="35%" r="65%" stops={[[0, '#f6ffd0'], [0.35, '#d4f57a'], [0.75, '#6f9a1e'], [1, '#2e4210']]} />
          <RG id={`${uid}-acid`} stops={[[0, '#d4f57a', 0.85], [1, '#b4e83f', 0]]} />
          <pattern id={`${uid}-scales`} width="3.2" height="2.6" patternUnits="userSpaceOnUse">
            <path d="M0,2.6A1.6,1.6 0 0 1 3.2,2.6M-1.6,1.3A1.6,1.6 0 0 1 1.6,1.3M1.6,1.3A1.6,1.6 0 0 1 4.8,1.3" fill="none" stroke="#0e1408" strokeWidth="0.35" />
          </pattern>
          <clipPath id={`${uid}-hd`}>
            <path d={cranium} />
            <path d={snout} />
          </clipPath>
          <clipPath id={`${uid}-nkc`}>
            <path d={neckD} />
          </clipPath>
        </defs>
        {/* membrane wing behind */}
        <path d="M24,80L5,57L13,61L9.5,46L19,56.5L21.5,43L29,62Z" fill={`url(#${uid}-wing)`} />
        <path d="M24,80L5,57M24,80L9.5,46M24,80L21.5,43" stroke="#4b6236" strokeWidth="0.8" />
        <path d="M5,57L13,61L9.5,46L19,56.5L21.5,43" stroke="#86a35a" strokeWidth="0.4" fill="none" opacity="0.6" />
        {/* neck with belly plates */}
        <path d={neckD} fill={`url(#${uid}-sc)`} />
        <g clipPath={`url(#${uid}-nkc)`}>
          <rect x="0" y="60" width="100" height="44" fill={`url(#${uid}-scales)`} opacity="0.45" />
          <g filter={`url(#${uid}-soft2)`}>
            <ellipse cx="22" cy="98" rx="14" ry="20" fill="#070a06" opacity="0.6" />
            <ellipse cx="50" cy="70" rx="14" ry="5" fill="#070a06" opacity="0.55" />
          </g>
        </g>
        <path d="M44,70C48,82 53,93 56,104L68,104C64,92 60,80 57,69Z" fill={`url(#${uid}-bel)`} />
        <path d="M45.6,75.5l11.8,-1.6M47.8,81.5l12.2,-1.8M50.2,87.6l12.4,-1.8M52.6,93.6l12.6,-1.8M55,99.6l12.6,-1.8" stroke="#7a6a40" strokeWidth="0.8" />
        <path d="M46,76.3l11.6,-1.6M48.2,82.3l12,-1.8M50.6,88.4l12.2,-1.8M53,94.4l12.4,-1.8" stroke="#fffaf0" strokeWidth="0.3" opacity="0.6" />
        <path d="M24,84l-4.4,-2.2l3.2,-2.8ZM28,76l-4.4,-2.6l3.6,-2.6ZM33,69.6l-3.8,-3l4,-2Z" fill="#2f3d22" stroke="#86a35a" strokeWidth="0.3" />
        {/* frills */}
        <path d="M35.5,40L22.5,33L27,40L20.5,44.5L29.5,46.5L35,49Z" fill="#26321b" />
        <path d="M68,38L80.5,30.5L77.5,38L84,41.5L75,45.5L68.6,46.6Z" fill="#5f7e46" />
        <path d="M35.5,40L22.5,33M35.5,42L20.5,44.5M68,38L80.5,30.5M68.4,42L84,41.5" stroke="#9cba68" strokeWidth="0.45" opacity="0.6" />
        {/* horns with growth rings */}
        <path d="M41.5,31.5C37.5,25 35.6,20.5 36.6,15.5C39.8,19.6 43.8,24.6 46.4,29.5Z" fill={`url(#${uid}-horn)`} />
        <path d="M58.4,30C61.4,23 64.2,19.6 67.8,17.2C67.2,22.6 64.6,27.8 62.4,32Z" fill={`url(#${uid}-horn)`} />
        <path d="M38.6,24.6l3.8,-1.4M40.4,27.6l3.8,-1.4M37.4,21l3,-1.6M60.4,26.4l3.4,1.4M62.2,23.2l3,1.4M64.2,20.4l2.6,1.4" stroke="#8a7d63" strokeWidth="0.4" />
        {/* head: cranium + round snout, scaled and shaded */}
        <path d={cranium} fill={`url(#${uid}-sc)`} />
        <path d={snout} fill={`url(#${uid}-sc)`} />
        <g clipPath={`url(#${uid}-hd)`}>
          <rect x="30" y="26" width="44" height="40" fill={`url(#${uid}-scales)`} opacity="0.35" />
          <g filter={`url(#${uid}-soft)`}>
            <ellipse cx="34" cy="48" rx="8" ry="16" fill="#0e1408" opacity="0.6" />
            <ellipse cx="62" cy="31" rx="9" ry="4" fill="#d4f57a" opacity="0.3" />
            <ellipse cx="66" cy="50" rx="5" ry="2.6" fill="#d4f57a" opacity="0.25" />
            <ellipse cx="51" cy="35" rx="10" ry="3.4" fill="#0e1408" opacity="0.35" />
          </g>
        </g>
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
        {/* eyes: glossy, deep set */}
        {[
          [44.2, 42.4, eyeR * 0.88, 0.75],
          [59.6, 41.2, eyeR, 1],
        ].map(([cx, cy, r, lit]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r={r + 2.8} fill={`url(#${uid}-acid)`} opacity={0.5 * lit} />
            <circle cx={cx} cy={cy} r={r + 0.9} fill="#0b1008" />
            <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-eye)`} />
            <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke="#2e4210" strokeWidth="0.3" opacity="0.5" />
            <ellipse cx={cx + 0.2} cy={cy + 0.2} rx={pupil} ry={r * 0.72} fill="#070a05" />
            <path d={`M${r1(cx - r * 0.85)},${r1(cy - r * 0.2)}A${r},${r} 0 0 1 ${r1(cx + r * 0.85)},${r1(cy - r * 0.2)}`} stroke="#0b1008" strokeWidth={r * 0.35} fill="none" opacity="0.45" />
            <circle cx={cx + r * 0.38} cy={cy - r * 0.4} r={r * 0.28} fill="#fffaf0" />
            <circle cx={cx - r * 0.35} cy={cy + r * 0.42} r={r * 0.12} fill="#fffaf0" opacity="0.8" />
          </g>
        ))}
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
  const eyeH = alarmed ? 4 : warm ? 2.4 : grim ? 2.2 : 3;
  const headD = 'M50,86L39,78L30.5,66L25.6,52L25,36L20,9L35,25.6L43,24.4L50,25.6L57,24.4L65,25.6L80,9L75,36L74.4,52L69.5,66L61,78Z';
  const ruffD = 'M0,104L4,82L12,86L11,72L20,78L21,64L30,70L33,60L50,64L67,60L70,70L79,64L80,78L89,72L88,86L96,82L100,104Z';
  const [fd, fl] = strands({ x: 50, y: 56, a0: -Math.PI * 1.05, a1: Math.PI * 0.05, rIn: 17, rOut: 32, n: 44, seed: 31, curl: 1.6, jitter: 0.2 });
  const fur = ['#2b3a4c', '#7c8fa0', '#d9e2e8', '#fffaf0'];
  return {
    bg: ['#2b4268', '#04080f'],
    zoom: 1.02,
    glow: '#d9e2e8',
    art: (
      <>
        <defs>
          <RG id={`${uid}-eye`} cx="45%" cy="40%" stops={[[0, '#fffaf0'], [0.35, '#ffd97a'], [0.85, '#c9a227'], [1, '#7d6114']]} />
          <RG id={`${uid}-eg`} stops={[[0, '#ffe9ae', 0.75], [1, '#ffe9ae', 0]]} />
          <clipPath id={`${uid}-hdc`}>
            <path d={headD} />
          </clipPath>
          <Diag3 id={`${uid}-ice`} c={['#7c8fa0', '#d9e2e8', '#fffaf0']} />
        </defs>
        {/* ruff: layered tufts */}
        <Hair
          uid={uid}
          name="rf"
          d={ruffD}
          tones={['#2b3a4c', '#7c8fa0', '#d9e2e8', '#fffaf0']}
          fan={{ x: 50, y: 118, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 18, rOut: 56, n: 60, seed: 41, curl: 1.4, jitter: 0.15 }}
          sheen="M70,70Q82,74 92,88"
          sheenW={3}
          w={0.45}
          so={0.7}
        />
        <path d="M14,92L18,84L22,92M28,86L32,77L35,86M66,86L69,77L72,86M80,92L83,84L87,92" fill="#2b3a4c" opacity="0.55" />
        {/* head */}
        <Hair uid={uid} name="hd" d={headD} tones={fur} />
        <g clipPath={`url(#${uid}-hdc)`}>
          <g filter={`url(#${uid}-soft)`}>
            <ellipse cx="26" cy="52" rx="13" ry="34" fill="#1c2836" opacity="0.85" />
            <ellipse cx="37" cy="60" rx="5" ry="16" fill="#3d4b5c" opacity="0.55" />
            <ellipse cx="64" cy="36" rx="9" ry="6" fill="#fffaf0" opacity="0.5" />
            {/* cheek and jaw planes */}
            <ellipse cx="66" cy="62" rx="5" ry="7" fill="#56677a" opacity="0.4" />
            <ellipse cx="43" cy="70" rx="5" ry="7" fill="#2b3a4c" opacity="0.5" />
            <ellipse cx="50" cy="40" rx="4" ry="10" fill="#fffaf0" opacity="0.35" />
            <ellipse cx="50" cy="83" rx="12" ry="5" fill="#2b3a4c" opacity="0.5" />
            {/* deep eye sockets */}
            <ellipse cx="40.5" cy="49" rx="6" ry="4" fill="#3d4b5c" opacity="0.6" />
            <ellipse cx="59.5" cy="49" rx="6" ry="4" fill="#56677a" opacity="0.5" />
          </g>
          <g fill="none" strokeLinecap="round">
            <path d={fd} stroke="#3d4b5c" strokeWidth="0.4" opacity="0.4" />
            <path d={fl} stroke="#fffaf0" strokeWidth="0.3" opacity="0.4" />
          </g>
        </g>
        {/* inner ears */}
        <path d="M24.6,13.6L33.4,26.8L28.6,32Z" fill="#2b3a4c" />
        <path d="M26,17L31.6,26.4L29,29Z" fill="#7a5a66" opacity="0.5" />
        <path d="M75.4,13.6L66.6,26.8L71.4,32Z" fill="#7c8fa0" />
        <path d="M74,17L68.4,26.4L71,29Z" fill="#c29a9a" opacity="0.45" />
        {/* notched right ear */}
        <path d="M76.6,14.6l-2.6,2.4l2.2,1.2Z" fill="#04080f" />
        {/* cheek tufts */}
        <path d="M25.6,52L18,55.4L24.6,57.6L19.6,62.6L26.4,62.4L22.6,67L29.6,64.6Z" fill="#7c8fa0" />
        <path d="M74.4,52L82,55.4L75.4,57.6L80.4,62.6L73.6,62.4L77.4,67L70.4,64.6Z" fill="#eef2f5" />
        <path d="M25.6,53.6L20,55.6M24.6,58.6L21,62M75,53.6L80.6,55.6M75.6,58.6L79,62" stroke="#3d4b5c" strokeWidth="0.35" opacity="0.6" />
        {/* blaze + muzzle */}
        <path d="M50,32L44.4,44L45.6,62L50,72L54.4,62L55.6,44Z" fill="#fffaf0" opacity="0.55" />
        <path d="M41.6,60C42.6,71 46.6,78.4 50,79.4C53.4,78.4 57.4,71 58.4,60C55.6,63 52.8,64 50,64C47.2,64 44.4,63 41.6,60Z" fill="#e6ecf0" />
        <path d="M41.6,60C42.6,71 46.6,78.4 50,79.4C48,74 46.6,66 47.4,63.6C45.4,63.2 43.4,62 41.6,60Z" fill="#9fb0c0" opacity="0.6" />
        {/* whisker pads */}
        <g fill="#56677a" opacity="0.7">
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
        <ellipse cx="52" cy="67.6" rx="1.6" ry="0.6" fill="#d9e2e8" opacity="0.75" />
        <path d="M50,73.4V75.6M50,75.6C48.2,77.4 45.6,77.4 44,75.8M50,75.6C51.8,77.4 54.4,77.4 56,75.8" stroke="#070d18" strokeWidth="0.95" fill="none" strokeLinecap="round" />
        {grim && (
          <g>
            <path d="M43.4,76.4C46,79.4 54,79.4 56.6,76.4L55.2,80C52.6,81.6 47.4,81.6 44.8,80Z" fill="#2a1418" />
            <path d="M45.6,77.4l0.8,2.6l0.9,-2.4ZM54.4,77.4l-0.8,2.6l-0.9,-2.4Z" fill="#fffaf0" />
            <path d="M44,58.6q2.4,2 4,1.2M56,58.6q-2.4,2 -4,1.2" stroke="#56677a" strokeWidth="0.7" fill="none" />
          </g>
        )}
        {/* eyes: amber glow, slit pupils, catchlights */}
        <circle cx="40.5" cy="49.6" r="5.4" fill={`url(#${uid}-eg)`} />
        <circle cx="59.5" cy="49.6" r="5.4" fill={`url(#${uid}-eg)`} />
        <path d={`M35.8,${48.4 - eyeH * 0.2}L44.6,49.8L40.4,${49.8 + eyeH}Z`} fill={`url(#${uid}-eye)`} stroke="#070d18" strokeWidth="1" strokeLinejoin="round" />
        <path d={`M64.2,${48.4 - eyeH * 0.2}L55.4,49.8L59.6,${49.8 + eyeH}Z`} fill={`url(#${uid}-eye)`} stroke="#070d18" strokeWidth="1" strokeLinejoin="round" />
        <ellipse cx="41" cy={49.8 + eyeH * 0.3} rx="0.6" ry={eyeH * 0.42} fill="#070d18" />
        <ellipse cx="59" cy={49.8 + eyeH * 0.3} rx="0.6" ry={eyeH * 0.42} fill="#070d18" />
        <circle cx="42" cy={49.2 + eyeH * 0.1} r="0.45" fill="#fffaf0" opacity="0.8" />
        <circle cx="60.2" cy={49.2 + eyeH * 0.1} r="0.5" fill="#fffaf0" />
        {/* brow fur */}
        <path d={`M34.6,${45 + (grim ? 1.2 : alarmed ? -1 : 0)}L45,${46.4 + (grim ? 1.6 : 0)}M65.4,${45 + (grim ? 1.2 : alarmed ? -1 : 0)}L55,${46.4 + (grim ? 1.6 : 0)}`} stroke="#3d4b5c" strokeWidth="1.5" strokeLinecap="round" />
        <path d={`M64.8,${44.4 + (grim ? 1.2 : alarmed ? -1 : 0)}L56,${45.6 + (grim ? 1.6 : 0)}`} stroke="#fffaf0" strokeWidth="0.4" strokeLinecap="round" opacity="0.7" />
        {/* claw scars across her right eye */}
        <g strokeLinecap="round">
          <path d="M55.4,37.6L63.6,58.6M59,36.6L67,56M62.6,36.8L69.4,52.6" stroke="#5a3a4a" strokeWidth="1.6" />
          <path d="M55.4,37.6L63.6,58.6M59,36.6L67,56M62.6,36.8L69.4,52.6" stroke="#9e2b25" strokeWidth="0.5" opacity="0.4" />
          <path d="M55.9,37.4L64.1,58.4M59.5,36.4L67.5,55.8M63.1,36.6L69.9,52.4" stroke="#fffaf0" strokeWidth="0.45" opacity="0.8" />
        </g>
        {/* ice diadem: faceted crystals */}
        <path d="M41,31.4Q50,27.4 59,31.4" stroke="#7c8fa0" strokeWidth="0.9" fill="none" />
        <path d="M42.6,30.6L44,23.6L45.6,30.2ZM48.2,28.8L50,19.4L51.8,28.8ZM54.4,30.2L56,23.6L57.4,30.6Z" fill={`url(#${uid}-ice)`} stroke="#56677a" strokeWidth="0.35" />
        <path d="M44,23.6L44.2,30.4M50,19.4L50.2,28.8M56,23.6L56.2,30.4" stroke="#fffaf0" strokeWidth="0.35" />
        <path d="M42.6,30.6L44,23.6L44.2,30.4ZM48.2,28.8L50,19.4L50.2,28.8ZM54.4,30.2L56,23.6L56.2,30.4Z" fill="#56677a" opacity="0.45" />
        <circle cx="50" cy="21.2" r="1.6" fill="#fffaf0" opacity="0.35" filter={`url(#${uid}-soft)`} />
        <circle cx="50.3" cy="21.4" r="0.55" fill="#fffaf0" />
        <Rim uid={uid} d="M50,25.6L57,24.4L65,25.6L80,9L75,36L74.4,52L69.5,66L61,78" color="#fffaf0" op={0.6} w={1} />
      </>
    ),
  };
}

// ---------------------------------------------------------------- Sovereign
export function Sovereign({ uid }) {
  const f = { cx: 50, cy: 45, rx: 12.2, ry: 15.4 };
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.28);
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    const len = i % 2 ? 32 : 46;
    const w = i % 2 ? 0.035 : 0.05;
    return `M50,40L${r1(50 + Math.cos(a - w) * len)},${r1(40 + Math.sin(a - w) * len)}L${r1(50 + Math.cos(a + w) * len)},${r1(40 + Math.sin(a + w) * len)}Z`;
  }).join('');
  const mantle = shoulders(69);
  return {
    bg: ['#6e5414', '#070d18'],
    glow: '#ffe9ae',
    zoom: 1.04,
    art: (
      <>
        <defs>
          <LG id={`${uid}-face`} x2={1} y2={0.1} stops={[[0, '#09070b'], [0.55, '#1e171b'], [0.82, '#5e4020'], [1, '#e3c463']]} />
          <Lit3 id={`${uid}-mantle`} c={['#070d18', '#1f3150', '#45639a']} />
          <Metal id={`${uid}-gold`} />
          <Metal id={`${uid}-gold2`} x1={0.1} y1={0} x2={0.9} y2={1} />
          <RG id={`${uid}-bloom`} stops={[[0, '#fff4d6', 0.8], [0.4, '#ffe9ae', 0.3], [1, '#e3c463', 0]]} />
          <RG id={`${uid}-gem`} cx="35%" cy="30%" r="70%" stops={[[0, '#f9c99a'], [0.3, '#c2413a'], [1, '#4a0f0c']]} />
          <RG id={`${uid}-sap`} cx="35%" cy="30%" r="70%" stops={[[0, '#b8c6d1'], [0.35, '#2b4268'], [1, '#070d18']]} />
          <clipPath id={`${uid}-fc`}>
            <path d={head} />
          </clipPath>
        </defs>
        <path d={rays} fill="#ffe9ae" opacity="0.15" />
        <circle cx="50" cy="40" r="27" fill="none" stroke="#e3c463" strokeWidth="0.7" opacity="0.4" />
        <circle cx="50" cy="40" r="24.6" fill="none" stroke="#e3c463" strokeWidth="0.5" strokeDasharray="1 1.8" opacity="0.4" />
        <circle cx="50" cy="26" r="20" fill={`url(#${uid}-bloom)`} />
        <path d="M44.75,54L55.25,54L56.5,74L43.5,74Z" fill="#120e12" />
        <path d="M53,56L56.5,74L54,74Z" fill="#5e4020" opacity="0.6" />
        {/* velvet mantle */}
        <path d={mantle} fill={`url(#${uid}-mantle)`} />
        <ClothShade uid={uid} name="m" d={mantle} neckY={70} folds="M24,90Q26,97 23,104M33,88Q36,96 34,104M67,88Q64,96 66,104M76,90Q74,97 77,104" />
        <path d="M6,104C8,94 12,88 18,84M94,104C92,94 88,88 82,84" stroke={`url(#${uid}-gold)`} strokeWidth="1.2" fill="none" />
        <path d="M8,101.6C10,93 13.4,88.4 18.4,85.6" stroke="#4f3d0d" strokeWidth="0.35" strokeDasharray="0.6 0.6" fill="none" />
        {/* ermine collar with tails */}
        <path d="M28.6,76C35,69 44,66.6 50,66.6C56,66.6 65,69 71.4,76L73.6,83C65,79 56,77.8 50,77.8C44,77.8 35,79 26.4,83Z" fill="#e8dfc8" />
        <path d="M28.6,76C35,69 44,66.6 50,66.6C44,68 36,72 30,79Z" fill="#a8977a" opacity="0.6" />
        <g filter={`url(#${uid}-soft)`}>
          <ellipse cx="38" cy="78" rx="9" ry="2.6" fill="#7a6a4c" opacity="0.45" />
          <ellipse cx="50" cy="70.4" rx="7" ry="2" fill="#5a4a30" opacity="0.45" />
          <ellipse cx="64" cy="72.6" rx="6" ry="1.6" fill="#fffaf0" opacity="0.6" />
        </g>
        <path d="M71.4,76L73.6,83C69,81 64,79.6 59,78.8" fill="none" stroke="#fffaf0" strokeWidth="0.9" opacity="0.85" />
        <path d="M30,80.6Q40,76.6 50,76.4M50,76.4Q60,76.6 70,80.6" stroke="#c2b287" strokeWidth="0.35" strokeDasharray="0.5 0.7" fill="none" />
        <g fill="#141518">
          <path d="M35,74.6l0.75,2.6l0.75,-2.6Z" />
          <path d="M43,71.6l0.75,2.6l0.75,-2.6Z" />
          <path d="M57,71.6l0.75,2.6l0.75,-2.6Z" />
          <path d="M65,74.6l0.75,2.6l0.75,-2.6Z" />
          <path d="M50,70.4l0.75,2.6l0.75,-2.6Z" />
          <path d="M30.6,79.6l0.6,2l0.6,-2Z" />
          <path d="M69.6,79.6l0.6,2l0.6,-2Z" />
        </g>
        {/* chain of office: linked plates and a jewelled medallion */}
        <path d="M33,85Q50,99 67,85" stroke="#4f3d0d" strokeWidth="2.2" fill="none" />
        <path d="M33,85Q50,99 67,85" stroke={`url(#${uid}-gold2)`} strokeWidth="1.6" strokeDasharray="1.8 0.7" fill="none" />
        <path d="M34,84.6Q50,97.6 66,84.6" stroke="#fffaf0" strokeWidth="0.35" strokeDasharray="0.6 1.9" fill="none" opacity="0.8" />
        <circle cx="50" cy="93" r="4.4" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.5" />
        <circle cx="50" cy="93" r="3.2" fill="none" stroke="#7d6114" strokeWidth="0.35" strokeDasharray="0.5 0.5" />
        <circle cx="50" cy="93" r="1.8" fill={`url(#${uid}-gem)`} />
        <circle cx="50.6" cy="92.3" r="0.45" fill="#fffaf0" />
        {/* face held in shadow, caught by gold light */}
        <path d={head} fill={`url(#${uid}-face)`} />
        <g clipPath={`url(#${uid}-fc)`} filter={`url(#${uid}-soft)`}>
          <ellipse cx="62" cy="44" rx="3" ry="8" fill="#e3c463" opacity="0.4" />
          <ellipse cx="57" cy="48.6" rx="2.6" ry="1.6" fill="#c9a227" opacity="0.35" />
          <ellipse cx="50" cy="34.6" rx="13" ry="3" fill="#000" opacity="0.6" />
          {/* gold catching the brow, the cheekbone and the jaw on the lit side */}
          <ellipse cx="56.4" cy="41.4" rx="3.4" ry="0.9" fill="#e3c463" opacity="0.4" />
          <ellipse cx="58.6" cy="50.6" rx="2.4" ry="1.4" fill="#ffe9ae" opacity="0.35" />
          <ellipse cx="55.4" cy="57.4" rx="3.6" ry="1.2" fill="#c9a227" opacity="0.3" />
          <ellipse cx="44" cy="46.4" rx="3" ry="2" fill="#000" opacity="0.5" />
        </g>
        <path d="M45.2,42.6Q48,41.4 50.4,42.8M53.4,42.6Q56,41.2 59,42.4" stroke="#e3c463" strokeWidth="0.5" fill="none" opacity="0.55" strokeLinecap="round" />
        <path d="M60.6,40Q62,47 59.6,54" stroke="#ffe9ae" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M51,45L51.8,52.6" stroke="#e3c463" strokeWidth="0.7" opacity="0.6" />
        <path d="M51.8,52.6L53.4,53.4" stroke="#c9a227" strokeWidth="0.5" opacity="0.5" />
        <path d="M47.4,58.4Q50.6,59.2 53.6,58.2" stroke="#c9a227" strokeWidth="0.45" fill="none" opacity="0.4" />
        {/* eyes: two points of light in the shadow */}
        <ellipse cx="44.6" cy="45.2" rx="1.7" ry="0.7" fill="#e3c463" opacity="0.4" />
        <ellipse cx="55.6" cy="45.2" rx="1.8" ry="0.75" fill="#ffe9ae" opacity="0.9" />
        <circle cx="56" cy="45" r="0.35" fill="#fffaf0" />
        <Rim uid={uid} d={head} color="#ffe9ae" op={0.95} w={1.5} />
        {/* crown */}
        <ellipse cx="50" cy="34" rx="15" ry="3" fill="#050407" opacity="0.6" />
        <path d="M35.4,33.4L36.8,19.6L42.4,26L46,15.8L50,23.6L54,15.8L57.6,26L63.2,19.6L64.6,33.4Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M50,23.6L54,15.8L57.6,26L63.2,19.6L64.6,33.4L50,33.4Z" fill="#fff4d6" opacity="0.18" />
        <path d="M36.8,19.6L38.4,30M46,15.8L47,29.6M54,15.8L53.4,29.6M63.2,19.6L61.8,30" stroke="#7d6114" strokeWidth="0.35" opacity="0.7" />
        <rect x="34.8" y="30.6" width="30.4" height="4.6" rx="1" fill={`url(#${uid}-gold2)`} stroke="#4f3d0d" strokeWidth="0.7" />
        <path d="M35.6,31.4H64.4" stroke="#fffaf0" strokeWidth="0.35" opacity="0.7" />
        <path d="M50,26l2,2.9l-2,2.9l-2,-2.9Z" fill={`url(#${uid}-gem)`} stroke="#4f3d0d" strokeWidth="0.3" />
        <circle cx="50.5" cy="27.8" r="0.35" fill="#fffaf0" />
        <circle cx="42" cy="32.9" r="1.05" fill={`url(#${uid}-sap)`} />
        <circle cx="58" cy="32.9" r="1.05" fill={`url(#${uid}-sap)`} />
        <circle cx="38.4" cy="32.9" r="0.55" fill="#fff4d6" />
        <circle cx="46" cy="32.9" r="0.55" fill="#fff4d6" />
        <circle cx="54" cy="32.9" r="0.55" fill="#fff4d6" />
        <circle cx="61.6" cy="32.9" r="0.55" fill="#fff4d6" />
        <g fill="#fffaf0">
          <circle cx="36.8" cy="19" r="1.25" />
          <circle cx="46" cy="15.2" r="1.25" />
          <circle cx="54" cy="15.2" r="1.25" />
          <circle cx="63.2" cy="19" r="1.25" />
        </g>
        <circle cx="54" cy="15.2" r="2.6" fill="#fffaf0" opacity="0.4" filter={`url(#${uid}-soft)`} />
        <path d="M54,12.4v5.6M51.2,15.2h5.6" stroke="#fffaf0" strokeWidth="0.3" opacity="0.9" />
      </>
    ),
  };
}

// ---------------------------------------------------------------- hooded figures
function Hooded({ uid, palette, quill = false, face = true }) {
  const [robeShade, robe, robeLit, inner, trim] = palette;
  const robeD = 'M22,104C20,84 24,60 29,45C32.6,29 41,20 50,20C59,20 67.4,29 71,45C76,60 80,84 78,104Z';
  const hollow = 'M36.6,63C35.6,46 41,34 50,33.4C59,34 64.4,46 63.4,63C60.6,69 56,71 50,71C44,71 39.4,69 36.6,63Z';
  return (
    <>
      <defs>
        <Lit3 id={`${uid}-chin`} c={['#2a1a10', '#6b4a32', '#b48662']} />
        <Lit3 id={`${uid}-vane`} c={['#a39167', '#e8dfc8', '#fbf8f0']} />
        <RG id={`${uid}-hol`} cx="55%" cy="70%" r="70%" stops={[[0, inner, 0.7], [0.6, inner], [1, '#000']]} />
        <Metal id={`${uid}-gold`} />
      </defs>
      <Hair
        uid={uid}
        name="rb"
        d={robeD}
        tones={[robeShade, robe, robeLit, robeLit]}
        fan={{ x: 50, y: 6, a0: Math.PI * 0.36, a1: Math.PI * 0.64, rIn: 62, rOut: 104, n: 12, seed: 51, curl: 2, jitter: 0.1 }}
        w={0.7}
        so={0.7}
        sheen="M62,28Q71,40 74,62"
        sheenW={3}
        sheenOp={0.4}
      />
      <ClothShade uid={uid} name="rb2" d={robeD} neckY={70} light={robeLit} folds="M32,74Q30,88 33,104M42,76Q41,90 43,104M58,76Q60,90 57,104M68,74Q71,88 68,104" />
      <path d={hollow} fill={`url(#${uid}-hol)`} />
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
      <Rim uid={uid} d={robeD} color={robeLit} op={0.6} w={1} />
      {quill && (
        <g>
          <path d="M87,21C80.6,30 73,48 66.4,76.6L65.2,76.2C69,56 75.4,36.4 87,21Z" fill={`url(#${uid}-vane)`} />
          <path d="M87,21C88,27 84,40 76,56L72,62C76,48 81,34 87,21Z" fill="#e8dfc8" opacity="0.7" />
          <path d="M87,21C83.4,34 77,55 66.6,76.4" stroke="#7d6114" strokeWidth="0.55" fill="none" />
          <path d="M84,29l-4.6,2.6M81.4,36l-4.6,2.4M78.8,43l-4.4,2.4M76.4,50.2l-4,2.2M74,57.6l-3.6,2M85,31l2,-3M83,38l2.4,-3M80.6,45l2.2,-2.6M78.2,52l2,-2.4" stroke="#a39167" strokeWidth="0.4" />
          <path d="M86,24.4C83,33 79,44 74.6,54" stroke="#fffaf0" strokeWidth="0.35" fill="none" opacity="0.8" />
          <path d="M66.4,76.4L64.4,85.6L65.6,85.8L67.6,76.8Z" fill={`url(#${uid}-gold)`} />
          <path d="M58,84C60,80 66,79 70,81.6L69.4,89C65,90.4 60,89.4 58,84Z" fill={`url(#${uid}-chin)`} />
          <path d="M60,82.6Q63,81.4 66,82.6M60.6,85.4Q63.6,84.4 66.6,85.6" stroke="#2a1a10" strokeWidth="0.35" fill="none" opacity="0.6" />
          <path d="M55,88C58,84 66,84 73,86.4L74,96L54,97Z" fill={robeShade} />
          <path d="M55,88C58,84 66,84 73,86.4" stroke={trim} strokeWidth="0.7" fill="none" />
        </g>
      )}
    </>
  );
}

export function Chronicler({ uid }) {
  return {
    bg: ['#6a4720', '#0e0905'],
    glow: '#f4a35e',
    art: <Hooded uid={uid} palette={['#2a1c10', '#6e5236', '#b08a5e', '#140d08', '#c9a227']} quill />,
  };
}

export function Unknown({ uid }) {
  return {
    bg: ['#2b3446', '#070d18'],
    glow: '#8f929a',
    art: <Hooded uid={uid} palette={['#141820', '#383d48', '#6b6f78', '#05070a', '#4a4f5a']} face={false} />,
  };
}
