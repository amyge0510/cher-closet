import { loadImage, makeCanvas, trimCanvas } from "../pixel/raster";

// Turning a photo of a piece of clothing into a cut-out on a clear background.
//
// The real work is done in the browser by @imgly/background-removal, a small
// AI model that finds the clothes in the photo. It's free and nothing leaves
// the computer; the first time, the browser downloads the model (about 40MB)
// and keeps it. If that can't load (offline, blocked), a simple fallback
// clears everything that matches the photo's edges, which works for clothes
// shot on a plain bed, floor or wall.

const MAX_PHOTO = 1024; // longest side we work with, in pixels
const MAX_CUTOUT = 360; // longest side of the saved cut-out
const MODEL_TIMEOUT_MS = 120_000;

export type Progress = (what: "download" | "cut", fraction: number) => void;

// Decodes a file or pasted image, shrunk so the longest side is MAX_PHOTO.
export async function loadPhoto(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, MAX_PHOTO / Math.max(img.width, img.height));
    const c = makeCanvas(img.width * s, img.height * s);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (c: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode image"))), type, quality));

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);

// The photo with its background cleared. `how` says which method worked.
export async function removeBackground(photo: HTMLCanvasElement, progress?: Progress): Promise<{ canvas: HTMLCanvasElement; how: "model" | "edges" }> {
  try {
    const { removeBackground: run } = await import("@imgly/background-removal");
    const blob = await withTimeout(
      run(await toBlob(photo), {
        output: { format: "image/png" },
        progress: (key, current, total) => progress?.(key.startsWith("fetch") ? "download" : "cut", total ? current / total : 0),
      }),
      MODEL_TIMEOUT_MS,
    );
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const c = makeCanvas(img.width, img.height);
      c.getContext("2d")!.drawImage(img, 0, 0);
      if (hasSubject(c)) return { canvas: c, how: "model" };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.warn("background model unavailable, using the edge fallback:", e);
  }
  const c = makeCanvas(photo.width, photo.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(photo, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  clearEdgeBackground(img.data, c.width, c.height);
  ctx.putImageData(img, 0, 0);
  return { canvas: c, how: "edges" };
}

// Enough of the picture left to be a garment (not an empty result).
export function hasSubject(c: HTMLCanvasElement, min = 0.02): boolean {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let solid = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) solid++;
  return solid / (c.width * c.height) >= min;
}

// The fallback: flood-fills from every edge pixel through colors close to the
// edge colors, and makes all of it transparent. Works in place on RGBA data.
// Returns the fraction of the picture that was kept.
export function clearEdgeBackground(d: Uint8ClampedArray, w: number, h: number, tolerance = 34): number {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  const t2 = tolerance * tolerance;
  const close = (a: number, b: number) => {
    const dr = d[a * 4] - d[b * 4];
    const dg = d[a * 4 + 1] - d[b * 4 + 1];
    const db = d[a * 4 + 2] - d[b * 4 + 2];
    return dr * dr + dg * dg + db * db <= t2;
  };
  // grows pixel to pixel, so soft shadows and gradients still count as background
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && !seen[p - 1] && close(p, p - 1)) push(p - 1);
    if (x < w - 1 && !seen[p + 1] && close(p, p + 1)) push(p + 1);
    if (y > 0 && !seen[p - w] && close(p, p - w)) push(p - w);
    if (y < h - 1 && !seen[p + w] && close(p, p + w)) push(p + w);
  }
  let kept = 0;
  for (let p = 0; p < w * h; p++) {
    if (seen[p]) d[p * 4 + 3] = 0;
    else kept++;
  }
  // a fill that ate everything means the photo had no plain background
  if (kept / (w * h) < 0.02) for (let p = 0; p < w * h; p++) d[p * 4 + 3] = 255;
  return kept / (w * h);
}

// Trims the cut-out to the garment and shrinks it for storage.
export function finishCutout(c: HTMLCanvasElement): HTMLCanvasElement {
  const t = trimCanvas(c, 4);
  const s = Math.min(1, MAX_CUTOUT / Math.max(t.width, t.height));
  const out = makeCanvas(t.width * s, t.height * s);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(t, 0, 0, out.width, out.height);
  return out;
}

// A small JPEG of the cut-out on white, for the tagger to look at.
export async function forTagging(c: HTMLCanvasElement): Promise<string> {
  const s = Math.min(1, 512 / Math.max(c.width, c.height));
  const out = makeCanvas(c.width * s, c.height * s);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export const pngBlob = (c: HTMLCanvasElement) => toBlob(c);
