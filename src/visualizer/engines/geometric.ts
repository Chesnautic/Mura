import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, resample, polarPoint } from "../drawUtils";

const FAMILY = "geometric";
const FAMILY_LABEL = "Geometric";

function bg(ctx: SceneContext): DrawCmd {
  return { kind: "clear", color: rgb(ctx.palette.background) };
}

function preset(
  id: string,
  name: string,
  description: string,
  createState: () => EngineState,
  build: (ctx: SceneContext, state: EngineState) => DrawCmd[]
): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState, buildScene: build };
}

function polygonPath(cx: number, cy: number, r: number, sides: number, rot: number) {
  const path = Skia.Path.Make();
  for (let i = 0; i <= sides; i++) {
    const angle = rot + (i / sides) * Math.PI * 2;
    const p = polarPoint(cx, cy, r, angle);
    if (i === 0) path.moveTo(p.x, p.y);
    else path.lineTo(p.x, p.y);
  }
  path.close();
  return path;
}

export function createGeometricPresets(): WaveformPreset[] {
  return [
    preset(
      "geo-bouncing-polygon",
      "Bouncing Polygon",
      "A single rotating polygon whose side count and size react to the music.",
      () => ({ rot: 0 }),
      (ctx, state) => {
        state.rot += ctx.dt * (0.5 + ctx.features.mid);
        const sides = 3 + Math.floor(ctx.features.treble * 5);
        const r = Math.min(ctx.width, ctx.height) * (0.14 + ctx.features.level * 0.16);
        const path = polygonPath(ctx.width / 2, ctx.height / 2, r, Math.max(3, sides), state.rot);
        return [
          bg(ctx),
          { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.4), style: "stroke", strokeWidth: 6, blurSigma: 10 * ctx.reactivity.glowStrength },
          { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.4 + 1), opacity: 0.18 },
        ];
      }
    ),

    preset(
      "geo-chrome-grid",
      "Chrome Cubes Grid",
      "A grid of squares whose size and glow map to spectrum bins.",
      () => ({}),
      (ctx) => {
        const cols = 12;
        const rows = 8;
        const spectrum = resample(ctx.features.spectrum, cols * rows);
        const cellW = ctx.width / cols;
        const cellH = ctx.height / rows;
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const v = spectrum[y * cols + x];
            const size = Math.min(cellW, cellH) * (0.25 + v * 0.8);
            const cx = x * cellW + cellW / 2;
            const cy = y * cellH + cellH / 2;
            cmds.push({
              kind: "rect",
              x: cx - size / 2,
              y: cy - size / 2,
              w: size,
              h: size,
              rx: size * 0.2,
              color: colorAt(ctx.palette, (x + y) * 0.15),
              opacity: 0.4 + v * 0.6,
            });
          }
        }
        return cmds;
      }
    ),

    preset(
      "geo-orbiting-triangles",
      "Orbiting Triangles",
      "Triangles orbit the center at different radii and speeds.",
      () => ({}),
      (ctx) => {
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const n = 10;
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let i = 0; i < n; i++) {
          const speed = 0.4 + (i % 4) * 0.25;
          const radius = Math.min(ctx.width, ctx.height) * (0.1 + (i / n) * 0.38);
          const angle = ctx.t * speed + (i / n) * Math.PI * 2;
          const p = polarPoint(cx, cy, radius, angle);
          const size = 10 + ctx.features.treble * 30;
          const path = polygonPath(p.x, p.y, size, 3, angle * 2);
          cmds.push({ kind: "path", path, color: colorAt(ctx.palette, i * 0.5), opacity: 0.85, blurSigma: 3 * ctx.reactivity.glowStrength });
        }
        return cmds;
      }
    ),

    preset(
      "geo-diamond-rings",
      "Diamond Pulse Rings",
      "Concentric rotated-square (diamond) rings pulsing outward.",
      () => ({}),
      (ctx) => {
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const cmds: DrawCmd[] = [bg(ctx)];
        const count = 6;
        for (let i = 0; i < count; i++) {
          const t = (i / count + ctx.t * 0.15 * (0.5 + ctx.features.bass)) % 1;
          const r = t * Math.min(ctx.width, ctx.height) * 0.5;
          const path = polygonPath(cx, cy, r, 4, Math.PI / 4);
          cmds.push({
            kind: "path",
            path,
            color: colorAt(ctx.palette, i * 0.7),
            style: "stroke",
            strokeWidth: 3 + (1 - t) * 6,
            opacity: 0.25 + t * 0.6,
            blurSigma: 4 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),

    preset(
      "geo-hex-grid",
      "Hex Grid Pulse",
      "A honeycomb of hexagons, each cell's brightness mapped to a spectrum bin.",
      () => ({}),
      (ctx) => {
        const cellR = Math.min(ctx.width, ctx.height) * 0.055;
        const cols = Math.ceil(ctx.width / (cellR * 1.5)) + 2;
        const rows = Math.ceil(ctx.height / (cellR * Math.sqrt(3))) + 2;
        const spectrum = resample(ctx.features.spectrum, cols);
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * cellR * 1.5;
            const y = row * cellR * Math.sqrt(3) + (col % 2 === 0 ? 0 : (cellR * Math.sqrt(3)) / 2);
            const v = spectrum[col % spectrum.length];
            const path = polygonPath(x, y, cellR * 0.85, 6, Math.PI / 6);
            cmds.push({
              kind: "path",
              path,
              color: colorAt(ctx.palette, col * 0.2 + row * 0.05),
              style: "stroke",
              strokeWidth: 2,
              opacity: 0.25 + v * 0.7,
            });
          }
        }
        return cmds;
      }
    ),
  ];
}
