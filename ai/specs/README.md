# Spec-Driven Development (SDD) Suite

Specs are the contract between the product owner, the AI agents and the code. Each spec states
**what** the feature must do, the **numbers** that define it, the **contracts** (types/APIs) and
**acceptance criteria** that verification is run against.

| ID | Spec | Scope | Status |
| :--- | :--- | :--- | :--- |
| **00** | [System Architecture](00-system-architecture.md) | Offline edge architecture, module map, React ↔ engine bridge | **Implemented** |
| **01** | [Core Gameplay & Camera](01-core-gameplay-and-physics.md) | Treadmill road, steering, boost, chase camera, cinematic intro | **Implemented** |
| **02** | [Cat Rider & Bicycle](02-cat-rider-and-switching.md) | Cruiser rig, two-bone IK pedalling, shell fur, switcher | **Implemented** |
| **03** | [Generative Ambient Audio](03-generative-ambient-audio.md) | Web Audio lo-fi pad, ocean, breeze, gulls | **Implemented** |
| **04** | [Vision & Gesture Control](04-vision-and-gesture-control.md) | MediaPipe webcam handlebar steering | **Backlog** |
| **05** | [HUD & UI](05-hud-and-ui.md) | Glass HUD, cat switcher, intro title card, sound toggle | **Implemented** |
| **06** | [Testing, Benchmarks & QA](06-testing-and-evals.md) | Unit tests, visual verification, performance budget | **Implemented** |
| **07** | [World & Environment](07-world-and-environment.md) | Santa Monica beach-front: sky, ocean, pier, town, traffic, life | **Implemented** |
| **08** | [Rendering & Performance](08-rendering-and-performance.md) | Post FX, IBL, batching, adaptive quality | **Implemented** |

Status legend: **Implemented** (code matches spec) · **Backlog** (approved idea, not built) ·
**Superseded** (replaced by a newer spec).

> Spec 03 previously described an "Edge AI Agent & Cat Radio" (on-screen thoughts + TTS). That
> feature was removed by product decision — see `ai/decisions.md` ADR-004.
