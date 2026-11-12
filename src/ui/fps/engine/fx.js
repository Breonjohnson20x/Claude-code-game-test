// Everything brief and bright: fire, smoke, sparks, tracers, bolts in flight, scorch marks,
// blast flashes, the Arc Pulse ring, shell markers on the ground and river mist. All pooled:
// nothing is allocated while the fight is on.

import * as THREE from 'three';
import { WATER_Y, groundY } from '../../../game/fps/level.js';
import { walkerHullY } from '../../../game/fps/combat.js';

// atlas cells (2×2, canvas is flipped on upload): u offset, v offset
const CELL = { glow: [0, 0.5], smoke: [0.5, 0.5], flame: [0, 0], spark: [0.5, 0] };

const P_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aParam; // size, rotation, cell u, cell v
attribute vec4 aColor;
varying vec2 vUv;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  float c = cos(aParam.y), s = sin(aParam.y);
  vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aParam.x;
  vec4 mvPosition = viewMatrix * vec4(aPos, 1.0);
  mvPosition.xy += corner;
  gl_Position = projectionMatrix * mvPosition;
  vUv = (uv * 0.5) + aParam.zw;
  vColor = aColor;
  #include <fog_vertex>
}`;
const P_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uAdd;
varying vec2 vUv;
varying vec4 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  float a = texture2D(uMap, vUv).a * vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * mix(1.0, a, uAdd), a);
  #ifdef USE_FOG
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, vec3(0.0), uAdd), fogFactor);
    gl_FragColor.a *= mix(1.0, 1.0 - fogFactor * 0.5, uAdd);
  #endif
}`;

class Particles {
  constructor(max, additive, atlas) {
    this.max = max;
    this.n = 0;
    this.data = new Float32Array(max * 16); // x y z vx vy vz life maxLife size grow rot spin gravity drag alpha fadeIn
    this.cells = new Float32Array(max * 2);
    this.cols = new Float32Array(max * 3);
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aParam = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    for (const a of [this.aPos, this.aParam, this.aColor]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos);
    g.setAttribute('aParam', this.aParam);
    g.setAttribute('aColor', this.aColor);
    const mat = new THREE.ShaderMaterial({
      vertexShader: P_VERT,
      fragmentShader: P_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uAdd: { value: additive ? 1 : 0 } }]),
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mat.uniforms.uMap.value = atlas;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
    g.instanceCount = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, size, grow, r, g, b, alpha, cell, gravity = 0, drag = 0, spin = 0, fadeIn = 0.08) {
    if (this.n >= this.max) return;
    const i = this.n * 16;
    const d = this.data;
    d[i] = x;
    d[i + 1] = y;
    d[i + 2] = z;
    d[i + 3] = vx;
    d[i + 4] = vy;
    d[i + 5] = vz;
    d[i + 6] = life;
    d[i + 7] = life;
    d[i + 8] = size;
    d[i + 9] = grow;
    d[i + 10] = (x * 12.9 + y * 78.2 + z * 37.7) % 6.283;
    d[i + 11] = spin;
    d[i + 12] = gravity;
    d[i + 13] = drag;
    d[i + 14] = alpha;
    d[i + 15] = fadeIn;
    this.cells[this.n * 2] = cell[0];
    this.cells[this.n * 2 + 1] = cell[1];
    this.cols[this.n * 3] = r;
    this.cols[this.n * 3 + 1] = g;
    this.cols[this.n * 3 + 2] = b;
    this.n += 1;
  }

  update(dt) {
    const d = this.data;
    let w = 0;
    for (let k = 0; k < this.n; k += 1) {
      const i = k * 16;
      const life = d[i + 6] - dt;
      if (life <= 0) continue;
      const drag = Math.exp(-d[i + 13] * dt);
      const vx = d[i + 3] * drag;
      const vy = (d[i + 4] - d[i + 12] * dt) * drag;
      const vz = d[i + 5] * drag;
      const j = w * 16;
      d[j] = d[i] + vx * dt;
      d[j + 1] = d[i + 1] + vy * dt;
      d[j + 2] = d[i + 2] + vz * dt;
      d[j + 3] = vx;
      d[j + 4] = vy;
      d[j + 5] = vz;
      d[j + 6] = life;
      d[j + 7] = d[i + 7];
      d[j + 8] = d[i + 8] + d[i + 9] * dt;
      d[j + 9] = d[i + 9];
      d[j + 10] = d[i + 10] + d[i + 11] * dt;
      d[j + 11] = d[i + 11];
      d[j + 12] = d[i + 12];
      d[j + 13] = d[i + 13];
      d[j + 14] = d[i + 14];
      d[j + 15] = d[i + 15];
      if (w !== k) {
        this.cells[w * 2] = this.cells[k * 2];
        this.cells[w * 2 + 1] = this.cells[k * 2 + 1];
        this.cols[w * 3] = this.cols[k * 3];
        this.cols[w * 3 + 1] = this.cols[k * 3 + 1];
        this.cols[w * 3 + 2] = this.cols[k * 3 + 2];
      }
      const t = 1 - life / d[j + 7];
      const fade = Math.min(1, t / d[j + 15]) * (1 - t) * (1 - t * t * 0.3);
      this.aPos.array[w * 3] = d[j];
      this.aPos.array[w * 3 + 1] = d[j + 1];
      this.aPos.array[w * 3 + 2] = d[j + 2];
      this.aParam.array[w * 4] = d[j + 8];
      this.aParam.array[w * 4 + 1] = d[j + 10];
      this.aParam.array[w * 4 + 2] = this.cells[w * 2];
      this.aParam.array[w * 4 + 3] = this.cells[w * 2 + 1];
      this.aColor.array[w * 4] = this.cols[w * 3];
      this.aColor.array[w * 4 + 1] = this.cols[w * 3 + 1];
      this.aColor.array[w * 4 + 2] = this.cols[w * 3 + 2];
      this.aColor.array[w * 4 + 3] = d[j + 14] * fade;
      w += 1;
    }
    this.n = w;
    this.mesh.geometry.instanceCount = w;
    this.aPos.needsUpdate = true;
    this.aParam.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }
}

const B_VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec4 aColor; // rgb, alpha
attribute float aWidth;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec3 p = mix(aStart, aEnd, position.x + 0.5);
  vec3 dir = normalize(aEnd - aStart + vec3(1e-5));
  vec3 side = normalize(cross(dir, normalize(cameraPosition - p)));
  p += side * position.y * aWidth;
  vUv = uv;
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const B_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float along = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * 0.6 + 0.4;
  float core = pow(across, 3.0);
  gl_FragColor = vec4(vColor.rgb * (core * 1.6 + across * 0.35) * along * vColor.a, 1.0);
}`;

class Beams {
  constructor(max) {
    this.max = max;
    this.n = 0;
    this.life = new Float32Array(max * 2);
    this.alpha = new Float32Array(max);
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aStart = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aEnd = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aWidth = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.aStart, this.aEnd, this.aColor, this.aWidth]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aStart', this.aStart);
    g.setAttribute('aEnd', this.aEnd);
    g.setAttribute('aColor', this.aColor);
    g.setAttribute('aWidth', this.aWidth);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: B_VERT, fragmentShader: B_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    g.instanceCount = 0;
  }

  /** life <= 0: drawn for this frame only. */
  add(x0, y0, z0, x1, y1, z1, width, r, g, b, alpha, life = 0) {
    if (this.n >= this.max) return;
    const i = this.n;
    this.aStart.array.set([x0, y0, z0], i * 3);
    this.aEnd.array.set([x1, y1, z1], i * 3);
    this.aColor.array.set([r, g, b, alpha], i * 4);
    this.aWidth.array[i] = width;
    this.life[i * 2] = life;
    this.life[i * 2 + 1] = life;
    this.alpha[i] = alpha;
    this.n += 1;
  }

  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i += 1) {
      const life = this.life[i * 2] - dt;
      if (this.life[i * 2 + 1] <= 0 || life <= 0) continue; // one-frame beams are re-added by the caller
      if (w !== i) {
        this.aStart.array.copyWithin(w * 3, i * 3, i * 3 + 3);
        this.aEnd.array.copyWithin(w * 3, i * 3, i * 3 + 3);
        this.aColor.array.copyWithin(w * 4, i * 4, i * 4 + 4);
        this.aWidth.array[w] = this.aWidth.array[i];
        this.life[w * 2 + 1] = this.life[i * 2 + 1];
        this.alpha[w] = this.alpha[i];
      }
      this.life[w * 2] = life;
      const k = life / this.life[w * 2 + 1];
      this.aColor.array[w * 4 + 3] = this.alpha[w] * k * k;
      w += 1;
    }
    this.n = w;
  }

  commit() {
    this.mesh.geometry.instanceCount = this.n;
    this.aStart.needsUpdate = true;
    this.aEnd.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aWidth.needsUpdate = true;
  }
}

const rnd = (() => {
  let s = 1234567;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
})();
const spread = (k) => (rnd() - 0.5) * 2 * k;

const SURFACE_DUST = {
  wall: [0.5, 0.48, 0.45],
  gatetower: [0.5, 0.48, 0.45],
  block: [0.55, 0.54, 0.52],
  rock: [0.45, 0.44, 0.42],
  well: [0.5, 0.48, 0.45],
  road: [0.4, 0.33, 0.25],
  dirt: [0.38, 0.32, 0.25],
  gravel: [0.45, 0.44, 0.42],
  grass: [0.25, 0.24, 0.16],
  mud: [0.2, 0.17, 0.13],
  sandbag: [0.5, 0.45, 0.35],
};
const METAL = new Set(['fuel', 'crane', 'shed', 'winch', 'gate']);
const WOODY = new Set(['crate', 'palisade', 'cart', 'wagon', 'log', 'hut', 'watchtower', 'barricade', 'trunk', 'tent']);

export function createFx(scene, level, quality, shared, reducedMotion) {
  const density = quality.particles * (reducedMotion ? 0.5 : 1);
  const add = new Particles(Math.round(1400 * quality.particles), true, shared.atlas);
  const smoke = new Particles(Math.round(700 * quality.particles), false, shared.atlas);
  const beams = new Beams(160);
  scene.add(smoke.mesh, add.mesh, beams.mesh);

  // scorch marks
  const DECALS = 72;
  const decalMat = new THREE.MeshBasicMaterial({ map: shared.glowTex, color: 0x050505, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: true });
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), decalMat, DECALS);
  decals.frustumCulled = false;
  decals.renderOrder = 3;
  const dM = new THREE.Matrix4();
  const dQ = new THREE.Quaternion();
  const dN = new THREE.Vector3();
  const dP = new THREE.Vector3();
  const dS = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  dM.makeScale(0, 0, 0);
  for (let i = 0; i < DECALS; i += 1) decals.setMatrixAt(i, dM);
  let decalAt = 0;
  scene.add(decals);
  function decal(x, y, z, nx, ny, nz, size) {
    dN.set(nx, ny, nz).normalize();
    dQ.setFromUnitVectors(Z, dN);
    dM.compose(dP.set(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02), dQ, dS.set(size, size, size));
    decals.setMatrixAt(decalAt, dM);
    decalAt = (decalAt + 1) % DECALS;
    decals.instanceMatrix.needsUpdate = true;
  }

  // ground rings: shell markers and the Arc Pulse
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
  ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i += 1) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false;
    m.renderOrder = 4;
    scene.add(m);
    rings.push({ mesh: m, life: 0, max: 1, r0: 1, r1: 1, kind: '' });
  }
  function ring(x, y, z, r0, r1, life, color, kind) {
    const r = rings.find((q) => q.life <= 0) ?? rings[0];
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
    r.life = life;
    r.max = life;
    r.r0 = r0;
    r.r1 = r1;
    r.kind = kind;
  }

  const lights = [];
  function flashLight(x, y, z, color, intensity, range, life, priority = 2) {
    lights.push({ x, y, z, color, intensity, base: intensity, range, life, max: life, priority, seed: 0 });
  }

  function sparks(x, y, z, nx, ny, nz, n, r, g, b, speed = 5) {
    for (let i = 0; i < Math.ceil(n * density); i += 1) {
      add.spawn(x, y, z, nx * speed * rnd() + spread(2.4), ny * speed * rnd() + spread(2.4) + 1.5, nz * speed * rnd() + spread(2.4), 0.25 + rnd() * 0.45, 0.05 + rnd() * 0.05, -0.05, r, g, b, 1, CELL.spark, 11, 1.2);
    }
  }
  function puff(x, y, z, nx, ny, nz, n, col, size = 0.3, alpha = 0.5) {
    for (let i = 0; i < Math.ceil(n * density); i += 1) {
      smoke.spawn(x + spread(0.1), y + spread(0.1), z + spread(0.1), nx * (0.6 + rnd()) + spread(0.5), ny * (0.6 + rnd()) + 0.3 + spread(0.4), nz * (0.6 + rnd()) + spread(0.5), 0.6 + rnd() * 0.8, size * (0.7 + rnd() * 0.6), 0.9, col[0], col[1], col[2], alpha, CELL.smoke, -0.3, 1.6, spread(1));
    }
  }

  function impact(x, y, z, nx, ny, nz, surface, heavy) {
    if (surface === 'water') {
      for (let i = 0; i < 7 * density; i += 1) smoke.spawn(x + spread(0.15), WATER_Y + 0.05, z + spread(0.15), spread(1), 2 + rnd() * 2.5, spread(1), 0.4 + rnd() * 0.3, 0.12, 0.5, 0.75, 0.82, 0.9, 0.6, CELL.glow, 9, 0.5);
      ring(x, WATER_Y + 0.02, z, 0.1, 0.9, 0.7, 0x8fa5c0, 'ripple');
      return;
    }
    if (surface === 'player' || surface === 'none') return;
    if (METAL.has(surface)) {
      sparks(x, y, z, nx, ny, nz, heavy ? 16 : 9, 1, 0.75, 0.35, 7);
      decal(x, y, z, nx, ny, nz, 0.16);
    } else if (WOODY.has(surface)) {
      puff(x, y, z, nx, ny, nz, 3, [0.36, 0.28, 0.2], 0.2, 0.55);
      sparks(x, y, z, nx, ny, nz, 3, 0.9, 0.7, 0.45, 3);
      decal(x, y, z, nx, ny, nz, 0.2);
    } else {
      puff(x, y, z, nx, ny, nz, heavy ? 6 : 4, SURFACE_DUST[surface] ?? SURFACE_DUST.wall, 0.26, 0.5);
      sparks(x, y, z, nx, ny, nz, 4, 1, 0.8, 0.5, 4);
      decal(x, y, z, nx, ny, nz, heavy ? 0.5 : 0.24);
    }
    add.spawn(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, 0, 0, 0, 0.09, heavy ? 0.9 : 0.45, 0, 1, 0.8, 0.5, 0.9, CELL.glow);
  }

  function explosion(x, y, z, radius, kind) {
    const big = kind === 'fuel';
    const k = big ? 1.5 : 0.85;
    flashLight(x, y + 1, z, 0xff9a40, big ? 900 : 380, big ? 46 : 26, big ? 0.7 : 0.4, 3);
    add.spawn(x, y + 0.5, z, 0, 0, 0, 0.16, radius * 2.4, 6, 1, 0.92, 0.75, 1, CELL.glow);
    for (let i = 0; i < 16 * k * density; i += 1) add.spawn(x + spread(0.5), y + 0.4 + rnd() * 0.6, z + spread(0.5), spread(4.5), 1.5 + rnd() * 5, spread(4.5), 0.35 + rnd() * 0.45, 0.9 * k + rnd(), 2.2, 1, 0.5 + rnd() * 0.25, 0.14, 0.95, CELL.flame, -1.5, 1.8, spread(2));
    for (let i = 0; i < 14 * k * density; i += 1) smoke.spawn(x + spread(0.8), y + 0.6 + rnd(), z + spread(0.8), spread(2.6), 1.2 + rnd() * 2.6, spread(2.6), 1.6 + rnd() * 2.2, 1.1 * k + rnd(), 1.5, 0.07, 0.065, 0.06, 0.75, CELL.smoke, -0.25, 0.8, spread(0.7), 0.15);
    sparks(x, y + 0.4, z, 0, 1, 0, 34 * k, 1, 0.72, 0.3, 11);
    for (let i = 0; i < 10 * density; i += 1) smoke.spawn(x + spread(radius * 0.5), groundY(x, z) + 0.15, z + spread(radius * 0.5), spread(3.5), 0.4 + rnd(), spread(3.5), 0.9 + rnd(), 0.7, 1.6, 0.3, 0.26, 0.2, 0.45, CELL.smoke, 0, 1.4);
    decal(x, groundY(x, z) + 0.03, z, 0, 1, 0, radius * 1.3);
    ring(x, groundY(x, z) + 0.08, z, 0.3, radius, 0.35, 0xffb060, 'shock');
  }

  // fires and mist: steady emitters
  const emitters = level.fires.map((f) => ({ ...f, acc: 0, smokeAcc: 0 }));
  let mistAcc = 0;
  const shellMarks = new Map();
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  function update(state, events, time, dt, camera) {
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    up.crossVectors(right, fwd);
    const cx = camera.position.x;
    const cz = camera.position.z;

    for (const ev of events) {
      switch (ev.type) {
        case 'shot': {
          const lance = ev.weapon === 'lance';
          tmp.copy(camera.position).addScaledVector(right, 0.17 * (1 - state.player.ads)).addScaledVector(up, -0.13 * (1 - state.player.ads) - 0.03).addScaledVector(fwd, 0.75);
          const ex = ev.ox + ev.dx * ev.dist;
          const ey = ev.oy + ev.dy * ev.dist;
          const ez = ev.oz + ev.dz * ev.dist;
          if (lance) {
            beams.add(tmp.x, tmp.y, tmp.z, ex, ey, ez, 0.2, 1, 0.86, 0.5, 2.6, 0.32);
            beams.add(tmp.x, tmp.y, tmp.z, ex, ey, ez, 0.75, 1, 0.6, 0.25, 0.5, 0.45);
            flashLight(tmp.x, tmp.y, tmp.z, 0xffd890, 110, 20, 0.12, 3);
          } else {
            beams.add(tmp.x, tmp.y, tmp.z, ex, ey, ez, 0.06, 1, 0.8, 0.45, 1.5, 0.075);
            flashLight(tmp.x, tmp.y, tmp.z, 0xffc070, 46, 13, 0.06, 3);
          }
          if (ev.world) impact(ex, ey, ez, ev.nx, ev.ny, ev.nz, ev.surface, lance);
          break;
        }
        case 'enemy_hit': {
          const kill = ev.source !== 'blast';
          if (kill) {
            sparks(ev.x, ev.y, ev.z, -fwd.x, 0.4, -fwd.z, ev.enemy === 'walker' ? 10 : ev.zone === 'head' ? 9 : 5, 1, 0.72, 0.36, ev.enemy === 'walker' ? 8 : 4);
            add.spawn(ev.x, ev.y, ev.z, 0, 0, 0, 0.08, ev.zone === 'head' ? 0.7 : 0.4, 0, 1, 0.85, 0.6, 0.9, CELL.glow);
            if (ev.enemy !== 'walker') puff(ev.x, ev.y, ev.z, -fwd.x, 0.2, -fwd.z, 2, [0.16, 0.15, 0.15], 0.16, 0.5);
          }
          break;
        }
        case 'enemy_fire':
          add.spawn(ev.x, ev.y, ev.z, 0, 0, 0, 0.07, ev.enemy === 'heavy' ? 0.75 : 0.55, 0, 1, 0.62, 0.3, 1, CELL.glow);
          flashLight(ev.x, ev.y, ev.z, 0xff8840, 34, 11, 0.07, 1);
          break;
        case 'walker_fire':
          add.spawn(ev.x, ev.y, ev.z, 0, 0, 0, 0.14, 2.2, 3, 1, 0.7, 0.35, 1, CELL.glow);
          puff(ev.x, ev.y, ev.z, 0, 0.4, 0, 5, [0.2, 0.19, 0.18], 0.7, 0.6);
          flashLight(ev.x, ev.y, ev.z, 0xff9a50, 260, 30, 0.14, 3);
          shellMarks.set(`${Math.round(ev.tx * 10)}:${Math.round(ev.tz * 10)}`, 1);
          ring(ev.tx, groundY(ev.tx, ev.tz) + 0.1, ev.tz, 3.4, 0.5, 1.15, 0xff5a20, 'mark');
          break;
        case 'impact':
          impact(ev.x, ev.y, ev.z, 0, 1, 0, ev.surface, ev.kind === 'slug');
          break;
        case 'explosion':
          explosion(ev.x, ev.y, ev.z, ev.radius, ev.kind);
          break;
        case 'pulse':
          ring(ev.x, groundY(ev.x, ev.z) + 0.12, ev.z, 0.6, ev.radius, 0.5, 0xffd97a, 'pulse');
          add.spawn(ev.x, ev.y, ev.z, 0, 0, 0, 0.3, 2, 30, 1, 0.85, 0.5, 0.6, CELL.glow);
          flashLight(ev.x, ev.y, ev.z, 0xffd080, 300, 26, 0.3, 3);
          for (let i = 0; i < 30 * density; i += 1) {
            const a = rnd() * 6.283;
            add.spawn(ev.x, ev.y - 0.4 + rnd() * 0.8, ev.z, Math.cos(a) * 16, spread(1.5), Math.sin(a) * 16, 0.45, 0.14, 0, 1, 0.85, 0.5, 1, CELL.spark, 0, 2.5);
          }
          break;
        case 'walker_stomp': {
          const gy = groundY(ev.x, ev.z);
          ring(ev.x, gy + 0.1, ev.z, 1.5, 8.5, 0.5, 0xc9a070, 'shock');
          for (let i = 0; i < 26 * density; i += 1) {
            const a = rnd() * 6.283;
            smoke.spawn(ev.x + Math.cos(a) * 2.2, gy + 0.2, ev.z + Math.sin(a) * 2.2, Math.cos(a) * (4 + rnd() * 4), 0.6 + rnd() * 1.2, Math.sin(a) * (4 + rnd() * 4), 1.1 + rnd(), 0.9, 2, 0.32, 0.29, 0.25, 0.5, CELL.smoke, 0.4, 1.6);
          }
          break;
        }
        case 'walker_leg':
          sparks(ev.x, ev.y, ev.z, 0, 1, 0, 40, 1, 0.8, 0.4, 9);
          puff(ev.x, ev.y, ev.z, 0, 1, 0, 8, [0.1, 0.1, 0.1], 0.8, 0.7);
          flashLight(ev.x, ev.y, ev.z, 0xffb060, 200, 20, 0.25, 3);
          break;
        case 'walker_down':
          explosion(ev.x, ev.y + 4, ev.z, 5, 'fuel');
          break;
        case 'enemy_strike':
          if (ev.hit) sparks(ev.x, ev.y, ev.z, fwd.x, 0.2, fwd.z, 8, 1, 0.9, 0.6, 5);
          break;
        case 'step':
          if (ev.surface === 'water') {
            const p = state.player;
            for (let i = 0; i < 5 * density; i += 1) smoke.spawn(p.x + spread(0.25), WATER_Y + 0.05, p.z + spread(0.25), spread(1.2), 1.2 + rnd() * 1.6, spread(1.2), 0.35 + rnd() * 0.25, 0.1, 0.4, 0.75, 0.82, 0.9, 0.5, CELL.glow, 9, 0.5);
            ring(p.x, WATER_Y + 0.02, p.z, 0.15, 1.0, 0.8, 0x8fa5c0, 'ripple');
          }
          break;
        case 'pickup':
          for (let i = 0; i < 10 * density; i += 1) add.spawn(ev.x + spread(0.2), ev.y + 0.4, ev.z + spread(0.2), spread(0.8), 1 + rnd() * 1.5, spread(0.8), 0.5 + rnd() * 0.3, 0.07, 0, 1, 0.85, 0.5, 1, CELL.spark, -1, 1);
          break;
        default:
      }
    }

    // fires: flame, embers, smoke
    for (const f of emitters) {
      const dist = Math.hypot(f.x - cx, f.z - cz);
      if (dist > 110) continue;
      const lod = dist > 55 ? 0.45 : 1;
      const big = f.kind === 'blaze';
      const baseY = f.y + (f.kind === 'brazier' ? 1.05 : big ? 0.6 : 0.15);
      f.acc += dt * (big ? 34 * f.size : 16) * density * lod;
      while (f.acc >= 1) {
        f.acc -= 1;
        const s = f.size;
        const wide = big ? s * 1.3 : 0.16;
        add.spawn(f.x + spread(wide), baseY + rnd() * 0.2, f.z + spread(wide), spread(0.25), (big ? 2.2 : 1.1) + rnd() * 1.4, spread(0.25), 0.45 + rnd() * 0.5, (big ? 1.1 * s : 0.42 * s) * (0.7 + rnd() * 0.6), big ? 0.6 : -0.2, 1, 0.52 + rnd() * 0.2, 0.14, 0.9, CELL.flame, -0.8, 0.4, spread(1.2), 0.2);
        if (rnd() < 0.3) add.spawn(f.x + spread(wide), baseY + 0.4, f.z + spread(wide), spread(0.9) + 0.5, 1.6 + rnd() * 2.8, spread(0.9), 1.2 + rnd() * 2.2, 0.035 + rnd() * 0.035, 0, 1, 0.62, 0.22, 1, CELL.spark, -0.6, 0.25);
      }
      f.smokeAcc += dt * (big ? 7 * f.size : 2.2) * density * lod;
      while (f.smokeAcc >= 1) {
        f.smokeAcc -= 1;
        const wide = big ? f.size : 0.12;
        smoke.spawn(f.x + spread(wide), baseY + (big ? 1.8 * f.size : 0.7), f.z + spread(wide), 0.5 + spread(0.3), (big ? 2.4 : 1.1) + rnd(), spread(0.3), (big ? 5 : 2.6) + rnd() * 2, (big ? 1.4 * f.size : 0.4), big ? 1.1 : 0.45, 0.085, 0.075, 0.07, big ? 0.5 : 0.3, CELL.smoke, 0, 0.12, spread(0.4), 0.2);
      }
    }
    // a slow mist lies on the Greywater
    mistAcc += dt * 2.4 * density;
    while (mistAcc >= 1) {
      mistAcc -= 1;
      const mx = cx + spread(55);
      const mz = -128 + spread(15);
      smoke.spawn(mx, WATER_Y + 0.5 + rnd() * 0.8, mz, 0.5 + rnd() * 0.5, 0.02, spread(0.1), 9 + rnd() * 6, 5 + rnd() * 5, 0.25, 0.32, 0.38, 0.47, 0.13, CELL.smoke, 0, 0, spread(0.05), 0.3);
    }
    // the burning walker and any walker with a broken knee smokes
    for (const e of state.enemies) {
      if (e.type !== 'walker' || e.dormant) continue;
      const hurt = e.hp <= 0 ? 1 : e.mode === 'kneel' ? 0.6 : (e.legs[0] <= 0 || e.legs[1] <= 0 ? 0.3 : 0);
      if (hurt > 0 && rnd() < hurt * dt * 30 * density) {
        const hy = e.y + (e.hp <= 0 ? 3 : walkerHullY(e));
        smoke.spawn(e.x + spread(1.2), hy + 0.5, e.z + spread(1.2), 0.4 + spread(0.4), 2 + rnd(), spread(0.4), 3 + rnd() * 2, 1, 1, 0.06, 0.055, 0.05, 0.6, CELL.smoke, 0, 0.2, spread(0.5), 0.2);
        if (e.hp <= 0 && rnd() < 0.5) add.spawn(e.x + spread(1), hy + 0.2, e.z + spread(1), spread(0.3), 1.6 + rnd(), spread(0.3), 0.5 + rnd() * 0.4, 0.9, 0.3, 1, 0.5, 0.14, 0.8, CELL.flame, -0.8, 0.4);
      }
    }

    smoke.update(dt);
    add.update(dt);
    beams.update(dt);
    // bolts in flight: a bright dart with a short tail (re-added every frame)
    for (const pr of state.projectiles) {
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
      if (pr.kind === 'shell') {
        const k = 0.9 / sp;
        beams.add(pr.x - pr.vx * k, pr.y - pr.vy * k, pr.z - pr.vz * k, pr.x, pr.y, pr.z, 0.5, 1, 0.55, 0.2, 2.2);
        if (rnd() < dt * 60 * density) smoke.spawn(pr.x, pr.y, pr.z, spread(0.3), 0.3, spread(0.3), 0.8 + rnd() * 0.5, 0.3, 0.9, 0.18, 0.17, 0.16, 0.4, CELL.smoke, 0, 0.5);
      } else {
        const k = (pr.kind === 'slug' ? 1.3 : 1.9) / sp;
        const slug = pr.kind === 'slug';
        beams.add(pr.x - pr.vx * k, pr.y - pr.vy * k, pr.z - pr.vz * k, pr.x, pr.y, pr.z, slug ? 0.1 : 0.13, 1, slug ? 0.7 : 0.48, slug ? 0.45 : 0.16, 2.4);
      }
    }
    // the walker's lance: a sweeping bar of light
    for (const e of state.enemies) {
      if (e.type !== 'walker' || !e.beam || e.hp <= 0) continue;
      const fx = -Math.sin(e.beam.yaw);
      const fz = -Math.cos(e.beam.yaw);
      const sx = e.x + fx * 2.6;
      const sy = e.y + walkerHullY(e) - 0.2;
      const sz = e.z + fz * 2.6;
      const p = state.player;
      const flat = Math.max(8, Math.hypot(p.x - e.x, p.z - e.z));
      const slope = (p.y + 0.95 - sy) / flat;
      beams.add(sx, sy, sz, sx + fx * 70, sy + slope * 70, sz + fz * 70, 0.55, 1, 0.5, 0.18, 4);
      beams.add(sx, sy, sz, sx + fx * 70, sy + slope * 70, sz + fz * 70, 2.2, 1, 0.35, 0.1, 0.8);
      if (rnd() < 0.6) {
        const d = 6 + rnd() * 50;
        const gx = sx + fx * d;
        const gz = sz + fz * d;
        sparks(gx, sy + slope * d, gz, 0, 1, 0, 1, 1, 0.6, 0.25, 3);
      }
    }
    beams.commit();

    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (r.kind === 'mark' ? t : 1 - (1 - t) * (1 - t));
      r.mesh.scale.setScalar(rad);
      r.mesh.material.opacity = r.kind === 'mark' ? 0.35 + 0.5 * t + Math.sin(time * 30) * 0.12 : (1 - t) * (r.kind === 'ripple' ? 0.35 : 0.9);
    }
    for (let i = lights.length - 1; i >= 0; i -= 1) {
      const l = lights[i];
      l.life -= dt;
      if (l.life <= 0) {
        lights.splice(i, 1);
        continue;
      }
      l.intensity = l.base * (l.life / l.max);
    }
  }

  return {
    update,
    lights: () => lights,
    dispose() {
      for (const m of [add.mesh, smoke.mesh, beams.mesh, decals]) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      for (const r of rings) scene.remove(r.mesh);
      shellMarks.clear();
    },
  };
}
