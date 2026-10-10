import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { QualitySettings } from "./QualityManager";

/**
 * Cinematic post stack:
 *   HDR scene (MSAA) → bloom (sun, glints, chrome) → ACES tone map + sRGB
 *   → film grade (warm split-tone, contrast, vignette, grain, subtle chromatic aberration,
 *     radial speed blur when boosting, letterbox for the intro) → optional FXAA.
 */
const FilmGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    speedBlur: { value: 0 },
    letterbox: { value: 0 },
    vignette: { value: 0.32 },
    grain: { value: 0.035 },
    aberration: { value: 0.0016 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float speedBlur;
    uniform float letterbox;
    uniform float vignette;
    uniform float grain;
    uniform float aberration;
    uniform float aspect;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec3 sampleCA(vec2 uv, vec2 dir) {
      float r = texture2D(tDiffuse, uv + dir * aberration).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * aberration).b;
      return vec3(r, g, b);
    }

    void main() {
      vec2 center = vec2(0.5, 0.48);
      vec2 toC = vUv - center;
      float dist = length(toC * vec2(aspect, 1.0));
      vec2 dir = toC * dist;

      vec3 col = sampleCA(vUv, dir);

      // Radial speed blur toward the vanishing point (edges only)
      if (speedBlur > 0.001) {
        vec3 acc = col;
        float strength = speedBlur * smoothstep(0.38, 0.95, dist) * 0.016;
        float jitter = hash(vUv * 731.0 + time) ;
        for (int i = 1; i < 10; i++) {
          acc += texture2D(tDiffuse, vUv - toC * strength * (float(i) + jitter)).rgb;
        }
        col = acc / 10.0;
      }

      // Warm split-tone: amber highlights, teal-ish shadows, gentle S-curve
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.96, 0.99, 1.04);
      vec3 highTint = vec3(1.05, 1.0, 0.93);
      col *= mix(shadowTint, highTint, smoothstep(0.2, 0.8, luma));
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
      col = mix(vec3(luma), col, 1.08);

      // Vignette
      col *= 1.0 - vignette * smoothstep(0.35, 1.05, dist);

      // Film grain (luma-weighted, animated)
      float n = hash(vUv * vec2(1920.0, 1080.0) + fract(time * 7.0) * 100.0) - 0.5;
      col += n * grain * (1.0 - luma * 0.6);

      // Cinematic letterbox bars
      float bar = 0.12 * letterbox;
      if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class PostFX {
  public composer: EffectComposer;
  public grade: ShaderPass;
  private bloom: UnrealBloomPass;
  private fxaa?: ShaderPass;
  private renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, quality: QualitySettings) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();

    const target = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType,
      samples: quality.msaaSamples,
    });
    this.composer = new EffectComposer(renderer, target);

    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.75, 1.15);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.grade = new ShaderPass(FilmGradeShader);
    this.composer.addPass(this.grade);

    if (quality.fxaa) {
      this.fxaa = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaa);
    }

    this.setSize(size.x, size.y);
  }

  public setSize(width: number, height: number): void {
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    this.grade.uniforms.aspect.value = width / height;
    if (this.fxaa) {
      this.fxaa.material.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr));
    }
  }

  public render(delta: number, elapsed: number): void {
    this.grade.uniforms.time.value = elapsed;
    this.composer.render(delta);
  }

  public dispose(): void {
    this.composer.dispose();
    this.bloom.dispose();
  }
}
