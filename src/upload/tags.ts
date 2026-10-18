import { slotFor, type Category } from "../closet/categories";
import type { Garment, Pattern } from "../closet/types";
import { supabase } from "../lib/supabase";
import { forWardrobe, LEAVES, type Wardrobe } from "../style/styles";

// Tagging a fresh cut-out: what it is (category), a short name, its colors,
// pattern and styles. These drive the closet tabs, MIS-MATCH! and the quiz,
// so every value has to come from the lists below.
//
// Tagging is done by Claude, through a Supabase Edge Function
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
export const tagCategories = (categories: Category[]) => [...new Set([...categories.map((c) => c.id), "shoes", "jewelry", "scarves", "pantyhose", "underwear", "sweaters", "skirts", "bags", "hats"])];

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
  pantyhose: "Tights", underwear: "Underwear", sweaters: "Sweater", bags: "Bag", hats: "Hat",
};
const defaultName = (colors: string[], category: string) =>
  `${titleCase(colors[0] === "babypink" ? "pink" : colors[0] ?? "")} ${SINGULAR[category] ?? titleCase(category)}`.trim();

// Asks Claude (via the Edge Function) to tag the cut-out. `jpeg` is base64.
async function askClaude(jpeg: string, categories: string[], wardrobe: Wardrobe): Promise<Tags | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null; // the function only answers signed-in users
  const styles = LEAVES.filter((l) => forWardrobe(l, wardrobe)).map((l) => ({ id: l.id, label: l.label }));
  const { data, error } = await supabase.functions.invoke("tag-garment", {
    body: { image: jpeg, categories, colors: COLORS, patterns: PATTERNS, styles, wardrobe },
  });
  if (error) {
    console.warn("tagging function unavailable, guessing instead:", error);
    return null;
  }
  return normalizeTags(data, categories);
}

// The tags for a cut-out, and whether they're Claude's or a guess.
export async function tagGarment(cutout: HTMLCanvasElement, jpeg: string, categories: string[], wardrobe: Wardrobe): Promise<{ tags: Tags; how: "claude" | "guess" }> {
  try {
    const tags = await askClaude(jpeg, categories, wardrobe);
    if (tags) return { tags, how: "claude" };
  } catch (e) {
    console.warn("tagging failed, guessing instead:", e);
  }
  const ctx = cutout.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, cutout.width, cutout.height);
  return { tags: guessTags(data, cutout.width, cutout.height), how: "guess" };
}

// --- the fallback guess, from the pixels alone ---

const NAMED: [string, number, number, number][] = [
  ["white", 244, 244, 244], ["cream", 238, 228, 204], ["beige", 210, 192, 160], ["black", 26, 26, 30],
  ["navy", 32, 42, 76], ["brown", 112, 72, 44], ["gray", 150, 150, 156], ["denim", 104, 132, 180],
  ["gold", 214, 168, 60], ["pink", 238, 136, 180], ["babypink", 244, 202, 212], ["red", 190, 32, 42],
  ["burgundy", 104, 26, 40], ["yellow", 232, 190, 30], ["orange", 216, 104, 32], ["green", 56, 124, 72],
  ["olive", 108, 112, 66], ["blue", 64, 108, 204], ["lavender", 196, 176, 238], ["purple", 108, 60, 150],
];

export function nearestColor(r: number, g: number, b: number): string {
  let best = NAMED[0][0];
  let bestD = Infinity;
  for (const [name, nr, ng, nb] of NAMED) {
    const d = (r - nr) ** 2 * 0.3 + (g - ng) ** 2 * 0.59 + (b - nb) ** 2 * 0.11;
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
  const colors = ranked.filter(([, n], i) => i === 0 || n / Math.max(1, solid) >= 0.18).slice(0, 2).map(([c]) => c);
  const busy = pairs ? edges / pairs : 0;
  const pattern: Pattern = busy > 0.06 ? "print" : "solid";
  const bw = Math.max(1, x1 - x0 + 1);
  const bh = Math.max(1, y1 - y0 + 1);
  const category = bh / bw > 1.5 ? "bottoms" : bw / bh > 1.6 ? "shoes" : "tops";
  return { category, name: defaultName(colors, category), colors: colors.length ? colors : ["black"], pattern, styles: [], isClothing: true };
}

// A finished garment from a cut-out and its tags.
export function garmentFrom(id: string, image: string, tags: Tags): Garment {
  return { id, category: tags.category, slot: slotFor(tags.category), name: tags.name, image, colors: tags.colors, pattern: tags.pattern, styles: tags.styles };
}
