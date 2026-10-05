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

#### 1.2 Cat Real-Life Profiles (Confirmed from Photos)
| Attribute | **Appa** (Real Cat Likeness) | **Queso** (Real Cat Likeness) |
| :--- | :--- | :--- |
| **Fur Coat & Markings** | Pristine white coat with soft grey/brown tabby cap & forehead markings | Rich ginger/orange tabby with crisp white bib/chest and white mittens |
| **Eye Color & Expression** | Inquisitive hazel-green eyes; calm, regal posture | Alert, expressive amber-green eyes; enthusiastic posture |
| **Nose & Face** | Dark hazel/brown nose tip, slender face | Bright coral-pink nose, prominent white muzzle |
| **Source Asset** | `public/assets/cats/appa.png` (Transparent cutout) | `public/assets/cats/queso.png` (Transparent cutout) |
| **Bike Theme** | Mint cyan / teal metallic frame | Cheddar yellow / flame orange frame |
| **Voice Profile (TTS)** | Pitch: `0.85`, Rate: `0.95`, contemplative & zen | Pitch: `1.45`, Rate: `1.30`, energetic & chaotic |

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
