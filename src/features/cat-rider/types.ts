export type CatId = "appa" | "queso";

export interface CatProfile {
  id: CatId;
  name: string;
  themeColor: string;
  frameColorHex: number;
  photoUrl: string;
  bio: string;
}

export const CAT_PROFILES: Record<CatId, CatProfile> = {
  appa: {
    id: "appa",
    name: "Appa",
    themeColor: "text-emerald-400 border-emerald-500/50 bg-emerald-950/40",
    frameColorHex: 0x22c55e, // Mint Teal / Green
    photoUrl: "/assets/cats/appa.png",
    bio: "Chill, fluffy & philosophical. Observes the breeze and ponders the meaning of the road.",
  },
  queso: {
    id: "queso",
    name: "Queso",
    themeColor: "text-amber-400 border-amber-500/50 bg-amber-950/40",
    frameColorHex: 0xf97316, // Cheddar Orange
    photoUrl: "/assets/cats/queso.png",
    bio: "Hyperactive & chaos-driven. Speed demon fueled by cheese, birds, and pure zoomies.",
  },
};
