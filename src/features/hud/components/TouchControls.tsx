import { ChevronLeft, ChevronRight } from "lucide-react";
import { PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { CatId, CAT_PROFILES } from "../../cat-rider/types";

interface TouchControlsProps {
  activeCatId: CatId;
  onSteer: (value: number) => void;
  onBoost: (active: boolean) => void;
  onSwitchCat: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Game-style thumb controls:
 *  - Left thumb: analog steering pad (slide between ◀ and ▶ without lifting the finger).
 *  - Right thumb: big TURBO button + round cat-switch button.
 * Pointer capture keeps each control tracking its own finger, so steering and turbo work
 * at the same time (multi-touch).
 */
export function TouchControls({ activeCatId, onSteer, onBoost, onSwitchCat }: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [steer, setSteer] = useState(0);
  const [boosting, setBoosting] = useState(false);
  const otherCat: CatId = activeCatId === "appa" ? "queso" : "appa";

  const steerFromEvent = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const raw = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 1.35;
    const value = Math.abs(raw) < 0.12 ? 0 : clamp(raw, -1, 1);
    setSteer(value);
    onSteer(value);
  };

  const releaseSteer = () => {
    setSteer(0);
    onSteer(0);
  };

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <>
      {/* Left thumb: steering pad */}
      <div
        ref={padRef}
        role="slider"
        aria-label="Dirección"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={steer}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          steerFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) steerFromEvent(e);
        }}
        onPointerUp={releaseSteer}
        onPointerCancel={releaseSteer}
        onLostPointerCapture={releaseSteer}
        onContextMenu={block}
        className="pointer-events-auto touch-none select-none relative w-44 h-[72px] rounded-full bg-slate-900/70 backdrop-blur-md border border-white/15 shadow-xl flex items-center justify-between px-5 text-white/80 text-2xl"
      >
        <ChevronLeft strokeWidth={3} className={`w-7 h-7 transition-transform ${steer < 0 ? "scale-125 text-white" : ""}`} />
        <ChevronRight strokeWidth={3} className={`w-7 h-7 transition-transform ${steer > 0 ? "scale-125 text-white" : ""}`} />
        {/* Thumb indicator */}
        <span
          className="absolute top-1/2 left-1/2 w-11 h-11 -mt-[22px] -ml-[22px] rounded-full bg-white/25 border border-white/40 shadow-inner"
          style={{ transform: `translateX(${steer * 52}px)` }}
        />
      </div>

      {/* Right thumb: cat switch + turbo */}
      <div className="pointer-events-auto flex items-end gap-3">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSwitchCat();
          }}
          onContextMenu={block}
          aria-label={`Cambiar a ${CAT_PROFILES[otherCat].name}`}
          className="touch-none select-none w-14 h-14 rounded-full bg-slate-900/70 backdrop-blur-md border border-white/20 shadow-xl p-1 active:scale-90 transition-transform"
        >
          <img src={CAT_PROFILES[otherCat].photoUrl} alt="" draggable={false} className="w-full h-full rounded-full object-cover" />
        </button>
        <button
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setBoosting(true);
            onBoost(true);
          }}
          onPointerUp={() => {
            setBoosting(false);
            onBoost(false);
          }}
          onPointerCancel={() => {
            setBoosting(false);
            onBoost(false);
          }}
          onLostPointerCapture={() => {
            setBoosting(false);
            onBoost(false);
          }}
          onContextMenu={block}
          aria-label="Turbo"
          className={`touch-none select-none w-[76px] h-[76px] rounded-full backdrop-blur-md border shadow-xl font-black text-sm tracking-wider transition-all ${
            boosting
              ? "bg-amber-500/90 border-amber-200 text-slate-900 scale-95"
              : "bg-slate-900/70 border-amber-400/60 text-amber-300"
          }`}
        >
          TURBO
        </button>
      </div>
    </>
  );
}
