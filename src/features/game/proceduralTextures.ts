import * as THREE from "three";

/**
 * Seamlessly tiling procedural textures (periodic value noise), generated once at startup.
 * Returns a colour map plus a matching bump map so grazing sunset light picks up detail.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value noise: tiles every `period` lattice cells. */
function makePeriodicNoise(period: number, seed: number) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(period * period).map(() => rand());
  const at = (x: number, y: number) => grid[((y % period) + period) % period * period + (((x % period) + period) % period)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    // u, v in [0, 1) map onto the full period
    const x = u * period;
    const y = v * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function fbm(octaves: ((u: number, v: number) => number)[], u: number, v: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (const n of octaves) {
    sum += n(u, v) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

interface GeneratedTexture {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

function generate(
  size: number,
  shade: (u: number, v: number) => { rgb: [number, number, number]; height: number }
): GeneratedTexture {
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = size;
  const cctx = colorCanvas.getContext("2d")!;
  const bctx = bumpCanvas.getContext("2d")!;
  const color = cctx.createImageData(size, size);
  const bump = bctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const { rgb, height } = shade(x / size, y / size);
      const i = (y * size + x) * 4;
      color.data[i] = rgb[0];
      color.data[i + 1] = rgb[1];
      color.data[i + 2] = rgb[2];
      color.data[i + 3] = 255;
      const h = Math.max(0, Math.min(255, height * 255));
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = h;
      bump.data[i + 3] = 255;
    }
  }
  cctx.putImageData(color, 0, 0);
  bctx.putImageData(bump, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  for (const t of [map, bumpTex]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
  }
  return { map, bump: bumpTex };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Warm beach sand: fine grain + wind ripples. */
export function createSandTexture(): GeneratedTexture {
  const n1 = makePeriodicNoise(8, 11);
  const n2 = makePeriodicNoise(32, 12);
  const n3 = makePeriodicNoise(128, 13);
  const grain = makePeriodicNoise(256, 14);
  return generate(256, (u, v) => {
    const broad = fbm([n1, n2], u, v);
    const warp = n2(u, v) * 0.6;
    const ripple = 0.5 + 0.5 * Math.sin((v * 12 + warp) * Math.PI * 2);
    const g = grain(u, v);
    const fine = n3(u, v);
    const tone = 0.86 + broad * 0.14 + (g - 0.5) * 0.12 + (ripple - 0.5) * 0.05;
    return {
      rgb: [mix(214, 246, tone) * tone, mix(170, 214, tone) * tone, mix(112, 150, tone) * tone],
      height: ripple * 0.55 + fine * 0.25 + g * 0.2,
    };
  });
}

/** Sun-bleached promenade concrete: aggregate speckle, mottling and an expansion joint per tile. */
export function createConcreteTexture(): GeneratedTexture {
  const n1 = makePeriodicNoise(4, 21);
  const n2 = makePeriodicNoise(16, 22);
  const speck = makePeriodicNoise(256, 23);
  return generate(256, (u, v) => {
    const mottle = fbm([n1, n2], u, v);
    const s = speck(u, v);
    const aggregate = s > 0.82 ? -0.12 : s < 0.1 ? 0.06 : 0;
    // Expansion joint along the tile edge (top row) and a faint saw-cut on the side
    const joint = v < 0.006 || v > 0.994 ? -0.14 : 0;
    const side = u < 0.004 || u > 0.996 ? -0.05 : 0;
    const tone = 0.9 + (mottle - 0.5) * 0.12 + aggregate + joint + side + (s - 0.5) * 0.05;
    return {
      rgb: [242 * tone, 230 * tone, 206 * tone],
      height: 0.6 + aggregate * 1.5 + joint * 2 + (s - 0.5) * 0.15,
    };
  });
}

/** Weathered street asphalt: dark aggregate, patching, faint tyre polish. */
export function createAsphaltTexture(): GeneratedTexture {
  const n1 = makePeriodicNoise(4, 31);
  const n2 = makePeriodicNoise(32, 32);
  const speck = makePeriodicNoise(256, 33);
  return generate(256, (u, v) => {
    const patch = fbm([n1, n2], u, v);
    const s = speck(u, v);
    const aggregate = s > 0.78 ? 0.12 : s < 0.15 ? -0.06 : 0;
    const tone = 0.42 + (patch - 0.5) * 0.12 + aggregate + (s - 0.5) * 0.06;
    return { rgb: [110 * tone * 1.9, 108 * tone * 1.9, 106 * tone * 1.9], height: 0.5 + aggregate + (s - 0.5) * 0.3 };
  });
}
