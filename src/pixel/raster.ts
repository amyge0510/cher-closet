// Canvas helpers that turn any image (garment cut-outs, body photos) into
// chunky low-resolution pixels with a hard alpha edge and a reduced palette.

// Closet pictures, once loaded, stay ready to draw (by link), so opening a
// category shows them at once. The oldest are let go past a few hundred.
const loaded = new Map<string, Promise<HTMLImageElement>>();
const KEEP_LOADED = 400;

export function loadImage(src: string): Promise<HTMLImageElement> {
  const kept = loaded.get(src);
  if (kept) return kept;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => resolve(img)) : resolve(img));
    img.onerror = () => {
      loaded.delete(src);
      reject(new Error(`could not load ${src.slice(0, 80)}`));
    };
    img.src = src;
  });
  loaded.set(src, p);
  if (loaded.size > KEEP_LOADED) loaded.delete(loaded.keys().next().value!);
  return p;
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export type Fit = { x: number; y: number; w: number; h: number };

// Scales (iw, ih) to fit inside (bw, bh), centered horizontally.
export function containBox(iw: number, ih: number, bw: number, bh: number, valign: "top" | "center" = "center"): Fit {
  const s = Math.min(bw / iw, bh / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: (bw - w) / 2, y: valign === "top" ? 0 : (bh - h) / 2, w, h };
}

export type PixelateOpts = {
  /** levels per color channel after posterizing (0 = keep) */
  levels?: number;
  /** alpha at or above this becomes solid, below becomes clear */
  alphaCut?: number;
  /** add a 1px "sticker" outline in this color */
  outline?: string;
};

// Snaps pixels in place: hard alpha, posterized color, optional outline.
export function crunch(canvas: HTMLCanvasElement, opts: PixelateOpts = {}) {
  const { levels = 12, alphaCut = 110, outline } = opts;
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const step = levels > 1 ? 255 / (levels - 1) : 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < alphaCut) {
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
    if (step) {
      d[i] = Math.round(d[i] / step) * step;
      d[i + 1] = Math.round(d[i + 1] / step) * step;
      d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
  }
  if (outline) {
    const [r, g, b] = hexToRgb(outline);
    const solid = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) solid[p] = d[p * 4 + 3] ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (solid[p]) continue;
        const near =
          (x > 0 && solid[p - 1]) ||
          (x < w - 1 && solid[p + 1]) ||
          (y > 0 && solid[p - w]) ||
          (y < h - 1 && solid[p + w]);
        if (near) {
          d[p * 4] = r;
          d[p * 4 + 1] = g;
          d[p * 4 + 2] = b;
          d[p * 4 + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Deterministic PRNG so procedural art looks the same on every load.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Crops away fully transparent edges, leaving `pad` pixels around the content.
export function trimCanvas(src: HTMLCanvasElement, pad = 2): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return src;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
