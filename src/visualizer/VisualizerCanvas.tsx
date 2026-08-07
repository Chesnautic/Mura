import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { SceneLayer } from "./sceneRenderer";
import { getWaveformPreset } from "./registry";
import type { DrawCmd, EngineState, SceneContext } from "./engineTypes";
import { mulberry32, type MuraPalette } from "../theme/palettes";
import { applyReactivity, type AudioFeatures, type ReactivityControls } from "../audio/types";
import {
  buildFallingIconsScene,
  createFallingIconsState,
  type FallingIconsConfig,
} from "../iconDrops/fallingIconsEngine";

export interface VisualizerCanvasProps {
  width: number;
  height: number;
  waveformId: string;
  palette: MuraPalette;
  reactivity: ReactivityControls;
  iconDropConfig: FallingIconsConfig;
  /** Reanimated shared value updated by useLiveAudioFeatures -- read on
   * every animation frame. A plain object with a mutable `.value` works
   * equally well here if a caller ever wants to drive this from something
   * other than Reanimated. */
  featuresSource: SharedValue<AudioFeatures>;
  seed?: number;
  paused?: boolean;
}

/**
 * The live, in-app visualizer surface. Runs its own requestAnimationFrame
 * loop (rather than a Reanimated worklet) so the exact same
 * `preset.buildScene()` / `buildFallingIconsScene()` pure functions used
 * here are also exactly what export's offline frame-by-frame renderer
 * calls (see export/frameCapture.ts) -- one code path, two consumers,
 * guaranteeing preview and export never visually diverge.
 */
export function VisualizerCanvas({
  width,
  height,
  waveformId,
  palette,
  reactivity,
  iconDropConfig,
  featuresSource,
  seed = 1,
  paused = false,
}: VisualizerCanvasProps) {
  const [commands, setCommands] = useState<DrawCmd[]>([]);
  const waveformStateRef = useRef<EngineState>({});
  const activeWaveformIdRef = useRef<string>("");
  const iconStateRef = useRef<EngineState>(createFallingIconsState());
  const rngRef = useRef(mulberry32(seed));
  const lastTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Reset per-preset state (particle buffers, trail history, ...) whenever
  // the selected waveform changes, so switching presets never leaks state
  // from the previous one (e.g. stray particles from a different engine).
  useEffect(() => {
    if (activeWaveformIdRef.current !== waveformId) {
      activeWaveformIdRef.current = waveformId;
      waveformStateRef.current = getWaveformPreset(waveformId).createState();
    }
  }, [waveformId]);

  useEffect(() => {
    if (paused) return;
    let raf: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const now = Date.now();
      const dt = lastTimeRef.current ? Math.min(0.1, (now - lastTimeRef.current) / 1000) : 1 / 60;
      lastTimeRef.current = now;
      const t = (now - startTimeRef.current) / 1000;

      const preset = getWaveformPreset(waveformId);
      const features = applyReactivity(featuresSource.value, reactivity);
      const ctx: SceneContext = {
        width,
        height,
        features,
        reactivity,
        palette,
        t,
        dt,
        rng: rngRef.current,
      };

      const waveformCmds = preset.buildScene(ctx, waveformStateRef.current);
      const iconCmds = buildFallingIconsScene(ctx, iconStateRef.current, iconDropConfig);
      setCommands([...waveformCmds, ...iconCmds]);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [waveformId, width, height, palette, reactivity, iconDropConfig, featuresSource, paused]);

  return (
    <Canvas style={{ width, height }}>
      <SceneLayer commands={commands} />
    </Canvas>
  );
}
