import { useEffect, useRef } from "react";
import { containBox, crunch, makeCanvas, rng } from "../pixel/raster";
import { C } from "../stage/palette";

// The pixel animation while a background is being removed. The photo is
// shown as chunky blocks with a scan bar sweeping over it and sparkles
// flickering. Once the cut-out is ready, the background blocks pop away one
// by one (each flashes pink, then clears to a checkerboard), leaving the
// garment. While tagging, the garment keeps sparkling.

const CELL = 4; // stage pixels per block
const POP_MS = 1100; // how long the background takes to pop away
const SWEEP_MS = 1400; // one pass of the scan bar

type Props = {
  size: number;
  photo: HTMLCanvasElement;
  /** the photo with its background cleared, same size as `photo` */
  cutout: HTMLCanvasElement | null;
  /** runs once the background has fully popped away */
  onCleared?: () => void;
};

const checker = (x: number, y: number) => (((x >> 1) + (y >> 1)) % 2 ? "#ffffff" : C.invSlot);

export function Scanner({ size, photo, cutout, onCleared }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onCleared);
  done.current = onCleared;

  useEffect(() => {
    const n = Math.round(size / CELL);
    const view = ref.current!;
    view.width = n;
    view.height = n;
    const ctx = view.getContext("2d")!;

    // both images, shrunk to one pixel per block in the same place
    const shrink = (src: HTMLCanvasElement) => {
      const c = makeCanvas(n, n);
      const box = containBox(src.width, src.height, n, n);
      const cx = c.getContext("2d")!;
      cx.imageSmoothingQuality = "high";
      cx.drawImage(src, Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h));
      crunch(c, { levels: 8, alphaCut: 1 });
      return c.getContext("2d")!.getImageData(0, 0, n, n).data;
    };
    const pic = shrink(photo);
    const cut = cutout ? shrink(cutout) : null;
    // the background blocks, in a random popping order
    const pops: number[] = [];
    if (cut) for (let p = 0; p < n * n; p++) if (cut[p * 4 + 3] < 128 && pic[p * 4 + 3] > 0) pops.push(p);
    const rand = rng(n * 7 + pops.length);
    for (let i = pops.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pops[i], pops[j]] = [pops[j], pops[i]];
    }
    const popAt = new Float32Array(n * n).fill(Infinity);
    pops.forEach((p, i) => (popAt[p] = (i / Math.max(1, pops.length)) * POP_MS));

    let raf = 0;
    let start = 0;
    let cleared = false;
    const sparkle = rng(3);
    const frame = (now: number) => {
      start ||= now;
      const t = now - start;
      const img = ctx.createImageData(n, n);
      const d = img.data;
      // scan bar position: sweeps down and back up
      const phase = (t % (SWEEP_MS * 2)) / SWEEP_MS;
      const bar = Math.round((phase < 1 ? phase : 2 - phase) * (n - 1));
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const p = y * n + x;
          let r = pic[p * 4], g = pic[p * 4 + 1], b = pic[p * 4 + 2];
          let a = pic[p * 4 + 3];
          if (cut) {
            const since = t - popAt[p];
            if (since >= 0) {
              // a popping block flashes pink for a moment, then clears
              if (since < 90) [r, g, b, a] = [255, 160, 210, 255];
              else {
                const [cr, cg, cb] = hex(checker(x, y));
                [r, g, b, a] = [cr, cg, cb, 255];
              }
            }
          } else if (Math.abs(y - bar) <= 1) {
            // the scan bar, with a lavender glow
            const k = y === bar ? 0.75 : 0.35;
            r += (255 - r) * k;
            g += (230 - g) * k;
            b += (255 - b) * k;
            a = 255;
          }
          if (a === 0) [r, g, b, a] = [...hex(checker(x, y)), 255];
          d[p * 4] = r;
          d[p * 4 + 1] = g;
          d[p * 4 + 2] = b;
          d[p * 4 + 3] = a;
        }
      // sparkles: a few blocks on the garment flash white each frame
      for (let i = 0; i < 6; i++) {
        const p = Math.floor(sparkle() * n * n);
        const onGarment = cut ? cut[p * 4 + 3] >= 128 : pic[p * 4 + 3] > 0;
        if (onGarment) d.set([255, 255, 255, 255], p * 4);
      }
      ctx.putImageData(img, 0, 0);
      if (cut && !cleared && t > POP_MS + 120) {
        cleared = true;
        done.current?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, photo, cutout]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, imageRendering: "pixelated", display: "block", boxSizing: "border-box", border: `3px solid ${C.invEdge}` }}
    />
  );
}

const cache = new Map<string, [number, number, number]>();
function hex(h: string): [number, number, number] {
  let v = cache.get(h);
  if (!v) {
    const n = parseInt(h.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(h, v);
  }
  return v;
}
