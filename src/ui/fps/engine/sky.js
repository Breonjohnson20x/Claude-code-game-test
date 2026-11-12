// The night over Greywater: a shader sky dome (moon, stars, drifting cloud, the depot's glow on
// the southern horizon), the moon as the key light with a shadow that follows the camera, and a
// small environment map so metal has something to reflect.

import * as THREE from 'three';

export const MOON_DIR = new THREE.Vector3(-0.42, 0.62, 0.66).normalize(); // behind the player's left shoulder
export const FOG_COLOR = new THREE.Color(0x0c1626);

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uMoon;
uniform float uTime;
uniform float uFire;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  // deep navy overhead, a paler cold band at the horizon
  vec3 zenith = vec3(0.012, 0.024, 0.06);
  vec3 horizon = vec3(0.07, 0.115, 0.19);
  vec3 col = mix(horizon, zenith, pow(clamp(up, 1e-4, 1.0), 0.45));
  // the burning depot lights the southern sky from below
  float south = clamp(dot(normalize(vec2(d.x, d.z) + 1e-5), vec2(0.0, -1.0)), 0.0, 1.0);
  col += vec3(0.75, 0.32, 0.1) * pow(south + 1e-4, 5.0) * pow(1.0001 - clamp(up, 0.0, 1.0), 6.0) * uFire;
  // moon: disc, limb darkening, wide halo
  float md = clamp(dot(d, uMoon), 1e-4, 1.0);
  float disc = smoothstep(0.99955, 0.99975, md);
  vec3 moonCol = vec3(1.0, 0.97, 0.9) * (0.75 + 0.25 * noise(d.xy * 90.0));
  col += vec3(0.5, 0.58, 0.72) * pow(max(md, 0.0), 220.0) * 0.5;
  col += vec3(0.24, 0.3, 0.42) * pow(max(md, 0.0), 14.0) * 0.32;
  // stars
  vec3 sp = d * 220.0;
  vec3 cell = floor(sp);
  float star = hash3(cell);
  float tw = 0.75 + 0.25 * sin(uTime * 2.0 + star * 60.0);
  float s = smoothstep(0.9965, 1.0, star) * smoothstep(0.55, 0.0, length(fract(sp) - 0.5)) * tw;
  col += vec3(0.95, 0.96, 1.0) * s * 1.6 * smoothstep(0.02, 0.3, up);
  // cloud: two drifting layers, silver where the moon is behind them
  vec2 cuv = d.xz / (d.y + 0.25) * 1.4;
  float c1 = fbm(cuv * 1.3 + vec2(uTime * 0.006, uTime * 0.002));
  float c2 = fbm(cuv * 2.9 - vec2(uTime * 0.004, 0.0) + 3.7);
  float cloud = smoothstep(0.48, 0.82, c1 * 0.7 + c2 * 0.4) * smoothstep(0.0, 0.22, up);
  vec3 cloudCol = mix(vec3(0.035, 0.05, 0.085), vec3(0.42, 0.5, 0.62), pow(max(md, 0.0), 6.0) * 0.8 + 0.06);
  cloudCol += vec3(0.5, 0.2, 0.06) * pow(south + 1e-4, 3.0) * pow(1.0001 - clamp(up, 0.0, 1.0), 3.0) * 0.6 * uFire;
  col = mix(col, cloudCol, cloud * 0.85);
  col += moonCol * disc * (1.0 - cloud * 0.8) * 2.4;
  // ground haze below the horizon so the dome never shows a hard edge
  col = mix(col, vec3(0.047, 0.086, 0.149), smoothstep(0.0, -0.12, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(scene, renderer, quality, scannedEnv = null) {
  const uniforms = { uMoon: { value: MOON_DIR.clone() }, uTime: { value: 0 }, uFire: { value: 1 } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false }),
  );
  dome.scale.setScalar(900);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0105);
  scene.background = FOG_COLOR;

  const hemi = new THREE.HemisphereLight(0x5d7396, 0x1c1712, 0.62);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xb9cdf2, 1.55);
  moon.castShadow = quality.shadows > 0;
  if (moon.castShadow) {
    moon.shadow.mapSize.set(quality.shadows, quality.shadows);
    const r = quality.shadowRange;
    Object.assign(moon.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 });
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.06;
    moon.shadow.radius = 2.5;
  }
  scene.add(moon);
  scene.add(moon.target);

  // environment: the sky dome rendered into a small cube, then prefiltered
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(dome.geometry, dome.material);
  envDome.scale.setScalar(50);
  envScene.add(envDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  pmrem.dispose();
  // a real night sky, when it loaded, gives metal and wet stone something true to reflect
  const envMap = scannedEnv ?? env.texture;
  scene.environment = envMap;
  scene.environmentIntensity = scannedEnv ? 0.38 : 0.55;

  const tmp = new THREE.Vector3();
  return {
    env: envMap,
    moon,
    hemi,
    uniforms,
    update(camera, time) {
      uniforms.uTime.value = time;
      dome.position.copy(camera.position);
      // the shadow frustum rides with the camera, snapped to texels so shadows do not swim
      if (moon.castShadow) {
        const r = quality.shadowRange;
        const texel = (r * 2) / quality.shadows;
        tmp.copy(camera.position);
        tmp.x = Math.round(tmp.x / texel) * texel;
        tmp.z = Math.round(tmp.z / texel) * texel;
        tmp.y = 0;
        moon.target.position.copy(tmp);
        moon.position.copy(tmp).addScaledVector(MOON_DIR, 110);
      }
    },
    dispose() {
      env.dispose();
      dome.geometry.dispose();
      dome.material.dispose();
    },
  };
}
