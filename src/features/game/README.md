# Feature: Game Engine & World

Endless treadmill world, cinematic camera, Santa Monica beach-front environment, post-processing
and adaptive quality. Specs: [01](../../../ai/specs/01-core-gameplay-and-physics.md),
[07](../../../ai/specs/07-world-and-environment.md), [08](../../../ai/specs/08-rendering-and-performance.md).

| Module | Role |
|---|---|
| `GameEngine.ts` | Owns renderer, loop, scene, lighting; wires every subsystem |
| `InputManager.ts` | Keyboard / pointer / touch with eased steering |
| `ChaseCamera.ts` | 9 s intro flight + damped chase camera |
| `RoadManager.ts` | 40 m chunk treadmill, cross-section layout, baking |
| `SkyDome.ts` · `Ocean.ts` | Procedural sky (+ IBL) and shader ocean |
| `Landmarks.ts` · `SkyLife.ts` · `Traffic.ts` | Pier & Ferris wheel, birds/boats/kites, street traffic |
| `PalmTreeFactory.ts` · `CaliforniaProps.ts` · `proceduralTextures.ts` | Procedural assets |
| `AmbientParticles.ts` · `PostFX.ts` · `QualityManager.ts` | Atmosphere, post stack, quality tiers |
