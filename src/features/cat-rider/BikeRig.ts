import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakeStatic } from "../../lib/bakeStatic";
import { batchByMaterial, DynamicBatch } from "../../lib/DynamicBatch";
import { curvedTube, tubeBetween, v3 } from "./rigMath";
import { CatId } from "./types";

/**
 * Beach cruiser bicycle built from real frame geometry (bike local space, forward = -Z).
 *
 * Every tube connects actual frame points (bottom bracket, head tube, dropouts...), the
 * front end steers around the tilted head-tube axis, and the crank turns through a
 * realistic gear ratio. Pedal and grip anchors are exposed so the rider's IK can lock
 * paws onto them every frame.
 */

// Key frame points
const WHEEL_RADIUS = 0.5;
const REAR_AXLE = v3(0, WHEEL_RADIUS, 0.85);
const FRONT_AXLE = v3(0, WHEEL_RADIUS, -0.85);
const BOTTOM_BRACKET = v3(0, 0.36, 0.1);
const SEAT_CLUSTER = v3(0, 0.86, 0.3);
const HEAD_TOP = v3(0, 1.02, -0.58);
const HEAD_BOTTOM = v3(0, 0.82, -0.684);
const CRANK_LENGTH = 0.15;
const PEDAL_X = 0.19;
const CHAINRING_RADIUS = 0.1;
const COG_RADIUS = 0.045;
const DRIVE_SIDE_X = 0.075;

// Wheel turns per crank turn (~84 rpm cadence at cruising speed)
const GEAR_RATIO = 2.6;

// Steering axis tilt (head angle) derived from the frame points
const STEER_AXIS_TILT = Math.atan2(HEAD_TOP.z - FRONT_AXLE.z, HEAD_TOP.y - FRONT_AXLE.y);

export class BikeRig {
  public group = new THREE.Group();
  public frameMaterial: THREE.MeshStandardMaterial;

  public readonly wheelRadius = WHEEL_RADIUS;
  public readonly crankLength = CRANK_LENGTH;
  public crankAngle = 0;
  /** Per-material CPU-skinned batches; refreshed by the rider after matrices update. */
  public batches: DynamicBatch[] = [];

  // Anchors the rider's paws lock onto (positions read in world space)
  public leftPedalAnchor = new THREE.Object3D();
  public rightPedalAnchor = new THREE.Object3D();
  public leftGripAnchor = new THREE.Object3D();
  public rightGripAnchor = new THREE.Object3D();

  private steerGroup = new THREE.Group();
  private frontAssembly = new THREE.Group();
  private frontWheel: THREE.Group;
  private rearWheel: THREE.Group;
  private crankGroup = new THREE.Group();
  private rearCog: THREE.Mesh;
  private leftPedal: THREE.Mesh;
  private rightPedal: THREE.Mesh;

  private cheeseGroup: THREE.Group;
  private yarnGroup: THREE.Group;

  private wheelAngle = 0;
  private currentSteerAngle = 0;

  // Shared materials
  private chromeMat = new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: 0.9, roughness: 0.22 });
  private darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.7, roughness: 0.45 });
  private rubberMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.92 });
  private creamMat = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.55 });
  private leatherMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.65 });

  constructor(initialColor: number, initialCat: CatId = "appa") {
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: initialColor,
      metalness: 0.45,
      roughness: 0.32,
    });

    this.cheeseGroup = this.createCheeseProp();
    this.yarnGroup = this.createYarnProp();

    this.rearWheel = this.createWheel();
    this.rearWheel.position.copy(REAR_AXLE);
    this.group.add(this.rearWheel);

    this.frontWheel = this.createWheel();

    const pedalGeo = new THREE.BoxGeometry(0.1, 0.025, 0.07);
    this.leftPedal = new THREE.Mesh(pedalGeo, this.darkMetalMat);
    this.rightPedal = new THREE.Mesh(pedalGeo, this.darkMetalMat);

    this.rearCog = new THREE.Mesh(this.gearGeometry(COG_RADIUS, 12), this.darkMetalMat);

    this.buildFrame();
    this.buildDrivetrain();
    this.buildSteering();
    this.buildSaddle();
    this.buildFenders();

    this.setBasketProp(initialCat);

    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) obj.castShadow = true;
    });

    // Batch static parts per rigid assembly (frame, wheels, crankset, front end)
    bakeStatic(this.group, { skip: (m) => m === this.rearCog });
    bakeStatic(this.frontAssembly);
    bakeStatic(this.frontWheel);
    bakeStatic(this.rearWheel);
    bakeStatic(this.crankGroup);

    // Whole bicycle → one draw call per material (basket props excluded: they toggle per cat)
    const isProp = (m: THREE.Mesh) => {
      for (let p: THREE.Object3D | null = m; p; p = p.parent) {
        if (p === this.cheeseGroup || p === this.yarnGroup) return true;
      }
      return false;
    };
    this.batches = batchByMaterial(this.group, (m) => !isProp(m));
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  private buildFrame(): void {
    const tubes: THREE.BufferGeometry[] = [];

    // Head tube
    tubes.push(tubeBetween(HEAD_BOTTOM, HEAD_TOP, 0.042));

    // Seat tube (bottom bracket -> seat cluster)
    tubes.push(tubeBetween(BOTTOM_BRACKET, SEAT_CLUSTER, 0.034));

    // Cruiser twin top tubes, gently curved
    tubes.push(curvedTube([v3(0, 0.83, 0.29), v3(0, 0.9, -0.15), v3(0, 0.98, -0.6)], 0.032));
    tubes.push(curvedTube([v3(0, 0.62, 0.22), v3(0, 0.66, -0.25), v3(0, 0.86, -0.67)], 0.028));

    // Down tube (bottom bracket -> head tube bottom), slight bow
    tubes.push(curvedTube([BOTTOM_BRACKET, v3(0, 0.5, -0.3), HEAD_BOTTOM.clone().add(v3(0, -0.02, 0))], 0.036));

    // Bottom bracket shell
    const shell = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16);
    shell.rotateZ(Math.PI / 2);
    shell.translate(BOTTOM_BRACKET.x, BOTTOM_BRACKET.y, BOTTOM_BRACKET.z);
    tubes.push(shell);

    // Chain stays & seat stays (split around the rear wheel)
    for (const side of [-1, 1]) {
      const dropout = v3(side * 0.07, REAR_AXLE.y, REAR_AXLE.z);
      tubes.push(tubeBetween(v3(side * 0.03, BOTTOM_BRACKET.y, BOTTOM_BRACKET.z + 0.02), dropout, 0.02));
      tubes.push(tubeBetween(v3(side * 0.025, SEAT_CLUSTER.y - 0.03, SEAT_CLUSTER.z), dropout, 0.018));
    }

    const frame = new THREE.Mesh(mergeGeometries(tubes), this.frameMaterial);
    this.group.add(frame);

    // Seat post (chrome) continues the seat tube line up to the saddle clamp
    const seatDir = SEAT_CLUSTER.clone().sub(BOTTOM_BRACKET).normalize();
    const postTop = SEAT_CLUSTER.clone().addScaledVector(seatDir, 0.1);
    this.group.add(new THREE.Mesh(tubeBetween(SEAT_CLUSTER, postTop, 0.022), this.chromeMat));
  }

  private buildDrivetrain(): void {
    // Crank spins around the bottom bracket
    this.crankGroup.position.copy(BOTTOM_BRACKET);
    this.group.add(this.crankGroup);

    const chainring = new THREE.Mesh(this.gearGeometry(CHAINRING_RADIUS, 32), this.chromeMat);
    chainring.position.x = DRIVE_SIDE_X;
    this.crankGroup.add(chainring);

    const spindle = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10);
    spindle.rotateZ(Math.PI / 2);
    this.crankGroup.add(new THREE.Mesh(spindle, this.chromeMat));

    // Crank arms: right points down at angle 0, left is 180° opposite
    const armGeo = new THREE.BoxGeometry(0.025, CRANK_LENGTH + 0.03, 0.035);
    const rightArm = new THREE.Mesh(armGeo, this.chromeMat);
    rightArm.position.set(0.12, -CRANK_LENGTH / 2, 0);
    const leftArm = new THREE.Mesh(armGeo, this.chromeMat);
    leftArm.position.set(-0.12, CRANK_LENGTH / 2, 0);
    this.crankGroup.add(rightArm, leftArm);

    // Pedals (counter-rotated each frame to stay level)
    this.rightPedal.position.set(PEDAL_X, -CRANK_LENGTH, 0);
    this.leftPedal.position.set(-PEDAL_X, CRANK_LENGTH, 0);
    this.crankGroup.add(this.rightPedal, this.leftPedal);

    // Paws rest on top of each pedal platform
    this.rightPedalAnchor.position.set(0, 0.0125, 0);
    this.leftPedalAnchor.position.set(0, 0.0125, 0);
    this.rightPedal.add(this.rightPedalAnchor);
    this.leftPedal.add(this.leftPedalAnchor);

    // Rear cog
    this.rearCog.position.set(DRIVE_SIDE_X, REAR_AXLE.y, REAR_AXLE.z);
    this.group.add(this.rearCog);

    // Chain: upper and lower runs between chainring and cog
    const chainRuns = mergeGeometries([
      tubeBetween(
        v3(DRIVE_SIDE_X, BOTTOM_BRACKET.y + CHAINRING_RADIUS, BOTTOM_BRACKET.z),
        v3(DRIVE_SIDE_X, REAR_AXLE.y + COG_RADIUS, REAR_AXLE.z),
        0.008,
        6
      ),
      tubeBetween(
        v3(DRIVE_SIDE_X, BOTTOM_BRACKET.y - CHAINRING_RADIUS, BOTTOM_BRACKET.z),
        v3(DRIVE_SIDE_X, REAR_AXLE.y - COG_RADIUS, REAR_AXLE.z),
        0.008,
        6
      ),
    ]);
    this.group.add(new THREE.Mesh(chainRuns, this.darkMetalMat));
  }

  private buildSteering(): void {
    // Pivot sits on the head tube, tilted so its local Y matches the steering axis.
    // Children are authored in bike space and transformed back, so the whole front
    // end (fork, wheel, bars, basket) rotates around the real head-tube axis.
    const axisPivot = new THREE.Group();
    axisPivot.position.copy(HEAD_TOP);
    axisPivot.rotation.x = STEER_AXIS_TILT;
    this.group.add(axisPivot);

    axisPivot.add(this.steerGroup);

    const unTilt = new THREE.Group();
    unTilt.rotation.x = -STEER_AXIS_TILT;
    this.steerGroup.add(unTilt);

    const front = this.frontAssembly;
    front.position.copy(HEAD_TOP).negate();
    unTilt.add(front);

    // Front wheel
    this.frontWheel.position.copy(FRONT_AXLE);
    front.add(this.frontWheel);

    // Fork: crown + two legs along the steering axis to the axle
    const forkParts: THREE.BufferGeometry[] = [];
    const crown = new THREE.BoxGeometry(0.19, 0.04, 0.06);
    crown.rotateX(STEER_AXIS_TILT);
    crown.translate(HEAD_BOTTOM.x, HEAD_BOTTOM.y - 0.03, HEAD_BOTTOM.z - 0.01);
    forkParts.push(crown);
    for (const side of [-1, 1]) {
      forkParts.push(
        curvedTube(
          [
            v3(side * 0.075, HEAD_BOTTOM.y - 0.04, HEAD_BOTTOM.z - 0.015),
            v3(side * 0.07, 0.68, -0.78),
            v3(side * 0.065, FRONT_AXLE.y, FRONT_AXLE.z),
          ],
          0.02,
          16,
          8
        )
      );
    }
    front.add(new THREE.Mesh(mergeGeometries(forkParts), this.frameMaterial));

    // Stem + swept-back cruiser handlebar (chrome)
    const axisDir = HEAD_TOP.clone().sub(FRONT_AXLE).normalize();
    const steererTop = HEAD_TOP.clone().addScaledVector(axisDir, 0.13);
    const clamp = v3(0, 1.17, -0.6);
    const barParts: THREE.BufferGeometry[] = [tubeBetween(HEAD_TOP, steererTop, 0.026), tubeBetween(steererTop, clamp, 0.024)];
    for (const side of [-1, 1]) {
      barParts.push(
        curvedTube([clamp, v3(side * 0.2, 1.19, -0.58), v3(side * 0.3, 1.2, -0.46), v3(side * 0.34, 1.2, -0.3)], 0.019, 20, 8)
      );
    }
    front.add(new THREE.Mesh(mergeGeometries(barParts), this.chromeMat));

    // Grips, with anchors at their centres
    for (const side of [-1, 1]) {
      const gripGeo = tubeBetween(v3(side * 0.31, 1.2, -0.43), v3(side * 0.34, 1.2, -0.3), 0.03, 12);
      front.add(new THREE.Mesh(gripGeo, this.creamMat));
      const anchor = side < 0 ? this.leftGripAnchor : this.rightGripAnchor;
      anchor.position.set(side * 0.325, 1.2, -0.37);
      front.add(anchor);
    }

    // Bell on the left bar
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.9, roughness: 0.2 })
    );
    bell.position.set(-0.17, 1.22, -0.585);
    front.add(bell);

    // Wicker basket above the front wheel, braced to the fork
    const basket = this.createWickerBasket();
    basket.position.set(0, 1.21, -0.86);
    front.add(basket);
    const braces = mergeGeometries([
      tubeBetween(v3(-0.12, 1.1, -0.9), v3(-0.065, FRONT_AXLE.y + 0.03, FRONT_AXLE.z), 0.008, 6),
      tubeBetween(v3(0.12, 1.1, -0.9), v3(0.065, FRONT_AXLE.y + 0.03, FRONT_AXLE.z), 0.008, 6),
      tubeBetween(v3(0, 1.17, -0.71), clamp, 0.012, 6),
    ]);
    front.add(new THREE.Mesh(braces, this.chromeMat));

    // Bullet headlight on the basket front
    const lightHousingGeo = new THREE.CylinderGeometry(0.05, 0.035, 0.11, 16);
    lightHousingGeo.rotateX(Math.PI / 2);
    const lightHousing = new THREE.Mesh(lightHousingGeo, this.chromeMat);
    lightHousing.position.set(0, 1.16, -1.05);
    front.add(lightHousing);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff3cc, emissive: 0xffe59a, emissiveIntensity: 0.8, roughness: 0.1 })
    );
    lens.position.set(0, 1.16, -1.106);
    lens.rotation.y = Math.PI;
    front.add(lens);
  }

  private buildSaddle(): void {
    // Wide sprung cruiser saddle: round rear + tapered nose
    const rear = new THREE.SphereGeometry(1, 24, 12);
    rear.scale(0.13, 0.04, 0.1);
    rear.translate(0, 0, 0.05);
    const nose = new THREE.SphereGeometry(1, 20, 10);
    nose.scale(0.05, 0.035, 0.12);
    nose.translate(0, 0.005, -0.06);
    const saddle = new THREE.Mesh(mergeGeometries([rear, nose]), this.leatherMat);
    saddle.position.set(0, 0.985, 0.36);
    this.group.add(saddle);

    // Coil springs under the rear of the saddle
    const springs: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.TorusGeometry(0.018, 0.004, 6, 16);
        ring.rotateX(Math.PI / 2);
        ring.translate(side * 0.08, 0.925 + i * 0.016, 0.42);
        springs.push(ring);
      }
    }
    springs.push(tubeBetween(v3(-0.08, 0.92, 0.42), v3(0.08, 0.92, 0.42), 0.008, 6));
    this.group.add(new THREE.Mesh(mergeGeometries(springs), this.chromeMat));
  }

  private buildFenders(): void {
    // Rear fender (static) arcs over the back wheel
    this.group.add(new THREE.Mesh(this.fenderGeometry(REAR_AXLE, 0.75, 2.95), this.frameMaterial));

    // Rear reflector at the fender tail
    const reflector = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2010, emissiveIntensity: 0.5, roughness: 0.3 })
    );
    const t = 2.75;
    const r = WHEEL_RADIUS + 0.07;
    reflector.position.set(0, REAR_AXLE.y + r * Math.sin(t), REAR_AXLE.z - r * Math.cos(t));
    reflector.rotation.x = -(t - Math.PI / 2);
    this.group.add(reflector);

    // Front fender steers with the fork, so it lives inside the steering assembly
    const frontFender = new THREE.Mesh(this.fenderGeometry(FRONT_AXLE, 0.35, 2.3), this.frameMaterial);
    this.frontWheel.parent!.add(frontFender);
  }

  /** Point on a wheel-centred circle: t=0 front, t=π/2 top, t=π rear. */
  private fenderGeometry(center: THREE.Vector3, t0: number, t1: number): THREE.BufferGeometry {
    const r = WHEEL_RADIUS + 0.065;
    const points: THREE.Vector3[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      points.push(v3(0, r * Math.sin(t), -r * Math.cos(t)));
    }
    const geo = curvedTube(points, 0.03, 40, 10);
    geo.scale(2.0, 1, 1); // widen into a flat mudguard profile
    geo.translate(center.x, center.y, center.z);
    return geo;
  }

  private createWheel(): THREE.Group {
    const wheel = new THREE.Group();

    // Balloon tire + whitewall stripe
    const tireGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.035, 0.038, 14, 48);
    tireGeo.rotateY(Math.PI / 2);
    wheel.add(new THREE.Mesh(tireGeo, this.rubberMat));

    for (const side of [-1, 1]) {
      const wall = new THREE.TorusGeometry(WHEEL_RADIUS - 0.05, 0.012, 6, 48);
      wall.rotateY(Math.PI / 2);
      wall.translate(side * 0.03, 0, 0);
      wheel.add(new THREE.Mesh(wall, this.creamMat));
    }

    // Rim
    const rimGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.075, 0.014, 6, 48);
    rimGeo.rotateY(Math.PI / 2);

    // Hub with flanges
    const hubGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const flangeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16);
    flangeGeo.rotateZ(Math.PI / 2);
    const flangeL = flangeGeo.clone().translate(-0.045, 0, 0);
    const flangeR = flangeGeo.clone().translate(0.045, 0, 0);

    // 24 laced spokes alternating between flanges, merged into one draw call
    const parts: THREE.BufferGeometry[] = [rimGeo, hubGeo, flangeL, flangeR];
    const numSpokes = 24;
    const rimR = WHEEL_RADIUS - 0.085;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2;
      const side = i % 2 === 0 ? -1 : 1;
      const hubAngle = angle + (side * Math.PI) / numSpokes; // slight tangential lacing
      const from = v3(side * 0.045, Math.sin(hubAngle) * 0.04, Math.cos(hubAngle) * 0.04);
      const to = v3(0, Math.sin(angle) * rimR, Math.cos(angle) * rimR);
      parts.push(tubeBetween(from, to, 0.0045, 4));
    }
    wheel.add(new THREE.Mesh(mergeGeometries(parts), this.chromeMat));

    return wheel;
  }

  private gearGeometry(radius: number, teeth: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? radius : radius * 0.93;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius * 0.45, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
    geo.translate(0, 0, -0.004);
    geo.rotateY(Math.PI / 2); // face along X (the axle)
    return geo;
  }

  private createWickerBasket(): THREE.Group {
    const basket = new THREE.Group();

    const texture = this.createWickerTexture();
    const wickerMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });

    // Open-top basket: bottom + four walls + rim
    const w = 0.42;
    const h = 0.22;
    const d = 0.3;
    const t = 0.018;
    const walls = mergeGeometries([
      new THREE.BoxGeometry(w, t, d).translate(0, -h / 2, 0),
      new THREE.BoxGeometry(w, h, t).translate(0, 0, -d / 2),
      new THREE.BoxGeometry(w, h, t).translate(0, 0, d / 2),
      new THREE.BoxGeometry(t, h, d).translate(-w / 2, 0, 0),
      new THREE.BoxGeometry(t, h, d).translate(w / 2, 0, 0),
    ]);
    basket.add(new THREE.Mesh(walls, wickerMat));

    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9a7040, roughness: 0.85 });
    const rim = mergeGeometries([
      tubeBetween(v3(-w / 2, h / 2, -d / 2), v3(w / 2, h / 2, -d / 2), 0.014, 6),
      tubeBetween(v3(-w / 2, h / 2, d / 2), v3(w / 2, h / 2, d / 2), 0.014, 6),
      tubeBetween(v3(-w / 2, h / 2, -d / 2), v3(-w / 2, h / 2, d / 2), 0.014, 6),
      tubeBetween(v3(w / 2, h / 2, -d / 2), v3(w / 2, h / 2, d / 2), 0.014, 6),
    ]);
    basket.add(new THREE.Mesh(rim, rimMat));

    this.cheeseGroup.position.y = -0.04;
    this.yarnGroup.position.y = -0.04;
    basket.add(this.cheeseGroup, this.yarnGroup);

    return basket;
  }

  private createWickerTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8a6232";
    ctx.fillRect(0, 0, size, size);

    // Basket weave: alternating horizontal/vertical strands
    const cell = 16;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const horizontal = ((x + y) / cell) % 2 === 0;
        const grad = horizontal
          ? ctx.createLinearGradient(0, y, 0, y + cell)
          : ctx.createLinearGradient(x, 0, x + cell, 0);
        grad.addColorStop(0, "#b8894e");
        grad.addColorStop(0.5, "#dcb47a");
        grad.addColorStop(1, "#a87a42");
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1.5);
    return texture;
  }

  private createCheeseProp(): THREE.Group {
    const cheese = new THREE.Group();
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffd13b, roughness: 0.55 });
    const holeMat = new THREE.MeshStandardMaterial({ color: 0xd9a514, roughness: 0.7 });

    // Wedge: triangular prism
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 3), cheeseMat);
    wedge.rotation.z = Math.PI / 2;
    wedge.rotation.x = 0.4;
    wedge.position.set(0, 0.05, 0);
    cheese.add(wedge);

    const holeGeo = new THREE.SphereGeometry(0.018, 10, 8);
    for (const [x, y, z] of [
      [0.05, 0.09, 0.03],
      [-0.03, 0.07, -0.05],
      [0.0, 0.04, 0.07],
    ]) {
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.set(x, y, z);
      cheese.add(hole);
    }
    return cheese;
  }

  private createYarnProp(): THREE.Group {
    const yarn = new THREE.Group();
    const yarnMat = new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.95 });

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), yarnMat);
    ball.position.set(0, 0.05, 0);
    yarn.add(ball);

    // Wrapped strands around the ball
    const strandMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const strand = new THREE.Mesh(new THREE.TorusGeometry(0.091, 0.006, 6, 32), strandMat);
      strand.position.copy(ball.position);
      strand.rotation.set(i * 0.9, i * 0.6, i * 0.4);
      yarn.add(strand);
    }
    return yarn;
  }

  // ---------------------------------------------------------------------------
  // Runtime
  // ---------------------------------------------------------------------------

  public setBasketProp(catId: CatId): void {
    this.cheeseGroup.visible = catId === "queso";
    this.yarnGroup.visible = catId === "appa";
  }

  public setFrameColor(colorHex: number): void {
    this.frameMaterial.color.setHex(colorHex);
  }

  public update(speed: number, steerInput: number, delta: number): void {
    // Wheels roll forward (-Z): negative rotation around X
    const wheelStep = -(speed / WHEEL_RADIUS) * delta;
    this.wheelAngle += wheelStep;
    this.frontWheel.rotation.x = this.wheelAngle;
    this.rearWheel.rotation.x = this.wheelAngle;
    this.rearCog.rotation.x = this.wheelAngle;

    // Crank turns through the gear ratio; pedals stay level
    this.crankAngle += wheelStep / GEAR_RATIO;
    this.crankGroup.rotation.x = this.crankAngle;
    this.leftPedal.rotation.x = -this.crankAngle;
    this.rightPedal.rotation.x = -this.crankAngle;

    // Steering around the head-tube axis
    const targetSteerAngle = -steerInput * 0.2;
    this.currentSteerAngle = THREE.MathUtils.lerp(this.currentSteerAngle, targetSteerAngle, Math.min(1, 6.0 * delta));
    this.steerGroup.rotation.y = this.currentSteerAngle;
  }
}
