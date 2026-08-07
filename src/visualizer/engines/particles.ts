import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, clamp } from "../drawUtils";

const FAMILY = "particles";
const FAMILY_LABEL = "Particles";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  colorT: number;
  rot?: number;
  vrot?: number;
}

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

function stepAndDraw(
  ctx: SceneContext,
  particles: Particle[],
  drawOne: (p: Particle) => DrawCmd
): DrawCmd[] {
  const dt = clamp(ctx.dt, 0, 0.1);
  const cmds: DrawCmd[] = [bg(ctx)];
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.rot !== undefined && p.vrot !== undefined) p.rot += p.vrot * dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    cmds.push(drawOne(p));
  }
  return cmds;
}

export function createParticlesPresets(): WaveformPreset[] {
  return [
    preset(
      "particles-beat-sparks",
      "Beat Sparks",
      "Particles burst outward from center on every onset/drop.",
      () => ({ particles: [] as Particle[] }),
      (ctx, state) => {
        const particles: Particle[] = state.particles;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        if (ctx.features.onset > 0.4 || ctx.features.isDrop) {
          const burst = Math.round(8 * ctx.reactivity.particleDensity * (ctx.features.isDrop ? 2.5 : 1));
          for (let i = 0; i < burst; i++) {
            const angle = ctx.rng() * Math.PI * 2;
            const speed = 120 + ctx.rng() * 260;
            particles.push({
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 0.5 + ctx.rng() * 0.5,
              maxLife: 1,
              size: 4 + ctx.rng() * 8,
              colorT: ctx.rng() * 5,
            });
          }
        }
        return stepAndDraw(ctx, particles, (p) => ({
          kind: "circle",
          cx: p.x,
          cy: p.y,
          r: p.size * clamp(p.life / p.maxLife, 0, 1),
          color: colorAt(ctx.palette, p.colorT),
          opacity: clamp(p.life / p.maxLife, 0, 1),
          blurSigma: 6 * ctx.reactivity.glowStrength,
        }));
      }
    ),

    preset(
      "particles-embers",
      "Floating Embers",
      "A steady stream of glowing embers drifting upward.",
      () => ({ particles: [] as Particle[], spawnAcc: 0 }),
      (ctx, state) => {
        const particles: Particle[] = state.particles;
        state.spawnAcc += ctx.dt * (6 + ctx.features.treble * 30) * ctx.reactivity.particleDensity;
        while (state.spawnAcc > 1) {
          state.spawnAcc -= 1;
          particles.push({
            x: ctx.rng() * ctx.width,
            y: ctx.height + 10,
            vx: (ctx.rng() - 0.5) * 30,
            vy: -60 - ctx.rng() * 90,
            life: 2.5 + ctx.rng() * 1.5,
            maxLife: 4,
            size: 2 + ctx.rng() * 5,
            colorT: ctx.rng() * 5,
          });
        }
        return stepAndDraw(ctx, particles, (p) => ({
          kind: "circle",
          cx: p.x,
          cy: p.y,
          r: p.size,
          color: colorAt(ctx.palette, p.colorT),
          opacity: clamp(p.life / p.maxLife, 0, 1) * 0.85,
          blurSigma: 5 * ctx.reactivity.glowStrength,
        }));
      }
    ),

    preset(
      "particles-fireflies",
      "Firefly Swarm",
      "Particles wander gently, glowing brighter with the mids.",
      () => ({
        particles: Array.from({ length: 24 }, () => ({
          x: Math.random() * 400,
          y: Math.random() * 800,
          vx: 0,
          vy: 0,
          life: 999,
          maxLife: 999,
          size: 3 + Math.random() * 4,
          colorT: Math.random() * 5,
          phase: Math.random() * Math.PI * 2,
        })) as (Particle & { phase: number })[],
      }),
      (ctx, state) => {
        const particles = state.particles as (Particle & { phase: number })[];
        const target = Math.round(18 * ctx.reactivity.particleDensity);
        while (particles.length < target) {
          particles.push({
            x: ctx.rng() * ctx.width,
            y: ctx.rng() * ctx.height,
            vx: 0,
            vy: 0,
            life: 999,
            maxLife: 999,
            size: 3 + ctx.rng() * 4,
            colorT: ctx.rng() * 5,
            phase: ctx.rng() * Math.PI * 2,
          });
        }
        while (particles.length > target) particles.pop();

        const cmds: DrawCmd[] = [bg(ctx)];
        for (const p of particles) {
          p.phase += ctx.dt * (0.6 + ctx.features.mid * 1.5);
          p.x += Math.sin(p.phase) * ctx.dt * 26;
          p.y += Math.cos(p.phase * 0.7) * ctx.dt * 22;
          p.x = ((p.x % ctx.width) + ctx.width) % ctx.width;
          p.y = ((p.y % ctx.height) + ctx.height) % ctx.height;
          const glow = 0.4 + ctx.features.mid * 0.8 + Math.sin(p.phase * 2) * 0.15;
          cmds.push({
            kind: "circle",
            cx: p.x,
            cy: p.y,
            r: p.size * (0.8 + ctx.features.mid),
            color: colorAt(ctx.palette, p.colorT),
            opacity: clamp(glow, 0.15, 1),
            blurSigma: 8 * ctx.reactivity.glowStrength,
          });
        }
        return cmds;
      }
    ),

    preset(
      "particles-confetti",
      "Confetti Pop",
      "Rotating confetti rectangles burst out on every drop.",
      () => ({ particles: [] as Particle[] }),
      (ctx, state) => {
        const particles: Particle[] = state.particles;
        if (ctx.features.isDrop) {
          const burst = Math.round(30 * ctx.reactivity.particleDensity);
          for (let i = 0; i < burst; i++) {
            const angle = ctx.rng() * Math.PI * 2;
            const speed = 80 + ctx.rng() * 220;
            particles.push({
              x: ctx.width / 2,
              y: ctx.height * 0.35,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 60,
              life: 1.2 + ctx.rng() * 0.8,
              maxLife: 2,
              size: 6 + ctx.rng() * 8,
              colorT: ctx.rng() * 5,
              rot: ctx.rng() * Math.PI,
              vrot: (ctx.rng() - 0.5) * 6,
            });
          }
        }
        // simple gravity
        for (const p of particles) p.vy += 240 * clamp(ctx.dt, 0, 0.1);
        return stepAndDraw(ctx, particles, (p) => ({
          kind: "rect",
          x: p.x - p.size / 2,
          y: p.y - p.size / 2,
          w: p.size,
          h: p.size * 0.5,
          rx: 1,
          color: colorAt(ctx.palette, p.colorT),
          opacity: clamp(p.life / p.maxLife, 0, 1),
        }));
      }
    ),

    preset(
      "particles-dust-trail",
      "Dust Trail",
      "A single point orbits the center, trailing glowing dust.",
      () => ({ particles: [] as Particle[], angle: 0 }),
      (ctx, state) => {
        const particles: Particle[] = state.particles;
        state.angle += ctx.dt * (0.6 + ctx.features.mid * 2.5);
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const r = Math.min(ctx.width, ctx.height) * (0.22 + ctx.features.bass * 0.14);
        const hx = cx + Math.cos(state.angle) * r;
        const hy = cy + Math.sin(state.angle) * r;
        const spawn = Math.round(3 * ctx.reactivity.particleDensity);
        for (let i = 0; i < spawn; i++) {
          particles.push({
            x: hx,
            y: hy,
            vx: (ctx.rng() - 0.5) * 20,
            vy: (ctx.rng() - 0.5) * 20,
            life: 0.6 + ctx.rng() * 0.4,
            maxLife: 1,
            size: 3 + ctx.rng() * 5,
            colorT: (state.angle / (Math.PI * 2)) * ctx.palette.colors.length,
          });
        }
        const cmds = stepAndDraw(ctx, particles, (p) => ({
          kind: "circle",
          cx: p.x,
          cy: p.y,
          r: p.size,
          color: colorAt(ctx.palette, p.colorT),
          opacity: clamp(p.life / p.maxLife, 0, 1),
          blurSigma: 5,
        }));
        cmds.push({ kind: "circle", cx: hx, cy: hy, r: 10, color: colorAt(ctx.palette, ctx.t * 0.5), blurSigma: 12 });
        return cmds;
      }
    ),
  ];
}
