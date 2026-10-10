import * as THREE from "three";

const CHASE_OFFSET = new THREE.Vector3(1.6, 2.15, 3.9);
const CHASE_LOOK = new THREE.Vector3(-0.25, 0.3, -9.0);
const BASE_FOV = 52;

// Intro flight path (relative to the bike), sampled with Catmull-Rom splines
const INTRO_POSITIONS = [
  new THREE.Vector3(30, 10, 18), // high over the beach, sunset ahead
  new THREE.Vector3(-7, 4.2, -15), // dive in from inland, ocean behind the rider
  new THREE.Vector3(-3.4, 1.3, -5.0), // low hero shot: the cat's face, sun behind
  new THREE.Vector3(-3.6, 1.45, 0.6), // side profile: pedalling + ocean
  new THREE.Vector3(2.8, 2.1, 4.2), // swing behind
  CHASE_OFFSET,
];
const INTRO_LOOKS = [
  new THREE.Vector3(70, 6, -110),
  new THREE.Vector3(1.5, 1.5, -2),
  new THREE.Vector3(0, 1.4, -0.1),
  new THREE.Vector3(0.2, 1.05, 0),
  new THREE.Vector3(-0.1, 0.9, -4),
  CHASE_LOOK,
];
const INTRO_DURATION = 9.0;
const SKIP_BLEND = 0.9;

const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * Over-the-shoulder chase camera with a scripted cinematic intro.
 * Chase mode uses frame-rate-independent exponential damping, speed-driven FOV,
 * a slight roll into turns and a subtle hand-held drift.
 */
export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  /** 0 → 1 while letterbox bars should show (intro). */
  public letterbox = 0;
  public onIntroEnd?: () => void;

  private mode: "intro" | "blend" | "chase" = "chase";
  private introTime = 0;
  private blendTime = 0;
  private blendFromPos = new THREE.Vector3();
  private blendFromLook = new THREE.Vector3();
  private blendFromFov = BASE_FOV;
  private posCurve = new THREE.CatmullRomCurve3(INTRO_POSITIONS, false, "centripetal");
  private lookCurve = new THREE.CatmullRomCurve3(INTRO_LOOKS, false, "centripetal");

  private currentPos = CHASE_OFFSET.clone();
  private currentLook = CHASE_LOOK.clone();
  private currentFov = BASE_FOV;
  private roll = 0;
  private time = 0;

  private _pos = new THREE.Vector3();
  private _look = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, aspect, 0.1, 400);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  public get isIntroPlaying(): boolean {
    return this.mode !== "chase";
  }

  public playIntro(): void {
    this.mode = "intro";
    this.introTime = 0;
    this.letterbox = 1;
  }

  public skipIntro(): void {
    if (this.mode !== "intro") return;
    this.mode = "blend";
    this.blendTime = 0;
    this.blendFromPos.copy(this.camera.position);
    this.blendFromLook.copy(this._look);
    this.blendFromFov = this.camera.fov;
  }

  public update(bikeX: number, speedFactor: number, steer: number, delta: number): void {
    this.time += delta;

    // Live chase target (used directly in chase mode, and as the destination of the intro)
    const chasePos = this._pos.set(bikeX + CHASE_OFFSET.x, CHASE_OFFSET.y, CHASE_OFFSET.z);
    const chaseLookX = bikeX + CHASE_LOOK.x;

    if (this.mode === "intro") {
      this.introTime += delta;
      const t = this.introTime / INTRO_DURATION;
      const u = easeInOut(t);
      this.posCurve.getPoint(u, this.camera.position);
      this.lookCurve.getPoint(u, this._look);
      this.camera.position.x += bikeX;
      this._look.x += bikeX;
      this.camera.fov = THREE.MathUtils.lerp(34, BASE_FOV, easeInOut(t * 1.1 - 0.1));
      this.letterbox = 1 - easeInOut((t - 0.82) / 0.18);
      this.camera.lookAt(this._look);
      this.camera.updateProjectionMatrix();

      if (t >= 1) this.finishIntro();
      return;
    }

    if (this.mode === "blend") {
      this.blendTime += delta;
      const u = easeInOut(this.blendTime / SKIP_BLEND);
      this.camera.position.lerpVectors(this.blendFromPos, chasePos, u);
      this._look.lerpVectors(this.blendFromLook, new THREE.Vector3(chaseLookX, CHASE_LOOK.y, CHASE_LOOK.z), u);
      this.camera.fov = THREE.MathUtils.lerp(this.blendFromFov, BASE_FOV, u);
      this.letterbox = 1 - u;
      this.camera.lookAt(this._look);
      this.camera.updateProjectionMatrix();
      if (u >= 1) this.finishIntro();
      return;
    }

    // --- Chase mode ---
    const k = damp(4.5, delta);
    this.currentPos.lerp(chasePos, k);
    this.currentLook.x += (chaseLookX - this.currentLook.x) * k;
    this.currentLook.y = CHASE_LOOK.y;
    this.currentLook.z = CHASE_LOOK.z;

    // Hand-held drift (very subtle, layered sines)
    const sway = 0.018;
    this.camera.position.set(
      this.currentPos.x + Math.sin(this.time * 0.9) * sway + Math.sin(this.time * 2.3) * sway * 0.3,
      this.currentPos.y + Math.sin(this.time * 1.3 + 1.0) * sway * 0.8,
      this.currentPos.z
    );
    this.camera.lookAt(this.currentLook);

    // Roll into turns
    this.roll += (-steer * 0.035 - this.roll) * damp(3.0, delta);
    this.camera.rotateZ(this.roll);

    // FOV opens up with speed (sense of acceleration)
    const targetFov = BASE_FOV + speedFactor * 9;
    this.currentFov += (targetFov - this.currentFov) * damp(2.5, delta);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
    this.letterbox = 0;
  }

  private finishIntro(): void {
    this.mode = "chase";
    this.currentPos.copy(this.camera.position);
    this.currentLook.copy(this._look);
    this.currentFov = this.camera.fov;
    this.letterbox = 0;
    this.onIntroEnd?.();
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
