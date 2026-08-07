import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { runFfmpeg, isFfmpegAvailable } from "./ffmpegRunner";
import { getDesktopBridge } from "./desktopBridge";

export interface AudioExportOptions {
  audioUri: string;
  /** Constant bitrate in kbps. Default 320 (highest-quality standard MP3). */
  bitrateKbps?: number;
  fileName?: string;
}

export interface AudioExportResult {
  outputUri: string;
  savedToLibrary: boolean;
  savedToChosenPath: boolean;
}

/**
 * Transcodes any source audio (wav/m4a/aac/existing mp3/...) to a clean
 * standalone MP3 via ffmpeg's libmp3lame encoder. This is what backs
 * "export to MP3" independent of the video pipeline -- useful for just
 * pulling the trimmed/converted audio itself, no visualizer involved.
 */
export async function exportAudioAsMp3(opts: AudioExportOptions): Promise<AudioExportResult> {
  if (!isFfmpegAvailable()) {
    throw new Error(
      Platform.OS === "web"
        ? "MP3 export needs the packaged Mura desktop app, which runs a real ffmpeg in the " +
          "background -- it's not available in a plain browser tab. See the README's 'Desktop app' section."
        : "MP3 export needs ffmpeg-kit-react-native's native module, which isn't linked in this " +
          "runtime (Expo Go can't load it). Run `npx expo prebuild` and launch a dev-client or " +
          "standalone build -- see the README's 'Export & FFmpeg' section."
    );
  }

  const bitrate = opts.bitrateKbps ?? 320;
  const name = opts.fileName ?? `mura_audio_${Date.now()}.mp3`;
  const desktop = Platform.OS === "web" ? getDesktopBridge() : null;

  const nativeOutputFile = desktop ? null : new File(Paths.cache, name);
  if (nativeOutputFile?.exists) nativeOutputFile.delete();
  const outputPath = desktop ? await desktop.makeTempPath(name) : nativeOutputFile!.uri;

  const command = `-y -i "${opts.audioUri}" -vn -codec:a libmp3lame -b:a ${bitrate}k "${outputPath}"`;
  const result = await runFfmpeg(command);
  if (!result.success) {
    throw new Error(`ffmpeg MP3 encode failed:\n${result.logs}`);
  }

  let savedToLibrary = false;
  let savedToChosenPath = false;
  let outputUri = outputPath;

  if (desktop) {
    const chosen = await desktop.saveFileAs(outputPath, name, [{ name: "MP3 Audio", extensions: ["mp3"] }]);
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

  return { outputUri, savedToLibrary, savedToChosenPath };
}
