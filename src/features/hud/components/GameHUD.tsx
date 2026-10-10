import { Volume2, VolumeX } from "lucide-react";
import { CatId, CAT_PROFILES } from "../../cat-rider/types";
import { GameTelemetry } from "../../game/types";

interface GameHUDProps {
  telemetry: GameTelemetry;
  activeCatId: CatId;
  onSwitchCat: (catId?: CatId) => void;
  onSteerTouch: (dir: number) => void;
  onBoostTouch: (active: boolean) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function GameHUD({
  telemetry,
  activeCatId,
  onSwitchCat,
  onSteerTouch,
  onBoostTouch,
  soundOn,
  onToggleSound,
}: GameHUDProps) {
  const activeProfile = CAT_PROFILES[activeCatId];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none z-10">
      {/* --- TOP BAR: DASHBOARD --- */}
      <div className="flex items-center justify-between pointer-events-auto">
        {/* Game Title & Current Cat Pill */}
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/60 shadow-lg">
          <img
            src={activeProfile.photoUrl}
            alt={activeProfile.name}
            className="w-8 h-8 rounded-full object-cover border border-white/40"
          />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white leading-tight">
              Appa & Queso Bike
            </h1>
            <p className="text-[11px] text-slate-300">
              Piloto: <span className="font-semibold text-white">{activeProfile.name}</span>
            </p>
          </div>
        </div>

        {/* Speed & Distance Metric Display */}
        <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-700/60 shadow-lg text-white">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Vel:</span>
            <span className="text-xl font-black tabular-nums tracking-tight text-emerald-400">
              {telemetry.speedKmh}
            </span>
            <span className="text-[10px] text-slate-400">km/h</span>
          </div>

          <div className="w-[1px] h-4 bg-slate-700" />

          <div className="flex items-baseline gap-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Dist:</span>
            <span className="text-lg font-bold tabular-nums text-amber-300">
              {telemetry.distanceTraveledM}
            </span>
            <span className="text-[10px] text-slate-400">m</span>
          </div>

          <div className="w-[1px] h-4 bg-slate-700" />

          <button
            onClick={onToggleSound}
            aria-label={soundOn ? "Silenciar música ambiental" : "Activar música ambiental"}
            title={soundOn ? "Silenciar" : "Activar sonido"}
            className="flex items-center justify-center w-7 h-7 -my-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* --- BOTTOM SECTION: CONTROLS & CAT SWITCHER --- */}
      <div className="flex flex-col items-center gap-3">
        {/* Cat Switcher Pill Bar */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-full border border-slate-700/60 shadow-xl">
          {/* Appa Button */}
          <button
            onClick={() => onSwitchCat("appa")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 active:scale-95 ${
              activeCatId === "appa"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50 font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <img
              src={CAT_PROFILES.appa.photoUrl}
              alt="Appa"
              className="w-6 h-6 rounded-full object-cover border border-white/30"
            />
            <span className="text-xs">Appa (Zen)</span>
            {activeCatId === "appa" && (
              <span className="text-[10px] bg-emerald-800 px-1.5 py-0.5 rounded font-mono">Activo</span>
            )}
          </button>

          {/* Queso Button */}
          <button
            onClick={() => onSwitchCat("queso")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 active:scale-95 ${
              activeCatId === "queso"
                ? "bg-amber-600 text-white shadow-md shadow-amber-900/50 font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <img
              src={CAT_PROFILES.queso.photoUrl}
              alt="Queso"
              className="w-6 h-6 rounded-full object-cover border border-white/30"
            />
            <span className="text-xs">Queso (Caos)</span>
            {activeCatId === "queso" && (
              <span className="text-[10px] bg-amber-800 px-1.5 py-0.5 rounded font-mono">Activo</span>
            )}
          </button>

          {/* Shortcut Hint Badge */}
          <span className="text-[10px] text-slate-400 font-mono px-2.5 py-1 bg-slate-800 rounded-full border border-slate-700 hidden sm:inline-block">
            Tecla [C]
          </span>
        </div>

        {/* Mobile / Screen Steering Touch Buttons */}
        <div className="w-full flex items-center justify-between max-w-sm pointer-events-auto sm:hidden px-2">
          <button
            onPointerDown={() => onSteerTouch(-1)}
            onPointerUp={() => onSteerTouch(0)}
            onPointerLeave={() => onSteerTouch(0)}
            onPointerCancel={() => onSteerTouch(0)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Doblar a la izquierda"
            className="touch-none w-20 h-16 rounded-2xl bg-slate-900/80 border border-slate-700 active:bg-slate-700 text-white flex items-center justify-center font-bold text-lg active:scale-95"
          >
            ◀
          </button>
          <button
            onPointerDown={() => onBoostTouch(true)}
            onPointerUp={() => onBoostTouch(false)}
            onPointerLeave={() => onBoostTouch(false)}
            onPointerCancel={() => onBoostTouch(false)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Turbo"
            className="touch-none w-20 h-16 rounded-2xl bg-slate-900/80 border border-amber-500/50 active:bg-amber-700 text-amber-300 flex items-center justify-center font-bold text-sm active:scale-95"
          >
            TURBO
          </button>
          <button
            onPointerDown={() => onSteerTouch(1)}
            onPointerUp={() => onSteerTouch(0)}
            onPointerLeave={() => onSteerTouch(0)}
            onPointerCancel={() => onSteerTouch(0)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Doblar a la derecha"
            className="touch-none w-20 h-16 rounded-2xl bg-slate-900/80 border border-slate-700 active:bg-slate-700 text-white flex items-center justify-center font-bold text-lg active:scale-95"
          >
            ▶
          </button>
        </div>

        {/* Keyboard Helper Footer */}
        <p className="text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1 rounded-full border border-slate-800/80 backdrop-blur-sm hidden sm:block">
          Usa <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">A</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">D</kbd> o <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">←</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">→</kbd> para doblar • <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">C</kbd> cambiar gato • <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">Espacio</kbd> turbo
        </p>
      </div>
    </div>
  );
}
