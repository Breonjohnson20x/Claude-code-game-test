// The people and the machine of the Greywater Front, built from primitives and posed every
// frame from the simulation's state: riflemen that crouch behind cover and stand to aim,
// shock-troopers that wind up a blade, heavies with a glowing pack, and the walker "Patience"
// with two inverse-kinematic legs, a searchlight and a gun.

import * as THREE from 'three';
import { ENEMY, walkerHullY } from '../../../game/fps/combat.js';
import { groundY } from '../../../game/fps/level.js';
import { pbr } from './textures.js';
import { bake } from './merge.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function limb(mat, radius, length) {
  const g = new THREE.CapsuleGeometry(radius, length - radius * 2, 3, 8);
  g.translate(0, -length / 2, 0);
  return new THREE.Mesh(g, mat);
}

// ───────────────────────────────────────────────────────────── soldiers

function buildSoldier(type, M) {
  const heavy = type === 'heavy';
  const trooper = type === 'trooper';
  const pilot = type === 'pilot';
  const k = heavy ? 1.14 : 1;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95 * k;
  root.add(hips);
  const cloth = pilot ? M.clothPilot : M.cloth;

  hips.add(mesh(new THREE.BoxGeometry(0.36 * k, 0.2, 0.24 * k), M.leather, 0, 0, 0));
  const torso = new THREE.Group();
  hips.add(torso);
  const chestGeo = new THREE.CapsuleGeometry(0.2 * k, 0.3 * k, 3, 10);
  chestGeo.scale(1.05, 1, 0.74);
  torso.add(mesh(chestGeo, cloth, 0, 0.36 * k, 0));
  if (!pilot) {
    // breastplate and back plate
    const plate = new THREE.SphereGeometry(0.24 * k, 10, 8, 0, TAU, 0.2, 1.5);
    plate.scale(1, 1.15, 0.62);
    torso.add(mesh(plate, M.armor, 0, 0.34 * k, -0.06 * k));
    const back = plate.clone();
    torso.add(mesh(back, M.armor, 0, 0.34 * k, 0.07 * k));
    torso.add(mesh(new THREE.BoxGeometry(0.42 * k, 0.07, 0.3 * k), M.leather, 0, 0.08, 0));
    for (const s of [-1, 1]) {
      const p = new THREE.SphereGeometry((heavy || trooper ? 0.15 : 0.12) * k, 8, 6, 0, TAU, 0, 1.7);
      p.scale(1.1, 0.8, 1.1);
      torso.add(mesh(p, M.armor, s * 0.27 * k, 0.6 * k, 0));
    }
  }
  if (trooper) torso.add(mesh(new THREE.BoxGeometry(0.44, 0.09, 0.3), M.sash, 0, 0.2, 0));
  let pack = null;
  if (heavy) {
    torso.add(mesh(new THREE.BoxGeometry(0.46, 0.56, 0.3), M.armor, 0, 0.42, 0.3));
    pack = mesh(new THREE.BoxGeometry(0.3, 0.36, 0.06), M.packGlow, 0, 0.42, 0.46);
    pack.castShadow = false;
    torso.add(pack);
    for (const s of [-1, 1]) torso.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), M.dark, s * 0.17, 0.74, 0.32));
  }

  const head = new THREE.Group();
  head.position.y = 0.72 * k;
  torso.add(head);
  if (pilot) {
    head.add(mesh(new THREE.SphereGeometry(0.105, 10, 8), M.skin, 0, 0.06, 0));
    const cap = new THREE.SphereGeometry(0.115, 10, 6, 0, TAU, 0, 1.5);
    head.add(mesh(cap, M.leather, 0, 0.075, 0.005));
    head.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), M.dark, 0, 0.1, -0.1)); // goggles pushed up
  } else {
    head.add(mesh(new THREE.SphereGeometry(0.115 * k, 10, 8), M.dark, 0, 0.06, 0));
    const helm = new THREE.SphereGeometry(0.14 * k, 12, 8, 0, TAU, 0, 1.75);
    helm.scale(1, 1.02, 1.12);
    head.add(mesh(helm, M.armor, 0, 0.075, 0.005));
    const brim = new THREE.CylinderGeometry(0.17 * k, 0.185 * k, 0.025, 12);
    head.add(mesh(brim, M.armor, 0, 0.045, -0.015));
    const visor = mesh(new THREE.BoxGeometry(0.17 * k, 0.028, 0.02), M.visor, 0, 0.065, -0.132 * k);
    visor.castShadow = false;
    head.add(visor);
    head.add(mesh(new THREE.BoxGeometry(0.1 * k, 0.09, 0.07), M.armor, 0, 0.0, -0.1 * k)); // breather
    if (trooper) head.add(mesh(new THREE.BoxGeometry(0.025, 0.1, 0.24), M.sash, 0, 0.2, 0.01));
  }
  torso.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), cloth, 0, 0.68 * k, 0));

  const arm = (s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.26 * k, 0.6 * k, 0);
    torso.add(sh);
    const up = limb(cloth, 0.065 * k, 0.32 * k);
    up.castShadow = true;
    sh.add(up);
    const el = new THREE.Group();
    el.position.y = -0.3 * k;
    sh.add(el);
    const fore = limb(pilot ? cloth : M.armor, 0.058 * k, 0.3 * k);
    fore.castShadow = true;
    el.add(fore);
    el.add(mesh(new THREE.BoxGeometry(0.08 * k, 0.1, 0.09 * k), M.leather, 0, -0.33 * k, 0));
    return { sh, el };
  };
  const armL = arm(-1);
  const armR = arm(1);

  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.11 * k, -0.04, 0);
    hips.add(hip);
    const thigh = limb(cloth, 0.085 * k, 0.48 * k);
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46 * k;
    hip.add(knee);
    const shin = limb(pilot ? M.leather : M.armor, 0.072 * k, 0.47 * k);
    shin.castShadow = true;
    knee.add(shin);
    knee.add(mesh(new THREE.BoxGeometry(0.11 * k, 0.09, 0.26 * k), M.leather, 0, -0.46 * k, -0.05));
    if (!pilot) knee.add(mesh(new THREE.SphereGeometry(0.075 * k, 8, 6), M.armor, 0, 0, -0.03));
    return { hip, knee };
  };
  const legL = leg(-1);
  const legR = leg(1);

  // weapon: carried on the torso so the aim stays steady while the arms follow it
  const weapon = new THREE.Group();
  weapon.position.set(0.1 * k, 0.5 * k, -0.2);
  torso.add(weapon);
  let muzzle = null;
  if (type === 'rifleman') {
    weapon.add(mesh(new THREE.BoxGeometry(0.05, 0.09, 0.52), M.gun, 0, 0, -0.08));
    const barrel = new THREE.CylinderGeometry(0.016, 0.018, 0.5, 6);
    barrel.rotateX(Math.PI / 2);
    weapon.add(mesh(barrel, M.gun, 0, 0.015, -0.56));
    weapon.add(mesh(new THREE.BoxGeometry(0.045, 0.12, 0.26), M.wood, 0, -0.03, 0.26));
    weapon.add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), M.gun, 0, -0.11, -0.02));
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.015, -0.82);
    weapon.add(muzzle);
  } else if (heavy) {
    weapon.position.set(0.16, 0.36, -0.2);
    weapon.add(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.7), M.gun, 0, 0, 0));
    for (let i = 0; i < 3; i += 1) {
      const b = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
      b.rotateX(Math.PI / 2);
      const a = (i / 3) * TAU;
      weapon.add(mesh(b, M.gun, Math.cos(a) * 0.045, Math.sin(a) * 0.045 + 0.01, -0.68));
    }
    const drum = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12);
    drum.rotateZ(Math.PI / 2);
    weapon.add(mesh(drum, M.armor, -0.14, -0.02, 0.05));
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -1.05);
    weapon.add(muzzle);
  } else if (trooper) {
    // shock-blade in the right hand
    weapon.removeFromParent();
    armR.el.add(weapon);
    weapon.position.set(0, -0.34, 0);
    weapon.add(mesh(new THREE.BoxGeometry(0.035, 0.2, 0.035), M.leather, 0, 0, 0));
    weapon.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.05), M.brass, 0, -0.1, 0));
    const blade = mesh(new THREE.BoxGeometry(0.012, 0.86, 0.06), M.gun, 0, -0.55, 0);
    weapon.add(blade);
    const edge = mesh(new THREE.BoxGeometry(0.016, 0.84, 0.012), M.bladeGlow, 0, -0.55, -0.034);
    edge.castShadow = false;
    weapon.add(edge);
  }
  // one mesh per material per bone
  bake(head);
  bake(weapon, muzzle ? [muzzle] : []);
  for (const a of [armL, armR]) {
    bake(a.el, [weapon]);
    bake(a.sh, [a.el]);
  }
  for (const l of [legL, legR]) {
    bake(l.knee);
    bake(l.hip, [l.knee]);
  }
  bake(torso, [head, armL.sh, armR.sh, weapon, ...(pack ? [pack] : [])]);
  bake(hips, [torso, legL.hip, legR.hip]);
  return { type, root, hips, torso, head, armL, armR, legL, legR, weapon, muzzle, pack, k, phase: Math.random() * TAU, crouch: 0, aim: 0, kick: 0, fall: 0, move: 0, hands: 0, seen: false };
}

function poseSoldier(r, e, state, time, dt) {
  const p = state.player;
  const def = ENEMY[e.type] ?? ENEMY.rifleman;
  const k = r.k;
  const dead = e.hp <= 0;
  const giveUp = dead && e.surrendered;
  r.root.position.set(e.x, e.y, e.z);
  r.root.rotation.y = e.yaw;

  const moving = dead ? 0 : Math.min(1, (e.speed ?? 0) / def.speed);
  r.move = damp(r.move, moving, 10, dt);
  r.phase += (e.speed ?? 0) * dt * (e.type === 'heavy' ? 2.6 : 2.3);
  r.crouch = damp(r.crouch, (e.crouch && !dead) || giveUp ? 1 : 0, 9, dt);
  const aiming = !dead && (e.state === 'aim' || e.state === 'burst' || e.state === 'spinup' || e.state === 'fire');
  r.aim = damp(r.aim, aiming ? 1 : 0, 12, dt);
  r.kick = damp(r.kick, 0, 16, dt);
  r.hands = damp(r.hands, giveUp || r.type === 'pilot' ? 1 : 0, 6, dt);
  const stag = !dead && e.state === 'stagger' ? 1 : 0;
  const hit = !dead && state.t - e.hitT < 160 ? 1 - (state.t - e.hitT) / 160 : 0;

  const s = Math.sin(r.phase);
  const c = Math.cos(r.phase);
  const cr = r.crouch;
  r.hips.position.y = (0.95 - cr * 0.4) * k + Math.abs(c) * 0.035 * r.move;
  // legs: a walk cycle that folds into a crouch
  const stride = 0.75 * r.move;
  r.legL.hip.rotation.x = s * stride + cr * 1.15;
  r.legR.hip.rotation.x = -s * stride + cr * 0.35;
  r.legL.knee.rotation.x = -(Math.max(0, -c) * 1.1 * r.move + cr * 1.75);
  r.legR.knee.rotation.x = -(Math.max(0, c) * 1.1 * r.move + cr * 1.75);

  // look up or down at the player while aiming
  const dist = Math.hypot(p.x - e.x, p.z - e.z) || 1;
  const pitch = Math.atan2(p.y + 1.1 - (e.y + def.h * 0.74), dist);
  r.torso.rotation.x = -(0.06 + r.move * 0.14 + cr * 0.22) + r.aim * pitch * 0.9 + stag * 0.4 + hit * 0.22 + r.kick * 0.05;
  r.torso.rotation.y = r.aim * -0.35 + stag * Math.sin(time * 9) * 0.25;
  r.torso.rotation.z = stag * Math.sin(time * 7) * 0.12;
  r.head.rotation.y = r.aim * 0.3;
  r.head.rotation.x = stag * -0.3 + hit * -0.2;

  if (r.type === 'trooper') {
    const wind = e.state === 'windup' ? Math.min(1, e.stT / 0.4) : 0;
    const strike = e.state === 'recover' ? Math.max(0, 1 - e.stT / 0.16) : 0;
    const swing = e.state === 'recover' ? Math.min(1, e.stT / 0.14) : 0;
    r.armR.sh.rotation.x = lerp(lerp(-s * 0.7 * r.move + 0.2, 2.9, wind), 0.5, swing) + stag * -0.6;
    r.armR.sh.rotation.z = lerp(-0.15, -0.5, wind) - stag * 0.7;
    r.armR.el.rotation.x = lerp(0.5, 1.1, wind) * (1 - swing * 0.8);
    r.weapon.rotation.x = lerp(0.9, -0.5, wind) + swing * 1.5 + strike * 0.2;
    r.armL.sh.rotation.x = s * 0.7 * r.move + 0.3 + wind * 0.6;
    r.armL.sh.rotation.z = 0.2 + stag * 0.7;
    r.armL.el.rotation.x = 0.7;
    r.torso.rotation.y += wind * 0.5 - swing * 0.7;
  } else if (r.hands > 0.02) {
    // hands behind the head: it is over
    const h = r.hands;
    r.armL.sh.rotation.set(lerp(0.2, 2.6, h), 0, lerp(0.15, -0.5, h));
    r.armR.sh.rotation.set(lerp(0.2, 2.6, h), 0, lerp(-0.15, 0.5, h));
    r.armL.el.rotation.x = lerp(0.3, 1.9, h);
    r.armR.el.rotation.x = lerp(0.3, 1.9, h);
    if (r.weapon) r.weapon.visible = r.type === 'pilot' ? false : h < 0.3;
  } else {
    // long gun: shouldered when aiming, low ready otherwise
    const a = r.aim;
    r.weapon.rotation.x = lerp(-0.62, 0, a) + r.kick * 0.08;
    r.weapon.rotation.y = lerp(0.7, 0.33, a);
    r.weapon.position.z = lerp(-0.16, -0.24, a) + r.kick * 0.05;
    r.weapon.position.y = lerp(0.34, 0.52, a) * k;
    r.armR.sh.rotation.set(lerp(0.55, 1.15, a), 0, lerp(-0.12, -0.3, a) - stag * 0.6);
    r.armR.el.rotation.x = lerp(1.0, 0.7, a);
    r.armL.sh.rotation.set(lerp(0.75, 1.45, a), 0, lerp(0.55, 0.62, a) + stag * 0.6);
    r.armL.el.rotation.x = lerp(0.8, 0.35, a);
  }

  // falling: backwards, then still
  if (dead && !giveUp) {
    r.fall = Math.min(1, r.fall + dt * 2.6);
    const f = r.fall * r.fall * (3 - 2 * r.fall);
    r.root.rotation.x = f * 1.5;
    r.root.position.y = e.y + f * 0.16;
    r.legL.hip.rotation.x = lerp(r.legL.hip.rotation.x, 0.25, f);
    r.legR.hip.rotation.x = lerp(r.legR.hip.rotation.x, -0.1, f);
    r.legL.knee.rotation.x = lerp(r.legL.knee.rotation.x, -0.5, f);
    r.legR.knee.rotation.x = lerp(r.legR.knee.rotation.x, -0.15, f);
    r.armL.sh.rotation.z = lerp(r.armL.sh.rotation.z, 1.2, f);
    r.armR.sh.rotation.z = lerp(r.armR.sh.rotation.z, -1.1, f);
    r.torso.rotation.set(0, 0, 0);
  } else {
    r.fall = 0;
    r.root.rotation.x = 0;
  }
  if (r.pack) r.pack.material = e.state === 'fire' || e.state === 'spinup' ? r.packHot : r.packCool;
}

// ───────────────────────────────────────────────────────────── the walker

const CONE_VERT = /* glsl */ `
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uPower;
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float along = 1.0 - vAlong;
  float a = rim * rim * along * along * along * uPower;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

function buildWalker(M, scene) {
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);
  const box = (w, h, d, x, y, z, mat = M.walker, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * Math.max(w, d) * 0.5, uv.getY(i) * Math.max(h, 0.5) * 0.5);
    const m = mesh(g, mat, x, y, z);
    m.rotation.set(rx, ry, rz);
    hull.add(m);
    return m;
  };
  // body: a riveted iron box with a sloped prow and a stepped back
  box(3.5, 2.3, 4.2, 0, 0, 0);
  box(3.1, 1.2, 1.3, 0, 0.2, -2.55, M.walker, -0.5);
  box(3.7, 0.5, 4.5, 0, -1.25, 0, M.walkerDark);
  box(2.6, 0.8, 2.4, 0, 1.5, 0.4);
  box(1.3, 0.16, 1.3, 0, 1.98, 0.4, M.walkerDark); // hatch
  for (const s of [-1, 1]) {
    box(0.5, 1.6, 3.4, s * 1.95, 0, 0.1, M.walkerDark);
    box(0.34, 0.34, 2.6, s * 1.2, 1.2, 1.4, M.walkerDark);
    const stack = new THREE.CylinderGeometry(0.2, 0.24, 1.9, 10);
    hull.add(mesh(stack, M.walkerDark, s * 1.1, 2.3, 1.7));
    hull.add(mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.2, 10), M.dark, s * 1.1, 3.3, 1.7));
  }
  // vision slit and the unit's painted gear
  const slit = box(1.9, 0.14, 0.05, 0, 0.62, -2.98, M.slit, -0.5);
  slit.castShadow = false;
  box(0.06, 0.9, 0.9, 1.78, 0.3, -0.4, M.sash);
  // gun on the right shoulder
  const gun = new THREE.Group();
  gun.position.set(1.95, 0.25, -1.4);
  hull.add(gun);
  const barrel = new THREE.CylinderGeometry(0.2, 0.26, 3.2, 12);
  barrel.rotateX(Math.PI / 2);
  gun.add(mesh(barrel, M.gun, 0.4, 0, -1.4));
  gun.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 1.6), M.walkerDark, 0.4, 0, 0.3));
  const brake = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12);
  brake.rotateX(Math.PI / 2);
  gun.add(mesh(brake, M.dark, 0.4, 0, -2.9));
  const muzzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glowTex, color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  muzzleGlow.position.set(0.4, 0, -3.2);
  muzzleGlow.scale.setScalar(3);
  gun.add(muzzleGlow);

  // the lamp: housing, lens, light, and a cone of lit dust
  const lamp = new THREE.Group();
  lamp.position.set(0, -0.2, -2.35);
  hull.add(lamp);
  const housing = new THREE.CylinderGeometry(0.62, 0.5, 0.7, 14);
  housing.rotateX(Math.PI / 2);
  lamp.add(mesh(housing, M.walkerDark, 0, 0, -0.3));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), M.lens);
  lens.position.z = -0.67;
  lens.rotation.y = Math.PI;
  lamp.add(lens);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glowTex, color: 0xfff0d0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  flare.scale.setScalar(4.5);
  flare.position.z = -0.75;
  lamp.add(flare);
  const coneGeo = new THREE.CylinderGeometry(0.4, 5.2, 60, 28, 1, true);
  coneGeo.translate(0, -30, 0);
  coneGeo.rotateX(Math.PI / 2);
  const coneMat = new THREE.ShaderMaterial({ vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, uniforms: { uColor: { value: new THREE.Color(1, 0.9, 0.7) }, uPower: { value: 0.16 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.z = -0.7;
  cone.frustumCulled = false;
  lamp.add(cone);
  const spot = new THREE.SpotLight(0xffe2b0, 2600, 120, 0.13, 0.5, 1.6);
  spot.castShadow = false;
  scene.add(spot);
  scene.add(spot.target);

  // legs live in world space: hip pinned to the hull, foot planted on the ground
  const legs = [-1, 1].map((side) => {
    const thigh = new THREE.Group();
    const shin = new THREE.Group();
    const tGeo = new THREE.BoxGeometry(1.0, 3.4, 1.3);
    tGeo.translate(0, -1.7, 0);
    thigh.add(mesh(tGeo, M.walker));
    const piston = new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8);
    piston.translate(0, -1.4, 0.55);
    thigh.add(mesh(piston, M.brass));
    const sGeo = new THREE.BoxGeometry(0.8, 3.6, 0.95);
    sGeo.translate(0, -1.8, 0);
    shin.add(mesh(sGeo, M.walkerDark));
    const knee = mesh(new THREE.CylinderGeometry(0.78, 0.78, 1.15, 14), M.walkerDark);
    knee.rotation.z = Math.PI / 2;
    shin.add(knee);
    const kneeGlow = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.22, 10), M.kneeGlow.clone());
    kneeGlow.rotation.z = Math.PI / 2;
    kneeGlow.castShadow = false;
    shin.add(kneeGlow);
    const foot = mesh(new THREE.BoxGeometry(1.5, 0.45, 2.3), M.walkerDark);
    for (const tz of [-1, 1]) foot.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), M.walker, tz * 0.45, 0, -1.3));
    bake(thigh);
    bake(shin, [kneeGlow]);
    scene.add(thigh, shin, foot);
    return { side, thigh, shin, foot, kneeGlow, planted: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, init: false };
  });
  bake(gun, [muzzleGlow]);
  bake(hull, [gun, lamp]);
  scene.add(root);
  return { root, hull, lamp, lens, flare, cone, coneMat, spot, gun, muzzleGlow, legs, hullY: 6.2, tilt: 0, lampOn: 1, lastStep: 0 };
}

const H = new THREE.Vector3();
const F = new THREE.Vector3();
const K = new THREE.Vector3();
const D = new THREE.Vector3();
const BEND = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const QQ = new THREE.Quaternion();
const L1 = 3.4;
const L2 = 3.6;

function poseWalker(w, e, state, events, time, dt) {
  const down = e.hp <= 0;
  const fx = -Math.sin(e.yaw);
  const fz = -Math.cos(e.yaw);
  const rx = Math.cos(e.yaw);
  const rz = -Math.sin(e.yaw);
  const targetHull = down ? 2.7 : walkerHullY(e);
  w.hullY = damp(w.hullY, targetHull, down ? 1.6 : 4, dt);
  w.tilt = damp(w.tilt, down ? 1 : 0, 1.4, dt);
  const stompWind = e.state === 'stomp_wind' ? Math.min(1, e.stT / 0.9) : 0;
  const sway = down ? 0 : Math.sin(time * 1.3) * 0.04 + (e.speed > 0.2 ? Math.sin(time * 3.4) * 0.1 : 0);
  w.root.position.set(e.x, e.y, e.z);
  w.root.rotation.y = e.yaw;
  w.hull.position.y = w.hullY + sway;
  w.hull.rotation.z = w.tilt * 0.22;
  w.hull.rotation.x = w.tilt * 0.12 + (e.mode === 'kneel' ? 0.1 : 0);

  // lamp: follows lampYaw; goes red-gold while the lance charges; dies with the machine
  const lampRel = (e.lampYaw ?? e.yaw) - e.yaw;
  w.lamp.rotation.y = lampRel;
  w.lamp.rotation.x = -0.1;
  const charging = e.state === 'lance_wind' ? Math.min(1, e.stT / 1.3) : e.state === 'lance' ? 1 : 0;
  w.lampOn = damp(w.lampOn, down || e.mode === 'kneel' ? 0 : 1, 3, dt);
  const flick = e.mode === 'kneel' ? (Math.sin(time * 40) > 0.3 ? 0.5 : 0) : 0;
  const on = Math.max(w.lampOn, flick);
  w.lens.material.color.setRGB(lerp(3.2, 6, charging) * on + 0.02, lerp(2.8, 1.8, charging) * on + 0.02, lerp(2, 0.4, charging) * on + 0.02);
  w.flare.material.opacity = 0.6 * on;
  w.flare.material.color.setRGB(1, lerp(0.94, 0.5, charging), lerp(0.8, 0.2, charging));
  w.flare.scale.setScalar(lerp(2.2, 5, charging));
  w.coneMat.uniforms.uPower.value = 0.15 * on * (e.state === 'lance' ? 0 : 1);
  w.coneMat.uniforms.uColor.value.setRGB(1, lerp(0.9, 0.55, charging), lerp(0.7, 0.25, charging));
  const ly = e.lampYaw ?? e.yaw;
  const lx = e.x - Math.sin(ly) * 2.4;
  const lz = e.z - Math.cos(ly) * 2.4;
  w.spot.position.set(lx, e.y + w.hullY - 0.2, lz);
  w.spot.target.position.set(lx - Math.sin(ly) * 40, e.y + w.hullY - 0.2 - 4.2, lz - Math.cos(ly) * 40);
  w.spot.intensity = 2600 * on * (e.state === 'lance' ? 0.2 : 1);
  w.spot.color.setRGB(1, lerp(0.88, 0.55, charging), lerp(0.69, 0.25, charging));

  const aimWind = e.state === 'salvo_wind' ? Math.min(1, e.stT / 0.85) : 0;
  w.muzzleGlow.material.opacity = aimWind * 0.9;
  w.muzzleGlow.scale.setScalar(1 + aimWind * 3);
  for (const ev of events) if (ev.type === 'walker_fire') w.gun.position.z = -1.0;
  w.gun.position.z = damp(w.gun.position.z, -1.4, 6, dt);

  // legs
  for (const leg of w.legs) {
    const i = leg.side < 0 ? 0 : 1;
    const want = F.set(e.x + rx * leg.side * 2.35 + fx * (0.4 + (e.speed > 0.2 ? 1.4 : 0)), 0, e.z + rz * leg.side * 2.35 + fz * (0.4 + (e.speed > 0.2 ? 1.4 : 0)));
    want.y = groundY(want.x, want.z);
    if (!leg.init) {
      leg.planted.copy(want);
      leg.init = true;
    }
    const other = w.legs[1 - i];
    const drift = Math.hypot(leg.planted.x - want.x, leg.planted.z - want.z);
    if (leg.t >= 1 && other.t >= 1 && drift > (down || e.mode === 'kneel' ? 99 : 1.9) && time - w.lastStep > 0.12) {
      leg.from.copy(leg.planted);
      leg.to.copy(want).addScaledVector(D.set(want.x - leg.planted.x, 0, want.z - leg.planted.z).normalize(), 0.9);
      leg.to.y = groundY(leg.to.x, leg.to.z);
      leg.t = 0;
      w.lastStep = time;
    }
    let lift = 0;
    if (leg.t < 1) {
      leg.t = Math.min(1, leg.t + dt / 0.5);
      const k = leg.t * leg.t * (3 - 2 * leg.t);
      leg.planted.lerpVectors(leg.from, leg.to, k);
      lift = Math.sin(leg.t * Math.PI) * 1.3;
      if (leg.t >= 1) w.stepped = { x: leg.to.x, y: leg.to.y, z: leg.to.z };
    }
    if (stompWind > 0 && i === 0) lift = Math.sin(Math.min(1, stompWind * 1.15) * Math.PI * 0.5) * 2.6 * (stompWind < 0.93 ? 1 : 0);
    F.copy(leg.planted);
    F.y += lift + 0.22;
    H.set(e.x + rx * leg.side * 2.05 + fx * -0.2, e.y + w.hullY - 0.9, e.z + rz * leg.side * 2.05 + fz * -0.2);
    D.subVectors(F, H);
    let d = D.length();
    d = Math.min(d, L1 + L2 - 0.02);
    D.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0.0001, L1 * L1 - a * a));
    // knees break backwards, like a bird's
    BEND.set(-fx, 0.35, -fz).addScaledVector(D, -BEND.dot(D)).normalize();
    K.copy(H).addScaledVector(D, a).addScaledVector(BEND, h);
    leg.thigh.position.copy(H);
    leg.thigh.quaternion.setFromUnitVectors(DOWN, D.subVectors(K, H).normalize());
    QQ.setFromAxisAngle(DOWN, -e.yaw);
    leg.thigh.quaternion.multiply(QQ);
    leg.shin.position.copy(K);
    leg.shin.quaternion.setFromUnitVectors(DOWN, D.subVectors(F, K).normalize());
    leg.shin.quaternion.multiply(QQ);
    leg.foot.position.copy(F);
    leg.foot.rotation.set(0, e.yaw, 0);
    const broken = e.legs[i] <= 0 && !down;
    const frac = e.legs[i] / e.legMax;
    const g = leg.kneeGlow.material.color;
    if (down) g.setRGB(0.02, 0.02, 0.02);
    else if (broken) g.setRGB(Math.sin(time * 18) > 0 ? 6 : 0.4, 0.2, 0.05);
    else g.setRGB(lerp(4, 2.2, frac), lerp(0.5, 1.5, frac), lerp(0.1, 0.6, frac));
  }
}

// ───────────────────────────────────────────────────────────── entry

export function createActors(scene, level, tex, quality, shared) {
  const M = {
    cloth: pbr(tex.cloth, { color: 0x4a4c50, repeat: 3 }),
    clothPilot: pbr(tex.cloth, { color: 0x6b5a48, repeat: 3 }),
    armor: pbr(tex.plate, { repeat: 1.5 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x1f1a16, roughness: 0.75, metalness: 0.1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.7 }),
    gun: pbr(tex.gunmetal),
    wood: pbr(tex.wood, { color: 0x8a7460 }),
    brass: pbr(tex.brass),
    dark: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6, metalness: 0.7 }),
    sash: new THREE.MeshStandardMaterial({ color: 0x9e3a1c, roughness: 0.8, emissive: 0x3a0c04, emissiveIntensity: 0.6 }),
    visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.4) }),
    bladeGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.7, 0.5) }),
    packGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.2) }),
    walker: pbr(tex.plate, { repeat: 1 }),
    walkerDark: pbr(tex.plate, { color: 0x6a6d72 }),
    slit: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.3, 0.35) }),
    lens: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.2, 3.6) }),
    kneeGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.6) }),
    glowTex: shared.glowTex,
  };
  const packHot = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, 0.5) });

  const rigs = new Map();
  let walker = null;
  for (const e of level.enemies) {
    if (e.type === 'walker') {
      walker = buildWalker(M, scene);
      rigs.set(e.id, walker);
      continue;
    }
    const r = buildSoldier(e.type, M);
    r.packCool = M.packGlow;
    r.packHot = packHot;
    r.root.visible = false;
    scene.add(r.root);
    rigs.set(e.id, r);
  }
  const pilot = buildSoldier('pilot', M);
  pilot.root.visible = false;
  scene.add(pilot.root);
  const lights = [];
  const noShadowBeyond = quality.id === 'low' ? 22 : 60;

  function update(state, events, time, dt, camera) {
    for (const ev of events) {
      if (ev.type === 'enemy_fire') {
        const r = rigs.get(ev.id);
        if (r) r.kick = 1;
      }
    }
    for (const e of state.enemies) {
      const r = rigs.get(e.id);
      if (!r) continue;
      if (e.type === 'walker') {
        poseWalker(r, e, state, events, time, dt);
        continue;
      }
      const dist = Math.hypot(e.x - camera.position.x, e.z - camera.position.z);
      const show = !e.dormant && dist < 150;
      r.root.visible = show;
      if (!show) continue;
      poseSoldier(r, e, state, time, dt);
      const cast = dist < noShadowBeyond;
      if (r.cast !== cast) {
        r.cast = cast;
        r.root.traverse((o) => {
          if (o.isMesh && o.material !== M.visor && o.material !== M.bladeGlow) o.castShadow = cast;
        });
      }
    }
    // the pilot climbs out when the walker is down
    const w = state.enemies.find((x) => x.type === 'walker');
    const out = state.stage === 'surrender' || state.stage === 'done';
    pilot.root.visible = !!(w && out);
    if (w && out) {
      const p = state.player;
      const px = w.x;
      const pz = w.z + 4.5;
      const fake = { type: 'pilot', x: px, y: groundY(px, pz), z: pz, yaw: Math.atan2(-(p.x - px), -(p.z - pz)), hp: 1, speed: 0, crouch: false, state: 'idle', stT: 0, hitT: -1e9 };
      poseSoldier(pilot, fake, state, time, dt);
    }
  }

  return {
    update,
    lights: () => lights,
    /** World position of a soldier's muzzle, for effects that want it. */
    rig: (id) => rigs.get(id),
    dispose() {
      for (const r of rigs.values()) {
        scene.remove(r.root);
        if (r.legs) for (const l of r.legs) scene.remove(l.thigh, l.shin, l.foot);
        if (r.spot) scene.remove(r.spot, r.spot.target);
      }
      scene.remove(pilot.root);
      walker = null;
    },
  };
}
