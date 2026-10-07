import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { alignSegment, solveTwoBone } from "./rigMath";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("solveTwoBone", () => {
  const upper = 0.42;
  const lower = 0.4;

  it("reaches a reachable target while preserving both bone lengths", () => {
    const root = v(0.12, 1.03, 0.33);
    const target = v(0.19, 0.45, 0.2);
    const mid = new THREE.Vector3();
    const end = new THREE.Vector3();

    solveTwoBone(root, target, upper, lower, v(0, 0.5, -1), mid, end);

    expect(end.distanceTo(target)).toBeLessThan(1e-6);
    expect(root.distanceTo(mid)).toBeCloseTo(upper, 6);
    expect(mid.distanceTo(end)).toBeCloseTo(lower, 6);
  });

  it("bends the middle joint toward the pole vector", () => {
    const root = v(0, 1, 0);
    const target = v(0, 0.4, 0);
    const mid = new THREE.Vector3();
    const end = new THREE.Vector3();

    solveTwoBone(root, target, upper, lower, v(0, 0, -1), mid, end);
    expect(mid.z).toBeLessThan(0);

    solveTwoBone(root, target, upper, lower, v(0, 0, 1), mid, end);
    expect(mid.z).toBeGreaterThan(0);
  });

  it("fully extends toward an out-of-reach target without stretching bones", () => {
    const root = v(0, 0, 0);
    const target = v(0, -5, 0);
    const mid = new THREE.Vector3();
    const end = new THREE.Vector3();

    solveTwoBone(root, target, upper, lower, v(0, 0, -1), mid, end);

    expect(root.distanceTo(end)).toBeCloseTo(upper + lower, 3);
    expect(root.distanceTo(mid)).toBeCloseTo(upper, 6);
    expect(mid.distanceTo(end)).toBeCloseTo(lower, 3);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeLessThan(0);
  });

  it("stays stable when the pole is parallel to the chain", () => {
    const mid = new THREE.Vector3();
    const end = new THREE.Vector3();
    solveTwoBone(v(0, 1, 0), v(0, 0.5, 0), upper, lower, v(0, -1, 0), mid, end);

    expect(Number.isFinite(mid.x + mid.y + mid.z)).toBe(true);
    expect(v(0, 1, 0).distanceTo(mid)).toBeCloseTo(upper, 6);
  });

  it("keeps a pedalling leg within reach over a full crank revolution", () => {
    // Mirrors the bike/rider layout: hip on the pelvis, hock target circling the bottom bracket
    const hip = v(0.12, 1.03, 0.33);
    const bottomBracket = v(0, 0.36, 0.1);
    const crank = 0.15;
    const hockOffset = v(0.19, 0.0125 + 0.02 + 0.05, 0.075);
    const mid = new THREE.Vector3();
    const end = new THREE.Vector3();

    for (let deg = 0; deg < 360; deg += 10) {
      const a = THREE.MathUtils.degToRad(deg);
      const target = bottomBracket.clone().add(v(0, -crank * Math.cos(a), -crank * Math.sin(a))).add(hockOffset);
      expect(hip.distanceTo(target)).toBeLessThan(upper + lower);

      solveTwoBone(hip, target, upper, lower, v(0.3, 0.5, -1), mid, end);
      expect(end.distanceTo(target)).toBeLessThan(1e-6);
      // Knee always ahead of the hip, like a real pedal stroke
      expect(mid.z).toBeLessThan(hip.z);
    }
  });
});

describe("alignSegment", () => {
  it("places a +Y segment so it spans from -> to", () => {
    const obj = new THREE.Object3D();
    const from = v(1, 2, 3);
    const to = v(1.3, 1.6, 2.5);
    const rest = 0.5;

    alignSegment(obj, from, to, rest);
    obj.updateMatrixWorld();

    const tip = new THREE.Vector3(0, rest, 0).applyMatrix4(obj.matrixWorld);
    expect(tip.distanceTo(to)).toBeLessThan(1e-6);
    expect(obj.position.equals(from)).toBe(true);
  });
});
