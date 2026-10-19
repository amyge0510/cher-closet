import { supabase } from "../lib/supabase";
import { loadImage, makeCanvas } from "../pixel/raster";
import { clearEdgeBackground, keepMainBlobs } from "./cutout";
import { keyOut } from "./smooth";

// Redraws through Google's Gemini image model, via the gemini-image Edge
// Function (which holds the key and the daily allowance). Both need someone
// signed in.

export class RedrawError extends Error {}

async function redraw(mode: "tidy" | "extract" | "pose" | "dress", image: string, mimeType: string, extra: Record<string, unknown> = {}): Promise<HTMLCanvasElement> {
  if (!supabase) throw new RedrawError("SIGN IN TO USE THIS.");
  const { data, error } = await supabase.functions.invoke("gemini-image", { body: { mode, image, mimeType, ...extra } });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    console.error("gemini-image failed:", error);
    // no answer at all: almost always the function isn't deployed (Supabase's
    // "not found" reply has no CORS approval, so the browser blocks it)
    if (status === undefined || status === 404) throw new RedrawError("TIDY UP ISN'T SWITCHED ON YET: DEPLOY THE GEMINI-IMAGE FUNCTION IN SUPABASE.");
    if (status === 429) throw new RedrawError("THAT'S TODAY'S LIMIT FOR REDRAWS. TRY AGAIN TOMORROW.");
    if (status === 401) throw new RedrawError("SIGN IN TO USE THIS.");
    if (status === 500) throw new RedrawError("THE REDRAW SERVICE ISN'T SET UP RIGHT. CHECK THE GEMINI KEY AND THE AI_USAGE TABLE.");
    if (status === 422) throw new RedrawError("GEMINI WOULDN'T REDRAW THAT ONE. TRY ANOTHER PHOTO.");
    throw new RedrawError("THE REDRAW DIDN'T WORK. TRY AGAIN IN A MINUTE.");
  }
  const img = await loadImage(`data:${data.mimeType};base64,${data.image}`);
  const c = makeCanvas(img.width, img.height);
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

const base64 = (c: HTMLCanvasElement, type: string, quality?: number) => c.toDataURL(type, quality).split(",")[1];

// Picks a key color the garment doesn't use: green, or magenta for green clothes.
const keyFor = (colors: string[]) => (colors.some((c) => c === "green" || c === "olive") ? "magenta" : "green");

// Removes the redraw's flat background. Gemini usually uses the key color
// it was asked for, but not always, so the color is read from the picture's
// edges: green or magenta are keyed out; anything else (white, gray) is
// cleared by flood-filling from the edges.
function keyedOut(out: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = out;
  const ctx = out.getContext("2d")!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let green = 0, magenta = 0, n = 0;
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    n++;
    if (d[i + 1] > 100 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.4) green++;
    else if (d[i] > 100 && d[i + 2] > 100 && d[i + 1] < Math.min(d[i], d[i + 2]) * 0.7) magenta++;
  };
  for (let x = 0; x < w; x += 4) sample(x, 0), sample(x, h - 1);
  for (let y = 0; y < h; y += 4) sample(0, y), sample(w - 1, y);
  if (green > n * 0.6) keyOut(d, w, h, "green");
  else if (magenta > n * 0.6) keyOut(d, w, h, "magenta");
  else clearEdgeBackground(d, w, h, 12); // gently: light clothes on white mustn't wash out
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < mask.length; p++) mask[p] = d[p * 4 + 3] ? 1 : 0;
  keepMainBlobs(mask, w, h);
  for (let p = 0; p < mask.length; p++) if (!mask[p]) d[p * 4 + 3] = 0;
  ctx.putImageData(img, 0, 0);
  return out;
}

// A JPEG of a canvas (transparent parts on white), at most `max` pixels.
export function jpegOf(c: HTMLCanvasElement, max = 1024): string {
  const s = Math.min(1, max / Math.max(c.width, c.height));
  const flat = makeCanvas(c.width * s, c.height * s);
  const fctx = flat.getContext("2d")!;
  fctx.fillStyle = "#fff";
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(c, 0, 0, flat.width, flat.height);
  return base64(flat, "image/jpeg", 0.9);
}

// One item picked out of the user's whole photo (e.g. the shorts in an
// outfit picture) and redrawn as a straight-on product shot. `description`
// is what the tagger saw, so the redraw stays faithful.
export async function extractItem(photo: HTMLCanvasElement, name: string, description: string, colors: string[]): Promise<HTMLCanvasElement> {
  const key = keyFor(colors);
  const once = async () => keyedOut(await redraw("extract", jpegOf(photo), "image/jpeg", { name, description, background: key }));
  // a redraw that came out broken (tiny, or full of holes, like jeans with
  // whole legs missing) is quietly drawn again once, and the better kept
  const first = await once();
  if (quality(first) >= GOOD_ENOUGH) return first;
  try {
    const second = await once();
    return quality(second) > quality(first) ? second : first;
  } catch {
    return first;
  }
}

const GOOD_ENOUGH = 0.03;

// How whole a cut-out looks: how much of the picture it covers times how
// solidly it fills its own outline box (holes and missing chunks score low).
export function quality(c: HTMLCanvasElement): number {
  const { width: w, height: h } = c;
  const d = c.getContext("2d")!.getImageData(0, 0, w, h).data;
  return coverage(d, w, h);
}

export function coverage(d: Uint8ClampedArray, w: number, h: number): number {
  let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 128) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (!n) return 0;
  const box = (x1 - x0 + 1) * (y1 - y0 + 1);
  return (n / (w * h)) * (n / box);
}

// A cut-out garment redrawn as a straight-on product shot (TIDY UP).
export async function tidyGarment(cutout: HTMLCanvasElement, name: string, colors: string[]): Promise<HTMLCanvasElement> {
  const key = keyFor(colors);
  return keyedOut(await redraw("tidy", jpegOf(cutout, 768), "image/jpeg", { name, background: key }));
}

// The user, redrawn standing in a model stance in a black tank and shorts.
export async function modelPose(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  return redraw("pose", base64(photo, "image/jpeg", 0.9), "image/jpeg");
}

// Draws any image (data URL or signed storage URL) onto a canvas.
async function canvasOf(src: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const c = makeCanvas(img.width, img.height);
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

// The user's model photo, dressed by Gemini in an outfit's pieces (DRESS
// ME). `hair` is a hairstyle to switch to, or "" to keep theirs. Returns a
// PNG data URL of the whole picture, background included.
export async function dressUp(bodySrc: string, pieces: { label: string; image: string }[], hair: string): Promise<string> {
  const body = await canvasOf(bodySrc);
  // the figure on the same lavender it's asked to come back on
  const s = Math.min(1, 1024 / Math.max(body.width, body.height));
  const flat = makeCanvas(body.width * s, body.height * s);
  const fctx = flat.getContext("2d")!;
  fctx.fillStyle = "#c3cbf3";
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(body, 0, 0, flat.width, flat.height);
  const garments = await Promise.all(pieces.map(async (p) => ({ label: p.label, image: jpegOf(await canvasOf(p.image), 512) })));
  // kept whole: clearing the background also ate light clothes on lavender
  const out = await redraw("dress", base64(flat, "image/jpeg", 0.9), "image/jpeg", { pieces: garments, hair });
  return out.toDataURL("image/png");
}
