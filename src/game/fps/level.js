// The Greywater Front: the one mission of the first-person mode, as plain data.
//
// The Sovereign walks the frontier road south, breaks the Syndicate picket, takes back the
// Greywater checkpoint, wades the ford under a walker's searchlight and brings the walker down
// in the burning depot. Everything the simulation collides with and everything the renderer
// draws comes from here, so the two can never disagree.
//
// Axes: x east, y up, z south-to-north reversed (the player starts near z = +30 and advances
// toward negative z). Units are metres.

import { clamp01, fbm, hash2, lerp, smooth } from './noise.js';

export const WATER_Y = -0.55;
export const BOUNDS = Object.freeze({ minX: -35.5, maxX: 35.5, minZ: -214, maxZ: 42 });
export const RIVER_Z = -128;

/** Centre line of the frontier road. */
export function roadX(z) {
  return 3.2 * Math.sin(z * 0.021) + 1.4 * Math.sin(z * 0.047 + 1.3);
}

export function riverCentreZ(x) {
  return RIVER_Z + 3.5 * Math.sin(x * 0.07);
}

// Levelled ground under the two built-up areas.
export const PADS = Object.freeze([
  { id: 'checkpoint', minX: -31, maxX: 31, minZ: -101, maxZ: -59, y: 0.35 },
  { id: 'depot', minX: -33, maxX: 33, minZ: -213, maxZ: -157, y: 0.6 },
]);

export function padMask(x, z, pad, margin = 6) {
  const mx = Math.min(smooth(pad.minX - margin, pad.minX, x), 1 - smooth(pad.maxX, pad.maxX + margin, x));
  const mz = Math.min(smooth(pad.minZ - margin, pad.minZ, z), 1 - smooth(pad.maxZ, pad.maxZ + margin, z));
  return Math.min(mx, mz);
}

/** 0..1: how much of the road surface is under (x, z). */
export function roadMask(x, z) {
  return 1 - smooth(1.9, 4.6, Math.abs(x - roadX(z)));
}

/** 0..1: how deep into the river channel (x, z) is. */
export function riverMask(x, z) {
  return 1 - smooth(6.5, 12.5, Math.abs(z - riverCentreZ(x)));
}

/** Terrain height. Pure and cheap: the simulation calls it every tick for every walker. */
export function groundY(x, z) {
  let h = (fbm(x * 0.045, z * 0.045, 3, 11) - 0.5) * 2.6 + (fbm(x * 0.22, z * 0.22, 2, 5) - 0.5) * 0.22 + 0.55;
  const road = roadMask(x, z);
  const roadBase = 0.3 + (fbm(z * 0.03, 7.3, 2, 23) - 0.5) * 0.7;
  h = lerp(h, roadBase, road * 0.9);
  for (const pad of PADS) h = lerp(h, pad.y, padMask(x, z, pad));
  const river = riverMask(x, z);
  if (river > 0) {
    const ford = 1 - smooth(3.5, 8, Math.abs(x - roadX(z)));
    h = lerp(h, lerp(-1.95, -0.92, ford), river);
  }
  h += smooth(31, 43, Math.abs(x)) * 10;
  return h;
}

/** What the ground is made of at (x, z): footsteps, impacts and terrain colour all use it. */
export function surfaceAt(x, z) {
  const y = groundY(x, z);
  if (y < WATER_Y - 0.05) return 'water';
  if (riverMask(x, z) > 0.25) return 'mud';
  for (const pad of PADS) if (padMask(x, z, pad, 2) > 0.5) return pad.id === 'depot' ? 'gravel' : 'dirt';
  if (roadMask(x, z) > 0.5) return 'road';
  return 'grass';
}

// ───────────────────────────────────────────────────────────────── builder

function makeBuilder() {
  const solids = [];
  const add = (kind, x, z, w, d, h, opts = {}) => {
    const y = opts.y ?? groundY(x, z) - (opts.sink ?? 0.08);
    const s = { id: opts.id ?? `${kind}_${solids.length}`, kind, x, z, w, d, h, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h, ...opts, y };
    solids.push(s);
    return s;
  };
  return { solids, add };
}

function palisade(add, z, fromX, toX, opts = {}) {
  const seg = 4;
  for (let x = fromX; x < toX - 0.01; x += seg) {
    const w = Math.min(seg, toX - x);
    add('palisade', x + w / 2, z, w, 0.7, 4.3, { sink: 0.5, ...opts });
  }
}

let cached = null;

/** Build (once) and return the level. */
export function buildLevel() {
  if (cached) return cached;
  const { solids, add } = makeBuilder();
  const rx = (z) => roadX(z);

  // ── Start: the Elvian staging point ───────────────────────────────────────────
  add('wagon', rx(26) + 5.5, 27, 2.2, 4.4, 2.3, { variant: 'elvian' });
  add('crate', rx(22) - 5, 22, 1.3, 1.3, 1.3);
  add('crate', rx(22) - 6.4, 22.6, 1.1, 1.1, 1.1);
  add('rock', -15, 14, 3.6, 3, 2.2);
  add('rock', 17, 6, 2.8, 3.2, 1.8);

  // ── A: the forward picket on the frontier road ───────────────────────────
  add('wall', -9, -30, 8, 0.8, 1.15);
  add('wall', 10.5, -36, 7, 0.8, 1.15);
  add('wall', -3, -44.5, 6, 0.8, 1.15);
  add('cart', rx(-25) + 3.4, -24.5, 3.4, 1.9, 1.5);
  add('barricade', rx(-40), -40, 5.2, 1.1, 1.25);
  add('crate', 13.2, -42.4, 1.4, 1.4, 1.4);
  add('crate', 14.5, -42, 1.1, 1.1, 1.1);
  add('crate', -13, -38.2, 1.4, 1.4, 1.4);
  add('rock', -19, -21, 3.4, 2.8, 2.0);
  add('rock', 21, -27, 3, 3.4, 2.4);
  add('rock', 6, -12, 2.4, 2, 1.3);
  add('log', -6, -17, 4.6, 0.8, 0.75);

  // ── B: the Greywater checkpoint ──────────────────────────────────────────────
  const gateA = rx(-58);
  palisade(add, -58, -36, gateA - 5.5);
  palisade(add, -58, gateA + 5.5, 36);
  add('gatetower', gateA - 4.6, -58, 2.6, 2.6, 7.2, { sink: 0.3 });
  add('gatetower', gateA + 4.6, -58, 2.6, 2.6, 7.2, { sink: 0.3 });
  add('hut', -15, -73, 7, 5.4, 3.3, { sink: 0.15 });
  add('watchtower', 16, -67, 3.6, 3.6, 2.6, { sink: 0.1 });
  add('tent', -21, -89, 4.2, 4.6, 2.5);
  add('tent', -11.5, -91.5, 4.2, 4.6, 2.5);
  add('sandbag', -6.5, -70, 5, 1, 1.15);
  add('sandbag', 7.5, -75, 5, 1, 1.15);
  add('sandbag', 19, -84, 4.4, 1, 1.15);
  add('well', 4.5, -82.5, 2.2, 2.2, 1.05);
  add('crate', -3, -86, 1.5, 1.5, 1.5);
  add('crate', -1.5, -86.4, 1.2, 1.2, 1.2);
  add('crate', -2.6, -84.6, 1.2, 1.2, 1.2);
  add('crate', 24, -72, 1.6, 1.6, 1.6);
  add('crate', 24.2, -70.2, 1.2, 1.2, 1.2);
  add('crate', 12, -93, 1.5, 1.5, 1.5);
  add('cart', -25, -66, 3.4, 1.9, 1.5);
  add('wagon', 25.5, -92, 2.2, 4.4, 2.3, { variant: 'syndicate' });
  const gateB = rx(-102);
  palisade(add, -102, -36, gateB - 4.5);
  palisade(add, -102, gateB + 4.5, 36);
  add('gatetower', gateB - 5.6, -102, 2.4, 2.4, 6.4, { sink: 0.3 });
  add('gatetower', gateB + 5.6, -102, 2.4, 2.4, 6.4, { sink: 0.3 });
  add('gate', gateB, -102, 9, 0.6, 4.4, { id: 'inner_gate', sink: 0.2 });
  add('winch', gateB + 8.6, -98.4, 1.3, 1.3, 1.2, { id: 'winch' });

  // ── C: the ford ──────────────────────────────────────────────────────────────
  add('rock', -8.5, -111.5, 3.2, 2.6, 1.7);
  add('rock', 9.5, -110, 2.8, 2.6, 1.5);
  add('log', rx(-114) - 1, -114.5, 5, 0.8, 0.8);
  add('rock', -5, -124.5, 2.8, 2.4, 1.9, { y: WATER_Y - 0.7 });
  add('rock', 6, -131, 2.6, 2.8, 2.0, { y: WATER_Y - 0.7 });
  add('rock', -18, -128, 3.4, 3, 2.3, { y: WATER_Y - 0.9 });
  add('rock', 20, -126, 3, 3.2, 2.2, { y: WATER_Y - 0.9 });
  add('sandbag', -10, -144.5, 6, 1, 1.15);
  add('sandbag', 9, -145.5, 6, 1, 1.15);
  add('wagon', 3.5, -151, 2.2, 4.4, 2.3, { variant: 'wreck' });
  add('rock', -22, -146, 3.2, 3, 1.9);
  add('rock', 24, -149, 3, 2.8, 2.0);

  // ── D: the depot ─────────────────────────────────────────────────────────────
  const gateD = rx(-156);
  palisade(add, -156, -36, gateD - 6);
  palisade(add, -156, gateD + 6, 36);
  add('gatetower', gateD - 7, -156, 2.4, 2.4, 6.4, { sink: 0.3 });
  add('gatetower', gateD + 7, -156, 2.4, 2.4, 6.4, { sink: 0.3 });
  add('shed', -23, -171, 11, 7.5, 4.6, { burning: true, sink: 0.15 });
  add('shed', 23.5, -178, 11, 7.5, 4.6, { sink: 0.15 });
  add('shed', -21, -203, 12, 7.5, 4.6, { sink: 0.15 });
  add('crane', 20, -202, 3, 3, 9, { sink: 0.2 });
  add('block', -6, -166, 2.6, 2.2, 1.5);
  add('block', 9, -169, 2.4, 2.4, 2.7);
  add('block', -11, -183, 2.4, 2.6, 2.7);
  add('block', 12.5, -186, 2.8, 2.2, 1.5);
  add('block', -3, -200, 2.6, 2.4, 2.7);
  add('block', 6.5, -197, 2.4, 2.4, 1.5);
  add('crate', -14.5, -176, 1.6, 1.6, 1.6);
  add('crate', -14.2, -177.8, 1.3, 1.3, 1.3);
  add('crate', 16, -170, 1.6, 1.6, 1.6);
  add('crate', 2, -208, 1.6, 1.6, 1.6);
  add('crate', 3.7, -208.3, 1.3, 1.3, 1.3);
  add('fuel', -8.5, -171, 0.9, 0.9, 1.25, { id: 'fuel_1' });
  add('fuel', -7.5, -171.8, 0.9, 0.9, 1.25, { id: 'fuel_2' });
  add('fuel', 14, -192, 0.9, 0.9, 1.25, { id: 'fuel_3' });
  add('fuel', -15, -193.5, 0.9, 0.9, 1.25, { id: 'fuel_4' });
  add('fuel', -15.9, -192.6, 0.9, 0.9, 1.25, { id: 'fuel_5' });
  add('fuel', 5.5, -180, 0.9, 0.9, 1.25, { id: 'fuel_6' });
  palisade(add, -214.5, -36, 36);

  // ── Trees: a pine wood on both flanks, a few inside the lines for cover ────────
  const trees = [];
  for (let gz = BOUNDS.maxZ + 14; gz > BOUNDS.minZ - 22; gz -= 4.2) {
    for (let gx = -62; gx <= 62; gx += 4.2) {
      const jx = gx + (hash2(gx * 10, gz * 10, 3) - 0.5) * 3.4;
      const jz = gz + (hash2(gx * 10, gz * 10, 4) - 0.5) * 3.4;
      const ax = Math.abs(jx);
      const inside = ax < 30 && jz < BOUNDS.maxZ && jz > BOUNDS.minZ;
      const density = inside ? 0.055 : 0.2 + smooth(30, 44, ax) * 0.62;
      if (hash2(gx * 10, gz * 10, 5) > density) continue;
      if (roadMask(jx, jz) > 0.02 || riverMask(jx, jz) > 0.02) continue;
      if (PADS.some((p) => padMask(jx, jz, p, 3) > 0.02)) continue;
      if (jz > 12 && ax < 12) continue;
      const scale = 0.75 + hash2(gx * 10, gz * 10, 6) * 0.75;
      const tree = { x: jx, z: jz, y: groundY(jx, jz), scale, yaw: hash2(gx * 10, gz * 10, 7) * 6.283, dead: hash2(gx * 10, gz * 10, 8) < 0.08 };
      trees.push(tree);
      if (ax < 37 && jz < BOUNDS.maxZ + 2 && jz > BOUNDS.minZ - 2) add('trunk', jx, jz, 0.7 * scale, 0.7 * scale, 5, { sink: 0.2, hidden: true });
    }
  }

  // ── Lights, fires, banners (drawn by the renderer; the lamps matter to the story of the place) ─
  const lamps = [
    { x: rx(20) - 3.4, z: 20, kind: 'post' },
    { x: gateA - 6.8, z: -59.6, kind: 'post' },
    { x: gateA + 6.8, z: -59.6, kind: 'post' },
    { x: -9.5, z: -75.8, kind: 'post' },
    { x: 11, z: -88, kind: 'post' },
    { x: gateB - 7.5, z: -100.2, kind: 'post' },
    { x: -13, z: -147.5, kind: 'post' },
    { x: gateD + 9, z: -158, kind: 'post' },
    { x: 15, z: -168, kind: 'post' },
    { x: -9, z: -196, kind: 'post' },
    { x: 26, z: -196, kind: 'post' },
  ].map((l) => ({ ...l, y: groundY(l.x, l.z) }));
  const fires = [
    { x: rx(24) - 4.5, z: 25.5, size: 0.7, kind: 'campfire' },
    { x: 2.5, z: -34, size: 0.6, kind: 'brazier' },
    { x: -19, z: -80, size: 0.7, kind: 'campfire' },
    { x: 8, z: -68.5, size: 0.55, kind: 'brazier' },
    { x: -23, z: -171, size: 2.6, kind: 'blaze' },
    { x: -19, z: -169, size: 1.8, kind: 'blaze' },
    { x: 3.5, z: -151, size: 1.2, kind: 'blaze' },
    { x: 16, z: -207, size: 0.6, kind: 'brazier' },
  ].map((f) => ({ ...f, y: groundY(f.x, f.z) }));
  const banners = [
    { x: rx(30) + 3.5, z: 31, faction: 'elvia' },
    { x: rx(30) - 3.5, z: 31, faction: 'elvia' },
    { x: gateA - 4.6, z: -58, faction: 'syndicate', onTower: 7.2 },
    { x: gateA + 4.6, z: -58, faction: 'syndicate', onTower: 7.2 },
    { x: -15, z: -70, faction: 'syndicate' },
    { x: gateD - 7, z: -156, faction: 'syndicate', onTower: 6.4 },
    { x: gateD + 7, z: -156, faction: 'syndicate', onTower: 6.4 },
  ].map((b) => ({ ...b, y: groundY(b.x, b.z) }));

  // ── Enemies ────────────────────────────────────────────────────────────────
  // `cover` is where a rifleman fights from; riflemen relocate between the covers of their group.
  const enemies = [];
  const foe = (type, group, x, z, opts = {}) => {
    enemies.push({ id: `${group}_${enemies.length}`, type, group, x, z, ...opts });
  };
  foe('rifleman', 'A', -9, -31.4);
  foe('rifleman', 'A', 10.5, -37.4);
  foe('rifleman', 'A', -3, -45.9);
  foe('rifleman', 'A', 13.8, -43.9);
  foe('rifleman', 'A', -13, -39.7);
  foe('trooper', 'A', 2, -49);

  foe('rifleman', 'B', -6.5, -71.4);
  foe('rifleman', 'B', 7.5, -76.4);
  foe('rifleman', 'B', 19, -85.4);
  foe('rifleman', 'B', 24.2, -73.8);
  foe('rifleman', 'B', -2.8, -87.9);
  foe('rifleman', 'B', 16, -67, { static: true, elev: 5.35 });
  foe('trooper', 'B', -18, -78);
  foe('trooper', 'B', 10, -92);
  foe('heavy', 'B2', -21, -95.5, { dormant: true });
  foe('rifleman', 'B2', -25, -92, { dormant: true });
  foe('rifleman', 'B2', 27, -96, { dormant: true });
  foe('trooper', 'B2', 28, -88, { dormant: true });

  foe('rifleman', 'C', -11.5, -146);
  foe('rifleman', 'C', -8, -146);
  foe('rifleman', 'C', 8, -147);
  foe('rifleman', 'C', 11, -147);
  foe('heavy', 'C', 0.5, -149.5);
  foe('trooper', 'C2', -16, -143, { dormant: true });
  foe('trooper', 'C2', 15, -142, { dormant: true });
  foe('trooper', 'C2', 1, -141, { dormant: true });

  foe('walker', 'W', 2, -188);
  foe('rifleman', 'D', -24, -196, { dormant: true });
  foe('rifleman', 'D', 25, -190, { dormant: true });
  foe('rifleman', 'D', -9, -209, { dormant: true });
  foe('rifleman', 'D', 11, -210, { dormant: true });
  foe('trooper', 'D', 0, -211, { dormant: true });

  const covers = {
    A: [[-9, -31.4], [10.5, -37.4], [-3, -45.9], [13.8, -43.9], [-13, -39.7], [rx(-40), -41.4], [-19, -23], [21, -29.2]],
    B: [[-6.5, -71.4], [7.5, -76.4], [19, -85.4], [24.2, -73.8], [-2.8, -87.9], [4.5, -84.4], [12, -94.6], [-15, -77], [-25, -67.6]],
    B2: [[-6.5, -71.4], [7.5, -76.4], [19, -85.4], [-2.8, -87.9], [12, -94.6], [4.5, -84.4]],
    C: [[-11.5, -146], [-8, -146], [8, -147], [11, -147], [3.5, -154], [-22, -147.8], [24, -150.8]],
    C2: [],
    D: [[-6, -167.6], [9, -171], [-11, -185], [12.5, -187.6], [-3, -202], [6.5, -198.6], [2, -209.6], [-14.5, -179.4]],
  };

  // ── Pickups ────────────────────────────────────────────────────────────────
  const pickups = [];
  const pick = (kind, x, z, extra = {}) => pickups.push({ id: `${kind}_${pickups.length}`, kind, x, z, y: groundY(x, z), ...extra });
  pick('dispatch', rx(22) - 5, 20.4, { lore: 'orders' });
  pick('cells', rx(-25) + 3.4, -26.4);
  pick('dispatch', -13, -36.6, { lore: 'picket' });
  pick('draught', 13.5, -40.6);
  pick('cells', -15, -69.6);
  pick('charges', 16, -64.4);
  pick('dispatch', -17, -77.2, { lore: 'ledger' });
  pick('draught', -21, -86);
  pick('cells', 24, -68.6);
  pick('cells', 12, -91.2);
  pick('charges', -8.5, -109.4);
  pick('draught', 9.5, -108);
  pick('dispatch', 3.5, -153.8, { lore: 'wagon' });
  pick('cells', -10, -147.2);
  pick('charges', 9, -148.2);
  pick('draught', gateD - 3, -159);
  pick('cells', -6, -163.2);
  pick('cells', 9, -166.2);
  pick('charges', -11, -180.4);
  pick('draught', 12.5, -183.8);
  pick('cells', -3, -197.6);
  pick('charges', 6.5, -194.8);
  pick('draught', 2, -205.6);
  pick('dispatch', 21, -198, { lore: 'pilot' });

  // ── Bot route (tests and the attract camera walk the same path a player would) ─────
  const route = [
    [rx(30), 30], [rx(10), 10], [rx(-8), -8], [rx(-20) - 4, -20], [rx(-33) - 3, -33], [rx(-50), -50], [gateA, -58],
    [gateA, -64], [1, -79], [gateB + 3, -92], [gateB + 7.4, -97.2], [gateB, -99], [gateB, -106], [rx(-116), -116],
    [rx(-128), -128], [rx(-140), -140], [-2, -149], [gateD, -156], [gateD, -162], [1, -174],
  ];

  cached = Object.freeze({
    name: 'The Greywater Front',
    solids: Object.freeze(solids),
    trees: Object.freeze(trees),
    lamps: Object.freeze(lamps),
    fires: Object.freeze(fires),
    banners: Object.freeze(banners),
    enemies: Object.freeze(enemies),
    covers: Object.freeze(covers),
    pickups: Object.freeze(pickups),
    route: Object.freeze(route),
    gates: Object.freeze({ gateA, gateB, gateD }),
    // the three openings in the palisades: anything that walks must go through them
    gateLines: Object.freeze([
      { z: -58, x: gateA, half: 3.3 },
      { z: -102, x: gateB, half: 4.4 },
      { z: -156, x: gateD, half: 5.8 },
    ]),
    start: Object.freeze({ x: rx(30), z: 30, yaw: 0 }),
    winch: Object.freeze({ x: gateB + 8.6, z: -98.4 }),
  });
  return cached;
}

/**
 * Where to walk right now to get from (x, z) to (tx, tz): straight there, unless a palisade
 * lies between, in which case toward (then through) its gate. Writes into `out`.
 */
export function steerThroughGates(level, x, z, tx, tz, out) {
  out.x = tx;
  out.z = tz;
  let best = null;
  for (const g of level.gateLines) {
    if ((z - g.z) * (tz - g.z) >= 0) continue;
    if (!best || Math.abs(z - g.z) < Math.abs(z - best.z)) best = g;
  }
  if (!best) return out;
  const side = z > best.z ? 1 : -1;
  const lane = best.half - 0.9;
  if (Math.abs(x - best.x) < lane && Math.abs(z - best.z) < 3) {
    out.x = Math.max(best.x - lane, Math.min(best.x + lane, x));
    out.z = best.z - side * 2;
  } else {
    out.x = best.x;
    out.z = best.z + side * 1.8;
  }
  return out;
}

/** Depth of water above the river bed at (x, z); 0 on dry ground. */
export function waterDepth(x, z) {
  return Math.max(0, WATER_Y - groundY(x, z));
}

export const _test = { padMask, clamp01 };
