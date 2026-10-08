import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tint } from "./CaliforniaProps";
import { SHORE_X } from "./Ocean";

/**
 * Ambient coastal life, all instanced:
 * - Brown pelicans gliding in a line over the surf, flapping in a ripple down the line.
 * - Sailboats bobbing on the horizon.
 * - Kites dancing above the sand with their strings to the beach.
 */
export class SkyLife {
  public group = new THREE.Group();
  private dummy = new THREE.Object3D();
  private time = 0;

  // Pelicans
  private pelicanBodies: THREE.InstancedMesh;
  private pelicanWings: THREE.InstancedMesh;
  private flock = { x: 34, y: 5, z: -160 };
  private readonly flockSize = 6;

  // Sailboats
  private boats: THREE.InstancedMesh;
  private boatState: { x: number; z: number; phase: number; heading: number }[] = [];

  // Kites
  private kites: THREE.InstancedMesh;
  private kiteState: { x: number; y: number; z: number; phase: number }[] = [];
  private strings: THREE.LineSegments;

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });

    // --- Pelicans ---
    const { body, wing } = createPelicanGeometries();
    this.pelicanBodies = new THREE.InstancedMesh(body, mat, this.flockSize);
    this.pelicanWings = new THREE.InstancedMesh(wing, mat, this.flockSize * 2);

    // --- Sailboats ---
    this.boats = new THREE.InstancedMesh(createSailboatGeometry(), mat, 5);
    for (let i = 0; i < 5; i++) {
      this.boatState.push({ x: SHORE_X + 70 + Math.random() * 90, z: -60 - i * 90 - Math.random() * 40, phase: Math.random() * 10, heading: (Math.random() - 0.5) * 1.2 });
    }

    // --- Kites ---
    this.kites = new THREE.InstancedMesh(createKiteGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }), 3);
    const kiteColors = [0xff006e, 0x3a86ff, 0xffbe0b];
    for (let i = 0; i < 3; i++) {
      this.kiteState.push({ x: 9 + Math.random() * 10, y: 13 + Math.random() * 6, z: -40 - i * 70, phase: Math.random() * 10 });
      this.kites.setColorAt(i, new THREE.Color(kiteColors[i]));
    }
    this.strings = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 2 * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
    );

    for (const m of [this.pelicanBodies, this.pelicanWings, this.boats, this.kites]) {
      m.frustumCulled = false;
      m.castShadow = false;
    }
    this.strings.frustumCulled = false;
    this.group.add(this.pelicanBodies, this.pelicanWings, this.boats, this.kites, this.strings);
  }

  public update(distance: number, delta: number): void {
    this.time += delta;
    this.updatePelicans(distance, delta);
    this.updateBoats(distance);
    this.updateKites(distance);
  }

  private updatePelicans(distance: number, delta: number): void {
    // Flying up the coast toward the rider (relative speed = ground + air speed)
    this.flock.z += distance + delta * 9;
    if (this.flock.z > 40) {
      this.flock.z = -260 - Math.random() * 120;
      this.flock.x = SHORE_X + 6 + Math.random() * 24;
      this.flock.y = 3.5 + Math.random() * 4;
    }

    for (let i = 0; i < this.flockSize; i++) {
      // Echelon line: each bird a little behind and to the side of the one ahead
      const px = this.flock.x + i * 0.9 + Math.sin(this.time * 0.6 + i) * 0.2;
      const py = this.flock.y + Math.sin(this.time * 0.8 + i * 0.7) * 0.25;
      const pz = this.flock.z - i * 3.2;
      // Ripple of flaps travelling down the line, then a long glide
      const cycle = (this.time * 0.5 - i * 0.12) % 3.0;
      const flapping = cycle < 0.9;
      const flap = flapping ? Math.sin(cycle * Math.PI * 2 * 1.6) * 0.5 : -0.06;

      this.dummy.position.set(px, py, pz);
      this.dummy.rotation.set(0, Math.PI, 0); // face +Z (flying toward camera)
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.pelicanBodies.setMatrixAt(i, this.dummy.matrix);

      for (const side of [-1, 1]) {
        this.dummy.rotation.set(0, Math.PI, side * flap);
        this.dummy.scale.set(side, 1, 1);
        this.dummy.updateMatrix();
        this.pelicanWings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), this.dummy.matrix);
      }
    }
    this.pelicanBodies.instanceMatrix.needsUpdate = true;
    this.pelicanWings.instanceMatrix.needsUpdate = true;
  }

  private updateBoats(distance: number): void {
    this.boatState.forEach((b, i) => {
      b.z += distance;
      if (b.z > 80) {
        b.z -= 480;
        b.x = SHORE_X + 70 + Math.random() * 90;
      }
      this.dummy.position.set(b.x, Math.sin(this.time * 0.9 + b.phase) * 0.15, b.z);
      this.dummy.rotation.set(Math.sin(this.time * 0.7 + b.phase) * 0.05, b.heading, Math.sin(this.time * 0.6 + b.phase) * 0.08);
      this.dummy.scale.setScalar(1.6);
      this.dummy.updateMatrix();
      this.boats.setMatrixAt(i, this.dummy.matrix);
    });
    this.boats.instanceMatrix.needsUpdate = true;
  }

  private updateKites(distance: number): void {
    const strings = this.strings.geometry.attributes.position as THREE.BufferAttribute;
    this.kiteState.forEach((k, i) => {
      k.z += distance;
      if (k.z > 40) {
        k.z -= 230;
        k.x = 9 + Math.random() * 10;
      }
      const sway = Math.sin(this.time * 0.9 + k.phase);
      const kx = k.x + sway * 1.2;
      const ky = k.y + Math.sin(this.time * 1.3 + k.phase) * 0.6;
      this.dummy.position.set(kx, ky, k.z);
      this.dummy.rotation.set(-0.5, 0.3 * sway, sway * 0.35);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.kites.setMatrixAt(i, this.dummy.matrix);
      // String down to a flyer standing on the sand
      strings.setXYZ(i * 2, kx, ky - 0.3, k.z);
      strings.setXYZ(i * 2 + 1, k.x + 6, 0.9, k.z + 14);
    });
    this.kites.instanceMatrix.needsUpdate = true;
    strings.needsUpdate = true;
  }
}

function createPelicanGeometries(): { body: THREE.BufferGeometry; wing: THREE.BufferGeometry } {
  const brown = 0x7a6a5a;
  const pale = 0xe8dcc4;
  const beakCol = 0xc9a26b;
  const torso = new THREE.SphereGeometry(0.22, 12, 8).scale(0.85, 0.75, 2.3);
  const neck = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8).rotateX(Math.PI / 2 - 0.4).translate(0, 0.08, -0.55);
  const head = new THREE.SphereGeometry(0.09, 10, 8).translate(0, 0.15, -0.72);
  const beak = new THREE.ConeGeometry(0.05, 0.55, 6).rotateX(-Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.1, -1.02);
  const tail = new THREE.ConeGeometry(0.12, 0.3, 4).rotateX(Math.PI / 2).scale(1.3, 0.3, 1).translate(0, 0, 0.55);
  const body = mergeGeometries([tint(torso, brown), tint(neck, pale), tint(head, pale), tint(beak, beakCol), tint(tail, brown)]);

  // Long, broad wing with dark primaries
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.22);
  shape.lineTo(0.6, -0.26);
  shape.lineTo(1.15, -0.12);
  shape.lineTo(1.3, 0.05);
  shape.lineTo(1.05, 0.16);
  shape.lineTo(0.45, 0.2);
  shape.lineTo(0, 0.2);
  const wing = tint(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), brown);
  const pos = wing.attributes.position;
  const col = wing.attributes.color;
  const dark = new THREE.Color(0x2e2822);
  for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0.95) col.setXYZ(i, dark.r, dark.g, dark.b);
  wing.translate(0.08, 0.05, 0);
  wing.computeVertexNormals();
  return { body, wing };
}

function createSailboatGeometry(): THREE.BufferGeometry {
  const hull = new THREE.BoxGeometry(0.9, 0.45, 3.2);
  const hp = hull.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    // Taper the bow and narrow the keel
    const z = hp.getZ(i);
    const y = hp.getY(i);
    const bow = z < 0 ? 1 - Math.min(1, -z / 1.6) * 0.85 : 1;
    hp.setX(i, hp.getX(i) * bow * (y < 0 ? 0.6 : 1));
  }
  hull.computeVertexNormals();
  hull.translate(0, 0.2, 0);
  const mast = new THREE.CylinderGeometry(0.035, 0.035, 4.6, 6).translate(0, 2.7, -0.2);
  const sail = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.7, -0.15), new THREE.Vector3(0, 4.9, -0.2), new THREE.Vector3(0, 0.75, 1.35),
    new THREE.Vector3(0, 0.75, -0.3), new THREE.Vector3(0, 3.9, -0.3), new THREE.Vector3(0, 0.7, -1.4),
  ]);
  sail.computeVertexNormals();
  return mergeGeometries([tint(hull, 0xf7f7f2), tint(mast, 0xdadada), tint(sail, 0xfffaf0)]);
}

function createKiteGeometry(): THREE.BufferGeometry {
  const diamond = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(-0.55, 0.15, 0), new THREE.Vector3(0, -0.6, 0),
    new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0.55, 0.15, 0),
  ]);
  diamond.computeVertexNormals();
  const tailParts: THREE.BufferGeometry[] = [tint(diamond, 0xffffff)];
  for (let i = 0; i < 6; i++) {
    const bow = new THREE.PlaneGeometry(0.22, 0.08).translate(Math.sin(i * 1.3) * 0.12, -0.75 - i * 0.28, 0);
    tailParts.push(tint(bow, i % 2 ? 0xffffff : 0xf1f1f1));
  }
  return mergeGeometries(tailParts);
}
