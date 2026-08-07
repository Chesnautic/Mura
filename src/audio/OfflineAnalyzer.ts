import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { runFfmpeg, runFfprobe } from "../export/ffmpegRunner";
import { getDesktopBridge } from "../export/desktopBridge";
import { FeatureExtractor } from "./FeatureExtractor";
import type { AudioFeatures } from "./types";

export interface OfflineAnalysis {
  features: AudioFeatures[];
  fps: number;
  durationSec: number;
  sampleRate: number;
}

const ANALYSIS_SAMPLE_RATE = 44100;

/**
 * Decodes an entire audio file to raw PCM up front and runs the same
 * `FeatureExtractor` used for live preview over it window-by-window, at a
 * fixed timeline (one `AudioFeatures` frame per exported video frame).
 *
 * This mirrors Kami's own render pipeline, where `audio_analysis.py` reads
 * the whole WAV via numpy before rendering a single frame, so the visuals
 * are driven by a known, complete timeline instead of reacting live -- it's
 * what makes `--dry-run`/`--sequence` possible on desktop, and here it's
 * what makes export deterministic and independent of real-time playback
 * speed (the phone can render frames faster OR slower than 1x without the
 * visuals drifting out of sync with the beat).
 *
 * Requires ffmpeg (see ffmpegRunner.ts) to decode arbitrary input formats
 * (mp3/m4a/wav/...) to a raw PCM stream, since React Native has no built-in
 * general-purpose audio decoder exposed to JS.
 */
export async function analyzeAudioFile(
  inputUri: string,
  fps: number
): Promise<OfflineAnalysis> {
  const durationStr = await runFfprobe(
    `-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputUri}"`
  );
  const durationSec = parseFloat(durationStr.trim()) || 0;
  if (!durationSec || !isFinite(durationSec)) {
    throw new Error(`Could not read duration for ${inputUri} (ffprobe returned "${durationStr}")`);
  }

  // On native, `File`/`Paths` (expo-file-system) give us a real path ffmpeg
  // can write to directly. On web/desktop, expo-file-system's File/Directory
  // are inert stubs (there's no general filesystem access from a browser
  // renderer) -- the desktop app instead asks the Electron main process for
  // a real temp path, and reads the result back over the IPC bridge once
  // ffmpeg (also running in the main process) has written it. See
  // desktopBridge.ts / electron/main.js for the other half of this.
  const desktop = Platform.OS === "web" ? getDesktopBridge() : null;
  const pcmFile = desktop ? null : new File(Paths.cache, `mura_analysis_${Date.now()}.pcm`);
  const pcmPath = desktop
    ? await desktop.makeTempPath(`mura_analysis_${Date.now()}.pcm`)
    : pcmFile!.uri;

  if (pcmFile?.exists) pcmFile.delete();

  const result = await runFfmpeg(
    `-y -i "${inputUri}" -vn -f f32le -ar ${ANALYSIS_SAMPLE_RATE} -ac 1 "${pcmPath}"`
  );
  if (!result.success) {
    throw new Error(`ffmpeg PCM decode failed:\n${result.logs}`);
  }

  try {
    const bytes = desktop ? await desktop.readFile(pcmPath) : await pcmFile!.bytes();
    // Copy into a fresh, aligned ArrayBuffer before viewing as Float32Array
    // -- the buffer we get back isn't guaranteed to start at a 4-byte-
    // aligned offset.
    const aligned = new Uint8Array(bytes.length);
    aligned.set(bytes);
    const samples = new Float32Array(aligned.buffer);

    const extractor = new FeatureExtractor({ sampleRate: ANALYSIS_SAMPLE_RATE });
    const frameCount = Math.max(1, Math.round(durationSec * fps));
    const samplesPerFrame = Math.round(ANALYSIS_SAMPLE_RATE / fps);
    const dt = 1 / fps;

    const features: AudioFeatures[] = [];
    for (let i = 0; i < frameCount; i++) {
      const start = i * samplesPerFrame;
      const end = Math.min(samples.length, start + samplesPerFrame);
      const chunk = start < samples.length ? samples.subarray(start, end) : new Float32Array(0);
      const padded = chunk.length < samplesPerFrame ? padTo(chunk, samplesPerFrame) : (chunk as Float32Array);
      features.push(extractor.push(padded, dt));
    }

    return { features, fps, durationSec, sampleRate: ANALYSIS_SAMPLE_RATE };
  } finally {
    if (desktop) {
      await desktop.deletePath(pcmPath);
    } else if (pcmFile?.exists) {
      pcmFile.delete();
    }
  }
}

function padTo(chunk: Float32Array, len: number): Float32Array {
  const out = new Float32Array(len);
  out.set(chunk);
  return out;
}
