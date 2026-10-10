# Architecture Decision Records

Short records of non-obvious decisions taken during AI-First development. Each states the
context, the decision and its consequences so future agents (and humans) don't re-litigate them.

---

## ADR-001 — Treadmill world instead of moving the bike
**Context:** An endless ride moving the bike along −Z would push coordinates toward float
precision limits. **Decision:** Keep the rider near the origin and scroll the world (+Z), recycling
40 m chunks. Global surfaces (ocean, far ground, pier, traffic) scroll by distance.
**Consequences:** Stable precision; everything that "moves with the world" must receive the
per-frame distance.

## ADR-002 — Analytic two-bone IK for pedalling
**Context:** Keyframed leg cycles drift off the pedals when cadence or geometry changes.
**Decision:** Solve hip→knee→hock and shoulder→elbow→wrist each frame with the law of cosines
against anchors on the pedals and grips; pole vectors pick the bend plane.
**Consequences:** Paws are always on the pedals/grips (unit-tested); bike geometry and rider
proportions must keep targets within reach.

## ADR-003 — Fully procedural assets
**Context:** The product is 100% offline and AI-built; sourcing/licensing models and textures
slows iteration. **Decision:** Generate geometry, textures (tileable periodic noise), fur and
audio in code. **Consequences:** Tiny bundle (~225 KB gzip), infinite variation, no licensing
risk; visual quality depends on careful procedural work.

## ADR-004 — Remove on-screen thoughts / AI companion
**Context:** The original spec had an "AI cat radio": dialogue bubbles + TTS. The product owner
asked to remove all on-screen thoughts and their dependencies. **Decision:** Delete
`features/ai-companion`, the dialogue bubble, TTS fields, and the unused `@google/genai`
dependency. **Consequences:** Spec 03 was superseded by generative ambient audio.

## ADR-005 — Shell-textured fur
**Context:** Smooth primitives read as plastic toys. **Decision:** Shell texturing via an
`InstancedMesh` of N shells per furry mesh with an `onBeforeCompile` shader (per-strand length,
taper, jitter, root darkening, droop, wind). **Consequences:** Convincing fur in one extra draw call
per furry batch; shell count drops on low-tier devices.

## ADR-006 — Batching strategy & revised draw-call budget
**Context:** The scene reached 408 draw calls. **Decision:** `bakeStatic` for static scenery
(vertex-colour collapse), `DynamicBatch` (CPU skinning) for the articulated rider, instancing for
repeated animated objects. The "< 45 draw calls" target was revised to ≤ 180 including shadows
and the post stack. **Consequences:** 408 → 115, later ~166 with a far richer world.

## ADR-007 — Cinematic intro + post-processing as the first impression
**Context:** The first 3 seconds decide whether people share the experience. **Decision:** A 9 s
scripted camera flight with a title card, letterbox and HDR post stack (bloom, grade, grain,
speed blur). **Consequences:** Screenshot-worthy first frames; input ignored during the intro;
skippable.

## ADR-008 — Shader numeric safety
**Context:** Two "glowing square" artefacts appeared: `pow(negative, 2.0)` in the ocean foam band
(NaN), and a sky mountain blend dividing by a ridge height approaching 0 (huge extrapolated
colour). Bloom spreads such pixels into squares. **Decision:** Ban `pow()` on possibly negative
bases, guard near-zero denominators, clamp blend factors and final colours.
**Consequences:** Rules recorded in Spec 08 §4 and the artefact checklist in Spec 06.

## ADR-009 — Generative music instead of downloaded tracks
**Context:** The owner asked for soft ambient music "downloaded from anywhere we have permission".
The licence of arbitrary web audio can't be reliably verified, and the app must work offline.
**Decision:** Synthesize the soundscape with Web Audio (pad, keys, bass, reverb, ocean, breeze,
gulls). **Consequences:** Zero files, zero licence risk, no bundle growth; a verified CC0 track
could still be added later under `public/assets/audio/`.

## ADR-010 — California beach-front cross-section
**Context:** The sides of the path felt empty. **Decision:** Model a real Santa Monica / Venice
cross-section (planter → park → sidewalk → parking → street with traffic → parking → café
sidewalk → buildings | path | dense beach) with an occupancy map for scattered beach props.
**Consequences:** Rich, believable surroundings at ~9 draw calls per chunk.
