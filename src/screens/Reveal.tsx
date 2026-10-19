import { useEffect, useRef } from "react";
import { anchorFor, LAYERS, PLACEHOLDER_ANCHORS, placeholderBody, type Anchor, type BodyAnchors, type Figure } from "../closet/body";
import type { Garment } from "../closet/types";
import { jewelryKind } from "../closet/categories";
import { containBox, loadImage, makeCanvas, rng } from "../pixel/raster";
import { pixelBody, pixelOutfit } from "../closet/pixelModel";

type Props = {
  w: number;
  h: number;
  top: Garment;
  bottom: Garment;
  /** worn accessories */
  extras?: Garment[];
  bodySrc?: string | null;
  /** which stand-in figure to use when there's no body photo */
  figure?: Figure;
  anchors?: BodyAnchors;
  /** run the dissolve; otherwise draw the finished outfit straight away */
  animate: boolean;
  /** Gemini dressing the user's own figure: while `waiting`, the bare figure
   * shows with a scan bar; then `src`, the dressed photo, replaces the
   * placed-on clothes */
  dressed?: { src: string | null; waiting: boolean; under?: string };
  /** PIXEL closet: the pixel-art figure, with each piece drawn to fit it */
  pixel?: boolean;
  onDone?: () => void;
};

// Drawn at 3 canvas pixels per stage pixel so the clothes stay sharp; only
// the dissolve itself comes in blocks, like a slow 1995 modem picture.
const RES = 1 / 3; // stage pixels per canvas pixel
const CELL = 18; // dissolve block size, canvas pixels (6 stage pixels)
const HOLD_MS = 700; // show the bare body first
const DISSOLVE_MS = 1300;

type Frame = { x: number; y: number; w: number; h: number };

// The body drawn into the panel, and `frame`, the box it fills (anchors are
// fractions of that box). A user's own figure keeps a little space around it.
async function bodyCanvas(src: string | null | undefined, cw: number, ch: number, figure?: Figure): Promise<{ canvas: HTMLCanvasElement; frame: Frame }> {
  if (!src) return { canvas: placeholderBody(cw, ch, figure), frame: { x: 0, y: 0, w: cw, h: ch } };
  // drawn whole, like the dressed photos, so the two line up exactly
  const img = await loadImage(src);
  const box = containBox(img.width, img.height, cw, ch);
  return { canvas: await wholePhoto(src, cw, ch), frame: { x: box.x, y: box.y, w: box.w, h: box.h } };
}

// A garment fitted into its anchor: as wide as the anchor, centered, hanging
// from its top edge (and only shrunk if it would run past the bottom).
async function place(ctx: CanvasRenderingContext2D, src: string, a: Anchor, f: Frame) {
  const img = await loadImage(src);
  const box = containBox(img.width, img.height, a.w * f.w, a.h * f.h, "top");
  ctx.drawImage(img, Math.round(f.x + a.x * f.w + box.x), Math.round(f.y + a.y * f.h + box.y), Math.round(box.w), Math.round(box.h));
}

// A dressed photo drawn whole, filling the canvas; any gap takes the photo's
// own background color (its top-left corner) so it blends in.
async function wholePhoto(src: string, cw: number, ch: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const c = makeCanvas(cw, ch);
  const ctx = c.getContext("2d")!;
  const corner = makeCanvas(1, 1);
  corner.getContext("2d")!.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = corner.getContext("2d")!.getImageData(0, 0, 1, 1).data;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, cw, ch);
  const box = containBox(img.width, img.height, cw, ch);
  ctx.drawImage(img, box.x, box.y, box.w, box.h);
  return c;
}

// The full-body screen: the body appears, then the outfit dissolves onto it
// block by block, like a slow 1995 modem picture.
export function Reveal({ w, h, top, bottom, extras = [], bodySrc, figure, anchors = PLACEHOLDER_ANCHORS, animate, dressed, pixel = false, onDone }: Props) {
  const extrasKey = extras.map((g) => g.image).join("|");
  const ref = useRef<HTMLCanvasElement>(null);
  // a dressed photo that arrives after a wait dissolves in, even on the dressed screen
  const waited = useRef(false);
  const waiting = !!dressed?.waiting;
  const dressedSrc = dressed?.src ?? null;
  // the outfit already on screen (e.g. before a hairstyle change): it stays
  // under the scan bar instead of the bare figure
  const underSrc = dressed?.under ?? null;

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
      const figureCanvas = pixel ? { canvas: pixelBody(cw, ch, figure ?? "womens"), frame: { x: 0, y: 0, w: cw, h: ch } } : await bodyCanvas(bodySrc, cw, ch, figure);
      const frame = figureCanvas.frame;
      // what the outfit dissolves onto: the outfit already on, or the figure
      const body = underSrc ? await wholePhoto(underSrc, cw, ch) : figureCanvas.canvas;
      if (cancelled) return;
      if (waiting) {
        // the bare figure, with a lavender scan bar sweeping up and down
        waited.current = true;
        const t0 = performance.now();
        const sweep = (now: number) => {
          const phase = ((now - t0) % 2400) / 1200;
          const y = (phase < 1 ? phase : 2 - phase) * ch;
          vctx.clearRect(0, 0, cw, ch);
          vctx.drawImage(body, 0, 0);
          vctx.fillStyle = "rgba(255, 236, 255, 0.55)";
          vctx.fillRect(0, y - 6, cw, 12);
          vctx.fillStyle = "rgba(255, 236, 255, 0.2)";
          vctx.fillRect(0, y - 24, cw, 48);
          raf = requestAnimationFrame(sweep);
        };
        raf = requestAnimationFrame(sweep);
        return;
      }
      const outfit = makeCanvas(cw, ch);
      const octx = outfit.getContext("2d")!;
      if (pixel) {
        octx.drawImage(pixelOutfit(cw, ch, figure ?? "womens", top.id === bottom.id ? [top, ...extras] : [top, bottom, ...extras]), 0, 0);
      } else if (dressedSrc) {
        // the whole dressed photo replaces the figure, block by block
        octx.drawImage(await wholePhoto(dressedSrc, cw, ch), 0, 0);
      } else for (const layer of LAYERS) {
        if (layer === "outfit") {
          if (top.id === bottom.id) {
            // a dress: from the shoulders down past the hips, to the knees
            const a = anchors.top;
            await place(octx, top.image, { ...a, h: anchors.bottom.y + anchors.bottom.h * 0.75 - a.y }, frame);
          } else {
            await place(octx, bottom.image, anchors.bottom, frame);
            await place(octx, top.image, anchors.top, frame);
          }
          continue;
        }
        // every worn piece in this layer (jewelry can be several): jewelry
        // goes to the neck, wrist, ears or hand by what it is; pieces sharing
        // a spot shift a little so a stack of bracelets shows as a stack
        const pieces = extras.filter((e) => e.category === layer);
        const seen: Record<string, number> = {};
        for (const g of pieces) {
          const kind = layer === "jewelry" ? jewelryKind(g.name) : "";
          const a = kind ? anchorFor(anchors, kind) : anchors.extras[layer];
          if (!a) continue;
          const n = (seen[kind] = (seen[kind] ?? -1) + 1);
          await place(octx, g.image, { ...a, x: a.x + n * a.w * 0.15, y: a.y + n * a.h * (kind === "neck" ? 0.35 : 0.2) }, frame);
        }
      }
      if (cancelled) return;

      vctx.clearRect(0, 0, cw, ch);
      vctx.drawImage(body, 0, 0);
      const fresh = waited.current;
      waited.current = false;
      if (!animate && !(dressedSrc && fresh)) {
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
      holdTimer = window.setTimeout(() => (raf = requestAnimationFrame(tick)), fresh ? 0 : HOLD_MS);
    })().catch(() => onDone?.());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
    };
    // extrasKey stands in for `extras`, which is a new array every render
  }, [w, h, top.image, bottom.image, extrasKey, bodySrc, figure, anchors, animate, waiting, dressedSrc, underSrc, pixel, onDone]);

  return <canvas ref={ref} style={{ width: w, height: h, imageRendering: pixel ? "pixelated" : "auto", display: "block" }} />;
}
