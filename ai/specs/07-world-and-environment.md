# Spec 07: World & Environment — Santa Monica at Golden Hour

## Status: Implemented
## Feature: `features/game` (world modules)

---

### 1. Cross-Section (inland ← path → ocean), bike-space X with path half-width e = 4.75 m

| X range | Strip | Contents |
|---|---|---|
| `−e−0.35 … −e−3.35` | Planter | Mulch, bougainvillea, agaves, vintage double-globe lamps, short coconut palms, benches, bike racks |
| `… −e−11.35` | Park lawn | Procedural mowed grass, tall Washingtonia fan palms, flower beds, picnic blankets |
| `… −e−13.35` | Sidewalk A | Concrete + curb |
| `… −e−25.35` | Street | Asphalt, parking lanes (parked sedans/vans), two traffic lanes with moving cars, double yellow + lane lines |
| `… −e−29.35` | Sidewalk B | Street trees with grates, café tables with umbrellas |
| `< −e−29.6` | Buildings | Pastel beach-front blocks, facade window atlas, awnings, rooftop units |
| `−e … e` | Bike path | Concrete with expansion joints, yellow dashed centre line |
| `e … SHORE_X+4.5` | Beach | Rippled sand; umbrella clusters, towels, chairs, coolers, beach balls, pop-up tents, surfboards, fire rings, volleyball court, surf shack, lifeguard towers, sandcastles, dune hummocks, showers |
| `> SHORE_X (24)` | Ocean | Global shader surface |

Beach props are scattered with a per-chunk occupancy map so they never overlap.

### 2. Sky (`SkyDome`)
Gradient dome pinned to the far plane: zenith → horizon tint, warm halo toward the sun
(`SUN_DIRECTION = (0.55, 0.24, −0.8)`), soft sun disc, procedural cumulus band, two hazy ridge
lines of distant mountains on the inland side, horizon haze matching the scene fog. The same
shader is baked into a PMREM environment map for image-based lighting.

### 3. Ocean (`Ocean`)
One 360 × 560 m surface (not chunked), waves scroll with distance travelled:
- Vertex: three directional sine waves, swell fades in from the shore.
- Fragment: ripple normals, Fresnel sky reflection, HDR sun glint, shallow → deep colour,
  breathing waterline with foam, wet sand sheen, and **organic breaking sets** (bent wave lines
  rolling toward the shore with trailing foam).

### 4. Landmarks & Life
- **Santa Monica-style pier** (`Landmarks.ts`): deck at 10 m spanning the beach so the bike path
  runs underneath; pilings (instanced, path kept clear), railings, lamps, arcade buildings,
  roller coaster and a Ferris wheel with 144 HDR bulbs and upright-hanging gondolas. Respawns
  ~1.4 km ahead.
- **Sky life** (`SkyLife.ts`): brown pelicans in echelon with rippling flaps, sailboats bobbing on
  the horizon, kites with strings. Plus white seagulls (instanced) in `RoadManager`.
- **Traffic** (`Traffic.ts`): two lanes, gap-keeping, recycling; 2 draw calls.
- **Particles**: sun-lit sand motes that sparkle toward the sun and stream past with speed.

### 5. Palms (`PalmTreeFactory`)
- Coconut palm variants: curved ring-barked trunk, 11–14 arching pinnate fronds, coconuts.
- Washingtonia fan palms: 13–19 m skinny trunks, dead-frond skirt, 16–21 pleated fan leaves.
- Variants are generated once with a seeded PRNG and shared.

### 6. Acceptance Criteria
1. No visible world edge from any intro or gameplay camera.
2. No props intersecting each other or the pier deck.
3. The scene reads as "Southern California beach at sunset" from the gameplay camera alone.
