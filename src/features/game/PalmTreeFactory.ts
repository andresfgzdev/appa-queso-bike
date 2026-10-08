import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface PalmVariant {
  trunk: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
  coconuts: THREE.BufferGeometry;
  top: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Procedural Washingtonia-style palms: curved, ring-barked trunk, arching pinnate fronds
 * with saw-tooth leaflets, and a coconut cluster. A handful of variants are generated once
 * and shared by every palm (3 draw calls per tree, zero per-frame cost).
 */
export class PalmTreeFactory {
  private variants: PalmVariant[] = [];
  private fanVariants: { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry; top: THREE.Vector3 }[] = [];
  private fanTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8c7b69, roughness: 0.95 });
  private trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
  private frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  private coconutMat = new THREE.MeshStandardMaterial({ color: 0x5b3b1e, roughness: 0.8 });

  constructor(variantCount = 4) {
    for (let i = 0; i < variantCount; i++) {
      this.variants.push(this.buildVariant(i));
      this.fanVariants.push(this.buildFanVariant(i + 100));
    }
  }

  /** Tall, skinny Mexican fan palm (Washingtonia robusta) — the classic LA skyline palm. */
  public createFanPalm(): THREE.Group {
    const v = this.fanVariants[Math.floor(Math.random() * this.fanVariants.length)];
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(v.trunk, this.fanTrunkMat);
    const crown = new THREE.Mesh(v.crown, this.frondMat);
    crown.position.copy(v.top);
    trunk.castShadow = crown.castShadow = true;
    palm.add(trunk, crown);
    palm.rotation.y = Math.random() * Math.PI * 2;
    palm.scale.setScalar(0.85 + Math.random() * 0.3);
    return palm;
  }

  private buildFanVariant(seed: number) {
    const rand = mulberry32(seed * 7919 + 3);
    const height = 13 + rand() * 6;
    const lean = 0.2 + rand() * 0.7;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.1, height * 0.4, 0),
      new THREE.Vector3(lean * 0.5, height * 0.8, lean * 0.1),
      new THREE.Vector3(lean, height, 0),
    ]);

    const rings = 44;
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings;
      const p0 = curve.getPointAt(t0);
      const p1 = curve.getPointAt((i + 1) / rings);
      const len = p0.distanceTo(p1);
      const flare = i < 2 ? 1.5 - i * 0.2 : 1;
      const radius = THREE.MathUtils.lerp(0.27, 0.17, Math.pow(t0, 0.7)) * flare;
      const seg = new THREE.CylinderGeometry(radius * 0.97, radius * 1.03, len * 1.02, 12, 1);
      seg.translate(0, len / 2, 0);
      seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, p1.clone().sub(p0).normalize()));
      seg.translate(p0.x, p0.y, p0.z);
      parts.push(seg.toNonIndexed());
    }
    const trunk = mergeGeometries(parts);
    trunk.computeVertexNormals();
    const top = curve.getPointAt(1);

    // Crown: dead-frond "skirt" + fan leaves on petioles
    const crownParts: THREE.BufferGeometry[] = [buildSkirt(rand)];
    const leafCount = 16 + Math.floor(rand() * 6);
    for (let f = 0; f < leafCount; f++) {
      const leaf = buildFanLeaf(rand);
      leaf.rotateX(0.55 - rand() * 1.1); // some up, some drooping
      leaf.rotateY((f / leafCount) * Math.PI * 2 + rand() * 0.25);
      leaf.translate(0, 0.25 + rand() * 0.3, 0);
      crownParts.push(leaf);
    }
    const crown = mergeGeometries(crownParts);
    return { trunk, crown, top };
  }

  public create(): THREE.Group {
    const v = this.variants[Math.floor(Math.random() * this.variants.length)];
    const palm = new THREE.Group();

    const trunk = new THREE.Mesh(v.trunk, this.trunkMat);
    const crown = new THREE.Mesh(v.crown, this.frondMat);
    const coconuts = new THREE.Mesh(v.coconuts, this.coconutMat);
    crown.position.copy(v.top);
    coconuts.position.copy(v.top);
    trunk.castShadow = crown.castShadow = true;
    palm.add(trunk, crown, coconuts);

    palm.rotation.y = Math.random() * Math.PI * 2;
    palm.scale.setScalar(0.9 + Math.random() * 0.25);
    return palm;
  }

  public dispose(): void {
    for (const v of this.variants) {
      v.trunk.dispose();
      v.crown.dispose();
      v.coconuts.dispose();
    }
    for (const v of this.fanVariants) {
      v.trunk.dispose();
      v.crown.dispose();
    }
    this.fanTrunkMat.dispose();
    this.trunkMat.dispose();
    this.frondMat.dispose();
    this.coconutMat.dispose();
  }

  private buildVariant(seed: number): PalmVariant {
    const rand = mulberry32(seed * 9973 + 17);
    const height = 5.4 + rand() * 1.4;
    const lean = 0.35 + rand() * 0.6;

    // Trunk centreline: gentle S-curve leaning toward +X
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.15, height * 0.35, 0),
      new THREE.Vector3(lean * 0.55, height * 0.7, 0.05),
      new THREE.Vector3(lean, height, 0),
    ]);

    // Stacked flared rings give the characteristic leaf-scar bark
    const rings = 26;
    const trunkParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings;
      const t1 = (i + 1) / rings;
      const p0 = curve.getPointAt(t0);
      const p1 = curve.getPointAt(t1);
      const len = p0.distanceTo(p1);
      const radius = THREE.MathUtils.lerp(0.3, 0.17, t0) * (i === 0 ? 1.25 : 1);
      const seg = new THREE.CylinderGeometry(radius * 0.96, radius * 1.04, len * 1.02, 16, 1);
      seg.translate(0, len / 2, 0);
      seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, p1.clone().sub(p0).normalize()));
      seg.translate(p0.x, p0.y, p0.z);
      trunkParts.push(seg);
    }
    // Shaggy "skirt" of dead fronds under the crown
    const top = curve.getPointAt(1);
    const skirt = new THREE.CylinderGeometry(0.24, 0.34, 0.6, 10, 1, true);
    skirt.translate(top.x, top.y - 0.35, top.z);
    trunkParts.push(skirt);
    const trunk = mergeGeometries(trunkParts.map((g) => g.toNonIndexed()));
    trunk.computeVertexNormals();

    // Crown of arching fronds
    const fronds: THREE.BufferGeometry[] = [];
    const frondCount = 11 + Math.floor(rand() * 4);
    for (let f = 0; f < frondCount; f++) {
      const length = 2.4 + rand() * 1.2;
      const frond = buildFrond(length, rand);
      // Upper fronds point up, lower ones droop
      frond.rotateX(0.45 - rand() * 0.85);
      frond.rotateY((f / frondCount) * Math.PI * 2 + rand() * 0.3);
      fronds.push(frond);
    }
    const crown = mergeGeometries(fronds);

    // Coconut cluster
    const nuts: THREE.BufferGeometry[] = [];
    const nutCount = 3 + Math.floor(rand() * 3);
    for (let n = 0; n < nutCount; n++) {
      const a = (n / nutCount) * Math.PI * 2;
      const nut = new THREE.SphereGeometry(0.11, 10, 8);
      nut.scale(1, 1.15, 1);
      nut.translate(Math.cos(a) * 0.17, -0.18 - rand() * 0.08, Math.sin(a) * 0.17);
      nuts.push(nut);
    }
    const coconuts = mergeGeometries(nuts);

    return { trunk, crown, coconuts, top };
  }
}

/**
 * One pinnate frond along -Z: the rachis arcs up then droops; leaflets alternate long/short
 * along both edges (saw-tooth), folded into a shallow V. Vertex colours shade base → tip.
 */
function buildFrond(length: number, rand: () => number): THREE.BufferGeometry {
  const segments = 26;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const base = new THREE.Color(0x2f6b2a);
  const tip = new THREE.Color(0x8bbf4a);
  const edge = new THREE.Color(0x4f8f33);
  const droop = 0.45 + rand() * 0.25;

  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const z = -s * length;
    const y = Math.sin(s * Math.PI * 0.55) * length * 0.22 - s * s * length * droop;

    // Leaflet width: widest mid-frond, saw-tooth for individual leaflets
    const envelope = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.1)), 0.7) * length * 0.2;
    const tooth = i % 2 === 0 ? 1 : 0.35;
    const w = s < 0.08 ? 0.02 : envelope * tooth;

    const c = base.clone().lerp(tip, s);
    const e = edge.clone().lerp(tip, s * 0.8);

    // centre, left, right (edges drop to fold the leaf into a V and sag at the tips)
    positions.push(0, y, z);
    positions.push(-w, y - w * 0.35, z + w * 0.25);
    positions.push(w, y - w * 0.35, z + w * 0.25);
    colors.push(c.r, c.g, c.b, e.r, e.g, e.b, e.r, e.g, e.b);

    if (i < segments) {
      const a = i * 3;
      const b = (i + 1) * 3;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
      indices.push(a, b, a + 2, a + 2, b, b + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Pleated fan leaf on a petiole, pointing outward along -Z. */
function buildFanLeaf(rand: () => number): THREE.BufferGeometry {
  const petiole = 0.9 + rand() * 0.4;
  const radius = 0.95 + rand() * 0.35;
  const spokes = 22;
  const span = Math.PI * 1.25;
  const positions: number[] = [];
  const colors: number[] = [];
  const base = new THREE.Color(0x3d6b2c);
  const tip = new THREE.Color(0x7aa54a);
  const dry = new THREE.Color(0xa89a5a);
  const centre = new THREE.Vector3(0, 0, -petiole);

  // Petiole as a thin flat strip
  const stem = [new THREE.Vector3(-0.025, 0, 0), new THREE.Vector3(0.025, 0, 0), new THREE.Vector3(0.02, 0, -petiole), new THREE.Vector3(-0.02, 0, -petiole)];
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
    for (const v of [stem[a], stem[b], stem[c]]) {
      positions.push(v.x, v.y, v.z);
      colors.push(base.r, base.g, base.b);
    }
  }

  const rim = (i: number, r: number) => {
    const a = -Math.PI / 2 - span / 2 + (i / spokes) * span;
    const pleat = i % 2 === 0 ? 0.07 : -0.05;
    const droop = r * r * 0.35;
    return new THREE.Vector3(centre.x + Math.cos(a) * r, centre.y + pleat * (r / radius) - droop, centre.z + Math.sin(a) * r);
  };
  const withered = rand() < 0.15;
  for (let i = 0; i < spokes; i++) {
    const r1 = radius * (0.92 + rand() * 0.16);
    const r2 = radius * (0.92 + rand() * 0.16);
    const a = rim(i, r1);
    const b = rim(i + 1, r2);
    const tipCol = withered ? dry : tip;
    for (const [v, c] of [[centre, base], [a, tipCol], [b, tipCol]] as [THREE.Vector3, THREE.Color][]) {
      positions.push(v.x, v.y, v.z);
      colors.push(c.r, c.g, c.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Shaggy brown skirt of dead fronds hanging below the crown. */
function buildSkirt(rand: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.42, 0.62, 2.4, 18, 6, true).toNonIndexed();
  geo.translate(0, -1.1, 0);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const light = new THREE.Color(0xb59a6e);
  const dark = new THREE.Color(0x6e5638);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const jitter = 1 + (rand() - 0.5) * 0.25;
    pos.setXYZ(i, x * jitter, y + (rand() - 0.5) * 0.12, z * jitter);
    c.copy(dark).lerp(light, rand() * 0.8);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute("uv");
  geo.computeVertexNormals();
  return geo;
}

/** Small deterministic PRNG so variants are stable between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
