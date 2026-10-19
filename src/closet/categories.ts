import type { Garment, Slot } from "./types";

export type Category = { id: string; label: string; slot: Slot | null };

// The category bar, left to right. Tops, bottoms and skirts always come first;
// whatever doesn't fit on the bar moves under MORE.
export const BUILT_IN: Category[] = [
  { id: "tops", label: "TOPS", slot: "top" },
  { id: "bottoms", label: "BOTTOMS", slot: "bottom" },
  { id: "skirts", label: "SKIRTS", slot: "bottom" },
  // a dress is a whole outfit: it rides the top carousel and needs no bottom
  { id: "dresses", label: "DRESSES", slot: "top" },
  // jackets, blazers and coats: worn open over the top (or dress), so they
  // go on like an accessory instead of riding the top carousel
  { id: "jackets", label: "JACKETS", slot: null },
  { id: "shoes", label: "SHOES", slot: null },
  { id: "jewelry", label: "JEWELRY", slot: null },
  { id: "scarves", label: "SCARVES", slot: null },
  { id: "pantyhose", label: "PANTYHOSE", slot: null },
  { id: "underwear", label: "UNDERWEAR", slot: null },
  { id: "sweaters", label: "SWEATERS", slot: "top" },
];

export const isDress = (g: { category: string } | undefined) => g?.category === "dresses";

// Jewelry layers: up to this many pieces at once (necklaces and bracelets
// together). Every other accessory is one at a time. Worn pieces are kept by
// slot key: "jewelry", then "jewelry:2", "jewelry:3"...
export const MULTI_WEAR: Record<string, number> = { jewelry: 4 };
export const categoryOfSlot = (key: string) => key.split(":")[0];
export const slotKeys = (category: string) =>
  Array.from({ length: MULTI_WEAR[category] ?? 1 }, (_, i) => (i ? `${category}:${i + 1}` : category));

// Where a piece of jewelry is worn, from its name.
export type JewelryKind = "neck" | "wrist" | "ears" | "hand";
export function jewelryKind(name: string): JewelryKind {
  const n = name.toLowerCase();
  if (/bracelet|bangle|cuff|watch|anklet|charm/.test(n)) return "wrist";
  if (/earring|hoop|stud|huggie|drop/.test(n)) return "ears";
  if (/\bring\b|rings\b|signet/.test(n)) return "hand";
  return "neck";
}

export function slotFor(categoryId: string): Slot | null {
  return BUILT_IN.find((c) => c.id === categoryId)?.slot ?? null;
}
export const isBuiltIn = (categoryId: string) => BUILT_IN.some((c) => c.id === categoryId);

// Always on the bar, even when empty, so there's somewhere for uploads to go.
const ALWAYS = new Set(["tops", "bottoms"]);

// Built-ins that have something in them (a menswear closet has no SKIRTS),
// plus any category a user invented when filing a garment.
export function categoriesFor(garments: Garment[]): Category[] {
  const used = new Set(garments.map((g) => g.category));
  const custom = new Map<string, Category>();
  for (const g of garments) {
    if (BUILT_IN.some((c) => c.id === g.category) || custom.has(g.category)) continue;
    custom.set(g.category, { id: g.category, label: g.category.toUpperCase(), slot: g.slot });
  }
  return [...BUILT_IN.filter((c) => ALWAYS.has(c.id) || used.has(c.id)), ...custom.values()];
}

// Splits categories into those that fit on the bar and those under MORE.
// `measure` returns a label's width in stage pixels.
export function splitForBar(cats: Category[], measure: (label: string) => number, start: number, end: number, gap: number) {
  const shown: { cat: Category; x: number }[] = [];
  let x = start;
  let i = 0;
  for (; i < cats.length; i++) {
    const w = measure(cats[i].label);
    if (x + w > end) break;
    shown.push({ cat: cats[i], x });
    x += w + gap;
  }
  return { shown, more: cats.slice(i) };
}
