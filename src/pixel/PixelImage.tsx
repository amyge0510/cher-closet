import { useEffect, useRef, type CSSProperties } from "react";
import { containBox, crunch, loadImage, type PixelateOpts } from "./raster";

type Props = PixelateOpts & {
  src: string;
  /** size on stage, in stage pixels */
  w: number;
  h: number;
  /** stage pixels per image pixel; bigger = chunkier */
  pixel?: number;
  /** fraction of the box the image may fill */
  fill?: number;
  style?: CSSProperties;
};

// Draws an image fitted into a box at low resolution, then scales it back up
// with nearest-neighbour so every image pixel is a visible block.
export function PixelImage({ src, w, h, pixel = 2, fill = 1, style, ...crunchOpts }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { levels, alphaCut, outline } = crunchOpts;

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current!;
    const cw = Math.round(w / pixel);
    const ch = Math.round(h / pixel);
    canvas.width = cw;
    canvas.height = ch;
    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, cw, ch);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        // leave room for the outline
        const inset = outline ? 2 : 0;
        const box = containBox(img.width, img.height, (cw - inset * 2) * fill, (ch - inset * 2) * fill);
        const ox = (cw - (cw - inset * 2) * fill) / 2;
        const oy = (ch - (ch - inset * 2) * fill) / 2;
        ctx.drawImage(img, Math.round(ox + box.x), Math.round(oy + box.y), Math.round(box.w), Math.round(box.h));
        crunch(canvas, { levels, alphaCut, outline });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, w, h, pixel, fill, levels, alphaCut, outline]);

  return <canvas ref={ref} style={{ width: w, height: h, imageRendering: "pixelated", display: "block", ...style }} />;
}
