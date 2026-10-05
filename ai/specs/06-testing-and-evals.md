# Spec 06: Quality Assurance, Benchmarks & AI Evals

## Status: Approved
## Feature: `testing-and-evals`

---

### 1. 3D Engine Performance Benchmarks

| Metric | Target | Verification Method |
| :--- | :--- | :--- |
| **Frame Rate** | Steady 60 FPS ($16.6\text{ms}/\text{frame}$) | `stats.js` / Three.js clock telemetry |
| **Draw Calls** | $< 45$ draw calls / frame | Shared materials & instanced tree/prop meshes |
| **Memory Stability** | $0\text{ MB}$ uncollected heap growth over 10 min | Chrome DevTools Memory Heap Snapshot comparison |
| **Road Recycling** | $< 2\text{ms}$ execution time per recycle event | Performance mark profiling |

---

### 2. Local AI Persona Evaluation Framework

To guarantee distinct character fidelity without cloud LLMs, the local AI generator is evaluated against semantic persona test suites:

#### 2.1 Persona Invariants
1. **Appa Invariants**:
   - Must exhibit contemplative, tranquil, or philosophical sentiments.
   - Punctuation must be calm; no exclamation mark spam or ALL-CAPS screaming.
   - Tone keywords: *breeze, harmony, pedals, clouds, patience, journey*.
2. **Queso Invariants**:
   - Must exhibit urgent, energetic, or comedic excitement.
   - Frequent exclamation marks and dynamic excitement.
   - Tone keywords: *speed, cheese, zoomies, faster, squirrel, drift, turbo*.

#### 2.2 Cooldown & Anti-Spam Evals
- **Minimum Dialogue Interval**: $\ge 6.0\text{ seconds}$ between ambient quotes.
- **Audio Overlap Prevention**: If a priority event occurs while an utterance is currently playing, the active speech must be immediately canceled (`speechSynthesis.cancel()`) prior to initiating the new dialogue.
- **Browser Autoplay Policy**: Web Speech TTS must remain muted until the player performs at least one explicit user interaction (click, keypress).

---

### 3. Automated Test Suite Breakdown
- **Unit Tests**:
  - `RoadManager.test.ts`: Verify recycling coordinates and queue ordering.
  - `BikeController.test.ts`: Verify boundary clamping and banking angle calculations.
  - `AIEngine.test.ts`: Verify trigger evaluations and persona payload invariants.
- **Integration Tests**:
  - `CatSwitcher.test.ts`: Verify state toggle and event propagation to HUD and audio.
