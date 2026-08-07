import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { analyzeAudioFile } from "../audio/OfflineAnalyzer";
import { captureFrames } from "./frameCapture";
import { runFfmpeg, isFfmpegAvailable } from "./ffmpegRunner";
import { getDesktopBridge } from "./desktopBridge";
import type { MuraPalette } from "../theme/palettes";
import type { ReactivityControls } from "../audio/types";
import type { FallingIconsConfig } from "../iconDrops/fallingIconsEngine";

export interface VideoExportOptions {
  audioUri: string;
  waveformId: string;
  palette: MuraPalette;
  reactivity: ReactivityControls;
  iconDropConfig: FallingIconsConfig;
  width?: number;
  height?: number;
  fps?: number;
  seed?: number;
  onProgress?: (stage: string, progress: number) => void;
}

export interface VideoExportResult {
  outputUri: string;
  /** True on native when the file was saved to the device's photo library. */
  savedToLibrary: boolean;
  /** True on desktop when the user picked a save location (vs. cancelling
   * the dialog, in which case the file is still sitting in a temp folder,
   * reachable at `outputUri`). Always false on native. */
  savedToChosenPath: boolean;
}

/**
 * Full MP4 export pipeline: decode + analyze the whole song up front
 * (OfflineAnalyzer), render every frame to PNG (frameCapture), then hand
 * the PNG sequence + original audio to ffmpeg to mux into a single MP4.
 * Mirrors Kami's own `render.py`, which "pipes frames into ffmpeg, muxes
 * your audio" -- just via a mobile-native ffmpeg binary instead of a
 * desktop subprocess.
 *
 * Requires a prebuilt/dev-client build (ffmpeg-kit-react-native is a
 * native module) -- see ffmpegRunner.ts and the README's "Export & FFmpeg"
 * section for why, and what to do if it's unavailable.
 */
export async function exportVideo(opts: VideoExportOptions): Promise<VideoExportResult> {
  if (!isFfmpegAvailable()) {
    throw new Error(
      Platform.OS === "web"
        ? "Video export needs the packaged Mura desktop app, which runs a real ffmpeg in the " +
          "background -- it's not available in a plain browser tab. See the README's 'Desktop app' section."
        : "Video export needs ffmpeg-kit-react-native's native module, which isn't linked in this " +
          "runtime (Expo Go can't load it). Run `npx expo prebuild` and launch a dev-client or " +
          "standalone build -- see the README's 'Export & FFmpeg' section."
    );
  }

  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const fps = opts.fps ?? 30;
  const desktop = Platform.OS === "web" ? getDesktopBridge() : null;

  opts.onProgress?.("Analyzing audio", 0);
  const analysis = await analyzeAudioFile(opts.audioUri, fps);

  opts.onProgress?.("Rendering frames", 0);
  const { framesDir } = await captureFrames({
    analysis,
    waveformId: opts.waveformId,
    palette: opts.palette,
    reactivity: opts.reactivity,
    iconDropConfig: opts.iconDropConfig,
    width,
    height,
    seed: opts.seed,
    onProgress: (done, total) => opts.onProgress?.("Rendering frames", done / Math.max(1, total)),
  });

  const framesDirUri = framesDir.uri.endsWith("/") || framesDir.uri.endsWith("\\") ? framesDir.uri : `${framesDir.uri}/`;
  const framePattern = `${framesDirUri}frame_%06d.png`;

  const outputName = `mura_export_${Date.now()}.mp4`;
  const nativeOutputFile = desktop ? null : new File(Paths.cache, outputName);
  if (nativeOutputFile?.exists) nativeOutputFile.delete();
  const outputPath = desktop ? await desktop.makeTempPath(outputName) : nativeOutputFile!.uri;

  opts.onProgress?.("Encoding video", 0);
  const muxCommand =
    `-y -framerate ${fps} -i "${framePattern}" -i "${opts.audioUri}" ` +
    `-c:v libx264 -pix_fmt yuv420p -profile:v high -crf 18 -r ${fps} ` +
    `-c:a aac -b:a 192k -shortest "${outputPath}"`;

  let result = await runFfmpeg(muxCommand);
  if (!result.success) {
    // Fall back to mpeg4 in case this ffmpeg-kit build lacks libx264
    // (the "min" package variant doesn't include GPL codecs).
    const fallbackCommand =
      `-y -framerate ${fps} -i "${framePattern}" -i "${opts.audioUri}" ` +
      `-c:v mpeg4 -q:v 3 -r ${fps} -c:a aac -b:a 192k -shortest "${outputPath}"`;
    result = await runFfmpeg(fallbackCommand);
  }

  await framesDir.delete();

  if (!result.success) {
    throw new Error(`ffmpeg video encode failed:\n${result.logs}`);
  }

  let savedToLibrary = false;
  let savedToChosenPath = false;
  let outputUri = outputPath;

  if (desktop) {
    const chosen = await desktop.saveFileAs(outputPath, outputName, [{ name: "MP4 Video", extensions: ["mp4"] }]);
    if (chosen) {
      outputUri = chosen;
      savedToChosenPath = true;
    }
  } else {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.granted) {
        await MediaLibrary.createAssetAsync(outputPath);
        savedToLibrary = true;
      }
    } catch {
      savedToLibrary = false;
    }
  }

  opts.onProgress?.("Done", 1);
  return { outputUri, savedToLibrary, savedToChosenPath };
}
