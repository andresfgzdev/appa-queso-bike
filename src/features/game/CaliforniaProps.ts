import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural Southern-California beach-front kit (Santa Monica / Venice vibes).
 * Every builder returns plain meshes using a few shared materials so RoadManager can bake
 * each road chunk into a handful of draw calls.
 */

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Paints a flat vertex colour onto a geometry (non-indexed, uv kept when `keepUv`). */
export function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, keepUv = false): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!keepUv) g.deleteAttribute("uv");
  return g;
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const BUILDING_COLORS = [0xf3e3c8, 0xf2b8a2, 0xa8d5c9, 0xf6d38a, 0xbcd4ec, 0xf7f3ea, 0xe8a87c, 0xd6c1e6];
const TOWER_COLORS = [0x6cc5d9, 0xf4a6b8, 0xf7d46b, 0x9fd8a8, 0xb9a6e8];
const BOARD_COLORS = [0xff7b54, 0x4cc9f0, 0xffd166, 0xf8f9fa, 0x06d6a0, 0xef476f];

export class CaliforniaProps {
  /** Wall material: window/facade atlas multiplied by per-building vertex colour. */
  public facadeMat: THREE.MeshStandardMaterial;
  /** Warm emissive globes (lamps, pier lights) — blooms in post. */
  public glowMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc77a, emissiveIntensity: 3.5, roughness: 0.4 });
  public netMat: THREE.MeshStandardMaterial;
  public lawnMat: THREE.MeshStandardMaterial;

  constructor() {
    this.facadeMat = new THREE.MeshStandardMaterial({
      map: this.createFacadeTexture(),
      vertexColors: true,
      roughness: 0.75,
    });
    this.netMat = new THREE.MeshStandardMaterial({
      map: canvasTexture(64, (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = "#f5f5f5";
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, s, s);
      }),
      alphaTest: 0.5,
      transparent: false,
      side: THREE.DoubleSide,
    });
    this.netMat.map!.repeat.set(22, 3);
    this.lawnMat = new THREE.MeshStandardMaterial({ map: this.createLawnTexture(), roughness: 1 });
  }

  // ---------------------------------------------------------------------------
  // Textures
  // ---------------------------------------------------------------------------

  /** One bay × one storey: plaster wall, framed window with warm sky reflection. */
  private createFacadeTexture(): THREE.CanvasTexture {
    return canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, s, s);
      // Plaster mottling
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
      // Floor line
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, s - 4, s, 4);
      // Window
      const x0 = s * 0.2, x1 = s * 0.8, y0 = s * 0.18, y1 = s * 0.72;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
      const glass = ctx.createLinearGradient(0, y0, 0, y1);
      glass.addColorStop(0, "#f9c79a");
      glass.addColorStop(0.45, "#9aa9c2");
      glass.addColorStop(1, "#2b3446");
      ctx.fillStyle = glass;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Mullion + reflection streak
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((x0 + x1) / 2 - 1.5, y0, 3, y1 - y0);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(x0 + 8, y1);
      ctx.lineTo(x0 + 22, y0);
      ctx.lineTo(x0 + 30, y0);
      ctx.lineTo(x0 + 16, y1);
      ctx.fill();
      // Sill shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x0 - 6, y1 + 5, x1 - x0 + 12, 4);
    });
  }

  private createLawnTexture(): THREE.CanvasTexture {
    const tex = canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = "#6f9a3e";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const g = 110 + Math.random() * 70;
        ctx.strokeStyle = `rgba(${g * 0.55},${g},${g * 0.35},0.6)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 3);
        ctx.stroke();
      }
      // Mowing stripes
      for (let y = 0; y < s; y += 32) {
        ctx.fillStyle = (y / 32) % 2 ? "rgba(255,255,200,0.05)" : "rgba(0,40,0,0.05)";
        ctx.fillRect(0, y, s, 32);
      }
    });
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Builders
  // ---------------------------------------------------------------------------

  /** Beach-front building facing +X (toward the boardwalk). */
  public building(width: number, depth: number, floors: number): THREE.Group {
    const g = new THREE.Group();
    const storey = 3.2;
    const bay = 3.0;
    const height = floors * storey;
    const color = pick(BUILDING_COLORS);
    const props = (geo: THREE.BufferGeometry, c: THREE.ColorRepresentation) => new THREE.Mesh(tint(geo, c), new THREE.MeshStandardMaterial({ color: c as number }));

    const wall = (w: number, rotY: number, x: number, z: number) => {
      const geo = new THREE.PlaneGeometry(w, height);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / bay)), uv.getY(i) * floors);
      geo.rotateY(rotY);
      geo.translate(x, height / 2, z);
      const mesh = new THREE.Mesh(tint(geo, color, true), this.facadeMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    wall(width, Math.PI / 2, depth / 2, 0); // front (faces +X)
    wall(depth, 0, 0, width / 2); // side facing +Z
    wall(depth, Math.PI, 0, -width / 2); // side facing -Z

    // Roof slab with parapet + rooftop clutter
    const roof = props(new THREE.BoxGeometry(depth + 0.3, 0.45, width + 0.3).translate(0, height + 0.22, 0), 0xe9e2d6);
    g.add(roof);
    if (Math.random() < 0.7) {
      g.add(props(new THREE.BoxGeometry(1.2, 0.8, 1.6).translate((Math.random() - 0.5) * depth * 0.5, height + 0.85, (Math.random() - 0.5) * width * 0.4), 0xc9c4bc));
    }
    // Ground-floor awning in a contrasting colour
    const awningColor = pick([0x2a9d8f, 0xe76f51, 0x264653, 0xf4a261, 0x1d3557]);
    const awning = new THREE.BoxGeometry(1.4, 0.08, width * 0.85);
    awning.rotateZ(-0.35);
    awning.translate(depth / 2 + 0.6, 2.9, 0);
    g.add(props(awning, awningColor));
    return g;
  }

  /** Vintage double-globe promenade lamp post. */
  public streetLamp(): THREE.Group {
    const g = new THREE.Group();
    const dark = 0x23362d;
    const parts = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 10).translate(0, 0.25, 0), dark),
      tint(new THREE.CylinderGeometry(0.055, 0.075, 4.2, 10).translate(0, 2.6, 0), dark),
      tint(new THREE.BoxGeometry(1.1, 0.06, 0.06).translate(0, 4.45, 0), dark),
      tint(new THREE.ConeGeometry(0.2, 0.18, 10).translate(-0.5, 4.75, 0), dark),
      tint(new THREE.ConeGeometry(0.2, 0.18, 10).translate(0.5, 4.75, 0), dark),
    ]);
    const post = new THREE.Mesh(parts, new THREE.MeshStandardMaterial({ color: dark }));
    post.castShadow = true;
    g.add(post);
    for (const x of [-0.5, 0.5]) {
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), this.glowMat);
      globe.position.set(x, 4.58, 0);
      g.add(globe);
    }
    return g;
  }

  /** LA County-style lifeguard tower on stilts with a ramp. */
  public lifeguardTower(): THREE.Group {
    const g = new THREE.Group();
    const body = pick(TOWER_COLORS);
    const white = 0xf6f4ee;
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      parts.push(tint(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8).translate(x, 1.2, z), white));
    }
    parts.push(tint(new THREE.BoxGeometry(2.8, 0.14, 2.8).translate(0, 2.45, 0), white)); // deck
    parts.push(tint(new THREE.BoxGeometry(2.0, 1.5, 2.0).translate(0, 3.27, 0), body)); // hut
    parts.push(tint(new THREE.BoxGeometry(2.04, 0.5, 2.04).translate(0, 3.45, 0), 0x2a3340)); // window band
    parts.push(tint(new THREE.BoxGeometry(2.6, 0.12, 2.6).translate(0, 4.08, 0), white)); // roof
    parts.push(tint(new THREE.BoxGeometry(2.8, 0.05, 0.05).translate(0, 2.95, 1.4), white)); // railings
    parts.push(tint(new THREE.BoxGeometry(2.8, 0.05, 0.05).translate(0, 2.95, -1.4), white));
    const ramp = new THREE.BoxGeometry(3.4, 0.08, 0.9);
    ramp.rotateZ(0.72);
    ramp.translate(-2.5, 1.2, 0);
    parts.push(tint(ramp, white));
    parts.push(tint(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6).translate(0.9, 5.1, 0.9), white)); // flag pole
    parts.push(tint(new THREE.BoxGeometry(0.02, 0.45, 0.7).translate(0.9, 5.95, 1.25), 0xd62828)); // flag
    const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: body }));
    mesh.castShadow = true;
    g.add(mesh);
    return g;
  }

  /** Beach volleyball court: posts, net, boundary lines. */
  public volleyballNet(): THREE.Group {
    const g = new THREE.Group();
    const posts = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8).translate(0, 1.3, -4.6), 0xe0e0e0),
      tint(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8).translate(0, 1.3, 4.6), 0xe0e0e0),
      tint(new THREE.BoxGeometry(0.04, 0.08, 9.2).translate(0, 2.45, 0), 0xffffff),
    ]);
    const postMesh = new THREE.Mesh(posts, new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }));
    postMesh.castShadow = true;
    g.add(postMesh);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.9).rotateY(Math.PI / 2).translate(0, 1.95, 0), this.netMat);
    net.castShadow = true;
    g.add(net);
    const lines = mergeGeometries([
      tint(new THREE.BoxGeometry(16, 0.01, 0.08).translate(0, -0.07, -4.0), 0x1f6fb2),
      tint(new THREE.BoxGeometry(16, 0.01, 0.08).translate(0, -0.07, 4.0), 0x1f6fb2),
      tint(new THREE.BoxGeometry(0.08, 0.01, 8).translate(-8, -0.07, 0), 0x1f6fb2),
      tint(new THREE.BoxGeometry(0.08, 0.01, 8).translate(8, -0.07, 0), 0x1f6fb2),
    ]);
    g.add(new THREE.Mesh(lines, new THREE.MeshStandardMaterial({ color: 0x1f6fb2 })));
    return g;
  }

  /** A few surfboards planted nose-up in the sand. */
  public surfboards(): THREE.Group {
    const g = new THREE.Group();
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const board = new THREE.SphereGeometry(1, 16, 12);
      board.scale(0.27, 1.05, 0.045);
      const color = pick(BOARD_COLORS);
      const stripe = new THREE.BoxGeometry(0.05, 1.7, 0.1);
      const mesh = new THREE.Mesh(
        mergeGeometries([tint(board, color), tint(stripe, 0xffffff)]),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.set(i * 0.6, 0.85, (Math.random() - 0.5) * 0.4);
      mesh.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /** Low beach chair with striped fabric. */
  public beachChair(): THREE.Group {
    const g = new THREE.Group();
    const fabric = pick([0x2a9d8f, 0xe76f51, 0xffb703, 0x219ebc]);
    const seat = new THREE.BoxGeometry(0.55, 0.04, 0.6).translate(0, 0.25, 0);
    const back = new THREE.BoxGeometry(0.55, 0.65, 0.04);
    back.rotateX(-0.45);
    back.translate(0, 0.52, 0.38);
    const legs = new THREE.BoxGeometry(0.6, 0.25, 0.04).translate(0, 0.12, -0.2);
    const mesh = new THREE.Mesh(
      mergeGeometries([tint(seat, fabric), tint(back, fabric), tint(legs, 0xdedede)]),
      new THREE.MeshStandardMaterial({ color: fabric })
    );
    mesh.castShadow = true;
    g.add(mesh);
    return g;
  }

  public cooler(): THREE.Mesh {
    const body = pick([0x1d70b8, 0xd62828, 0x2a9d8f]);
    const mesh = new THREE.Mesh(
      mergeGeometries([
        tint(new THREE.BoxGeometry(0.6, 0.38, 0.4).translate(0, 0.19, 0), body),
        tint(new THREE.BoxGeometry(0.62, 0.07, 0.42).translate(0, 0.41, 0), 0xf5f5f5),
      ]),
      new THREE.MeshStandardMaterial({ color: body })
    );
    mesh.castShadow = true;
    return mesh;
  }

  /** Classic blue beach trash barrel. */
  public trashCan(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      mergeGeometries([
        tint(new THREE.CylinderGeometry(0.33, 0.3, 0.95, 14).translate(0, 0.475, 0), 0x2f6690),
        tint(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 14).translate(0, 0.96, 0), 0x1f4e6e),
      ]),
      new THREE.MeshStandardMaterial({ color: 0x2f6690 })
    );
    mesh.castShadow = true;
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // Streetscape & beach-life builders (all vertex-coloured → bake into one call)
  // ---------------------------------------------------------------------------

  private static mesh(parts: THREE.BufferGeometry[], cast = true): THREE.Mesh {
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    m.castShadow = cast;
    return m;
  }

  /** Parked car with a random paint colour. */
  public car(kind: "sedan" | "van" = Math.random() < 0.12 ? "van" : "sedan"): THREE.Mesh {
    return CaliforniaProps.mesh([createCarGeometry(kind, pick(CAR_COLORS))]);
  }

  /** Magenta bougainvillea shrub: a clump of leafy and flowering blobs. */
  public bougainvillea(): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    // Leafy green body…
    const n = 9 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const r = 0.22 + Math.random() * 0.22;
      const blob = new THREE.IcosahedronGeometry(r, 1);
      blob.translate((Math.random() - 0.5) * 1.3, r * 0.8 + Math.random() * 0.55, (Math.random() - 0.5) * 1.3);
      parts.push(tint(blob, pick([0x2f6b2a, 0x3d7a33, 0x35702c])));
    }
    // …dotted with small magenta bract clusters on the outside
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.55 + Math.random() * 0.25;
      const bloom = new THREE.IcosahedronGeometry(0.09 + Math.random() * 0.07, 0);
      bloom.translate(Math.cos(a) * r, 0.35 + Math.random() * 0.75, Math.sin(a) * r);
      parts.push(tint(bloom, pick([0xd6336c, 0xe64980, 0xc2255c, 0xf06595])));
    }
    return CaliforniaProps.mesh(parts);
  }

  /** Blue-green agave rosette. */
  public agave(): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    const leaves = 11;
    for (let i = 0; i < leaves; i++) {
      const leaf = new THREE.ConeGeometry(0.09, 0.9 + Math.random() * 0.3, 4);
      leaf.translate(0, 0.45, 0);
      leaf.rotateZ(0.45 + Math.random() * 0.5);
      leaf.rotateY((i / leaves) * Math.PI * 2);
      parts.push(tint(leaf, pick([0x6f9c8a, 0x5c8a78, 0x7fae96])));
    }
    return CaliforniaProps.mesh(parts);
  }

  /** Low flower bed: mulch border with dots of colour. */
  public flowerBed(width = 3, depth = 1.2): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [tint(new THREE.BoxGeometry(depth, 0.18, width).translate(0, 0.09, 0), 0x5b3e2b)];
    const colors = [0xffd166, 0xef476f, 0xffffff, 0xf78c6b, 0x9b5de5];
    for (let i = 0; i < 46; i++) {
      const f = new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.03, 0);
      f.translate((Math.random() - 0.5) * depth * 0.85, 0.25 + Math.random() * 0.1, (Math.random() - 0.5) * width * 0.9);
      parts.push(tint(f, Math.random() < 0.35 ? 0x3d7a33 : pick(colors)));
    }
    return CaliforniaProps.mesh(parts, false);
  }

  /** Street tree (ficus-like rounded canopy). */
  public streetTree(): THREE.Mesh {
    const h = 2.6 + Math.random() * 1.2;
    const parts: THREE.BufferGeometry[] = [tint(new THREE.CylinderGeometry(0.12, 0.18, h, 8).translate(0, h / 2, 0), 0x6b5440)];
    for (let i = 0; i < 6; i++) {
      const r = 0.8 + Math.random() * 0.5;
      const blob = new THREE.IcosahedronGeometry(r, 1);
      blob.translate((Math.random() - 0.5) * 1.4, h + Math.random() * 0.9, (Math.random() - 0.5) * 1.4);
      parts.push(tint(blob, pick([0x3f6f2f, 0x4a7d36, 0x365f29])));
    }
    parts.push(tint(new THREE.BoxGeometry(1.2, 0.05, 1.2).translate(0, 0.02, 0), 0x4a3a2c)); // tree grate
    return CaliforniaProps.mesh(parts);
  }

  /** Sidewalk café table with chairs and a small umbrella. */
  public cafeTable(): THREE.Mesh {
    const umbrella = pick([0xffffff, 0x2a9d8f, 0xe76f51, 0x264653]);
    const parts = [
      tint(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 14).translate(0, 0.75, 0), 0xf2f2f2),
      tint(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6).translate(0, 0.37, 0), 0x333333),
      tint(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6).translate(0, 1.1, 0), 0xdddddd),
      tint(new THREE.ConeGeometry(1.0, 0.35, 8).translate(0, 2.2, 0), umbrella),
    ];
    for (const a of [0, Math.PI]) {
      const x = Math.cos(a) * 0.62;
      parts.push(tint(new THREE.BoxGeometry(0.4, 0.04, 0.4).translate(x, 0.45, 0), 0x2b2b2b));
      parts.push(tint(new THREE.BoxGeometry(0.04, 0.4, 0.4).translate(x + Math.sign(x) * 0.2, 0.67, 0), 0x2b2b2b));
      parts.push(tint(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6).translate(x, 0.22, 0), 0x2b2b2b));
    }
    return CaliforniaProps.mesh(parts);
  }

  /** Bike rack with one or two parked cruisers. */
  public bikeRack(): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    // Inverted-U hoops, parallel to the parked bikes (bikes run along Z)
    for (let i = 0; i < 3; i++) {
      parts.push(tint(new THREE.TorusGeometry(0.38, 0.03, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(-0.2 + i * 0.7, 0, 0), 0x9aa0a6));
    }
    const n = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < n; b++) {
      const color = pick(BOARD_COLORS);
      const x = 0.15 + b * 0.7;
      for (const dz of [-0.5, 0.5]) {
        parts.push(tint(new THREE.TorusGeometry(0.32, 0.03, 6, 20).rotateY(Math.PI / 2).translate(x, 0.33, dz), 0x1d1d1d));
      }
      parts.push(tint(new THREE.BoxGeometry(0.05, 0.05, 1.0).translate(x, 0.62, 0), color));
      parts.push(tint(new THREE.BoxGeometry(0.05, 0.55, 0.05).translate(x, 0.55, -0.35), color));
      parts.push(tint(new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(x, 0.5, 0.3), color));
      parts.push(tint(new THREE.BoxGeometry(0.5, 0.04, 0.04).translate(x, 0.95, -0.4), 0xcccccc));
      parts.push(tint(new THREE.BoxGeometry(0.16, 0.05, 0.24).translate(x, 0.85, 0.3), 0x5a3a22));
    }
    return CaliforniaProps.mesh(parts);
  }

  /** Picnic blanket with a basket. */
  public picnic(): THREE.Mesh {
    return CaliforniaProps.mesh(
      [
        tint(new THREE.BoxGeometry(1.8, 0.02, 1.5).translate(0, 0.01, 0), pick([0xd62828, 0x1d70b8, 0xf4a261])),
        tint(new THREE.BoxGeometry(0.45, 0.28, 0.3).translate(0.4, 0.15, 0.3), 0xb07d48),
      ],
      false
    );
  }

  /** Pop-up beach canopy tent. */
  public popUpTent(): THREE.Mesh {
    const top = pick([0x219ebc, 0xffb703, 0xfb8500, 0x8ecae6, 0xffffff]);
    const parts = [tint(new THREE.ConeGeometry(2.2, 0.5, 4).rotateY(Math.PI / 4).translate(0, 2.35, 0), top)];
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      parts.push(tint(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6).translate(x, 1.05, z), 0xcfcfcf));
    }
    parts.push(tint(new THREE.BoxGeometry(3, 0.25, 0.02).translate(0, 2.0, -1.5), top));
    return CaliforniaProps.mesh(parts);
  }

  /** Concrete beach fire ring (SoCal classic). */
  public fireRing(): THREE.Mesh {
    return CaliforniaProps.mesh([
      tint(new THREE.CylinderGeometry(0.75, 0.8, 0.55, 18, 1, true).translate(0, 0.27, 0), 0x8f8a83),
      tint(new THREE.TorusGeometry(0.77, 0.06, 6, 18).rotateX(Math.PI / 2).translate(0, 0.55, 0), 0x9c968e),
      tint(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 18).translate(0, 0.08, 0), 0x2b2522),
    ]);
  }

  /** Sandcastle with towers. */
  public sandCastle(): THREE.Mesh {
    const sand = 0xd9b77e;
    const parts = [tint(new THREE.BoxGeometry(1.0, 0.35, 1.0).translate(0, 0.17, 0), sand)];
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
      parts.push(tint(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 8).translate(x, 0.27, z), sand));
      parts.push(tint(new THREE.ConeGeometry(0.18, 0.25, 8).translate(x, 0.67, z), 0xcfa86f));
    }
    parts.push(tint(new THREE.TorusGeometry(0.9, 0.08, 4, 20).rotateX(Math.PI / 2).translate(0, 0.0, 0), 0xb89a66)); // moat rim
    parts.push(tint(new THREE.SphereGeometry(0.12, 8, 6).translate(1.2, 0.12, 0.5), 0x2ec4b6)); // bucket
    return CaliforniaProps.mesh(parts);
  }

  /** Classic beach ball. */
  public beachBall(): THREE.Mesh {
    const ball = new THREE.SphereGeometry(0.22, 12, 8).toNonIndexed();
    const pos = ball.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const palette = [0xef476f, 0xffffff, 0x118ab2, 0xffd166, 0xffffff, 0x06d6a0].map((c) => new THREE.Color(c));
    for (let i = 0; i < pos.count; i += 3) {
      const a = Math.atan2(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2), pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2));
      const c = palette[Math.floor(((a + Math.PI) / (Math.PI * 2)) * palette.length) % palette.length];
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    ball.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    ball.deleteAttribute("uv");
    ball.translate(0, 0.2, 0);
    return CaliforniaProps.mesh([ball]);
  }

  /** Beach shower post. */
  public showerPost(): THREE.Mesh {
    return CaliforniaProps.mesh([
      tint(new THREE.BoxGeometry(0.9, 0.08, 0.9).translate(0, 0.04, 0), 0xbfb6a8),
      tint(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8).translate(0, 1.15, 0), 0x8d99ae),
      tint(new THREE.BoxGeometry(0.06, 0.06, 0.45).translate(0, 2.25, 0.2), 0x8d99ae),
      tint(new THREE.CylinderGeometry(0.1, 0.06, 0.08, 10).translate(0, 2.18, 0.42), 0xc0c0c0),
    ]);
  }

  /** Surf rental shack with boards leaning on the wall. */
  public surfShack(): THREE.Group {
    const g = new THREE.Group();
    const wood = 0xc49a6c;
    const parts = [
      tint(new THREE.BoxGeometry(3.2, 2.4, 3.6).translate(0, 1.2, 0), wood),
      tint(new THREE.BoxGeometry(3.8, 0.15, 4.2).rotateZ(0.12).translate(0, 2.55, 0), 0x6d4c33),
      tint(new THREE.BoxGeometry(0.05, 0.9, 2.2).translate(1.62, 1.4, 0), 0x2b2f36), // service window
      tint(new THREE.BoxGeometry(0.5, 0.06, 2.4).translate(1.85, 0.95, 0), 0x8a6a4e), // counter
      tint(new THREE.BoxGeometry(0.4, 0.6, 3.4).translate(-0.2, 2.9, 0), pick([0x219ebc, 0xef476f, 0xffb703])), // sign board
    ];
    for (let i = 0; i < 4; i++) {
      const board = new THREE.SphereGeometry(1, 12, 8).scale(0.26, 1.0, 0.04);
      board.rotateX(0.15);
      board.translate(1.75, 1.05, -1.4 + i * 0.4);
      parts.push(tint(board, pick(BOARD_COLORS)));
    }
    const shack = CaliforniaProps.mesh(parts);
    g.add(shack);
    return g;
  }

  /** Low vegetated dune hummock to break up the flat sand. */
  public duneMound(): THREE.Mesh {
    const r = 1.5 + Math.random() * 1.5;
    const mound = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    mound.scale(1.4, 0.22, 1);
    const parts = [tint(mound, 0xd8b47c)];
    for (let i = 0; i < 14; i++) {
      const h = 0.35 + Math.random() * 0.4;
      const blade = new THREE.ConeGeometry(0.02, h, 3);
      blade.translate(0, h / 2, 0);
      blade.rotateZ((Math.random() - 0.5) * 0.7);
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.8;
      blade.translate(Math.cos(a) * d * 1.4, r * 0.22 * (1 - (d / r) ** 2) * 0.9, Math.sin(a) * d);
      parts.push(tint(blade, pick([0x8aa65a, 0x9fb86b, 0x7c9a4f])));
    }
    return CaliforniaProps.mesh(parts, false);
  }
}

const CAR_COLORS = [0xf1faee, 0x1d3557, 0xe63946, 0x8d99ae, 0x2a9d8f, 0xffd166, 0x222222, 0xc0c0c0, 0x457b9d, 0xf4a261];

/**
 * Low-poly car (front toward -Z). `body` colours the paint; pass white for instanced
 * traffic so per-instance colours can tint it.
 */
export function createCarGeometry(kind: "sedan" | "van", body: number): THREE.BufferGeometry {
  const glass = 0x1b2430;
  const dark = 0x161616;
  const parts: THREE.BufferGeometry[] = [];
  const taper = (geo: THREE.BufferGeometry, sx: number, sz: number) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * sx, p.getY(i), p.getZ(i) * sz);
    return geo;
  };

  if (kind === "sedan") {
    parts.push(tint(new THREE.BoxGeometry(1.8, 0.62, 4.5).translate(0, 0.56, 0), body));
    parts.push(tint(taper(new THREE.BoxGeometry(1.6, 0.55, 2.3), 0.88, 0.78).translate(0, 1.14, 0.2), glass));
    parts.push(tint(taper(new THREE.BoxGeometry(1.42, 0.06, 1.75), 1, 1).translate(0, 1.43, 0.2), body));
  } else {
    // VW-bus style two-tone van
    parts.push(tint(new THREE.BoxGeometry(1.8, 0.9, 3.9).translate(0, 0.72, 0), body));
    parts.push(tint(new THREE.BoxGeometry(1.81, 0.42, 3.7).translate(0, 1.38, 0.05), glass));
    // Window pillars break the glass band into separate windows
    for (const z of [-1.75, -0.95, -0.1, 0.75, 1.6]) {
      parts.push(tint(new THREE.BoxGeometry(1.83, 0.42, 0.12).translate(0, 1.38, z), 0xf5f1e8));
    }
    parts.push(tint(new THREE.BoxGeometry(1.8, 0.26, 3.85).translate(0, 1.72, 0.05), 0xf5f1e8));
    // Rounded nose: V-shaped two-tone front
    parts.push(tint(new THREE.BoxGeometry(1.4, 0.5, 0.06).translate(0, 0.95, -1.97), 0xf5f1e8));
    parts.push(tint(new THREE.BoxGeometry(0.9, 0.04, 1.8).translate(0, 1.87, 0.3), 0x9aa0a6)); // roof rack
  }
  for (const [x, z] of [[-0.88, -1.42], [0.88, -1.42], [-0.88, 1.42], [0.88, 1.42]]) {
    parts.push(tint(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2).translate(x, 0.34, z), dark));
    parts.push(tint(new THREE.CylinderGeometry(0.17, 0.17, 0.27, 10).rotateZ(Math.PI / 2).translate(x, 0.34, z), 0xbfc3c8));
  }
  const len = kind === "sedan" ? 2.25 : 1.95;
  for (const x of [-0.62, 0.62]) {
    parts.push(tint(new THREE.BoxGeometry(0.32, 0.12, 0.04).translate(x, 0.68, -len - 0.01), 0xfff4d6));
    parts.push(tint(new THREE.BoxGeometry(0.32, 0.12, 0.04).translate(x, 0.68, len + 0.01), 0xb3121b));
  }
  parts.push(tint(new THREE.BoxGeometry(1.84, 0.14, 0.12).translate(0, 0.32, -len), 0x2b2b2b));
  parts.push(tint(new THREE.BoxGeometry(1.84, 0.14, 0.12).translate(0, 0.32, len), 0x2b2b2b));
  return mergeGeometries(parts);
}
