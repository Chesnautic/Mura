/**
 * Web-target implementation of the ffmpegRunner surface (Metro picks this
 * file automatically over ffmpegRunner.ts whenever bundling for
 * `Platform.OS === "web"` -- see index.ts, which is also how the desktop
 * app runs, since it's the Expo web export loaded inside Electron).
 *
 * There is no `ffmpeg-kit-react-native` on web at all -- requiring it here
 * would throw immediately, the same native-module error the Expo Go build
 * had before it was fixed to route around the require() entirely. On the
 * desktop app specifically, real ffmpeg/ffprobe binaries run in the
 * Electron main process instead (see electron/main.js); this file forwards
 * to them through `desktopBridge.ts`. In a plain browser tab (no Electron
 * bridge present -- e.g. running `npx expo start --web` directly to poke at
 * the UI during development), export honestly reports itself unavailable.
 */
import { getDesktopBridge } from "./desktopBridge";
import type { FfmpegResult } from "./ffmpegRunner";

export function isFfmpegAvailable(): boolean {
  return getDesktopBridge() !== null;
}

export async function runFfmpeg(command: string): Promise<FfmpegResult> {
  const bridge = getDesktopBridge();
  if (!bridge) {
    throw new Error(
      "ffmpeg is only available in the Mura desktop app. Running in a plain browser tab? " +
        "Export needs the packaged Electron app -- see the README's 'Desktop app' section."
    );
  }
  return bridge.runFfmpeg(command);
}

export async function runFfprobe(command: string): Promise<string> {
  const bridge = getDesktopBridge();
  if (!bridge) {
    throw new Error("ffprobe is only available in the Mura desktop app.");
  }
  return bridge.runFfprobe(command);
}
