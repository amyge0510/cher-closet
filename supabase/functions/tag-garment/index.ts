// Supabase Edge Function: the closet's eyes, using Google's Gemini.
//   task "tag" (default): tags one cut-out garment (category, name, colors,
//     pattern, styles).
//   task "list": finds every garment in an uploaded photo (often a whole
//     outfit, worn), tags each, and says whether there's a person in it.
//   task "judge": looks at a whole outfit and says if it's a MIS-MATCH!.
//
// The app sends the picture plus the lists it understands; the answer is
// forced into exactly that shape (a JSON schema), so it can be filed without
// guesswork. The Gemini key lives here as a secret (GEMINI_API_KEY, the same
// one the gemini-image function uses) and never reaches the browser. Only
// signed-in users can call this: the app's public key alone is turned away.
//
// Setup: deploy this file as "tag-garment" (see the README).

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_IMAGE_CHARS = 2_000_000; // base64 JPEG; the app sends ~512px, far smaller

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const geminiKey = () => Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("gemini_api_key");

// Google renames its models often, so ask which ones this key can use and
// take the newest Flash model (fast and cheap, and plenty for naming
// clothes), unless one is pinned with the GEMINI_TEXT_MODEL secret.
let chosenModel: string | null = null;
async function textModel(key: string): Promise<string> {
  const pinned = Deno.env.get("GEMINI_TEXT_MODEL");
  if (pinned) return pinned;
  if (chosenModel) return chosenModel;
  const res = await fetch(`${API}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new Error(`listing models failed (${res.status})`);
  const { models = [] } = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const candidates = models
    .map((m) => ({ id: m.name.replace(/^models\//, ""), methods: m.supportedGenerationMethods ?? [] }))
    // plain Flash models only: not the image, audio, live or "lite" variants
    .filter((m) => /^gemini-\d+(\.\d+)?-flash(-preview[\w-]*|-\d+)?$/.test(m.id) && m.methods.includes("generateContent"))
    .sort((a, b) => version(b.id) - version(a.id) || Number(a.id.includes("preview")) - Number(b.id.includes("preview")));
  chosenModel = candidates[0]?.id ?? "gemini-flash-latest";
  console.log("using", chosenModel);
  return chosenModel;
}

// Lists from the app are only ever short lowercase ids.
const ids = (v: unknown, max = 40): string[] =>
  Array.isArray(v) ? [...new Set(v.map(String).filter((s) => /^[a-z0-9][a-z0-9-]{0,23}$/.test(s)))].slice(0, max) : [];

const WARDROBE: Record<string, string> = {
  womens: "They mostly wear womenswear.",
  mens: "They mostly wear menswear.",
  both: "They wear a mix of womenswear and menswear.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = geminiKey();
  if (!key) return json({ error: "GEMINI_API_KEY is not set" }, 500);

  // a real signed-in user, not just the app's public key
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await db.auth.getUser();
  if (!who.user) return json({ error: "sign in first" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }
  const isImage = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(v);
  // task "tag": one cut-out; "list": every item in a photo; "judge": does an outfit go together
  const task = body.task === "list" || body.task === "judge" ? body.task : "tag";
  const wardrobe = WARDROBE[String(body.wardrobe)] ?? WARDROBE.both;
  const choice = (values: string[]) => ({ type: "STRING", format: "enum", enum: values }); // Gemini's schema format

  let parts: unknown[];
  let schema: Record<string, unknown>;
  if (task === "judge") {
    // the outfit's pieces, each a small JPEG with a label like "top: Tan Utility Blouse"
    const pieces = (Array.isArray(body.pieces) ? body.pieces : [])
      .map((p) => ({ label: String((p as { label?: unknown })?.label ?? "").replace(/[^\w ,.'&():/-]/g, "").slice(0, 60), image: (p as { image?: unknown })?.image }))
      .filter((p): p is { label: string; image: string } => isImage(p.image))
      .slice(0, 8);
    if (pieces.length < 2) return json({ error: "send at least a top and a bottom" }, 400);
    schema = {
      type: "OBJECT",
      properties: {
        match: { type: "BOOLEAN" },
        reason: { type: "STRING", description: "under 40 characters, plain words, e.g. 'A DRESSY BLOUSE WITH BIKE SHORTS' or 'THE COLORS WORK TOGETHER'" },
      },
      required: ["match", "reason"],
      propertyOrdering: ["match", "reason"],
    };
    parts = [
      ...pieces.flatMap((p) => [{ text: p.label }, { inlineData: { mimeType: "image/jpeg", data: p.image } }]),
      {
        text: `These pieces are worn together as one outfit. ${wardrobe}
Would a stylish, fashion-aware person wear them together? Judge it like Cher from Clueless judging an outfit: honest, but not snobby.
Say it's a mismatch when the pieces clearly clash: different levels of dressiness (a dressy blouse with gym shorts), styles that fight (preppy with grunge, unless it's clearly done on purpose), colors that clash, too many busy patterns, or accessories that don't belong with the rest.
Simple basics (plain tees, jeans, plain tanks, white sneakers) go with most things.
The reason is shown on screen in capitals, so keep it short and say what's wrong (or what works).`,
      },
    ];
  } else {
    const image = body.image;
    if (!isImage(image)) return json({ error: "bad image" }, 400);
    const categories = ids(body.categories);
    const colors = ids(body.colors);
    const patterns = ids(body.patterns, 10);
    const styles = (Array.isArray(body.styles) ? body.styles : [])
      .map((s) => ({ id: String((s as { id?: unknown })?.id ?? ""), label: String((s as { label?: unknown })?.label ?? "").slice(0, 24) }))
      .filter((s) => /^[a-z0-9-]{1,24}$/.test(s.id))
      .slice(0, 40);
    if (!categories.length || !colors.length || !patterns.length || !styles.length) return json({ error: "missing lists" }, 400);
    // the category the app's clothes model saw, if any (e.g. "skirts")
    const hint = categories.includes(String(body.hint)) ? String(body.hint) : null;

    const itemProps = {
      category: choice(categories),
      name: { type: "STRING", description: "2 to 4 words, like 'Black Leather Jacket', 'Light Wash Jeans' or 'Olive Bike Shorts'" },
      colors: { type: "ARRAY", items: choice(colors), description: "1 to 3, main color first" },
      pattern: choice(patterns),
      styles: { type: "ARRAY", items: choice(styles.map((s) => s.id)), description: "1 to 3 styles it clearly fits, best first" },
    };
    const itemOrder = ["category", "name", "colors", "pattern", "styles"];
    const rules = `- category: where it goes. Sweaters, cardigans and knit vests are "sweaters" if that's listed; shirts, tees, tanks, jackets and coats are "tops"; pants, jeans and shorts are "bottoms"; dresses, gowns and jumpsuits are "dresses"; socks and tights are "pantyhose".
- name: short and plain, the way you'd label it on a shelf. Say exactly what it is: shorts are shorts, not pants; a tank is a tank, not a shirt.
- colors: the closest names from the list. Photos are often dim, so judge the fabric's real color, not its shadows (dark olive is "olive", not "black" or "navy"). "denim" is for blue jeans-colored fabric; "babypink" is pale pink. Metals (gold, silver) only for hardware or jewelry.
- pattern: "solid" unless there's a clear print, plaid, stripe or chunky knit texture. Embroidery or a small motif on a plain piece is "print".
- styles: the 1 to 3 styles it clearly belongs to, BEST FIRST (the order matters: the first is the one it says most). Don't stretch a piece across opposite looks: dark, sheer, mesh, leather, studded, ripped or lace-up pieces are edgy (goth, punk, grunge, moto), not soft; the soft styles (coquette, ballet, cottage) are for light, pretty, delicate pieces. Heels and pumps are never everyday, athleisure, street, minimal or clean. Plain basics (tees, tanks, jeans, plain shorts, sneakers) get "everyday", and "everyday" goes last unless it's a plain basic. Pick from:
${styles.map((s) => `  ${s.id} = ${s.label}`).join("\n")}`;

    if (task === "list") {
      schema = {
        type: "OBJECT",
        properties: {
          has_person: { type: "BOOLEAN", description: "true if a person is in the photo (wearing the clothes or not)" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                ...itemProps,
                description: { type: "STRING", description: "what it looks like, only from what's visible: fabric, cut, length, closures, hardware, details. Under 30 words." },
                visible: { type: "STRING", format: "enum", enum: ["most", "part"], description: "'part' if most of the item is hidden or cut off" },
              },
              required: [...itemOrder, "description", "visible"],
              propertyOrdering: [...itemOrder, "description", "visible"],
            },
          },
        },
        required: ["has_person", "items"],
        propertyOrdering: ["has_person", "items"],
      };
      parts = [
        { inlineData: { mimeType: "image/jpeg", data: image } },
        {
          text: `This photo was uploaded to someone's digital closet. List every piece of clothing, shoes and accessories in it that's worth adding to a closet (at most 6, most important first), and tag each so the app can file it. Skip things that are barely visible, and skip anything that isn't clothing.
${wardrobe}
The description is used to redraw the piece faithfully, so describe only what you can actually see; don't guess at hidden parts.
${rules}`,
        },
      ];
    } else {
      schema = {
        type: "OBJECT",
        properties: { is_clothing: { type: "BOOLEAN", description: "false if the photo isn't a piece of clothing, shoes or an accessory" }, ...itemProps },
        required: ["is_clothing", ...itemOrder],
        propertyOrdering: ["is_clothing", ...itemOrder],
      };
      parts = [
        { inlineData: { mimeType: "image/jpeg", data: image } },
        {
          text: `This is a photo of one item from someone's closet, with the background removed. It may have been cut out of a photo of someone wearing it, so its edges can be rough and parts may be hidden. Tag it so the app can file it.
${wardrobe}${hint ? `\nThe app's clothes detector thinks it belongs in "${hint}"; go with that unless it's clearly wrong.` : ""}

${rules}`,
        },
      ];
    }
  }

  try {
    const model = await textModel(key);
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
      }),
    });
    if (res.status === 429) return json({ error: "Gemini is busy, try again" }, 429);
    if (res.status === 400 || res.status === 403) {
      const detail = await res.text();
      console.error(detail);
      if (/API key/i.test(detail)) return json({ error: "GEMINI_API_KEY is wrong" }, 500);
      return json({ error: `Gemini error ${res.status}` }, 502);
    }
    if (!res.ok) {
      console.error(await res.text());
      return json({ error: `Gemini error ${res.status}` }, 502);
    }
    const out = await res.json();
    const candidate = out.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) return json({ error: "declined", reason: candidate?.finishReason ?? out.promptFeedback?.blockReason ?? null }, 422);
    if (candidate?.finishReason === "MAX_TOKENS") return json({ error: "answer cut off" }, 502);
    return json(JSON.parse(text));
  } catch (e) {
    console.error(e);
    return json({ error: "tagging failed" }, 500);
  }
});
