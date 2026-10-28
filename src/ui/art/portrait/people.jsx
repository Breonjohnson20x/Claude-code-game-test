// The council and companions: painted human busts. Each returns
// { bg: [inner, outer], glow?, under?, art } for the Portrait frame.
import { ClothShade, Hair, LG, Lit3, Metal, RG, Rim } from './kit.jsx';
import { Ear, Face, Neck } from './face.jsx';
import { exprFor, headPath, shoulders } from './geometry.js';

// ------------------------------------------------------------------ Mara Voss
export function Mara({ uid, mood }) {
  const f = { cx: 50, cy: 43, rx: 12.2, ry: 15.6 };
  const x = exprFor(mood, { bi: 0.6 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.26);
  const skin = { deep: '#3e2318', shade: '#7a4b37', base: '#b07a5a', light: '#d9a27e', hi: '#f6cfaa', blood: '#c25a44', bounce: '#8a7488' };
  const coat = shoulders(70);
  const hair =
    'M37.4,44C36.3,36.4 37.4,29.4 43,26.8C48.2,24.6 56.4,24.9 60.8,28.1C63.9,30.4 64.2,35.4 63,41.2L61.9,39.2C61.4,35.2 59.6,32.5 56.5,31.7C52,33.8 46,34.4 41.2,33.3C39.8,35.7 39,39.2 38.8,44Z';
  return {
    bg: ['#34507a', '#070d18'],
    glow: '#e3c463',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-coat`} c={['#0b1424', '#1f3150', '#3d5a8a']} />
          <Lit3 id={`${uid}-lap`} c={['#111d30', '#2b4268', '#5574a6']} />
          <Metal id={`${uid}-gold`} />
          <Metal id={`${uid}-gold2`} x1={0.2} y1={0} x2={0.8} y2={1} />
        </defs>
        <Neck uid={uid} top={56} bottom={76} w={11.8} skin={skin} />
        <path d={coat} fill={`url(#${uid}-coat)`} />
        <ClothShade uid={uid} name="coat" d={coat} neckY={71} folds="M30,92Q34,98 33,104M68,90Q66,97 67,104M41,96Q43,100 42,104" />
        {/* tunic + gorget */}
        <path d="M42,71L50,92L58,71Z" fill="#0b1424" />
        {/* stand collar hugging the throat */}
        <path d="M43.4,66.2C46,68.2 54,68.2 56.6,66.2L58,72.6C54,75 46,75 42,72.6Z" fill={`url(#${uid}-lap)`} />
        <path d="M43.4,66.2C46,68.2 54,68.2 56.6,66.2" stroke={`url(#${uid}-gold)`} strokeWidth="0.7" fill="none" />
        <path d="M50,68V74.4" stroke="#070d18" strokeWidth="0.6" />
        <path d="M46,74.2L50,77.4L54,74.2L52.8,80.2L50,82.4L47.2,80.2Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.35" />
        <path d="M48.6,77.6L50,76.6L51.4,77.6L50,80.6Z" fill="#9e2b25" />
        <circle cx="50.5" cy="77.6" r="0.35" fill="#fffaf0" />
        {/* turned-up greatcoat collar with gold piping */}
        <path d="M37,68L27,79L38,94L47.5,77Z" fill={`url(#${uid}-lap)`} />
        <path d="M63,68L73,79L62,94L52.5,77Z" fill={`url(#${uid}-lap)`} />
        <path d="M37,68L27,79L38,94L47.5,77Z" fill="none" stroke="#a8841b" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M63,68L73,79L62,94L52.5,77Z" fill="none" stroke="#f0dc95" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M37,68L47.5,77M38,94L28.5,80" stroke="#04070d" strokeWidth="1.1" opacity="0.4" />
        <path d="M63.4,69.4L71.8,79" stroke="#8fa8cc" strokeWidth="0.5" opacity="0.6" />
        {/* collar stars */}
        <path d="M33.4,78.2l0.55,1.2l1.3,0.1l-1,0.85l0.32,1.27l-1.17,-0.7l-1.12,0.7l0.3,-1.27l-1,-0.85l1.3,-0.1Z" fill="#c9a227" />
        <path d="M66.6,78.2l0.55,1.2l1.3,0.1l-1,0.85l0.32,1.27l-1.17,-0.7l-1.12,0.7l0.3,-1.27l-1,-0.85l1.3,-0.1Z" fill="#fbefc2" />
        {/* epaulettes + bullion fringe */}
        <g>
          <path d="M14.4,84.6C15,79.6 22,74.6 30,74.6C31.4,76.6 30.6,79.6 28,80.6C23,81.2 18,82.6 14.4,84.6Z" fill={`url(#${uid}-gold2)`} stroke="#4f3d0d" strokeWidth="0.45" />
          <path d="M85.6,84.6C85,79.6 78,74.6 70,74.6C68.6,76.6 69.4,79.6 72,80.6C77,81.2 82,82.6 85.6,84.6Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.45" />
          <path d="M18,80.4C21,78.4 25,77.2 28.6,77.2M82,80.4C79,78.4 75,77.2 71.4,77.2" stroke="#4f3d0d" strokeWidth="0.4" fill="none" opacity="0.6" />
          <path d="M14.6,84.6v4.2M16.4,83.8v4.8M18.2,83v5.2M20,82.4v5.4M21.8,81.9v5.4M23.6,81.5v5.2M25.4,81.2v4.8" stroke="#7d6114" strokeWidth="1.15" strokeLinecap="round" />
          <path d="M15,84.6v3.8M18.6,83v4.8M22.2,81.9v5M25.8,81.2v4.4" stroke="#e3c463" strokeWidth="0.45" strokeLinecap="round" />
          <path d="M85.4,84.6v4.2M83.6,83.8v4.8M81.8,83v5.2M80,82.4v5.4M78.2,81.9v5.4M76.4,81.5v5.2M74.6,81.2v4.8" stroke="#a8841b" strokeWidth="1.15" strokeLinecap="round" />
          <path d="M85,84.6v3.8M81.4,83v4.8M77.8,81.9v5M74.2,81.2v4.4" stroke="#fbefc2" strokeWidth="0.5" strokeLinecap="round" />
        </g>
        {/* braided aiguillette */}
        <path d="M75,84Q70,95 59,93" stroke="#7d6114" strokeWidth="1.5" fill="none" />
        <path d="M75,84Q70,95 59,93" stroke="#f0dc95" strokeWidth="0.9" strokeDasharray="1 0.7" fill="none" />
        <path d="M74.6,83.6Q71.6,90.6 61,89.4" stroke="#c9a227" strokeWidth="0.8" strokeDasharray="0.9 0.7" fill="none" />
        <circle cx="45.5" cy="97" r="1.35" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.3" />
        <circle cx="54.5" cy="97" r="1.35" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.3" />
        <Rim uid={uid} d="M64,70C76,72 88,80 93,104" color="#9fb6da" op={0.5} w={1} />
        {/* head, set a little low so the neck stays short */}
        <g transform="translate(0 4.4)">
          <Ear cx={37.8} cy={45.5} side={-1} skin={skin} />
          <Ear cx={62.2} cy={45.5} side={1} skin={skin} />
          <Face
            uid={uid}
            f={f}
            head={head}
            skin={skin}
            x={x}
            o={{ brow: '#3a2418', lip: '#8a4434', lipOp: 0.72, lashW: 1, iris: '#56687a', irisLight: '#b8c6d1', hairShadow: 0.3, lines: (g) => `M${g.cx - 3.6},${g.noseY + 1.4}Q${g.cx - 4.6},${g.mouthY - 0.6} ${g.cx - 4.2},${g.mouthY + 0.8}` }}
          />
          {/* scar through the left brow and cheek (lit side) */}
          <path d="M57.4,35.6L59.2,41.2M59.9,44.4L61.3,50.6" stroke="#5a2a20" strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
          <path d="M57.7,35.5L59.5,41.1M60.2,44.3L61.6,50.5" stroke="#f6d2b8" strokeWidth="0.35" opacity="0.75" strokeLinecap="round" />
          <Hair
            uid={uid}
            name="h"
            d={hair}
            tones={['#1e110a', '#3a2418', '#7a4a2c', '#c08a5a']}
            fan={{ x: 58, y: 24, a0: Math.PI * 0.62, a1: Math.PI * 1.05, rIn: 2, rOut: 19, n: 22, seed: 11, curl: 2.2 }}
            sheen="M50,27.4C55.4,26.4 60,28.6 62,33.2"
          />
          {/* a soldier's bob, tucked behind the jaw */}
          <Hair
            uid={uid}
            name="l"
            d="M38.8,32.6C36,38 35.2,46 36.2,52C36.8,56 38.4,58.8 41.4,59.6C40.2,56 39.4,52 39.2,47C39,42 39.6,37 41.2,33.4Z"
            tones={['#140b06', '#2a1910', '#5a3620', '#8a5a36']}
            fan={{ x: 44, y: 30, a0: Math.PI * 0.5, a1: Math.PI * 0.8, rIn: 2, rOut: 30, n: 8, seed: 12, curl: 1 }}
          />
          <Hair
            uid={uid}
            name="r"
            d="M61.2,32.6C64,38 64.8,46 63.8,52C63.2,56 61.6,58.8 58.6,59.6C59.8,56 60.6,52 60.8,47C61,42 60.4,37 58.8,33.4Z"
            tones={['#2a1910', '#4a2e1c', '#8a5a36', '#c08a5a']}
            fan={{ x: 56, y: 30, a0: Math.PI * 0.2, a1: Math.PI * 0.5, rIn: 2, rOut: 30, n: 8, seed: 14, curl: 1 }}
            sheen="M62.4,38Q63.8,45 62.8,52"
            sheenW={1.2}
          />
          {/* iron at the temples */}
          <path d="M62.4,34.6Q63,37 62.6,39.6M61.8,34Q62.4,36.4 62,38.4M38.4,37.4Q38,40 38.4,42.6" stroke="#b5b6ba" strokeWidth="0.35" strokeLinecap="round" fill="none" opacity="0.5" />
          <Rim uid={uid} d={head} color="#ffd9b0" op={0.6} />
        </g>
      </>
    ),
  };
}

// ------------------------------------------------------------------ Elias Vale
export function Vale({ uid, mood }) {
  const f = { cx: 50, cy: 42, rx: 11, ry: 16.2 };
  const x = exprFor(mood, { mouth: 0.6, bi: -0.4 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.68, 0.7, 0.2);
  const skin = { deep: '#6e4434', shade: '#a57a60', base: '#d9b08f', light: '#f3d1ae', hi: '#fff0d8', blood: '#d9806a', bounce: '#a8908a' };
  const shirt = shoulders(74, 0.92);
  const back = 'M37,47L31.5,41.5L35.5,39.5L30,31L36,31.8L33,22.5L40,26.5L40.6,17L46,23.6L50.4,15L53.6,23L59.6,16.6L59.8,25.4L67.2,20.6L65,29.6L71.4,30L65.8,36L70,40.4L63.4,42.4Z';
  const fringe = 'M38.4,36L41.6,29.4L43.8,33.2L46.6,27.6L49.2,32.4L52.4,27.2L54.6,31.8L58.2,28.2L58.6,33.4L61.8,30.8L61.4,37C55.6,33.2 45,33.2 38.4,36Z';
  const hairTones = ['#3a170a', '#7a3a18', '#c8742e', '#f4a35e'];
  return {
    bg: ['#6e5530', '#120d08'],
    glow: '#ffd97a',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-shirt`} c={['#7a6e56', '#cfc2a2', '#f3eee1']} />
          <Lit3 id={`${uid}-lea`} c={['#2e1d10', '#5e3f26', '#946a40']} />
          <Metal id={`${uid}-brass`} kind="brass" />
          <RG id={`${uid}-lens`} cx="40%" cy="35%" r="70%" stops={[[0, '#fff4d6'], [0.25, '#f4a35e'], [0.7, '#8a3a1c'], [1, '#2e1408']]} />
        </defs>
        <g transform="translate(0 6.6)">
          <Hair uid={uid} name="hb" d={back} tones={hairTones} fan={{ x: 50, y: 40, a0: -Math.PI * 1.05, a1: Math.PI * 0.05, rIn: 4, rOut: 24, n: 26, seed: 5, curl: 1.2 }} sheen="M56,20.6Q63,22.6 67,29" />
        </g>
        <Neck uid={uid} top={56} bottom={78} w={10.8} skin={skin} />
        <path d={shirt} fill={`url(#${uid}-shirt)`} />
        <ClothShade uid={uid} name="sh" d={shirt} neckY={74} folds="M40,86Q42,94 41,104M58,84Q57,94 59,104" />
        <path d="M44,73L50,84L56,73Z" fill={skin.shade} />
        <path d="M47,73L50,82L53,73Z" fill={skin.base} opacity="0.7" />
        <path d="M42.5,72.5L47,71.5L50,84L45,79Z M57.5,72.5L53,71.5L50,84L55,79Z" fill="#f3eee1" stroke="#8a7d63" strokeWidth="0.4" />
        <path d="M42.5,72.5L47,71.5L50,84L45,79Z" fill="#8a7d63" opacity="0.4" />
        {/* leather waistcoat, stitched */}
        <path d="M28,104L33,82L44.5,80L48,104Z" fill={`url(#${uid}-lea)`} />
        <path d="M72,104L67,82L55.5,80L52,104Z" fill={`url(#${uid}-lea)`} />
        <path d="M34.4,84L44,82.4L46.8,104M65.6,84L56,82.4L53.2,104" stroke="#c9a46a" strokeWidth="0.35" strokeDasharray="0.9 0.7" fill="none" opacity="0.7" />
        <path d="M33,82L44.5,80M67,82L55.5,80" stroke="#d6b47a" strokeWidth="0.6" />
        <path d="M30,96Q36,94 46,98" stroke="#1b0f07" strokeWidth="1" fill="none" opacity="0.35" />
        <rect x="37.5" y="87" width="4.4" height="3.2" rx="0.6" fill="none" stroke={`url(#${uid}-brass)`} strokeWidth="1.1" />
        <rect x="58.1" y="87" width="4.4" height="3.2" rx="0.6" fill="none" stroke="#f0d49a" strokeWidth="1.1" />
        {/* brass tools in the breast pocket */}
        <path d="M60,92h10.5v8h-10.5Z" fill="#3b2716" />
        <path d="M63,92V80.5" stroke={`url(#${uid}-brass)`} strokeWidth="1.6" />
        <path d="M60.4,79.6a2.7,2.7 0 1 1 5.2,0l-1.3,0.2l-0.5,-1.6h-1.6l-0.5,1.6Z" fill={`url(#${uid}-brass)`} stroke="#5a4426" strokeWidth="0.4" />
        <path d="M67.6,92V82.8" stroke="#c3c7cc" strokeWidth="1.1" />
        <path d="M68,92V83" stroke="#eef2f5" strokeWidth="0.35" />
        <rect x="66.6" y="84.8" width="2" height="3.6" rx="0.5" fill={`url(#${uid}-brass)`} />
        <path d="M60,92h10.5" stroke="#946a40" strokeWidth="0.8" />
        <Rim uid={uid} d="M64,74C74,76 86,84 92,104" color="#fff0d0" op={0.55} w={1} />
        {/* head, set a little low so the neck stays short */}
        <g transform="translate(0 6.6)">
          <Ear cx={39.2} cy={44.5} side={-1} skin={skin} rx={1.7} ry={3} />
          <Ear cx={60.8} cy={44.5} side={1} skin={skin} rx={1.7} ry={3} />
          <Face
            uid={uid}
            f={f}
            head={head}
            skin={skin}
            x={x}
            o={{ brow: '#7a3a18', browW: 1.2, lip: '#b0604a', lipOp: 0.6, eyeSep: 5.4, eyeW: 2.7, iris: '#4a6a5a', irisLight: '#d4f57a', freckles: '#a0583a', hairShadow: 0.4 }}
          />
          <Hair uid={uid} name="hf" d={fringe} tones={hairTones} fan={{ x: 50, y: 40, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 6, rOut: 13, n: 16, seed: 7, curl: 0.8 }} />
          {/* goggles pushed up */}
          <path d="M38.4,32.8C45,29.4 55,29.4 61.8,32.8" stroke="#1b0f07" strokeWidth="2.5" fill="none" />
          <path d="M38.4,32.2C45,28.8 55,28.8 61.8,32.2" stroke="#5e3f26" strokeWidth="0.5" fill="none" />
          {[44.6, 55.6].map((gx, i) => (
            <g key={gx}>
              <circle cx={gx} cy="30.6" r="4.1" fill={`url(#${uid}-brass)`} stroke="#3d2f1a" strokeWidth="0.4" />
              <circle cx={gx} cy="30.6" r="3.1" fill={`url(#${uid}-lens)`} />
              <circle cx={gx} cy="30.6" r="3.1" fill="none" stroke="#3d2f1a" strokeWidth="0.35" />
              <path d={`M${gx - 1.6},${29.6}A2.2,2.2 0 0 1 ${gx + 1.4},${28.4}`} stroke="#fffaf0" strokeWidth="0.55" fill="none" strokeLinecap="round" opacity={i ? 0.95 : 0.6} />
              <circle cx={gx + 1.3} cy="29.1" r="0.55" fill="#fffaf0" opacity={i ? 1 : 0.6} />
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <circle key={j} cx={gx + Math.cos(j * 1.047 + 0.5) * 3.65} cy={30.6 + Math.sin(j * 1.047 + 0.5) * 3.65} r="0.28" fill="#fff4d6" opacity="0.7" />
              ))}
            </g>
          ))}
          <path d="M48.7,30.6h2.6" stroke={`url(#${uid}-brass)`} strokeWidth="1.3" />
          <Rim uid={uid} d={head} color="#fff0d0" op={0.55} />
        </g>
      </>
    ),
  };
}

// --------------------------------------------------------------- Cassian Rey
export function Cassian({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 11.8, ry: 16 };
  const x = exprFor(mood, { bi: 0.4, mouth: -0.2, open: 0.85 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.7, 0.68, 0.16);
  const skin = { deep: '#1a1114', shade: '#3a2622', base: '#a4765b', light: '#d8aa88', hi: '#ffe0c0', blood: '#b0604a', bounce: '#2b4268' };
  const coat = shoulders(71);
  const hair = 'M37.8,41C37,30.6 42,26 50,25.6C58.6,25.3 63.4,30.2 62.3,41L61.3,37.2C60.4,32.8 56.6,30.6 50.6,31.4L48.4,29.9C44.2,31.2 40.4,33.8 38.9,41Z';
  return {
    bg: ['#22365a', '#03060b'],
    glow: '#b08d57',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-coat`} c={['#07080b', '#1c2029', '#434a59']} hard />
          <Metal id={`${uid}-gold`} />
          <LG id={`${uid}-sh`} stops={[[0, '#000', 0.62], [0.4, '#000', 0.42], [0.53, '#000', 0]]} />
        </defs>
        <Neck uid={uid} top={52} bottom={74} w={10} skin={skin} />
        <path d={coat} fill={`url(#${uid}-coat)`} />
        <ClothShade uid={uid} name="c" d={coat} neckY={74} folds="M66,82Q70,92 69,104M76,84Q80,94 82,104" />
        {/* tall stand collar to the jaw, brass-edged and stitched */}
        <path d="M38.6,57L37,75C42,78.6 58,78.6 63,75L61.4,57C57.6,60.4 42.4,60.4 38.6,57Z" fill={`url(#${uid}-coat)`} />
        <path d="M38.6,57C42.4,60.4 57.6,60.4 61.4,57" stroke={`url(#${uid}-gold)`} strokeWidth="0.9" fill="none" />
        <path d="M39,59.6C43,62.8 57,62.8 61,59.6" stroke="#7a5f36" strokeWidth="0.3" strokeDasharray="0.7 0.6" fill="none" />
        <path d="M50,60.4V77" stroke="#020305" strokeWidth="1" />
        <path d="M51,60.6V76.6" stroke="#5d636b" strokeWidth="0.3" opacity="0.6" />
        <path d="M38.2,64C42,67.4 58,67.4 61.8,64M37.8,69C42,72.4 58,72.4 62.2,69" stroke="#2e3440" strokeWidth="0.5" fill="none" />
        <path d="M56,64.4L61.4,63.6M56.4,69.4L62,68.6" stroke="#8a919e" strokeWidth="0.35" opacity="0.6" />
        {/* lapel seams + intelligence pin (an open eye) */}
        <path d="M37,75L44,104M63,75L56,104" stroke="#4b5363" strokeWidth="0.6" />
        <path d="M60.2,86.4q3,-2.8 6,0q-3,2.8 -6,0Z" fill={`url(#${uid}-gold)`} stroke="#4f3d0d" strokeWidth="0.3" />
        <circle cx="63.2" cy="86.4" r="1" fill="#0b1424" />
        <circle cx="63.5" cy="86.1" r="0.3" fill="#fffaf0" />
        <Rim uid={uid} d="M63,71C75,73 87,81 93,104" color="#ffd9b0" op={0.55} w={1} />
        {/* head */}
        <Ear cx={61.6} cy={45} side={1} skin={skin} rx={1.7} ry={3} />
        <Face
          uid={uid}
          f={f}
          head={head}
          skin={skin}
          x={x}
          o={{ hard: true, hideLeft: true, brow: '#14161c', lip: '#7a4434', lipOp: 0.5, iris: '#3b2a1c', eyeW: 2.8, eyeH: 1.4, mouthW: 3, browArch: 0.3, hairShadow: 0.36, foreheadHi: 0.6 }}
        />
        {/* cheekbone plane */}
        <path d="M55.5,48.5Q59.5,49.5 61,53" stroke="#6e4434" strokeWidth="0.7" fill="none" opacity="0.6" />
        {/* slicked hair */}
        <Hair
          uid={uid}
          name="h"
          d={hair}
          tones={['#06070a', '#12141a', '#3a404d', '#8f9aae']}
          fan={{ x: 46, y: 46, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 14, rOut: 22, n: 18, seed: 3, curl: 2.2 }}
          sheen="M51.5,27.2C56.5,27.4 60.2,30 61.6,34.4"
          sheenOp={0.7}
          so={0.6}
        />
        <Rim uid={uid} d={head} color="#ffd9b0" op={0.75} w={1.1} />
        {/* the shadow that owns half his face */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-sh)`} />
      </>
    ),
  };
}

// ---------------------------------------------------------------------- Mika
export function Mika({ uid, mood }) {
  const f = { cx: 50, cy: 50, rx: 10.2, ry: 11.6 };
  const x = exprFor(mood, { blush: 0.38, open: 1.05 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.8, 0.68, 0.4);
  const skin = { deep: '#8a5444', shade: '#b8826a', base: '#e6b597', light: '#f8d6ba', hi: '#fff4e6', blood: '#e0806a', bounce: '#b09aa0' };
  const cloak = shoulders(74, 0.95);
  const hood = 'M25.6,63C24.6,45 31,28 45,20.6Q50,16.6 55,20.6C69,28 75.4,45 74.4,63C74,70 70.6,75 66,78.4L34,78.4C29.4,75 26,70 25.6,63Z';
  return {
    bg: ['#2b4268', '#070d18'],
    glow: '#f4a35e',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-cloak`} c={['#140d08', '#3b2716', '#6e4c2c']} />
          <Lit3 id={`${uid}-scarf`} c={['#4a1612', '#8a2f25', '#c85a44']} />
          <RG id={`${uid}-hollow`} cx="55%" cy="40%" r="60%" stops={[[0, '#3a281c'], [1, '#120c08']]} />
          <clipPath id={`${uid}-hoodc`}>
            <path d={hood} />
          </clipPath>
        </defs>
        <path d={cloak} fill={`url(#${uid}-cloak)`} />
        <ClothShade uid={uid} name="cl" d={cloak} neckY={76} folds="M30,90Q34,97 32,104M70,88Q67,96 69,104" />
        {/* hood: thick wool with knit ribs */}
        <Hair
          uid={uid}
          name="hd"
          d={hood}
          tones={['#2e2418', '#8a7a5a', '#c2b287', '#e8dfc8']}
          fan={{ x: 50, y: 52, a0: -Math.PI * 1.15, a1: Math.PI * 0.15, rIn: 17, rOut: 30, n: 26, seed: 21, curl: 0.6, jitter: 0.1 }}
          sheen="M60,24.4Q70,30 71,44"
          sheenW={2.4}
          w={0.4}
          so={0.4}
        />
        <g clipPath={`url(#${uid}-hoodc)`}>
          <g filter={`url(#${uid}-soft2)`}>
            <ellipse cx="26" cy="56" rx="11" ry="26" fill="#2a2016" opacity="0.75" />
            <ellipse cx="50" cy="76" rx="20" ry="5" fill="#2a2016" opacity="0.6" />
            <ellipse cx="64" cy="30" rx="7" ry="9" fill="#fffaf0" opacity="0.25" />
          </g>
          {/* heavy wool folds falling from the crown */}
          <g fill="none" strokeLinecap="round" filter={`url(#${uid}-soft)`}>
            <path d="M42,22.6Q33,30 31.6,44Q30.6,56 33.4,70M47,21Q40,26 37.6,34M67.4,40Q70.6,52 67.6,70M58.6,22.4Q64.6,27 67,35" stroke="#2a2016" strokeWidth="1.6" opacity="0.45" />
            <path d="M69,44Q71.6,56 69.2,68M61,23.4Q66,27 68.4,34" stroke="#fffaf0" strokeWidth="0.9" opacity="0.4" transform="translate(1 0)" />
          </g>
        </g>
        {/* hood opening */}
        <ellipse cx="50" cy="50.5" rx="14.2" ry="15.6" fill={`url(#${uid}-hollow)`} />
        <clipPath id={`${uid}-holc`}>
          <ellipse cx="50" cy="50.5" rx="14.2" ry="15.6" />
        </clipPath>
        <g clipPath={`url(#${uid}-holc)`}>
          <Neck uid={uid} top={58} bottom={74} w={8} skin={skin} />
        </g>
        <Face
          uid={uid}
          f={f}
          head={head}
          skin={skin}
          x={x}
          o={{
            iris: '#4f7392',
            irisLight: '#d9e2e8',
            white: '#efe6d8',
            eyeSep: 5.4,
            eyeW: 2.9,
            eyeH: 2.5,
            eyeDy: 0.6,
            browGap: 4.4,
            brow: '#a8834a',
            browW: 0.95,
            lip: '#c0604c',
            lipOp: 0.7,
            lowerLip: 1.3,
            mouthW: 2.4,
            mouthAt: 0.6,
            hairShadow: 0.45,
            lashW: 0.95,
          }}
        />
        {/* pale hair under the hood */}
        <Hair
          uid={uid}
          name="h"
          d="M39.6,46.4C41,40 46.6,38.2 51.6,39C56.4,38.6 60.4,41 60.8,46C58,43.2 54,42.6 50.6,43.6C47,42.8 42.6,43.6 39.6,46.4Z"
          tones={['#9a7638', '#d9b56a', '#f6e9bd', '#fffaf0']}
          fan={{ x: 51, y: 50, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 6, rOut: 12, n: 14, seed: 9, curl: 1 }}
          sheen="M53,40Q58,40.6 60,44"
        />
        <path d="M40.2,46.6C39.4,50 39.6,53 40.6,55.6" stroke="#b08d48" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* knit band around the hood opening */}
        <ellipse cx="50" cy="50.5" rx="14.4" ry="15.8" fill="none" stroke="#3a100c" strokeWidth="3.6" />
        <ellipse cx="50" cy="50.5" rx="14.4" ry="15.8" fill="none" stroke={`url(#${uid}-scarf)`} strokeWidth="2.8" />
        <ellipse cx="50" cy="50.5" rx="14.4" ry="15.8" fill="none" stroke="#3a100c" strokeWidth="2.8" strokeDasharray="0.35 0.85" opacity="0.55" />
        <ellipse cx="50" cy="50.5" rx="13.2" ry="14.6" fill="none" stroke="#120c08" strokeWidth="0.8" opacity="0.7" />
        <path d="M56,36A14.4,15.8 0 0 1 64.4,50" stroke="#f9c99a" strokeWidth="0.7" fill="none" opacity="0.65" strokeLinecap="round" />
        {/* scarf with stripes and a hanging tail */}
        <path d="M35.6,71.5C42,77 58,77 64.4,71.5L65.6,78C58,82.4 42,82.4 34.4,78Z" fill={`url(#${uid}-scarf)`} />
        <path d="M37.6,75.6C44,79.4 56,79.4 62.6,75.6" stroke="#e8dfc8" strokeWidth="0.7" fill="none" opacity="0.8" />
        <path d="M44,77.4Q46,80 45,81.4M52,78Q53,80.4 52.4,82" stroke="#4a1612" strokeWidth="0.6" fill="none" opacity="0.6" />
        <path d="M54.6,78.4L58.4,96L63.6,94L59.6,78Z" fill={`url(#${uid}-scarf)`} />
        <path d="M56.2,84.4L61,83.4M57.4,90L62.4,88.8" stroke="#e8dfc8" strokeWidth="0.7" opacity="0.8" />
        <path d="M58.4,96l0.6,2.6M60.2,95.4l0.6,2.6M62,94.8l0.6,2.6M63.4,94.2l0.5,2.4" stroke="#8a2f25" strokeWidth="0.8" strokeLinecap="round" />
        <Rim uid={uid} d={head} color="#ffd9b0" op={0.45} w={1} />
        <Rim uid={uid} d="M55,20.6C69,28 75.4,45 74.4,63C74,70 70.6,75 66,78.4" color="#fff4d6" op={0.4} w={0.9} />
      </>
    ),
  };
}

// ----------------------------------------------------------------- Nyra Kell
export function Nyra({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 11.6, ry: 15.2 };
  const x = exprFor(mood, { bi: 1, mouth: -0.4, open: 0.9 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.26);
  const skin = { deep: '#1e110b', shade: '#4a2c1e', base: '#7d4c33', light: '#ad7250', hi: '#e8b088', blood: '#9a4a30', bounce: '#5d636b' };
  const jkt = shoulders(72);
  const hair = 'M38,41C37.4,30.4 42.4,26.4 50,26C58,25.6 63,30 62.4,41L61.4,37C60,32.4 56,30.8 50,30.8C44,30.8 40,32.4 38.9,41Z';
  return {
    bg: ['#4a4f57', '#0c0d10'],
    glow: '#d6b47a',
    under: '#e0782b',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-jkt`} c={['#141518', '#33373d', '#666d77']} />
          <Metal id={`${uid}-brass`} kind="brass" />
          <Metal id={`${uid}-iron`} kind="iron" x1={0.7} y1={0} x2={0.3} y2={1} />
        </defs>
        <Neck uid={uid} top={56} bottom={76} w={11.6} skin={skin} />
        <path d={jkt} fill={`url(#${uid}-jkt)`} />
        <ClothShade uid={uid} name="j" d={jkt} neckY={73} folds="M62,84Q66,94 64,104M38,86Q36,95 38,104" />
        {/* padded collar with brass studs */}
        <path d="M37.6,66C42,72 58,72 62.4,66L64.6,73.6C58,78.6 42,78.6 35.4,73.6Z" fill="#202227" />
        <path d="M37.6,66C42,72 58,72 62.4,66" stroke="#5d636b" strokeWidth="0.4" fill="none" />
        <path d="M43,71.6L42,76.8M50,72.6V77.6M57,71.6L58,76.8" stroke="#0b0c0e" strokeWidth="0.5" opacity="0.7" />
        {[
          [38.6, 72],
          [44, 74.6],
          [50, 75.4],
          [56, 74.6],
          [61.4, 72],
        ].map(([sx, sy]) => (
          <g key={sx}>
            <circle cx={sx} cy={sy} r="0.8" fill={`url(#${uid}-brass)`} />
            <circle cx={sx + 0.25} cy={sy - 0.25} r="0.25" fill="#fff4d6" />
          </g>
        ))}
        {/* layered iron pauldron with rivets */}
        <path d="M5,96C7,80 18,73 31,72.6L30,84C20,85 12,89.4 5,96Z" fill={`url(#${uid}-iron)`} stroke="#1b1d21" strokeWidth="0.6" />
        <path d="M7,91C12,84.6 20,81.4 30.4,80.4" stroke="#1b1d21" strokeWidth="0.8" fill="none" />
        <path d="M7.4,90.2C12.4,84 20.4,80.8 30.4,79.6" stroke="#c3c7cc" strokeWidth="0.4" fill="none" opacity="0.7" />
        <path d="M10,86C15,80 22,77 30.8,76.4" stroke="#1b1d21" strokeWidth="0.6" fill="none" opacity="0.7" />
        {[
          [14, 85.6],
          [22, 80.6],
          [28.4, 78.6],
          [11, 91],
        ].map(([rx, ry]) => (
          <g key={rx}>
            <circle cx={rx} cy={ry} r="0.85" fill="#33373d" />
            <circle cx={rx + 0.2} cy={ry - 0.2} r="0.45" fill="#eef2f5" />
          </g>
        ))}
        {/* harness straps + buckle */}
        <path d="M27,78L68,104M73,78L32,104" stroke="#3a2416" strokeWidth="4.4" />
        <path d="M27.4,77.2L68.4,103.2M72.6,77.2L31.6,103.2" stroke="#8a6038" strokeWidth="0.6" opacity="0.7" />
        <path d="M27,78L68,104M73,78L32,104" stroke="#c9a46a" strokeWidth="0.3" strokeDasharray="1 0.9" opacity="0.6" />
        <rect x="46.4" y="86.4" width="7.2" height="6" rx="0.9" fill={`url(#${uid}-brass)`} stroke="#3d2f1a" strokeWidth="0.5" />
        <rect x="48.3" y="88.1" width="3.4" height="2.6" fill="#141518" />
        <path d="M47,87.2h4.4" stroke="#fff4d6" strokeWidth="0.35" opacity="0.8" />
        <Rim uid={uid} d="M64,72C76,74 87,82 93,104" color="#ffcf9a" op={0.5} w={1} />
        {/* head, set a little low so the neck stays short */}
        <g transform="translate(0 4.4)">
          <Ear cx={38.4} cy={45} side={-1} skin={skin} rx={1.8} ry={3} />
          <Face
            uid={uid}
            f={f}
            head={head}
            skin={skin}
            x={x}
            o={{ brow: '#0d0907', lip: '#5a2a1c', lipDark: '#2e160e', lipOp: 0.7, ink: '#0a0706', white: '#d9cfc0', iris: '#3a2214', irisLight: '#e0782b', eyeW: 2.8, eyeH: 1.6, hairShadow: 0.3 }}
          />
          {/* soot smudge */}
          <ellipse cx="57.6" cy="50.4" rx="2.8" ry="1" transform="rotate(-18 57.6 50.4)" fill="#141518" opacity="0.45" filter={`url(#${uid}-soft)`} />
          {/* cropped hair, shaved sides */}
          <path d="M38.2,34L38.9,41L37.9,41C37.6,38 37.7,36 38.2,34ZM61.8,34L61.2,41L62.3,41C62.5,38 62.4,36 61.8,34Z" fill="#2e2622" opacity="0.8" />
          <Hair
            uid={uid}
            name="h"
            d={hair}
            tones={['#060504', '#141110', '#4a3e36', '#a08a78']}
            fan={{ x: 50, y: 44, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, rIn: 14, rOut: 19, n: 30, seed: 13, curl: 0.4, jitter: 0.08 }}
            sheen="M51,26.6C55.6,26.4 59.6,28.6 61,32"
          />
          <path d="M43,27.4C47,23 55.4,23 58.8,26.8C54.4,25.6 48.6,25.8 43,27.4Z" fill="#141110" />
          {/* brass comms headset */}
          <circle cx="62" cy="45" r="3.6" fill={`url(#${uid}-brass)`} stroke="#3d2f1a" strokeWidth="0.6" />
          <circle cx="62" cy="45" r="2.1" fill="none" stroke="#5a4426" strokeWidth="0.4" />
          <circle cx="62" cy="45" r="1.3" fill="#33373d" />
          <circle cx="63.2" cy="43.6" r="0.6" fill="#fffaf0" />
          <path d="M61.4,48.4Q60.4,56.4 54.6,57" stroke="#3d2f1a" strokeWidth="1.2" fill="none" />
          <path d="M61.6,48.4Q60.6,56.2 54.8,56.8" stroke="#d6b47a" strokeWidth="0.5" fill="none" />
          <circle cx="54.2" cy="57" r="1" fill="#1b1d21" />
          <circle cx="54.5" cy="56.6" r="0.3" fill="#e0782b" />
          <Rim uid={uid} d={head} color="#ffcf9a" op={0.6} />
        </g>
      </>
    ),
  };
}

// ------------------------------------------------------------- Adrian Vex
export function Vex({ uid, mood }) {
  const f = { cx: 50, cy: 42.5, rx: 12.2, ry: 15.8 };
  const x = exprFor(mood, { mouth: 0.25, open: 0.82 });
  const head = headPath(f.cx, f.cy, f.rx, f.ry, 0.76, 0.7, 0.28);
  const skin = { deep: '#523628', shade: '#86604e', base: '#c29a80', light: '#e2bea2', hi: '#fff0dc', blood: '#c47a68', bounce: '#7c8fa0' };
  const suit = shoulders(70.5);
  const silver = ['#4a4f5a', '#a3a6ac', '#e2e3e5', '#fffaf0'];
  return {
    bg: ['#46505e', '#0c0e12'],
    glow: '#d6b47a',
    art: (
      <>
        <defs>
          <Lit3 id={`${uid}-suit`} c={['#1f2227', '#4b5058', '#7d848f']} />
          <Lit3 id={`${uid}-lap`} c={['#1b1e22', '#3c4148', '#6c7480']} />
          <LG id={`${uid}-tie`} x2={1} y2={0.3} stops={[[0, '#14161a'], [0.6, '#2a2e36'], [0.8, '#5d636b'], [1, '#2a2e36']]} />
          <Metal id={`${uid}-brass`} kind="brass" />
        </defs>
        <Neck uid={uid} top={56} bottom={76} w={12} skin={skin} />
        <path d={suit} fill={`url(#${uid}-suit)`} />
        <ClothShade uid={uid} name="s" d={suit} neckY={71} />
        {/* faint pinstripe */}
        <path d="M22,84L18,104M28,80L25,104M72,80L75,104M78,84L82,104" stroke="#9aa0a8" strokeWidth="0.25" opacity="0.35" />
        {/* shirt + tie */}
        <path d="M41.5,69.6L50,92L58.5,69.6Z" fill="#ece8de" />
        <path d="M41.5,69.6L50,92L46,72Z" fill="#a8a296" />
        <path d="M42.6,66.6L50,73L45.6,76.6Z" fill="#c9c4b8" stroke="#8a857c" strokeWidth="0.35" />
        <path d="M57.4,66.6L50,73L54.4,76.6Z" fill="#fbf8f0" stroke="#9a958c" strokeWidth="0.35" />
        <path d="M47.8,72.6L52.2,72.6L51.3,76.2L48.7,76.2Z" fill={`url(#${uid}-tie)`} />
        <path d="M48.7,76.2L51.3,76.2L53,91L50,94.6L47,91Z" fill={`url(#${uid}-tie)`} />
        <path d="M49,79L52,78.2M48.6,83L52.4,82.2M48.4,87L52.6,86.2" stroke="#7d848f" strokeWidth="0.35" opacity="0.5" />
        <path d="M51.2,77L52.6,90.4" stroke="#9aa0a8" strokeWidth="0.35" opacity="0.6" />
        <rect x="47.4" y="82.6" width="5.2" height="0.9" fill={`url(#${uid}-brass)`} />
        {/* peaked lapels */}
        <path d="M36.4,70.6L42,69.6L50,93L45,104L39.6,104L35.4,87L29.4,81.4L34.6,79Z" fill={`url(#${uid}-lap)`} />
        <path d="M63.6,70.6L58,69.6L50,93L55,104L60.4,104L64.6,87L70.6,81.4L65.4,79Z" fill={`url(#${uid}-lap)`} />
        <path d="M58,69.6L50,93M65.4,79L70.6,81.4M63.6,70.6L65.4,79" stroke="#b5b6ba" strokeWidth="0.45" />
        <path d="M42,69.6L50,93M34.6,79L29.4,81.4" stroke="#0b0c0e" strokeWidth="0.6" opacity="0.6" />
        {/* brass gear pin + pocket square */}
        <circle cx="62" cy="84" r="2.4" fill="none" stroke={`url(#${uid}-brass)`} strokeWidth="1.4" strokeDasharray="0.9 0.6" />
        <circle cx="62" cy="84" r="1.6" fill="none" stroke="#7a5f36" strokeWidth="0.3" />
        <circle cx="62" cy="84" r="0.9" fill={`url(#${uid}-brass)`} />
        <circle cx="62.9" cy="83" r="0.35" fill="#fffaf0" />
        <path d="M68.4,93.8l1.4,-3.6l1.2,2.2l1.4,-2.4l1,3.8Z" fill="#c9a227" />
        <path d="M69.8,90.2l1.2,2.2" stroke="#fbefc2" strokeWidth="0.3" />
        <Rim uid={uid} d="M64,70.5C76,72.5 87,80.5 93,104" color="#e2e3e5" op={0.5} w={1} />
        {/* head, set a little low so the neck stays short */}
        <g transform="translate(0 4.4)">
          <Ear cx={37.8} cy={45} side={-1} skin={skin} />
          <Ear cx={62.2} cy={45} side={1} skin={skin} />
          <Face
            uid={uid}
            f={f}
            head={head}
            skin={skin}
            x={x}
            o={{
              brow: '#8a8d93',
              browLit: '#fffaf0',
              browW: 1.45,
              lip: '#8a5a4a',
              lipOp: 0.45,
              lids: '#7a5444',
              iris: '#5a6a7a',
              irisLight: '#d9e2e8',
              eyeW: 2.7,
              eyeH: 1.45,
              mouthAt: 0.66,
              hairShadow: 0.22,
              lines: (g) =>
                `M43,33.6Q50,32.6 57,33.6M44.6,35.6Q50,35 55.4,35.6` +
                `M${g.cx + g.ex + g.ew + 0.6},${g.eyeY - 0.6}l1.6,-0.8M${g.cx + g.ex + g.ew + 0.8},${g.eyeY + 0.6}l1.6,0.2` +
                `M${g.cx - g.ex - g.ew - 0.6},${g.eyeY - 0.6}l-1.6,-0.8` +
                `M${g.cx - 3.2},${g.noseY + 1.2}Q${g.cx - 4.6},${g.mouthY - 1} ${g.cx - 4.6},${g.mouthY + 1.2}M${g.cx + 3.2},${g.noseY + 1.2}Q${g.cx + 4.6},${g.mouthY - 1} ${g.cx + 4.6},${g.mouthY + 1.2}`,
            }}
          />
          {/* trimmed silver beard + moustache */}
          <Hair
            uid={uid}
            name="b"
            d="M38.6,47C39.4,54.2 43,58.6 50,59.6C57,58.6 60.6,54.2 61.4,47L60.4,47.6C59.8,51.2 57.6,53.8 55,54.2C53.4,52.8 51.6,52.6 50,53C48.4,52.6 46.6,52.8 45,54.2C42.4,53.8 40.2,51.2 39.6,47.6Z"
            tones={['#7a7e86', '#b5b6ba', '#eef2f5', '#fffaf0']}
            fan={{ x: 50, y: 40, a0: Math.PI * 0.22, a1: Math.PI * 0.78, rIn: 9, rOut: 21, n: 30, seed: 17, curl: 0.6, jitter: 0.1 }}
            w={0.28}
            so={0.7}
          />
          <path d="M44.8,51.4C46.8,50 49,50.3 50,50.9C51,50.3 53.2,50 55.2,51.4C53,52.2 51.4,52.1 50,51.8C48.6,52.1 47,52.2 44.8,51.4Z" fill="#8f929a" />
          <path d="M50.4,51.2C51.6,50.6 53.4,50.6 54.8,51.3" stroke="#f3f4f5" strokeWidth="0.35" fill="none" opacity="0.8" />
          {/* swept-back silver hair, receding */}
          <Hair
            uid={uid}
            name="h"
            d="M37.6,42C37,31 42,26 50,25.8C58,25.6 63.2,30.6 62.4,42L61.2,39C61,34.6 59.6,32.4 57.6,31.4C55,30.6 52.6,31.8 50,31.2C47.4,31.8 45,30.6 42.4,31.4C40.4,32.4 39,34.6 38.8,39Z"
            tones={silver}
            fan={{ x: 50, y: 46, a0: -Math.PI * 0.88, a1: -Math.PI * 0.12, rIn: 13, rOut: 21, n: 24, seed: 19, curl: 1.4, jitter: 0.1 }}
            so={0.8}
            sheen="M45,28Q52,26.4 59.4,30"
            sheenOp={0.8}
          />
          <Rim uid={uid} d={head} color="#f0e6d8" op={0.6} />
        </g>
      </>
    ),
  };
}
