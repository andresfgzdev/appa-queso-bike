# Spec 02: Cat Rider Entity, Bike Model & Character Switcher

## Status: Approved
## Feature: `features/cat-rider`

---

### 1. Visual & Anatomical Specifications

#### 1.1 Real Cat Fidelity & Asset Pipeline
To faithfully represent the real-life **Appa** and **Queso**, the system defines a two-tier model pipeline:

1. **Source Asset Inputs (`public/assets/cats/`)**:
   - `appa.png` / `appa.jpg`: Reference photo(s) of Appa.
   - `queso.png` / `queso.jpg`: Reference photo(s) of Queso.
2. **Model Asset Loading (`public/assets/models/`)**:
   - `appa.glb` & `queso.glb`: Custom 3D meshes derived from real photos via Image-to-3D GenAI pipelines (e.g. Meshy, Tripo3D, or Blender photogrammetry).
   - **Procedural Shader Fallback**: If `.glb` assets are not present, the engine renders procedural low-poly rigs whose UVs and color maps are dynamically mapped to match their real fur coats, markings (patches, stripes, socks), and eye colors.

#### 1.2 Cat Real-Life Profiles
| Attribute | **Appa** (Real Cat Likeness) | **Queso** (Real Cat Likeness) |
| :--- | :--- | :--- |
| **Fur Coat & Markings** | Configured to real Appa coat (fur patterns, patches, bib) | Configured to real Queso coat (stripes, color gradients) |
| **Eye Color** | Matched to real Appa eyes | Matched to real Queso eyes |
| **Ear Posture & Shape** | Anatomically accurate to Appa | Anatomically accurate to Queso |
| **Riding Posture** | Upright, relaxed back, casual paw grip | Leaned forward over handlebars, intense stare |
| **Bike Theme** | Mint cyan / teal metallic frame | Cheddar yellow / flame orange frame |
| **Tail Physics** | Matched to Appa's real tail length/fluff | Matched to Queso's real tail length/fluff |

#### 1.3 The Bicycle Rig Architecture
The bicycle is constructed from optimized procedural Three.js low-poly primitives:
- `FrameGroup`: Diamond frame, seat post, and saddle.
- `SteeringGroup`: Fork, stem, and handlebars (rotates with steering input).
- `FrontWheel` & `RearWheel`: Spokes and tire rim rotating dynamically:
  $$\Delta \theta_{\text{wheel}} = \frac{v_{\text{bike}}}{r_{\text{wheel}}} \cdot \Delta t$$
- `CranksetGroup`: Pedals and crank arms linked to the cat's hind feet.

---

### 2. Pedaling & Kinematic Motion System

```mermaid
flowchart LR
    Speed["Bike Velocity (v)"] --> Angular["Wheel Angular Velocity (w)"]
    Angular --> Crank["Crankset Rotation (theta)"]
    Crank --> LeftPaw["Left Foot (theta)"]
    Crank --> RightPaw["Right Foot (theta + PI)"]
    Speed --> TailWave["Tail Sine Wave Oscillator"]
    Input["Steering Angle"] --> Handlebar["Handlebar Y-Rotation"]
```

1. **Pedal Synchronization**: As speed increases, the crankset rotates proportionally. Left and right rear paws track pedal anchors offset by $\pi$ radians ($180^\circ$).
2. **Handlebar Tracking**: Front paws remain clamped to handlebar grips while the handlebar pivots $\pm 15^\circ$ according to steering intensity.
3. **Dynamic Tail Oscillation**:
   $$\theta_{\text{tail}}(t) = A_{\text{tail}} \cdot \sin(\omega_{\text{speed}} \cdot t) + \text{driftOffset}$$

---

### 3. The Seamless Cat Switcher

#### 3.1 Switching Flow
1. Player clicks the **Switch Cat** UI button or presses the **`C`** key.
2. The `CatSwitcherService` transitions the active cat:
   - A playful visual "poof" particle burst or scale squash/stretch occurs.
   - The inactive cat mesh is toggled invisible; the active cat mesh is toggled visible.
   - The active bike material swaps frame colors (Teal $\leftrightarrow$ Cheddar Yellow).
3. The `ai-companion` receives a `CAT_SWITCHED` event, prompting an instant reactionary voice line (e.g., Queso complaining about Appa's slow pace or Appa wishing Queso would relax).

#### 3.2 TypeScript Contracts

```typescript
export type CatId = "appa" | "queso";

export interface CatProfile {
  id: CatId;
  name: string;
  breedDescription: string;
  themeColor: string;
  bikeColor: number;
  personalityType: "philosophical_zen" | "hyperactive_chaos";
  ttsVoicePitch: number;   // 0.8 for Appa, 1.4 for Queso
  ttsSpeechRate: number;   // 0.95 for Appa, 1.25 for Queso
}

export interface ICatRiderController {
  activeCatId: CatId;
  switchCat(targetId?: CatId): void;
  update(delta: number, speed: number, steerInput: number): void;
  getRootMesh(): THREE.Group;
}
```
