import * as THREE from "three";

/**
 * Shell-textured fur.
 *
 * Each furry mesh gets an InstancedMesh child that redraws its geometry N times; instance `i`
 * is pushed out along the normal by (i+1)/N * furLength. The fragment shader keeps only the
 * texels that belong to a hair strand at that height (per-cell random length, tapering
 * radius), so the stacked shells read as individual hairs with a soft, fuzzy silhouette.
 * One draw call per mesh, and the shells inherit IK/animation because they're children.
 */

export interface FurOptions {
  shells: number;
  length: number; // max hair length (object units)
  density: number; // strands per UV unit
  droop: number; // how much hair tips sag toward -Y (object space)
}

const DEFAULT_FUR: FurOptions = { shells: 10, length: 0.0095, density: 210, droop: 0.3 };

/** Lower shell count on weak GPUs (call before building the cats). */
export function setFurShellCount(count: number): void {
  DEFAULT_FUR.shells = Math.max(3, Math.round(count));
}

/** Shared animated uniforms: wind strength follows riding speed. */
export const furWind = {
  time: { value: 0 },
  strength: { value: 0 },
};

const shellMaterialCache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();

function getShellMaterial(base: THREE.MeshStandardMaterial, opts: FurOptions): THREE.MeshStandardMaterial {
  const cached = shellMaterialCache.get(base);
  if (cached) return cached;

  const mat = base.clone();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.furLength = { value: opts.length };
    shader.uniforms.furDensity = { value: opts.density };
    shader.uniforms.furDroop = { value: opts.droop };
    shader.uniforms.furTime = furWind.time;
    shader.uniforms.furWind = furWind.strength;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float furLength;
        uniform float furDroop;
        uniform float furTime;
        uniform float furWind;
        varying float vShellH;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vShellH = (float(gl_InstanceID) + 1.0) / ${opts.shells.toFixed(1)};
        transformed += normalize(objectNormal) * vShellH * furLength;
        transformed.y -= vShellH * vShellH * furLength * furDroop;
        // Riding wind combs the tips backward (+Z) with a fast flutter
        float flutter = 0.75 + 0.25 * sin(furTime * 14.0 + position.x * 60.0 + position.y * 45.0);
        transformed.z += vShellH * vShellH * furLength * furWind * flutter;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float furDensity;
        varying float vShellH;
        float furHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec2 furHash2(vec2 p) { return vec2(furHash(p), furHash(p + 17.31)); }`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec2 furUv = vMapUv * furDensity;
          vec2 cell = floor(furUv);
          // Jitter each strand inside its cell so hairs don't line up in rows
          vec2 local = fract(furUv) * 2.0 - 1.0 - (furHash2(cell) - 0.5) * 0.9;
          float strandLen = 0.35 + 0.65 * furHash(cell);
          if (vShellH > strandLen) discard;
          float taper = 1.0 - vShellH / strandLen;
          if (length(local) > taper * 1.1) discard;
          // Fake self-shadowing: hair roots are darker than tips
          diffuseColor.rgb *= mix(0.6, 1.08, vShellH);
        }`
      );
  };
  mat.customProgramCacheKey = () => `fur-shells-${opts.shells}`;
  shellMaterialCache.set(base, mat);
  return mat;
}

/** Adds a fur-shell layer under `mesh`. The base material must be a MeshStandardMaterial with a map. */
export function addFurShells(mesh: THREE.Mesh, options: Partial<FurOptions> = {}): THREE.InstancedMesh {
  const opts = { ...DEFAULT_FUR, ...options };
  const material = getShellMaterial(mesh.material as THREE.MeshStandardMaterial, opts);

  const shells = new THREE.InstancedMesh(mesh.geometry, material, opts.shells);
  const identity = new THREE.Matrix4();
  for (let i = 0; i < opts.shells; i++) shells.setMatrixAt(i, identity);
  shells.castShadow = false;
  shells.receiveShadow = true;
  shells.frustumCulled = false;
  shells.userData.isFurShell = true;
  mesh.add(shells);
  return shells;
}
