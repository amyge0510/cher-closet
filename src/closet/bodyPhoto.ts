import { supabase } from "../lib/supabase";
import { clearEdgeBackground, keepMainBlobs, pngBlob, segmentPhoto, type Segment } from "../upload/cutout";
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
  const arm = find("Right-arm") ?? find("Left-arm");
  if (arm) {
    a.extras["jewelry-wrist"] = rel({ x: arm.x, y: arm.y + arm.h * 0.85, w: arm.w, h: arm.h * 0.12 });
    a.extras["jewelry-hand"] = rel({ x: arm.x, y: arm.y + arm.h * 0.95, w: arm.w * 0.8, h: arm.h * 0.08 });
  }
  if (head) {
    a.extras["jewelry-ears"] = rel({ x: head.x - head.w * 0.05, y: head.y + head.h * 0.45, w: head.w * 1.1, h: head.h * 0.2 });
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
  // The redraw is kept whole, on its own lavender background: cutting the
  // person out once left only a head. If it isn't head-to-toe, it's asked
  // for again (once) before anyone sees it.
  let model = await modelPose(photo);
  let parts = await labelled(model);
  if (!isFullBody(model, parts)) {
    console.warn("the model photo wasn't head-to-toe; asking again");
    const again = await modelPose(photo);
    const againParts = await labelled(again);
    if (isFullBody(again, againParts) || !isFullBody(model, parts)) [model, parts] = [again, againParts];
  }
  const { width: w, height: h } = model;
  const anchors = anchorsFromParts(parts, w, h, personBox(model, parts) ?? { x: 0, y: 0, w, h });
  return { canvas: model, anchors: toWhole(anchors, personBox(model, parts) ?? { x: 0, y: 0, w, h }, w, h) };
}

// The clothes model's labels for the picture (none if it can't load).
async function labelled(c: HTMLCanvasElement): Promise<Segment[]> {
  try {
    return await segmentPhoto(c);
  } catch (e) {
    console.warn("couldn't label the model photo, using stand-in proportions:", e);
    return [];
  }
}

// Where the person is in the picture: from the labels, or else from what
// isn't the flat background.
function personBox(c: HTMLCanvasElement, parts: Segment[]): Box | null {
  const { width: w, height: h } = c;
  if (parts.length) return bboxOf(parts.filter((p) => p.label && p.label !== "Background").map((p) => p.mask), w, h);
  const d = c.getContext("2d")!.getImageData(0, 0, w, h).data.slice();
  clearEdgeBackground(d, w, h, 12);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] ? 1 : 0;
  keepMainBlobs(mask, w, h);
  return bboxOf([{ data: mask }], w, h);
}

// Head-to-toe: legs (or the person) reach most of the way down the picture.
function isFullBody(c: HTMLCanvasElement, parts: Segment[]): boolean {
  const { width: w, height: h } = c;
  const legs = parts.length ? bboxOf(parts.filter((p) => p.label === "Left-leg" || p.label === "Right-leg").map((p) => p.mask), w, h) : null;
  if (parts.length) return !!legs && legs.y + legs.h > h * 0.8;
  const box = personBox(c, parts);
  return !!box && box.h > h * 0.75;
}

// Anchors measured on the person's box, turned into fractions of the whole
// picture (which is what the reveal draws).
function toWhole(a: BodyAnchors, frame: Box, w: number, h: number): BodyAnchors {
  const conv = (x: Anchor): Anchor => ({ x: (frame.x + x.x * frame.w) / w, y: (frame.y + x.y * frame.h) / h, w: (x.w * frame.w) / w, h: (x.h * frame.h) / h });
  return { top: conv(a.top), bottom: conv(a.bottom), extras: Object.fromEntries(Object.entries(a.extras).map(([k, v]) => [k, conv(v)])) };
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
