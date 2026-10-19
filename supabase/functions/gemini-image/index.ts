// Supabase Edge Function: redraws pictures with Google's Gemini image model.
//
//   mode "extract": one named item is picked out of the user's original
//     photo (often a whole outfit, worn) and redrawn as a straight-on product
//     shot, on a flat chroma-key background the app then removes.
//   mode "tidy": the same, from the app's own cut-out of one piece.
//   mode "dress": the user's model photo, dressed in an outfit's pieces.
//   mode "pose": a photo of the user is redrawn as the same person standing
//     in a "model stance", in a plain black tank and shorts, so the closet
//     can dress them.
//
// The Gemini key lives here as a secret (GEMINI_API_KEY) and never reaches
// the browser. Only signed-in users can call this, and each person gets a
// daily allowance (see LIMITS), counted in the ai_usage table. Accounts on
// the ai_unlimited list have no cap.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// per person per day; "tidy" counts every garment picture (tidy, extract and
// dress); "pose" counts model photos
const LIMITS = { tidy: 60, pose: 5 } as const;
const MAX_IMAGE_CHARS = 6_000_000;
const API = "https://generativelanguage.googleapis.com/v1beta";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const geminiKey = () => Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("gemini_api_key");

// Google renames its image models often, so ask which ones this key can use
// and take the newest Flash image model (fast and cheap), unless one is
// pinned with the GEMINI_IMAGE_MODEL secret.
let chosenModel: string | null = null;
async function imageModel(key: string): Promise<string> {
  const pinned = Deno.env.get("GEMINI_IMAGE_MODEL");
  if (pinned) return pinned;
  if (chosenModel) return chosenModel;
  const res = await fetch(`${API}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new Error(`listing models failed (${res.status})`);
  const { models = [] } = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const candidates = models
    .map((m) => ({ id: m.name.replace(/^models\//, ""), methods: m.supportedGenerationMethods ?? [] }))
    .filter((m) => m.id.startsWith("gemini-") && m.id.includes("image") && m.methods.includes("generateContent"))
    .sort((a, b) => Number(b.id.includes("flash")) - Number(a.id.includes("flash")) || version(b.id) - version(a.id) || Number(a.id.includes("preview")) - Number(b.id.includes("preview")));
  if (!candidates.length) throw new Error("no Gemini image model is available to this key");
  chosenModel = candidates[0].id;
  console.log("using", chosenModel);
  return chosenModel;
}

// Shared rules for every garment redraw. Faithfulness comes first: a
// product shot that invents straps, rings or legs is worse than none.
function productRules(background: string) {
  return `Draw it as a clean e-commerce product photo:
- Seen straight from the front, upright and level, perfectly symmetrical, with no perspective, tilt or twist. Centered, filling most of the frame.
- Clothing is shown flat-front as on an invisible "ghost" mannequin, with its natural shape, not the shape of the body it was on and not creased or bunched. Shoes are shown side by side from the front-side, bags upright, jewelry laid flat.
- Be completely faithful to the real item. Keep its exact colors, fabric, sheen, texture, cut, length, rise, neckline, straps, closures, hardware, prints and embroidery, at the same sizes and positions.
- Never add anything that isn't visible: no extra straps, rings, studs, buckles, cut-outs, pockets, legs, sleeves, trims, logos or text. If part of the item is hidden or cut off in the photo, finish it in the plainest, simplest way that matches what is visible (continue the same fabric and edges), never with new design details.
- No person, no skin, no hair, no body parts, no hanger, no visible mannequin, no props, no shadow.
- The background must be one completely flat solid ${background}, with nothing else on it, and the item must not use that color.`;
}

// tidy: the app's own cut-out of one piece, redrawn
function tidyPrompt(name: string, background: string, note: string) {
  return `This picture shows one piece of clothing, "${name}", cut out of a photo, maybe while someone was wearing it, so it may be creased, turned or partly hidden.
${productRules(background)}${correction(note)}`;
}

// REDRAW with a note: what the owner says was wrong last time.
const correction = (note: string) =>
  note ? `\nIMPORTANT, from the owner, who knows this item: the last drawing was wrong. "${note}". Fix exactly that, and keep everything else faithful to the photo.` : "";

// extract: one item picked out of the user's original photo, which may show
// a whole outfit on a person. `description` comes from the tagger's look at
// the same photo.
function extractPrompt(name: string, description: string, background: string, note: string) {
  return `This photo may show a whole outfit, maybe on a person. Find only this one item in it: "${name}"${description ? ` (${description})` : ""}. Ignore everything else in the photo.
Redraw only that item, exactly as it looks in the photo.
${productRules(background)}${correction(note)}`;
}

// Said in every prompt with a person in it. The face is the whole point:
// if it changes, it isn't the user any more.
const SAME_PERSON = `IDENTITY IS THE MOST IMPORTANT RULE. This must be unmistakably the same real person as in the photo, as if photographed again:
- Keep the face exactly as it is: the same face shape, jawline, cheekbones, chin, forehead, eye shape and size, eyelids, eyebrows, nose shape and width, lips, smile lines, ears, and any freckles, moles, marks or makeup.
- Keep the same skin tone and texture, the same age and the same ethnicity. Don't beautify, retouch, slim, smooth, lighten, darken or "improve" anything.
- Keep the same body shape, proportions and height.
- If the face in the photo is small, blurry, turned or partly hidden, stay as close to what is visible as possible rather than inventing a different face.`;

const POSE_PROMPT = `Redraw this photo as a full-body fashion model photo of the same person.
${SAME_PERSON}
The picture MUST show the whole body, from the top of the head down to and including both feet, even if the photo only shows part of them (then continue the body naturally). Never a headshot, portrait or half-body crop.
Only the pose, clothes, lighting and background change:
- The camera is straight in front of them at chest height, level, with no tilt, no angle and no wide-angle distortion.
- They face the camera squarely (shoulders and hips square to the camera, not turned), standing straight and symmetrical: feet slightly apart, weight even, arms hanging relaxed a little away from the body so they don't cover the torso or hips, head straight, neutral relaxed expression.
- Hair: the same hair as in the photo (color, length, texture, parting), neatly falling behind or beside the shoulders so it doesn't cover the torso.
- They wear a plain fitted black tank top and plain black bike shorts that end mid-thigh, and are barefoot. No jewelry, no bag, no hat, no other clothes.
- The body is centered and fills most of the picture's height, with a little space above the head and below the feet.
- Background: one flat solid pale lavender (#C3CBF3), soft even lighting, no floor line, no shadows.`;

// dress: the user's model photo, dressed in the chosen pieces (one picture
// per piece, labelled), for the DRESS ME reveal.
function dressPrompt(labels: string[], hair: string) {
  return `The first image is a full-body photo of a person. The next images are clothing items, labelled: ${labels.join("; ")}.
Show this same person wearing exactly these items, together, as one outfit. All ${labels.length} items must be visible in the picture; never leave one out.
${SAME_PERSON}
- Keep the exact same pose, framing, camera angle, position and size in the frame as the first image, so the two pictures line up.
- Replace the black tank top and shorts with the outfit. If no shoes are given, they stay barefoot; if no top or bottom is given for a part of the body, keep the plain black tank or shorts there.
- Each item must look exactly like its picture: the same colors, fabric, sheen, cut, length, fit, straps, closures, hardware, prints and details, worn naturally with real folds and fit on this body. Don't add, remove or redesign anything.
- A jacket, blazer or coat is worn open over the top (or dress), so the top still shows down the front.
- Exactly ONE of each item, worn the way people really wear it: one bag (on one shoulder or in one hand), one pair of shoes, one hat, one necklace. Never duplicate an item or show it twice, and don't add items that aren't in the pictures.
- Hair: ${hair ? `change only the hairstyle to: ${hair}. Keep the same hair color and natural hairline.` : "keep the hair exactly as in the first image."}
- The whole body from the top of the head to the feet stays in frame.
- Background: one flat solid pale lavender (#C3CBF3), no floor line, no shadows, nothing else.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = geminiKey();
  if (!key) return json({ error: "GEMINI_API_KEY is not set" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }
  const mode = body.mode === "pose" || body.mode === "tidy" || body.mode === "extract" || body.mode === "dress" ? body.mode : null;
  const kind = mode === "pose" ? "pose" : "tidy"; // what the daily allowance counts
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = body.mimeType === "image/png" ? "image/png" : "image/jpeg";
  if (!mode) return json({ error: "mode must be tidy, extract, dress or pose" }, 400);
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: "bad image" }, 400);

  // the caller's own Supabase client, so row-level security applies
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await db.auth.getUser();
  if (!who.user) return json({ error: "sign in first" }, 401);
  // people on the ai_unlimited list skip the daily cap (if the list isn't
  // set up yet, everyone has the cap)
  const { data: unlimited } = await db.rpc("has_unlimited_ai");
  if (unlimited !== true) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: countError } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("created_at", since);
    if (countError) return json({ error: "usage table missing: run the ai_usage migration" }, 500);
    if ((count ?? 0) >= LIMITS[kind]) return json({ error: "daily limit", limit: LIMITS[kind] }, 429);
  }

  const clean = (v: unknown, max: number) => String(v ?? "").replace(/[^\w ,.'&()/-]/g, "").slice(0, max);
  const name = clean(body.name, 40) || "garment";
  const description = clean(body.description, 240);
  const note = clean(body.note, 160);
  const background = body.background === "magenta" ? "pure magenta (#FF00FF)" : "pure chroma-key green (#00FF00)";
  // dress: the outfit's pieces, each a labelled JPEG
  const pieces = (Array.isArray(body.pieces) ? body.pieces : [])
    .map((p) => ({ label: clean((p as { label?: unknown })?.label, 60), image: String((p as { image?: unknown })?.image ?? "") }))
    .filter((p) => p.image && p.image.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(p.image))
    // a whole outfit: top, bottom, jacket, shoes, a bag, a hat, tights and
    // a few pieces of jewelry (the app sends the clothes first)
    .slice(0, 12);
  if (mode === "dress" && !pieces.length) return json({ error: "send the outfit's pieces" }, 400);
  const hair = clean(body.hair, 60);
  const prompt =
    mode === "tidy" ? tidyPrompt(name, background, note)
    : mode === "extract" ? extractPrompt(name, description, background, note)
    : mode === "dress" ? dressPrompt(pieces.map((p) => p.label), hair)
    : POSE_PROMPT;
  const inputs = [{ inlineData: { mimeType, data: image } }, ...pieces.map((p) => ({ inlineData: { mimeType: "image/jpeg", data: p.image } }))];

  try {
    const model = await imageModel(key);
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...inputs, { text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], temperature: mode === "pose" || mode === "dress" ? 0.3 : 0.4, imageConfig: { aspectRatio: mode === "pose" || mode === "dress" ? "9:16" : "1:1" } },
      }),
    });
    if (res.status === 429) return json({ error: "Gemini is busy, try again" }, 429);
    if (!res.ok) {
      console.error(await res.text());
      return json({ error: `Gemini error ${res.status}` }, 502);
    }
    const out = await res.json();
    const parts: { inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }[] = out.candidates?.[0]?.content?.parts ?? [];
    const picture = parts.map((p) => p.inlineData ?? (p.inline_data && { mimeType: p.inline_data.mime_type, data: p.inline_data.data })).find((p) => p?.data);
    if (!picture) {
      console.error("no image in reply", JSON.stringify(out).slice(0, 500));
      return json({ error: "Gemini didn't return a picture", reason: out.candidates?.[0]?.finishReason ?? out.promptFeedback?.blockReason ?? null }, 422);
    }
    await db.from("ai_usage").insert({ kind });
    return json({ image: picture.data, mimeType: picture.mimeType, model });
  } catch (e) {
    console.error(e);
    return json({ error: "redraw failed" }, 500);
  }
});
