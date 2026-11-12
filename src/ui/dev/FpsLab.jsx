// Dev only: /?lab=fps renders one still (or live) view of the Greywater Front for art review.
//   &x=&z=&y= camera position (y = metres above the ground, default eye height)
//   &yaw=&pitch= in degrees (yaw 0 looks down the road, toward −z)
//   &stage= start the simulation at a mission stage   &t= seconds of simulation to run first
//   &bot=oracle|recruit drive the player with a bot   &live=1 keep animating
//   &warm= seconds of effects warm-up before the still (default 1.5)
//   &quality=low|medium|high   &weapon=0 hide the weapon   &ads=1 aim down sights
import { useEffect, useRef } from 'react';
import { createFps, stepFps, respawn, STEP_MS } from '../../game/fps/sim.js';
import { createBot } from '../../game/fps/bots.js';
import { groundY } from '../../game/fps/level.js';
import { createFpsRenderer } from '../fps/engine/index.js';

export default function FpsLab() {
  const ref = useRef(null);
  useEffect(() => {
    const q = new URLSearchParams(globalThis.location.search);
    const num = (k, d) => (q.get(k) != null ? Number(q.get(k)) : d);
    const state = createFps({ seed: num('seed', 412), stage: q.get('stage') ?? undefined, god: q.get('god') !== '0' });
    const bot = q.get('bot') ? createBot(q.get('bot')) : null;
    const input = { yaw: state.player.yaw, pitch: 0, ads: q.get('ads') === '1', fire: q.get('fire') === '1', ward: q.get('ward') === '1' };
    const all = [];
    for (let i = 0; i < Math.round(num('t', 0) * 60); i += 1) {
      stepFps(state, bot ? bot.step(state) : input, STEP_MS);
      for (const ev of state.events) all.push(ev);
      if (state.status === 'dead') respawn(state);
    }
    const p = state.player;
    if (q.get('x') != null) {
      p.x = num('x', p.x);
      p.z = num('z', p.z);
      p.y = groundY(p.x, p.z) + num('y', 0);
    }
    if (q.get('yaw') != null) p.yaw = (num('yaw', 0) * Math.PI) / 180;
    if (q.get('pitch') != null) p.pitch = (num('pitch', 0) * Math.PI) / 180;
    input.yaw = p.yaw;
    input.pitch = p.pitch;
    const renderer = createFpsRenderer({ canvas: ref.current, quality: q.get('quality') ?? 'medium' });
    let raf = 0;
    let dead = false;
    const view = { showWeapon: q.get('weapon') !== '0', zoom: 1.25 };
    renderer.load().then(() => {
      if (dead) return;
      // &hide=water,grass,... hides named scene objects (debugging)
      for (const name of (q.get('hide') ?? '').split(',').filter(Boolean)) {
        renderer.scene.traverse((o) => {
          if (o.name === name || o.name.startsWith(`${name}:`)) o.visible = false;
        });
      }
      const live = q.get('live') === '1';
      // &warm=seconds: run the simulation and the effects for a while without drawing, then freeze
      const warm = Math.round(num('warm', 1.5) * 30);
      for (let i = 0; i < warm; i += 1) {
        stepFps(state, bot ? bot.step(state) : input, 1000 / 30);
        if (state.status === 'dead') respawn(state);
        renderer.frame(state, state.events, 1 / 30, { ...view, skipRender: true });
      }
      let frames = 0;
      const bench = num('bench', 0);
      let benchSum = 0;
      let benchN = 0;
      let last = performance.now();
      const loop = (now) => {
        if (dead) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        let events = frames === 0 ? all.slice(-40) : [];
        if (live) {
          stepFps(state, bot ? bot.step(state) : input, dt * 1000);
          events = state.events;
          if (state.status === 'dead') respawn(state);
        } else {
          p.x += 0; // frozen
        }
        const t0 = performance.now();
        renderer.frame(state, events, live ? dt : 1 / 60, view);
        frames += 1;
        // &bench=N: draw N more frames and report the mean cost of one (ms)
        if (bench > 0 && frames > 4) {
          benchSum += performance.now() - t0;
          benchN += 1;
          if (benchN >= bench) {
            globalThis.__frameMs = benchSum / benchN;
            globalThis.__labReady = true;
            return;
          }
          raf = requestAnimationFrame(loop);
          return;
        }
        if (frames === 4) {
          globalThis.__labReady = bench === 0;
          globalThis.__fpsStats = renderer.stats();
        }
        if (live || frames < 6) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    const onResize = () => renderer.resize();
    globalThis.addEventListener('resize', onResize);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      globalThis.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block', background: '#05080f' }} aria-label="FPS lab" />;
}
