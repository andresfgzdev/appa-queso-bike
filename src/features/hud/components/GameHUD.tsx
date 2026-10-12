import { Volume2, VolumeX } from "lucide-react";
import { CatId, CAT_PROFILES } from "../../cat-rider/types";
import { GameTelemetry } from "../../game/types";
import { TouchControls } from "./TouchControls";
import { useIsCompact, useIsTouch } from "./useInputMode";

interface GameHUDProps {
  telemetry: GameTelemetry;
  activeCatId: CatId;
  onSwitchCat: (catId?: CatId) => void;
  onSteerTouch: (dir: number) => void;
  onBoostTouch: (active: boolean) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

// Respect the iPhone notch / home indicator in every orientation
const SAFE_PADDING = {
  paddingTop: "max(12px, env(safe-area-inset-top))",
  paddingRight: "max(12px, env(safe-area-inset-right))",
  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
  paddingLeft: "max(12px, env(safe-area-inset-left))",
};

const Kbd = ({ children }: { children: string }) => (
  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">{children}</kbd>
);

export function GameHUD({
  telemetry,
  activeCatId,
  onSwitchCat,
  onSteerTouch,
  onBoostTouch,
  soundOn,
  onToggleSound,
}: GameHUDProps) {
  const isTouch = useIsTouch();
  const compact = useIsCompact();
  const activeProfile = CAT_PROFILES[activeCatId];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between select-none z-10" style={SAFE_PADDING}>
      {/* ---------------- TOP BAR ---------------- */}
      <div className="flex items-start justify-between gap-2">
        {/* Title + active rider */}
        <div
          className={`pointer-events-auto flex items-center bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/60 shadow-lg ${
            compact ? "gap-2 pl-1.5 pr-3 py-1.5" : "gap-3 px-4 py-2"
          }`}
        >
          <img
            src={activeProfile.photoUrl}
            alt={activeProfile.name}
            draggable={false}
            className={`${compact ? "w-7 h-7" : "w-8 h-8"} rounded-full object-cover border border-white/40`}
          />
          <div className="leading-tight">
            {!compact && <h1 className="text-sm font-bold tracking-wide text-white">Appa & Queso Bike</h1>}
            <p className={`${compact ? "text-xs" : "text-[11px]"} text-slate-300`}>
              {compact ? "" : "Piloto: "}
              <span className="font-semibold text-white">{activeProfile.name}</span>
            </p>
          </div>
        </div>

        {/* Speed / distance / sound */}
        <div
          className={`pointer-events-auto flex items-center bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/60 shadow-lg text-white ${
            compact ? "gap-2.5 pl-3.5 pr-1.5 py-1.5" : "gap-4 pl-5 pr-2.5 py-2"
          }`}
        >
          <div className="flex items-baseline gap-1">
            {!compact && <span className="text-xs text-slate-400 uppercase font-semibold">Vel:</span>}
            <span className={`${compact ? "text-base" : "text-xl"} font-black tabular-nums tracking-tight text-emerald-400`}>
              {telemetry.speedKmh}
            </span>
            <span className="text-[10px] text-slate-400">km/h</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-baseline gap-1">
            {!compact && <span className="text-xs text-slate-400 uppercase font-semibold">Dist:</span>}
            <span className={`${compact ? "text-sm" : "text-lg"} font-bold tabular-nums text-amber-300`}>
              {telemetry.distanceTraveledM}
            </span>
            <span className="text-[10px] text-slate-400">m</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={onToggleSound}
            aria-label={soundOn ? "Silenciar música ambiental" : "Activar música ambiental"}
            title={soundOn ? "Silenciar" : "Activar sonido"}
            className={`flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors ${
              isTouch ? "w-9 h-9" : "w-7 h-7"
            }`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ---------------- BOTTOM ---------------- */}
      {isTouch ? (
        // Thumb controls in the corners, centre of the screen left clear for the ride
        <div className="flex items-end justify-between gap-3">
          <TouchControls
            activeCatId={activeCatId}
            onSteer={onSteerTouch}
            onBoost={onBoostTouch}
            onSwitchCat={() => onSwitchCat()}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Cat switcher */}
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-full border border-slate-700/60 shadow-xl">
            {(["appa", "queso"] as CatId[]).map((id) => {
              const active = activeCatId === id;
              const accent = id === "appa" ? "bg-emerald-600 shadow-emerald-900/50" : "bg-amber-600 shadow-amber-900/50";
              const badge = id === "appa" ? "bg-emerald-800" : "bg-amber-800";
              return (
                <button
                  key={id}
                  onClick={() => onSwitchCat(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 active:scale-95 ${
                    active ? `${accent} text-white shadow-md font-semibold` : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <img src={CAT_PROFILES[id].photoUrl} alt={CAT_PROFILES[id].name} className="w-6 h-6 rounded-full object-cover border border-white/30" />
                  <span className="text-xs">{id === "appa" ? "Appa (Zen)" : "Queso (Caos)"}</span>
                  {active && <span className={`text-[10px] ${badge} px-1.5 py-0.5 rounded font-mono`}>Activo</span>}
                </button>
              );
            })}
            <span className="text-[10px] text-slate-400 font-mono px-2.5 py-1 bg-slate-800 rounded-full border border-slate-700">
              Tecla [C]
            </span>
          </div>

          {/* Keyboard hints */}
          {!compact && (
            <p className="text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1 rounded-full border border-slate-800/80 backdrop-blur-sm">
              Usa <Kbd>A</Kbd> / <Kbd>D</Kbd> o <Kbd>←</Kbd> / <Kbd>→</Kbd> para doblar • <Kbd>C</Kbd> cambiar gato • <Kbd>Espacio</Kbd> turbo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
