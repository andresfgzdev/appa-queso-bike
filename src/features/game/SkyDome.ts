import * as THREE from "three";

/** Shared golden-hour palette (linear colours) so sky, fog, ocean and lights agree. */
export const SUN_DIRECTION = new THREE.Vector3(0.55, 0.24, -0.8).normalize();
export const SKY_COLORS = {
  zenith: new THREE.Color(0x6f8fc8),
  horizon: new THREE.Color(0xffc9a0),
  horizonSun: new THREE.Color(0xff9a52),
  ground: new THREE.Color(0xe9b98a),
  sun: new THREE.Color(0xffd59a),
};
/** Fog uses the horizon tint so the road dissolves seamlessly into the sky. */
export const FOG_COLOR = new THREE.Color(0xffc7a2);

const NOISE_GLSL = /* glsl */ `
  float skyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float skyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
               mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float skyFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * skyNoise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

export function createSkyMaterial(sunIntensity = 3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDir: { value: SUN_DIRECTION },
      zenith: { value: SKY_COLORS.zenith },
      horizon: { value: SKY_COLORS.horizon },
      horizonSun: { value: SKY_COLORS.horizonSun },
      ground: { value: SKY_COLORS.ground },
      sunColor: { value: SKY_COLORS.sun },
      fogTint: { value: FOG_COLOR },
      sunIntensity: { value: sunIntensity },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // pin to the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 horizonSun;
      uniform vec3 ground;
      uniform vec3 sunColor;
      uniform vec3 fogTint;
      uniform float sunIntensity;
      uniform float time;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sunAmt = max(dot(d, sunDir), 0.0);

        vec3 hor = mix(horizon, horizonSun, pow(sunAmt, 5.0));
        vec3 col = h >= 0.0 ? mix(hor, zenith, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(hor, ground, clamp(-h * 4.0, 0.0, 1.0));

        // Sun disc + layered glow (HDR, feeds the bloom pass)
        float disc = smoothstep(0.9991, 0.99975, sunAmt);
        float glow = pow(sunAmt, 900.0) * 1.6 + pow(sunAmt, 120.0) * 0.8 + pow(sunAmt, 18.0) * 0.35 + pow(sunAmt, 4.0) * 0.15;
        col += sunColor * glow + mix(sunColor, vec3(1.0, 0.96, 0.9), 0.7) * disc * sunIntensity;

        // Procedural cumulus band near the horizon, back-lit by the sun
        if (h > 0.005) {
          vec2 uv = d.xz / (h + 0.12) * 0.7 + vec2(time * 0.004, time * 0.0015);
          float n = skyFbm(uv * 1.3);
          float band = smoothstep(0.005, 0.07, h) * (1.0 - smoothstep(0.22, 0.5, h));
          float cover = smoothstep(0.52, 0.78, n) * band;
          float thickness = skyFbm(uv * 1.3 + sunDir.xz * 0.12);
          vec3 shade = mix(vec3(0.95, 0.66, 0.62), vec3(1.0, 0.86, 0.72), clamp(n - thickness + 0.6, 0.0, 1.0));
          vec3 rim = sunColor * pow(sunAmt, 10.0) * 2.2 * (1.0 - smoothstep(0.55, 0.8, n));
          col = mix(col, shade + rim, cover * 0.9);
        }

        // Distant coastal mountains on the inland side (Santa Monica Mtns / Palos Verdes),
        // two ridgelines fading into the marine haze
        float inland = 1.0 - smoothstep(-0.05, 0.3, d.x / max(length(d.xz), 1e-4));
        if (inland > 0.0 && h > -0.01) {
          float az = atan(d.x, -d.z);
          float farRidge = 0.03 + 0.055 * skyFbm(vec2(az * 2.6, 3.1)) + 0.02 * skyFbm(vec2(az * 9.0, 7.7));
          float nearRidge = 0.012 + 0.03 * skyFbm(vec2(az * 4.3 + 11.0, 1.3)) + 0.012 * skyFbm(vec2(az * 14.0, 4.2));
          farRidge *= inland;
          nearRidge *= inland;
          vec3 farCol = mix(fogTint, vec3(0.66, 0.58, 0.68), 0.38);
          vec3 nearCol = mix(fogTint, vec3(0.52, 0.47, 0.52), 0.5);
          // Sun-facing slopes catch a warm glow
          farCol += sunColor * 0.06 * pow(sunAmt, 2.0);
          // Clamp the blend: where the ridge fades to ~0 height, h / ridge would explode
          float hh = max(h, 0.0);
          if (farRidge > 0.002 && hh < farRidge) col = mix(farCol, fogTint, 0.55 * clamp(1.0 - hh / farRidge, 0.0, 1.0));
          if (nearRidge > 0.002 && hh < nearRidge) col = mix(nearCol, fogTint, 0.45 * clamp(1.0 - hh / nearRidge, 0.0, 1.0));
        }

        // Horizon haze matches the scene fog
        col = mix(col, fogTint, (1.0 - smoothstep(0.0, 0.08, abs(h))) * 0.55);
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
}

export class SkyDome {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = createSkyMaterial();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  public update(camera: THREE.Camera, elapsed: number): void {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.time.value = elapsed;
  }

  /** Bakes the sky into a prefiltered environment map for image-based lighting. */
  public static createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
    const scene = new THREE.Scene();
    const mat = createSkyMaterial(5);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), mat);
    scene.add(dome);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(scene, 0.02, 0.1, 500).texture;
    pmrem.dispose();
    dome.geometry.dispose();
    mat.dispose();
    return env;
  }
}
