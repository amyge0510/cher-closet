import { useEffect, useRef } from "react";
import { LAYERS, PLACEHOLDER_ANCHORS, placeholderBody, type Anchor, type BodyAnchors } from "../closet/body";
import type { Garment } from "../closet/types";
import { containBox, crunch, loadImage, makeCanvas, rng } from "../pixel/raster";

type Props = {
  w: number;
  h: number;
  top: Garment;
  bottom: Garment;
  /** worn accessories */
  extras?: Garment[];
  bodySrc?: string | null;
  anchors?: BodyAnchors;
  /** run the dissolve; otherwise draw the finished outfit straight away */
  animate: boolean;
  onDone?: () => void;
};

const RES = 2; // stage pixels per canvas pixel
const CELL = 3; // dissolve block size, canvas pixels
const HOLD_MS = 700; // show the bare body first
const DISSOLVE_MS = 1300;

async function bodyCanvas(src: string | null | undefined, cw: number, ch: number) {
  if (!src) return placeholderBody(cw, ch);
  const img = await loadImage(src);
  const c = makeCanvas(cw, ch);
  const box = containBox(img.width, img.height, cw, ch);
  c.getContext("2d")!.drawImage(img, box.x, box.y, box.w, box.h);
  return c;
}

async function place(ctx: CanvasRenderingContext2D, src: string, a: Anchor, cw: number, ch: number) {
  const img = await loadImage(src);
  const box = containBox(img.width, img.height, a.w * cw, a.h * ch, "top");
  ctx.drawImage(img, Math.round(a.x * cw + box.x), Math.round(a.y * ch + box.y), Math.round(box.w), Math.round(box.h));
}

// The full-body screen: the body appears, then the outfit dissolves onto it
// block by block, like a slow 1995 modem picture.
export function Reveal({ w, h, top, bottom, extras = [], bodySrc, anchors = PLACEHOLDER_ANCHORS, animate, onDone }: Props) {
  const extrasKey = extras.map((g) => g.image).join("|");
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let holdTimer = 0;
    const cw = Math.round(w / RES);
    const ch = Math.round(h / RES);
    const view = ref.current!;
    view.width = cw;
    view.height = ch;
    const vctx = view.getContext("2d")!;

    (async () => {
      const body = await bodyCanvas(bodySrc, cw, ch);
      crunch(body, { levels: 10 });
      const outfit = makeCanvas(cw, ch);
      const octx = outfit.getContext("2d")!;
      for (const layer of LAYERS) {
        if (layer === "outfit") {
          await place(octx, bottom.image, anchors.bottom, cw, ch);
          await place(octx, top.image, anchors.top, cw, ch);
          continue;
        }
        const g = extras.find((e) => e.category === layer);
        const a = anchors.extras[layer];
        if (g && a) await place(octx, g.image, a, cw, ch);
      }
      crunch(outfit, { levels: 10 });
      if (cancelled) return;

      vctx.clearRect(0, 0, cw, ch);
      vctx.drawImage(body, 0, 0);
      if (!animate) {
        vctx.drawImage(outfit, 0, 0);
        return;
      }

      const cells: [number, number][] = [];
      for (let y = 0; y < ch; y += CELL) for (let x = 0; x < cw; x += CELL) cells.push([x, y]);
      const rand = rng(cells.length);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      let shown = 0;
      let start = 0;
      const tick = (now: number) => {
        start ||= now;
        const t = Math.min(1, (now - start) / DISSOLVE_MS);
        const upto = Math.floor(t * cells.length);
        for (; shown < upto; shown++) {
          const [x, y] = cells[shown];
          vctx.drawImage(outfit, x, y, CELL, CELL, x, y, CELL, CELL);
        }
        if (t < 1) raf = requestAnimationFrame(tick);
        else onDone?.();
      };
      holdTimer = window.setTimeout(() => (raf = requestAnimationFrame(tick)), HOLD_MS);
    })().catch(() => onDone?.());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
    };
    // extrasKey stands in for `extras`, which is a new array every render
  }, [w, h, top.image, bottom.image, extrasKey, bodySrc, anchors, animate, onDone]);

  return <canvas ref={ref} style={{ width: w, height: h, imageRendering: "pixelated", display: "block" }} />;
}
