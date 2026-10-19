// Supabase Edge Function: redraws pictures with Google's Gemini image model.
//
//   mode "tidy": a garment cut out of a photo (often worn, creased, half
//     hidden) is redrawn as a straight-on product shot of the same piece, on
//     a flat chroma-key background the app then removes.
//   mode "pose": a photo of the user is redrawn as the same person standing
//     in a "model stance", in a plain black tank and shorts, so the closet
//     can dress them.
//
// The Gemini key lives here as a secret (GEMINI_API_KEY) and never reaches
// the browser. Only signed-in users can call this, and each person gets a
// daily allowance (see LIMITS), counted in the ai_usage table.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const LIMITS = { tidy: 25, pose: 5 } as const; // per person per day
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

function tidyPrompt(name: string, background: string) {
  return `This is a piece of clothing (${name}) cut out of a photo, maybe while someone was wearing it, so it may be creased, turned or partly hidden.
Redraw it as a clean e-commerce product photo of this exact same piece: seen straight from the front, symmetric, as if on an invisible mannequin (or laid flat for shoes and bags), centered, filling most of the frame.
Keep everything about the item the same: its exact colors, fabric, texture, cut, length, neckline, straps, buttons, prints and embroidery. Don't add or invent details.
No person, no body parts, no hanger, no mannequin, no tags, no text, no shadow.
The background must be one completely flat solid ${background}, with nothing else on it.`;
}

const POSE_PROMPT = `Redraw this photo as a full-body fashion model photo of the same person.
Keep their face, hair, skin tone and body shape exactly the same.
They stand straight, facing the camera, in a relaxed model stance: feet slightly apart, arms hanging relaxed a little away from the body, so the arms don't cover the torso or hips.
They wear a plain fitted black tank top and plain black bike shorts that end mid-thigh, and are barefoot. No jewelry, no bag, no hat.
Show the whole body from the top of the head to the feet, centered, with a little space above and below.
Plain flat light gray studio background, soft even lighting, no shadows on the floor.`;

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
  const mode = body.mode === "pose" ? "pose" : body.mode === "tidy" ? "tidy" : null;
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = body.mimeType === "image/png" ? "image/png" : "image/jpeg";
  if (!mode) return json({ error: "mode must be tidy or pose" }, 400);
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: "bad image" }, 400);

  // the caller's own Supabase client, so row-level security applies
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await db.auth.getUser();
  if (!who.user) return json({ error: "sign in first" }, 401);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", mode).gte("created_at", since);
  if (countError) return json({ error: "usage table missing: run the ai_usage migration" }, 500);
  if ((count ?? 0) >= LIMITS[mode]) return json({ error: "daily limit", limit: LIMITS[mode] }, 429);

  const name = String(body.name ?? "garment").replace(/[^\w '&-]/g, "").slice(0, 40) || "garment";
  const background = body.background === "magenta" ? "pure magenta (#FF00FF)" : "pure chroma-key green (#00FF00)";
  const prompt = mode === "tidy" ? tidyPrompt(name, background) : POSE_PROMPT;

  try {
    const model = await imageModel(key);
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: image } }, { text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: mode === "tidy" ? "1:1" : "9:16" } },
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
    await db.from("ai_usage").insert({ kind: mode });
    return json({ image: picture.data, mimeType: picture.mimeType, model });
  } catch (e) {
    console.error(e);
    return json({ error: "redraw failed" }, 500);
  }
});
