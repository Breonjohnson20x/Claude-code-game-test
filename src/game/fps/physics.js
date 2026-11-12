// Collision and ray queries for the first-person simulation. Pure functions over the level's
// axis-aligned solids and the terrain height function; no allocation in the hot paths.

import { groundY } from './level.js';

/** A solid stops things unless it was destroyed (fuel casks) or raised (the inner gate). */
export function solidActive(state, s) {
  if (state.removed[s.id]) return false;
  if (s.kind === 'gate') return (state.gates[s.id] ?? 0) < 0.75;
  return true;
}

/**
 * Height of the walkable floor under (x, z) for something whose feet are at `feetY`:
 * the terrain, or the top of any solid it stands on or can step up to.
 */
export function floorAt(state, x, z, feetY, stepH = 0.5, pad = 0.2) {
  let floor = groundY(x, z);
  const solids = state.level.solids;
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (x < s.minX - pad || x > s.maxX + pad || z < s.minZ - pad || z > s.maxZ + pad) continue;
    if (s.top > feetY + stepH || s.top <= floor) continue;
    if (s.kind === 'trunk' || !solidActive(state, s)) continue;
    floor = s.top;
  }
  return floor;
}

/**
 * Move a vertical cylinder (radius r, feet at ent.y, given height) by (dx, dz), sliding along
 * solids. Solids whose top is within `stepH` of the feet are walked onto, not bumped into.
 * Returns true if something blocked the move.
 */
export function moveCircle(state, ent, dx, dz, r, height, stepH = 0.5) {
  let nx = ent.x + dx;
  let nz = ent.z + dz;
  let blocked = false;
  const feet = ent.y;
  const solids = state.level.solids;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < solids.length; i += 1) {
      const s = solids[i];
      if (nx < s.minX - r || nx > s.maxX + r || nz < s.minZ - r || nz > s.maxZ + r) continue;
      if (s.top <= feet + stepH || s.y >= feet + height) continue;
      if (!solidActive(state, s)) continue;
      const cx = nx < s.minX ? s.minX : nx > s.maxX ? s.maxX : nx;
      const cz = nz < s.minZ ? s.minZ : nz > s.maxZ ? s.maxZ : nz;
      let ox = nx - cx;
      let oz = nz - cz;
      const d2 = ox * ox + oz * oz;
      if (d2 >= r * r) continue;
      blocked = true;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        nx = cx + (ox / d) * r;
        nz = cz + (oz / d) * r;
      } else {
        // centre is inside the box: leave by the nearest face
        const l = nx - s.minX;
        const rr = s.maxX - nx;
        const n = nz - s.minZ;
        const f = s.maxZ - nz;
        const m = Math.min(l, rr, n, f);
        ox = 0;
        oz = 0;
        if (m === l) nx = s.minX - r;
        else if (m === rr) nx = s.maxX + r;
        else if (m === n) nz = s.minZ - r;
        else nz = s.maxZ + r;
      }
    }
  }
  ent.x = nx;
  ent.z = nz;
  return blocked;
}

const HIT = { t: Infinity, nx: 0, ny: 0, nz: 0, solid: null };

/** Ray against one box. Returns the entry distance (or Infinity) and leaves the face normal in `out`. */
export function rayBox(ox, oy, oz, dx, dy, dz, s, maxT, out) {
  let tmin = -1e-7; // a ray that starts exactly on a face still enters through it
  let tmax = maxT;
  let axis = -1;
  let sign = 0;
  // x
  if (Math.abs(dx) < 1e-9) {
    if (ox < s.minX || ox > s.maxX) return Infinity;
  } else {
    let t1 = (s.minX - ox) / dx;
    let t2 = (s.maxX - ox) / dx;
    let sg = -1;
    if (t1 > t2) {
      const tt = t1;
      t1 = t2;
      t2 = tt;
      sg = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      axis = 0;
      sign = sg;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  // y
  if (Math.abs(dy) < 1e-9) {
    if (oy < s.y || oy > s.top) return Infinity;
  } else {
    let t1 = (s.y - oy) / dy;
    let t2 = (s.top - oy) / dy;
    let sg = -1;
    if (t1 > t2) {
      const tt = t1;
      t1 = t2;
      t2 = tt;
      sg = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      axis = 1;
      sign = sg;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  // z
  if (Math.abs(dz) < 1e-9) {
    if (oz < s.minZ || oz > s.maxZ) return Infinity;
  } else {
    let t1 = (s.minZ - oz) / dz;
    let t2 = (s.maxZ - oz) / dz;
    let sg = -1;
    if (t1 > t2) {
      const tt = t1;
      t1 = t2;
      t2 = tt;
      sg = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      axis = 2;
      sign = sg;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (axis < 0) return Infinity; // origin inside the box: ignore, so nothing gets stuck in cover
  if (out) {
    out.nx = axis === 0 ? sign : 0;
    out.ny = axis === 1 ? sign : 0;
    out.nz = axis === 2 ? sign : 0;
  }
  return tmin < 0 ? 0 : tmin;
}

/** Nearest solid along a ray. Returns a shared record: read it before the next call. */
export function raySolids(state, ox, oy, oz, dx, dy, dz, maxT) {
  HIT.t = Infinity;
  HIT.solid = null;
  const solids = state.level.solids;
  const tmp = raySolids.tmp;
  const ex = ox + dx * maxT;
  const ez = oz + dz * maxT;
  const loX = Math.min(ox, ex);
  const hiX = Math.max(ox, ex);
  const loZ = Math.min(oz, ez);
  const hiZ = Math.max(oz, ez);
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (s.maxX < loX || s.minX > hiX || s.maxZ < loZ || s.minZ > hiZ) continue;
    if (!solidActive(state, s)) continue;
    const t = rayBox(ox, oy, oz, dx, dy, dz, s, Math.min(maxT, HIT.t), tmp);
    if (t < HIT.t) {
      HIT.t = t;
      HIT.nx = tmp.nx;
      HIT.ny = tmp.ny;
      HIT.nz = tmp.nz;
      HIT.solid = s;
    }
  }
  return HIT;
}
raySolids.tmp = { nx: 0, ny: 0, nz: 0 };

/** True when nothing solid lies between two points. Tree trunks do not block sight. */
export function losClear(state, ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return true;
  const ix = dx / len;
  const iy = dy / len;
  const iz = dz / len;
  const solids = state.level.solids;
  const loX = Math.min(ax, bx);
  const hiX = Math.max(ax, bx);
  const loZ = Math.min(az, bz);
  const hiZ = Math.max(az, bz);
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (s.maxX < loX || s.minX > hiX || s.maxZ < loZ || s.minZ > hiZ) continue;
    if (s.kind === 'trunk' || !solidActive(state, s)) continue;
    if (rayBox(ax, ay, az, ix, iy, iz, s, len, null) < len) return false;
  }
  return true;
}

/** Distance along a ray to the terrain, or Infinity. Marches, then refines by bisection. */
export function rayGround(ox, oy, oz, dx, dy, dz, maxT) {
  if (oy < groundY(ox, oz)) return Infinity;
  const step = 0.8;
  let prev = 0;
  for (let t = step; t <= maxT + step; t += step) {
    const tt = Math.min(t, maxT);
    if (oy + dy * tt < groundY(ox + dx * tt, oz + dz * tt)) {
      let lo = prev;
      let hi = tt;
      for (let i = 0; i < 7; i += 1) {
        const mid = (lo + hi) / 2;
        if (oy + dy * mid < groundY(ox + dx * mid, oz + dz * mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    if (tt >= maxT) break;
    prev = tt;
  }
  return Infinity;
}

/** Ray against a sphere: entry distance or Infinity. */
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx;
  const my = oy - cy;
  const mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}

/** Ray against an upright cylinder between y0 and y1: entry distance or Infinity. */
export function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
  const mx = ox - cx;
  const mz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return Infinity;
  const b = mx * dx + mz * dz;
  const c = mx * mx + mz * mz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  let t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) {
    if (c > 0) return Infinity;
    t = 0;
  }
  const y = oy + dy * t;
  return y >= y0 && y <= y1 ? t : Infinity;
}
