import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface BakeOptions {
  /** Merge every static mesh in the subtree (true) or only direct mesh children (false). */
  recursive?: boolean;
  /**
   * When provided, plain untextured MeshStandardMaterials are collapsed into this single
   * vertex-coloured material (their colour is baked per vertex), so a whole set of props
   * becomes one draw call.
   */
  vertexColorMaterial?: THREE.Material;
  /** Meshes to leave untouched (animated parts, etc.). */
  skip?: (mesh: THREE.Mesh) => boolean;
}

interface Bucket {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
  vertexColors: boolean;
}

const _rel = new THREE.Matrix4();
const _rootInv = new THREE.Matrix4();

/**
 * Collapses static meshes under `root` into one mesh per material (draw-call batching).
 * Meshes with children (anchors, fur shells, ...) and instanced meshes are never merged.
 */
export function bakeStatic(root: THREE.Object3D, options: BakeOptions = {}): void {
  const { recursive = false, vertexColorMaterial, skip } = options;

  root.updateMatrixWorld(true);
  _rootInv.copy(root.matrixWorld).invert();

  const candidates: THREE.Mesh[] = [];
  const visit = (obj: THREE.Object3D) => {
    for (const child of obj.children) {
      const mesh = child as THREE.Mesh;
      const mergeable =
        mesh.isMesh &&
        !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh &&
        mesh.children.length === 0 &&
        mesh.visible &&
        !Array.isArray(mesh.material) &&
        !(skip && skip(mesh));
      if (mergeable) candidates.push(mesh);
      else if (recursive && !mesh.isMesh) visit(child);
    }
  };
  visit(root);
  if (candidates.length < 2) return;

  const buckets = new Map<string, Bucket>();
  for (const mesh of candidates) {
    const mat = mesh.material as THREE.Material;
    const std = mat as THREE.MeshStandardMaterial;
    const collapse =
      !!vertexColorMaterial &&
      std.isMeshStandardMaterial &&
      !std.map &&
      !std.vertexColors &&
      !std.transparent &&
      std.side === THREE.FrontSide &&
      std.emissiveIntensity * std.emissive.getHex() === 0;

    const key = collapse ? "__vertexColor" : mat.uuid;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: collapse ? vertexColorMaterial! : mat,
        geometries: [],
        castShadow: false,
        receiveShadow: false,
        vertexColors: collapse,
      };
      buckets.set(key, bucket);
    }

    _rel.multiplyMatrices(_rootInv, mesh.matrixWorld);
    let geo = mesh.geometry.clone().applyMatrix4(_rel);
    if (geo.index) geo = geo.toNonIndexed();
    if ((std as THREE.MeshStandardMaterial).flatShading) geo.computeVertexNormals();
    if (collapse && !geo.attributes.color) {
      const c = std.color;
      const count = geo.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    bucket.geometries.push(geo);
    bucket.castShadow ||= mesh.castShadow;
    bucket.receiveShadow ||= mesh.receiveShadow;
    mesh.removeFromParent();
  }

  for (const bucket of buckets.values()) {
    const needsUv = !!(bucket.material as THREE.MeshStandardMaterial).map;
    const usesColor = bucket.vertexColors || (bucket.material as THREE.MeshStandardMaterial).vertexColors;
    const keep = new Set(["position", "normal", ...(needsUv ? ["uv"] : []), ...(usesColor ? ["color"] : [])]);
    for (const geo of bucket.geometries) {
      for (const name of Object.keys(geo.attributes)) if (!keep.has(name)) geo.deleteAttribute(name);
      if (needsUv && !geo.attributes.uv) {
        geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      }
      geo.morphAttributes = {};
      geo.clearGroups();
    }

    const merged = bucket.geometries.length === 1 ? bucket.geometries[0] : mergeGeometries(bucket.geometries);
    for (const g of bucket.geometries) if (g !== merged) g.dispose();
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    root.add(mesh);
  }

  if (recursive) pruneEmpty(root);
}

function pruneEmpty(obj: THREE.Object3D): void {
  for (const child of [...obj.children]) {
    pruneEmpty(child);
    const isPlainGroup = !(child as THREE.Mesh).isMesh && child.type === "Group";
    if (isPlainGroup && child.children.length === 0) child.removeFromParent();
  }
}
