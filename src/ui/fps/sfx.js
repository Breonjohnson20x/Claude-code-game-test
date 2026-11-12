// Sound for the first-person mode, synthesised with Web Audio like the rest of the game: coil
// shots, bolts, blasts, footsteps, the walker's weight, wind and river. It shares the main audio
// engine's context, mute switch and volume, and never loads a file.

import { audio } from '../audio/audio.js';

export function createFpsSfx() {
  let ctx = null;
  let out = null;
  let noiseBuf = null;
  let wind = null;
  let river = null;
  let hum = null;
  let wardHum = null;
  let beam = null;
  const last = new Map();

  function ensure() {
    const c = audio.context();
    if (!c) return false;
    if (ctx === c) return c.state === 'running';
    ctx = c;
    out = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    out.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < len; i += 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = (s / 2147483648 - 1) * 0.9;
    }
    wind = loop('noise', 'lowpass', 420, 0.5);
    river = loop('noise', 'bandpass', 1500, 0.6);
    hum = loop('saw', 'lowpass', 150, 3, 46);
    wardHum = loop('saw', 'bandpass', 520, 6, 130);
    beam = loop('saw', 'bandpass', 900, 3, 92);
    return c.state === 'running';
  }

  function loop(kind, filterType, freq, q, pitch = 0) {
    let src;
    if (kind === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
    } else {
      src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.value = pitch;
    }
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start();
    return { src, f, g };
  }

  function chain(t, gain, pan) {
    const g = ctx.createGain();
    g.gain.value = gain;
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    node.connect(out);
    return g;
  }

  function noise(t, dur, type, f0, f1, gain, pan = 0, q = 0.8) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = chain(t, 1, pan);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f);
    f.connect(g);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  function tone(t, dur, type, f0, f1, gain, pan = 0, attack = 0.002) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = chain(t, 1, pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Where a sound is relative to the listener: [gain 0..1, pan −1..1]. */
  function place(p, x, z, reach = 14) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const right = (dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / (d || 1);
    return [1 / (1 + (d / reach) * (d / reach)), right * Math.min(1, d / 4)];
  }

  function throttled(key, ms) {
    const now = performance.now();
    if (now - (last.get(key) ?? -1e9) < ms) return true;
    last.set(key, now);
    return false;
  }

  const SURFACE = { road: [900, 0.16], dirt: [800, 0.16], gravel: [2400, 0.2], grass: [500, 0.11], mud: [350, 0.16], wood: [1300, 0.2], water: [3200, 0.2] };

  function play(ev, state) {
    const p = state.player;
    const t = ctx.currentTime + 0.004;
    switch (ev.type) {
      case 'shot':
        if (ev.weapon === 'lance') {
          tone(t, 0.42, 'sawtooth', 1500, 70, 0.3);
          tone(t, 0.5, 'sine', 120, 38, 0.6);
          noise(t, 0.3, 'bandpass', 4200, 600, 0.5, 0, 0.6);
          noise(t + 0.03, 0.9, 'lowpass', 900, 120, 0.22);
        } else {
          tone(t, 0.075, 'square', 980 + Math.random() * 120, 170, 0.16);
          tone(t, 0.11, 'sine', 190, 60, 0.42);
          noise(t, 0.085, 'bandpass', 3400, 1100, 0.42, 0, 0.7);
          noise(t + 0.02, 0.32, 'lowpass', 700, 150, 0.1);
        }
        break;
      case 'dry':
        tone(t, 0.03, 'square', 1700, 900, 0.1);
        break;
      case 'reload_start':
        noise(t, 0.05, 'highpass', 2600, 1800, 0.22);
        tone(t + 0.06, 0.05, 'triangle', 620, 300, 0.14);
        noise(t + ev.ms / 1000 * 0.42, 0.06, 'bandpass', 1800, 900, 0.24);
        break;
      case 'reload_end':
        noise(t, 0.04, 'highpass', 3000, 2200, 0.24);
        tone(t, 0.09, 'triangle', 480, 760, 0.16);
        break;
      case 'swap':
        noise(t, 0.12, 'bandpass', 1200, 500, 0.14);
        break;
      case 'enemy_hit':
        if (ev.source === 'blast') break;
        tone(t, 0.045, 'triangle', ev.zone === 'head' || ev.zone === 'lamp' || ev.zone === 'pack' || ev.zone === 'hatch' ? 2500 : 1750, 1300, 0.12);
        if (ev.enemy === 'walker') noise(t, 0.07, 'bandpass', 2600, 1500, 0.1, 0, 4);
        break;
      case 'enemy_down':
        tone(t, 0.07, 'triangle', 1500, 700, 0.14);
        tone(t + 0.07, 0.11, 'triangle', 1050, 420, 0.14);
        break;
      case 'enemy_fire': {
        const [g, pan] = place(p, ev.x, ev.z, 16);
        if (g < 0.02 || throttled(`ef${ev.id}`, 40)) break;
        noise(t, 0.09, 'bandpass', 2000, 700, 0.5 * g, pan, 0.9);
        tone(t, 0.1, 'sine', 240, 80, 0.3 * g, pan);
        break;
      }
      case 'heavy_spin': {
        const [g, pan] = place(p, ev.x, ev.z, 16);
        tone(t, 0.8, 'sawtooth', 70, 420, 0.22 * g, pan, 0.3);
        break;
      }
      case 'enemy_windup':
        tone(t, 0.42, 'sawtooth', 300, 1250, 0.09, 0, 0.2);
        break;
      case 'enemy_strike':
        noise(t, 0.12, 'highpass', 2800, 1200, ev.hit ? 0.34 : 0.14);
        if (ev.hit) tone(t, 0.16, 'square', 260, 90, 0.25);
        break;
      case 'impact': {
        const [g, pan] = place(p, ev.x, ev.z, 7);
        if (g < 0.03 || throttled('imp', 25)) break;
        noise(t, 0.07, 'bandpass', ev.surface === 'water' ? 3500 : 1700, 500, 0.3 * g, pan);
        break;
      }
      case 'player_hit':
        tone(t, 0.16, 'sine', 150, 50, 0.6);
        noise(t, 0.12, 'lowpass', 900, 200, 0.4);
        break;
      case 'ward_block':
        tone(t, 0.3, 'sine', 1320, 1280, 0.16);
        tone(t, 0.3, 'sine', 1980, 1900, 0.09);
        noise(t, 0.06, 'highpass', 5000, 3000, 0.12);
        break;
      case 'ward_break':
        tone(t, 0.5, 'sawtooth', 900, 90, 0.2);
        break;
      case 'pulse':
        tone(t, 0.5, 'sine', 110, 880, 0.3, 0, 0.05);
        tone(t, 0.6, 'sine', 55, 30, 0.6);
        noise(t, 0.55, 'bandpass', 500, 5000, 0.3, 0, 1.4);
        break;
      case 'melee':
        noise(t, 0.16, 'bandpass', 900, 3600, 0.28, 0, 1.6);
        if (ev.hit) tone(t + 0.06, 0.1, 'square', 320, 110, 0.3);
        break;
      case 'explosion': {
        const [g, pan] = place(p, ev.x, ev.z, ev.kind === 'fuel' ? 34 : 22);
        noise(t, 1.2, 'lowpass', 2800, 70, 1.0 * g, pan, 0.4);
        tone(t, 0.9, 'sine', 95, 28, 1.0 * g, pan);
        noise(t + 0.05, 0.25, 'highpass', 2500, 900, 0.3 * g, pan);
        break;
      }
      case 'walker_fire': {
        const [g, pan] = place(p, ev.x, ev.z, 40);
        tone(t, 0.3, 'sine', 140, 42, 0.8 * g, pan);
        noise(t, 0.35, 'lowpass', 1800, 180, 0.6 * g, pan);
        break;
      }
      case 'walker_aim':
        tone(t, 0.8, 'sawtooth', 110, 520, 0.12, 0, 0.3);
        break;
      case 'walker_charge':
        tone(t, 1.3, 'sawtooth', 160, 1500, 0.14, 0, 0.6);
        tone(t, 1.3, 'sine', 80, 750, 0.14, 0, 0.6);
        break;
      case 'walker_stomp_wind':
        tone(t, 0.9, 'sawtooth', 60, 200, 0.2, 0, 0.5);
        break;
      case 'walker_stomp':
        tone(t, 0.8, 'sine', 70, 22, 1.0);
        noise(t, 0.6, 'lowpass', 700, 60, 0.7);
        break;
      case 'walker_leg':
      case 'walker_kneel':
        noise(t, 0.7, 'bandpass', 900, 150, 0.6, 0, 2);
        tone(t, 1.0, 'sawtooth', 300, 40, 0.3);
        break;
      case 'walker_down':
        tone(t, 1.6, 'sawtooth', 220, 24, 0.5);
        noise(t, 1.8, 'lowpass', 1500, 50, 0.8);
        break;
      case 'walker_stand':
        tone(t, 0.9, 'sawtooth', 50, 230, 0.22, 0, 0.4);
        break;
      case 'step': {
        const [f, g] = SURFACE[ev.surface] ?? SURFACE.road;
        noise(t, ev.surface === 'water' ? 0.2 : 0.085, ev.surface === 'water' ? 'highpass' : 'lowpass', f * (0.85 + Math.random() * 0.3), f * 0.4, g * (ev.sprint ? 1.35 : 1));
        break;
      }
      case 'jump':
        noise(t, 0.08, 'lowpass', 600, 200, 0.12);
        break;
      case 'land':
        noise(t, 0.14, 'lowpass', 500, 90, ev.hard ? 0.45 : 0.24);
        tone(t, 0.12, 'sine', 90, 40, ev.hard ? 0.4 : 0.2);
        break;
      case 'pickup':
        tone(t, 0.14, 'sine', 880, 1320, 0.14);
        tone(t + 0.07, 0.2, 'sine', 1320, 1760, 0.1);
        break;
      case 'dispatch':
        noise(t, 0.2, 'highpass', 3500, 2500, 0.08);
        tone(t, 0.6, 'sine', 660, 660, 0.09, 0, 0.05);
        break;
      case 'objective':
      case 'checkpoint':
        tone(t, 0.5, 'sine', 523, 523, 0.11, 0, 0.02);
        tone(t + 0.12, 0.6, 'sine', 784, 784, 0.1, 0, 0.02);
        break;
      case 'radio':
        noise(t, 0.05, 'bandpass', 2400, 2000, 0.08, 0, 6);
        tone(t + 0.03, 0.06, 'square', 1400, 1400, 0.04);
        break;
      case 'gate':
        noise(t, 1.2, 'bandpass', 300, 180, 0.4, 0, 3);
        tone(t, 0.3, 'square', 80, 60, 0.3);
        break;
      case 'dead':
        tone(t, 1.6, 'sine', 180, 36, 0.5);
        noise(t, 1.2, 'lowpass', 600, 80, 0.3);
        break;
      case 'respawn':
        tone(t, 1.0, 'sine', 220, 660, 0.14, 0, 0.3);
        tone(t, 1.2, 'sine', 330, 990, 0.08, 0, 0.4);
        break;
      case 'won':
        for (const [i, f] of [392, 523, 659, 784].entries()) tone(t + i * 0.16, 1.2, 'sine', f, f, 0.12, 0, 0.03);
        break;
      default:
    }
  }

  let combat = false;
  let theme = null;

  /** Call once per frame with that frame's events. */
  function frame(state, events) {
    if (!ensure()) return;
    out.gain.value = audio.isMuted() ? 0 : audio.getVolume() * 0.9;
    for (const ev of events) play(ev, state);
    const p = state.player;
    const t = ctx.currentTime;
    const playing = state.status === 'playing';
    wind.g.gain.setTargetAtTime(playing ? 0.05 + Math.sin(t * 0.21) * 0.02 : 0.02, t, 0.5);
    wind.f.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 140, t, 0.5);
    const riverD = Math.abs(p.z + 128);
    river.g.gain.setTargetAtTime(playing ? 0.085 / (1 + (riverD / 16) * (riverD / 16)) : 0, t, 0.4);
    const w = state.enemies.find((e) => e.type === 'walker');
    if (w) {
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      const alive = w.hp > 0 && w.mode !== 'overwatch';
      hum.g.gain.setTargetAtTime(alive ? 0.22 / (1 + (d / 22) * (d / 22)) : 0, t, 0.3);
      hum.src.frequency.setTargetAtTime(w.mode === 'kneel' ? 30 : 46 + (w.speed > 0.2 ? 8 : 0), t, 0.3);
      beam.g.gain.setTargetAtTime(w.beam && w.hp > 0 ? 0.16 : 0, t, 0.05);
    }
    wardHum.g.gain.setTargetAtTime(p.warding ? 0.045 : 0, t, 0.06);
    // music follows the fight
    let fight = false;
    for (const e of state.enemies) if (e.hp > 0 && !e.dormant && e.alerted && e.type !== 'walker') fight = true;
    if (w && w.hp > 0 && w.mode !== 'overwatch') fight = true;
    combat = fight && playing;
    const want = state.status === 'won' ? 'passing' : combat ? 'duel' : 'march';
    if (want !== theme) {
      theme = want;
      audio.ambient(want);
    }
  }

  function stop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const l of [wind, river, hum, wardHum, beam]) l?.g.gain.setTargetAtTime(0, t, 0.1);
    theme = null;
  }

  function dispose() {
    stop();
    for (const l of [wind, river, hum, wardHum, beam]) {
      try {
        l?.src.stop(ctx.currentTime + 0.4);
      } catch {
        // already stopped
      }
    }
    ctx = null;
  }

  return { frame, stop, dispose };
}
