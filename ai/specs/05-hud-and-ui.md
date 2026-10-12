# Spec 05: HUD & UI Overlay

## Status: Implemented
## Feature: `features/hud`

---

### 1. Layout

```
+-------------------------------------------------------------------------+
| [avatar] Appa & Queso Bike            [ VEL 18 km/h | DIST 412 m | 🔊 ] |
| Piloto: Appa                                                            |
|                                                                         |
|                         (3D scene, no text bubbles)                     |
|                                                                         |
| [ ◀ ]           [ TURBO ]            [ ▶ ]     ← touch devices only     |
|            ( Appa (Zen) • Activo |  Queso (Caos) | Tecla [C] )          |
|     Usa A / D o ← / → para doblar • C cambiar gato • Espacio turbo      |
+-------------------------------------------------------------------------+
```

### 2. Components (`src/features/hud/components/`)
| Component | Responsibility |
|---|---|
| `GameHUD.tsx` | Title pill with active cat avatar, speed/distance pill with sound toggle, cat switcher, touch steering + turbo buttons, keyboard hints |
| `TouchControls.tsx` | Thumb controls on touch devices: analog steering pad (left), TURBO + cat-switch buttons (right); pointer capture enables multi-touch |
| `useInputMode.ts` | `useIsTouch` (pointer: coarse — **input device, not screen width**) and `useIsCompact` (short/narrow viewports); `?touch` / `?desktop` overrides |
| `IntroOverlay.tsx` | Serif title card "Appa & Queso — Un paseo al atardecer" (top third, so the hero shot stays visible), skip hint, "Activar sonido ambiental" pill |

### 3. Behaviour
- Glassmorphism (`backdrop-blur`, slate-900/80) over the canvas; root is `pointer-events-none`,
  interactive pieces opt back in.
- The HUD is hidden during the intro and fades in (1 s) when gameplay starts.
- Touch buttons release on `pointerup`, `pointerleave` and `pointercancel` (no stuck steering).
- Sound button reflects `AmbientAudio.enabled` (Lucide `Volume2` / `VolumeX`).
- **Touch vs desktop is decided by input device**, never by width: a phone in landscape
  (e.g. iPhone 13 Pro Max, 926×428) is wider than `sm` but still gets touch controls.
- Safe-area padding (`env(safe-area-inset-*)`, `viewport-fit=cover`) keeps the HUD clear of the
  notch and home indicator in both orientations; zoom, bounce and long-press callouts are disabled.
- The chase camera re-frames for portrait aspects (wider FOV, centred offset) and re-measures
  after rotation (Spec 01).
- **No on-screen thoughts or dialogue** (removed — ADR-004).

### 4. Acceptance Criteria
1. Cat switcher state stays in sync whether switching via keyboard or buttons.
2. HUD never blocks steering drags on the canvas outside its controls.
3. Layout works from 360 px wide phones to desktop; uses `100dvh` to avoid mobile URL-bar jumps.
