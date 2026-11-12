// Collapse the static meshes under a group into one mesh per material, so a soldier's forearm or
// a gun's receiver is one draw call instead of a dozen. Anything in `keep` (and everything
// below it) is left alone: bones, glowing parts whose colour changes, parts that spin.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const REL = new THREE.Matrix4();

export function bake(group, keep = []) {
  const skip = new Set(keep);
  const found = [];
  const walk = (node, matrix) => {
    for (const child of node.children) {
      if (skip.has(child) || child.isSprite || child.isLight) continue;
      child.updateMatrix();
      const m = matrix.clone().multiply(child.matrix);
      if (child.isMesh && !child.isInstancedMesh) found.push([child, m]);
      if (!child.isMesh) walk(child, m);
    }
  };
  walk(group, REL.identity());
  const byKey = new Map();
  for (const [mesh, matrix] of found) {
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g = g.applyMatrix4(matrix);
    const key = `${mesh.material.uuid}:${mesh.castShadow ? 1 : 0}`;
    if (!byKey.has(key)) byKey.set(key, { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, list: [] });
    byKey.get(key).list.push(g);
    mesh.removeFromParent();
  }
  for (const { material, cast, receive, list } of byKey.values()) {
    const merged = new THREE.Mesh(list.length === 1 ? list[0] : mergeGeometries(list, false), material);
    merged.castShadow = cast;
    merged.receiveShadow = receive;
    group.add(merged);
  }
  return group;
}
