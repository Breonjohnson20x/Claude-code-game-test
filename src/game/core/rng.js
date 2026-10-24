// Deterministic seeded RNG (mulberry32). The simulation never calls Math.random:
// every random draw comes from state.rngSeed so a turn replays identically.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngStep(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, seed: t };
}

// Mutable wrapper for use inside one pure transition. Read `.seed` back into state afterwards.
export function makeRng(seed) {
  const rng = {
    seed: seed >>> 0,
    next() {
      const step = rngStep(rng.seed);
      rng.seed = step.seed;
      return step.value;
    },
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(rng.next() * list.length)];
    },
    chance(p) {
      return rng.next() < p;
    },
  };
  return rng;
}

// Draw from state without mutating it: returns [value, nextState].
export function withRng(state, fn) {
  const rng = makeRng(state.rngSeed);
  const value = fn(rng);
  return [value, { ...state, rngSeed: rng.seed }];
}
