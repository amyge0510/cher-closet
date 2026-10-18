import { loadImage, makeCanvas, trimCanvas } from "../pixel/raster";

// Turning a photo into one cut-out per piece of clothing, on a clear
// background. Everything runs in the browser, for free, and photos never
// leave the computer. The models download the first time (and are kept):
//
// 1. A clothes model (SegFormer, trained to label tops, skirts, pants,
//    dresses, shoes, bags, hats and scarves on people). When the photo shows
//    someone wearing an outfit, each piece comes out separately.
// 2. If there's no one in the photo (a flat lay or a hanger shot), a general
//    background remover (@imgly/background-removal) cuts out the one item.
// 3. If neither model loads, a simple fallback clears everything matching
//    the photo's edges. It only works on plain backgrounds, so its result is
//    only used when it looks like one clean piece.

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

// One garment found in a photo: the photo with everything else cleared
// (same size as the photo), and the category the clothes model saw, if any.
export type Piece = { canvas: HTMLCanvasElement; hint?: string };
export type Found = { pieces: Piece[]; how: "clothes" | "subject" | "edges" | "none"; problem?: string };

// The clothes model's labels that are clothes, and where they're filed.
// Dresses are left for the tagger to decide.
const GARMENT_LABELS: Record<string, string | undefined> = {
  "Upper-clothes": "tops", Skirt: "skirts", Pants: "bottoms", Dress: undefined,
  "Left-shoe": "shoes", "Right-shoe": "shoes", Hat: "hats", Bag: "bags", Scarf: "scarves",
};
const PERSON_LABELS = ["Face", "Hair", "Left-arm", "Right-arm", "Left-leg", "Right-leg"];
const CLOTHES_MODEL = "Xenova/segformer_b2_clothes";
const MIN_PIECE = { shoes: 0.003, hats: 0.003, default: 0.012 }; // share of the photo

type Segmenter = (image: HTMLCanvasElement) => Promise<{ label: string | null; mask: { data: Uint8ClampedArray | Uint8Array; width: number; height: number } }[]>;
let segmenter: Promise<Segmenter> | null = null;

async function loadSegmenter(progress?: Progress): Promise<Segmenter> {
  segmenter ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const seg = await pipeline("image-segmentation", CLOTHES_MODEL, {
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === "progress" && p.progress != null) progress?.("download", p.progress / 100);
      },
    });
    return (image: HTMLCanvasElement) => seg(image) as ReturnType<Segmenter>;
  })();
  segmenter.catch(() => (segmenter = null)); // try again on the next photo
  return segmenter;
}

// Splits a photo of someone wearing an outfit into its pieces. Returns null
// when there's no person in it.
async function clothesPieces(photo: HTMLCanvasElement, progress?: Progress): Promise<Piece[] | null> {
  const seg = await loadSegmenter(progress);
  progress?.("cut", 0);
  const parts = await withTimeout(seg(photo), MODEL_TIMEOUT_MS);
  const total = photo.width * photo.height;
  const area = (m: { data: ArrayLike<number> }) => {
    let n = 0;
    for (let i = 0; i < m.data.length; i++) if (m.data[i]) n++;
    return n / total;
  };
  const person = parts.filter((p) => p.label && PERSON_LABELS.includes(p.label)).reduce((s, p) => s + area(p.mask), 0);
  if (person < 0.02) return null;

  // shoes come as left and right: one piece
  const masks = new Map<string, { hint?: string; mask: Uint8Array }>();
  for (const p of parts) {
    if (!p.label || !(p.label in GARMENT_LABELS)) continue;
    const key = p.label.endsWith("-shoe") ? "shoes" : p.label;
    const entry = masks.get(key) ?? { hint: GARMENT_LABELS[p.label], mask: new Uint8Array(total) };
    for (let i = 0; i < total; i++) if (p.mask.data[i]) entry.mask[i] = 1;
    masks.set(key, entry);
  }
  const ctx = photo.getContext("2d")!;
  const pixels = ctx.getImageData(0, 0, photo.width, photo.height);
  const pieces: Piece[] = [];
  for (const { hint, mask } of masks.values()) {
    fillSeams(mask, photo.width, photo.height);
    keepMainBlobs(mask, photo.width, photo.height);
    const share = mask.reduce((s, v) => s + v, 0) / total;
    if (share < (MIN_PIECE[hint as keyof typeof MIN_PIECE] ?? MIN_PIECE.default)) continue;
    const c = makeCanvas(photo.width, photo.height);
    const out = new ImageData(new Uint8ClampedArray(pixels.data), photo.width, photo.height);
    for (let i = 0; i < total; i++) if (!mask[i]) out.data[i * 4 + 3] = 0;
    c.getContext("2d")!.putImageData(out, 0, 0);
    pieces.push({ canvas: c, hint });
  }
  // tops first, then bottoms, then the rest, as you'd dress
  const order = ["tops", undefined, "skirts", "bottoms", "shoes", "bags", "scarves", "hats"];
  return pieces.sort((a, b) => order.indexOf(a.hint) - order.indexOf(b.hint));
}

// One item with no one wearing it: the general background remover.
async function subjectPiece(photo: HTMLCanvasElement, progress?: Progress): Promise<Piece | null> {
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
    const c = makeCanvas(photo.width, photo.height);
    c.getContext("2d")!.drawImage(img, 0, 0, photo.width, photo.height);
    return hasSubject(c) ? { canvas: c } : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).toUpperCase().replace(/[^A-Z0-9 .,:'()/-]/g, "").slice(0, 60);

// Every piece of clothing in a photo, best method first.
export async function findPieces(photo: HTMLCanvasElement, progress?: Progress): Promise<Found> {
  const problems: string[] = [];
  try {
    const pieces = await clothesPieces(photo, progress);
    if (pieces?.length) return { pieces, how: "clothes" };
  } catch (e) {
    console.warn("clothes model failed:", e);
    problems.push(reason(e));
  }
  try {
    const piece = await subjectPiece(photo, progress);
    if (piece) return { pieces: [piece], how: "subject" };
  } catch (e) {
    console.warn("background model failed:", e);
    problems.push(reason(e));
  }
  const c = makeCanvas(photo.width, photo.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(photo, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const kept = clearEdgeBackground(img.data, c.width, c.height);
  // only trust it when what's left is one solid piece, not scattered bits
  const alpha = new Uint8Array(c.width * c.height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = img.data[p * 4 + 3] ? 1 : 0;
  fillSeams(alpha, c.width, c.height);
  const main = keepMainBlobs(alpha, c.width, c.height);
  if (kept > 0.03 && kept < 0.9 && main > 0.8) {
    for (let p = 0; p < alpha.length; p++) img.data[p * 4 + 3] = alpha[p] ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    return { pieces: [{ canvas: c }], how: "edges", problem: problems[0] };
  }
  return { pieces: [], how: "none", problem: problems[0] };
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
export function clearEdgeBackground(d: Uint8ClampedArray, w: number, h: number, tolerance = 20): number {
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

// Closes hairline seams (one pixel wide, e.g. from JPEG edges) in a 0/1 mask.
export function fillSeams(mask: Uint8Array, w: number, h: number) {
  const src = mask.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!src[p] && ((src[p - w] && src[p + w]) || (src[p - 1] && src[p + 1]))) mask[p] = 1;
    }
}

// Clears specks from a mask: every connected patch smaller than 3% of the
// whole mask goes (a sleeve split off by an arm stays). Works in place on a
// 0/1 mask; returns the share of the mask that was kept (near 1 for clean
// garments, low for scattered bits).
export function keepMainBlobs(mask: Uint8Array, w: number, h: number): number {
  const label = new Int32Array(w * h);
  const sizes = [0];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
        if (q >= 0 && q < w * h && mask[q] && !label[q]) {
          label[q] = id;
          stack.push(q);
        }
    }
    sizes.push(size);
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const min = total * 0.03;
  let kept = 0;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    if (sizes[label[p]] < min) mask[p] = 0;
    else kept++;
  }
  return kept / total;
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
