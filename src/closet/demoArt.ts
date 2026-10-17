import { makeCanvas } from "../pixel/raster";
import { DEMO_SPECS, type DemoSpec, type Fill, type Shape } from "./demo";
import type { Garment } from "./types";

// Outlines on a 100x100 grid. Tops hang from the shoulders, bottoms from the waist.
const SHAPES: Record<Shape, [number, number][]> = {
  vest: [[28, 4], [42, 4], [50, 34], [58, 4], [72, 4], [74, 18], [84, 30], [84, 96], [16, 96], [16, 30], [26, 18]],
  blazer: [[32, 4], [44, 4], [50, 40], [56, 4], [68, 4], [90, 12], [98, 84], [86, 87], [80, 42], [80, 97], [20, 97], [20, 42], [14, 87], [2, 84], [10, 12]],
  cropJacket: [[34, 4], [66, 4], [90, 12], [98, 92], [86, 95], [78, 44], [78, 72], [22, 72], [22, 44], [14, 95], [2, 92], [10, 12]],
  tee: [[36, 4], [44, 9], [56, 9], [64, 4], [90, 18], [82, 36], [72, 31], [72, 96], [28, 96], [28, 31], [18, 36], [10, 18]],
  mini: [[18, 6], [82, 6], [90, 92], [10, 92]],
  aline: [[28, 6], [72, 6], [98, 92], [2, 92]],
  pants: [[24, 2], [76, 2], [82, 98], [56, 98], [50, 34], [44, 98], [18, 98]],
};

const SIZE = 160;

function paint(ctx: CanvasRenderingContext2D, fill: Fill, x0: number, w: number) {
  if (fill.kind === "solid") {
    ctx.fillStyle = fill.base;
    ctx.fillRect(x0, 0, w, SIZE);
  } else if (fill.kind === "plaid") {
    ctx.fillStyle = fill.base;
    ctx.fillRect(x0, 0, w, SIZE);
    fill.lines.forEach((color, k) => {
      ctx.fillStyle = color;
      const off = k * Math.floor(fill.step / 2);
      for (let p = off; p < SIZE; p += fill.step) {
        ctx.fillRect(x0, p, w, k === 0 ? 2 : 1);
        ctx.fillRect(Math.max(x0, p), 0, k === 0 ? 2 : 1, SIZE);
      }
    });
  } else {
    paint(ctx, fill.left, x0, w / 2);
    paint(ctx, fill.right, x0 + w / 2, w / 2);
  }
}

export function drawDemo(spec: DemoSpec): string {
  const canvas = makeCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d")!;
  const pts = SHAPES[spec.shape].map(([x, y]) => [(x / 100) * SIZE, (y / 100) * SIZE] as const);
  const outline = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.save();
  outline();
  ctx.clip();
  paint(ctx, spec.fill, 0, SIZE);
  if (spec.band) {
    ctx.fillStyle = spec.band;
    ctx.fillRect(0, SIZE * 0.82, SIZE, SIZE * 0.18);
  }
  // soft shading for a bit of depth
  const shade = ctx.createLinearGradient(0, 0, SIZE, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.25)");
  shade.addColorStop(0.5, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.restore();
  outline();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(10,8,20,0.8)";
  ctx.stroke();
  return canvas.toDataURL();
}

let cache: Garment[] | null = null;

export function demoCloset(): Garment[] {
  cache ??= DEMO_SPECS.map((spec) => {
    const { shape, fill, band, ...garment } = spec;
    return { ...garment, image: drawDemo(spec) };
  });
  return cache;
}
