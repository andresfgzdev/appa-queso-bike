import * as THREE from "three";

interface Part {
  source: THREE.Mesh;
  start: number; // first vertex in the merged buffer
  count: number;
  basePositions: Float32Array; // part-local
  baseNormals: Float32Array;
  lastMatrix: THREE.Matrix4;
}

const _rel = new THREE.Matrix4();
const _rootInv = new THREE.Matrix4();
const _normalMat = new THREE.Matrix3();

/**
 * Draws many independently animated meshes that share one material as a single mesh.
 *
 * The source meshes stay in the scene graph as invisible "drivers" (IK, rotations, etc. keep
 * working on them). Every frame `update()` re-transforms each driver's vertices into the
 * merged buffer — only for parts whose transform actually changed — so a whole articulated
 * character or bicycle costs one draw call per material instead of one per part.
 */
export class DynamicBatch {
  public mesh: THREE.Mesh;
  private parts: Part[] = [];
  private root: THREE.Object3D;
  private positions: THREE.BufferAttribute;
  private normals: THREE.BufferAttribute;

  constructor(root: THREE.Object3D, sources: THREE.Mesh[], material: THREE.Material) {
    this.root = root;

    const prepared = sources.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      return g;
    });
    const total = prepared.reduce((n, g) => n + g.attributes.position.count, 0);
    const needsUv = prepared.every((g) => !!g.attributes.uv);

    const posArray = new Float32Array(total * 3);
    const nrmArray = new Float32Array(total * 3);
    const uvArray = needsUv ? new Float32Array(total * 2) : null;

    let offset = 0;
    prepared.forEach((g, i) => {
      const count = g.attributes.position.count;
      const basePositions = new Float32Array(g.attributes.position.array as ArrayLike<number>);
      const baseNormals = new Float32Array(g.attributes.normal.array as ArrayLike<number>);
      if (uvArray) uvArray.set(g.attributes.uv.array as ArrayLike<number>, offset * 2);
      this.parts.push({
        source: sources[i],
        start: offset,
        count,
        basePositions,
        baseNormals,
        lastMatrix: new THREE.Matrix4().set(NaN, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      });
      offset += count;
      g.dispose();
    });

    const geo = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(posArray, 3).setUsage(THREE.DynamicDrawUsage);
    this.normals = new THREE.BufferAttribute(nrmArray, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.positions);
    geo.setAttribute("normal", this.normals);
    if (uvArray) geo.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));

    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = sources.some((s) => s.castShadow);
    this.mesh.receiveShadow = true;
    root.add(this.mesh);

    for (const s of sources) s.visible = false;
  }

  /** Call after the drivers' world matrices are up to date. */
  public update(): void {
    _rootInv.copy(this.root.matrixWorld).invert();
    const pos = this.positions.array as Float32Array;
    const nrm = this.normals.array as Float32Array;
    let dirty = false;

    for (const part of this.parts) {
      _rel.multiplyMatrices(_rootInv, part.source.matrixWorld);
      if (_rel.equals(part.lastMatrix)) continue;
      part.lastMatrix.copy(_rel);
      dirty = true;

      const e = _rel.elements;
      _normalMat.getNormalMatrix(_rel);
      const n = _normalMat.elements;
      const bp = part.basePositions;
      const bn = part.baseNormals;
      let o = part.start * 3;
      for (let i = 0; i < part.count * 3; i += 3, o += 3) {
        const x = bp[i], y = bp[i + 1], z = bp[i + 2];
        pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];

        const nx = bn[i], ny = bn[i + 1], nz = bn[i + 2];
        let tx = n[0] * nx + n[3] * ny + n[6] * nz;
        let ty = n[1] * nx + n[4] * ny + n[7] * nz;
        let tz = n[2] * nx + n[5] * ny + n[8] * nz;
        const len = Math.hypot(tx, ty, tz) || 1;
        tx /= len; ty /= len; tz /= len;
        nrm[o] = tx;
        nrm[o + 1] = ty;
        nrm[o + 2] = tz;
      }
    }

    if (dirty) {
      this.positions.needsUpdate = true;
      this.normals.needsUpdate = true;
    }
  }
}

/** Groups the meshes under `root` by material and batches each group (≥2 parts). */
export function batchByMaterial(
  root: THREE.Object3D,
  filter: (mesh: THREE.Mesh) => boolean = () => true
): DynamicBatch[] {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (Array.isArray(mesh.material) || !mesh.visible || !filter(mesh)) return;
    const list = groups.get(mesh.material) ?? [];
    list.push(mesh);
    groups.set(mesh.material, list);
  });

  const batches: DynamicBatch[] = [];
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const batch = new DynamicBatch(root, meshes, material);
    batch.update();
    batches.push(batch);
  }
  return batches;
}
