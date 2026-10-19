import { slotFor, type Category } from "../closet/categories";
import type { Garment, Pattern } from "../closet/types";
import { supabase } from "../lib/supabase";
import { forWardrobe, LEAVES, type Wardrobe } from "../style/styles";

// Tagging a fresh cut-out: what it is (category), a short name, its colors,
// pattern and styles. These drive the closet tabs, MIS-MATCH! and the quiz,
// so every value has to come from the lists below.
//
// Tagging is done by Gemini, through a Supabase Edge Function
// (supabase/functions/tag-garment) that keeps the API key on the server. If
// the function isn't set up, or someone isn't signed in, a rough guess from
// the pixels stands in and the upload screen invites a check.

export const COLORS = [
  "white", "cream", "beige", "black", "navy", "brown", "gray", "denim", "gold", "silver",
  "pink", "babypink", "red", "burgundy", "yellow", "orange", "green", "olive", "blue", "lavender", "purple",
] as const;
export const PATTERNS: Pattern[] = ["solid", "plaid", "stripe", "print", "knit"];

export type Tags = { category: string; name: string; colors: string[]; pattern: Pattern; styles: string[]; isClothing: boolean };

// Categories the tagger may pick: the built-ins, BAGS and HATS (which most
// closets need), and any the user has made up.
export const tagCategories = (categories: Category[]) => [...new Set([...categories.map((c) => c.id), "shoes", "jewelry", "scarves", "pantyhose", "underwear", "sweaters", "jackets", "skirts", "dresses", "bags", "hats"])];

const cleanName = (s: unknown) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 '&\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// Keeps only values the app understands, whatever the tagger sent back.
export function normalizeTags(raw: unknown, categories: string[]): Tags | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const category = String(r.category ?? "").toLowerCase();
  if (!categories.includes(category)) return null;
  const colors = [...new Set((Array.isArray(r.colors) ? r.colors : []).map((c) => String(c).toLowerCase()))].filter((c) => (COLORS as readonly string[]).includes(c)).slice(0, 3);
  const pattern = PATTERNS.includes(r.pattern as Pattern) ? (r.pattern as Pattern) : "solid";
  const styles = [...new Set((Array.isArray(r.styles) ? r.styles : []).map((s) => String(s)))].filter((s) => LEAVES.some((l) => l.id === s)).slice(0, 4);
  const name = titleCase(cleanName(r.name)) || defaultName(colors, category);
  return { category, name, colors: colors.length ? colors : ["black"], pattern, styles, isClothing: r.is_clothing !== false };
}

const SINGULAR: Record<string, string> = {
  tops: "Top", bottoms: "Pants", skirts: "Skirt", shoes: "Shoes", jewelry: "Jewelry", scarves: "Scarf",
  pantyhose: "Tights", underwear: "Underwear", sweaters: "Sweater", jackets: "Jacket", bags: "Bag", hats: "Hat", dresses: "Dress",
};
// `aspect` is height / width of the cut-out: short, wide bottoms are shorts.
const defaultName = (colors: string[], category: string, aspect = 2) =>
  `${titleCase(colors[0] === "babypink" ? "pink" : colors[0] ?? "")} ${category === "bottoms" && aspect < 1.2 ? "Shorts" : SINGULAR[category] ?? titleCase(category)}`.trim();

// Asks Gemini (via the Edge Function) to tag the cut-out. `jpeg` is base64.
async function askAi(jpeg: string, categories: string[], wardrobe: Wardrobe, hint?: string): Promise<Tags | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null; // the function only answers signed-in users
  const styles = LEAVES.filter((l) => forWardrobe(l, wardrobe)).map((l) => ({ id: l.id, label: l.label }));
  const { data, error } = await supabase.functions.invoke("tag-garment", {
    body: { image: jpeg, categories, colors: COLORS, patterns: PATTERNS, styles, wardrobe, hint },
  });
  if (error) {
    console.warn("tagging function unavailable, guessing instead:", error);
    return null;
  }
  return normalizeTags(data, categories);
}

// Signed in, so the AI functions will answer.
async function signedIn() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export type Found = Tags & { description: string; partial: boolean };

// Every garment in an uploaded photo, tagged, and whether a person is in it.
// Null when the AI isn't available (not signed in, or not set up).
export async function listItems(jpeg: string, categories: string[], wardrobe: Wardrobe): Promise<{ hasPerson: boolean; items: Found[] } | null> {
  if (!supabase || !(await signedIn())) return null;
  const styles = LEAVES.filter((l) => forWardrobe(l, wardrobe)).map((l) => ({ id: l.id, label: l.label }));
  const { data, error } = await supabase.functions.invoke("tag-garment", {
    body: { task: "list", image: jpeg, categories, colors: COLORS, patterns: PATTERNS, styles, wardrobe },
  });
  if (error || !data || !Array.isArray(data.items)) {
    console.warn("listing failed:", error ?? data);
    return null;
  }
  const items = (data.items as Record<string, unknown>[]).flatMap((raw) => {
    const tags = normalizeTags({ ...raw, is_clothing: true }, categories);
    if (!tags) return [];
    return [{ ...tags, description: String(raw.description ?? "").slice(0, 240), partial: raw.visible === "part" }];
  });
  return { hasPerson: !!data.has_person, items: items.slice(0, 6) };
}

// The AI's verdict on a whole outfit: each piece as a labelled JPEG.
export async function judgeWithAi(pieces: { label: string; image: string }[], wardrobe: Wardrobe): Promise<{ match: boolean; reason: string } | null> {
  if (!supabase || !(await signedIn())) return null;
  const { data, error } = await supabase.functions.invoke("tag-garment", { body: { task: "judge", pieces, wardrobe } });
  if (error || typeof data?.match !== "boolean") {
    console.warn("outfit judging failed:", error ?? data);
    return null;
  }
  const reason = String(data.reason ?? "").toUpperCase().replace(/[^A-Z0-9 '.,!?:\-+()/&]/g, "").slice(0, 44);
  return { match: data.match, reason: reason || (data.match ? "THE WHOLE LOOK GOES" : "THESE DON'T GO TOGETHER") };
}

// The tags for a cut-out, and whether they're the AI's or a guess. `hint` is
// the category the clothes model saw (e.g. "skirts"), when it found one.
export async function tagGarment(cutout: HTMLCanvasElement, jpeg: string, categories: string[], wardrobe: Wardrobe, hint?: string): Promise<{ tags: Tags; how: "ai" | "guess" }> {
  try {
    const tags = await askAi(jpeg, categories, wardrobe, hint);
    if (tags) return { tags, how: "ai" };
  } catch (e) {
    console.warn("tagging failed, guessing instead:", e);
  }
  const ctx = cutout.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, cutout.width, cutout.height);
  const guess = guessTags(data, cutout.width, cutout.height);
  if (hint && categories.includes(hint)) Object.assign(guess, { category: hint, name: defaultName(guess.colors, hint, cutout.height / cutout.width) });
  return { tags: guess, how: "guess" };
}

// --- the fallback guess, from the pixels alone ---

// Reference shades for each color name, including dark ones (a dim photo
// of olive shorts is far darker than "olive" itself). Matched in Lab color
// space, which judges color differences roughly the way eyes do.
const NAMED: [string, number, number, number][] = [
  ["white", 244, 244, 244], ["cream", 238, 228, 204], ["beige", 210, 192, 160], ["beige", 180, 160, 125],
  ["black", 22, 22, 26], ["black", 45, 45, 48],
  ["navy", 32, 42, 76], ["navy", 22, 28, 52], ["brown", 112, 72, 44], ["brown", 70, 46, 30],
  ["gray", 150, 150, 156], ["gray", 95, 95, 100], ["denim", 104, 132, 180], ["denim", 60, 80, 120],
  ["gold", 214, 168, 60], ["pink", 238, 136, 180], ["babypink", 244, 202, 212], ["red", 190, 32, 42],
  ["burgundy", 104, 26, 40], ["burgundy", 70, 20, 32], ["yellow", 232, 190, 30], ["orange", 216, 104, 32],
  ["green", 56, 124, 72], ["green", 30, 70, 42], ["olive", 108, 112, 66], ["olive", 70, 72, 46], ["olive", 50, 52, 36],
  ["blue", 64, 108, 204], ["lavender", 196, 176, 238], ["purple", 108, 60, 150],
];

function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const NAMED_LAB = NAMED.map(([name, r, g, b]) => [name, ...lab(r, g, b)] as const);

const DARK_SHADES = new Set(["olive", "navy", "brown", "burgundy", "green", "gray", "denim", "purple"]);

export function nearestColor(r: number, g: number, b: number): string {
  const [L, A, B] = lab(r, g, b);
  let best = NAMED[0][0];
  let bestD = Infinity;
  // hue counts for more than lightness: a shadowed olive is still olive
  for (const [name, nl, na, nb] of NAMED_LAB) {
    const d = ((L - nl) * 0.5) ** 2 + (A - na) ** 2 + (B - nb) ** 2;
    if (d < bestD) [best, bestD] = [name, d];
  }
  return best;
}

// Dominant colors, a pattern guess from how busy the pixels are, and a
// category guess from the shape: tall is a bottom, wide is shoes.
export function guessTags(d: Uint8ClampedArray, w: number, h: number): Tags {
  const counts = new Map<string, number>();
  let solid = 0;
  let edges = 0;
  let pairs = 0;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      solid++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const name = nearestColor(d[i], d[i + 1], d[i + 2]);
      counts.set(name, (counts.get(name) ?? 0) + 1);
      // how often neighbouring pixels (2 apart, across and down) differ a lot
      for (const j of [i + 8, i + w * 8]) {
        if ((j === i + 8 && x + 2 >= w) || (j !== i + 8 && y + 2 >= h) || d[j + 3] < 128) continue;
        pairs++;
        if (Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) > 90) edges++;
      }
    }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  let colors = ranked.filter(([, n], i) => i === 0 || n / Math.max(1, solid) >= 0.18).slice(0, 2).map(([c]) => c);
  // shadows on a dark garment read as black: don't count them as a color
  if (colors[1] === "black" && DARK_SHADES.has(colors[0])) colors = colors.slice(0, 1);
  const busy = pairs ? edges / pairs : 0;
  const pattern: Pattern = busy > 0.06 ? "print" : "solid";
  const bw = Math.max(1, x1 - x0 + 1);
  const bh = Math.max(1, y1 - y0 + 1);
  const category = bh / bw > 1.5 ? "bottoms" : bw / bh > 1.6 ? "shoes" : "tops";
  return { category, name: defaultName(colors, category, bh / bw), colors: colors.length ? colors : ["black"], pattern, styles: [], isClothing: true };
}

// A finished garment from a cut-out and its tags.
export function garmentFrom(id: string, image: string, tags: Tags): Garment {
  return { id, category: tags.category, slot: slotFor(tags.category), name: tags.name, image, colors: tags.colors, pattern: tags.pattern, styles: tags.styles };
}
