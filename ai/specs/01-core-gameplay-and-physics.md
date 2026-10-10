# Spec 01: Core Gameplay, Treadmill Road & Camera

## Status: Implemented
## Feature: `features/game`

---

### 1. Treadmill World
The rider stays near the origin; the world scrolls toward the camera (+Z) to avoid floating-point
drift.

| Parameter | Value |
|---|---|
| Chunk length × count | 40 m × 7 |
| Recycle threshold | chunk origin `z > 50` → moved to the front of the queue |
| Cruise speed | 11 m/s (≈ 18 km/h on the HUD) |
| Boost | ×1.5, eased with `1 − e^(−3.5·Δt)` |
| Lateral range | `x ∈ [−4, 4]` (path half-width 4.75 m) |
| Lateral speed | 5.2 m/s × steer |

Global (non-chunked) layers scroll by distance instead: ocean waves/foam (shader uniform), far
ground texture offset, the pier landmark, traffic, sky life, particles.

### 2. Input
- **Keyboard:** A/D or ←/→ steer, Space boost, C switch cat (auto-repeat ignored).
- **Pointer drag** steers proportionally; **touch buttons** steer and boost on mobile.
- Steering is eased: response 7/s toward the target, release 9/s back to centre.
- Window `blur` clears held keys; all listeners are removed on `destroy()`.

### 3. Chase Camera
- Offset `(1.6, 2.15, 3.9)` from the bike, look target `(−0.25, 0.3, −9)`.
- Frame-rate-independent damping `k = 1 − e^(−4.5·Δt)`.
- FOV 52° opening up to +9° with boost; roll of `−steer · 0.035` rad into turns; subtle
  hand-held drift (layered sines, 1.8 cm).

### 4. Cinematic Intro (9 s)
Catmull-Rom flight relative to the bike: high over the beach toward the sunset → dive in from
inland with the ocean behind → low hero shot of the cat's face → side profile → swing behind →
chase position. FOV eases 34° → 52°, letterbox bars retract over the last 18 %.
Any key or tap on the overlay skips with a 0.9 s blend into the chase camera. Input is ignored
while the intro plays. `?nointro` disables it.

### 5. Contracts

```typescript
export interface InputState { steer: number; boost: boolean; switchCat: boolean }

export interface GameTelemetry {
  speedKmh: number;
  distanceTraveledM: number;
  steerIntensity: number;
  activeCatId: "appa" | "queso";
}
```

### 6. Acceptance Criteria
1. Chunks recycle indefinitely with no growth in `renderer.info.memory.geometries`.
2. The bike never leaves the path; the camera returns smoothly behind it after a swerve.
3. Skipping the intro never jumps the camera.
