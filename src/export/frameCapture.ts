import React from "react";
import { Platform } from "react-native";
import { drawAsImage, ImageFormat } from "@shopify/react-native-skia";
import { Directory, File, Paths } from "expo-file-system";
import { SceneLayer } from "../visualizer/sceneRenderer";
import { getWaveformPreset } from "../visualizer/registry";
import type { SceneContext } from "../visualizer/engineTypes";
import { mulberry32, type MuraPalette } from "../theme/palettes";
import { applyReactivity, type ReactivityControls } from "../audio/types";
import type { OfflineAnalysis } from "../audio/OfflineAnalyzer";
import { getDesktopBridge } from "./desktopBridge";
import {
  buildFallingIconsScene,
  createFallingIconsState,
  type FallingIconsConfig,
} from "../iconDrops/fallingIconsEngine";

export interface FrameCaptureOptions {
  analysis: OfflineAnalysis;
  waveformId: string;
  palette: MuraPalette;
  reactivity: ReactivityControls;
  iconDropConfig: FallingIconsConfig;
  width: number;
  height: number;
  seed?: number;
  onProgress?: (framesDone: number, framesTotal: number) => void;
}

/** A directory of `frame_%06d.png` files ready for ffmpeg's `-i` pattern --
 * either a real expo-file-system Directory (native) or a thin shim over the
 * Electron main process's real temp dir (desktop web). */
export interface FramesLocation {
  uri: string;
  delete(): void | Promise<void>;
}

export interface FrameCaptureResult {
  framesDir: FramesLocation;
  frameCount: number;
  fps: number;
}

/**
 * Renders every frame of a precomputed audio-feature timeline to a PNG
 * sequence on disk, using the exact same `preset.buildScene()` and
 * `buildFallingIconsScene()` calls the live preview uses -- see
 * VisualizerCanvas.tsx for the live-side twin of this loop. Sequential
 * (not parallel): each waveform preset's engine state (particle buffers,
 * trail history, rotation accumulators) must be threaded frame-to-frame in
 * order, exactly like Kami's own render.py loop.
 */
export async function captureFrames(opts: FrameCaptureOptions): Promise<FrameCaptureResult> {
  const { analysis, waveformId, palette, reactivity, iconDropConfig, width, height } = opts;
  const preset = getWaveformPreset(waveformId);
  const waveformState = preset.createState();
  const iconState = createFallingIconsState();
  const rng = mulberry32(opts.seed ?? 1);

  // Native: a real expo-file-system Directory, written to directly. Desktop
  // (web target, running inside Electron): expo-file-system's File/Directory
  // are inert stubs there, so frame bytes go over the IPC bridge instead and
  // land in a real temp dir the Electron main process manages -- see
  // desktopBridge.ts / electron/main.js.
  const desktop = Platform.OS === "web" ? getDesktopBridge() : null;
  const nativeDir = desktop ? null : new Directory(Paths.cache, `mura_frames_${Date.now()}`);
  if (nativeDir) {
    if (nativeDir.exists) nativeDir.delete();
    nativeDir.create();
  }
  const sessionId = desktop ? await desktop.beginFrameSession() : null;

  const total = analysis.features.length;
  for (let i = 0; i < total; i++) {
    const rawFeatures = analysis.features[i];
    const features = applyReactivity(rawFeatures, reactivity);
    const ctx: SceneContext = {
      width,
      height,
      features,
      reactivity,
      palette,
      t: rawFeatures.t,
      dt: 1 / analysis.fps,
      rng,
    };

    const waveformCmds = preset.buildScene(ctx, waveformState);
    const iconCmds = buildFallingIconsScene(ctx, iconState, iconDropConfig);
    const commands = [...waveformCmds, ...iconCmds];

    const element = React.createElement(SceneLayer, { commands });
    const image = await drawAsImage(element, { width, height });
    if (!image) {
      throw new Error(`Mura: drawAsImage returned null for frame ${i}. Skia offscreen rendering may be unsupported on this platform/runtime.`);
    }
    const bytes = image.encodeToBytes(ImageFormat.PNG);

    if (desktop && sessionId) {
      await desktop.writeFrame(sessionId, i, bytes);
    } else {
      const frameFile = new File(nativeDir!, `frame_${String(i).padStart(6, "0")}.png`);
      frameFile.write(bytes);
    }

    opts.onProgress?.(i + 1, total);
  }

  const framesDir: FramesLocation =
    desktop && sessionId
      ? {
          uri: await desktop.finishFrameSession(sessionId),
          delete: () => desktop.cleanupFrameSession(sessionId),
        }
      : nativeDir!;

  return { framesDir, frameCount: total, fps: analysis.fps };
}
