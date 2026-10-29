// Tree and rock silhouettes for RegionScene, as path strings (no React).
// Every builder returns { body, lit, snow?, shade? } so a whole belt of trees
// is four <path>s however many trees it holds. Key light: upper right.
import { mulberry32, r1 } from '../util.js';

const P = (x, y) => `${r1(x)},${r1(y)}`;

/** A fir with ragged branch tiers. Base at (x, base), height h. */
export function fir(x, base, h, rnd, { width = 0.38, snow = false } = {}) {
  const w = h * width;
  const t = base - h;
  const n = Math.max(4, Math.min(9, Math.round(h / 6)));
  const trunkW = Math.max(0.35, w * 0.05);
  let body = `M${P(x - trunkW, base)}L${P(x - trunkW, base - h * 0.2)}L${P(x + trunkW, base - h * 0.2)}L${P(x + trunkW, base)}Z`;
  let lit = '';
  let snowD = '';
  for (let i = 0; i < n; i += 1) {
    const yT = t + (h * 0.84 * i) / n - (i ? h * 0.02 : 0);
    const yB = t + (h * 0.84 * (i + 1)) / n + h * 0.05;
    const wb = (w / 2) * ((i + 1) / n) ** 0.85 * (0.85 + rnd() * 0.3);
    const sag = (yB - yT) * 0.18;
    const jags = 3;
    let d = `M${P(x, yT)}L${P(x + wb, yB + sag * 0.4)}`;
    for (let j = jags; j >= 1; j -= 1) {
      const u = j / (jags + 1);
      d += `L${P(x - wb + wb * 2 * u + wb * 0.18, yB - sag * (0.6 + rnd() * 0.6))}L${P(x - wb + wb * 2 * u, yB + rnd() * sag)}`;
    }
    d += `L${P(x - wb, yB + sag * 0.3)}Z`;
    body += d;
    lit += `M${P(x + wb * 0.05, yT + (yB - yT) * 0.1)}L${P(x + wb, yB + sag * 0.4)}L${P(x + wb * 0.35, yB - sag * 0.4)}Z`;
    if (snow) {
      const k = 0.62;
      snowD += `M${P(x, yT)}L${P(x + wb * k, yT + (yB - yT) * k * 0.95)}L${P(x + wb * 0.2, yT + (yB - yT) * 0.5)}L${P(x - wb * 0.2, yT + (yB - yT) * 0.52)}L${P(x - wb * k * 0.9, yT + (yB - yT) * k)}Z`;
    }
  }
  return { body, lit, snow: snowD };
}

/** A belt of firs along a baseline; small ones first so the belt has depth. */
export function firBelt(seed, { from, to, count, baseAt, hMin, hMax, snow = false, width, jitter = 0.8 }) {
  const rnd = mulberry32(seed);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const x = from + ((to - from) * (i + 0.5 + (rnd() - 0.5) * jitter)) / count;
    items.push([x, hMin + (hMax - hMin) * rnd()]);
  }
  items.sort((a, b) => a[1] - b[1]);
  let body = '';
  let lit = '';
  let snowD = '';
  for (const [x, h] of items) {
    const f = fir(x, baseAt(x) + 1.2, h, rnd, { snow, width: width ?? 0.34 + rnd() * 0.1 });
    body += f.body;
    lit += f.lit;
    snowD += f.snow;
  }
  return { body, lit, snow: snowD };
}

function circle(cx, cy, r) {
  return `M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0Z`;
}

/** Broadleaf trees: clumped canopies with a lit crown and a shaded belly. */
export function grove(seed, { from, to, count, baseAt, rMin, rMax, xs }) {
  const rnd = mulberry32(seed);
  let body = '';
  let lit = '';
  let shade = '';
  const list = xs || Array.from({ length: count }, () => from + (to - from) * rnd());
  for (const x of list) {
    const r = rMin + (rMax - rMin) * rnd();
    const by = baseAt(x) + rnd() * 1.5;
    const cy = by - r * 1.25;
    body += `M${P(x - r * 0.08, by)}L${P(x - r * 0.05, cy)}L${P(x + r * 0.08, cy)}L${P(x + r * 0.1, by)}Z`;
    const clumps = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < clumps; i += 1) {
      const a = (i / clumps) * Math.PI * 2 + rnd();
      const cr = r * (0.5 + rnd() * 0.25);
      const cx = x + Math.cos(a) * r * 0.45;
      const cyy = cy + Math.sin(a) * r * 0.32 - r * 0.1;
      body += circle(cx, cyy, cr);
      if (Math.cos(a) > -0.2 && Math.sin(a) < 0.4) lit += circle(cx + cr * 0.28, cyy - cr * 0.25, cr * 0.62);
    }
    body += circle(x, cy - r * 0.25, r * 0.62);
    lit += circle(x + r * 0.2, cy - r * 0.5, r * 0.36);
    shade += `M${P(x - r * 0.85, cy + r * 0.1)}Q${P(x, cy + r * 0.75)} ${P(x + r * 0.85, cy + r * 0.1)}Q${P(x, cy + r * 0.45)} ${P(x - r * 0.85, cy + r * 0.1)}Z`;
  }
  return { body, lit, shade };
}

/** Faceted boulders: body, a lit upper-right facet, a dark west face. */
export function boulders(seed, list) {
  const rnd = mulberry32(seed);
  let body = '';
  let lit = '';
  let shade = '';
  for (const [x, y, s] of list) {
    const w = 10 * s * (0.8 + rnd() * 0.4);
    const h = 7 * s * (0.8 + rnd() * 0.4);
    const pk = [x + w * (rnd() * 0.3 - 0.05), y - h];
    const sh = [x + w * (0.45 + rnd() * 0.2), y - h * (0.55 + rnd() * 0.15)];
    const nw = [x - w * (0.4 + rnd() * 0.15), y - h * (0.5 + rnd() * 0.2)];
    body += `M${P(x - w * 0.62, y)}L${P(nw[0], nw[1])}L${P(pk[0], pk[1])}L${P(sh[0], sh[1])}L${P(x + w * 0.62, y)}Z`;
    lit += `M${P(pk[0], pk[1])}L${P(sh[0], sh[1])}L${P(x + w * 0.62, y)}L${P(x + w * 0.2, y - h * 0.2)}Z`;
    shade += `M${P(x - w * 0.62, y)}L${P(nw[0], nw[1])}L${P(pk[0] - w * 0.08, pk[1] + h * 0.25)}L${P(x - w * 0.1, y)}Z`;
  }
  return { body, lit, shade };
}
