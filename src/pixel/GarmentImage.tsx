import { useEffect, useRef, type CSSProperties } from "react";
import { containBox, loadImage, makeCanvas } from "./raster";

type Props = {
  src: string;
  /** size on stage, in stage pixels */
  w: number;
  h: number;
  /** fraction of the box the image may fill */
  fill?: number;
  /** a soft outline around the garment in this color, as in the film */
  outline?: string;
  style?: CSSProperties;
};

// Drawn at this many canvas pixels per stage pixel, so garments stay sharp
// when the stage is scaled up (the screen around them is what's pixelated).
const DETAIL = 3;
const OUTLINE = 2; // outline thickness, stage pixels

// Garments already drawn at a size, so flipping through the closet or coming
// back to a screen shows them at once instead of drawing them again.
const drawn = new Map<string, HTMLCanvasElement>();
const KEEP = 30; // each is a few MB of memory

// A garment cut-out as it looks on the film's monitor: the real photo, smooth,
// with a thin soft glow around its edge.
export function GarmentImage({ src, w, h, fill = 1, outline, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current!;
    const cw = Math.round(w * DETAIL);
    const ch = Math.round(h * DETAIL);
    canvas.width = cw;
    canvas.height = ch;
    const key = `${src}|${cw}|${ch}|${fill}|${outline ?? ""}`;
    const show = (art: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(art, 0, 0);
    };
    const kept = drawn.get(key);
    if (kept) {
      show(kept);
      return;
    }
    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        const art = makeCanvas(cw, ch);
        const ctx = art.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        const o = outline ? OUTLINE * DETAIL : 0;
        const box = containBox(img.width, img.height, (cw - o * 2) * fill, (ch - o * 2) * fill);
        const x = Math.round((cw - box.w) / 2);
        const y = Math.round((ch - box.h) / 2);
        if (outline) {
          // the garment's silhouette in the outline color, spread out, then
          // softened once (blurring each copy was slow on phones)
          const tint = makeCanvas(cw, ch);
          const t = tint.getContext("2d")!;
          t.drawImage(img, x, y, box.w, box.h);
          t.globalCompositeOperation = "source-in";
          t.fillStyle = outline;
          t.fillRect(0, 0, cw, ch);
          const spread = makeCanvas(cw, ch);
          const sp = spread.getContext("2d")!;
          for (let a = 0; a < 12; a++) sp.drawImage(tint, Math.cos((a / 12) * Math.PI * 2) * o, Math.sin((a / 12) * Math.PI * 2) * o);
          ctx.save();
          ctx.filter = `blur(${DETAIL * 0.6}px)`;
          ctx.drawImage(spread, 0, 0);
          ctx.restore();
        }
        ctx.drawImage(img, x, y, box.w, box.h);
        drawn.set(key, art);
        if (drawn.size > KEEP) drawn.delete(drawn.keys().next().value!);
        show(art);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, w, h, fill, outline]);

  return <canvas ref={ref} style={{ width: w, height: h, imageRendering: "auto", display: "block", ...style }} />;
}
