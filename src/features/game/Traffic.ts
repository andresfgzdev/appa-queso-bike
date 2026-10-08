import * as THREE from "three";
import { createCarGeometry } from "./CaliforniaProps";

interface Car {
  lane: number; // index into lanes
  z: number;
  speed: number; // m/s along the lane direction
  van: boolean;
  slot: number; // instance index in its mesh
}

const PAINT = [0xf1faee, 0x1d3557, 0xe63946, 0x8d99ae, 0x2a9d8f, 0xffd166, 0x2b2d42, 0xc0c0c0, 0x457b9d, 0xf4a261, 0x6a994e];

/**
 * Two-lane beach-city street traffic (instanced: sedans + vans = 2 draw calls).
 * One lane drives with the rider (-Z), the other is oncoming (+Z). Cars keep a safe gap
 * to the car ahead, and recycle when they leave the visible stretch.
 */
export class Traffic {
  public group = new THREE.Group();
  private sedans: THREE.InstancedMesh;
  private vans: THREE.InstancedMesh;
  private cars: Car[] = [];
  private dummy = new THREE.Object3D();
  private readonly near = 70;
  private readonly far = -330;

  /** @param lanes lane centre X and travel direction (-1 = away from camera, +1 = oncoming) */
  constructor(private lanes: { x: number; dir: number }[]) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
    const perLane = 6;
    const vanCount = 3;
    const sedanCount = lanes.length * perLane - vanCount;
    this.sedans = new THREE.InstancedMesh(createCarGeometry("sedan", 0xffffff), mat, sedanCount);
    this.vans = new THREE.InstancedMesh(createCarGeometry("van", 0xffffff), mat, vanCount);

    let sedanSlot = 0;
    let vanSlot = 0;
    lanes.forEach((_, lane) => {
      for (let i = 0; i < perLane; i++) {
        const van = vanSlot < vanCount && (i + lane) % 4 === 1;
        const car: Car = {
          lane,
          z: this.far + ((i + Math.random() * 0.6) / perLane) * (this.near - this.far),
          speed: 7 + Math.random() * 6,
          van,
          slot: van ? vanSlot++ : sedanSlot++,
        };
        const mesh = van ? this.vans : this.sedans;
        mesh.setColorAt(car.slot, new THREE.Color(PAINT[Math.floor(Math.random() * PAINT.length)]));
        this.cars.push(car);
      }
    });
    this.sedans.count = sedanSlot;
    this.vans.count = vanSlot;

    for (const m of [this.sedans, this.vans]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  public update(groundDistance: number, delta: number): void {
    // Sort per lane so each car can respect the gap to the one ahead
    for (let lane = 0; lane < this.lanes.length; lane++) {
      const { x, dir } = this.lanes[lane];
      const laneCars = this.cars.filter((c) => c.lane === lane).sort((a, b) => (dir < 0 ? a.z - b.z : b.z - a.z));

      laneCars.forEach((car, i) => {
        const ahead = laneCars[i - 1];
        let v = car.speed;
        if (ahead) {
          const gap = Math.abs(ahead.z - car.z);
          if (gap < 12) v = Math.min(v, ahead.speed * (gap / 12));
        }
        // World scroll (+Z) plus the car's own motion along its lane
        car.z += groundDistance + dir * v * delta;

        if (car.z > this.near) {
          car.z = this.far + Math.random() * 30;
        } else if (car.z < this.far - 40) {
          car.z = this.near - Math.random() * 20;
        }

        this.dummy.position.set(x, 0, car.z);
        this.dummy.rotation.set(0, dir < 0 ? 0 : Math.PI, 0);
        this.dummy.updateMatrix();
        (car.van ? this.vans : this.sedans).setMatrixAt(car.slot, this.dummy.matrix);
      });
    }
    this.sedans.instanceMatrix.needsUpdate = true;
    this.vans.instanceMatrix.needsUpdate = true;
  }
}
