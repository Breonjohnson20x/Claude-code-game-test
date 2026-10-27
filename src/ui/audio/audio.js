// Procedural Web Audio engine for Elvia. Zero asset files: every drone, bell, harp
// pluck, brass swell, clang and crackle is synthesised at runtime.
//
//   audio.unlock()            create/resume the context (call from a user gesture)
//   audio.setMuted(bool)      audio.isMuted()
//   audio.setVolume(0..1)     audio.getVolume()
//   audio.ambient(theme)      'title'|'war_room'|'march'|'duel'|'campfire'|'passing'|null (crossfades)
//   audio.sfx(name)           see SFX below; unknown names are a silent no-op
//   haptic(pattern)           navigator.vibrate wrapper; respects localStorage 'elvia.haptics' === 'off'
//
// Safe to import anywhere (node, tests, SSR): without an AudioContext every call no-ops.
// Mix: sources → music/sfx buses (+ shared hall reverb) → compressor → master gain → out.
// The context is suspended while muted or while the tab is hidden.

const STORE_KEY = 'elvia.audio';
const HAPTICS_KEY = 'elvia.haptics';
const MUSIC_LEVEL = 0.62;
const SFX_LEVEL = 0.95;
const MAX_SFX_VOICES = 14;
const SFX_THROTTLE_S = 0.03;
const FADE_IN = 2.6;
const FADE_OUT = 2.2;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const AC = isBrowser ? window.AudioContext || window.webkitAudioContext : undefined;

// ---------------------------------------------------------------- prefs
function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadPrefs() {
  const p = { muted: false, volume: 0.7 };
  try {
    const raw = JSON.parse(store()?.getItem(STORE_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.muted === 'boolean') p.muted = raw.muted;
      if (Number.isFinite(raw.volume)) p.volume = clamp01(raw.volume);
    }
  } catch {
    /* corrupt or blocked storage: defaults */
  }
  return p;
}

function savePrefs() {
  try {
    store()?.setItem(STORE_KEY, JSON.stringify({ muted: prefs.muted, volume: prefs.volume }));
  } catch {
    /* storage full / blocked: prefs still apply this session */
  }
}

function clamp01(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

const prefs = loadPrefs();

// ---------------------------------------------------------------- engine state
let ctx = null;
let G = null; // { comp, master, music, sfx, verb }
let noiseBuf = null;
let brownBuf = null;
let unlocked = false;
let desiredTheme = null;
let current = null; // active theme instance
let timer = null;
let sfxVoices = 0;
let suspendTimer = null;
let analyser = null;
let resumeAskedAt = -1e9; // wall clock (ms) of the last resume() we asked for
const lastSfx = new Map();
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const masterTarget = () => (prefs.muted ? 0 : prefs.volume ** 1.6);

// ---------------------------------------------------------------- graph
function makeNoise(seconds, brown) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(brown ? 99 : 17);
  let last = 0;
  let peak = 0;
  for (let i = 0; i < len; i += 1) {
    const w = rnd() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last;
      peak = Math.max(peak, Math.abs(last));
    } else d[i] = w;
  }
  if (brown && peak > 0) for (let i = 0; i < len; i += 1) d[i] = (d[i] / peak) * 0.9;
  return buf;
}

// Warm stone-hall impulse: decaying noise whose tail darkens over time.
function makeImpulse(seconds = 2.8, decay = 2.6) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    const rnd = mulberry32(31 + ch * 7);
    let y = 0;
    const pre = Math.floor(rate * 0.014);
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      const x = i < pre ? 0 : (rnd() * 2 - 1) * (1 - t) ** decay;
      const a = 0.62 - 0.55 * t; // one-pole low-pass that closes as the tail decays
      y += a * (x - y);
      d[i] = y;
    }
  }
  return buf;
}

function build() {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0;
  comp.connect(master);
  master.connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse();
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.85;
  verb.connect(verbOut);
  verbOut.connect(comp);

  const music = ctx.createGain();
  music.gain.value = MUSIC_LEVEL;
  music.connect(comp);
  const musicSend = ctx.createGain();
  musicSend.gain.value = 0.34;
  music.connect(musicSend);
  musicSend.connect(verb);

  const sfx = ctx.createGain();
  sfx.gain.value = SFX_LEVEL;
  sfx.connect(comp);
  const sfxSend = ctx.createGain();
  sfxSend.gain.value = 0.16;
  sfx.connect(sfxSend);
  sfxSend.connect(verb);

  noiseBuf = makeNoise(2, false);
  brownBuf = makeNoise(4, true);
  G = { comp, master, music, sfx, verb };
}

function applyMaster(ramp = 0.25) {
  if (!ctx || !G) return;
  const t = ctx.currentTime;
  const g = G.master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(masterTarget(), t + ramp);
}

function wantRunning() {
  return Boolean(ctx) && unlocked && !prefs.muted && !(isBrowser && document.hidden);
}

function syncRunState() {
  if (!ctx) return;
  clearTimeout(suspendTimer);
  if (wantRunning()) {
    if (ctx.state !== 'running') {
      resumeAskedAt = nowMs();
      ctx.resume?.().catch(() => {});
    }
    applyMaster(0.3);
  } else {
    applyMaster(0.2);
    // let the fade finish, then stop the clock entirely (saves battery)
    suspendTimer = setTimeout(() => {
      if (ctx && !wantRunning() && ctx.state === 'running') ctx.suspend?.().catch(() => {});
    }, 260);
  }
}

// ---------------------------------------------------------------- node helpers
function gainNode(v = 0) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function biquad(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function oscNode(type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function panNode(p) {
  if (!p || typeof ctx.createStereoPanner !== 'function') return null;
  const s = ctx.createStereoPanner();
  s.pan.value = Math.max(-1, Math.min(1, p));
  return s;
}

function release(src, nodes, onDone) {
  src.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
    onDone?.();
  };
}

/** Envelope on a gain: silent → peak (linear) → hold → exponential tail to silence at t+dur. */
function shape(g, t, { attack = 0.005, peak = 0.2, hold = 0, dur = 0.3 }) {
  const a = Math.max(0.001, attack);
  const p = Math.max(0.0002, peak);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(p, t + a);
  if (hold > 0) g.gain.setValueAtTime(p, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + a + hold + 0.01, t + dur));
}

/**
 * One oscillator voice. o: { type, freq, freqTo, glide, detune, dur, attack, hold, peak,
 * cutoff, cutoffTo, sweep, q, filter, pan, send }
 */
function tone(dest, t, o) {
  const dur = o.dur ?? 0.3;
  const os = oscNode(o.type || 'sine', o.freq);
  os.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t + (o.glide ?? dur));
  if (o.detune) os.detune.value = o.detune;
  const g = gainNode(0);
  shape(g, t, { attack: o.attack, peak: o.peak, hold: o.hold, dur });
  const nodes = [os, g];
  let last = os;
  if (o.cutoff) {
    const f = biquad(o.filter || 'lowpass', o.cutoff, o.q ?? 0.7);
    f.frequency.setValueAtTime(o.cutoff, t);
    if (o.cutoffTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.cutoffTo), t + (o.sweep ?? dur));
    last.connect(f);
    last = f;
    nodes.push(f);
  }
  last.connect(g);
  let out = g;
  const p = panNode(o.pan);
  if (p) {
    g.connect(p);
    out = p;
    nodes.push(p);
  }
  out.connect(dest);
  if (o.send) {
    const s = gainNode(o.send);
    out.connect(s);
    s.connect(G.verb);
    nodes.push(s);
  }
  os.start(t);
  os.stop(t + dur + 0.05);
  release(os, nodes, o.onDone);
  return os;
}

/** Filtered noise burst. o: { dur, attack, hold, peak, filter, freq, freqTo, sweep, q, brown, pan, panTo, send } */
function noise(dest, t, o) {
  const dur = o.dur ?? 0.2;
  const src = ctx.createBufferSource();
  src.buffer = o.brown ? brownBuf : noiseBuf;
  src.loop = true;
  const f = biquad(o.filter || 'bandpass', o.freq ?? 1200, o.q ?? 0.9);
  f.frequency.setValueAtTime(o.freq ?? 1200, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), t + (o.sweep ?? dur));
  const g = gainNode(0);
  shape(g, t, { attack: o.attack ?? 0.004, peak: o.peak, hold: o.hold, dur });
  src.connect(f);
  f.connect(g);
  const nodes = [src, f, g];
  let out = g;
  const p = panNode(o.pan);
  if (p) {
    if (o.panTo != null) p.pan.linearRampToValueAtTime(o.panTo, t + dur);
    g.connect(p);
    out = p;
    nodes.push(p);
  }
  out.connect(dest);
  if (o.send) {
    const s = gainNode(o.send);
    out.connect(s);
    s.connect(G.verb);
    nodes.push(s);
  }
  src.start(t, Math.random() * (src.buffer.duration - 0.1));
  src.stop(t + dur + 0.05);
  release(src, nodes, o.onDone);
  return src;
}

// ---------------------------------------------------------------- instruments
const BELL_PARTIALS = [
  [1, 1, 1],
  [2.0, 0.42, 0.62],
  [2.76, 0.3, 0.45],
  [5.4, 0.12, 0.26],
  [8.93, 0.05, 0.14],
];

function bell(dest, t, freq, vel = 0.12, decay = 3.2, send = 0.5, onDone) {
  // the fundamental rings longest, so it reports completion
  BELL_PARTIALS.forEach(([r, a, d], i) => {
    tone(dest, t, { freq: freq * r * (i === 1 ? 1.002 : 1), peak: vel * a, attack: 0.003, dur: decay * d, send, onDone: i === 0 ? onDone : undefined });
  });
}

function pluck(dest, t, freq, vel = 0.12, decay = 1.8, bright = 2800) {
  tone(dest, t, { type: 'triangle', freq, peak: vel, attack: 0.004, dur: decay, cutoff: bright, cutoffTo: 600, sweep: decay * 0.6, send: 0.45 });
  tone(dest, t, { freq: freq * 2, peak: vel * 0.22, attack: 0.003, dur: decay * 0.45, send: 0.3 });
  return noise(dest, t, { dur: 0.012, peak: vel * 0.18, filter: 'bandpass', freq: 3200, q: 1.5 });
}

function lute(dest, t, freq, vel = 0.08) {
  tone(dest, t, { type: 'sawtooth', freq, peak: vel, attack: 0.004, dur: 1.3, cutoff: 1900, cutoffTo: 420, sweep: 0.8, q: 1.2, send: 0.35 });
  return tone(dest, t, { type: 'sawtooth', freq, detune: 7, peak: vel * 0.5, attack: 0.004, dur: 1.0, cutoff: 1400, cutoffTo: 380, sweep: 0.7, send: 0.2 });
}

/** Brass-like stab/swell: detuned saws through a filter that opens and closes. */
function brass(dest, t, freqs, { vel = 0.1, attack = 0.08, hold = 0.2, rel = 0.8, open = 1800, closed = 220, send = 0.4, onDone } = {}) {
  const f = biquad('lowpass', closed, 1.1);
  f.frequency.setValueAtTime(closed, t);
  f.frequency.exponentialRampToValueAtTime(open, t + attack + 0.04);
  f.frequency.setTargetAtTime(closed * 1.6, t + attack + hold, rel / 3);
  const g = gainNode(0);
  const dur = attack + hold + rel;
  shape(g, t, { attack, peak: vel, hold, dur });
  f.connect(g);
  g.connect(dest);
  const nodes = [f, g];
  if (send) {
    const s = gainNode(send);
    g.connect(s);
    s.connect(G.verb);
    nodes.push(s);
  }
  const srcs = [];
  freqs.forEach((fr) => {
    for (const det of [-6, 5]) {
      const o = oscNode('sawtooth', fr);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
      srcs.push(o);
      nodes.push(o);
    }
  });
  release(srcs[srcs.length - 1], nodes, onDone);
  return srcs[srcs.length - 1];
}

/** Choir swell (one-shot): saw voices through vowel formants. */
function choirSwell(dest, t, freqs, { vel = 0.05, attack = 0.6, dur = 2.6, onDone } = {}) {
  const mix = gainNode(1);
  const f1 = biquad('bandpass', 700, 3.2);
  const f2 = biquad('bandpass', 1150, 4.5);
  const body = biquad('lowpass', 800, 0.5);
  const g = gainNode(0);
  shape(g, t, { attack, peak: vel, dur });
  mix.connect(f1);
  mix.connect(f2);
  mix.connect(body);
  const bodyG = gainNode(0.3);
  body.connect(bodyG);
  f1.connect(g);
  f2.connect(g);
  bodyG.connect(g);
  g.connect(dest);
  const s = gainNode(0.7);
  g.connect(s);
  s.connect(G.verb);
  const nodes = [mix, f1, f2, body, bodyG, g, s];
  const srcs = [];
  freqs.forEach((fr) => {
    for (const det of [-8, 7]) {
      const o = oscNode('sawtooth', fr);
      o.detune.value = det;
      o.connect(mix);
      o.start(t);
      o.stop(t + dur + 0.05);
      srcs.push(o);
      nodes.push(o);
    }
  });
  release(srcs[srcs.length - 1], nodes, onDone);
  return srcs[srcs.length - 1];
}

function taiko(dest, t, vel = 0.5, f0 = 140, f1 = 50, decay = 0.7) {
  tone(dest, t, { freq: f0, freqTo: f1, glide: 0.2, peak: vel, attack: 0.003, dur: decay, send: 0.25 });
  tone(dest, t, { type: 'triangle', freq: f0 * 1.52, freqTo: f1 * 1.4, glide: 0.08, peak: vel * 0.25, attack: 0.002, dur: 0.12 });
  return noise(dest, t, { dur: 0.14, peak: vel * 0.35, filter: 'lowpass', freq: 1100, freqTo: 180, q: 0.6 });
}

const CLANG = [1, 1.47, 2.09, 2.56, 3.39, 4.17, 5.43];

function clang(dest, t, base, vel = 0.15, decay = 0.5, pan = 0, onDone) {
  CLANG.forEach((r, i) => {
    tone(dest, t, { freq: base * r, peak: (vel / (1 + i * 0.45)) * (i === 0 ? 0.8 : 1), attack: 0.001, dur: decay * (1 - i * 0.07), pan, send: 0.3, onDone: i === 0 ? onDone : undefined });
  });
  noise(dest, t, { dur: 0.03, peak: vel * 0.9, filter: 'highpass', freq: 3500, q: 0.7, pan });
}

function whoosh(dest, t, { dur = 0.2, f0 = 600, f1 = 3000, vel = 0.18, q = 1.2, pan = 0, panTo = null, onDone } = {}) {
  return noise(dest, t, { dur, attack: dur * 0.45, peak: vel, filter: 'bandpass', freq: f0, freqTo: f1, q, pan, panTo, onDone });
}

function crackle(dest, t, vel = 0.06) {
  const pop = Math.random() < 0.12;
  return noise(dest, t, {
    dur: pop ? rand(0.03, 0.06) : rand(0.006, 0.022),
    attack: 0.001,
    peak: pop ? vel * 1.6 : vel,
    filter: pop ? 'bandpass' : 'highpass',
    freq: pop ? rand(500, 900) : rand(1500, 4200),
    q: pop ? 1.4 : 0.8,
    pan: rand(-0.35, 0.35),
  });
}

// ---------------------------------------------------------------- sound effects
// Each takes (dest, t, done) and must call `done` exactly once via its last voice's onDone.
const SFX = {
  click(d, t, done) {
    noise(d, t, { dur: 0.02, peak: 0.05, filter: 'bandpass', freq: 3000, q: 2 });
    tone(d, t, { type: 'triangle', freq: 1500 * rand(0.97, 1.03), freqTo: 1100, dur: 0.07, peak: 0.07, onDone: done });
  },
  confirm(d, t, done) {
    pluck(d, t, midi(67), 0.12, 1.2);
    pluck(d, t + 0.085, midi(74), 0.13, 1.6);
    bell(d, t + 0.085, midi(86), 0.035, 1.8, 0.5, done);
  },
  order(d, t, done) {
    taiko(d, t, 0.45, 118, 46, 0.6);
    noise(d, t, { dur: 0.06, peak: 0.12, filter: 'lowpass', freq: 700, q: 0.7 });
    brass(d, t + 0.05, [midi(50), midi(57), midi(62), midi(66)], { vel: 0.1, attack: 0.08, hold: 0.22, rel: 0.95, open: 1900, onDone: done });
    bell(d, t + 0.06, midi(74), 0.045, 2.4);
  },
  turn(d, t, done) {
    whoosh(d, t, { dur: 0.32, f0: 450, f1: 1500, vel: 0.05 });
    bell(d, t + 0.1, midi(57), 0.05, 3);
    bell(d, t + 0.1, midi(50), 0.13, 4.4, 0.5, done);
  },
  chronicle(d, t, done) {
    // quill scratches, then a small bright bell
    let k = t;
    for (let i = 0; i < 4; i += 1) {
      noise(d, k, { dur: rand(0.03, 0.06), attack: 0.008, peak: rand(0.025, 0.045), filter: 'bandpass', freq: rand(4200, 6200), q: 3.5, pan: 0.15 });
      k += rand(0.055, 0.09);
    }
    bell(d, k + 0.06, midi(81), 0.055, 2.2, 0.5, done);
  },
  symbol(d, t, done) {
    tone(d, t, { freq: midi(38), peak: 0.09, attack: 0.7, dur: 2.8, send: 0.6 });
    noise(d, t, { dur: 1.8, attack: 0.9, peak: 0.025, filter: 'bandpass', freq: 1800, freqTo: 6000, sweep: 1.6, q: 2 });
    [74, 80, 85, 90].forEach((m, i) => bell(d, t + 0.25 + i * 0.14, midi(m), 0.04, 3.2, 0.8));
    tone(d, t + 0.2, { type: 'triangle', freq: midi(62), peak: 0.03, attack: 0.5, dur: 3, send: 0.8, onDone: done });
  },
  strike(d, t, done) {
    const side = Math.random() < 0.5 ? -1 : 1;
    whoosh(d, t, { dur: 0.17, f0: 700, f1: 3400, vel: 0.24, q: 1.3, pan: -0.5 * side, panTo: 0.5 * side, onDone: done });
    noise(d, t + 0.1, { dur: 0.05, peak: 0.05, filter: 'highpass', freq: 5000 });
  },
  hit(d, t, done) {
    tone(d, t, { freq: 170, freqTo: 52, glide: 0.14, peak: 0.36, attack: 0.002, dur: 0.2 });
    noise(d, t, { dur: 0.12, peak: 0.26, filter: 'lowpass', freq: 1600, freqTo: 260, q: 0.6 });
    noise(d, t, { dur: 0.05, peak: 0.12, filter: 'bandpass', freq: 2400, q: 1, onDone: done });
  },
  parry(d, t, done) {
    clang(d, t, 610 * rand(0.97, 1.03), 0.15, 0.48, rand(-0.2, 0.2), done);
  },
  perfect_parry(d, t, done) {
    clang(d, t, 760, 0.17, 0.65);
    noise(d, t, { dur: 0.6, attack: 0.05, peak: 0.03, filter: 'highpass', freq: 6500, q: 0.7, send: 0.6 });
    [86, 90, 93, 98].forEach((m, i) => bell(d, t + 0.03 + i * 0.045, midi(m), 0.045 - i * 0.006, 1.6, 0.7));
    tone(d, t, { freq: midi(98), peak: 0.012, attack: 0.02, dur: 1.4, send: 0.9, onDone: done });
  },
  dodge(d, t, done) {
    const side = Math.random() < 0.5 ? -1 : 1;
    whoosh(d, t, { dur: 0.15, f0: 380, f1: 1300, vel: 0.15, q: 0.9, pan: 0.6 * side, panTo: -0.2 * side, onDone: done });
  },
  heavy_warn(d, t, done) {
    brass(d, t, [midi(38), midi(45), midi(50)], { vel: 0.12, attack: 0.22, hold: 0.12, rel: 0.4, open: 1100, closed: 160, send: 0.3 });
    noise(d, t, { dur: 0.6, attack: 0.3, peak: 0.05, filter: 'lowpass', freq: 300, q: 0.8, brown: true });
    tone(d, t, { freq: 55, peak: 0.18, attack: 0.18, dur: 0.6, onDone: done });
  },
  telegraph(d, t, done) {
    tone(d, t, { freq: 2350, freqTo: 2650, peak: 0.028, attack: 0.004, dur: 0.12 });
    tone(d, t + 0.02, { freq: 3550, peak: 0.012, attack: 0.002, dur: 0.09, onDone: done });
  },
  poise_break(d, t, done) {
    clang(d, t, 300, 0.15, 0.5);
    taiko(d, t, 0.42, 110, 38, 0.7);
    noise(d, t, { dur: 0.26, peak: 0.16, filter: 'bandpass', freq: 900, freqTo: 300, q: 0.8 });
    tone(d, t, { type: 'sawtooth', freq: 420, freqTo: 70, glide: 0.4, peak: 0.1, dur: 0.45, cutoff: 1800, cutoffTo: 260, onDone: done });
  },
  arc_pulse(d, t, done) {
    tone(d, t, { freq: midi(38), freqTo: midi(45), glide: 0.5, peak: 0.12, attack: 0.25, dur: 0.75, send: 0.4 });
    noise(d, t, { dur: 0.7, attack: 0.42, peak: 0.07, filter: 'bandpass', freq: 700, freqTo: 5200, sweep: 0.6, q: 1.6, send: 0.5 });
    [74, 76, 78, 80, 81, 85, 86].forEach((m, i) => tone(d, t + i * 0.05, { freq: midi(m), peak: 0.03 + i * 0.006, attack: 0.003, dur: 0.9, send: 0.8 }));
    bell(d, t + 0.38, midi(86), 0.05, 2.2, 0.8, done);
  },
  royal_command(d, t, done) {
    taiko(d, t, 0.5, 100, 38, 0.9);
    brass(d, t, [midi(38), midi(45), midi(50), midi(54), midi(57)], { vel: 0.14, attack: 0.42, hold: 0.5, rel: 1.5, open: 2300, closed: 180, send: 0.55, onDone: done });
    bell(d, t + 0.42, midi(62), 0.07, 4);
  },
  ward(d, t, done) {
    tone(d, t, { freq: 440, peak: 0.07, attack: 0.07, dur: 0.75, send: 0.5 });
    tone(d, t, { freq: 661.5, peak: 0.04, attack: 0.09, dur: 0.7, send: 0.5 });
    tone(d, t, { type: 'triangle', freq: 880, detune: 6, peak: 0.02, attack: 0.1, dur: 0.6 });
    noise(d, t, { dur: 0.45, attack: 0.08, peak: 0.016, filter: 'highpass', freq: 5000, q: 0.7 });
    bell(d, t + 0.04, 1320, 0.03, 1.4, 0.7, done);
  },
  victory(d, t, done) {
    brass(d, t, [midi(62)], { vel: 0.09, attack: 0.04, hold: 0.08, rel: 0.25, open: 2200 });
    brass(d, t + 0.16, [midi(66)], { vel: 0.09, attack: 0.04, hold: 0.08, rel: 0.25, open: 2200 });
    brass(d, t + 0.32, [midi(69)], { vel: 0.1, attack: 0.04, hold: 0.08, rel: 0.25, open: 2300 });
    brass(d, t + 0.5, [midi(50), midi(62), midi(66), midi(69), midi(74)], { vel: 0.12, attack: 0.08, hold: 0.9, rel: 1.6, open: 2500, send: 0.55, onDone: done });
    taiko(d, t + 0.5, 0.45, 110, 42, 0.9);
    bell(d, t + 0.5, midi(74), 0.06, 3.5);
    bell(d, t + 0.62, midi(81), 0.04, 3);
  },
  defeat(d, t, done) {
    [50, 53, 57].forEach((m, i) =>
      tone(d, t, { type: 'sawtooth', freq: midi(m), freqTo: midi(m - 2), glide: 2.2, peak: 0.045, attack: 0.35, dur: 2.8, cutoff: 700, cutoffTo: 220, sweep: 2.6, detune: i * 3, send: 0.5 }),
    );
    bell(d, t + 0.15, midi(38), 0.16, 5, 0.5, done);
  },
  hurt(d, t, done) {
    tone(d, t, { freq: 140, freqTo: 58, glide: 0.18, peak: 0.3, attack: 0.003, dur: 0.24 });
    tone(d, t, { type: 'sawtooth', freq: 92, peak: 0.05, attack: 0.01, dur: 0.22, cutoff: 420 });
    noise(d, t, { dur: 0.15, peak: 0.16, filter: 'lowpass', freq: 650, q: 0.6, onDone: done });
  },
  fire(d, t, done) {
    noise(d, t, { dur: 0.9, attack: 0.28, peak: 0.24, filter: 'lowpass', freq: 180, freqTo: 900, sweep: 0.35, q: 0.7, brown: true });
    for (let i = 0; i < 7; i += 1) crackle(d, t + 0.15 + Math.random() * 0.7, rand(0.04, 0.09));
    tone(d, t, { type: 'triangle', freq: midi(55), peak: 0.03, attack: 0.3, dur: 1.4, send: 0.5, onDone: done });
  },
  page(d, t, done) {
    noise(d, t, { dur: 0.2, attack: 0.07, peak: 0.07, filter: 'bandpass', freq: 2300, freqTo: 4600, q: 0.8, pan: -0.2, panTo: 0.25 });
    noise(d, t + 0.13, { dur: 0.11, attack: 0.01, peak: 0.05, filter: 'bandpass', freq: 1600, q: 1, pan: 0.25, onDone: done });
  },
  legacy(d, t, done) {
    bell(d, t, midi(62), 0.11, 4);
    bell(d, t + 0.18, midi(69), 0.06, 3.5);
    choirSwell(d, t, [midi(50), midi(54), midi(57), midi(62)], { vel: 0.05, attack: 0.5, dur: 2.4, onDone: done });
  },
  passing(d, t, done) {
    bell(d, t, midi(38), 0.2, 6);
    bell(d, t + 0.02, midi(50), 0.07, 5);
    choirSwell(d, t + 0.1, [midi(50), midi(53), midi(57), midi(62)], { vel: 0.05, attack: 0.9, dur: 3.6, onDone: done });
  },
  error(d, t, done) {
    tone(d, t, { type: 'triangle', freq: 196, freqTo: 174, peak: 0.08, attack: 0.005, dur: 0.22, cutoff: 900 });
    tone(d, t + 0.1, { type: 'triangle', freq: 165, peak: 0.07, attack: 0.005, dur: 0.28, cutoff: 800, onDone: done });
  },
};
// gentle aliases so screens can use natural names
SFX.select = SFX.click;
SFX.back = SFX.click;
SFX.cancel = SFX.click;
SFX.toggle = SFX.click;
SFX.open = SFX.page;
SFX.close = SFX.click;
SFX.save = SFX.chronicle;
SFX.block = SFX.parry;
SFX.guard = SFX.parry;
SFX.miss = SFX.dodge;
SFX.swing = SFX.strike;
SFX.heal = SFX.ward;
SFX.shield = SFX.ward;
SFX.warning = SFX.heavy_warn;
SFX.notify = SFX.confirm;

// ---------------------------------------------------------------- ambient layers
function layerStart(th, ...srcs) {
  const t = ctx.currentTime;
  for (const s of srcs) {
    s.start(t);
    th.srcs.push(s);
  }
}

/** Low string drone: detuned saws per pitch → low-pass breathing on a slow LFO. */
function droneLayer(th, freqs, { type = 'sawtooth', cutoff = 520, q = 0.5, level = 0.04, detune = 7, lfoRate = 0.06, lfoDepth = 160, swell = 0.28, sub = 0 } = {}) {
  const out = gainNode(level);
  const lp = biquad('lowpass', cutoff, q);
  lp.connect(out);
  out.connect(th.bus);
  const lfo = oscNode('sine', lfoRate);
  const lfoG = gainNode(lfoDepth);
  lfo.connect(lfoG);
  lfoG.connect(lp.frequency);
  const lfo2 = oscNode('sine', lfoRate * 0.71);
  const lfo2G = gainNode(level * swell);
  lfo2.connect(lfo2G);
  lfo2G.connect(out.gain);
  th.all.push(out, lp, lfo, lfoG, lfo2, lfo2G);
  const oscs = [];
  freqs.forEach((f) => {
    for (const det of [-detune, detune]) {
      const o = oscNode(type, f);
      o.detune.value = det + (th.rng() - 0.5) * 3;
      o.connect(lp);
      oscs.push(o);
    }
  });
  if (sub) {
    const s = oscNode('sine', freqs[0] / 2);
    const sg = gainNode(sub);
    s.connect(sg);
    sg.connect(out);
    oscs.push(s);
    th.all.push(sg);
  }
  th.all.push(...oscs);
  layerStart(th, lfo, lfo2, ...oscs);
  return {
    set(next, t, glide = 2) {
      oscs.forEach((o, i) => {
        const f = next[Math.floor(i / 2) % next.length];
        if (f) o.frequency.setTargetAtTime(f, t, glide / 3);
      });
    },
  };
}

/** Sustained choir pad: saw voices through 'ah' formants, with vibrato; voices glide between chords. */
function choirLayer(th, freqs, level = 0.022) {
  const out = gainNode(level);
  const mix = gainNode(1);
  const f1 = biquad('bandpass', 720, 3);
  const f2 = biquad('bandpass', 1180, 4.5);
  const body = biquad('lowpass', 760, 0.5);
  const bodyG = gainNode(0.32);
  mix.connect(f1);
  mix.connect(f2);
  mix.connect(body);
  body.connect(bodyG);
  f1.connect(out);
  f2.connect(out);
  bodyG.connect(out);
  out.connect(th.bus);
  const vib = oscNode('sine', 4.6);
  const vibG = gainNode(5);
  vib.connect(vibG);
  const breath = oscNode('sine', 0.075);
  const breathG = gainNode(level * 0.35);
  breath.connect(breathG);
  breathG.connect(out.gain);
  th.all.push(out, mix, f1, f2, body, bodyG, vib, vibG, breath, breathG);
  const oscs = [];
  freqs.forEach((f) => {
    for (const det of [-7, 8]) {
      const o = oscNode('sawtooth', f);
      o.detune.value = det;
      vibG.connect(o.detune);
      o.connect(mix);
      oscs.push(o);
    }
  });
  th.all.push(...oscs);
  layerStart(th, vib, breath, ...oscs);
  return {
    set(next, t, glide = 1.6) {
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(next[Math.floor(i / 2) % next.length], t, glide / 3));
    },
  };
}

function windLayer(th, level = 0.05) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bp = biquad('bandpass', 520, 0.9);
  const out = gainNode(level);
  src.connect(bp);
  bp.connect(out);
  out.connect(th.bus);
  const sweep = oscNode('sine', 0.071);
  const sweepG = gainNode(280);
  sweep.connect(sweepG);
  sweepG.connect(bp.frequency);
  const gust = oscNode('sine', 0.113);
  const gustG = gainNode(level * 0.6);
  gust.connect(gustG);
  gustG.connect(out.gain);
  const low = ctx.createBufferSource();
  low.buffer = brownBuf;
  low.loop = true;
  const lowF = biquad('lowpass', 240, 0.6);
  const lowG = gainNode(level * 0.9);
  low.connect(lowF);
  lowF.connect(lowG);
  lowG.connect(th.bus);
  th.all.push(src, bp, out, sweep, sweepG, gust, gustG, low, lowF, lowG);
  layerStart(th, src, sweep, gust, low);
}

function fireLayer(th, level = 0.05) {
  const src = ctx.createBufferSource();
  src.buffer = brownBuf;
  src.loop = true;
  const lp = biquad('lowpass', 360, 0.6);
  const out = gainNode(level);
  src.connect(lp);
  lp.connect(out);
  out.connect(th.bus);
  const lfo = oscNode('sine', 0.37);
  const lfoG = gainNode(level * 0.35);
  lfo.connect(lfoG);
  lfoG.connect(out.gain);
  th.all.push(src, lp, out, lfo, lfoG);
  layerStart(th, src, lfo);
}

/** Recurring event: fn(t, rng) schedules at t and returns seconds until the next call. */
function every(th, firstDelay, fn) {
  th.sched.push({ next: th.t0 + firstDelay, fn });
}

const DORIAN_D = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
const MIXO_G = [55, 57, 59, 60, 62, 64, 65, 67];

const THEMES = {
  title(th) {
    droneLayer(th, [midi(38), midi(45)], { cutoff: 640, level: 0.05, sub: 0.25 });
    const chords = [
      [50, 54, 57, 62],
      [52, 56, 59, 64],
      [50, 54, 57, 62],
      [45, 52, 57, 61],
    ];
    let ci = 0;
    const ch = choirLayer(th, chords[0].map(midi), 0.02);
    every(th, 8, (t) => {
      ci = (ci + 1) % chords.length;
      ch.set(chords[ci].map(midi), t, 2.4);
      return 8;
    });
    every(th, 1.4, (t, r) => {
      const base = chords[ci];
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i += 1) {
        const m = base[i % 4] + 12 * (1 + Math.floor(i / 4)) - (base[i % 4] > 60 ? 12 : 0);
        pluck(th.bus, t + i * 0.2 + r() * 0.02, midi(m), 0.07 + r() * 0.035, 2.4, 2400);
      }
      return 5.5 + r() * 3.5;
    });
    every(th, 10, (t, r) => {
      bell(th.bus, t, midi(r() < 0.5 ? 74 : 81), 0.03, 4, 0.7);
      return 12 + r() * 8;
    });
  },
  war_room(th) {
    droneLayer(th, [midi(38), midi(45)], { cutoff: 470, level: 0.055, lfoRate: 0.05, sub: 0.3 });
    droneLayer(th, [midi(57), midi(62)], { cutoff: 1150, level: 0.007, lfoRate: 0.11, lfoDepth: 300, swell: 0.6 });
    every(th, 2.2, (t, r) => {
      const n = 1 + Math.floor(r() * 3);
      let idx = Math.floor(r() * (DORIAN_D.length - 3));
      for (let i = 0; i < n; i += 1) {
        pluck(th.bus, t + i * (0.3 + r() * 0.18), midi(DORIAN_D[idx]), 0.06 + r() * 0.04, 2.2, 2200);
        idx = Math.max(0, Math.min(DORIAN_D.length - 1, idx + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
      }
      return 2.8 + r() * 3.6;
    });
    every(th, 12, (t, r) => {
      bell(th.bus, t, midi(r() < 0.6 ? 50 : 45), 0.06, 4.5, 0.6);
      return 16 + r() * 10;
    });
  },
  march(th) {
    windLayer(th, 0.05);
    droneLayer(th, [midi(33), midi(40)], { cutoff: 360, level: 0.045, lfoRate: 0.04 });
    const beat = 60 / 72;
    let n = 0;
    every(th, 1, (t, r) => {
      const accent = n % 4 === 0;
      if (n % 2 === 0) taiko(th.bus, t, accent ? 0.16 : 0.08, accent ? 96 : 104, 58, 0.5);
      else if (r() < 0.35) noise(th.bus, t, { dur: 0.05, peak: 0.018, filter: 'bandpass', freq: 2200, q: 1.2 });
      n += 1;
      return beat;
    });
    every(th, 9, (t, r) => {
      brass(th.bus, t, [midi(57)], { vel: 0.035, attack: 0.35, hold: 0.55, rel: 0.9, open: 900, send: 0.8 });
      brass(th.bus, t + 1.3, [midi(64)], { vel: 0.03, attack: 0.3, hold: 0.9, rel: 1.2, open: 950, send: 0.8 });
      return 22 + r() * 12;
    });
  },
  duel(th) {
    droneLayer(th, [midi(40), midi(41)], { cutoff: 430, level: 0.035, lfoRate: 0.13, lfoDepth: 200, sub: 0.4 });
    droneLayer(th, [midi(64), midi(71)], { cutoff: 1500, level: 0.005, lfoRate: 0.2, lfoDepth: 400, swell: 0.8 });
    every(th, 0.3, (t) => {
      tone(th.bus, t, { freq: 62, freqTo: 44, glide: 0.12, peak: 0.12, attack: 0.004, dur: 0.18 });
      tone(th.bus, t + 0.21, { freq: 56, freqTo: 42, glide: 0.12, peak: 0.07, attack: 0.004, dur: 0.16 });
      return 1.05;
    });
    const beat = 60 / 96;
    let bar = 0;
    const patterns = [
      [[0, 0.5], [1.5, 0.3], [2, 0.4], [3, 0.3]],
      [[0, 0.5], [0.75, 0.22], [1.5, 0.3], [2.5, 0.35], [3, 0.3], [3.5, 0.25]],
      [[0, 0.5], [2, 0.42], [2.75, 0.22], [3.25, 0.25]],
    ];
    every(th, 0.6, (t, r) => {
      const p = bar % 4 === 3 ? patterns[1] : patterns[Math.floor(r() * patterns.length)];
      for (const [b, v] of p) taiko(th.bus, t + b * beat, v * 0.55, b === 0 ? 120 : 150, 48, 0.6);
      bar += 1;
      return beat * 4;
    });
  },
  campfire(th) {
    fireLayer(th, 0.055);
    droneLayer(th, [midi(43), midi(50)], { type: 'triangle', cutoff: 420, level: 0.03, lfoRate: 0.05, detune: 5 });
    every(th, 0.1, (t, r) => {
      crackle(th.bus, t, 0.02 + r() * 0.055);
      if (r() < 0.18) crackle(th.bus, t + 0.02 + r() * 0.04, 0.02 + r() * 0.03);
      return -Math.log(1 - r() * 0.98) * 0.14 + 0.015;
    });
    every(th, 3, (t, r) => {
      const n = 1 + Math.floor(r() * 2);
      let idx = Math.floor(r() * MIXO_G.length);
      for (let i = 0; i < n; i += 1) {
        lute(th.bus, t + i * 0.42, midi(MIXO_G[idx]), 0.05 + r() * 0.025);
        idx = (idx + 2) % MIXO_G.length;
      }
      return 4.5 + r() * 4;
    });
  },
  passing(th) {
    droneLayer(th, [midi(38)], { type: 'triangle', cutoff: 320, level: 0.04, lfoRate: 0.04, sub: 0.4 });
    const chords = [
      [50, 53, 57, 62],
      [46, 53, 58, 62],
      [43, 50, 55, 58],
      [45, 52, 57, 61],
    ];
    let ci = 0;
    const ch = choirLayer(th, chords[0].map(midi), 0.03);
    every(th, 9, (t) => {
      ci = (ci + 1) % chords.length;
      ch.set(chords[ci].map(midi), t, 2.6);
      return 9;
    });
    every(th, 4, (t, r) => {
      bell(th.bus, t, midi(r() < 0.7 ? 50 : 45), 0.1, 5.5, 0.7);
      return 12 + r() * 5;
    });
  },
};
THEMES.resolution = THEMES.war_room;
THEMES.expedition = THEMES.march;

function startTheme(name) {
  const build = THEMES[name];
  if (!build) return null;
  const t0 = ctx.currentTime;
  const bus = gainNode(0);
  bus.connect(G.music);
  const th = { name, bus, t0, srcs: [], all: [bus], sched: [], rng: mulberry32(hash(name)), stopped: false };
  build(th);
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.linearRampToValueAtTime(1, t0 + (name === 'duel' ? 0.9 : FADE_IN));
  return th;
}

function stopTheme(th, fade = FADE_OUT) {
  if (!th || th.stopped) return;
  th.stopped = true;
  const t = ctx.currentTime;
  const g = th.bus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(0.0001, t + fade);
  const end = t + fade + 0.1;
  for (const s of th.srcs) {
    try {
      s.stop(end);
    } catch {
      /* not started */
    }
  }
  // disconnect once the fade is over (wall clock; the context may be suspended meanwhile)
  const cleanup = () => {
    if (ctx && ctx.currentTime < end) {
      setTimeout(cleanup, 400);
      return;
    }
    for (const n of th.all) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
  };
  setTimeout(cleanup, fade * 1000 + 300);
}

function applyTheme() {
  if (!ctx || !G) return;
  const want = desiredTheme && THEMES[desiredTheme] ? desiredTheme : null;
  if ((current?.name ?? null) === want) return;
  if (current) stopTheme(current);
  current = want ? startTheme(want) : null;
  ensureTimer();
}

function tick() {
  if (!ctx || !current || ctx.state !== 'running') return;
  const horizon = ctx.currentTime + 0.8;
  for (const s of current.sched) {
    let guard = 0;
    while (s.next < horizon && guard < 64) {
      guard += 1;
      const t = Math.max(s.next, ctx.currentTime + 0.01);
      let dt = 1;
      try {
        dt = s.fn(t, current.rng);
      } catch {
        dt = 2;
      }
      s.next = t + Math.max(0.01, Number(dt) || 1);
    }
  }
}

function ensureTimer() {
  if (timer || !isBrowser) return;
  timer = setInterval(tick, 200);
}

// ---------------------------------------------------------------- unlock + lifecycle
function create() {
  if (ctx || !AC) return Boolean(ctx);
  try {
    ctx = new AC({ latencyHint: 'interactive' });
    build();
    applyMaster(0.01);
  } catch {
    ctx = null;
    G = null;
    return false;
  }
  return true;
}

function primeSilence() {
  // iOS Safari only unlocks after a buffer is played inside the gesture.
  try {
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
function onGesture() {
  unlock();
  if (ctx && (ctx.state === 'running' || prefs.muted)) {
    for (const e of GESTURES) window.removeEventListener(e, onGesture, true);
  }
}

function unlock() {
  if (!create()) return false;
  if (!unlocked) {
    unlocked = true;
    primeSilence();
  }
  syncRunState();
  applyTheme();
  return true;
}

if (isBrowser && AC) {
  for (const e of GESTURES) window.addEventListener(e, onGesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => syncRunState());
}

// ---------------------------------------------------------------- public API
export const audio = {
  unlock,
  setMuted(muted) {
    const m = Boolean(muted);
    if (m === prefs.muted) return;
    prefs.muted = m;
    savePrefs();
    syncRunState();
  },
  setVolume(v) {
    const vol = clamp01(v);
    if (vol === prefs.volume) return;
    prefs.volume = vol;
    savePrefs();
    if (ctx && !prefs.muted) applyMaster(0.08);
  },
  isMuted: () => prefs.muted,
  getVolume: () => prefs.volume,
  ambient(theme) {
    desiredTheme = theme && THEMES[theme] ? theme : null;
    if (ctx && unlocked) applyTheme();
  },
  sfx(name) {
    const fn = SFX[name];
    if (!fn || !ctx || !G || !wantRunning()) return;
    // the first cue of an unlocking gesture lands while resume() is still pending: schedule it anyway
    if (ctx.state !== 'running' && !(ctx.state === 'suspended' && nowMs() - resumeAskedAt < 1200)) return;
    const now = ctx.currentTime;
    const last = lastSfx.get(name);
    if (last != null && now - last < SFX_THROTTLE_S) return;
    if (sfxVoices >= MAX_SFX_VOICES) return;
    lastSfx.set(name, now);
    sfxVoices += 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sfxVoices = Math.max(0, sfxVoices - 1);
    };
    try {
      fn(G.sfx, now + 0.005, finish);
    } catch {
      finish();
    }
    // safety net in case a voice never reports back
    setTimeout(finish, 7000);
  },
  /** Current ambient theme name (or null). */
  getTheme: () => desiredTheme,
  /** The AudioContext, once unlocked (debug / visualisers). */
  context: () => ctx,
  /** Output level probe for tests and meters: { rms, peak } in 0..1. */
  levels() {
    if (!ctx || !G) return { rms: 0, peak: 0 };
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      G.master.connect(analyser);
    }
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    let peak = 0;
    for (const x of buf) {
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    return { rms: Math.sqrt(sum / buf.length), peak };
  },
  /** Names accepted by sfx(). */
  sfxNames: () => Object.keys(SFX),
};

/** Vibrate on supporting phones. Respects localStorage 'elvia.haptics' === 'off'. */
export function haptic(pattern = 12) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    if (store()?.getItem(HAPTICS_KEY) === 'off') return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export default audio;
