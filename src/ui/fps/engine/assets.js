// Scanned assets for the first-person mission: photo-scanned PBR textures, a few models and a
// night-sky HDRI from Poly Haven (CC0; see public/fps/CREDITS.md). They are an upgrade, not a
// requirement: anything that fails to load (offline before the first visit, a blocked request)
// is simply left out and the procedural version stays.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// which scan replaces which procedural set; `orm` says what the packed map really holds
const TEXTURES = {
  ground: { id: 'forrest_ground_01', orm: 'rough' },
  road: { id: 'rocky_trail', orm: 'arm' },
  stone: { id: 'castle_brick_07', orm: 'rough' },
  ashlar: { id: 'medieval_blocks_05', orm: 'rough' },
  wood: { id: 'weathered_brown_planks', orm: 'rough' },
  bark: { id: 'pine_bark', orm: 'arm' },
  plate: { id: 'metal_plate', orm: 'rough', metalness: 0.9 },
  slate: { id: 'roof_slates_03', orm: 'arm' },
  rock: { id: 'rock_face_03', orm: 'arm' },
};
const MODELS = { barrel: 'Barrel_01', rocks: 'rock_moss_set_01', fern: 'fern_02' };

const base = () => `${import.meta.env.BASE_URL ?? '/'}fps/`;

function loadTexture(loader, url, srgb, anisotropy) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = anisotropy;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

/**
 * Load what the quality tier wants. Resolves to { tex, models, env }; missing pieces are absent.
 * tex[name] = { map, normalMap, ormMap, scan: true, orm, metalness }
 */
export async function loadScans(quality, renderer, onProgress) {
  const out = { tex: {}, models: {}, env: null };
  if (quality.scans === 0) return out;
  const size = quality.scans >= 2 ? '1k' : '512';
  const texLoader = new THREE.TextureLoader();
  const jobs = [];
  let done = 0;
  const tick = () => {
    done += 1;
    onProgress?.(done / jobs.length);
  };
  for (const [name, def] of Object.entries(TEXTURES)) {
    const dir = `${base()}tex/${def.id}/`;
    jobs.push(
      Promise.all([loadTexture(texLoader, `${dir}diff_${size}.webp`, true, quality.aniso), loadTexture(texLoader, `${dir}nor_${size}.webp`, false, quality.aniso), loadTexture(texLoader, `${dir}orm_${size}.webp`, false, quality.aniso)]).then(([map, normalMap, ormMap]) => {
        if (map && normalMap && ormMap) out.tex[name] = { map, normalMap, ormMap, scan: true, orm: def.orm, metalness: def.metalness ?? 0 };
        tick();
      }),
    );
  }
  if (quality.scans >= 2) {
    const gltf = new GLTFLoader();
    for (const [name, id] of Object.entries(MODELS)) {
      jobs.push(
        new Promise((resolve) => {
          gltf.load(
            `${base()}models/${id}/${id}.gltf`,
            (g) => {
              g.scene.updateMatrixWorld(true);
              const meshes = [];
              g.scene.traverse((o) => {
                if (!o.isMesh) return;
                // bake each part's placement so every mesh sits at the origin, feet on the ground
                const geo = o.geometry.clone();
                geo.applyMatrix4(o.matrixWorld);
                geo.computeBoundingBox();
                const b = geo.boundingBox;
                geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
                geo.computeBoundingBox();
                o.material.envMapIntensity = 1;
                meshes.push({ name: o.name, geometry: geo, material: o.material, size: geo.boundingBox.getSize(new THREE.Vector3()) });
              });
              out.models[name] = meshes;
              tick();
              resolve();
            },
            undefined,
            () => {
              tick();
              resolve();
            },
          );
        }),
      );
    }
    jobs.push(
      new Promise((resolve) => {
        new HDRLoader().load(
          `${base()}night_1k.hdr`,
          (hdr) => {
            hdr.mapping = THREE.EquirectangularReflectionMapping;
            const pmrem = new THREE.PMREMGenerator(renderer);
            out.env = pmrem.fromEquirectangular(hdr).texture;
            hdr.dispose();
            pmrem.dispose();
            tick();
            resolve();
          },
          undefined,
          () => {
            tick();
            resolve();
          },
        );
      }),
    );
  }
  await Promise.all(jobs);
  return out;
}
