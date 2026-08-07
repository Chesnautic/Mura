import { Skia, type SkPath } from "@shopify/react-native-skia";
import type { MuraPalette, RGB } from "../theme/palettes";
import { rgbToRgba, mixRgb } from "../theme/palettes";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cycles smoothly through a palette's color list. `t` can be any real
 * number (wraps); fractional values blend between neighboring swatches. */
export function colorAt(palette: MuraPalette, t: number, alpha = 1): string {
  const colors = palette.colors.length > 0 ? palette.colors : [palette.accent];
  const n = colors.length;
  const wrapped = ((t % n) + n) % n;
  const i0 = Math.floor(wrapped);
  const i1 = (i0 + 1) % n;
  const frac = wrapped - i0;
  const mixed = mixRgb(colors[i0], colors[i1], frac);
  return rgbToRgba(mixed, alpha);
}

export function rgb(c: RGB, alpha = 1): string {
  return rgbToRgba(c, alpha);
}

/** Builds a smooth path through points using quadratic midpoint smoothing
 * -- a cheap, dependency-free way to avoid jagged polylines for waveform
 * shapes without needing full Catmull-Rom math. */
export function smoothPathThrough(points: { x: number; y: number }[], close = false): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    path.quadTo(cur.x, cur.y, midX, midY);
  }
  if (points.length > 1) {
    const last = points[points.length - 1];
    path.lineTo(last.x, last.y);
  }
  if (close) path.close();
  return path;
}

export function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** Deterministic seeded RNG factory -- same algorithm used by the palette
 * randomizer, re-exported here so engines don't need a second dependency. */
export { mulberry32 } from "../theme/palettes";

/** Resamples an arbitrary-length array to exactly `n` points via linear
 * interpolation -- used so a preset's "segment count" can differ from the
 * feature vector's native waveform/spectrum length. */
export function resample(values: number[], n: number): number[] {
  if (values.length === 0) return new Array(n).fill(0);
  if (values.length === n) return values.slice();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const pos = (i / Math.max(1, n - 1)) * (values.length - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(values.length - 1, i0 + 1);
    const frac = pos - i0;
    out.push(lerp(values[i0], values[i1], frac));
  }
  return out;
}

export function meanAbs(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += Math.abs(v);
  return sum / values.length;
}
