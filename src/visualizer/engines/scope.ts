import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, resample } from "../drawUtils";

const FAMILY = "scope";
const FAMILY_LABEL = "Scopes & Meters";

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

function grid(ctx: SceneContext): DrawCmd[] {
  const cmds: DrawCmd[] = [];
  const step = 40;
  for (let x = 0; x < ctx.width; x += step) {
    cmds.push({ kind: "line", x1: x, y1: 0, x2: x, y2: ctx.height, color: rgb(ctx.palette.glow, 0.08), strokeWidth: 1 });
  }
  for (let y = 0; y < ctx.height; y += step) {
    cmds.push({ kind: "line", x1: 0, y1: y, x2: ctx.width, y2: y, color: rgb(ctx.palette.glow, 0.08), strokeWidth: 1 });
  }
  return cmds;
}

export function createScopePresets(): WaveformPreset[] {
  return [
    preset(
      "scope-classic",
      "Classic Oscilloscope",
      "A scrolling neon trace over a glowing grid, just like a lab scope.",
      () => ({}),
      (ctx) => {
        const n = 100;
        const samples = resample(ctx.features.waveform, n);
        const midY = ctx.height * 0.5;
        const path = Skia.Path.Make();
        samples.forEach((v, i) => {
          const x = (i / (n - 1)) * ctx.width;
          const y = midY + v * ctx.height * 0.35;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        return [
          bg(ctx),
          ...grid(ctx),
          { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.3), style: "stroke", strokeWidth: 3, blurSigma: 10 * ctx.reactivity.glowStrength },
        ];
      }
    ),

    preset(
      "scope-lissajous",
      "Lissajous Scope",
      "A classic X/Y phase figure drawn from the waveform against a phase-shifted copy.",
      () => ({}),
      (ctx) => {
        const n = 200;
        const samples = resample(ctx.features.waveform, n);
        const shift = Math.floor(n * 0.25);
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const scale = Math.min(ctx.width, ctx.height) * 0.4;
        const path = Skia.Path.Make();
        for (let i = 0; i < n; i++) {
          const x = samples[i] * scale;
          const y = samples[(i + shift) % n] * scale;
          const px = cx + x;
          const py = cy + y;
          if (i === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
        return [
          bg(ctx),
          { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.5), style: "stroke", strokeWidth: 2.5, opacity: 0.9, blurSigma: 8 * ctx.reactivity.glowStrength },
        ];
      }
    ),

    preset(
      "scope-vu-meters",
      "VU Meters",
      "A pair of analog-style VU meter bars with peak-hold markers.",
      () => ({ peakBass: 0, peakTreble: 0 }),
      (ctx, state) => {
        state.peakBass = Math.max(ctx.features.bass, state.peakBass - ctx.dt * 0.6);
        state.peakTreble = Math.max(ctx.features.treble, state.peakTreble - ctx.dt * 0.6);
        const cmds: DrawCmd[] = [bg(ctx)];
        const meters = [
          { label: "bass", value: ctx.features.bass, peak: state.peakBass, x: ctx.width * 0.28 },
          { label: "treble", value: ctx.features.treble, peak: state.peakTreble, x: ctx.width * 0.72 },
        ];
        const meterW = ctx.width * 0.28;
        const meterH = ctx.height * 0.6;
        const top = ctx.height * 0.2;
        meters.forEach((m, mi) => {
          const x = m.x - meterW / 2;
          cmds.push({ kind: "rect", x, y: top, w: meterW, h: meterH, rx: 8, color: rgb(ctx.palette.glow, 0.12), style: "stroke", strokeWidth: 2 });
          const fillH = Math.min(1, m.value) * meterH;
          cmds.push({
            kind: "rect",
            x,
            y: top + meterH - fillH,
            w: meterW,
            h: fillH,
            rx: 6,
            color: colorAt(ctx.palette, mi * 2.5),
            opacity: 0.9,
          });
          const peakY = top + meterH - Math.min(1, m.peak) * meterH;
          cmds.push({ kind: "line", x1: x, y1: peakY, x2: x + meterW, y2: peakY, color: "#ffffff", strokeWidth: 3 });
        });
        return cmds;
      }
    ),

    preset(
      "scope-sonar",
      "Sonar Ping",
      "A rotating sweep line with pings that ripple out on each onset.",
      () => ({ sweep: 0, pings: [] as { r: number; a: number }[] }),
      (ctx, state) => {
        state.sweep += ctx.dt * 1.4;
        const pings: { r: number; a: number }[] = state.pings;
        if (ctx.features.onset > 0.4) pings.push({ r: 10, a: 1 });
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.min(ctx.width, ctx.height) * 0.45;
        for (const p of pings) {
          p.r += ctx.dt * maxR * 0.7;
          p.a -= ctx.dt * 0.7;
        }
        while (pings.length && pings[0].a <= 0) pings.shift();
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let ring = 1; ring <= 3; ring++) {
          cmds.push({ kind: "circle", cx, cy, r: (maxR / 3) * ring, color: rgb(ctx.palette.glow, 0.2), style: "stroke", strokeWidth: 1.5 });
        }
        for (const p of pings) {
          cmds.push({ kind: "circle", cx, cy, r: p.r, color: colorAt(ctx.palette, ctx.t * 0.3), style: "stroke", strokeWidth: 3, opacity: Math.max(0, p.a) });
        }
        const sweepX = cx + Math.cos(state.sweep) * maxR;
        const sweepY = cy + Math.sin(state.sweep) * maxR;
        cmds.push({ kind: "line", x1: cx, y1: cy, x2: sweepX, y2: sweepY, color: colorAt(ctx.palette, 1), strokeWidth: 3, blurSigma: 6 });
        return cmds;
      }
    ),

    preset(
      "scope-cymatics",
      "Cymatics Ripple",
      "Concentric ripples distorted into a standing-wave field by the mids/treble.",
      () => ({}),
      (ctx) => {
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const cmds: DrawCmd[] = [bg(ctx)];
        const rings = 10;
        const freq = 6 + ctx.features.treble * 10;
        for (let i = 1; i <= rings; i++) {
          const baseR = (i / rings) * Math.min(ctx.width, ctx.height) * 0.48;
          const path = Skia.Path.Make();
          const steps = 80;
          for (let s = 0; s <= steps; s++) {
            const angle = (s / steps) * Math.PI * 2;
            const wobble = Math.sin(angle * freq + ctx.t * 3) * (6 + ctx.features.mid * 20);
            const r = baseR + wobble;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (s === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          path.close();
          cmds.push({ kind: "path", path, color: colorAt(ctx.palette, i * 0.4), style: "stroke", strokeWidth: 2, opacity: 0.7 });
        }
        return cmds;
      }
    ),
  ];
}
