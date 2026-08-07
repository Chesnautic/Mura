import type { SkPath } from "@shopify/react-native-skia";
import type { AudioFeatures, ReactivityControls } from "../audio/types";
import type { MuraPalette } from "../theme/palettes";

/**
 * A tiny, renderer-agnostic drawing command. Every waveform engine's
 * `buildScene()` returns an array of these instead of touching a canvas
 * directly -- the SAME array is then either (a) walked by
 * `sceneRenderer.tsx`'s declarative `<SceneLayer>` for the live in-app
 * preview, or (b) walked by `sceneRenderer.tsx`'s imperative
 * `drawSceneImperative()` against an offscreen Skia surface during MP4
 * export. That guarantee -- one scene description, two consumers -- is
 * what makes "what you previewed is what gets exported" actually true
 * rather than just a hope.
 */
export type DrawCmd =
  | { kind: "clear"; color: string }
  | {
      kind: "path";
      path: SkPath;
      color: string;
      style?: "fill" | "stroke";
      strokeWidth?: number;
      opacity?: number;
      blurSigma?: number;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      color: string;
      style?: "fill" | "stroke";
      strokeWidth?: number;
      opacity?: number;
      blurSigma?: number;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      rx?: number;
      color: string;
      style?: "fill" | "stroke";
      strokeWidth?: number;
      opacity?: number;
      blurSigma?: number;
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      strokeWidth?: number;
      opacity?: number;
      blurSigma?: number;
    };

export interface SceneContext {
  width: number;
  height: number;
  /** Already has ReactivityControls gains applied (see applyReactivity). */
  features: AudioFeatures;
  reactivity: ReactivityControls;
  palette: MuraPalette;
  /** Seconds elapsed -- same clock as features.t. */
  t: number;
  /** Seconds since the previous frame -- for stateful engines (particles). */
  dt: number;
  /** Seeded RNG (0..1), stable across a single export run. */
  rng: () => number;
}

/** Opaque, per-preset mutable state (particle positions, trail history,
 * rotation accumulators, ...). Created once when a preset becomes active,
 * mutated in place every frame, discarded when the preset changes.
 * Mirrors Kami's own `state` dict threaded through its render_* functions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EngineState = Record<string, any>;

export interface WaveformPreset {
  id: string;
  name: string;
  /** Which of the 10 rendering engines this preset belongs to. */
  family: string;
  familyLabel: string;
  description: string;
  createState: () => EngineState;
  buildScene: (ctx: SceneContext, state: EngineState) => DrawCmd[];
}
