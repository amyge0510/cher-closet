import { supabase } from "../lib/supabase";
import { loadImage, makeCanvas } from "../pixel/raster";
import { keepMainBlobs } from "./cutout";
import { keyOut } from "./smooth";

// Redraws through Google's Gemini image model, via the gemini-image Edge
// Function (which holds the key and the daily allowance). Both need someone
// signed in.

export class RedrawError extends Error {}

async function redraw(mode: "tidy" | "pose", image: string, mimeType: string, extra: Record<string, unknown> = {}): Promise<HTMLCanvasElement> {
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

// A garment redrawn as a straight-on product shot, with the background
// keyed out. `colors` picks a key color the garment doesn't use.
export async function tidyGarment(cutout: HTMLCanvasElement, name: string, colors: string[]): Promise<HTMLCanvasElement> {
  const key = colors.some((c) => c === "green" || c === "olive") ? "magenta" : "green";
  // send it on white, at most 768px
  const s = Math.min(1, 768 / Math.max(cutout.width, cutout.height));
  const flat = makeCanvas(cutout.width * s, cutout.height * s);
  const fctx = flat.getContext("2d")!;
  fctx.fillStyle = "#fff";
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(cutout, 0, 0, flat.width, flat.height);
  const out = await redraw("tidy", base64(flat, "image/jpeg", 0.9), "image/jpeg", { name, background: key });
  const ctx = out.getContext("2d")!;
  const img = ctx.getImageData(0, 0, out.width, out.height);
  keyOut(img.data, out.width, out.height, key);
  const mask = new Uint8Array(out.width * out.height);
  for (let p = 0; p < mask.length; p++) mask[p] = img.data[p * 4 + 3] ? 1 : 0;
  keepMainBlobs(mask, out.width, out.height);
  for (let p = 0; p < mask.length; p++) if (!mask[p]) img.data[p * 4 + 3] = 0;
  ctx.putImageData(img, 0, 0);
  return out;
}

// The user, redrawn standing in a model stance in a black tank and shorts.
export async function modelPose(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  return redraw("pose", base64(photo, "image/jpeg", 0.9), "image/jpeg");
}
