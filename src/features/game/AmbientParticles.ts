import * as THREE from "three";
import { SUN_DIRECTION } from "./SkyDome";

/**
 * Sun-lit sand/pollen motes drifting in the air around the rider. They stream past with the
 * ground speed (adds a strong sense of motion) and sparkle when they line up with the sun.
 * A single draw call; wraps inside a box that follows the treadmill origin.
 */
export class AmbientParticles {
  public points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private positions: Float32Array;
  private seeds: Float32Array;
  private count: number;

  private readonly box = { minX: -14, maxX: 18, minY: 0.2, maxY: 6.5, minZ: -45, maxZ: 6 };

  constructor(count: number) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    const b = this.box;
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = THREE.MathUtils.randFloat(b.minX, b.maxX);
      this.positions[i * 3 + 1] = THREE.MathUtils.randFloat(b.minY, b.maxY);
      this.positions[i * 3 + 2] = THREE.MathUtils.randFloat(b.minZ, b.maxZ);
      this.seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(this.seeds, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        sunDir: { value: SUN_DIRECTION },
        pixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        uniform float pixelRatio;
        uniform vec3 sunDir;
        attribute float seed;
        varying float vAlpha;
        varying float vSpark;
        void main() {
          vec3 p = position;
          p.x += sin(time * 0.7 + seed * 40.0) * 0.25;
          p.y += sin(time * 0.9 + seed * 17.0) * 0.18;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = mix(1.2, 3.2, seed);
          gl_PointSize = size * pixelRatio * (12.0 / -mv.z);
          vec3 viewDir = normalize((modelMatrix * vec4(p, 1.0)).xyz - cameraPosition);
          vSpark = pow(max(dot(viewDir, sunDir), 0.0), 6.0);
          vAlpha = smoothstep(45.0, 6.0, -mv.z) * smoothstep(0.6, 2.0, -mv.z) * (0.35 + 0.65 * fract(seed * 7.3));
        }`,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vSpark;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float soft = smoothstep(0.5, 0.0, d);
          vec3 col = mix(vec3(1.0, 0.85, 0.62), vec3(1.6, 1.3, 0.9), vSpark);
          gl_FragColor = vec4(col * soft, soft * vAlpha * (0.25 + vSpark * 0.75));
        }`,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  public update(distance: number, delta: number, elapsed: number, pixelRatio: number): void {
    const b = this.box;
    const depth = b.maxZ - b.minZ;
    for (let i = 0; i < this.count; i++) {
      const zi = i * 3 + 2;
      // Air drifts a little slower than the ground streams past
      this.positions[zi] += distance * 0.92 + delta * 0.2;
      if (this.positions[zi] > b.maxZ) {
        this.positions[zi] -= depth;
        this.positions[i * 3] = THREE.MathUtils.randFloat(b.minX, b.maxX);
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.material.uniforms.time.value = elapsed;
    this.material.uniforms.pixelRatio.value = pixelRatio;
  }
}
