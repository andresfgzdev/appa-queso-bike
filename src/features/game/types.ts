import * as THREE from "three";

export interface InputState {
  steer: number; // -1.0 (left) to 1.0 (right)
  boost: boolean;
  switchCat: boolean;
}

export interface GameTelemetry {
  speedKmh: number;
  distanceTraveledM: number;
  steerIntensity: number;
  activeCatId: "appa" | "queso";
}

export interface RoadChunkData {
  mesh: THREE.Group;
  z: number;
  length: number;
}
