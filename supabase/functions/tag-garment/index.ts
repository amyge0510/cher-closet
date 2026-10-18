// Supabase Edge Function: looks at a photo of one piece of clothing and tags
// it for the closet (category, name, colors, pattern, styles), using Claude.
//
// The app sends the picture plus the lists it understands; the answer is
// forced into exactly that shape (structured output), so it can be filed
// without guesswork. The Anthropic API key lives here as a secret and never
// reaches the browser. Only signed-in users can call this (Supabase checks
// their sign-in token before the function runs).
//
// Setup: Dashboard → Edge Functions → Secrets → ANTHROPIC_API_KEY, then
// deploy this folder as "tag-garment" (see the README).

import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_CHARS = 2_000_000; // base64 JPEG; the app sends ~512px, far smaller

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }
  const image = typeof body.image === "string" ? body.image : "";
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: "bad image" }, 400);
  const categories = ids(body.categories);
  const colors = ids(body.colors);
  const patterns = ids(body.patterns, 10);
  const styles = (Array.isArray(body.styles) ? body.styles : [])
    .map((s) => ({ id: String((s as { id?: unknown })?.id ?? ""), label: String((s as { label?: unknown })?.label ?? "").slice(0, 24) }))
    .filter((s) => /^[a-z0-9-]{1,24}$/.test(s.id))
    .slice(0, 40);
  if (!categories.length || !colors.length || !patterns.length || !styles.length) return json({ error: "missing lists" }, 400);
  const wardrobe = WARDROBE[String(body.wardrobe)] ?? WARDROBE.both;

  const schema = {
    type: "object",
    properties: {
      is_clothing: { type: "boolean", description: "false if the photo isn't a piece of clothing, shoes or an accessory" },
      category: { type: "string", enum: categories },
      name: { type: "string", description: "2 to 4 words, like 'Black Leather Jacket' or 'Light Wash Jeans'" },
      colors: { type: "array", items: { type: "string", enum: colors }, description: "1 to 3, main color first" },
      pattern: { type: "string", enum: patterns },
      styles: { type: "array", items: { type: "string", enum: styles.map((s) => s.id) }, description: "1 to 4 styles it fits" },
    },
    required: ["is_clothing", "category", "name", "colors", "pattern", "styles"],
    additionalProperties: false,
  };

  const prompt = `This is a photo of one item from someone's closet, with the background removed. Tag it so the app can file it.
${wardrobe}

- category: where it goes. Sweaters, cardigans and knit vests are "sweaters" if that's listed; shirts, tees, jackets and coats are "tops"; pants, jeans and shorts are "bottoms"; socks and tights are "pantyhose".
- name: short and plain, the way you'd label it on a shelf.
- colors: the closest names from the list. "denim" is for blue jeans-colored fabric; "babypink" is pale pink. Metals (gold, silver) only for hardware or jewelry.
- pattern: "solid" unless there's a clear print, plaid, stripe or chunky knit texture.
- styles: which of these styles it would be worn in (every item should get at least "everyday" if it's a basic):
${styles.map((s) => `  ${s.id} = ${s.label}`).join("\n")}`;

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // if the model declines, Anthropic re-runs the request on its
      // recommended fallback model instead of returning a refusal
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal") return json({ error: "declined" }, 422);
    if (res.stop_reason === "max_tokens") return json({ error: "answer cut off" }, 502);
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return json(JSON.parse(text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy, try again" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "ANTHROPIC_API_KEY is wrong" }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude API error ${e.status}` }, 502);
    console.error(e);
    return json({ error: "tagging failed" }, 500);
  }
});
