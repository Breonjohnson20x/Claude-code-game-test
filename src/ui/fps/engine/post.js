// Post-processing for the first-person mode: HDR render → the weapon drawn over it with its own
// depth → bloom → one final pass that tone-maps (ACES), grades toward navy shadows and warm
// highlights, and adds vignette, film grain and the hurt / low-health / ward overlays.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uExposure: { value: 1.25 },
    uHurt: { value: 0 },
    uLow: { value: 0 },
    uWard: { value: 0 },
    uDead: { value: 0 },
    uFlash: { value: 0 },
    uGrain: { value: 0.018 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uExposure, uHurt, uLow, uWard, uDead, uFlash, uGrain, uFade;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 q = vUv - 0.5;
      vec3 col = texture2D(tDiffuse, vUv).rgb * uExposure;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // moonlight keeps its blue in the shadows; firelight keeps its gold in the highlights
      col *= mix(vec3(1.0), vec3(0.9, 0.98, 1.14), smoothstep(0.3, 0.0, l) * 0.7);
      col *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), smoothstep(0.5, 1.8, l) * 0.6);
      col = aces(col);
      col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, clamp(1.1 - uLow * 0.55 - uDead * 0.85, 0.0, 1.2));
      col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;
      float r = length(q * vec2(1.0, 1.12));
      col *= mix(0.55, 1.0, smoothstep(0.86, 0.3, r));
      float edge = smoothstep(0.22, 0.74, r);
      float pulse = uLow * (0.3 + 0.14 * sin(uTime * 5.2));
      col = mix(col, vec3(0.5, 0.05, 0.02), edge * clamp(uHurt * 0.8 + pulse, 0.0, 0.85));
      col += vec3(1.0, 0.8, 0.42) * edge * uWard * 0.2;
      col += vec3(1.0, 0.93, 0.8) * uFlash;
      col = mix(col, vec3(0.02, 0.0, 0.0), uDead * 0.55);
      col += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(toSrgb(clamp(col, 0.0, 1.0)) * uFade, 1.0);
    }`,
};

export function createPost(gl, scene, camera, viewmodel, quality) {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa, depthBuffer: true });
  const composer = new EffectComposer(gl, target);
  const world = new RenderPass(scene, camera);
  composer.addPass(world);
  const weapon = new RenderPass(viewmodel.scene, viewmodel.camera);
  weapon.clear = false;
  weapon.clearDepth = true;
  composer.addPass(weapon);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.72, 0.92);
  bloom.enabled = quality.bloom > 0;
  composer.addPass(bloom);
  const final = new ShaderPass(FinalShader);
  composer.addPass(final);
  const u = final.uniforms;
  let hurt = 0;
  let flash = 0;

  return {
    resize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      u.uRes.value.set(w * pr, h * pr);
    },
    render(dt, time, state, view) {
      hurt = Math.max(hurt * Math.exp(-dt * 2.6), view.hurt ?? 0);
      flash = Math.max(flash * Math.exp(-dt * 7), view.flash ?? 0);
      const p = state.player;
      u.uTime.value = time;
      u.uHurt.value = hurt;
      u.uFlash.value = flash;
      u.uLow.value = state.status === 'playing' ? THREE.MathUtils.clamp((38 - p.hp) / 38, 0, 1) : 0;
      u.uWard.value += ((p.warding ? 1 : 0) - u.uWard.value) * Math.min(1, dt * 10);
      u.uDead.value += ((state.status === 'dead' ? 1 : 0) - u.uDead.value) * Math.min(1, dt * 3);
      u.uFade.value = view.fade ?? 1;
      weapon.enabled = view.showWeapon !== false && state.status !== 'dead';
      composer.render(dt);
    },
    dispose() {
      target.dispose();
      composer.dispose();
    },
  };
}
