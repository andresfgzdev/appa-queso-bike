import * as THREE from "three";
import { FOG_COLOR, SKY_COLORS, SUN_DIRECTION } from "./SkyDome";

/**
 * One large ocean surface (not part of the road treadmill): the wave field scrolls with the
 * distance travelled instead. Vertex waves roll toward the shore; the fragment shader adds
 * ripple normals, Fresnel sky reflection, a sharp HDR sun glint, a breathing foam line and
 * wet sand where the water retreats.
 */
export const SHORE_X = 24; // where the wet-sand fade begins

export class Ocean {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const width = 360;
    const depth = 560;
    const geo = new THREE.PlaneGeometry(width, depth, 120, 160);
    geo.rotateX(-Math.PI / 2);
    geo.translate(SHORE_X + width / 2, 0, -depth / 2 + 40);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          time: { value: 0 },
          scroll: { value: 0 },
          shoreX: { value: SHORE_X },
          sunDir: { value: SUN_DIRECTION },
          sunColor: { value: SKY_COLORS.sun },
          zenith: { value: SKY_COLORS.zenith },
          horizon: { value: FOG_COLOR },
          deep: { value: new THREE.Color(0x0b4f6c) },
          shallow: { value: new THREE.Color(0x2fb3b0) },
          wetSand: { value: new THREE.Color(0xb88a5a) },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform float time;
        uniform float scroll;
        uniform float shoreX;
        varying vec3 vWorld;
        varying float vWave;

        float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
          return sin(dot(p, dir) * freq + time * speed) * amp;
        }

        void main() {
          vec3 pos = position;
          vec2 p = vec2(pos.x, pos.z - scroll);
          float swell = smoothstep(shoreX + 6.0, shoreX + 22.0, pos.x);
          float h = wave(p, normalize(vec2(-1.0, 0.25)), 0.32, 1.6, 0.16)
                  + wave(p, normalize(vec2(-0.8, -0.6)), 0.55, 2.1, 0.07)
                  + wave(p, normalize(vec2(-0.3, 1.0)), 0.9, 2.7, 0.035);
          pos.y = h * swell - 0.05;
          vWave = h;
          vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform float time;
        uniform float scroll;
        uniform float shoreX;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 deep;
        uniform vec3 shallow;
        uniform vec3 wetSand;
        varying vec3 vWorld;
        varying float vWave;

        float oHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float oNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(oHash(i), oHash(i + vec2(1, 0)), u.x), mix(oHash(i + vec2(0, 1)), oHash(i + vec2(1, 1)), u.x), u.y);
        }
        float ripples(vec2 p) {
          return oNoise(p * 1.3 + vec2(time * 0.4, time * 0.25)) * 0.6 + oNoise(p * 3.1 - vec2(time * 0.6, -time * 0.3)) * 0.4;
        }

        void main() {
          vec2 p = vec2(vWorld.x, vWorld.z - scroll);

          // Ripple normal from finite differences of the noise field
          float e = 0.15;
          float r = ripples(p);
          float rx = ripples(p + vec2(e, 0.0)) - r;
          float rz = ripples(p + vec2(0.0, e)) - r;
          vec3 n = normalize(vec3(-rx * 2.2, 1.0, -rz * 2.2));

          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);

          vec3 refl = reflect(-viewDir, n);
          vec3 skyRefl = mix(horizon, zenith, pow(clamp(refl.y, 0.0, 1.0), 0.6));
          float sunSpec = pow(max(dot(refl, sunDir), 0.0), 600.0) * 16.0 + pow(max(dot(refl, sunDir), 0.0), 40.0) * 0.6;

          float distToShore = vWorld.x - shoreX;
          vec3 body = mix(shallow, deep, smoothstep(4.0, 60.0, distToShore));
          body *= 0.75 + vWave * 0.8;
          vec3 water = mix(body, skyRefl, fresnel) + sunColor * sunSpec;

          // Breathing waterline: water rushes in and out over the sand
          float surge = sin(time * 0.75) * 1.1 + oNoise(vec2(p.y * 0.08, time * 0.2)) * 1.2;
          float waterline = 3.0 + surge;
          float wet = smoothstep(waterline - 0.2, waterline + 0.25, distToShore);
          float shoreOffset = (distToShore - waterline) * 1.6;
          float foamBand = exp(-shoreOffset * shoreOffset); // (pow() with a negative base is NaN in GLSL)
          float foamBreak = smoothstep(0.35, 0.75, oNoise(p * vec2(0.6, 1.8) + time * 0.3));
          float foamCrest = smoothstep(0.12, 0.22, vWave) * smoothstep(8.0, 20.0, distToShore) * 0.5;

          // Breaking sets: white-water lines rolling toward the shore from the surf zone
          // Bend each wave line along the shore so sets look organic, not ruled
          float bend = (oNoise(vec2(p.y * 0.035, 3.7)) - 0.5) * 1.6 + (oNoise(vec2(p.y * 0.11, 9.1)) - 0.5) * 0.5;
          float setPhase = distToShore / 9.0 + time * 0.16 + bend;
          float lineNoise = oNoise(vec2(p.y * 0.07, floor(setPhase) * 5.3));
          float breaker = smoothstep(0.88, 0.96, fract(setPhase)) * (1.0 - smoothstep(0.965, 1.0, fract(setPhase)));
          float surfZone = smoothstep(5.0, 9.0, distToShore) * (1.0 - smoothstep(26.0, 42.0, distToShore));
          float whitewater = breaker * surfZone * smoothstep(0.45, 0.85, lineNoise + foamBreak * 0.35) * 0.85;
          // Lingering foam trails behind each breaker
          float trail = smoothstep(0.55, 0.95, fract(setPhase)) * surfZone * foamBreak * 0.35;

          float foam = clamp(foamBand * (0.55 + 0.45 * foamBreak) + foamCrest * foamBreak + whitewater + trail, 0.0, 1.0);

          vec3 sand = wetSand * (0.85 + 0.15 * oNoise(p * 2.0));
          sand += sunColor * pow(max(dot(reflect(-viewDir, vec3(0, 1, 0)), sunDir), 0.0), 80.0) * 0.6; // wet sheen
          vec3 col = mix(sand, water, wet);
          col = mix(col, vec3(1.0, 0.97, 0.93), foam * 0.9);

          float alpha = smoothstep(0.0, 1.6, distToShore);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.position.y = 0.0; // sits just above the sand (-0.08) at the shoreline
  }

  public update(elapsed: number, distanceTravelled: number): void {
    this.material.uniforms.time.value = elapsed;
    this.material.uniforms.scroll.value = distanceTravelled;
  }
}
