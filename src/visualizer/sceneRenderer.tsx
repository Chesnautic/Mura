import React from "react";
import {
  Circle,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  BlurMask,
  Skia,
  PaintStyle,
  BlurStyle,
  type SkCanvas,
} from "@shopify/react-native-skia";
import type { DrawCmd } from "./engineTypes";

/**
 * Declarative consumer of a scene's DrawCmd[] -- used inside the live
 * in-app <Canvas>. Kept deliberately dumb: it doesn't know anything about
 * waveforms or audio, only how to turn one DrawCmd into one Skia element.
 */
export function SceneLayer({ commands }: { commands: DrawCmd[] }) {
  return (
    <Group>
      {commands.map((cmd, i) => {
        switch (cmd.kind) {
          case "clear":
            return (
              <Rect key={i} x={-2} y={-2} width={1e6} height={1e6} color={cmd.color} />
            );
          case "path":
            return (
              <Path
                key={i}
                path={cmd.path}
                color={cmd.color}
                style={cmd.style ?? "fill"}
                strokeWidth={cmd.strokeWidth ?? 2}
                opacity={cmd.opacity ?? 1}
              >
                {cmd.blurSigma ? <BlurMask blur={cmd.blurSigma} style="normal" /> : null}
              </Path>
            );
          case "circle":
            return (
              <Circle
                key={i}
                cx={cmd.cx}
                cy={cmd.cy}
                r={cmd.r}
                color={cmd.color}
                style={cmd.style ?? "fill"}
                strokeWidth={cmd.strokeWidth ?? 2}
                opacity={cmd.opacity ?? 1}
              >
                {cmd.blurSigma ? <BlurMask blur={cmd.blurSigma} style="normal" /> : null}
              </Circle>
            );
          case "rect":
            return cmd.rx ? (
              <RoundedRect
                key={i}
                x={cmd.x}
                y={cmd.y}
                width={cmd.w}
                height={cmd.h}
                r={cmd.rx}
                color={cmd.color}
                style={cmd.style ?? "fill"}
                strokeWidth={cmd.strokeWidth ?? 2}
                opacity={cmd.opacity ?? 1}
              >
                {cmd.blurSigma ? <BlurMask blur={cmd.blurSigma} style="normal" /> : null}
              </RoundedRect>
            ) : (
              <Rect
                key={i}
                x={cmd.x}
                y={cmd.y}
                width={cmd.w}
                height={cmd.h}
                color={cmd.color}
                style={cmd.style ?? "fill"}
                strokeWidth={cmd.strokeWidth ?? 2}
                opacity={cmd.opacity ?? 1}
              >
                {cmd.blurSigma ? <BlurMask blur={cmd.blurSigma} style="normal" /> : null}
              </Rect>
            );
          case "line":
            return (
              <Line
                key={i}
                p1={{ x: cmd.x1, y: cmd.y1 }}
                p2={{ x: cmd.x2, y: cmd.y2 }}
                color={cmd.color}
                strokeWidth={cmd.strokeWidth ?? 2}
                opacity={cmd.opacity ?? 1}
              >
                {cmd.blurSigma ? <BlurMask blur={cmd.blurSigma} style="normal" /> : null}
              </Line>
            );
          default:
            return null;
        }
      })}
    </Group>
  );
}

/**
 * Imperative consumer of the exact same DrawCmd[] -- used when rendering
 * an offscreen frame during export (see export/frameCapture.ts). Produces
 * pixel-identical output to <SceneLayer> for the same commands, since both
 * ultimately go through the same Skia paint/path primitives.
 */
export function drawSceneImperative(canvas: SkCanvas, commands: DrawCmd[]): void {
  for (const cmd of commands) {
    if (cmd.kind === "clear") {
      canvas.drawColor(Skia.Color(cmd.color));
      continue;
    }

    // Every Skia JSI object (Paint included) is backed by a real allocation
    // that JS garbage collection doesn't know about -- on web specifically
    // it's WASM heap memory, freed only by calling .dispose() explicitly.
    // This function runs once per DrawCmd per exported video frame (so
    // thousands of times per export); without the dispose() below, each one
    // leaked a Paint for the lifetime of the whole export, which is exactly
    // the kind of leak that made long exports progressively slower, then
    // visually corrupt, then crash to a blank white renderer once available
    // GPU/WASM memory ran out. (Paths are NOT disposed here the same way --
    // tried it, and disposing one SkPath mid-loop corrupts CanvasKit-wasm's
    // internal state badly enough that the *next* drawPath call hangs
    // forever. Paths are much smaller allocations than the Surface/Image
    // leak this was really about, so leaving them undisposed is the safe
    // tradeoff.)
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(cmd.color));
    if ("opacity" in cmd && cmd.opacity !== undefined) paint.setAlphaf(cmd.opacity);
    if ("style" in cmd) {
      paint.setStyle(cmd.style === "stroke" ? PaintStyle.Stroke : PaintStyle.Fill);
    }
    if ("strokeWidth" in cmd && cmd.strokeWidth !== undefined) {
      paint.setStrokeWidth(cmd.strokeWidth);
    }
    if ("blurSigma" in cmd && cmd.blurSigma) {
      paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, cmd.blurSigma, true));
    }

    switch (cmd.kind) {
      case "path":
        canvas.drawPath(cmd.path, paint);
        break;
      case "circle":
        canvas.drawCircle(cmd.cx, cmd.cy, cmd.r, paint);
        break;
      case "rect":
        if (cmd.rx) {
          const rrect = Skia.RRectXY(Skia.XYWHRect(cmd.x, cmd.y, cmd.w, cmd.h), cmd.rx, cmd.rx);
          canvas.drawRRect(rrect, paint);
        } else {
          canvas.drawRect(Skia.XYWHRect(cmd.x, cmd.y, cmd.w, cmd.h), paint);
        }
        break;
      case "line":
        canvas.drawLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2, paint);
        break;
    }

    paint.dispose();
  }
}
