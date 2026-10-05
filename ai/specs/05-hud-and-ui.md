# Spec 05: Heads-Up Display (HUD) & UI Overlay

## Status: Approved
## Feature: `features/hud`

---

### 1. Visual Design & UI Layout

The UI floats over the Three.js WebGL canvas utilizing **Tailwind CSS** backdrop blur (glassmorphism) and **shadcn/ui** design tokens:

```
+-------------------------------------------------------------------------+
|  [Appa & Queso Bike]         [ Speed: 24 km/h | 412 m ]       [Sound On]|
+-------------------------------------------------------------------------+
|                                                                         |
|                +---------------------------------------+                |
|                | [Cat Avatar] "Did you see that bird?" |                |
|                |              - Queso                  |                |
|                +---------------------------------------+                |
|                                                                         |
|                                                                         |
|                                                                         |
| [ < Steer Left ]                                      [ Steer Right > ] |
|                                                                         |
|                     +---------------------------+                       |
|                     | (*) Appa    |    Queso [C]|                       |
|                     +---------------------------+                       |
+-------------------------------------------------------------------------+
```

---

### 2. Component Hierarchy

```
src/features/hud/components/
├── GameHUD.tsx                 # Master HUD container
├── TopDashboard.tsx            # Odometer, digital speedometer, sound toggle
├── CatSwitchBar.tsx            # Interactive Appa & Queso selector with [C] hotkey
├── ThoughtBubble.tsx           # Comic speech bubble with animated typing and avatar
└── MobileControls.tsx          # Touch steering buttons (visible on touch devices)
```

---

### 3. Component Specifications

#### 3.1 `CatSwitchBar.tsx`
- Renders dual pill buttons for **Appa** (Teal accent) and **Queso** (Orange accent).
- Highlights the active rider with an animated active badge.
- Displays keyboard shortcut cue (`[C]`).
- Clicking or tapping immediately fires `onCatSwitch()`.

#### 3.2 `ThoughtBubble.tsx`
- Subscribes to the `ai-companion` dialogue stream.
- Smoothly fades in via `tailwindcss-animate` (`animate-in fade-in zoom-in-95`).
- Displays the speaker's name, custom avatar, and the generated quote.
- Automatically dismisses after its duration expires.

#### 3.3 `TopDashboard.tsx`
- Real-time speedometer reading in **km/h**.
- Distance counter in meters ($m$).
- Volume/Mute button controlling Web Speech TTS output.
