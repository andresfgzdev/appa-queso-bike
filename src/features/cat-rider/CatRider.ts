import * as THREE from "three";
import { BikeRig } from "./BikeRig";
import { ArmRig, CatMeshBuilder, CatRigNodes, LegRig } from "./CatMeshBuilder";
import { furWind } from "./furShells";
import { alignSegment, solveTwoBone } from "./rigMath";
import { CatId, CAT_PROFILES } from "./types";

// Hind paw sits on the pedal; the hock (ankle) is raised and behind it
const PAW_ON_PEDAL = new THREE.Vector3(0, 0.02, -0.01);
const HOCK_FROM_PEDAL = new THREE.Vector3(0, 0.07, 0.075);
// Front paw wraps the grip; the wrist sits just above and behind it
const PAW_ON_GRIP = new THREE.Vector3(0, 0.028, 0);
const WRIST_FROM_GRIP = new THREE.Vector3(0, 0.045, 0.03);

// IK bend hints (rig space): knees forward/up, elbows out and back
const KNEE_POLE = { left: new THREE.Vector3(-0.3, 0.5, -1), right: new THREE.Vector3(0.3, 0.5, -1) };
const ELBOW_POLE = { left: new THREE.Vector3(-0.35, -0.7, 0.6), right: new THREE.Vector3(0.35, -0.7, 0.6) };

const _pedal = new THREE.Vector3();
const _grip = new THREE.Vector3();
const _root = new THREE.Vector3();
const _target = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _end = new THREE.Vector3();
const _paw = new THREE.Vector3();

export class CatRider {
  public group = new THREE.Group();
  public bike: BikeRig;
  public activeCatId: CatId = "appa";

  private appaRig: CatRigNodes;
  private quesoRig: CatRigNodes;
  private activeRig: CatRigNodes;

  private time = 0;
  private currentLeanAngle = 0;
  private torsoPitch = 0;
  private headYaw = 0;
  private switchScale = 1.0;
  private nextBlinkAt = 2.5;
  private blinkTimer = -1;

  constructor(initialCat: CatId = "appa") {
    this.activeCatId = initialCat;
    this.bike = new BikeRig(CAT_PROFILES[initialCat].frameColorHex, initialCat);
    this.group.add(this.bike.group);

    // Rigs are authored in bike space, so they attach at the origin
    this.appaRig = CatMeshBuilder.buildCatRig("appa");
    this.quesoRig = CatMeshBuilder.buildCatRig("queso");
    this.group.add(this.appaRig.group, this.quesoRig.group);

    this.appaRig.group.visible = initialCat === "appa";
    this.quesoRig.group.visible = initialCat === "queso";
    this.activeRig = initialCat === "appa" ? this.appaRig : this.quesoRig;
  }

  public switchCat(targetId?: CatId): CatId {
    const nextId: CatId = targetId ?? (this.activeCatId === "appa" ? "queso" : "appa");
    this.activeCatId = nextId;

    this.appaRig.group.visible = nextId === "appa";
    this.quesoRig.group.visible = nextId === "queso";
    this.activeRig = nextId === "appa" ? this.appaRig : this.quesoRig;

    this.bike.setFrameColor(CAT_PROFILES[nextId].frameColorHex);
    this.bike.setBasketProp(nextId);

    // Playful squash & stretch on the upper body
    this.switchScale = 1.15;

    return nextId;
  }

  public update(speed: number, steerInput: number, delta: number): void {
    const rig = this.activeRig;
    this.time += delta;

    // 1. Bicycle: wheels, crank, steering
    this.bike.update(speed, steerInput, delta);
    const crank = this.bike.crankAngle;

    // 2. Banking into turns (whole bike + rider)
    const targetLean = -steerInput * 0.18;
    this.currentLeanAngle = THREE.MathUtils.lerp(this.currentLeanAngle, targetLean, Math.min(1, 4.0 * delta));
    this.group.rotation.z = this.currentLeanAngle;

    // 3. Upper body: leans forward with effort, rocks with each pedal stroke
    const effort = THREE.MathUtils.clamp(speed / 11, 0.5, 1.6);
    const targetPitch = -0.04 - (effort - 1) * 0.14;
    this.torsoPitch = THREE.MathUtils.lerp(this.torsoPitch, targetPitch, Math.min(1, 3.0 * delta));
    const strokeRock = Math.sin(crank) * 0.035 * effort;
    const breathe = Math.sin(this.time * 2.2) * 0.004;

    rig.upperBody.rotation.set(this.torsoPitch, -steerInput * 0.06, strokeRock);
    rig.upperBody.position.y = 1.06 + breathe + Math.abs(Math.cos(crank)) * 0.006 * effort;

    if (this.switchScale > 1.0) {
      this.switchScale = Math.max(1.0, THREE.MathUtils.lerp(this.switchScale, 1.0, Math.min(1, 6.0 * delta)));
      const s = this.switchScale;
      rig.upperBody.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }

    // 4. Head stays level and looks into the turn
    this.headYaw = THREE.MathUtils.lerp(this.headYaw, -steerInput * 0.35, Math.min(1, 5.0 * delta));
    rig.head.rotation.set(
      -this.torsoPitch * 0.8 + Math.sin(crank * 2) * 0.012,
      this.headYaw,
      -strokeRock * 0.9 - this.currentLeanAngle * 0.5
    );

    // Ears fold back slightly with speed (wind)
    const earBack = THREE.MathUtils.clamp((speed - 9) * 0.03, 0, 0.35);
    for (const ear of rig.ears) ear.rotation.x = -0.12 + earBack;

    // 5. Limbs follow pedals and grips exactly
    this.group.updateMatrixWorld(true);
    this.poseLeg(rig, rig.legs.left, this.bike.leftPedalAnchor, KNEE_POLE.left);
    this.poseLeg(rig, rig.legs.right, this.bike.rightPedalAnchor, KNEE_POLE.right);
    this.poseArm(rig, rig.arms.left, this.bike.leftGripAnchor, ELBOW_POLE.left);
    this.poseArm(rig, rig.arms.right, this.bike.rightGripAnchor, ELBOW_POLE.right);

    // 6. Tail drapes behind the saddle with a travelling sway
    const sway = 0.12 + effort * 0.06;
    rig.tailSegments.forEach((seg, i) => {
      const curl = i === 0 ? 1.7 : -0.13 - i * 0.015;
      seg.rotation.x = curl + Math.sin(this.time * 1.4 - i * 0.45) * 0.03;
      seg.rotation.z = Math.sin(this.time * 1.8 - i * 0.55) * sway * (i === 0 ? 0.5 : 0.35) + steerInput * 0.05;
    });

    // 7. Natural blinking
    this.updateBlink(rig, delta);

    // 7b. Push the posed parts into the batched (one-draw-per-material) meshes
    for (const batch of this.bike.batches) batch.update();
    rig.group.updateMatrixWorld(true);
    for (const batch of rig.batches) batch.update();

    // 8. Wind through the fur grows with speed
    furWind.time.value = this.time;
    furWind.strength.value = THREE.MathUtils.lerp(furWind.strength.value, 0.4 + speed * 0.09, Math.min(1, 2 * delta));
  }

  private poseLeg(rig: CatRigNodes, leg: LegRig, pedalAnchor: THREE.Object3D, pole: THREE.Vector3): void {
    // Pedal position in rig space; anchor already follows the crank and stays level
    rig.group.worldToLocal(pedalAnchor.getWorldPosition(_pedal));
    _paw.copy(_pedal).add(PAW_ON_PEDAL);
    _target.copy(_pedal).add(HOCK_FROM_PEDAL);

    rig.group.worldToLocal(leg.hip.getWorldPosition(_root));
    solveTwoBone(_root, _target, leg.thighLength, leg.shinLength, pole, _mid, _end);

    alignSegment(leg.thigh, _root, _mid, leg.thighLength);
    leg.knee.position.copy(_mid);
    alignSegment(leg.shin, _mid, _end, leg.shinLength);
    leg.hock.position.copy(_end);
    alignSegment(leg.metatarsal, _end, _paw, leg.metatarsalLength);
    leg.paw.position.copy(_paw);
  }

  private poseArm(rig: CatRigNodes, arm: ArmRig, gripAnchor: THREE.Object3D, pole: THREE.Vector3): void {
    rig.group.worldToLocal(gripAnchor.getWorldPosition(_grip));
    _paw.copy(_grip).add(PAW_ON_GRIP);
    _target.copy(_grip).add(WRIST_FROM_GRIP);

    rig.group.worldToLocal(arm.shoulder.getWorldPosition(_root));
    solveTwoBone(_root, _target, arm.upperLength, arm.forearmLength, pole, _mid, _end);

    alignSegment(arm.upperArm, _root, _mid, arm.upperLength);
    arm.elbow.position.copy(_mid);
    alignSegment(arm.forearm, _mid, _end, arm.forearmLength);
    arm.paw.position.copy(_paw);
    arm.paw.quaternion.copy(arm.forearm.quaternion);
  }

  private updateBlink(rig: CatRigNodes, delta: number): void {
    if (this.blinkTimer < 0 && this.time >= this.nextBlinkAt) {
      this.blinkTimer = 0;
    }
    let openness = 1;
    if (this.blinkTimer >= 0) {
      this.blinkTimer += delta;
      const duration = 0.16;
      const t = this.blinkTimer / duration;
      openness = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
      if (t >= 1) {
        this.blinkTimer = -1;
        this.nextBlinkAt = this.time + 2 + Math.random() * 4;
        openness = 1;
      }
    }
    const scaleY = THREE.MathUtils.clamp(0.08 + openness * 0.92, 0.08, 1);
    for (const eye of rig.eyes) eye.scale.y = scaleY;
  }
}
