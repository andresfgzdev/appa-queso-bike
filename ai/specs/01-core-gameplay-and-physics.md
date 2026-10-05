# Spec 01: Core Gameplay, Endless Road & Chase Camera

## Status: Approved
## Feature: `features/game`

---

### 1. Functional Requirements

#### 1.1 Treadmill Conveyor Road System
- The road is composed of $N$ modular chunks ($N \ge 5$).
- Each chunk has length $L = 30\text{m}$ and width $W = 12\text{m}$.
- Rather than translating the bike infinitely into floating-point error space ($z \to \infty$), the simulation employs the **Treadmill Technique**:
  - The bike is pinned around $z = 0$.
  - Road chunks and roadside scenery (trees, streetlamps, curbs) move toward the camera with velocity $V_z = \text{baseSpeed} \times \Delta t$.
  - When a chunk passes $z > z_{\text{despawn}}$ ($z > 15\text{m}$ behind the camera), it is recycled to the horizon at $z = z_{\text{front}} - L$.

#### 1.2 Bike Steering & Kinematic Leaning
- **Input Channels**: Keyboard (`A`/`D`, `ArrowLeft`/`ArrowRight`), Pointer/Touch drag on screen.
- **Lateral Range**: Clamped within lane bounds $x \in [-4.5, 4.5]$.
- **Lateral Smoothing**:
  $$x_{\text{target}} = x_{\text{current}} + \text{input} \cdot v_{\text{lateral}} \cdot \Delta t$$
  $$x_{\text{bike}} = \text{lerp}(x_{\text{bike}}, x_{\text{target}}, \alpha_{\text{steer}})$$
- **Banking / Lean Angle**: When steering, the bike rotates around its local Z axis:
  $$\theta_{\text{bank}} = -\text{clamp}(\text{input}, -1, 1) \cdot \theta_{\text{max}} \quad (\theta_{\text{max}} \approx 0.28\text{ rad} \approx 16^\circ)$$

#### 1.3 Third-Person Chase Camera
- **Offset Vector**: $\vec{O}_{\text{cam}} = (0, 2.8, -5.5)$ relative to bike coordinate origin.
- **Look-At Target**: $\vec{T}_{\text{look}} = (x_{\text{bike}} \cdot 0.3, 1.2, 3.0)$ (slightly ahead of the cat).
- **Lag / Damping**:
  $$\vec{P}_{\text{cam}}(t) = \text{lerp}(\vec{P}_{\text{cam}}(t - \Delta t), \vec{P}_{\text{bike}} + \vec{O}_{\text{cam}}, \alpha_{\text{cam}})$$
  where $\alpha_{\text{cam}} \approx 0.08$ to provide dynamic velocity inertia when swerving.

---

### 2. Technical Contracts & Interfaces

```typescript
export interface InputState {
  steer: number;        // -1.0 (hard left) to +1.0 (hard right)
  boost: boolean;      // Spacebar / double tap
  switchCat: boolean;  // 'C' key or switch tap
}

export interface BikePhysicsState {
  x: number;
  y: number;
  z: number;
  speed: number;        // units per second
  leanAngle: number;    // radians
  wheelRotation: number;// radians (spinning wheels)
  pedalAngle: number;   // radians (crank rotation)
}

export interface RoadChunk {
  mesh: THREE.Group;
  zIndex: number;
  hasObstacles: boolean;
  length: number;
}

export interface GameTelemetry {
  distanceTraveledMeters: number;
  currentSpeedKmH: number;
  steerIntensity: number;
  isDrifting: boolean;
}
```

---

### 3. Acceptance Criteria
1. Road chunks cycle infinitely without frame hitching or memory leaks (monitored via `renderer.info.memory.geometries`).
2. Player can smoothly navigate between left and right curbs without clipping out of bounds.
3. Camera smoothly lags during hard swerves and returns to center behind the cat.
