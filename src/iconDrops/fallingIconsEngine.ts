import { Skia } from "@shopify/react-native-skia";
import type { SceneContext, DrawCmd, EngineState } from "../visualizer/engineTypes";
import { colorAt, clamp } from "../visualizer/drawUtils";
import { SHAPE_BUILDERS, type IconShapeId } from "./shapes";

export interface FallingIconsConfig {
  activeShapeIds: IconShapeId[];
  /** 0..2ish, scales spawn rate alongside the global particleDensity control. */
  density: number;
  /** Pixels/sec^2 downward acceleration. */
  gravity: number;
  /** Horizontal sway amplitude in px/sec. */
  sway: number;
  /** Base fall speed in px/sec at spawn. */
  baseSpeed: number;
  /** Icon size range in px (diameter of the 100x100 normalized box). */
  minSize: number;
  maxSize: number;
  /** Caps total on-screen icons for perf sanity. */
  maxOnScreen: number;
}

export const DEFAULT_FALLING_ICONS_CONFIG: FallingIconsConfig = {
  activeShapeIds: ["flower"],
  density: 1,
  gravity: 55,
  sway: 40,
  baseSpeed: 70,
  minSize: 28,
  maxSize: 64,
  maxOnScreen: 70,
};

interface FallingInstance {
  shapeId: IconShapeId;
  x: number;
  y: number;
  vy: number;
  swayPhase: number;
  swaySpeed: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  colorT: number;
  opacity: number;
}

export function createFallingIconsState(): EngineState {
  return { instances: [] as FallingInstance[], spawnAcc: 0 };
}

function iconMatrix(x: number, y: number, scale: number, rotation: number) {
  const s = scale / 100; // shapes are authored in a 100x100 box
  const cosT = Math.cos(rotation);
  const sinT = Math.sin(rotation);
  const a = s * cosT;
  const b = -s * sinT;
  const c = s * sinT;
  const d = s * cosT;
  const m2 = x - 50 * a - 50 * b;
  const m5 = y - 50 * c - 50 * d;
  return Skia.Matrix([a, b, m2, c, d, m5, 0, 0, 1]);
}

export function buildFallingIconsScene(
  ctx: SceneContext,
  state: EngineState,
  config: FallingIconsConfig
): DrawCmd[] {
  const instances: FallingInstance[] = state.instances;
  const dt = clamp(ctx.dt, 0, 0.1);

  if (config.activeShapeIds.length > 0) {
    const spawnRate = 1.4 * config.density * ctx.reactivity.particleDensity;
    const beatBoost = ctx.features.onset > 0.5 || ctx.features.isDrop ? 6 : 0;
    state.spawnAcc = (state.spawnAcc ?? 0) + dt * spawnRate + (beatBoost ? beatBoost * dt * 10 : 0);
    while (state.spawnAcc >= 1 && instances.length < config.maxOnScreen) {
      state.spawnAcc -= 1;
      const shapeId = config.activeShapeIds[Math.floor(ctx.rng() * config.activeShapeIds.length)];
      instances.push({
        shapeId,
        x: ctx.rng() * ctx.width,
        y: -60,
        vy: config.baseSpeed * (0.7 + ctx.rng() * 0.6),
        swayPhase: ctx.rng() * Math.PI * 2,
        swaySpeed: 0.6 + ctx.rng() * 1.2,
        rotation: ctx.rng() * Math.PI * 2,
        rotationSpeed: (ctx.rng() - 0.5) * 2.2,
        size: config.minSize + ctx.rng() * (config.maxSize - config.minSize),
        colorT: ctx.rng() * ctx.palette.colors.length,
        opacity: 0.75 + ctx.rng() * 0.25,
      });
    }
  }

  const cmds: DrawCmd[] = [];
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    inst.vy += config.gravity * dt;
    inst.y += inst.vy * dt;
    inst.swayPhase += inst.swaySpeed * dt;
    inst.x += Math.sin(inst.swayPhase) * config.sway * dt;
    inst.rotation += inst.rotationSpeed * dt;

    if (inst.y - inst.size > ctx.height + 40) {
      instances.splice(i, 1);
      continue;
    }

    const basePath = SHAPE_BUILDERS[inst.shapeId]();
    const matrix = iconMatrix(inst.x, inst.y, inst.size, inst.rotation);
    basePath.transform(matrix);

    cmds.push({
      kind: "path",
      path: basePath,
      color: colorAt(ctx.palette, inst.colorT),
      opacity: inst.opacity,
      blurSigma: 1.5,
    });
  }

  return cmds;
}
