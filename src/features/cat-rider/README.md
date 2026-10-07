# Feature: Cat Rider & Bicycle

Appa & Queso on a beach cruiser: real frame geometry, tilted-axis steering, 2.6 gear ratio,
two-bone IK pedalling, shell fur and CPU-skinned batching. Spec: [02](../../../ai/specs/02-cat-rider-and-switching.md).

| Module | Role |
|---|---|
| `BikeRig.ts` | Frame, steering assembly, drivetrain, pedal/grip anchors |
| `CatMeshBuilder.ts` | Cat anatomy, procedural fur textures, batches + fur shells |
| `CatRider.ts` | Per-frame pose: IK, lean, head, tail, blink, wind |
| `rigMath.ts` (+ `.test.ts`) | Two-bone IK, segment alignment, geometry helpers |
| `furShells.ts` | Shell-texturing fur shader |
