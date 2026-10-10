# Spec 06: Testing, Verification & Performance Budget

## Status: Implemented
## Feature: quality

---

### 1. Automated Checks
| Check | Command | Covers |
|---|---|---|
| Types | `npx tsc -b` | Strict TS, unused locals |
| Unit tests | `npm test` (Vitest) | `rigMath.test.ts`: IK reaches targets, preserves bone lengths, bends toward pole, clamps out-of-reach targets, stays stable with degenerate poles, keeps the leg in reach over a full crank revolution; `alignSegment` correctness |
| Build | `npm run build` | Vite production bundle |

### 2. Visual Verification (AI-First practice)
Every visual change is verified in a real browser (headless Chrome via Playwright):
- Gameplay camera at several moments (cruise, boost, steering, cat switch).
- Frozen debug cameras: side and front close-ups (IK contact, fur, eyes), street level, beach
  level, aerial (layout, horizon, artefacts), intro timeline frames.
- Console must be free of errors.

**Artefact checklist** (each has bitten this project once — ADR-008):
- Bright square blobs after bloom ⇒ NaN/Inf in a shader: `pow()` with negative base, division by
  a value that can reach 0, unclamped `mix()` factors.
- Z-fighting where water/sand/grass layers overlap.
- Objects intersecting landmarks (palms vs pier deck).

### 3. Performance Budget
Measured with `renderer.info` (auto-reset disabled across one composer frame) and rAF timing:

| Metric | Target | Current (desktop, 1280×720) |
|---|---|---|
| Draw calls / frame (incl. shadows + post) | ≤ 180 | ~166 |
| Rider (cat + bike) draw calls | ≤ 30 | 29 |
| Road chunk | ≤ ~10 | ~9 |
| Frame time | 60 fps on mid hardware | ~2.7 ms median on RX 9070 XT |
| Bundle | < 300 KB gzip | ~225 KB gzip |

> The original target of "< 45 draw calls" was unrealistic once bloom/post-processing were added
> (the post stack alone is ~15 passes). Revised in ADR-006.

### 4. Not Yet Verified
- Real mobile devices (low tier is exercised with `?quality=low` on desktop only).
- Long-session memory profile (> 30 min).
