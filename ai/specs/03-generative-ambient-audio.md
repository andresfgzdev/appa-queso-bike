# Spec 03: Generative Ambient Audio

## Status: Implemented (supersedes "Edge AI Agent & Cat Radio", removed — ADR-004)
## Feature: `features/audio`

---

### 1. Goal
A soft, subtle soundscape that makes the player feel they are riding along the beach at sunset —
generated live with the Web Audio API. **No audio files, no downloads, no licensing risk**
(ADR-009).

### 2. Layers

| Layer | Implementation | Level |
|---|---|---|
| **Pad** | Dmaj7 → Bm7 → Gmaj7 → A7sus4, 2 bars each at 68 BPM; sine + triangle (±6 ct) per voice, low-pass 950 Hz, 1.8 s attack / 2.2 s release | 0.05 / voice |
| **Bass** | Sine root, slow swell | 0.085 peak |
| **Keys** | Sparse electric-piano tines (sine + 2nd/3rd partials), 70 % chance on strong beats, 40 % otherwise, occasional swing | 0.03 |
| **Reverb** | Convolver with generated 3.8 s stereo decaying-noise impulse | send 0.6 |
| **Ocean** | Pink noise: constant low surf bed (LP 260 Hz) + waves washing in/out every 6–11 s (gain & filter envelopes), panned +0.35 (sea on the right) | 0.16 bed, 0.22–0.34 peaks |
| **Breeze** | Band-passed noise with slow gust LFO; level `0.012 + 0.045 · boost` | subtle |
| **Gulls** | 2–3 synthesised "kee-ow" calls every 14–32 s, random pan, into the reverb | 0.022 |

Master chain: buses → gentle compressor (−20 dB, 3:1) → master fade (0.55).

### 3. Behaviour
- Starts on the **first user gesture** (browser autoplay policy). During the intro an
  "Activar sonido ambiental" pill starts audio **without** skipping the intro.
- HUD speaker button toggles it; preference persisted in `localStorage` (`aqb-sound`), with
  safe fallbacks when storage is unavailable.
- Suspends when the tab is hidden; resumes when visible.
- Notes/calls disconnect their nodes after their tails, so long sessions don't accumulate nodes.
- `dispose()` closes the `AudioContext` and removes all listeners.

### 4. Contract

```typescript
class AmbientAudio {
  enabled: boolean;
  readonly isStarted: boolean;
  onStateChange?: (enabled: boolean, started: boolean) => void;
  setSpeed(speedFactor: number): void; // 0 cruise … 1 full boost
  setEnabled(on: boolean): void;
  toggle(): boolean;
  dispose(): void;
}
```

### 5. Acceptance Criteria
1. No sound before a user gesture; `AudioContext.state === "running"` after one.
2. Enabling sound from the intro pill does not skip the intro.
3. Mute fades out within ~0.5 s and persists across reloads.
