// The Greywater Front as geometry: terrain, river, every solid in the level, the pine wood,
// grass, lamps and banners. Static pieces are merged per material so the whole place draws in a
// few dozen calls; the handful of things that move (gate, winch, casks, pickups, banners) are
// returned separately.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS, PADS, WATER_Y, groundY, padMask, riverMask, roadMask } from '../../../game/fps/level.js';
import { fbm, hash2 } from '../../../game/fps/noise.js';
import { pbr } from './textures.js';
import { FOG_COLOR, MOON_DIR } from './sky.js';

const TAU = Math.PI * 2;
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

// ───────────────────────────────────────────────────────────── geometry helpers

/** A box whose UVs tile once per `tile` metres, so textures keep their scale on any size. */
function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f += 1) {
    for (let i = 0; i < 4; i += 1) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return g;
}

function place(g, x, y, z, ry = 0, rx = 0, rz = 0) {
  E.set(rx, ry, rz, 'YXZ');
  Q.setFromEuler(E);
  M.compose(V.set(x, y, z), Q, S.set(1, 1, 1));
  g.applyMatrix4(M);
  return g;
}

function cyl(rTop, rBot, h, seg = 10, tile = 2) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  const uv = g.attributes.uv;
  const circ = TAU * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
  return g;
}

/** A gabled roof prism: ridge along z. */
function roofGeo(w, d, rise, overhang = 0.35, tile = 2) {
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const slope = Math.hypot(hw, rise);
  const pos = [];
  const uv = [];
  const quad = (a, b, c, e, uw, vh) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(0, 0, uw, 0, uw, vh, 0, 0, uw, vh, 0, vh);
  };
  quad([-hw, 0, hd], [-hw, 0, -hd], [0, rise, -hd], [0, rise, hd], (hd * 2) / tile, slope / tile);
  quad([hw, 0, -hd], [hw, 0, hd], [0, rise, hd], [0, rise, -hd], (hd * 2) / tile, slope / tile);
  // gable ends
  pos.push(-hw, 0, hd, 0, rise, hd, hw, 0, hd, hw, 0, -hd, 0, rise, -hd, -hw, 0, -hd);
  uv.push(0, 0, hw / tile, rise / tile, w / tile, 0, 0, 0, hw / tile, rise / tile, w / tile, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A boulder: a subdivided icosahedron pushed around by noise, squashed to the box it fills. */
function rockGeo(w, h, d, seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    V.fromBufferAttribute(p, i).normalize();
    const n = fbm(V.x * 1.6 + seed, V.y * 1.6 + V.z * 1.6, 3, 7) * 0.5 + fbm(V.x * 4 + V.z * 3, V.y * 4 + seed, 2, 3) * 0.16;
    const r = 0.72 + n * 0.62;
    p.setXYZ(i, V.x * r * w * 0.62, Math.max(-0.2, V.y * r * h * 0.62 + h * 0.3), V.z * r * d * 0.62);
  }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 2);
  g.computeVertexNormals();
  return g;
}

class Buckets {
  constructor() {
    this.map = new Map();
  }
  add(mat, g) {
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const clean = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(clean.attributes)) if (!['position', 'normal', 'uv'].includes(name)) clean.deleteAttribute(name);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(clean);
  }
  build(materials, group) {
    for (const [name, list] of this.map) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const mesh = new THREE.Mesh(merged, materials[name]);
      mesh.castShadow = name !== 'glow';
      mesh.receiveShadow = name !== 'glow';
      mesh.name = `static:${name}`;
      group.add(mesh);
    }
  }
}

// ───────────────────────────────────────────────────────────── terrain

function terrainColor(x, z, out) {
  const n = fbm(x * 0.11, z * 0.11, 3, 4);
  const n2 = fbm(x * 0.6, z * 0.6, 2, 9);
  // moonlit grass, drier and paler on the high ground
  let r = 0.15 + n * 0.09;
  let g = 0.2 + n * 0.11;
  let b = 0.1 + n * 0.05;
  const dry = n2 * 0.5;
  r += dry * 0.07;
  g += dry * 0.04;
  const road = roadMask(x, z);
  r += (0.33 + n2 * 0.06 - r) * road;
  g += (0.275 + n2 * 0.05 - g) * road;
  b += (0.2 + n2 * 0.04 - b) * road;
  for (const pad of PADS) {
    const m = padMask(x, z, pad, 2.5);
    if (m <= 0) continue;
    const gravel = pad.id === 'depot';
    r += ((gravel ? 0.3 : 0.31) + n2 * 0.06 - r) * m;
    g += ((gravel ? 0.29 : 0.265) + n2 * 0.05 - g) * m;
    b += ((gravel ? 0.275 : 0.2) + n2 * 0.04 - b) * m;
  }
  const river = riverMask(x, z);
  if (river > 0) {
    r += (0.17 - r) * river;
    g += (0.15 - g) * river;
    b += (0.12 - b) * river;
  }
  const hill = THREE.MathUtils.smoothstep(Math.abs(x), 33, 42);
  r += (0.2 + n * 0.08 - r) * hill * 0.6;
  g += (0.2 + n * 0.08 - g) * hill * 0.6;
  b += (0.2 + n * 0.08 - b) * hill * 0.6;
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

function buildTerrain(tex) {
  const step = 1.25;
  const x0 = -78;
  const x1 = 78;
  const z0 = BOUNDS.minZ - 34;
  const z1 = BOUNDS.maxZ + 30;
  const nx = Math.round((x1 - x0) / step) + 1;
  const nz = Math.round((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const c = [0, 0, 0];
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const k = j * nx + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = groundY(x, z);
      pos[k * 3 + 2] = z;
      terrainColor(x, z, c);
      col[k * 3] = c[0];
      col[k * 3 + 1] = c[1];
      col[k * 3 + 2] = c[2];
      uv[k * 2] = x / 3.4;
      uv[k * 2 + 1] = z / 3.4;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = j * nx + i;
      idx[q] = a;
      idx[q + 1] = a + nx;
      idx[q + 2] = a + 1;
      idx[q + 3] = a + 1;
      idx[q + 4] = a + nx;
      idx[q + 5] = a + nx + 1;
      q += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mat = pbr(tex.ground, { vertexColors: true, metalness: 0 });
  mat.metalnessMap = null;
  mat.normalScale = new THREE.Vector2(0.55, 0.55);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// ───────────────────────────────────────────────────────────── water

const WATER_VERT = /* glsl */ `
attribute float depth;
varying vec3 vWorld;
varying float vDepth;
#include <fog_pars_vertex>
void main() {
  vDepth = depth;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uNormal;
uniform float uTime;
uniform vec3 uMoonDir;
uniform vec3 uFirePos[3];
uniform float uFireOn;
uniform vec3 uLampPos;
uniform vec3 uLampCol;
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 uv = vWorld.xz;
  // the Greywater runs east: two ripple layers sliding over each other
  vec3 n1 = texture2D(uNormal, uv * 0.085 + vec2(uTime * 0.035, uTime * 0.006)).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uNormal, uv * 0.23 + vec2(uTime * 0.06, -uTime * 0.022)).xyz * 2.0 - 1.0;
  vec3 n3 = texture2D(uNormal, uv * 0.61 + vec2(uTime * 0.09, uTime * 0.03)).xyz * 2.0 - 1.0;
  vec3 n = normalize(vec3(n1.x + n2.x * 0.7 + n3.x * 0.35, 2.6, n1.y + n2.y * 0.7 + n3.y * 0.35));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.025 + 0.975 * pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 5.0);
  vec3 R = reflect(-V, n);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(vec3(0.07, 0.115, 0.19), vec3(0.012, 0.024, 0.06), pow(up + 1e-4, 0.45));
  float south = clamp(dot(normalize(R.xz + 1e-5), vec2(0.0, -1.0)), 0.0, 1.0);
  sky += vec3(0.75, 0.32, 0.1) * pow(south + 1e-4, 4.0) * pow(1.0 - up + 1e-4, 4.0) * uFireOn;
  float md = clamp(dot(R, uMoonDir), 1e-4, 1.0);
  vec3 spec = vec3(0.85, 0.9, 1.0) * (pow(md, 520.0) * 9.0 + pow(md, 60.0) * 0.35);
  // the depot fire and the walker lamp lay long broken streaks on the water
  for (int i = 0; i < 3; i++) {
    vec3 L = uFirePos[i] - vWorld;
    float dist = length(L);
    float s = pow(clamp(dot(R, L / max(dist, 0.01)), 1e-4, 1.0), 90.0);
    spec += vec3(1.0, 0.5, 0.16) * s * uFireOn * 7.0 / (1.0 + dist * 0.035);
  }
  vec3 Ll = uLampPos - vWorld;
  float dl = length(Ll);
  spec += uLampCol * pow(clamp(dot(R, Ll / max(dl, 0.01)), 1e-4, 1.0), 160.0) * 2.2 / (1.0 + dl * 0.03);
  vec3 shallow = vec3(0.045, 0.07, 0.07);
  vec3 deep = vec3(0.008, 0.02, 0.035);
  vec3 body = mix(shallow, deep, smoothstep(0.0, 1.1, vDepth));
  vec3 col = mix(body, sky, fres) + spec;
  // a pale line of foam where the water thins out on the banks and round the stones
  float foamN = texture2D(uNormal, uv * 0.9 + vec2(uTime * 0.05, 0.0)).z;
  float foam = (1.0 - smoothstep(0.02, 0.16, vDepth)) * smoothstep(0.55, 0.8, foamN + n3.x * 0.3);
  col = mix(col, vec3(0.42, 0.48, 0.55), foam * 0.55);
  float alpha = mix(0.5, 0.97, smoothstep(0.0, 0.7, vDepth)) * smoothstep(-0.02, 0.05, vDepth);
  alpha = max(alpha, fres * 0.9) * smoothstep(-0.04, 0.03, vDepth);
  gl_FragColor = vec4(clamp(col, 0.0, 40.0), clamp(alpha, 0.0, 1.0));
  #include <fog_fragment>
}`;

function buildWater(tex, level) {
  const step = 1.5;
  const x0 = -80;
  const x1 = 80;
  const z0 = -150;
  const z1 = -104;
  const nx = Math.round((x1 - x0) / step) + 1;
  const nz = Math.round((z1 - z0) / step) + 1;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx - 1, nz - 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2);
  const p = g.attributes.position;
  const depth = new Float32Array(p.count);
  for (let i = 0; i < p.count; i += 1) depth[i] = WATER_Y - groundY(p.getX(i), p.getZ(i));
  g.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
  const blaze = level.fires.filter((f) => f.kind === 'blaze');
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uNormal: { value: null },
      uTime: { value: 0 },
      uMoonDir: { value: MOON_DIR.clone() },
      uFirePos: { value: blaze.slice(0, 3).map((f) => new THREE.Vector3(f.x, f.y + 2.5 * f.size, f.z)) },
      uFireOn: { value: 1 },
      uLampPos: { value: new THREE.Vector3(2, 6, -188) },
      uLampCol: { value: new THREE.Color(1, 0.86, 0.6) },
    },
  ]);
  uniforms.uNormal.value = tex.water.normalMap;
  const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms, transparent: true, fog: true, depthWrite: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return mesh;
}

// ───────────────────────────────────────────────────────────── props

function addSolid(B, s, dyn) {
  const { x, z, w, d, h } = s;
  const y = s.y;
  const seed = Math.abs(Math.round(x * 13.7 + z * 7.3));
  const jit = (k, amp = 1) => (hash2(seed, k, 3) - 0.5) * 2 * amp;
  switch (s.kind) {
    case 'wall': {
      B.add('stone', place(boxGeo(w, h - 0.12, d, 1.6), x, y + (h - 0.12) / 2, z));
      // a rough capping course of loose stones
      for (let cx = -w / 2 + 0.35; cx < w / 2 - 0.2; cx += 0.62) {
        const cw = 0.5 + hash2(seed, Math.round(cx * 10), 1) * 0.2;
        B.add('rock', place(rockGeo(cw, 0.32, d * 1.05, seed + cx), x + cx, y + h - 0.22, z, jit(cx, 0.3)));
      }
      break;
    }
    case 'palisade': {
      const n = Math.max(2, Math.round(w / 0.46));
      for (let i = 0; i < n; i += 1) {
        const lx = x - w / 2 + (i + 0.5) * (w / n);
        const lh = h + (hash2(seed, i, 2) - 0.5) * 0.5;
        const r = 0.2 + hash2(seed, i, 5) * 0.05;
        B.add('bark', place(cyl(r * 0.9, r, lh, 7, 1.2), lx, y + lh / 2, z + jit(i + 20, 0.05), jit(i, 3)));
        B.add('woodEnd', place(new THREE.ConeGeometry(r * 0.9, 0.5, 7), lx, y + lh + 0.25, z + jit(i + 20, 0.05)));
      }
      B.add('wood', place(boxGeo(w, 0.2, 0.12, 1.5), x, y + h * 0.36, z - 0.3));
      B.add('wood', place(boxGeo(w, 0.2, 0.12, 1.5), x, y + h * 0.74, z - 0.3));
      break;
    }
    case 'gatetower': {
      B.add('stone', place(boxGeo(w, h, d, 1.8), x, y + h / 2, z));
      B.add('ashlar', place(boxGeo(w + 0.5, 0.35, d + 0.5, 2), x, y + h + 0.17, z));
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * TAU + Math.PI / 4;
        B.add('stone', place(boxGeo(0.8, 0.75, 0.8, 1.8), x + Math.cos(a) * (w / 2 - 0.15) * 1.25, y + h + 0.7, z + Math.sin(a) * (d / 2 - 0.15) * 1.25));
      }
      // arrow slit with a watch-fire behind it
      B.add('glow', place(boxGeo(0.16, 0.9, 0.05), x, y + h * 0.62, z + d / 2 + 0.01));
      B.add('dark', place(boxGeo(0.5, 1.3, 0.06), x, y + h * 0.62, z + d / 2 + 0.005));
      break;
    }
    case 'hut': {
      B.add('stone', place(boxGeo(w, h * 0.45, d, 1.8), x, y + h * 0.225, z));
      B.add('wood', place(boxGeo(w - 0.1, h * 0.55, d - 0.1, 1.6), x, y + h * 0.725, z));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('bark', place(boxGeo(0.26, h, 0.26, 1), x + sx * (w / 2 - 0.06), y + h / 2, z + sz * (d / 2 - 0.06)));
      B.add('slate', place(roofGeo(w, d, 1.7, 0.5, 1.6), x, y + h, z));
      B.add('dark', place(boxGeo(1.1, 2.0, 0.08), x + 1.2, y + 1.0, z + d / 2 + 0.03));
      B.add('glow', place(boxGeo(0.8, 0.6, 0.06), x - 1.6, y + 1.9, z + d / 2 + 0.03));
      B.add('wood', place(boxGeo(1.0, 0.1, 0.12), x - 1.6, y + 1.9, z + d / 2 + 0.07));
      B.add('wood', place(boxGeo(0.1, 0.8, 0.12), x - 1.6, y + 1.9, z + d / 2 + 0.07));
      B.add('stone', place(boxGeo(0.9, 1.6, 0.9, 1.8), x - w / 2 + 0.8, y + h + 1.3, z - 0.6));
      break;
    }
    case 'shed': {
      const wall = s.burning ? 'char' : 'wood';
      B.add(wall, place(boxGeo(w, h * 0.72, d, 1.8), x, y + h * 0.36, z));
      for (let i = 0; i <= 4; i += 1) B.add(s.burning ? 'char' : 'bark', place(boxGeo(0.3, h * 0.72 + 0.1, 0.3, 1), x - w / 2 + (i * w) / 4, y + h * 0.36, z + d / 2 + 0.05));
      if (s.burning) {
        // half the roof has fallen in; what is left glows from inside
        B.add('char', place(roofGeo(w * 0.5, d, h * 0.34, 0.4, 1.6), x - w * 0.25, y + h * 0.72, z));
        B.add('glow', place(boxGeo(2.2, 1.5, 0.08), x + 1.5, y + 1.4, z + d / 2 + 0.03));
        for (let i = 0; i < 5; i += 1) B.add('char', place(boxGeo(0.22, 3.4, 0.22, 1), x + w * 0.08 + i * 1.0, y + h * 0.75, z + jit(i, 1.6), 0, jit(i + 3, 0.5), 0.9 + jit(i + 9, 0.4)));
      } else {
        B.add('plate', place(roofGeo(w, d, h * 0.34, 0.5, 2.4), x, y + h * 0.72, z));
        B.add('dark', place(boxGeo(2.4, 2.6, 0.08), x, y + 1.3, z + d / 2 + 0.03));
        B.add('plate', place(boxGeo(1.15, 2.5, 0.07, 2.4), x - 0.62, y + 1.3, z + d / 2 + 0.08));
        B.add('plate', place(boxGeo(1.15, 2.5, 0.07, 2.4), x + 0.95, y + 1.3, z + d / 2 + 0.16, 0.5));
      }
      break;
    }
    case 'watchtower': {
      const top = 5.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('bark', place(cyl(0.16, 0.2, top + 2.6, 7, 1.2), x + sx * (w / 2 - 0.2), y + (top + 2.6) / 2, z + sz * (d / 2 - 0.2), 0, sz * 0.04, -sx * 0.04));
      B.add('wood', place(boxGeo(w + 0.6, 0.16, d + 0.6, 1.6), x, y + top, z));
      B.add('wood', place(boxGeo(w + 0.5, 1.0, 0.1, 1.6), x, y + top + 0.6, z + d / 2 + 0.25));
      B.add('wood', place(boxGeo(w + 0.5, 1.0, 0.1, 1.6), x, y + top + 0.6, z - d / 2 - 0.25));
      B.add('wood', place(boxGeo(0.1, 1.0, d + 0.5, 1.6), x - w / 2 - 0.25, y + top + 0.6, z));
      B.add('wood', place(boxGeo(0.1, 1.0, d + 0.5, 1.6), x + w / 2 + 0.25, y + top + 0.6, z));
      B.add('slate', place(roofGeo(w + 0.4, d + 0.4, 1.3, 0.4, 1.6), x, y + top + 2.6, z));
      for (let i = 0; i < 4; i += 1) B.add('wood', place(boxGeo(0.12, Math.hypot(w, top / 4) + 0.2, 0.1, 1.2), x, y + (i + 0.5) * (top / 4), z + d / 2 - 0.2, 0, 0, i % 2 ? 0.95 : -0.95));
      // ladder
      for (const sx of [-0.25, 0.25]) B.add('wood', place(boxGeo(0.07, top + 0.4, 0.07, 1), x + sx, y + top / 2, z - d / 2 - 0.35, 0, -0.08));
      for (let r = 0.4; r < top; r += 0.42) B.add('wood', place(boxGeo(0.5, 0.05, 0.05, 1), x, y + r, z - d / 2 - 0.35 + r * 0.016));
      B.add('wood', place(boxGeo(w, h, d, 1.6), x, y + h / 2 - 0.02, z)); // the store under the legs
      break;
    }
    case 'tent': {
      B.add('canvas', place(roofGeo(w, d, h, 0, 1.4), x, y, z));
      B.add('bark', place(cyl(0.05, 0.05, h + 0.3, 6), x, y + (h + 0.3) / 2, z + d / 2));
      B.add('bark', place(cyl(0.05, 0.05, h + 0.3, 6), x, y + (h + 0.3) / 2, z - d / 2));
      B.add('dark', place(boxGeo(0.9, h * 0.62, 0.04), x, y + h * 0.31, z + d / 2 + 0.02));
      break;
    }
    case 'cart': {
      const tilt = 0.22;
      B.add('wood', place(boxGeo(w, 0.14, d * 0.86, 1.4), x, y + 0.8, z, 0, 0, tilt));
      B.add('wood', place(boxGeo(w, 0.55, 0.08, 1.4), x, y + 1.1, z + d * 0.43, 0, 0, tilt));
      B.add('wood', place(boxGeo(w, 0.55, 0.08, 1.4), x, y + 1.1, z - d * 0.43, 0, 0, tilt));
      for (const sz of [-1, 1]) {
        B.add('wood', place(new THREE.TorusGeometry(0.58, 0.06, 6, 16), x + 0.3, y + 0.6, z + sz * (d / 2 + 0.05)));
        for (let k = 0; k < 4; k += 1) B.add('wood', place(boxGeo(1.1, 0.05, 0.05), x + 0.3, y + 0.6, z + sz * (d / 2 + 0.05), 0, 0, (k / 4) * Math.PI));
      }
      B.add('wood', place(boxGeo(1.9, 0.08, 0.08), x - w / 2 - 0.8, y + 0.45, z, 0, 0, tilt + 0.25));
      B.add('canvas', place(boxGeo(1.2, 0.5, 0.9, 1.2), x + 0.4, y + 1.15, z - 0.2, 0.3, 0, tilt));
      break;
    }
    case 'wagon': {
      const wreck = s.variant === 'wreck';
      const frame = wreck ? 'char' : 'wood';
      B.add(frame, place(boxGeo(w, 0.7, d, 1.4), x, y + 0.95, z, wreck ? 0.1 : 0, 0, wreck ? 0.14 : 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        if (wreck && sx > 0 && sz > 0) continue;
        B.add(frame, place(new THREE.TorusGeometry(0.55, 0.07, 6, 16), x + sx * (w / 2 + 0.08), y + 0.55, z + sz * d * 0.32, Math.PI / 2));
      }
      if (!wreck) {
        // hooped cover
        const hoop = new THREE.CylinderGeometry(w / 2 + 0.06, w / 2 + 0.06, d * 0.96, 12, 1, true, 0, Math.PI);
        hoop.rotateZ(Math.PI / 2);
        hoop.rotateY(Math.PI / 2);
        const cover = s.variant === 'elvian' ? 'canvasNavy' : 'canvasGrey';
        B.add(cover, place(hoop, x, y + 1.3, z));
        if (s.variant === 'elvian') B.add('brass', place(boxGeo(w + 0.16, 0.1, 0.1), x, y + 1.32, z + d * 0.48));
      } else {
        for (let i = 0; i < 4; i += 1) B.add('char', place(boxGeo(0.08, 1.5, 0.08), x + jit(i, 0.8), y + 1.7, z - d * 0.4 + i * (d * 0.27), 0, jit(i + 4, 0.3), 0.2 + jit(i + 8, 0.3)));
      }
      break;
    }
    case 'crate': {
      const ry = jit(1, 0.09);
      B.add('wood', place(boxGeo(w, h, d, 1.1), x, y + h / 2, z, ry));
      const b = 0.07;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('woodDark', place(boxGeo(b * 1.6, h + 0.02, b * 1.6), x + sx * (w / 2 - b * 0.5) * Math.cos(ry) + sz * (d / 2 - b * 0.5) * Math.sin(ry), y + h / 2, z - sx * (w / 2 - b * 0.5) * Math.sin(ry) + sz * (d / 2 - b * 0.5) * Math.cos(ry), ry));
      B.add('woodDark', place(boxGeo(w + 0.03, b * 1.4, d + 0.03), x, y + h - b * 0.7, z, ry));
      B.add('woodDark', place(boxGeo(w + 0.03, b * 1.4, d + 0.03), x, y + b * 0.7, z, ry));
      B.add('plate', place(boxGeo(0.3, 0.2, 0.02), x + Math.sin(ry) * (d / 2 + 0.012), y + h * 0.62, z + Math.cos(ry) * (d / 2 + 0.012), ry));
      break;
    }
    case 'sandbag': {
      const rows = 3;
      for (let r = 0; r < rows; r += 1) {
        const n = Math.round(w / 0.62);
        for (let i = 0; i < n + (r % 2 ? -1 : 0); i += 1) {
          const bag = new THREE.SphereGeometry(0.5, 9, 6);
          bag.scale(0.64, 0.4, 0.55 + hash2(seed, i + r * 9, 4) * 0.1);
          B.add('canvas', place(bag, x - w / 2 + 0.32 + i * 0.62 + (r % 2 ? 0.31 : 0), y + 0.19 + r * 0.34, z + jit(i + r * 7, 0.07), jit(i + r, 0.2)));
        }
      }
      break;
    }
    case 'barricade': {
      for (let i = 0; i < 5; i += 1) {
        const lx = x - w / 2 + 0.5 + i * ((w - 1) / 4);
        B.add('bark', place(cyl(0.09, 0.11, 2.3, 6, 1), lx, y + 0.75, z, 0, 0.75, jit(i, 0.2)));
        B.add('bark', place(cyl(0.09, 0.11, 2.3, 6, 1), lx, y + 0.75, z, 0, -0.75, jit(i + 5, 0.2)));
      }
      B.add('bark', place(cyl(0.13, 0.15, w + 0.6, 7, 1.2), x, y + 0.8, z, 0, 0, Math.PI / 2));
      B.add('wood', place(boxGeo(w * 0.8, 0.5, 0.08, 1.2), x, y + 0.45, z + 0.32, 0, -0.3));
      break;
    }
    case 'rock':
      B.add('rock', place(rockGeo(w * 1.15, h * 1.2, d * 1.15, seed), x, y - 0.1, z, jit(1, 3)));
      break;
    case 'log':
      B.add('bark', place(cyl(h * 0.48, h * 0.52, w, 9, 1.2), x, y + h * 0.48, z, jit(1, 0.06), 0, Math.PI / 2));
      B.add('woodEnd', place(new THREE.CircleGeometry(h * 0.47, 9), x + w / 2 + 0.005, y + h * 0.48, z, Math.PI / 2));
      B.add('woodEnd', place(new THREE.CircleGeometry(h * 0.47, 9), x - w / 2 - 0.005, y + h * 0.48, z, -Math.PI / 2));
      break;
    case 'well': {
      const ring = new THREE.CylinderGeometry(w / 2, w / 2 + 0.05, h, 14, 1, true);
      B.add('stone', place(ring, x, y + h / 2, z));
      B.add('ashlar', place(new THREE.TorusGeometry(w / 2 - 0.05, 0.14, 6, 14), x, y + h, z, 0, Math.PI / 2));
      B.add('dark', place(new THREE.CircleGeometry(w / 2 - 0.1, 14), x, y + h - 0.3, z, 0, -Math.PI / 2));
      for (const sx of [-1, 1]) B.add('bark', place(boxGeo(0.14, 2.3, 0.14, 1), x + sx * (w / 2 + 0.05), y + 1.15, z));
      B.add('bark', place(cyl(0.08, 0.08, w + 0.3, 6), x, y + 2.0, z, 0, 0, Math.PI / 2));
      B.add('slate', place(roofGeo(w + 0.5, 1.2, 0.6, 0.15, 1.2), x, y + 2.3, z));
      break;
    }
    case 'block': {
      B.add('ashlar', place(boxGeo(w, h, d, 2.2), x, y + h / 2, z, jit(1, 0.05)));
      if (h > 2) B.add('ashlar', place(boxGeo(w * 0.94, 0.04, d * 0.94, 2.2), x, y + h * 0.5, z));
      break;
    }
    case 'crane': {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('plate', place(boxGeo(0.28, h, 0.28, 2), x + sx * 1.2, y + h / 2, z + sz * 1.2, 0, sz * 0.03, -sx * 0.03));
      for (let i = 1; i < 5; i += 1) B.add('plate', place(boxGeo(2.7, 0.14, 2.7, 2), x, y + (i * h) / 5, z));
      B.add('plate', place(boxGeo(0.4, 0.4, 9, 2), x, y + h + 0.2, z + 2.5));
      B.add('dark', place(cyl(0.03, 0.03, 4.2, 5), x, y + h - 1.9, z + 6.2));
      B.add('plate', place(new THREE.TorusGeometry(0.28, 0.07, 6, 12, Math.PI * 1.4), x, y + h - 4.2, z + 6.2));
      B.add('wood', place(boxGeo(w, 1.3, d, 1.6), x, y + 0.65, z));
      break;
    }
    case 'winch': {
      B.add('wood', place(boxGeo(w, 0.2, d, 1.2), x, y + 0.1, z));
      for (const sx of [-1, 1]) B.add('bark', place(boxGeo(0.16, h, 0.2, 1), x + sx * 0.5, y + h / 2, z));
      dyn.winch = { x, y: y + h - 0.25, z };
      break;
    }
    case 'gate':
    case 'fuel':
      dyn.solids.push(s);
      break;
    default:
  }
}

function buildGate(s, mats) {
  const g = new THREE.Group();
  const list = [];
  const n = Math.round(s.w / 0.5);
  for (let i = 0; i < n; i += 1) list.push(place(boxGeo(s.w / n - 0.03, s.h, 0.16, 1.6), -s.w / 2 + (i + 0.5) * (s.w / n), s.h / 2, 0));
  const planks = new THREE.Mesh(mergeGeometries(list.map((x) => x.toNonIndexed())), mats.wood);
  const bands = [];
  for (const yy of [0.5, s.h * 0.5, s.h - 0.5]) bands.push(place(boxGeo(s.w + 0.1, 0.22, 0.22, 2), 0, yy, 0).toNonIndexed());
  for (let i = 0; i <= 8; i += 1) bands.push(place(new THREE.ConeGeometry(0.1, 0.5, 5), -s.w / 2 + 0.3 + i * ((s.w - 0.6) / 8), -0.2, 0, 0, Math.PI).toNonIndexed());
  for (const b of bands) for (const name of Object.keys(b.attributes)) if (!['position', 'normal', 'uv'].includes(name)) b.deleteAttribute(name);
  const iron = new THREE.Mesh(mergeGeometries(bands), mats.plate);
  for (const m of [planks, iron]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(s.x, s.y, s.z);
  return g;
}

function buildCask(s, mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(cyl(s.w / 2, s.w / 2, s.h, 14, 1.5), mats.plate);
  body.position.y = s.h / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(s.w / 2 + 0.012, s.w / 2 + 0.012, 0.2, 14, 1, true), mats.warn);
  band.position.y = s.h * 0.62;
  const cap = new THREE.Mesh(cyl(0.09, 0.09, 0.08, 8), mats.brass);
  cap.position.set(0.18, s.h + 0.04, 0);
  for (const m of [body, band, cap]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(s.x, s.y, s.z);
  return g;
}

// ───────────────────────────────────────────────────────────── trees and grass

function pineGeometries() {
  const trunk = cyl(0.1, 0.24, 9, 7, 1.4);
  trunk.translate(0, 4.5, 0);
  const tiers = [];
  const n = 7;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const r = 2.5 * (1 - t * 0.8);
    const hgt = 2.4 - t * 0.6;
    const c = new THREE.ConeGeometry(r, hgt, 9, 2, true);
    const p = c.attributes.position;
    for (let k = 0; k < p.count; k += 1) {
      const y = p.getY(k);
      const low = y < 0 ? 1 : 0;
      const a = Math.atan2(p.getZ(k), p.getX(k));
      const wob = 1 + (hash2(Math.round(a * 20), i, 6) - 0.5) * 0.5 * low;
      p.setXYZ(k, p.getX(k) * wob, y - low * (0.25 + hash2(Math.round(a * 20), i, 8) * 0.35), p.getZ(k) * wob);
    }
    const uv = c.attributes.uv;
    for (let k = 0; k < uv.count; k += 1) uv.setXY(k, uv.getX(k) * 5, uv.getY(k) * 1.4);
    c.rotateY(i * 0.7);
    c.translate(0, 2.6 + i * 1.12, 0);
    tiers.push(c.toNonIndexed());
  }
  const foliage = mergeGeometries(tiers);
  foliage.computeVertexNormals();
  return { trunk, foliage };
}

function buildTrees(level, mats, quality) {
  const { trunk, foliage } = pineGeometries();
  const list = level.trees.filter((t, i) => quality.trees >= 1 || Math.abs(t.x) < 46 || i % 2 === 0);
  const trunks = new THREE.InstancedMesh(trunk, mats.bark, list.length);
  const live = list.filter((t) => !t.dead);
  const leaves = new THREE.InstancedMesh(foliage, mats.needles, live.length);
  const col = new THREE.Color();
  list.forEach((t, i) => {
    E.set(0, t.yaw, 0);
    Q.setFromEuler(E);
    M.compose(V.set(t.x, t.y - 0.2, t.z), Q, S.set(t.scale, t.scale * (t.dead ? 0.7 : 1), t.scale));
    trunks.setMatrixAt(i, M);
  });
  live.forEach((t, i) => {
    E.set(0, t.yaw, 0);
    Q.setFromEuler(E);
    M.compose(V.set(t.x, t.y - 0.2, t.z), Q, S.set(t.scale, t.scale, t.scale));
    leaves.setMatrixAt(i, M);
    const k = 0.7 + hash2(Math.round(t.x * 9), Math.round(t.z * 9), 2) * 0.6;
    leaves.setColorAt(i, col.setRGB(k * 0.85, k, k * 0.9));
  });
  for (const m of [trunks, leaves]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }
  trunks.name = 'trees:trunks';
  leaves.name = 'trees:needles';
  return [trunks, leaves];
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 20; i += 1) {
    const x = 10 + hash2(i, 1, 7) * 108;
    const hgt = 30 + hash2(i, 2, 7) * 96;
    const lean = (hash2(i, 3, 7) - 0.5) * 40;
    const wdt = 1.3 + hash2(i, 4, 7) * 1.7;
    const shade = 150 + Math.round(hash2(i, 5, 7) * 90);
    g.fillStyle = `rgb(${shade - 30},${shade},${shade - 60})`;
    g.beginPath();
    g.moveTo(x - wdt, 128);
    g.quadraticCurveTo(x + lean * 0.3, 128 - hgt * 0.6, x + lean, 128 - hgt);
    g.quadraticCurveTo(x + lean * 0.4 + wdt, 128 - hgt * 0.5, x + wdt, 128);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

function buildGrass(quality, timeUniform) {
  if (quality.grass <= 0) return null;
  const quad = (ry) => {
    const g = new THREE.PlaneGeometry(0.8, 0.44);
    g.translate(0, 0.22, 0);
    g.rotateY(ry);
    return g.toNonIndexed();
  };
  const tuft = mergeGeometries([quad(0), quad(Math.PI / 3), quad((2 * Math.PI) / 3)]);
  // light every blade as if it faced up, so the cards do not flash dark and bright as you turn
  const nrm = tuft.attributes.normal;
  for (let i = 0; i < nrm.count; i += 1) nrm.setXYZ(i, 0, 1, 0);
  const spots = [];
  const step = 0.78 / Math.sqrt(quality.grass);
  for (let z = BOUNDS.maxZ + 8; z > BOUNDS.minZ - 4; z -= step) {
    for (let x = -42; x <= 42; x += step) {
      const h = hash2(Math.round(x * 31), Math.round(z * 31), 11);
      if (h > 0.62) continue;
      const jx = x + (hash2(Math.round(x * 31), Math.round(z * 31), 12) - 0.5) * step;
      const jz = z + (hash2(Math.round(x * 31), Math.round(z * 31), 13) - 0.5) * step;
      if (roadMask(jx, jz) > 0.06 || riverMask(jx, jz) > 0.02) continue;
      if (PADS.some((p) => padMask(jx, jz, p, 1.5) > 0.3)) continue;
      const patch = fbm(jx * 0.09, jz * 0.09, 2, 77);
      if (patch < 0.36) continue;
      spots.push(jx, groundY(jx, jz), jz, h, patch);
    }
  }
  const count = spots.length / 5;
  const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.6 + gw.x * 0.35 + gw.z * 0.27) * 0.09 + sin(uTime * 3.1 + gw.x * 1.3) * 0.03;
          transformed.x += sway * uv.y;
          transformed.z += sway * 0.6 * uv.y;
        #endif`,
      );
  };
  const mesh = new THREE.InstancedMesh(tuft, mat, count);
  const col = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const h = spots[i * 5 + 3];
    const patch = spots[i * 5 + 4];
    E.set(0, h * 40, 0);
    Q.setFromEuler(E);
    const sc = 0.55 + h * 0.6 + patch * 0.4;
    M.compose(V.set(spots[i * 5], spots[i * 5 + 1] - 0.03, spots[i * 5 + 2]), Q, S.set(sc, sc * (0.7 + patch * 0.7), sc));
    mesh.setMatrixAt(i, M);
    const k = 0.16 + patch * 0.2;
    mesh.setColorAt(i, col.setRGB(k * (0.8 + h * 0.35), k, k * 0.55));
  }
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'grass';
  return mesh;
}

// ───────────────────────────────────────────────────────────── banners, lamps, pickups

function bannerTexture(faction) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const elvia = faction === 'elvia';
  g.fillStyle = elvia ? '#14233f' : '#33373d';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 600; i += 1) {
    g.fillStyle = `rgba(${elvia ? '120,150,210' : '190,190,190'},${0.02 + hash2(i, 1, 2) * 0.05})`;
    g.fillRect(hash2(i, 2, 2) * 128, hash2(i, 3, 2) * 256, 1, 6);
  }
  g.strokeStyle = elvia ? '#c9a227' : '#b4532a';
  g.lineWidth = 5;
  g.strokeRect(9, 9, 110, 238);
  g.lineWidth = 6;
  g.fillStyle = elvia ? '#e3c463' : '#b4532a';
  if (elvia) {
    // the crown and rising sun of Elvia
    g.beginPath();
    g.arc(64, 124, 30, Math.PI, 0);
    g.stroke();
    for (let i = 0; i < 7; i += 1) {
      const a = Math.PI + (i / 6) * Math.PI;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 38, 124 + Math.sin(a) * 38);
      g.lineTo(64 + Math.cos(a) * 52, 124 + Math.sin(a) * 52);
      g.stroke();
    }
    g.fillRect(28, 132, 72, 8);
    g.beginPath();
    g.moveTo(34, 172);
    g.lineTo(34, 150);
    g.lineTo(49, 162);
    g.lineTo(64, 146);
    g.lineTo(79, 162);
    g.lineTo(94, 150);
    g.lineTo(94, 172);
    g.closePath();
    g.fill();
  } else {
    // the iron gear of the Syndicate
    g.beginPath();
    g.arc(64, 128, 26, 0, TAU);
    g.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      g.save();
      g.translate(64 + Math.cos(a) * 34, 128 + Math.sin(a) * 34);
      g.rotate(a);
      g.fillRect(-6, -7, 12, 14);
      g.restore();
    }
    g.fillRect(58, 96, 12, 64);
  }
  // swallow-tail cut
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(0, 256);
  g.lineTo(64, 214);
  g.lineTo(128, 256);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildBanners(level, mats, group) {
  const texes = { elvia: bannerTexture('elvia'), syndicate: bannerTexture('syndicate') };
  const out = [];
  for (const b of level.banners) {
    const baseY = b.y + (b.onTower ?? 0);
    const poleH = b.onTower ? 3.2 : 5.2;
    const pole = new THREE.Mesh(cyl(0.045, 0.06, poleH, 6), mats.barkPlain);
    pole.position.set(b.x, baseY + poleH / 2, b.z);
    pole.castShadow = true;
    group.add(pole);
    const arm = new THREE.Mesh(cyl(0.03, 0.03, 1.0, 5), mats.barkPlain);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(b.x + 0.45, baseY + poleH - 0.15, b.z);
    group.add(arm);
    const geo = new THREE.PlaneGeometry(0.85, 1.9, 6, 12);
    geo.translate(0, -0.95, 0);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texes[b.faction], side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85, metalness: 0 }));
    cloth.position.set(b.x + 0.48, baseY + poleH - 0.18, b.z);
    cloth.castShadow = true;
    group.add(cloth);
    out.push({ mesh: cloth, base: geo.attributes.position.array.slice(), phase: b.x * 0.7 + b.z * 0.3 });
  }
  return out;
}

function buildLamps(level, B, lights) {
  for (const l of level.lamps) {
    B.add('dark', place(cyl(0.05, 0.07, 3.3, 6), l.x, l.y + 1.65, l.z));
    B.add('dark', place(boxGeo(0.7, 0.05, 0.05), l.x + 0.3, l.y + 3.25, l.z));
    B.add('dark', place(boxGeo(0.26, 0.05, 0.26), l.x + 0.6, l.y + 3.13, l.z));
    B.add('dark', place(boxGeo(0.3, 0.04, 0.3), l.x + 0.6, l.y + 2.72, l.z));
    B.add('lampGlass', place(boxGeo(0.19, 0.36, 0.19), l.x + 0.6, l.y + 2.93, l.z));
    lights.push({ x: l.x + 0.6, y: l.y + 2.9, z: l.z, color: 0xffc68a, intensity: 15, range: 16, flicker: 0.08, seed: l.x });
  }
}

const PICKUP_COLOR = { cells: 0xffb347, charges: 0xfff0b0, draught: 0xb9e6a0, dispatch: 0xf3eee1 };

function buildPickups(level, mats, group, glowTex) {
  const out = new Map();
  for (const p of level.pickups) {
    const g = new THREE.Group();
    let core;
    if (p.kind === 'cells') {
      core = new THREE.Group();
      const box = new THREE.Mesh(boxGeo(0.34, 0.2, 0.22), mats.brass);
      const cell = new THREE.Mesh(boxGeo(0.26, 0.12, 0.16), mats.cellGlow);
      cell.position.y = 0.13;
      core.add(box, cell);
    } else if (p.kind === 'charges') {
      core = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const rod = new THREE.Mesh(cyl(0.03, 0.03, 0.42, 6), mats.chargeGlow);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, 0.04 + i * 0.07, (i - 1) * 0.07);
        core.add(rod);
      }
      core.add(new THREE.Mesh(boxGeo(0.1, 0.24, 0.26), mats.brass));
    } else if (p.kind === 'draught') {
      core = new THREE.Group();
      const flask = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.draughtGlow);
      const neck = new THREE.Mesh(cyl(0.035, 0.045, 0.14, 8), mats.brass);
      neck.position.y = 0.15;
      core.add(flask, neck);
    } else {
      core = new THREE.Group();
      const page = new THREE.Mesh(boxGeo(0.3, 0.012, 0.4), mats.paper);
      const seal = new THREE.Mesh(cyl(0.045, 0.045, 0.02, 10), mats.warn);
      seal.position.set(0.07, 0.014, 0.12);
      core.add(page, seal);
    }
    core.position.y = 0.42;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PICKUP_COLOR[p.kind], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.1);
    halo.position.y = 0.45;
    g.add(core, halo);
    g.position.set(p.x, p.y, p.z);
    group.add(g);
    out.set(p.id, { group: g, core, halo, kind: p.kind });
  }
  return out;
}

// ───────────────────────────────────────────────────────────── entry

export function buildWorld(scene, level, tex, quality, shared) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  const mats = {
    stone: pbr(tex.stone),
    ashlar: pbr(tex.ashlar),
    wood: pbr(tex.wood),
    woodDark: pbr(tex.wood, { color: 0x6a5a4a }),
    woodEnd: pbr(tex.wood, { color: 0xd8c4a0 }),
    bark: pbr(tex.bark),
    barkPlain: pbr(tex.bark, { color: 0x8a7a6a }),
    canvas: pbr(tex.canvas),
    canvasNavy: pbr(tex.canvas, { color: 0x35508c, side: THREE.DoubleSide }),
    canvasGrey: pbr(tex.canvas, { color: 0x6f7378, side: THREE.DoubleSide }),
    plate: pbr(tex.plate),
    brass: pbr(tex.brass),
    slate: pbr(tex.slate),
    rock: pbr(tex.rock),
    char: pbr(tex.char),
    needles: pbr(tex.needles),
    dark: new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.7, metalness: 0.6 }),
    glow: glow(0xffa040, 3.2),
    lampGlass: glow(0xffc070, 5),
    warn: new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 0.55, metalness: 0.2, emissive: 0x5a1c08, emissiveIntensity: 0.6 }),
    cellGlow: glow(0xffb347, 3),
    chargeGlow: glow(0xfff0b0, 3.4),
    draughtGlow: glow(0xb9e6a0, 1.8),
    paper: new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.9, emissive: 0x6a6048, emissiveIntensity: 0.5 }),
  };
  for (const key of ['canvas', 'canvasNavy', 'canvasGrey']) mats[key].side = THREE.DoubleSide;
  mats.slate.side = THREE.DoubleSide;
  mats.char.side = THREE.DoubleSide;
  mats.plate.side = THREE.DoubleSide;

  const terrain = buildTerrain(tex);
  group.add(terrain);
  const water = buildWater(tex, level);
  group.add(water);

  const B = new Buckets();
  const dyn = { solids: [], winch: null };
  const lights = [];
  for (const s of level.solids) if (!s.hidden) addSolid(B, s, dyn);
  buildLamps(level, B, lights);
  // fire pits: a ring of stones, or an iron brazier
  for (const f of level.fires) {
    if (f.kind === 'campfire') {
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * TAU;
        B.add('rock', place(rockGeo(0.3, 0.22, 0.3, i + f.x), f.x + Math.cos(a) * 0.55, f.y, f.z + Math.sin(a) * 0.55));
      }
      for (let i = 0; i < 4; i += 1) B.add('char', place(cyl(0.06, 0.07, 0.9, 6), f.x, f.y + 0.2, f.z, (i / 4) * Math.PI, 0, 1.1));
    } else if (f.kind === 'brazier') {
      B.add('dark', place(cyl(0.34, 0.2, 0.3, 10), f.x, f.y + 0.95, f.z));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * TAU;
        B.add('dark', place(cyl(0.025, 0.025, 1.0, 5), f.x + Math.cos(a) * 0.22, f.y + 0.45, f.z + Math.sin(a) * 0.22, 0, Math.sin(a) * 0.3, -Math.cos(a) * 0.3));
      }
    }
    const big = f.kind === 'blaze';
    lights.push({ x: f.x, y: f.y + (big ? 2.2 * f.size : f.kind === 'brazier' ? 1.5 : 0.8), z: f.z, color: big ? 0xff8a3a : 0xffa050, intensity: big ? 90 * f.size : 20, range: big ? 44 : 17, flicker: 0.3, seed: f.x + f.z });
  }
  B.build(mats, group);

  const gateSolid = dyn.solids.find((s) => s.kind === 'gate');
  const gate = gateSolid ? buildGate(gateSolid, mats) : null;
  if (gate) group.add(gate);
  const casks = new Map();
  for (const s of dyn.solids) {
    if (s.kind !== 'fuel') continue;
    const m = buildCask(s, mats);
    group.add(m);
    casks.set(s.id, m);
  }
  let crank = null;
  if (dyn.winch) {
    crank = new THREE.Group();
    const drum = new THREE.Mesh(cyl(0.2, 0.2, 0.9, 10), mats.wood);
    drum.rotation.z = Math.PI / 2;
    const handle = new THREE.Mesh(boxGeo(0.06, 0.6, 0.06), mats.dark);
    handle.position.set(0.56, 0.3, 0);
    const grip = new THREE.Mesh(cyl(0.035, 0.035, 0.3, 6), mats.brass);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0.7, 0.6, 0);
    crank.add(drum, handle, grip);
    crank.position.set(dyn.winch.x, dyn.winch.y, dyn.winch.z);
    crank.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    group.add(crank);
  }

  for (const t of buildTrees(level, mats, quality)) group.add(t);
  const grass = buildGrass(quality, shared.time);
  if (grass) group.add(grass);
  const banners = buildBanners(level, mats, group);
  const pickups = buildPickups(level, mats, group, shared.glowTex);

  let gateY0 = gate ? gate.position.y : 0;
  return {
    group,
    mats,
    lights,
    water,
    terrain,
    casks,
    pickups,
    update(state, time, dt) {
      water.material.uniforms.uTime.value = time;
      const walker = state.enemies.find((e) => e.type === 'walker');
      if (walker) {
        const fx = -Math.sin(walker.lampYaw ?? walker.yaw);
        const fz = -Math.cos(walker.lampYaw ?? walker.yaw);
        water.material.uniforms.uLampPos.value.set(walker.x + fx * 2.3, walker.y + 6, walker.z + fz * 2.3);
        const lampOn = walker.hp > 0 && walker.mode !== 'kneel' ? 1 : 0;
        water.material.uniforms.uLampCol.value.setRGB(lampOn, 0.86 * lampOn, 0.6 * lampOn);
      }
      if (gate) {
        const k = state.gates.inner_gate ?? 0;
        gate.position.y = gateY0 + k * 3.9 + (k > 0 && k < 1 ? Math.sin(time * 40) * 0.008 : 0);
        if (crank && k > 0 && k < 1) crank.rotation.x -= dt * 3.2;
      }
      for (const [id, mesh] of casks) mesh.visible = !state.removed[id];
      for (const p of state.pickups) {
        const v = pickups.get(p.id);
        if (!v) continue;
        v.group.visible = !p.taken;
        if (p.taken) continue;
        v.core.rotation.y = time * 1.2 + p.x;
        v.core.position.y = 0.42 + Math.sin(time * 2 + p.z) * 0.05;
        v.halo.material.opacity = 0.4 + Math.sin(time * 3 + p.x) * 0.12;
      }
      for (const b of banners) {
        const arr = b.mesh.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          const by = b.base[i + 1];
          const sway = -by / 1.9;
          arr[i + 2] = Math.sin(time * 2.2 + b.phase + by * 2.4 + b.base[i] * 2) * 0.14 * sway + Math.sin(time * 0.7 + b.phase) * 0.1 * sway;
          arr[i] = b.base[i] + Math.sin(time * 1.3 + b.phase + by) * 0.03 * sway;
        }
        b.mesh.geometry.attributes.position.needsUpdate = true;
        b.mesh.geometry.computeVertexNormals();
      }
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      scene.remove(group);
      gateY0 = 0;
    },
  };
}

export { FOG_COLOR, boxGeo, cyl, place };
