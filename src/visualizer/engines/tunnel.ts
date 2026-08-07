import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, polarPoint } from "../drawUtils";

const FAMILY = "tunnel";
const FAMILY_LABEL = "Tunnels";

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

export function createTunnelPresets(): WaveformPreset[] {
  return [
    preset(
      "tunnel-chrome",
      "Chrome Tunnel",
      "Concentric rings rushing toward the viewer, pulsing with bass.",
      () => ({ z: 0 }),
      (ctx, state) => {
        state.z = (state.z + ctx.dt * (0.6 + ctx.features.bass * 1.2)) % 1;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.hypot(cx, cy);
        const cmds: DrawCmd[] = [bg(ctx)];
        const rings = 10;
        for (let i = 0; i < rings; i++) {
          const t = ((i / rings + state.z) % 1);
          const r = t * maxR;
          cmds.push({
            kind: "circle",
            cx,
            cy,
            r,
            color: colorAt(ctx.palette, i * 0.6 + ctx.t * 0.2),
            style: "stroke",
            strokeWidth: 3 + (1 - t) * 10,
            opacity: 0.15 + t * 0.7,
            blurSigma: 4 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),

    preset(
      "tunnel-checker",
      "Checker Warp",
      "Rotating alternating ring segments in a radial checkerboard.",
      () => ({ rot: 0 }),
      (ctx, state) => {
        state.rot += ctx.dt * (0.4 + ctx.features.mid * 1.5);
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.hypot(cx, cy);
        const cmds: DrawCmd[] = [bg(ctx)];
        const rings = 6;
        const segs = 16;
        for (let ring = 0; ring < rings; ring++) {
          const rInner = (ring / rings) * maxR;
          const rOuter = ((ring + 1) / rings) * maxR;
          for (let s = 0; s < segs; s++) {
            if ((s + ring) % 2 === 0) continue;
            const a0 = (s / segs) * Math.PI * 2 + state.rot * (ring % 2 === 0 ? 1 : -1);
            const a1 = ((s + 1) / segs) * Math.PI * 2 + state.rot * (ring % 2 === 0 ? 1 : -1);
            const path = Skia.Path.Make();
            const p0 = polarPoint(cx, cy, rInner, a0);
            const p1 = polarPoint(cx, cy, rOuter, a0);
            const p2 = polarPoint(cx, cy, rOuter, a1);
            const p3 = polarPoint(cx, cy, rInner, a1);
            path.moveTo(p0.x, p0.y);
            path.lineTo(p1.x, p1.y);
            path.lineTo(p2.x, p2.y);
            path.lineTo(p3.x, p3.y);
            path.close();
            cmds.push({ kind: "path", path, color: colorAt(ctx.palette, ring * 0.7 + s * 0.05), opacity: 0.75 });
          }
        }
        return cmds;
      }
    ),

    preset(
      "tunnel-polygon",
      "Polygon Tunnel",
      "Rotating N-gon rings whose side count shifts with the mids.",
      () => ({ z: 0 }),
      (ctx, state) => {
        state.z = (state.z + ctx.dt * (0.5 + ctx.features.bass)) % 1;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.hypot(cx, cy);
        const sides = 3 + Math.floor(ctx.features.mid * 6);
        const cmds: DrawCmd[] = [bg(ctx)];
        const layers = 8;
        for (let i = 0; i < layers; i++) {
          const t = (i / layers + state.z) % 1;
          const r = t * maxR;
          const rot = ctx.t * 0.3 * (i % 2 === 0 ? 1 : -1);
          const path = Skia.Path.Make();
          for (let s = 0; s <= sides; s++) {
            const angle = (s / sides) * Math.PI * 2 + rot;
            const p = polarPoint(cx, cy, r, angle);
            if (s === 0) path.moveTo(p.x, p.y);
            else path.lineTo(p.x, p.y);
          }
          cmds.push({
            kind: "path",
            path,
            color: colorAt(ctx.palette, i * 0.5),
            style: "stroke",
            strokeWidth: 3 + (1 - t) * 8,
            opacity: 0.2 + t * 0.7,
            blurSigma: 3 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),

    preset(
      "tunnel-vortex",
      "Vortex Spiral",
      "Spiral arms rushing inward, twisting with the treble.",
      () => ({ z: 0 }),
      (ctx, state) => {
        state.z = (state.z + ctx.dt * (0.5 + ctx.features.level)) % 1;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.hypot(cx, cy);
        const arms = 5;
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let arm = 0; arm < arms; arm++) {
          const path = Skia.Path.Make();
          let started = false;
          const steps = 40;
          for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const r = t * maxR;
            const angle = t * Math.PI * 4 + (arm / arms) * Math.PI * 2 + state.z * Math.PI * 2 + ctx.features.treble * 2;
            const p = polarPoint(cx, cy, r, angle);
            if (!started) {
              path.moveTo(p.x, p.y);
              started = true;
            } else path.lineTo(p.x, p.y);
          }
          cmds.push({
            kind: "path",
            path,
            color: colorAt(ctx.palette, arm * 0.9),
            style: "stroke",
            strokeWidth: 5,
            opacity: 0.8,
            blurSigma: 6 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),

    preset(
      "tunnel-portal",
      "Portal Pulse",
      "A single ring scales hard on every onset, leaving layered afterimages.",
      () => ({ pulses: [] as { r: number; a: number }[] }),
      (ctx, state) => {
        const pulses: { r: number; a: number }[] = state.pulses;
        if (ctx.features.onset > 0.45) pulses.push({ r: 20, a: 1 });
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const maxR = Math.hypot(cx, cy);
        for (const p of pulses) {
          p.r += ctx.dt * maxR * 0.9;
          p.a -= ctx.dt * 0.8;
        }
        while (pulses.length && pulses[0].a <= 0) pulses.shift();
        const cmds: DrawCmd[] = [bg(ctx)];
        cmds.push({ kind: "circle", cx, cy, r: 40 + ctx.features.level * 30, color: colorAt(ctx.palette, ctx.t * 0.5), blurSigma: 20 });
        for (const p of pulses) {
          cmds.push({
            kind: "circle",
            cx,
            cy,
            r: p.r,
            color: colorAt(ctx.palette, p.r * 0.01),
            style: "stroke",
            strokeWidth: 4,
            opacity: Math.max(0, p.a),
            blurSigma: 6 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),
  ];
}
