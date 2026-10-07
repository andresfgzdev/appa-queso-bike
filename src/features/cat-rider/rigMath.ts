import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * Analytic two-bone IK (law of cosines).
 * Places the middle joint (knee / elbow) so that `root -> mid -> end` reaches `target`,
 * bending toward `pole`. If the target is out of reach the chain is fully extended toward it.
 */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  upperLength: number,
  lowerLength: number,
  pole: THREE.Vector3,
  outMid: THREE.Vector3,
  outEnd: THREE.Vector3
): void {
  _dir.subVectors(target, root);
  let dist = _dir.length();
  if (dist < 1e-6) {
    _dir.set(0, -1, 0);
    dist = 1e-6;
  } else {
    _dir.divideScalar(dist);
  }

  const minReach = Math.abs(upperLength - lowerLength) + 1e-4;
  const maxReach = upperLength + lowerLength - 1e-4;
  dist = THREE.MathUtils.clamp(dist, minReach, maxReach);

  const along = (upperLength * upperLength - lowerLength * lowerLength + dist * dist) / (2 * dist);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));

  // Component of the pole perpendicular to the chain direction
  _bend.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_bend.lengthSq() < 1e-8) {
    _bend.set(0, 0, -1).addScaledVector(_dir, _dir.z);
  }
  _bend.normalize();

  outMid.copy(root).addScaledVector(_dir, along).addScaledVector(_bend, height);
  outEnd.copy(root).addScaledVector(_dir, dist);
}

/**
 * Orients a segment mesh (built along +Y starting at its origin) to span `from -> to`.
 * Length is matched by scaling Y relative to the segment's rest length.
 */
export function alignSegment(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, restLength: number): void {
  _tmp.subVectors(to, from);
  const len = _tmp.length();
  obj.position.copy(from);
  if (len > 1e-6) {
    obj.quaternion.setFromUnitVectors(UP, _tmp.divideScalar(len));
    obj.scale.set(1, len / restLength, 1);
  }
}

/** Tapered cylinder geometry spanning y ∈ [0, length], used for limb segments. */
export function segmentGeometry(rootRadius: number, tipRadius: number, length: number, radialSegments = 12): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(tipRadius, rootRadius, length, radialSegments, 1, false);
  geo.translate(0, length / 2, 0);
  return geo;
}

/** Cylinder geometry baked between two points (for static, mergeable parts like frame tubes). */
export function tubeBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, radialSegments = 12): THREE.BufferGeometry {
  const dir = _tmp.subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1, false);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

/** Tube geometry following a smooth curve through the given points. */
export function curvedTube(points: THREE.Vector3[], radius: number, tubularSegments = 24, radialSegments = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
