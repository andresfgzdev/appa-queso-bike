import { useEffect, useState } from "react";

interface IntroOverlayProps {
  visible: boolean;
  onSkip: () => void;
  /** Show the "enable sound" pill (audio can only start after a user gesture). */
  showSoundPrompt: boolean;
  onEnableSound: () => void;
}

/** Title card that plays over the cinematic camera flight. */
export function IntroOverlay({ visible, onSkip, showSoundPrompt, onEnableSound }: IntroOverlayProps) {
  const [stage, setStage] = useState<"hidden" | "title" | "out">("hidden");

  useEffect(() => {
    if (!visible) {
      setStage("out");
      return;
    }
    setStage("hidden");
    const t1 = setTimeout(() => setStage("title"), 1100);
    const t2 = setTimeout(() => setStage("out"), 6200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  const showTitle = visible && stage === "title";

  return (
    <div
      className={`absolute inset-0 z-20 select-none transition-opacity duration-700 ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onPointerDown={onSkip}
    >
      <div className="absolute inset-x-0 top-[17%] [@media(max-height:520px)]:top-[15%] flex flex-col items-center text-center px-6">
        <h1
          className={`font-serif text-white text-5xl sm:text-7xl md:text-8xl [@media(max-height:520px)]:text-5xl tracking-tight drop-shadow-[0_4px_24px_rgba(120,50,10,0.55)] transition-all duration-[1400ms] ease-out ${
            showTitle ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"
          }`}
        >
          Appa <span className="italic font-light text-amber-100">&amp;</span> Queso
        </h1>
        <p
          className={`mt-3 text-white/90 text-sm sm:text-base uppercase tracking-[0.35em] drop-shadow-[0_2px_10px_rgba(120,50,10,0.6)] transition-all duration-[1400ms] delay-300 ease-out ${
            showTitle ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          Un paseo al atardecer
        </p>
      </div>

      {showSoundPrompt && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onEnableSound();
          }}
          className="absolute bottom-[18%] [@media(max-height:520px)]:bottom-[20%] left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-md text-white text-xs sm:text-sm tracking-wide transition-colors"
        >
          <span aria-hidden>🔊</span> Activar sonido ambiental
        </button>
      )}

      <p className="absolute bottom-[14%] w-full text-center text-[11px] sm:text-xs text-white/70 tracking-widest uppercase animate-pulse">
        Toca o presiona una tecla para saltar
      </p>
    </div>
  );
}
