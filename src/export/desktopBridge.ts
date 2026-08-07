/**
 * Typed wrapper around `window.muraDesktop`, the bridge electron/preload.js
 * exposes when Mura is running inside the desktop (Electron) app. It's
 * `undefined` in every other runtime -- Expo Go, a native dev-client/
 * standalone build, or a plain browser tab -- so every call site checks
 * `isDesktopAvailable()` first and falls back to the platform-appropriate
 * behavior otherwise (native: expo-file-system + ffmpeg-kit-react-native;
 * plain web: the "needs the desktop app" message).
 *
 * Why this exists at all: the renderer (this whole app) runs with Node
 * integration disabled, as Electron's own security guidance recommends, so
 * it can't touch the real filesystem or spawn ffmpeg directly. Every real
 * file write/read and every ffmpeg/ffprobe invocation happens in the main
 * process (electron/main.js); this bridge is the only way across that
 * boundary. See that file for what each call actually does.
 */

export interface FfmpegRunResult {
  success: boolean;
  returnCode: number | null;
  logs: string;
}

export interface MuraDesktopBridge {
  isAvailable: true;
  stageInputFile(bytes: Uint8Array, suggestedName: string): Promise<string>;
  makeTempPath(suggestedName: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  deletePath(target: string): Promise<void>;
  beginFrameSession(): Promise<string>;
  writeFrame(sessionId: string, index: number, bytes: Uint8Array): Promise<void>;
  finishFrameSession(sessionId: string): Promise<string>;
  cleanupFrameSession(sessionId: string): Promise<void>;
  runFfmpeg(command: string): Promise<FfmpegRunResult>;
  runFfprobe(command: string): Promise<string>;
  saveFileAs(
    sourcePath: string,
    suggestedName: string,
    filters: { name: string; extensions: string[] }[]
  ): Promise<string | null>;
}

declare global {
  interface Window {
    muraDesktop?: MuraDesktopBridge;
  }
}

export function getDesktopBridge(): MuraDesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.muraDesktop ?? null;
}

export function isDesktopAvailable(): boolean {
  return getDesktopBridge() !== null;
}
