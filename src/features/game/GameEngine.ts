import * as THREE from "three";
import { AmbientAudio } from "../audio/AmbientAudio";
import { CatRider } from "../cat-rider/CatRider";
import { setFurShellCount } from "../cat-rider/furShells";
import { CatId } from "../cat-rider/types";
import { AmbientParticles } from "./AmbientParticles";
import { ChaseCamera } from "./ChaseCamera";
import { InputManager } from "./InputManager";
import { PostFX } from "./PostFX";
import { AdaptiveResolution, detectQuality, QualitySettings } from "./QualityManager";
import { RoadManager } from "./RoadManager";
import { FOG_COLOR, SkyDome, SUN_DIRECTION } from "./SkyDome";
import { GameTelemetry } from "./types";

const CRUISE_SPEED = 11; // ~18 km/h
const BOOST_MULTIPLIER = 1.5;

export class GameEngine {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public chaseCamera: ChaseCamera;
  public roadManager: RoadManager;
  public catRider: CatRider;
  public input: InputManager;
  public quality: QualitySettings;
  public audio = new AmbientAudio();
  private lastAudioSpeed = -1;

  private container: HTMLElement;
  private sky: SkyDome;
  private particles: AmbientParticles;
  private postFX: PostFX;
  private adaptive: AdaptiveResolution;

  private isRunning = false;
  private lastTime = 0;
  private elapsed = 0;
  private frameId = 0;

  // Telemetry is throttled so React doesn't re-render every frame (Spec 00 §4)
  private telemetryInterval = 1 / 12;
  private telemetryTimer = 0;
  private lastTelemetry?: GameTelemetry;

  // Bike dynamics
  private bikeX = 0;
  private boostMultiplier = 1.0;
  private distanceTraveled = 0;
  private maxLaneX = 4.0;

  public onTelemetry?: (data: GameTelemetry) => void;
  public onCatSwitched?: (catId: CatId) => void;
  /** Fires with `true` when the cinematic intro starts and `false` when gameplay begins. */
  public onIntroChange?: (playing: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.quality = detectQuality();
    setFurShellCount(this.quality.furShells);

    // 1. Scene & golden-hour atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0068);

    // 2. Renderer (anti-aliasing happens in the post stack: MSAA target or FXAA)
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // 3. Camera
    this.chaseCamera = new ChaseCamera(container.clientWidth / container.clientHeight);
    this.chaseCamera.onIntroEnd = () => this.onIntroChange?.(false);

    // 4. Sky, lighting, image-based lighting
    this.sky = new SkyDome();
    this.scene.add(this.sky.mesh);
    this.setupLighting();

    // 5. Road, ocean & scenery
    this.roadManager = new RoadManager();
    this.scene.add(this.roadManager.group);

    // 6. Cat & bicycle
    this.catRider = new CatRider("appa");
    this.scene.add(this.catRider.group);

    // 7. Atmosphere particles
    this.particles = new AmbientParticles(this.quality.particles);
    this.scene.add(this.particles.points);

    // 8. Post-processing + dynamic resolution
    this.postFX = new PostFX(this.renderer, this.scene, this.chaseCamera.camera, this.quality);
    this.adaptive = new AdaptiveResolution(this.quality, (pr) => {
      this.renderer.setPixelRatio(pr);
      this.postFX?.setSize(this.container.clientWidth, this.container.clientHeight);
    });

    // 9. Input
    this.input = new InputManager(container, () => this.switchCat());
    window.addEventListener("keydown", this.handleSkip);
    container.addEventListener("pointerdown", this.handleSkip);

    // 10. Resize (iOS reports the new size late after rotation, so re-check shortly after)
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("orientationchange", this.handleOrientation);
    window.visualViewport?.addEventListener("resize", this.handleResize);
  }

  private setupLighting(): void {
    // IBL from the same procedural sky that's on screen
    this.scene.environment = SkyDome.createEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.6;

    // Sky/sand bounce
    this.scene.add(new THREE.HemisphereLight(0xffdcb8, 0xd8a46c, 0.5));

    // Low golden sun ahead-right over the ocean: long shadows and warm rim light
    const sun = new THREE.DirectionalLight(0xffc684, 2.7);
    const target = new THREE.Object3D();
    target.position.set(0, 0, -8);
    sun.target = target;
    sun.position.copy(target.position).addScaledVector(SUN_DIRECTION, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    const cam = sun.shadow.camera;
    cam.near = 20;
    cam.far = 130;
    cam.left = -26;
    cam.right = 26;
    cam.top = 26;
    cam.bottom = -26;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, target);
  }

  public switchCat(targetId?: CatId): CatId {
    const newCat = this.catRider.switchCat(targetId);
    this.onCatSwitched?.(newCat);
    return newCat;
  }

  public playIntro(): void {
    this.chaseCamera.playIntro();
    this.onIntroChange?.(true);
  }

  public skipIntro(): void {
    this.chaseCamera.skipIntro();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.elapsed += delta;

    this.update(delta);
    this.postFX.render(delta, this.elapsed);
    this.adaptive.update(delta);

    this.frameId = requestAnimationFrame(this.tick);
  };

  private update(delta: number): void {
    const intro = this.chaseCamera.isIntroPlaying;

    // 1. Steering & boost (input is ignored while the intro plays)
    this.input.update(delta);
    const steerInput = intro ? 0 : this.input.state.steer;
    const isBoost = !intro && this.input.state.boost;

    const boostTarget = isBoost ? BOOST_MULTIPLIER : 1.0;
    this.boostMultiplier += (boostTarget - this.boostMultiplier) * (1 - Math.exp(-3.5 * delta));
    const currentSpeed = CRUISE_SPEED * this.boostMultiplier;
    const speedFactor = (this.boostMultiplier - 1) / (BOOST_MULTIPLIER - 1);

    this.bikeX = THREE.MathUtils.clamp(this.bikeX + steerInput * 5.2 * delta, -this.maxLaneX, this.maxLaneX);

    // 2. Rider & bike
    this.catRider.group.position.x = this.bikeX;
    this.catRider.update(currentSpeed, steerInput, delta);

    // 3. World
    const distance = currentSpeed * delta;
    this.roadManager.update(currentSpeed, delta);
    this.particles.update(distance, delta, this.elapsed, this.renderer.getPixelRatio());
    this.distanceTraveled += distance;

    // 4. Camera, sky & grading
    this.chaseCamera.update(this.bikeX, speedFactor, steerInput, delta);
    this.sky.update(this.chaseCamera.camera, this.elapsed);
    this.postFX.grade.uniforms.speedBlur.value = speedFactor * 0.9;
    this.postFX.grade.uniforms.letterbox.value = this.chaseCamera.letterbox;

    // Breeze in the soundscape follows riding speed
    if (Math.abs(speedFactor - this.lastAudioSpeed) > 0.03) {
      this.lastAudioSpeed = speedFactor;
      this.audio.setSpeed(speedFactor);
    }

    // 5. Telemetry
    this.telemetryTimer += delta;
    if (this.telemetryTimer >= this.telemetryInterval) {
      this.telemetryTimer = 0;
      this.emitTelemetry(currentSpeed, steerInput);
    }
  }

  private emitTelemetry(currentSpeed: number, steerInput: number): void {
    const next: GameTelemetry = {
      speedKmh: Math.round(currentSpeed * 1.6),
      distanceTraveledM: Math.floor(this.distanceTraveled),
      steerIntensity: Math.round(steerInput * 100) / 100,
      activeCatId: this.catRider.activeCatId,
    };

    const prev = this.lastTelemetry;
    if (
      prev &&
      prev.speedKmh === next.speedKmh &&
      prev.distanceTraveledM === next.distanceTraveledM &&
      prev.steerIntensity === next.steerIntensity &&
      prev.activeCatId === next.activeCatId
    ) {
      return;
    }

    this.lastTelemetry = next;
    this.onTelemetry?.(next);
  }

  private handleSkip = (): void => {
    if (this.chaseCamera.isIntroPlaying) this.skipIntro();
  };

  private handleOrientation = (): void => {
    this.handleResize();
    window.setTimeout(this.handleResize, 250);
    window.setTimeout(this.handleResize, 600);
  };

  private handleResize = (): void => {
    if (!this.container || !this.isRunning) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.chaseCamera.resize(width / height);
    this.renderer.setSize(width, height);
    this.postFX.setSize(width, height);
  };

  public destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleOrientation);
    window.visualViewport?.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleSkip);
    this.container.removeEventListener("pointerdown", this.handleSkip);
    this.input.destroy();
    this.onTelemetry = undefined;
    this.onCatSwitched = undefined;
    this.onIntroChange = undefined;
    this.audio.dispose();
    this.postFX.dispose();
    this.disposeScene();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private disposeScene(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh && !(obj as THREE.Points).isPoints) return;
      geometries.add(mesh.geometry);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) materials.add(m);
    });

    for (const g of geometries) g.dispose();
    for (const m of materials) {
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      m.dispose();
    }
  }
}
