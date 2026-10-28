// Dev only (npm run dev): look at any foe on any stage at any moment of a fight.
//
//   /?lab=duel&foe=warg_alpha&stage=wilds&t=4200            a frozen frame 4.2 s in
//   /?lab=duel&foe=blade_adept&name=Lieutenant%20Nyra%20Kell&stage=ford&bot=oracle&t=9000
//   /?lab=duel&foe=fallen_champion&stage=ruin&live=1         the real DuelScreen, playable
//
// foe: blade_adept | warg_alpha | fallen_champion · stage: see render/stages.js · bot: idle |
// oracle | spam · guard=1 holds the Sovereign's guard · seed=<n> · script=move:dir,... forces the
// foe's moves (the first wind-up starts at 3.2 s). Never shipped in a build.

import { useEffect, useRef } from 'react';
import { createDuel, stepDuel, STEP_MS, guardActive } from '../../game/duel/engine.js';
import { createOracleBot, createGuardSpamBot } from '../../game/duel/bots.js';
import { createDuelRenderer } from '../duel/render/index.js';
import { DuelScreen } from '../duel/DuelScreen.jsx';

function labConfig(params) {
  const foe = params.get('foe') ?? 'blade_adept';
  const name = params.get('name');
  return {
    archetypeId: foe,
    seed: Number(params.get('seed') ?? 7),
    title: name ?? '',
    subtitle: params.get('epithet') ?? '',
    stage: params.get('stage') ?? undefined,
    modifiers: { stakes: params.get('stakes') ?? 'march', champion: name ? { name, mirror: params.get('mirror') ?? undefined } : null },
    allowRetreat: true,
    // script=slash:left,lunge:thrust forces the foe's moves, for posing
    script: params.get('script') ? params.get('script').split(',').map((m) => ({ move: m.split(':')[0], dir: m.split(':')[1] })) : undefined,
  };
}

export default function DuelLab() {
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const config = labConfig(params);
  const ref = useRef(null);
  const live = params.get('live') === '1';

  useEffect(() => {
    if (live) return undefined;
    const cv = ref.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const renderer = createDuelRenderer({ config, archetypeId: config.archetypeId, reduced: false });
    renderer.resize(w, h, dpr);
    const botName = params.get('bot') ?? 'idle';
    const bot = botName === 'oracle' ? createOracleBot({ mode: 'parry' }) : botName === 'spam' ? createGuardSpamBot() : null;
    const until = Number(params.get('t') ?? 1500);
    let d = createDuel(config);
    renderer.events(d.events, 0);
    while (d.timeMs < until && d.phase !== 'over') {
      d = stepDuel(d, bot ? bot(d) : [], STEP_MS);
      renderer.events(d.events, d.timeMs);
    }
    const guarding = params.get('guard') === '1' || guardActive(d.player);
    let raf = 0;
    const start = performance.now();
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      // the duel stays frozen; scenery and particles keep living
      renderer.frame(ctx, d, until + Math.min(ms - start, 30), { guarding });
      globalThis.__labReady = true;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (live) return <DuelScreen config={config} showHints={params.get('hints') === '1'} onComplete={() => globalThis.location.reload()} />;
  return (
    <main className="fixed inset-0 bg-navy-950">
      <h1 className="sr-only">Duel lab</h1>
      <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />
    </main>
  );
}
