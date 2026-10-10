# Spec 02: Cat Rider, Bicycle & Switcher

## Status: Implemented
## Feature: `features/cat-rider`

---

### 1. Real Cat Likeness
| Attribute | **Appa** | **Queso** |
| :--- | :--- | :--- |
| Coat | Cream-white with grey-brown tabby cap, ears and tail | Ginger tabby (broken procedural stripes) with white bib, muzzle and mittens |
| Eyes | Hazel-green, calmer (lids 42 % closed) | Amber-green, alert (lids 30 %) |
| Nose | Hazel-brown | Coral-pink |
| Bike | Mint/green frame, yarn ball in the basket | Cheddar-orange frame, cheese wedge in the basket |
| Source photos | `public/assets/cats/appa.png` | `public/assets/cats/queso.png` (HUD avatars) |

### 2. Bicycle (`BikeRig`)
A beach cruiser built from real frame points (bike space, forward = −Z):

| Point | Position |
|---|---|
| Wheels | radius 0.5, axles at z = ±0.85 |
| Bottom bracket | (0, 0.36, 0.10) |
| Head tube | top (0, 1.02, −0.58), bottom (0, 0.82, −0.684) |

- Steering rotates the whole front end (fork, wheel, bars, basket, light, fender) around the
  **tilted head-tube axis** (≈ 27°), not a vertical axis.
- Drivetrain: 32-tooth chainring, rear cog, chain runs; 24 laced spokes per wheel.
- **Gear ratio 2.6**: the crank turns at wheel speed / 2.6 (≈ 84 rpm cadence at cruise).
- Anchors exposed for IK: left/right pedal tops (level with the ground), left/right grips.

### 3. Cat Rig & IK (`CatMeshBuilder`, `CatRider`, `rigMath`)
- Proportions: thigh 0.42, shin 0.40, metatarsal 0.10; upper arm 0.27, forearm 0.26.
- **Analytic two-bone IK** (law of cosines) every frame:
  - Hip → hock targets the pedal anchor + `(0, 0.07, 0.075)`; knee pole forward/up/out.
  - Shoulder → wrist targets the grip + `(0, 0.045, 0.03)`; elbow pole out/down/back.
  - Out-of-reach targets fully extend without stretching bones.
- Upper body pivots at the hips: forward lean grows with speed, rocks `sin(crank)·0.035`, breathes.
- Head stays level, yaws into turns; ears fold back with speed; natural blinking every 2–6 s.
- Tail: 8 chained segments with a travelling sway.

### 4. Fur (`furShells`)
Shell texturing: each furry batch gets an `InstancedMesh` child drawing 10 shells (6 on low
quality) offset along the normal (`length 0.0095`, density 210 strands/UV). Per-strand random
length, taper, cell jitter, root darkening, gravity droop and **speed-driven wind flutter**.

### 5. Switching
`C` or the HUD pills swap rigs, recolour the frame material, swap the basket prop and play a
squash-and-stretch on the upper body. The HUD is notified via `onCatSwitched`.

### 6. Contracts

```typescript
export type CatId = "appa" | "queso";

export interface CatProfile {
  id: CatId;
  name: string;
  themeColor: string;
  frameColorHex: number;
  photoUrl: string;
  bio: string;
}
```

### 7. Acceptance Criteria
1. Hind paws stay on the pedals for the full crank revolution (unit-tested reach + visual check).
2. Front paws stay on the grips at full steering lock.
3. Each cat renders in ≤ ~15 draw calls including fur (Spec 08).
