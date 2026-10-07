import * as THREE from "three";
import { bakeStatic } from "../../lib/bakeStatic";
import { batchByMaterial, DynamicBatch } from "../../lib/DynamicBatch";
import { addFurShells } from "./furShells";
import { segmentGeometry, v3 } from "./rigMath";
import { CatId } from "./types";

interface FurSpec {
  base: string;
  stripe?: string;
  speckle: string;
}

interface CatLook {
  coat: FurSpec; // Main body fur
  marking: FurSpec; // Appa: tabby cap/ears/tail · Queso: white bib/muzzle/mittens
  white: FurSpec; // Muzzle, chin, paws
  earFur: "coat" | "marking";
  tailFur: "coat" | "marking";
  noseColor: number;
  irisColor: number;
  lidCoverage: number; // fraction of the eye covered by the upper lid (calm vs alert)
}

const LOOKS: Record<CatId, CatLook> = {
  appa: {
    coat: { base: "#ece6dc", speckle: "#d9d0c2" },
    marking: { base: "#8b7a69", stripe: "#5a4b3e", speckle: "#a39282" },
    white: { base: "#f3f0ea", speckle: "#e2dcd2" },
    earFur: "marking",
    tailFur: "marking",
    noseColor: 0x6b4a3e,
    irisColor: 0x9bb04a, // hazel-green
    lidCoverage: 0.42,
  },
  queso: {
    coat: { base: "#e27a32", stripe: "#b2521d", speckle: "#f0954f" },
    marking: { base: "#fbf8f3", speckle: "#ece6dc" },
    white: { base: "#fbf8f3", speckle: "#ece6dc" },
    earFur: "coat",
    tailFur: "coat",
    noseColor: 0xf28c98,
    irisColor: 0xb7b13a, // amber-green
    lidCoverage: 0.3,
  },
};

export interface LegRig {
  hip: THREE.Object3D; // anchor (static, on the pelvis)
  thigh: THREE.Mesh;
  knee: THREE.Mesh;
  shin: THREE.Mesh;
  hock: THREE.Mesh;
  metatarsal: THREE.Mesh;
  paw: THREE.Mesh;
  thighLength: number;
  shinLength: number;
  metatarsalLength: number;
}

export interface ArmRig {
  shoulder: THREE.Object3D; // anchor (moves with the upper body)
  upperArm: THREE.Mesh;
  elbow: THREE.Mesh;
  forearm: THREE.Mesh;
  paw: THREE.Mesh;
  upperLength: number;
  forearmLength: number;
}

export interface CatRigNodes {
  group: THREE.Group;
  upperBody: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Group[];
  ears: THREE.Group[];
  tailSegments: THREE.Group[];
  legs: { left: LegRig; right: LegRig };
  arms: { left: ArmRig; right: ArmRig };
  batches: DynamicBatch[];
}

// Rig proportions (bike-space units)
const THIGH_LENGTH = 0.42;
const SHIN_LENGTH = 0.4;
const METATARSAL_LENGTH = 0.1;
const UPPER_ARM_LENGTH = 0.27;
const FOREARM_LENGTH = 0.26;
const TAIL_SEGMENTS = 8;
const TAIL_SEGMENT_LENGTH = 0.075;

// Upper body pivots around the hips so it can lean and rock over the saddle
const PELVIS_PIVOT = v3(0, 1.06, 0.36);
const rel = (x: number, y: number, z: number) => v3(x - PELVIS_PIVOT.x, y - PELVIS_PIVOT.y, z - PELVIS_PIVOT.z);

/**
 * Builds a cat rider in bike space (forward = -Z), seated on the saddle.
 * Limbs are unparented segments that the CatRider poses each frame with two-bone IK,
 * so paws stay locked to the pedals and handlebar grips.
 */
export class CatMeshBuilder {
  public static buildCatRig(catId: CatId): CatRigNodes {
    const look = LOOKS[catId];
    const group = new THREE.Group();

    const coatMat = furMaterial(look.coat, 1);
    const markingMat = furMaterial(look.marking, 1);
    const whiteMat = furMaterial(look.white, 1);
    const earMat = look.earFur === "coat" ? coatMat : markingMat;
    const tailMat = look.tailFur === "coat" ? furMaterial(look.coat, 1) : furMaterial(look.marking, 1);
    const bibMat = catId === "queso" ? markingMat : coatMat;
    const pawMat = whiteMat;

    // ------------------------------------------------------------------
    // Pelvis & haunches (static, sitting on the saddle)
    // ------------------------------------------------------------------
    const pelvisGroup = new THREE.Group();
    group.add(pelvisGroup);
    for (const side of [-1, 1]) {
      const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), coatMat);
      haunch.scale.set(0.78, 0.95, 1.3);
      haunch.position.set(side * 0.085, 1.11, 0.37);
      haunch.rotation.x = 0.25;
      pelvisGroup.add(haunch);
    }

    // ------------------------------------------------------------------
    // Upper body: torso, chest, shoulders, neck, head
    // ------------------------------------------------------------------
    const upperBody = new THREE.Group();
    upperBody.position.copy(PELVIS_PIVOT);
    group.add(upperBody);

    const pelvis = v3(0, 1.15, 0.38);
    const chest = v3(0, 1.36, 0.05);
    const torsoAxis = chest.clone().sub(pelvis);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.165, torsoAxis.length() * 0.55, 10, 24), coatMat);
    torso.position.copy(rel(0, (pelvis.y + chest.y) / 2, (pelvis.z + chest.z) / 2));
    torso.quaternion.setFromUnitVectors(v3(0, 1, 0), torsoAxis.normalize());
    torso.scale.set(0.92, 1, 1.05);
    upperBody.add(torso);

    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16), bibMat);
    bib.scale.set(0.95, 1.15, 0.75);
    bib.position.copy(rel(0, 1.29, -0.03));
    bib.rotation.x = -0.5;
    upperBody.add(bib);

    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), coatMat);
      blade.position.copy(rel(side * 0.1, 1.4, 0.04));
      upperBody.add(blade);
    }

    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), coatMat);
    neck.scale.set(1, 1.1, 1);
    neck.position.copy(rel(0, 1.46, -0.05));
    upperBody.add(neck);

    const neckRuff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), bibMat);
    neckRuff.scale.set(1.05, 0.9, 0.8);
    neckRuff.position.copy(rel(0, 1.44, -0.11));
    upperBody.add(neckRuff);

    const { head, eyes, ears } = buildHead(catId, look, coatMat, markingMat, whiteMat, earMat);
    head.position.copy(rel(0, 1.6, -0.12));
    upperBody.add(head);

    // ------------------------------------------------------------------
    // Limbs (posed by IK every frame)
    // ------------------------------------------------------------------
    const buildLeg = (side: number): LegRig => {
      const hip = new THREE.Object3D();
      hip.position.set(side * 0.12, 1.03, 0.33);
      group.add(hip);

      const thigh = new THREE.Mesh(segmentGeometry(0.095, 0.06, THIGH_LENGTH, 16), coatMat);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), coatMat);
      const shin = new THREE.Mesh(segmentGeometry(0.05, 0.036, SHIN_LENGTH, 14), coatMat);
      const hock = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8), coatMat);
      const metatarsal = new THREE.Mesh(segmentGeometry(0.034, 0.03, METATARSAL_LENGTH, 12), pawMat);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 10), pawMat);
      paw.scale.set(1.05, 0.55, 1.45);
      group.add(thigh, knee, shin, hock, metatarsal, paw);

      return {
        hip,
        thigh,
        knee,
        shin,
        hock,
        metatarsal,
        paw,
        thighLength: THIGH_LENGTH,
        shinLength: SHIN_LENGTH,
        metatarsalLength: METATARSAL_LENGTH,
      };
    };

    const buildArm = (side: number): ArmRig => {
      const shoulder = new THREE.Object3D();
      shoulder.position.copy(rel(side * 0.12, 1.36, 0.0));
      upperBody.add(shoulder);

      const upperArm = new THREE.Mesh(segmentGeometry(0.062, 0.046, UPPER_ARM_LENGTH, 14), coatMat);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), coatMat);
      const forearm = new THREE.Mesh(segmentGeometry(0.044, 0.035, FOREARM_LENGTH, 14), coatMat);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), pawMat);
      paw.scale.set(1.1, 0.85, 1.15);
      group.add(upperArm, elbow, forearm, paw);

      return { shoulder, upperArm, elbow, forearm, paw, upperLength: UPPER_ARM_LENGTH, forearmLength: FOREARM_LENGTH };
    };

    const legs = { left: buildLeg(-1), right: buildLeg(1) };
    const arms = { left: buildArm(-1), right: buildArm(1) };

    // ------------------------------------------------------------------
    // Tail: chained segments, base on the pelvis, draping behind the saddle
    // ------------------------------------------------------------------
    const tailSegments: THREE.Group[] = [];
    let parent: THREE.Object3D = group;
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const t = i / (TAIL_SEGMENTS - 1);
      const rootR = THREE.MathUtils.lerp(0.042, 0.024, t);
      const tipR = THREE.MathUtils.lerp(0.04, 0.02, t);

      const seg = new THREE.Group();
      if (i === 0) {
        seg.position.set(0, 1.13, 0.5);
      } else {
        seg.position.set(0, TAIL_SEGMENT_LENGTH, 0);
      }

      const segMesh = new THREE.Mesh(segmentGeometry(rootR, tipR, TAIL_SEGMENT_LENGTH, 12), tailMat);
      const jointMesh = new THREE.Mesh(new THREE.SphereGeometry(rootR, 12, 8), tailMat);
      seg.add(segMesh, jointMesh);

      if (i === TAIL_SEGMENTS - 1) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(tipR, 12, 8), tailMat);
        tip.position.y = TAIL_SEGMENT_LENGTH;
        seg.add(tip);
      }

      parent.add(seg);
      parent = seg;
      tailSegments.push(seg);
    }

    // Batch rigid sub-assemblies by material before growing fur on them
    bakeStatic(pelvisGroup);
    bakeStatic(upperBody);
    bakeStatic(head);
    for (const seg of tailSegments) bakeStatic(seg);

    // Tiny details (eyes, nose, inner ears) don't need to render into the shadow map
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const worldScale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
      mesh.castShadow = mesh.geometry.boundingSphere!.radius * worldScale > 0.05;
      mesh.receiveShadow = true;
    });
    const furMats = new Set<THREE.Material>([coatMat, markingMat, whiteMat, tailMat]);

    // One draw call per material for the whole articulated cat (CPU-skinned batches);
    // fur shells grow on the batched fur meshes and share their vertex buffers.
    const batches = batchByMaterial(group);
    for (const batch of batches) {
      if (furMats.has(batch.mesh.material as THREE.Material)) {
        addFurShells(batch.mesh, batch.mesh.material === tailMat ? { length: 0.015, droop: 0.2 } : {});
      }
    }

    return { group, upperBody, head, eyes, ears, tailSegments, legs, arms, batches };
  }
}

function buildHead(
  catId: CatId,
  look: CatLook,
  coatMat: THREE.Material,
  markingMat: THREE.Material,
  whiteMat: THREE.Material,
  earMat: THREE.Material
): { head: THREE.Group; eyes: THREE.Group[]; ears: THREE.Group[] } {
  const head = new THREE.Group();
  const muzzleMat = catId === "queso" ? whiteMat : coatMat;
  // Own material (no fur shells on eyelids; batched separately from the coat)
  const lidMat = (coatMat as THREE.MeshStandardMaterial).clone();

  // Cranium
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.165, 32, 24), coatMat);
  cranium.scale.set(1.05, 0.92, 1.0);
  head.add(cranium);

  // Appa's grey-brown tabby cap over the crown and forehead
  if (catId === "appa") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), markingMat);
    cap.scale.set(1.05, 0.92, 1.0);
    cap.rotation.x = -0.4;
    head.add(cap);
  }

  // Full cheeks
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), coatMat);
    cheek.scale.set(1, 0.85, 0.9);
    cheek.position.set(side * 0.08, -0.055, -0.07);
    head.add(cheek);
  }

  // Muzzle: whisker pads, chin, bridge
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), muzzleMat);
    pad.position.set(side * 0.034, -0.07, -0.148);
    head.add(pad);
  }
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), whiteMat);
  chin.position.set(0, -0.108, -0.122);
  head.add(chin);

  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), muzzleMat);
  bridge.scale.set(0.8, 0.7, 1.25);
  bridge.position.set(0, -0.022, -0.15);
  head.add(bridge);

  // Nose leather (rounded triangle)
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-0.022, 0.01);
  noseShape.quadraticCurveTo(0, 0.02, 0.022, 0.01);
  noseShape.quadraticCurveTo(0.008, -0.012, 0, -0.016);
  noseShape.quadraticCurveTo(-0.008, -0.012, -0.022, 0.01);
  const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    bevelSegments: 2,
  });
  const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: look.noseColor, roughness: 0.45 }));
  nose.position.set(0, -0.036, -0.2);
  nose.rotation.x = -0.25;
  head.add(nose);

  // Mouth line under the nose
  const mouthMat = new THREE.LineBasicMaterial({ color: 0x3b2a24 });
  const mouthGeo = new THREE.BufferGeometry().setFromPoints([
    v3(0, -0.05, -0.192),
    v3(0, -0.075, -0.188),
    v3(0, -0.075, -0.188),
    v3(-0.022, -0.088, -0.18),
    v3(0, -0.075, -0.188),
    v3(0.022, -0.088, -0.18),
  ]);
  head.add(new THREE.LineSegments(mouthGeo, mouthMat));

  // Eyes: iris, slit pupil, catch-light, upper lid
  const irisMat = new THREE.MeshPhysicalMaterial({ color: look.irisColor, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.064, 0.022, -0.134);
    eye.rotation.y = -side * 0.32;

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), irisMat);
    ball.scale.set(1, 1.05, 0.75);
    eye.add(ball);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), pupilMat);
    pupil.scale.set(0.26, 0.82, 0.3);
    pupil.position.z = -0.019;
    eye.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), glintMat);
    glint.position.set(side * -0.01, 0.013, -0.028);
    eye.add(glint);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.039, 20, 10, 0, Math.PI * 2, 0, Math.PI * look.lidCoverage),
      lidMat
    );
    lid.scale.set(1, 1.05, 0.8);
    lid.rotation.x = -0.55;
    eye.add(lid);

    head.add(eye);
    eyes.push(eye);
  }

  // Ears: outer fur + pink inner
  const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xf2a7b4, roughness: 0.8, side: THREE.DoubleSide });
  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.1, 0.12, 0.01);
    ear.rotation.set(-0.12, side * -0.25, side * -0.32);

    const outerGeo = new THREE.ConeGeometry(0.068, 0.14, 24);
    outerGeo.scale(1, 1, 0.42);
    outerGeo.translate(0, 0.07, 0);
    ear.add(new THREE.Mesh(outerGeo, earMat));

    const innerGeo = new THREE.ConeGeometry(0.046, 0.105, 20);
    innerGeo.scale(1, 1, 0.22);
    innerGeo.translate(0, 0.055, -0.016);
    ear.add(new THREE.Mesh(innerGeo, innerEarMat));

    head.add(ear);
    ears.push(ear);
  }

  // Whiskers
  const whiskerPoints: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      whiskerPoints.push(v3(side * 0.05, -0.065 - i * 0.01, -0.165));
      whiskerPoints.push(v3(side * 0.26, -0.03 - i * 0.035, -0.11 + i * 0.015));
    }
  }
  const whiskers = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(whiskerPoints),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  head.add(whiskers);

  return { head, eyes, ears };
}

/** Fur material with a procedural canvas texture (speckled coat + optional tabby stripes). */
function furMaterial(spec: FurSpec, repeat: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createFurTexture(spec, repeat),
    roughness: 0.95,
    metalness: 0,
  });
}

function createFurTexture(spec: FurSpec, repeat: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, size, size);

  // Tabby stripes: wavy horizontal bands (wrap around limbs/torso as rings)
  if (spec.stripe) {
    ctx.strokeStyle = spec.stripe;
    ctx.lineCap = "round";
    // Broken, soft-edged bands rather than continuous lines
    ctx.filter = "blur(3px)";
    const bands = 4;
    for (let b = 0; b < bands; b++) {
      const y0 = ((b + 0.5) / bands) * size;
      ctx.lineWidth = 10 + Math.random() * 8;
      ctx.globalAlpha = 0.6;
      let x = 0;
      while (x < size) {
        const segLen = 50 + Math.random() * 70;
        ctx.beginPath();
        for (let sx = x; sx <= Math.min(size, x + segLen); sx += 6) {
          const y = y0 + Math.sin((sx / size) * Math.PI * 2 + b * 1.7) * 9;
          if (sx === x) ctx.moveTo(sx, y);
          else ctx.lineTo(sx, y);
        }
        ctx.stroke();
        x += segLen + 12 + Math.random() * 24;
      }
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }

  // Fine fur strands
  ctx.strokeStyle = spec.speckle;
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.globalAlpha = 0.12 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y + 3 + Math.random() * 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}
