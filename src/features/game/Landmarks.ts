import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakeStatic } from "../../lib/bakeStatic";
import { CaliforniaProps, tint } from "./CaliforniaProps";
import { SHORE_X } from "./Ocean";

const UP = new THREE.Vector3(0, 1, 0);

function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, radial = 6): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), radial, 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return tint(geo, color);
}

/**
 * Santa Monica-style amusement pier crossing the beach: the bike path runs underneath the
 * deck, and the seaward end carries a Ferris wheel with HDR light bulbs (they bloom),
 * upright-hanging gondolas, a roller coaster, lamps and arcade buildings.
 * It scrolls with the world and periodically re-appears far ahead.
 */
export class SantaMonicaPier {
  public group = new THREE.Group();

  private wheel = new THREE.Group();
  private gondolas: THREE.InstancedMesh;
  private wheelAngle = 0;
  private dummy = new THREE.Object3D();

  private readonly deckY = 10;
  private readonly hub = new THREE.Vector3(SHORE_X + 92, 10 + 13.5, -2);
  private readonly wheelRadius = 12;
  private readonly gondolaCount = 20;
  private readonly respawnSpan = 1400;

  constructor(props: CaliforniaProps, roadHalfWidth: number) {
    const x0 = -roadHalfWidth - 4;
    const x1 = SHORE_X + 190;
    const halfW = 8;
    const wood = 0x8b6a4e;
    const white = 0xf3efe6;
    const propsMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

    // --- Static structure (deck, beams, railings, lamps, buildings, coaster) ---
    const structure = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];
    const len = x1 - x0;
    parts.push(tint(new THREE.BoxGeometry(len, 0.7, halfW * 2).translate((x0 + x1) / 2, this.deckY - 0.35, 0), wood));
    for (const z of [-halfW + 0.4, 0, halfW - 0.4]) {
      parts.push(tint(new THREE.BoxGeometry(len, 0.6, 0.35).translate((x0 + x1) / 2, this.deckY - 1.0, z), 0x6b5038));
    }
    // Concrete abutment where the pier meets the inland bluff
    parts.push(tint(new THREE.BoxGeometry(2.5, this.deckY, halfW * 2 + 1).translate(x0 - 1.0, this.deckY / 2, 0), 0xd9d2c5));
    // Railings
    for (const z of [-halfW + 0.1, halfW - 0.1]) {
      parts.push(tint(new THREE.BoxGeometry(len, 0.08, 0.08).translate((x0 + x1) / 2, this.deckY + 1.05, z), white));
      for (let x = x0; x <= x1; x += 2.5) {
        parts.push(tint(new THREE.BoxGeometry(0.08, 1.05, 0.08).translate(x, this.deckY + 0.52, z), white));
      }
    }
    // Ferris-wheel A-frame supports
    for (const dz of [-1.6, 1.6]) {
      for (const dx of [-6, 6]) {
        parts.push(beam(new THREE.Vector3(this.hub.x + dx, this.deckY, this.hub.z + dz * 1.8), new THREE.Vector3(this.hub.x, this.hub.y, this.hub.z + dz), 0.22, white, 8));
      }
    }
    // Roller coaster: closed looping track on lattice posts
    const coasterPts: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      coasterPts.push(new THREE.Vector3(SHORE_X + 128 + Math.cos(a) * 16, this.deckY + 4 + Math.sin(a * 3) * 2.2 + Math.cos(a) * 1.5, Math.sin(a) * 5.5));
    }
    const coasterCurve = new THREE.CatmullRomCurve3(coasterPts, true);
    parts.push(tint(new THREE.TubeGeometry(coasterCurve, 200, 0.22, 6, true), 0xd62828));
    for (let i = 0; i < 24; i += 2) {
      const p = coasterCurve.getPointAt(i / 24);
      parts.push(beam(new THREE.Vector3(p.x, this.deckY, p.z), p, 0.09, 0xf2c94c));
    }
    structure.add(new THREE.Mesh(mergeGeometries(parts), propsMat));

    // Arcade / restaurant buildings near the seaward end
    for (let i = 0; i < 3; i++) {
      const b = props.building(9, 10, 1 + (i % 2));
      b.rotation.y = -Math.PI / 2;
      b.position.set(SHORE_X + 150 + i * 12, this.deckY, i % 2 ? 3 : -3);
      structure.add(b);
    }
    // Deck lamps
    for (let x = x0 + 6; x < x1; x += 14) {
      for (const z of [-halfW + 0.6, halfW - 0.6]) {
        const lamp = props.streetLamp();
        lamp.position.set(x, this.deckY, z);
        lamp.scale.setScalar(0.9);
        structure.add(lamp);
      }
    }
    structure.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    bakeStatic(structure, { recursive: true, vertexColorMaterial: propsMat });
    this.group.add(structure);

    // --- Pilings (instanced), leaving the bike path clear ---
    const pilingPositions: THREE.Vector3[] = [];
    for (let x = x0 + 2; x < x1; x += 7) {
      if (Math.abs(x) < roadHalfWidth + 2.5) continue;
      for (const z of [-halfW + 1, 0, halfW - 1]) pilingPositions.push(new THREE.Vector3(x, this.deckY / 2 - 1.2, z));
    }
    const pilings = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.32, 0.36, this.deckY + 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x6e5844, roughness: 0.9 }),
      pilingPositions.length
    );
    pilingPositions.forEach((p, i) => {
      this.dummy.position.copy(p);
      this.dummy.updateMatrix();
      pilings.setMatrixAt(i, this.dummy.matrix);
    });
    pilings.castShadow = true;
    pilings.receiveShadow = true;
    this.group.add(pilings);

    // --- Ferris wheel (rotating) ---
    this.wheel.position.copy(this.hub);
    const wheelParts: THREE.BufferGeometry[] = [];
    for (const dz of [-0.8, 0.8]) {
      wheelParts.push(tint(new THREE.TorusGeometry(this.wheelRadius, 0.14, 6, 64).translate(0, 0, dz), white));
      wheelParts.push(tint(new THREE.TorusGeometry(this.wheelRadius * 0.55, 0.08, 6, 48).translate(0, 0, dz), white));
    }
    for (let i = 0; i < this.gondolaCount; i++) {
      const a = (i / this.gondolaCount) * Math.PI * 2;
      const rim = new THREE.Vector3(Math.cos(a) * this.wheelRadius, Math.sin(a) * this.wheelRadius, 0);
      for (const dz of [-0.8, 0.8]) wheelParts.push(beam(new THREE.Vector3(0, 0, dz), rim.clone().setZ(dz), 0.05, white, 4));
      wheelParts.push(beam(rim.clone().setZ(-0.8), rim.clone().setZ(0.8), 0.06, white, 4));
    }
    wheelParts.push(tint(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 16).rotateX(Math.PI / 2), 0xcfcfcf));
    const wheelFrame = new THREE.Mesh(mergeGeometries(wheelParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }));
    wheelFrame.castShadow = true;
    this.wheel.add(wheelFrame);

    // HDR multicolour bulbs along both rims (values > 1 feed the bloom)
    const bulbGeos: THREE.BufferGeometry[] = [];
    const bulbColors = [0xff4d6d, 0xffd166, 0x4cc9f0, 0x80ffdb, 0xff9e00, 0xc77dff];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      for (const dz of [-0.95, 0.95]) {
        const b = new THREE.SphereGeometry(0.16, 6, 4).translate(Math.cos(a) * this.wheelRadius, Math.sin(a) * this.wheelRadius, dz);
        const g = tint(b, bulbColors[i % bulbColors.length]);
        const col = g.attributes.color as THREE.BufferAttribute;
        for (let k = 0; k < col.count; k++) col.setXYZ(k, col.getX(k) * 4, col.getY(k) * 4, col.getZ(k) * 4);
        bulbGeos.push(g);
      }
    }
    const bulbs = new THREE.Mesh(mergeGeometries(bulbGeos), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.wheel.add(bulbs);
    this.group.add(this.wheel);

    // Gondolas hang upright (instanced, positioned every frame)
    const gondolaGeo = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.7, 0.55, 1.1, 10).translate(0, -1.2, 0), 0xf94144),
      tint(new THREE.ConeGeometry(0.85, 0.45, 10).translate(0, -0.45, 0), white),
      tint(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4).translate(0, -0.2, 0), white),
    ]);
    this.gondolas = new THREE.InstancedMesh(gondolaGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), this.gondolaCount);
    const palette = [0xf94144, 0xf9c74f, 0x43aa8b, 0x577590, 0xf3722c];
    for (let i = 0; i < this.gondolaCount; i++) this.gondolas.setColorAt(i, new THREE.Color(palette[i % palette.length]).multiplyScalar(1.6));
    this.gondolas.castShadow = true;
    this.gondolas.frustumCulled = false;
    this.group.add(this.gondolas);

    this.group.position.z = -380;
  }

  public update(distance: number, delta: number): void {
    this.group.position.z += distance;
    if (this.group.position.z > 160) this.group.position.z -= this.respawnSpan;

    this.wheelAngle += delta * 0.12;
    this.wheel.rotation.z = this.wheelAngle;
    for (let i = 0; i < this.gondolaCount; i++) {
      const a = (i / this.gondolaCount) * Math.PI * 2 + this.wheelAngle;
      this.dummy.position.set(this.hub.x + Math.cos(a) * this.wheelRadius, this.hub.y + Math.sin(a) * this.wheelRadius, this.hub.z);
      this.dummy.rotation.set(0, 0, Math.sin(this.wheelAngle * 3 + i) * 0.04);
      this.dummy.updateMatrix();
      this.gondolas.setMatrixAt(i, this.dummy.matrix);
    }
    this.gondolas.instanceMatrix.needsUpdate = true;
  }
}
