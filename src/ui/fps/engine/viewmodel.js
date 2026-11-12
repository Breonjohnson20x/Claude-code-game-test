// What the Sovereign holds: the Lattice Carbine and the Sunlance, gauntleted hands, the Shield
// Ward and the blade. Drawn in its own scene over the world (own depth, own field of view) so
// it never clips into a wall, and animated from the simulation: sway, bob, recoil, reload,
// aiming, sprinting, swapping.

import * as THREE from 'three';
import { WEAPONS } from '../../../game/fps/combat.js';
import { pbr } from './textures.js';
import { MOON_DIR } from './sky.js';
import { bake } from './merge.js';

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);
const ease = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

function part(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
const zCyl = (r0, r1, len, seg = 14) => {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
};
/** A box with softened edges, so metal catches a highlight along every corner. */
function bevel(w, h, d, r = 0.004) {
  const shape = new THREE.Shape();
  const x = w / 2 - r;
  const y = h / 2 - r;
  shape.moveTo(-x, -h / 2);
  shape.lineTo(x, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -y);
  shape.lineTo(w / 2, y);
  shape.quadraticCurveTo(w / 2, h / 2, x, h / 2);
  shape.lineTo(-x, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, y);
  shape.lineTo(-w / 2, -y);
  shape.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -d / 2 + r);
  return g;
}

function buildHand(M, side) {
  // a gauntlet: navy sleeve, brass vambrace, leather glove curled round a grip
  const g = new THREE.Group();
  const sleeve = new THREE.CapsuleGeometry(0.046, 0.3, 4, 12);
  sleeve.rotateX(Math.PI / 2);
  g.add(part(sleeve, M.navy, 0, 0, 0.24));
  g.add(part(zCyl(0.05, 0.047, 0.17, 14), M.glove, 0, 0, 0.1));
  g.add(part(new THREE.TorusGeometry(0.05, 0.006, 6, 18), M.gold, 0, 0, 0.02));
  g.add(part(new THREE.TorusGeometry(0.05, 0.006, 6, 18), M.gold, 0, 0, 0.18));
  g.add(part(bevel(0.07, 0.03, 0.09, 0.008), M.brass, 0, 0.042, 0.1)); // plate over the back of the wrist
  g.add(part(bevel(0.085, 0.045, 0.1, 0.012), M.glove, 0, 0, -0.045));
  for (let i = 0; i < 4; i += 1) {
    const f = new THREE.CapsuleGeometry(0.0115, 0.05, 3, 8);
    f.rotateX(Math.PI / 2);
    const finger = new THREE.Group();
    finger.position.set((i - 1.5) * 0.021, 0.008, -0.095);
    finger.add(part(f, M.glove, 0, 0, -0.025));
    const tip = part(f.clone(), M.glove, 0, -0.022, -0.055, -1.3);
    finger.add(tip);
    finger.rotation.x = -0.55;
    g.add(finger);
    g.add(part(bevel(0.019, 0.01, 0.03, 0.003), M.brass, (i - 1.5) * 0.021, 0.027, -0.075));
  }
  const thumb = new THREE.CapsuleGeometry(0.013, 0.05, 3, 8);
  thumb.rotateX(Math.PI / 2);
  g.add(part(thumb, M.glove, -side * 0.048, -0.006, -0.06, 0, side * 0.5, 0));
  return g;
}

function buildCarbine(M) {
  const g = new THREE.Group();
  g.add(part(bevel(0.056, 0.084, 0.34, 0.006), M.gun, 0, 0, 0));
  g.add(part(bevel(0.03, 0.016, 0.3, 0.003), M.gun, 0, 0.05, -0.01));
  for (let i = 0; i < 9; i += 1) g.add(part(new THREE.BoxGeometry(0.032, 0.004, 0.012), M.dark, 0, 0.059, -0.14 + i * 0.03));
  // engraved brass side plates with the Elvian sun
  for (const s of [-1, 1]) {
    g.add(part(bevel(0.004, 0.05, 0.2, 0.0015), M.brass, s * 0.03, 0.002, 0.02));
    g.add(part(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 16), M.gold, s * 0.0325, 0.004, 0.02, 0, 0, Math.PI / 2));
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI;
      g.add(part(new THREE.BoxGeometry(0.002, 0.012, 0.0025), M.gold, s * 0.0325, 0.004 + Math.sin(a) * 0.024, 0.02 + Math.cos(a) * 0.024, a - Math.PI / 2));
    }
  }
  // coil barrel: a glowing core inside a cage of brass rings
  g.add(part(zCyl(0.027, 0.027, 0.3, 16), M.gun, 0, 0.012, -0.32));
  const core = part(zCyl(0.0195, 0.0195, 0.25, 12), M.coreGlow, 0, 0.012, -0.32);
  g.add(core);
  const rings = [];
  for (let i = 0; i < 7; i += 1) {
    const ring = part(new THREE.TorusGeometry(0.031, 0.0055, 8, 22), M.brass, 0, 0.012, -0.2 - i * 0.04);
    g.add(ring);
    rings.push(ring);
  }
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * TAU + 0.5;
    g.add(part(new THREE.BoxGeometry(0.005, 0.005, 0.3), M.brass, Math.cos(a) * 0.031, 0.012 + Math.sin(a) * 0.031, -0.32));
  }
  g.add(part(zCyl(0.024, 0.03, 0.05, 14), M.brass, 0, 0.012, -0.495));
  g.add(part(zCyl(0.016, 0.016, 0.052, 12), M.dark, 0, 0.012, -0.496));
  // furniture
  g.add(part(bevel(0.05, 0.045, 0.2, 0.008), M.wood, 0, -0.035, -0.26));
  g.add(part(bevel(0.045, 0.075, 0.24, 0.01), M.wood, 0, -0.018, 0.27, 0.08));
  g.add(part(bevel(0.05, 0.085, 0.012, 0.003), M.brass, 0, -0.03, 0.392, 0.08));
  g.add(part(bevel(0.038, 0.1, 0.05, 0.008), M.wood, 0, -0.085, 0.085, 0.3));
  g.add(part(new THREE.TorusGeometry(0.026, 0.004, 6, 16, Math.PI), M.brass, 0, -0.045, 0.035, 0, Math.PI / 2, Math.PI));
  g.add(part(new THREE.BoxGeometry(0.006, 0.022, 0.006), M.gold, 0, -0.052, 0.04, 0.3));
  // the cell: a brass-framed amber crystal that empties as you fire
  const mag = new THREE.Group();
  mag.position.set(0, -0.075, -0.055);
  mag.add(part(bevel(0.042, 0.11, 0.07, 0.004), M.brass, 0, -0.02, 0));
  const cell = part(new THREE.BoxGeometry(0.046, 0.07, 0.045), M.cellGlow.clone(), 0, -0.025, 0);
  mag.add(cell);
  g.add(mag);
  // sights: a brass notch and a glowing front bead
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.006, 0.016, 0.01), M.brass, s * 0.009, 0.066, 0.12));
  g.add(part(new THREE.BoxGeometry(0.004, 0.02, 0.006), M.brass, 0, 0.052, -0.46));
  const bead = part(new THREE.SphereGeometry(0.0035, 8, 6), M.sightGlow, 0, 0.064, -0.46);
  g.add(bead);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, -0.53);
  g.add(muzzle);
  return { group: g, mag, cell, core, rings, muzzle, sightY: 0.066, hip: new THREE.Vector3(0.19, -0.2, -0.55), length: 0.53 };
}

function buildLance(M) {
  const g = new THREE.Group();
  g.add(part(bevel(0.06, 0.09, 0.3, 0.006), M.gun, 0, 0, 0.05));
  for (const s of [-1, 1]) g.add(part(bevel(0.004, 0.055, 0.2, 0.0015), M.brass, s * 0.032, 0, 0.06));
  // two rails with the beam's channel between them
  for (const s of [-1, 1]) g.add(part(bevel(0.012, 0.034, 0.66, 0.003), M.gun, s * 0.02, 0.012, -0.42));
  const channel = part(new THREE.BoxGeometry(0.014, 0.012, 0.62), M.lanceGlow.clone(), 0, 0.012, -0.42);
  g.add(channel);
  for (let i = 0; i < 5; i += 1) {
    g.add(part(bevel(0.066, 0.05, 0.022, 0.004), M.brass, 0, 0.012, -0.14 - i * 0.13));
    g.add(part(new THREE.BoxGeometry(0.07, 0.006, 0.006), M.gold, 0, 0.04, -0.14 - i * 0.13));
  }
  // focusing prongs: three brass claws round the muzzle
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * TAU + Math.PI / 2;
    const claw = part(new THREE.BoxGeometry(0.008, 0.008, 0.12), M.brass, Math.cos(a) * 0.036, 0.012 + Math.sin(a) * 0.036, -0.79);
    claw.rotation.set(Math.sin(a) * 0.25, -Math.cos(a) * 0.25, 0);
    g.add(claw);
  }
  // long sight tube with a warm lens
  g.add(part(zCyl(0.022, 0.022, 0.24, 14), M.gun, 0, 0.082, 0.02));
  g.add(part(zCyl(0.027, 0.022, 0.04, 14), M.brass, 0, 0.082, -0.11));
  g.add(part(zCyl(0.025, 0.022, 0.03, 14), M.brass, 0, 0.082, 0.15));
  const lens = part(new THREE.CircleGeometry(0.019, 16), M.sightGlow, 0, 0.082, 0.166);
  g.add(lens);
  for (const z of [-0.04, 0.09]) g.add(part(bevel(0.016, 0.03, 0.02, 0.003), M.brass, 0, 0.056, z));
  g.add(part(bevel(0.046, 0.07, 0.26, 0.01), M.wood, 0, -0.02, 0.33, 0.1));
  g.add(part(bevel(0.05, 0.085, 0.012, 0.003), M.brass, 0, -0.035, 0.46, 0.1));
  g.add(part(bevel(0.038, 0.1, 0.05, 0.008), M.wood, 0, -0.09, 0.13, 0.3));
  g.add(part(bevel(0.05, 0.04, 0.2, 0.008), M.wood, 0, -0.03, -0.2));
  const mag = new THREE.Group();
  mag.position.set(0, -0.07, 0.0);
  mag.add(part(zCyl(0.026, 0.026, 0.1, 12), M.brass, 0, -0.01, 0));
  const cell = part(zCyl(0.018, 0.018, 0.104, 10), M.lanceGlow.clone(), 0, -0.01, 0);
  mag.add(cell);
  g.add(mag);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, -0.86);
  g.add(muzzle);
  return { group: g, mag, cell, core: channel, rings: [], muzzle, sightY: 0.082, hip: new THREE.Vector3(0.2, -0.21, -0.5), length: 0.86, scoped: true };
}

const WARD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WARD_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uPower, uHit;
varying vec2 vUv;
// distance to the nearest hexagon edge
float hex(vec2 p) {
  p.x *= 1.1547;
  p.y += mod(floor(p.x), 2.0) * 0.5;
  p = abs(fract(p) - 0.5);
  return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0);
}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float lattice = 1.0 - smoothstep(0.0, 0.045, hex(q * 6.0 + vec2(0.0, uTime * 0.12)));
  float rim = smoothstep(0.72, 1.0, r);
  float pulse = 0.5 + 0.5 * sin(uTime * 3.0 - r * 9.0);
  float a = (lattice * (0.1 + 0.12 * pulse) + rim * rim * 0.3 + 0.015) * uPower * (1.0 - smoothstep(0.9, 1.0, r));
  vec3 col = mix(vec3(1.0, 0.78, 0.36), vec3(1.0, 0.96, 0.8), rim * 0.5 + uHit);
  gl_FragColor = vec4(col * a * (1.0 + uHit * 2.0), 1.0);
}`;

export function createViewmodel(tex, env, quality, shared) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 1.7;
  const camera = new THREE.PerspectiveCamera(52, 1, 0.01, 6);
  const hemi = new THREE.HemisphereLight(0x9aa8c4, 0x3a2c1e, 1.9);
  const moon = new THREE.DirectionalLight(0xc4d6ff, 2.4);
  const fill = new THREE.PointLight(0xffb060, 0.9, 3, 2);
  fill.position.set(0.25, -0.3, -0.1);
  const flashLight = new THREE.PointLight(0xffc880, 0, 2.5, 2);
  scene.add(hemi, moon, moon.target, fill, flashLight);

  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  const M = {
    gun: pbr(tex.gunmetal, { repeat: 0.25 }),
    brass: pbr(tex.brass, { repeat: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe3c463, roughness: 0.28, metalness: 1 }),
    wood: pbr(tex.wood, { color: 0x7a5a44, repeat: 0.2, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.5, metalness: 0.8 }),
    navy: pbr(tex.cloth, { color: 0x1c2f55, repeat: 0.4 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x241b14, roughness: 0.62, metalness: 0.05 }),
    coreGlow: glow(2.6, 1.3, 0.4),
    cellGlow: glow(3, 1.6, 0.5),
    lanceGlow: glow(3.4, 2.6, 1.2),
    sightGlow: glow(3, 2, 0.8),
    blade: new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.18, metalness: 1 }),
  };
  for (const key of ['gun', 'brass', 'wood', 'navy']) M[key].normalScale = new THREE.Vector2(0.6, 0.6);

  const rig = new THREE.Group(); // everything that sways together
  scene.add(rig);
  const guns = { carbine: buildCarbine(M), lance: buildLance(M) };
  const right = bake(buildHand(M, 1));
  const left = bake(buildHand(M, -1));
  left.scale.setScalar(0.9);
  for (const w of Object.values(guns)) {
    bake(w.mag, [w.cell]);
    bake(w.group, [w.mag, w.core, w.muzzle, ...w.rings]);
  }
  const holder = new THREE.Group();
  rig.add(holder);
  for (const w of Object.values(guns)) {
    w.group.visible = false;
    holder.add(w.group);
  }
  holder.add(right, left);

  // muzzle flash: two crossed cards and a core
  const flash = new THREE.Group();
  const flashMat = new THREE.MeshBasicMaterial({ map: shared.glowTex, color: new THREE.Color(3, 2, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), flashMat);
    card.rotation.set(0, Math.PI / 2, 0);
    card.rotation.z = (i / 3) * Math.PI;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 3) * Math.PI;
    card.rotation.set(0, Math.PI / 2, 0);
    card.position.z = -0.12;
    pivot.add(card);
    flash.add(pivot);
  }
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), flashMat);
  flash.add(star);
  flash.visible = false;
  holder.add(flash);

  // the Shield Ward: a lattice disc on the left hand
  const wardMat = new THREE.ShaderMaterial({ vertexShader: WARD_VERT, fragmentShader: WARD_FRAG, uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uHit: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ward = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), wardMat);
  ward.position.set(-0.12, -0.03, -0.8);
  ward.visible = false;
  scene.add(ward);

  // the blade, for when they get close
  const blade = new THREE.Group();
  blade.add(part(bevel(0.006, 0.04, 0.62, 0.002), M.blade, 0, 0, -0.36));
  blade.add(part(new THREE.BoxGeometry(0.003, 0.004, 0.6), M.sightGlow, 0, 0.021, -0.36));
  blade.add(part(bevel(0.11, 0.014, 0.018, 0.004), M.gold, 0, 0, -0.04));
  blade.add(part(zCyl(0.014, 0.012, 0.11, 10), M.glove, 0, 0, 0.02));
  blade.add(part(new THREE.SphereGeometry(0.018, 10, 8), M.gold, 0, 0, 0.085));
  blade.visible = false;
  scene.add(blade);

  const S = { current: 'carbine', raise: 0, kickZ: 0, kickR: 0, kickY: 0, swayX: 0, swayY: 0, bobT: 0, flashT: 0, melee: -1, wardHit: 0, lastYaw: null, lastPitch: 0, sprint: 0, reloadK: 0, land: 0 };
  const V = new THREE.Vector3();
  const moonView = new THREE.Vector3();
  const qInv = new THREE.Quaternion();
  const envRot = new THREE.Euler();

  function update(state, events, time, dt, view, worldCamera) {
    const p = state.player;
    const gun = guns[S.current];
    const w = WEAPONS[S.current];
    // light the weapon like the world around it: the moon from where the moon really is
    qInv.copy(worldCamera.quaternion).invert();
    moonView.copy(MOON_DIR).applyQuaternion(qInv);
    moon.position.copy(moonView).multiplyScalar(3);
    moon.target.position.set(0, 0, -0.4);
    envRot.setFromQuaternion(qInv);
    scene.environmentRotation.copy(envRot);

    for (const ev of events) {
      if (ev.type === 'shot') {
        const heavy = ev.weapon === 'lance';
        S.kickZ += heavy ? 0.085 : 0.028;
        S.kickR += heavy ? 0.16 : 0.035;
        S.kickY += heavy ? 0.02 : 0.006;
        S.flashT = heavy ? 0.09 : 0.05;
        flash.rotation.z = Math.random() * TAU;
        flash.scale.setScalar((heavy ? 1.8 : 1) * (0.8 + Math.random() * 0.5));
      } else if (ev.type === 'melee') S.melee = 0;
      else if (ev.type === 'ward_block') S.wardHit = 1;
      else if (ev.type === 'land') S.land = ev.hard ? 0.05 : 0.025;
      else if (ev.type === 'respawn') S.raise = 0;
    }

    // which gun, and how far up it is
    if (S.current !== p.weapon) {
      S.raise = damp(S.raise, 0, 16, dt);
      if (S.raise < 0.06) {
        S.current = p.weapon;
        S.raise = 0;
      }
    } else {
      S.raise = damp(S.raise, p.swap ? 0 : 1, p.swap ? 16 : 9, dt);
    }
    for (const [id, g] of Object.entries(guns)) g.group.visible = id === S.current;

    const yawRate = S.lastYaw == null ? 0 : (() => {
      let d = p.yaw - S.lastYaw;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d / Math.max(dt, 1e-3);
    })();
    const pitchRate = (p.pitch - S.lastPitch) / Math.max(dt, 1e-3);
    S.lastYaw = p.yaw;
    S.lastPitch = p.pitch;
    S.swayX = damp(S.swayX, THREE.MathUtils.clamp(yawRate * 0.012, -0.05, 0.05), 9, dt);
    S.swayY = damp(S.swayY, THREE.MathUtils.clamp(pitchRate * 0.012, -0.04, 0.04), 9, dt);
    const speed = Math.hypot(p.vx, p.vz);
    if (p.grounded) S.bobT += dt * (p.sprinting ? 13.5 : 9.5) * Math.min(1, speed / 4);
    const bobK = Math.min(1, speed / 4.6) * (p.grounded ? 1 : 0.2) * (1 - p.ads * 0.85);
    S.sprint = damp(S.sprint, p.sprinting ? 1 : 0, 9, dt);
    S.kickZ = damp(S.kickZ, 0, 14, dt);
    S.kickR = damp(S.kickR, 0, 12, dt);
    S.kickY = damp(S.kickY, 0, 10, dt);
    S.land = damp(S.land, 0, 9, dt);

    // reload: dip, cell out, cell in, back up
    const rl = p.reload ? p.reload.t / p.reload.total : 0;
    const dip = rl > 0 ? ease(Math.min(1, rl / 0.18)) * (1 - ease(Math.max(0, (rl - 0.82) / 0.18))) : 0;
    S.reloadK = damp(S.reloadK, dip, 18, dt);
    const magOut = rl > 0.2 && rl < 0.72 ? Math.sin(((rl - 0.2) / 0.52) * Math.PI) : 0;
    gun.mag.position.y = (S.current === 'carbine' ? -0.075 : -0.07) - magOut * 0.16;
    gun.mag.rotation.x = magOut * 0.5;

    const ads = p.ads;
    const hip = gun.hip;
    const down = (1 - S.raise) * 0.34 + S.sprint * 0.06 + (p.warding ? 0.07 : 0) + S.reloadK * 0.09 + S.land;
    holder.position.set(
      lerp(hip.x, 0, ads) + S.swayX * (1 - ads * 0.7) + Math.cos(S.bobT * 0.5) * 0.009 * bobK + S.sprint * -0.05,
      lerp(hip.y, -gun.sightY - 0.004, ads) - down + S.swayY * (1 - ads * 0.7) + Math.abs(Math.sin(S.bobT * 0.5)) * 0.008 * bobK + S.kickY + Math.sin(time * 1.3) * 0.0015,
      lerp(hip.z, gun.scoped ? -0.44 : -0.5, ads) + S.kickZ,
    );
    holder.rotation.set(
      S.kickR * (1 - ads * 0.5) - (1 - S.raise) * 0.7 + S.reloadK * 0.5 - S.sprint * 0.25 - S.swayY * 0.8,
      S.sprint * 0.75 + S.swayX * -1.2 + S.reloadK * 0.35 + (1 - ads) * 0.07,
      S.sprint * 0.25 + S.swayX * -0.9 - S.reloadK * 0.5 + (p.warding ? 0.25 : 0),
    );

    // hands follow the gun: the right on the grip, the left cradling the fore-end from below
    right.position.set(0.03, -0.085, 0.105);
    right.rotation.set(0.3, -0.12, -Math.PI / 2 + 0.25);
    const reach = S.current === 'carbine' ? -0.25 : -0.2;
    left.position.set(-0.012 - magOut * 0.03, -0.088 - magOut * 0.15, reach + magOut * 0.22);
    left.rotation.set(0.5, -0.55, Math.PI * 0.94);
    left.visible = !p.warding && S.melee < 0;

    // glow follows ammunition and heat
    const ammo = p.ammo[S.current];
    const frac = ammo.mag / w.mag;
    gun.cell.material.color.setRGB(0.25 + 2.9 * frac, 0.12 + 1.5 * frac, 0.05 + 0.5 * frac);
    const heat = Math.min(1, (state.t - p.lastShotT < 400 ? 1 - (state.t - p.lastShotT) / 400 : 0) + p.bloom * 20);
    gun.core.material.color.setRGB(2.2 + heat * 4, 1.1 + heat * 1.6, 0.35 + heat * 0.5);
    for (let i = 0; i < gun.rings.length; i += 1) gun.rings[i].rotation.z = time * (1.5 + heat * 14) * (i % 2 ? 1 : -1);

    // muzzle flash
    S.flashT -= dt;
    flash.visible = S.flashT > 0;
    flash.position.copy(gun.muzzle.position);
    flashLight.intensity = S.flashT > 0 ? 14 : 0;
    gun.group.getWorldPosition(V);
    flashLight.position.copy(holder.position).add(V.set(0, 0.02, -gun.length));

    // ward
    S.wardHit = damp(S.wardHit, 0, 7, dt);
    wardMat.uniforms.uTime.value = time;
    wardMat.uniforms.uPower.value = damp(wardMat.uniforms.uPower.value, p.warding ? 0.55 + 0.45 * (p.ward / 100) : 0, 12, dt);
    wardMat.uniforms.uHit.value = S.wardHit;
    ward.visible = wardMat.uniforms.uPower.value > 0.01;
    ward.scale.setScalar(1 + S.wardHit * 0.08);

    // blade: one fast cut across the view
    if (S.melee >= 0) {
      S.melee += dt / 0.34;
      const t = Math.min(1, S.melee);
      const k = ease(t);
      blade.visible = true;
      blade.position.set(lerp(0.42, -0.3, k), lerp(0.05, -0.2, k), lerp(-0.3, -0.48, Math.sin(t * Math.PI)));
      blade.rotation.set(lerp(0.9, -0.3, k), lerp(-0.9, 1.0, k), lerp(0.4, -1.2, k));
      if (S.melee >= 1) {
        S.melee = -1;
        blade.visible = false;
      }
    }
    rig.visible = view.showWeapon !== false;
  }

  return {
    scene,
    camera,
    update,
    resize(aspect) {
      camera.aspect = aspect;
      // keep the gun the same size on a tall phone as on a wide monitor
      camera.fov = aspect < 1 ? 70 : 52;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    },
  };
}
