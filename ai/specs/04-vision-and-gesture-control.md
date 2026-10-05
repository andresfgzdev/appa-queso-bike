# Spec 04: Edge AI Computer Vision & Gesture Steering

## Status: Approved
## Feature: `features/ai-companion` (Vision Subsystem)

---

### 1. Vision Subsystem Overview
As an optional **Edge AI** enhancement, the game supports touch-free steering using the player's webcam:
- Operates **100% in-browser on client hardware** via `@mediapipe/tasks-vision` / WebAssembly.
- Zero video feeds or data are transmitted over the network (strict privacy preservation).
- Serves as a progressive enhancement to primary **Keyboard** and **Touch/Pointer** controls.

---

### 2. Gesture Mapping: Virtual Handlebars

```mermaid
flowchart LR
    Webcam["Webcam Video Stream (640x480)"] --> MP["MediaPipe Hand Landmark Detector"]
    MP --> Landmarks["Left Wrist (x1, y1) & Right Wrist (x2, y2)"]
    Landmarks --> Math["Slope: atan2(y2 - y1, x2 - x1)"]
    Math --> Normalizer["Clamped Steering Signal (-1.0 to 1.0)"]
    Normalizer --> BikeController["3D Bike Steering Input"]
```

#### Kinematic Formulation
1. Detect wrist coordinates for both hands: $\vec{P}_{\text{left}} = (x_L, y_L)$ and $\vec{P}_{\text{right}} = (x_R, y_R)$.
2. Calculate tilt angle:
   $$\theta_{\text{tilt}} = \operatorname{atan2}(y_R - y_L, x_R - x_L)$$
3. Normalize against deadzone and sensitivity threshold:
   $$\text{steer}_{\text{vision}} = \operatorname{clamp}\left(\frac{\theta_{\text{tilt}}}{\theta_{\text{max\_tilt}}}, -1.0, 1.0\right)$$
   where $\theta_{\text{max\_tilt}} \approx 0.35\text{ rad} \approx 20^\circ$. A deadzone of $\pm 0.05\text{ rad}$ prevents micro-jitter.

---

### 3. Performance & Threading Budget
- **Resolution**: 480p ($640 \times 480$) at 30 FPS to minimize GPU/CPU pressure.
- **Worker Execution**: Vision inference runs in a decoupled Web Worker / `requestVideoFrameCallback` to ensure the main thread Three.js rendering maintains an uncompromised 60 FPS.
- **Graceful Fallback**: If permissions are denied or hands exit the camera frame, steering automatically defaults to keyboard/touch controls.
