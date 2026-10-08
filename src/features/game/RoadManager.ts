import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakeStatic } from "../../lib/bakeStatic";
import { CaliforniaProps } from "./CaliforniaProps";
import { SantaMonicaPier } from "./Landmarks";
import { Ocean, SHORE_X } from "./Ocean";
import { PalmTreeFactory } from "./PalmTreeFactory";
import { createAsphaltTexture, createConcreteTexture, createSandTexture } from "./proceduralTextures";
import { SkyLife } from "./SkyLife";
import { Traffic } from "./Traffic";
import { RoadChunkData } from "./types";

interface Seagull {
  x: number;
  y: number;
  z: number;
  speed: number;
  wingPhase: number;
  bank: number;
}

/**
 * Coastal boardwalk treadmill.
 * - Chunks recycle from behind the camera to the horizon (bike stays near z = 0).
 * - Each chunk is authored as normal meshes, then baked into ~5 draw calls by material.
 * - Ocean and sky are global surfaces; seagulls are instanced (2 draw calls total).
 */
export class RoadManager {
  public chunks: RoadChunkData[] = [];
  public group = new THREE.Group();
  public distanceTravelled = 0;

  private chunkLength = 40;
  private numChunks = 7;
  private roadWidth = 9.5;
  private despawnZ = 50;
  private time = 0;

  private ocean = new Ocean();
  private palms = new PalmTreeFactory();
  private props = new CaliforniaProps();
  private pier: SantaMonicaPier;
  private skyLife = new SkyLife();
  private lawnGeo: THREE.PlaneGeometry;
  private streetGeo: THREE.PlaneGeometry;
  private asphaltMat: THREE.MeshStandardMaterial;
  private traffic: Traffic;
  private benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5236 });
  private benchLegMat = new THREE.MeshStandardMaterial({ color: 0x3b3f45 });

  // Shared materials
  private propsMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  private sandMat: THREE.MeshStandardMaterial;
  private roadMat: THREE.MeshStandardMaterial;
  private stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  private canopyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });

  // Shared geometries
  private roadGeo: THREE.PlaneGeometry;
  private sandGeoRight: THREE.PlaneGeometry;
  private sandRightWidth = 0;
  private farGround: THREE.Mesh;
  private farGroundTexture: THREE.Texture;
  private stripeGeo = new THREE.PlaneGeometry(0.12, 3).rotateX(-Math.PI / 2);
  private curbGeo: THREE.BoxGeometry;
  private canopyGeos: THREE.BufferGeometry[];
  private grassGeo: THREE.BufferGeometry;

  // Seagulls (instanced)
  private seagulls: Seagull[] = [];
  private gullBodies: THREE.InstancedMesh;
  private gullWings: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor() {
    // Ground materials with tiling procedural textures
    const sand = createSandTexture();
    sand.map.repeat.set(35 / 8, this.chunkLength / 8);
    sand.bump.repeat.copy(sand.map.repeat);
    this.sandMat = new THREE.MeshStandardMaterial({ map: sand.map, bumpMap: sand.bump, bumpScale: 1.2, roughness: 0.97 });

    const concrete = createConcreteTexture();
    concrete.map.repeat.set(this.roadWidth / 3.2, this.chunkLength / 4);
    concrete.bump.repeat.copy(concrete.map.repeat);
    this.roadMat = new THREE.MeshStandardMaterial({ map: concrete.map, bumpMap: concrete.bump, bumpScale: 0.8, roughness: 0.88 });

    this.roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.chunkLength).rotateX(-Math.PI / 2);
    this.sandRightWidth = SHORE_X + 4.5 - (this.roadWidth / 2 + 0.35);
    this.sandGeoRight = new THREE.PlaneGeometry(this.sandRightWidth, this.chunkLength).rotateX(-Math.PI / 2);
    this.lawnGeo = new THREE.PlaneGeometry(8, this.chunkLength).rotateX(-Math.PI / 2);
    this.props.lawnMat.map!.repeat.set(8 / 5, this.chunkLength / 5);
    this.streetGeo = new THREE.PlaneGeometry(12, this.chunkLength).rotateX(-Math.PI / 2);
    const asphalt = createAsphaltTexture();
    asphalt.map.repeat.set(12 / 6, this.chunkLength / 6);
    asphalt.bump.repeat.copy(asphalt.map.repeat);
    this.asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt.map, bumpMap: asphalt.bump, bumpScale: 0.6, roughness: 0.92 });
    const e = this.roadWidth / 2;
    this.traffic = new Traffic([
      { x: -e - 17.6, dir: -1 },
      { x: -e - 21.1, dir: 1 },
    ]);
    this.curbGeo = new THREE.BoxGeometry(0.35, 0.14, this.chunkLength);
    this.canopyGeos = [0xff4d6d, 0xffb703, 0x06d6a0, 0x118ab2].map((c) => createStripedCanopy(new THREE.Color(c)));
    this.grassGeo = createGrassTuft();

    this.group.add(this.ocean.mesh);

    // Endless inland ground under/behind the chunks (texture scrolls with distance)
    this.farGroundTexture = sand.map.clone();
    this.farGroundTexture.repeat.set(60, 60);
    const farMat = new THREE.MeshStandardMaterial({ map: this.farGroundTexture, color: 0xc9bfae, roughness: 1 });
    this.farGround = new THREE.Mesh(new THREE.PlaneGeometry(480, 480).rotateX(-Math.PI / 2), farMat);
    this.farGround.position.set(-240 + SHORE_X, -0.12, -200);
    this.farGround.receiveShadow = true;
    this.group.add(this.farGround);

    const gulls = createSeagullGeometries();
    const gullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    const numGulls = 7;
    this.gullBodies = new THREE.InstancedMesh(gulls.body, gullMat, numGulls);
    this.gullWings = new THREE.InstancedMesh(gulls.wing, gullMat, numGulls * 2);
    this.gullBodies.frustumCulled = this.gullWings.frustumCulled = false;
    this.group.add(this.gullBodies, this.gullWings);
    for (let s = 0; s < numGulls; s++) {
      this.seagulls.push({
        x: 8 + Math.random() * 30,
        y: 6 + Math.random() * 7,
        z: -20 - s * 22 - Math.random() * 10,
        speed: 0.2 + Math.random() * 0.25,
        wingPhase: Math.random() * Math.PI * 2,
        bank: (Math.random() - 0.5) * 0.3,
      });
    }

    this.pier = new SantaMonicaPier(this.props, this.roadWidth / 2);
    this.group.add(this.pier.group, this.skyLife.group, this.traffic.group);

    this.initChunks();
  }

  private bench(): THREE.Group {
    const bench = new THREE.Group();
    for (let slat = 0; slat < 3; slat++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 1.7), this.benchMat);
      seat.position.set(-0.18 + slat * 0.18, 0.45, 0);
      bench.add(seat);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 1.7), this.benchMat);
    back.position.set(-0.3, 0.72, 0);
    back.rotation.z = 0.15;
    bench.add(back);
    for (const lz of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), this.benchLegMat);
      leg.position.set(-0.05, 0.22, lz);
      bench.add(leg);
    }
    return bench;
  }

  private initChunks(): void {
    const startZ = -this.chunkLength * (this.numChunks - 3);
    for (let i = 0; i < this.numChunks; i++) {
      const zPos = startZ + i * this.chunkLength;
      const chunkMesh = this.createChunk(i);
      chunkMesh.position.z = zPos;
      this.group.add(chunkMesh);
      this.chunks.push({ mesh: chunkMesh, z: zPos, length: this.chunkLength });
    }
  }

  private createChunk(chunkIndex: number): THREE.Group {
    const chunk = new THREE.Group();
    const half = this.chunkLength / 2;
    const edge = this.roadWidth / 2;
    const P = this.props;
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

    const add = (obj: THREE.Object3D, x: number, y: number, z: number, cast = false) => {
      obj.position.set(x, y, z);
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          if (cast) o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      chunk.add(obj);
      return obj;
    };
    const plain = (geo: THREE.BufferGeometry, color: number) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));

    // Simple occupancy map so randomly scattered props don't overlap
    const taken: { x: number; z: number; r: number }[] = [];
    const spot = (r: number, x0: number, x1: number, z0 = -half + r, z1 = half - r): { x: number; z: number } | null => {
      for (let tries = 0; tries < 10; tries++) {
        const x = rand(x0, x1);
        const z = rand(z0, z1);
        if (taken.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > (t.r + r) ** 2)) {
          taken.push({ x, z, r });
          return { x, z };
        }
      }
      return null;
    };
    const reserve = (x: number, z: number, r: number) => taken.push({ x, z, r });

    // ======================= GROUND STRIPS (beach → town) =======================
    // Beach sand | bike path | planter | park lawn | sidewalk | parking | street | parking | sidewalk | buildings
    add(new THREE.Mesh(this.sandGeoRight, this.sandMat), edge + 0.35 + this.sandRightWidth / 2, -0.08, 0);
    add(new THREE.Mesh(this.roadGeo, this.roadMat), 0, 0, 0);
    add(plain(new THREE.BoxGeometry(3, 0.16, this.chunkLength), 0x6e5340), -edge - 1.85, -0.02, 0); // mulch planter
    add(new THREE.Mesh(this.lawnGeo, P.lawnMat), -edge - 7.35, -0.04, 0);
    add(plain(new THREE.BoxGeometry(2, 0.14, this.chunkLength), 0xd9d2c6), -edge - 12.35, 0.0, 0); // sidewalk A
    add(new THREE.Mesh(this.streetGeo, this.asphaltMat), -edge - 19.35, -0.02, 0); // parking + 2 lanes + parking
    add(plain(new THREE.BoxGeometry(4, 0.14, this.chunkLength), 0xd9d2c6), -edge - 27.35, 0.0, 0); // sidewalk B

    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd8c8b4 });
    add(new THREE.Mesh(this.curbGeo, curbMat), -edge - 0.17, 0.05, 0);
    add(new THREE.Mesh(this.curbGeo, curbMat), edge + 0.17, 0.05, 0);
    add(plain(new THREE.BoxGeometry(0.3, 0.3, this.chunkLength), 0xcfc6b8), -edge - 3.35, 0.1, 0); // lawn edging
    add(plain(new THREE.BoxGeometry(0.25, 0.2, this.chunkLength), 0xbdb6aa), -edge - 13.35, 0.06, 0); // street curbs
    add(plain(new THREE.BoxGeometry(0.25, 0.2, this.chunkLength), 0xbdb6aa), -edge - 25.35, 0.06, 0);

    // Road markings: bike-path dashes, street double-yellow, parking lane lines
    for (let s = 0; s < 5; s++) add(new THREE.Mesh(this.stripeGeo, this.stripeMat), 0, 0.012, -half + s * 8 + 4);
    for (const dx of [-0.12, 0.12]) add(plain(new THREE.BoxGeometry(0.1, 0.01, this.chunkLength), 0xf2c230), -edge - 19.35 + dx, 0.0, 0);
    for (const x of [-edge - 15.85, -edge - 22.85]) add(plain(new THREE.BoxGeometry(0.1, 0.01, this.chunkLength), 0xf2f2f2), x, 0.0, 0);

    // ======================= PLANTER STRIP (path edge) =======================
    for (let i = 0; i < 3; i++) add(P.streetLamp(), -edge - 0.9, 0, -half + 6.7 + i * 13.3, true);
    for (let p = 0; p < 2; p++) {
      const z = -half + 10 + p * 20 + rand(-2, 2);
      add(this.palms.create(), -edge - 2.3 + rand(-0.2, 0.2), 0, z, true);
      add(this.bench(), -edge - 1.5, 0, z + 4, true);
    }
    for (let i = 0; i < 4; i++) {
      const z = -half + 3 + i * 10 + rand(-1.5, 1.5);
      add(Math.random() < 0.65 ? P.bougainvillea() : P.agave(), -edge - 2.2 + rand(-0.4, 0.4), 0.05, z, true);
    }
    if (chunkIndex % 2 === 0) {
      const rack = P.bikeRack();
      add(rack, -edge - 1.6, 0.06, rand(-6, 6), true);
    }

    // ======================= PARK LAWN =======================
    for (let p = 0; p < 3; p++) {
      add(this.palms.createFanPalm(), rand(-edge - 10.2, -edge - 5.5), 0, -half + (p + rand(0.2, 0.8)) * (this.chunkLength / 3), true);
    }
    for (let i = 0; i < 2; i++) {
      const bed = P.flowerBed(rand(2.5, 4), rand(1, 1.6));
      add(bed, rand(-edge - 10, -edge - 5), -0.02, -half + 8 + i * 20 + rand(-3, 3));
    }
    for (let i = 0; i < 3; i++) add(P.bougainvillea(), -edge - 10.6, 0, -half + 6 + i * 13 + rand(-2, 2), true);
    if (Math.random() < 0.6) {
      const picnic = P.picnic();
      picnic.rotation.y = rand(0, Math.PI);
      add(picnic, rand(-edge - 9, -edge - 5), -0.02, rand(-half + 4, half - 4));
    }

    // ======================= STREET: parked cars both sides =======================
    for (const [x, flip] of [[-edge - 14.6, false], [-edge - 24.1, true]] as [number, boolean][]) {
      let z = -half + rand(1, 4);
      while (z < half - 3) {
        if (Math.random() < 0.78) {
          const car = P.car();
          car.rotation.y = flip ? Math.PI : 0;
          car.scale.setScalar(1.15);
          add(car, x, 0, z + 2.6, true);
        }
        z += rand(6.2, 7.5);
      }
    }

    // ======================= TOWN SIDEWALK =======================
    for (let i = 0; i < 4; i++) add(P.streetTree(), -edge - 26.1, 0.07, -half + 5 + i * 10, true);
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.7) add(P.cafeTable(), -edge - 28.4, 0.07, -half + 9 + i * 11 + rand(-2, 2), true);
    }

    // Beach-front buildings
    let bz = -half + rand(0, 2);
    while (bz < half - 6) {
      const w = rand(7, 11);
      if (bz + w > half) break;
      const depth = rand(10, 13);
      const floors = Math.random() < 0.2 ? 1 : 2 + Math.floor(Math.random() * 3);
      add(P.building(w, depth, floors), -edge - 29.6 - depth / 2, 0, bz + w / 2, true);
      bz += w + rand(0.6, 2.5);
    }

    // ======================= BEACH =======================
    add(P.trashCan(), edge + 1.0, 0, rand(-half, half), true);
    if (chunkIndex % 2 === 1) add(P.showerPost(), edge + 1.9, -0.06, rand(-half + 4, half - 4), true);
    if (chunkIndex % 2 === 1) add(P.bikeRack(), edge + 1.4, -0.06, rand(-half + 4, half - 4), true);

    // Fixed features first so the scatter avoids them
    if (chunkIndex % 3 === 1) {
      const z = rand(-10, 10);
      const tower = P.lifeguardTower();
      tower.rotation.y = Math.PI / 2 + rand(-0.2, 0.2);
      add(tower, SHORE_X - 6, 0, z, true);
      reserve(SHORE_X - 6, z, 3.5);
    }
    if (chunkIndex % 4 === 2) {
      const z = rand(-12, 12);
      const shack = P.surfShack();
      shack.rotation.y = Math.PI;
      add(shack, edge + 8, -0.06, z, true);
      reserve(edge + 8, z, 3.5);
    }
    {
      const z = rand(-10, 10);
      const net = P.volleyballNet();
      add(net, edge + 12, 0, z, true);
      reserve(edge + 12, z, 7);
    }

    // Umbrella clusters with towels, chairs, coolers, balls
    for (let u = 0; u < 4; u++) {
      const at = spot(2.2, edge + 4.5, SHORE_X - 3);
      if (!at) continue;
      const tilt = rand(-0.1, 0.1);
      const pole = plain(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), 0xe6e6e6);
      pole.rotation.z = tilt;
      add(pole, at.x, 1.1, at.z, true);
      const canopy = new THREE.Mesh(this.canopyGeos[Math.floor(Math.random() * this.canopyGeos.length)], this.canopyMat);
      canopy.rotation.set(0, Math.random() * Math.PI, tilt);
      add(canopy, at.x - Math.sin(tilt) * 1.1, 2.15, at.z, true);

      const towel = plain(new THREE.BoxGeometry(0.95, 0.015, 1.8), [0xf72585, 0x4cc9f0, 0xffb703, 0xffffff, 0x06d6a0][(u + chunkIndex) % 5]);
      towel.rotation.y = rand(0, Math.PI);
      add(towel, at.x + 1.3, -0.065, at.z + 0.4);
      const chair = P.beachChair();
      chair.rotation.y = rand(-0.6, 0.6) - Math.PI / 2;
      add(chair, at.x - 1.2, -0.06, at.z + rand(-1, 1), true);
      if (Math.random() < 0.5) add(P.cooler(), at.x + 0.4, -0.06, at.z - 1.1, true);
      if (Math.random() < 0.3) add(P.beachBall(), at.x + rand(1.5, 2.5), -0.06, at.z + rand(-1.5, 1.5), true);
    }

    // Pop-up canopies, surfboards, fire rings, sandcastles, dunes
    {
      const at = spot(2.4, edge + 6, SHORE_X - 4);
      if (at) {
        const tent = P.popUpTent();
        tent.rotation.y = rand(0, Math.PI / 2);
        add(tent, at.x, -0.06, at.z, true);
        const chair = P.beachChair();
        chair.rotation.y = -Math.PI / 2;
        add(chair, at.x + 0.6, -0.06, at.z, true);
      }
    }
    {
      const at = spot(1.2, edge + 3, edge + 9);
      if (at) add(P.surfboards(), at.x, -0.1, at.z, true);
    }
    if (chunkIndex % 2 === 0) {
      for (let i = 0; i < 3; i++) {
        const at = spot(1.0, edge + 14, edge + 17, -half + 4 + i * 12, -half + 8 + i * 12);
        if (at) add(P.fireRing(), at.x, -0.07, at.z, true);
      }
    }
    if (Math.random() < 0.6) {
      const at = spot(1.4, SHORE_X - 4.5, SHORE_X - 1.5);
      if (at) add(P.sandCastle(), at.x, -0.08, at.z, true);
    }
    for (let i = 0; i < 2; i++) {
      const at = spot(2.5, edge + 2.2, edge + 4.5);
      if (at) add(P.duneMound(), at.x, -0.08, at.z);
    }

    // Dune grass along the path edge
    for (let g = 0; g < 9; g++) {
      const grass = new THREE.Mesh(this.grassGeo, new THREE.MeshStandardMaterial({ color: 0x8aa65a }));
      grass.rotation.y = Math.random() * Math.PI;
      grass.scale.setScalar(rand(0.7, 1.4));
      add(grass, edge + 0.8 + Math.random() * 1.6, -0.08, -half + Math.random() * this.chunkLength);
    }

    // Collapse everything into a handful of draw calls
    bakeStatic(chunk, { recursive: true, vertexColorMaterial: this.propsMat });
    return chunk;
  }

  public update(speed: number, delta: number): void {
    const distance = speed * delta;
    this.time += delta;
    this.distanceTravelled += distance;

    // 1. Treadmill: move chunks toward the camera and recycle them to the horizon
    let frontZ = Infinity;
    for (const chunk of this.chunks) {
      chunk.mesh.position.z += distance;
      chunk.z = chunk.mesh.position.z;
      frontZ = Math.min(frontZ, chunk.z);
    }
    for (const chunk of this.chunks) {
      if (chunk.z > this.despawnZ) {
        frontZ -= this.chunkLength;
        chunk.mesh.position.z = frontZ;
        chunk.z = frontZ;
      }
    }

    // Inland ground texture scrolls at ground speed (one texture tile = 480 / 60 m)
    this.farGroundTexture.offset.y = (this.distanceTravelled / (480 / 60)) % 1;

    // Landmarks & coastal life
    this.pier.update(distance, delta);
    this.skyLife.update(distance, delta);
    this.traffic.update(distance, delta);

    // 2. Ocean waves / foam scroll with distance
    this.ocean.update(this.time, this.distanceTravelled);

    // 3. Seagulls glide (slower than the ground: parallax) and flap
    this.seagulls.forEach((bird, i) => {
      bird.wingPhase += delta * (3.2 + bird.speed * 4);
      bird.z += distance * bird.speed;
      if (bird.z > 20) {
        bird.z = -160 - Math.random() * 40;
        bird.x = 8 + Math.random() * 30;
      }
      const bob = Math.sin(bird.wingPhase * 0.5) * 0.15;
      const flap = Math.sin(bird.wingPhase);

      this.dummy.position.set(bird.x, bird.y + bob, bird.z);
      this.dummy.rotation.set(0, 0, bird.bank + Math.sin(this.time * 0.4 + i) * 0.1);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.gullBodies.setMatrixAt(i, this.dummy.matrix);

      for (const side of [-1, 1]) {
        this.dummy.rotation.set(0, 0, bird.bank + side * flap * 0.55);
        this.dummy.scale.set(side, 1, 1);
        this.dummy.updateMatrix();
        this.gullWings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), this.dummy.matrix);
      }
    });
    this.gullBodies.instanceMatrix.needsUpdate = true;
    this.gullWings.instanceMatrix.needsUpdate = true;
  }
}

// -----------------------------------------------------------------------------
// Prop geometry builders
// -----------------------------------------------------------------------------

function colorize(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  return g;
}

/** Beach umbrella canopy with alternating white / colour panels and a little finial. */
function createStripedCanopy(color: THREE.Color): THREE.BufferGeometry {
  const panels = 12;
  const geo = new THREE.ConeGeometry(1.45, 0.6, panels, 1, true).toNonIndexed();
  const white = new THREE.Color(0xfaf6ee);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < count; i += 3) {
    // Panel index from the triangle's centroid angle
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const panel = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * panels);
    const c = panel % 2 === 0 ? color : white;
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute("uv");
  geo.computeVertexNormals();

  const finial = colorize(new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.32, 0), white);
  return mergeGeometries([geo, finial]);
}

/** Tuft of thin, arching dune-grass blades. */
function createGrassTuft(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 9; b++) {
    const h = 0.35 + Math.random() * 0.35;
    const blade = new THREE.ConeGeometry(0.018, h, 3, 1);
    blade.translate(0, h / 2, 0);
    blade.rotateZ((Math.random() - 0.5) * 0.7);
    blade.rotateY((b / 9) * Math.PI * 2);
    blade.translate((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    blades.push(blade);
  }
  return mergeGeometries(blades);
}

/** Seagull body (with head and beak) and a single wing (mirrored per instance). */
function createSeagullGeometries(): { body: THREE.BufferGeometry; wing: THREE.BufferGeometry } {
  const white = new THREE.Color(0xfafafa);
  const grey = new THREE.Color(0x9aa3ad);
  const dark = new THREE.Color(0x2b2f36);
  const orange = new THREE.Color(0xf2a33a);

  const torso = new THREE.SphereGeometry(0.12, 10, 8).scale(0.9, 0.8, 2.6);
  const head = new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.05, -0.3);
  const beak = new THREE.ConeGeometry(0.022, 0.1, 6).rotateX(-Math.PI / 2).translate(0, 0.04, -0.41);
  const tail = new THREE.ConeGeometry(0.07, 0.18, 4).rotateX(Math.PI / 2).scale(1.4, 0.3, 1).translate(0, 0, 0.36);
  const body = mergeGeometries([colorize(torso, white), colorize(head, white), colorize(beak, orange), colorize(tail, grey)]);

  // Swept wing from the shoulder outward (+X), grey with a dark tip
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.1);
  shape.lineTo(0.35, -0.13);
  shape.lineTo(0.75, 0.05);
  shape.lineTo(0.7, 0.12);
  shape.lineTo(0.3, 0.06);
  shape.lineTo(0, 0.1);
  const wingInner = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const wing = colorize(wingInner, grey);
  const pos = wing.attributes.position;
  const col = wing.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getX(i) > 0.6) col.setXYZ(i, dark.r, dark.g, dark.b);
  }
  wing.translate(0.05, 0.03, 0);
  wing.computeVertexNormals();
  return { body, wing };
}
