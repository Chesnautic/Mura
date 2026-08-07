/**
 * Thin wrapper around `ffmpeg-kit-react-native`.
 *
 * IMPORTANT CONTEXT (also covered in the top-level README's "Export &
 * FFmpeg" section -- read that before touching this file): FFmpegKit was
 * retired by its maintainer in 2025. The last published version
 * (6.0.2, used here) still works and is what this module is written
 * against, but it will not receive further fixes, and it is a native
 * module -- it requires `npx expo prebuild` (a bare/dev-client build), it
 * will NOT run inside Expo Go. Everything else in Mura (all 50 waveform
 * engines, all 10 icon drops, live preview, color studio) works fine in
 * Expo Go; only Export requires the prebuilt/dev-client app.
 *
 * This file exists so that IF the community moves to a maintained fork (a
 * couple exist under different npm scopes -- see README) or a first-party
 * replacement ships, only this one file needs to change: everything else
 * in `src/export/` calls the small `runFfmpeg()`/`isFfmpegAvailable()`
 * surface below, not the underlying package directly.
 *
 * WHY WE CHECK THE RUNTIME *BEFORE* REQUIRING THE PACKAGE: simply wrapping
 * `require("ffmpeg-kit-react-native")` in a try/catch is not enough. That
 * package constructs a `NativeEventEmitter` as a top-level side effect of
 * being required, and inside Expo Go (where the native module isn't
 * linked) that constructor's internal `invariant()` check throws in a way
 * that can escape a plain try/catch around the require call (it surfaces
 * as an uncaught red-screen error instead). So instead of requiring the
 * module and hoping the throw is catchable, we ask Expo directly whether
 * we're running inside the Expo Go client (via `expo-constants`) and, if
 * so, never call `require()` on the native package at all.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";

export interface FfmpegResult {
  success: boolean;
  returnCode: number | null;
  logs: string;
}

/**
 * True when running inside the Expo Go app (App Store / Play Store client),
 * where no custom native modules -- including `ffmpeg-kit-react-native`
 * -- are linked. False inside a dev-client or standalone/prebuilt build,
 * where native modules work normally.
 */
function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

let cachedModule: typeof import("ffmpeg-kit-react-native") | null | undefined;

function loadModule(): typeof import("ffmpeg-kit-react-native") | null {
  if (cachedModule !== undefined) return cachedModule;

  // Never even attempt the require() inside Expo Go -- see the note above.
  if (isRunningInExpoGo()) {
    cachedModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("ffmpeg-kit-react-native");
  } catch {
    cachedModule = null;
  }
  return cachedModule ?? null;
}

export function isFfmpegAvailable(): boolean {
  return loadModule() !== null;
}

/** Runs a raw ffmpeg command string (space-separated args, same as CLI ffmpeg). */
export async function runFfmpeg(command: string): Promise<FfmpegResult> {
  const mod = loadModule();
  if (!mod) {
    throw new Error(
      "ffmpeg-kit-react-native is not available in this runtime. Export requires a " +
        "prebuilt/dev-client build (`npx expo prebuild`) -- it cannot run inside Expo Go. " +
        "See the README's 'Export & FFmpeg' section."
    );
  }
  const { FFmpegKit, ReturnCode } = mod;
  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();
  const logs = await session.getAllLogsAsString();
  return {
    success: ReturnCode.isSuccess(returnCode),
    returnCode: returnCode?.getValue?.() ?? null,
    logs,
  };
}

export async function runFfprobe(command: string): Promise<string> {
  const mod = loadModule();
  if (!mod) {
    throw new Error("ffmpeg-kit-react-native is not available in this runtime.");
  }
  const { FFprobeKit } = mod;
  const session = await FFprobeKit.execute(command);
  return session.getOutput();
}
