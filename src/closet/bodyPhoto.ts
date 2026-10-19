import { supabase } from "../lib/supabase";
import { makeCanvas } from "../pixel/raster";
import { clearEdgeBackground, keepMainBlobs, pngBlob, segmentPhoto, type Segment } from "../upload/cutout";
import { smoothEdges } from "../upload/smooth";
import { modelPose } from "../upload/gemini";
import { PLACEHOLDER_ANCHORS, type Anchor, type BodyAnchors } from "./body";

// The user's own figure for the reveal: a photo of them, redrawn by Gemini
// standing straight in a black tank and shorts (see gemini.ts), cut out of
// its background, with the spots where each kind of garment goes.

export type Body = { src: string; anchors: BodyAnchors };

type Box = { x: number; y: number; w: number; h: number };

function bboxOf(masks: { data: ArrayLike<number> }[], w: number, h: number): Box | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (const m of masks)
    for (let p = 0; p < w * h; p++) {
      if (!m.data[p]) continue;
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Where garments go, from the labelled parts of the model photo (fractions of
// `frame`, the person's box). The tank top marks the torso, the shorts the
// hips, legs and feet the rest. Anything missing falls back to the stand-in
// figure's proportions.
export function anchorsFromParts(parts: Segment[], w: number, h: number, frame: Box): BodyAnchors {
  const find = (...labels: string[]) => bboxOf(parts.filter((p) => p.label && labels.includes(p.label)).map((p) => p.mask), w, h);
  const torso = find("Upper-clothes");
  const hips = find("Pants", "Skirt", "Dress");
  const legs = find("Left-leg", "Right-leg");
  const head = find("Face", "Hair");
  const rel = (b: Box): Anchor => ({ x: (b.x - frame.x) / frame.w, y: (b.y - frame.y) / frame.h, w: b.w / frame.w, h: b.h / frame.h });
  const a = structuredClone(PLACEHOLDER_ANCHORS);
  const bottomOfFrame = frame.y + frame.h;
  if (torso) {
    // a top spreads past a tank's straps to the shoulders and sleeves
    a.top = rel({ x: torso.x - torso.w * 0.3, y: torso.y - frame.h * 0.02, w: torso.w * 1.6, h: frame.h * 0.4 });
    a.extras.bags = rel({ x: torso.x + torso.w * 0.95, y: torso.y + torso.h * 0.6, w: torso.w * 0.6, h: frame.h * 0.15 });
  }
  if (hips) {
    a.bottom = rel({ x: hips.x - hips.w * 0.06, y: hips.y - frame.h * 0.01, w: hips.w * 1.12, h: bottomOfFrame - hips.y });
  }
  if (legs) {
    a.extras.pantyhose = rel({ x: legs.x, y: (hips ? hips.y + hips.h * 0.5 : legs.y), w: legs.w, h: bottomOfFrame - (hips ? hips.y + hips.h * 0.5 : legs.y) });
    a.extras.shoes = rel({ x: legs.x - legs.w * 0.05, y: bottomOfFrame - frame.h * 0.075, w: legs.w * 1.1, h: frame.h * 0.075 });
  }
  if (head) {
    a.extras.hats = rel({ x: head.x - head.w * 0.1, y: head.y - head.h * 0.2, w: head.w * 1.2, h: head.h * 0.55 });
    const neckY = head.y + head.h;
    a.extras.jewelry = rel({ x: head.x + head.w * 0.2, y: neckY - head.h * 0.05, w: head.w * 0.6, h: head.h * 0.35 });
    a.extras.scarves = rel({ x: head.x, y: neckY - head.h * 0.1, w: head.w, h: frame.h * 0.15 });
  }
  return a;
}

// Turns any photo of the user into their figure: redrawn by Gemini, cut
// out, trimmed to the person, with garment spots.
export async function makeBody(photo: HTMLCanvasElement): Promise<{ canvas: HTMLCanvasElement; anchors: BodyAnchors }> {
  const model = await modelPose(photo);
  const { width: w, height: h } = model;
  const ctx = model.getContext("2d")!;
  const img = ctx.getImageData(0, 0, w, h);
  let parts: Segment[] = [];
  try {
    parts = await segmentPhoto(model);
  } catch (e) {
    console.warn("couldn't label the model photo, using stand-in proportions:", e);
  }
  // the person: everything the clothes model didn't call background, or,
  // without it, everything that isn't the flat studio backdrop
  const person = new Uint8Array(w * h);
  if (parts.length) {
    for (const p of parts) if (p.label && p.label !== "Background") for (let i = 0; i < w * h; i++) if (p.mask.data[i]) person[i] = 1;
  } else {
    clearEdgeBackground(img.data, w, h);
    for (let i = 0; i < w * h; i++) person[i] = img.data[i * 4 + 3] ? 1 : 0;
  }
  keepMainBlobs(person, w, h);
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = person[i] ? 255 : 0;
  smoothEdges(img.data, w, h);
  ctx.putImageData(img, 0, 0);

  const frame = bboxOf([{ data: person }], w, h) ?? { x: 0, y: 0, w, h };
  const anchors = anchorsFromParts(parts, w, h, frame);
  const out = makeCanvas(frame.w, frame.h);
  out.getContext("2d")!.drawImage(model, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  return { canvas: out, anchors };
}

const SIGNED_URL_SECONDS = 60 * 60 * 12;

// The signed-in user's figure, if they've made one.
export async function loadBody(): Promise<Body | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("body_photos").select("image_path, anchors").eq("is_active", true).maybeSingle();
  if (!data) return null;
  const { data: signed } = await supabase.storage.from("closet").createSignedUrl(data.image_path, SIGNED_URL_SECONDS);
  return signed?.signedUrl ? { src: signed.signedUrl, anchors: data.anchors as BodyAnchors } : null;
}

// Saves a new figure and makes it the one in use.
export async function saveBody(owner: string, canvas: HTMLCanvasElement, anchors: BodyAnchors): Promise<void> {
  if (!supabase) return;
  const path = `${owner}/body/${crypto.randomUUID()}.png`;
  const up = await supabase.storage.from("closet").upload(path, await pngBlob(canvas), { contentType: "image/png" });
  if (up.error) throw up.error;
  await supabase.from("body_photos").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabase.from("body_photos").insert({ image_path: path, anchors, is_active: true });
  if (error) throw error;
}

// Goes back to the stand-in figure (the photo stays in storage).
export async function clearBody(): Promise<void> {
  await supabase?.from("body_photos").update({ is_active: false }).eq("is_active", true);
}
