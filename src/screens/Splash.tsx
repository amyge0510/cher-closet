import { useEffect, useRef, useState } from "react";
import { hexToRgb } from "../pixel/raster";
import { C } from "../stage/palette";
import { STAGE_H, STAGE_W } from "../stage/layout";

// The opening screen: a lattice of identical wire hangers that all swing
// 30 degrees left-to-right over two seconds, then the screen fades out.
const RES = 2; // stage pixels per canvas pixel
const W = STAGE_W / RES;
const H = STAGE_H / RES;
const SWING_MS = 2000;
const FADE_MS = 450;
const SWING_DEG = 30;
const BASE_TILT = 5;
const COL = 89; // lattice spacing, canvas pixels; odd rows shift by half
const ROW = 29;

function hanger(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  // hook: a "?" curl, tip on the left, then a stem down to the neck at (0, 0)
  ctx.arc(1, -15, 5, Math.PI * 1.0, Math.PI * 2.45);
  ctx.lineTo(0, -6);
  ctx.lineTo(0, 0);
  ctx.stroke();
  // shoulders and bottom bar, as their own closed shape
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-34, 20);
  ctx.quadraticCurveTo(-36, 22, -33, 22);
  ctx.lineTo(33, 22);
  ctx.quadraticCurveTo(36, 22, 34, 20);
  ctx.closePath();
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, angleDeg: number) {
  ctx.fillStyle = C.splashBg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let r = -1; r * ROW < H + ROW; r++) {
    const off = r % 2 ? COL / 2 : 0;
    for (let c = -1; c * COL < W + COL; c++) {
      ctx.save();
      ctx.translate(c * COL + off + 30, r * ROW + 20);
      ctx.rotate(((BASE_TILT + angleDeg) * Math.PI) / 180);
      hanger(ctx);
      ctx.restore();
    }
  }
  // snap to three colors: background, glow, wire
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const bg = hexToRgb(C.splashBg);
  const glow = hexToRgb(C.splashGlow);
  const wire = hexToRgb(C.splashHanger);
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i]; // white strokes over a dark bg: red channel is enough
    const t = lum > 150 ? wire : lum > 70 ? glow : bg;
    d[i] = t[0];
    d[i + 1] = t[1];
    d[i + 2] = t[2];
  }
  ctx.putImageData(img, 0, 0);
}

export function Splash({ onDone, frozenAt }: { onDone: () => void; frozenAt?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const ctx = ref.current!.getContext("2d", { willReadFrequently: true })!;
    if (frozenAt !== undefined) {
      draw(ctx, frozenAt);
      return;
    }
    let raf = 0;
    let fadeTimer = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SWING_MS);
      const eased = 0.5 - Math.cos(t * Math.PI) / 2;
      draw(ctx, -SWING_DEG / 2 + eased * SWING_DEG);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        setFading(true);
        fadeTimer = window.setTimeout(onDone, FADE_MS);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
    };
  }, [onDone, frozenAt]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      onClick={onDone}
      style={{
        position: "absolute",
        inset: 0,
        width: STAGE_W,
        height: STAGE_H,
        imageRendering: "pixelated",
        cursor: "pointer",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms steps(5)`,
        zIndex: 40,
      }}
    />
  );
}
