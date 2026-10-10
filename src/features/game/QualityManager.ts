export type QualityTier = "high" | "low";

export interface QualitySettings {
  tier: QualityTier;
  maxPixelRatio: number;
  minPixelRatio: number;
  shadowMapSize: number;
  msaaSamples: number;
  fxaa: boolean;
  furShells: number;
  particles: number;
}

const PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    tier: "high",
    maxPixelRatio: 2,
    minPixelRatio: 0.85,
    shadowMapSize: 2048,
    msaaSamples: 4,
    fxaa: false,
    furShells: 10,
    particles: 420,
  },
  low: {
    tier: "low",
    maxPixelRatio: 1.5,
    minPixelRatio: 0.6,
    shadowMapSize: 1024,
    msaaSamples: 0,
    fxaa: true,
    furShells: 6,
    particles: 160,
  },
};

/** Coarse device classification: phones/tablets and low-core machines get the light preset. */
export function detectQuality(): QualitySettings {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const smallScreen = Math.min(screen.width, screen.height) < 900;
  const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
  const forced = new URLSearchParams(location.search).get("quality");
  if (forced === "low" || forced === "high") return { ...PRESETS[forced] };
  return { ...PRESETS[(coarse && smallScreen) || fewCores ? "low" : "high"] };
}

/**
 * Dynamic resolution: watches the smoothed frame time and nudges the render pixel ratio
 * down when frames run long and back up when there's headroom (with hysteresis so it
 * doesn't oscillate). Keeps phones near 60 fps instead of stuttering at native DPR.
 */
export class AdaptiveResolution {
  public pixelRatio: number;
  private avgFrameMs = 16.7;
  private sinceChange = 0;

  constructor(private settings: QualitySettings, private apply: (pixelRatio: number) => void) {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio);
    this.apply(this.pixelRatio);
  }

  public update(deltaSeconds: number): void {
    const ms = deltaSeconds * 1000;
    this.avgFrameMs += (ms - this.avgFrameMs) * 0.05;
    this.sinceChange += deltaSeconds;
    if (this.sinceChange < 1.5) return;

    const cap = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
    let next = this.pixelRatio;
    if (this.avgFrameMs > 21 && this.pixelRatio > this.settings.minPixelRatio) {
      next = Math.max(this.settings.minPixelRatio, this.pixelRatio - 0.15);
    } else if (this.avgFrameMs < 13 && this.pixelRatio < cap) {
      next = Math.min(cap, this.pixelRatio + 0.1);
    }
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.apply(next);
      this.sinceChange = 0;
    }
  }
}
