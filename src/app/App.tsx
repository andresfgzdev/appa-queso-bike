import { useEffect, useRef, useState } from "react";
import { CatId } from "../features/cat-rider/types";
import { GameEngine } from "../features/game/GameEngine";
import { GameTelemetry } from "../features/game/types";
import { GameHUD } from "../features/hud/components/GameHUD";
import { IntroOverlay } from "../features/hud/components/IntroOverlay";

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [activeCatId, setActiveCatId] = useState<CatId>("appa");
  const [sound, setSound] = useState({ enabled: true, started: false });
  const [introPlaying, setIntroPlaying] = useState(() => !new URLSearchParams(location.search).has("nointro"));
  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 25,
    distanceTraveledM: 0,
    steerIntensity: 0,
    activeCatId: "appa",
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Game Engine
    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;

    // Listen to real-time telemetry from 3D physics loop
    engine.onTelemetry = (data) => {
      setTelemetry(data);
    };

    // Keep HUD in sync whether the switch came from the keyboard or a button
    engine.onCatSwitched = (catId) => {
      setActiveCatId(catId);
    };

    engine.onIntroChange = setIntroPlaying;

    // Ambient soundscape state (starts on the first gesture; remembers mute)
    setSound({ enabled: engine.audio.enabled, started: engine.audio.isStarted });
    engine.audio.onStateChange = (enabled, started) => setSound({ enabled, started });

    engine.start();
    if (!new URLSearchParams(location.search).has("nointro")) engine.playIntro();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleSwitchCat = (targetId?: CatId) => {
    engineRef.current?.switchCat(targetId);
  };

  const handleSteerTouch = (dir: number) => {
    if (engineRef.current) {
      engineRef.current.input.setSteerManual(dir);
    }
  };

  const handleBoostTouch = (active: boolean) => {
    engineRef.current?.input.setBoostManual(active);
  };

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#ffc7a2]">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full touch-none" />

      {/* Cinematic title card during the intro camera flight */}
      <IntroOverlay
        visible={introPlaying}
        onSkip={() => engineRef.current?.skipIntro()}
        showSoundPrompt={sound.enabled && !sound.started}
        onEnableSound={() => engineRef.current?.audio.setEnabled(true)}
      />

      {/* Reactive Glassmorphic Game HUD (fades in once gameplay starts) */}
      <div
        className={`transition-opacity duration-1000 ${introPlaying ? "opacity-0 invisible" : "opacity-100 visible"}`}
      >
        <GameHUD
          telemetry={telemetry}
          activeCatId={activeCatId}
          onSwitchCat={handleSwitchCat}
          onSteerTouch={handleSteerTouch}
          onBoostTouch={handleBoostTouch}
          soundOn={sound.enabled}
          onToggleSound={() => engineRef.current?.audio.toggle()}
        />
      </div>
    </main>
  );
}
