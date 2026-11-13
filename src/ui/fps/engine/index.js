// The first-person renderer: owns the WebGL context, builds the world from the level, and each
// frame turns the simulation's state and events into a picture. The simulation never knows it
// exists; nothing here changes the game.

import * as THREE from 'three';
import { buildLevel } from '../../../game/fps/level.js';
import { PLAYER } from '../../../game/fps/combat.js';
import { bakeTextures, makeParticleAtlas } from './textures.js';
import { createSky } from './sky.js';
import { loadScans } from './assets.js';
import { buildWorld } from './world.js';
import { createActors } from './actors.js';
import { createFx } from './fx.js';
import { createViewmodel } from './viewmodel.js';
import { createPost } from './post.js';

export const QUALITY = Object.freeze({
  low: { id: 'low', label: 'Low', maxPixelRatio: 1.5, scale: 0.7, shadows: 0, shadowRange: 34, grass: 0.22, trees: 0.5, scans: 1, lights: 3, bloom: 1, msaa: 0, texDetail: 0.5, particles: 0.5, aniso: 2 },
  medium: { id: 'medium', label: 'Medium', maxPixelRatio: 1.25, scale: 0.85, shadows: 2048, shadowRange: 44, grass: 0.55, trees: 1, scans: 2, lights: 5, bloom: 1, msaa: 2, texDetail: 1, particles: 0.8, aniso: 4 },
  high: { id: 'high', label: 'High', maxPixelRatio: 1.5, scale: 1, shadows: 2048, shadowRange: 52, grass: 1, trees: 1, scans: 2, lights: 7, bloom: 1, msaa: 4, texDetail: 1, particles: 1, aniso: 8 },
});

/** A sensible default: phones and weak GPUs start low, everything else medium or high. */
export function guessQuality() {
  const nav = globalThis.navigator ?? {};
  const touch = (nav.maxTouchPoints ?? 0) > 0 && Math.min(globalThis.innerWidth ?? 1000, globalThis.innerHeight ?? 1000) < 820;
  if (touch) return 'low';
  if ((nav.hardwareConcurrency ?? 4) <= 4) return 'medium';
  return 'high';
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * createFpsRenderer({ canvas, quality }) → renderer.
 *   await renderer.load(onProgress)   bake textures, build the world
 *   renderer.frame(state, events, dt, view)   draw one frame (view: camera feel from the screen)
 *   renderer.resize(), renderer.dispose()
 */
export function createFpsRenderer({ canvas, quality: qualityId = guessQuality(), reducedMotion = false } = {}) {
  const quality = QUALITY[qualityId] ?? QUALITY.medium;
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping; // the post pass tone-maps
  gl.shadowMap.enabled = quality.shadows > 0;
  gl.shadowMap.type = THREE.PCFShadowMap;
  gl.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(74, 1, 0.08, 1200);
  camera.rotation.order = 'YXZ';
  const shared = { time: { value: 0 }, glowTex: null, atlas: null };
  const level = buildLevel();

  let sky = null;
  let world = null;
  let actors = null;
  let fx = null;
  let viewmodel = null;
  let post = null;
  let lightPool = [];
  let loaded = false;
  let disposed = false;
  let time = 0;
  let scale = quality.scale;
  let slowFrames = 0;
  const cam = { x: 0, y: 0, z: 0, bob: 0, bobT: 0, landDip: 0, roll: 0, shake: 0, fov: 74, eyeY: null };
  const size = { w: 1, h: 1 };

  let gpu = null;
  /** The graphics chip's name, when the browser will say (for performance reports). */
  function gpuName() {
    if (gpu == null) {
      try {
        const ctx = gl.getContext();
        const ext = ctx.getExtension('WEBGL_debug_renderer_info');
        gpu = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)).slice(0, 80);
      } catch {
        gpu = 'unknown';
      }
    }
    return gpu;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return; // collapsed while screens swap: keep the last size
    size.w = rect.width;
    size.h = rect.height;
    const pr = Math.min(globalThis.devicePixelRatio || 1, quality.maxPixelRatio) * scale;
    gl.setPixelRatio(pr);
    gl.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    post?.resize(rect.width, rect.height, pr);
    viewmodel?.resize(camera.aspect);
  }

  async function load(onProgress) {
    const tex = await bakeTextures({ detail: quality.texDetail, anisotropy: quality.aniso, onProgress: (d, t) => onProgress?.((d / t) * 0.45, 'Baking stone, timber and steel') });
    if (disposed) return;
    // photo-scanned surfaces and props replace the baked ones where they load
    const scans = await loadScans(quality, gl, (k) => onProgress?.(0.45 + k * 0.27, 'Unpacking scanned stone and timber'));
    if (disposed) return;
    Object.assign(tex, scans.tex);
    shared.atlas = makeParticleAtlas();
    shared.glowTex = makeGlowTexture();
    onProgress?.(0.74, 'Raising the night sky');
    sky = createSky(scene, gl, quality, scans.env);
    await tickFrame();
    onProgress?.(0.8, 'Building the Greywater road');
    world = buildWorld(scene, level, tex, quality, shared, scans.models);
    await tickFrame();
    onProgress?.(0.9, 'Mustering the Fourth Walker Lance');
    actors = createActors(scene, level, tex, quality, shared);
    fx = createFx(scene, level, quality, shared, reducedMotion);
    viewmodel = createViewmodel(tex, sky.env, quality, shared);
    for (let i = 0; i < quality.lights; i += 1) {
      const l = new THREE.PointLight(0xffa050, 0, 20, 2);
      scene.add(l);
      lightPool.push(l);
    }
    post = createPost(gl, scene, camera, viewmodel, quality);
    resize();
    onProgress?.(0.97, 'Lighting the lamps');
    // compile every shader now, behind the loading screen, not in the first firefight
    gl.compile(scene, camera);
    await tickFrame();
    loaded = true;
    onProgress?.(1, 'Ready');
  }

  const candidates = [];
  function assignLights(camPos) {
    candidates.length = 0;
    for (const l of world.lights) candidates.push(l);
    for (const l of fx.lights()) candidates.push(l);
    for (const l of actors.lights()) candidates.push(l);
    for (const c of candidates) {
      const d = Math.hypot(c.x - camPos.x, c.y - camPos.y, c.z - camPos.z);
      c._score = d / (c.range * (c.priority ?? 1));
    }
    candidates.sort((a, b) => a._score - b._score);
    for (let i = 0; i < lightPool.length; i += 1) {
      const L = lightPool[i];
      const c = candidates[i];
      if (!c || c._score > 4.5) {
        L.intensity = 0;
        continue;
      }
      const fl = c.flicker ? 1 + (Math.sin(time * 11 + c.seed) * 0.5 + Math.sin(time * 23.7 + c.seed * 2) * 0.3 + Math.sin(time * 4.3 + c.seed)) * c.flicker * 0.5 : 1;
      L.position.set(c.x, c.y, c.z);
      L.color.set(c.color);
      L.distance = c.range;
      // fade in as it comes into the pool's reach so lights never pop
      L.intensity = c.intensity * fl * THREE.MathUtils.clamp((4.5 - c._score) / 1.2, 0, 1);
    }
  }

  /**
   * view: { recoilPitch, recoilYaw, kick, hurt, lowHealth, ward, dead, won, paused, zoom }
   * (camera feel owned by the screen: the simulation only knows where the Sovereign looks).
   */
  function frame(state, events, dt, view = {}) {
    if (!loaded || disposed) return;
    time += dt;
    shared.time.value = time;
    const p = state.player;
    // camera: eyes of the body, with a little life in them
    const eye = lerp(PLAYER.EYE, PLAYER.CROUCH_EYE, p.crouch);
    const targetY = p.y + eye;
    cam.eyeY = cam.eyeY == null ? targetY : cam.eyeY + (targetY - cam.eyeY) * Math.min(1, dt * 16);
    const speed = Math.hypot(p.vx, p.vz);
    if (p.grounded && speed > 0.6 && !reducedMotion) cam.bobT += dt * (p.sprinting ? 13.5 : 9.5) * Math.min(1, speed / 4);
    const bobAmt = p.grounded ? Math.min(1, speed / 4.6) * (p.sprinting ? 0.052 : 0.03) * (1 - p.ads * 0.8) : 0;
    cam.bob += (bobAmt - cam.bob) * Math.min(1, dt * 8);
    for (const ev of events) {
      if (ev.type === 'land') cam.landDip = ev.hard ? 0.2 : 0.1;
      if (ev.type === 'player_hit' && !reducedMotion) cam.shake = Math.min(1, cam.shake + ev.dmg * 0.03);
      if (ev.type === 'explosion' && !reducedMotion) cam.shake = Math.min(1.2, cam.shake + 9 / (4 + Math.hypot(ev.x - p.x, ev.z - p.z)));
      if (ev.type === 'walker_stomp' && !reducedMotion) cam.shake = Math.min(1.2, cam.shake + 0.8);
    }
    cam.landDip *= Math.exp(-dt * 9);
    cam.shake *= Math.exp(-dt * 5.5);
    const strafe = p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw);
    cam.roll += ((reducedMotion ? 0 : -strafe * 0.0045) - cam.roll) * Math.min(1, dt * 8);
    const sh = cam.shake * cam.shake;
    camera.position.set(
      p.x + Math.cos(p.yaw) * Math.cos(cam.bobT * 0.5) * cam.bob * 0.6 + (Math.sin(time * 71) * sh) * 0.05,
      cam.eyeY + Math.sin(cam.bobT) * cam.bob - cam.landDip + (Math.sin(time * 93) * sh) * 0.05,
      p.z - Math.sin(p.yaw) * Math.cos(cam.bobT * 0.5) * cam.bob * 0.6,
    );
    camera.rotation.set(p.pitch + (view.recoilPitch ?? 0) + Math.sin(time * 57) * sh * 0.012, p.yaw + (view.recoilYaw ?? 0) + Math.sin(time * 49) * sh * 0.012, cam.roll + (state.status === 'dead' ? Math.min(0.5, (view.deadFor ?? 0) * 0.6) : 0));
    const wantFov = lerp(74, 74 / (view.zoom ?? 1), p.ads) + (p.sprinting && !reducedMotion ? 5 : 0);
    cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 12);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }

    sky.update(camera, time);
    world.update(state, time, dt);
    actors.update(state, events, time, dt, camera);
    fx.update(state, events, time, dt, camera);
    viewmodel.update(state, events, time, dt, view, camera);
    assignLights(camera.position);
    if (view.skipRender) return; // dev: advance effects without drawing (warm-up for stills)
    gl.info.reset();
    post.render(dt, time, state, view);

    // adaptive resolution: give up pixels before giving up frames
    if (dt > 1 / 38) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames > 50 && scale > 0.5) {
      scale = Math.max(0.5, scale - 0.1);
      slowFrames = 0;
      resize();
    }
  }

  function dispose() {
    disposed = true;
    world?.dispose();
    actors?.dispose();
    fx?.dispose();
    viewmodel?.dispose();
    post?.dispose();
    sky?.dispose();
    gl.dispose();
    lightPool = [];
  }

  return {
    load,
    frame,
    resize,
    dispose,
    quality,
    camera,
    scene,
    /** Renderer statistics for the dev overlay and the performance probe. */
    stats: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, scale, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, gpu: gpuName() }),
    get ready() {
      return loaded;
    },
  };
}

function tickFrame() {
  return new Promise((r) => (globalThis.requestAnimationFrame ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
