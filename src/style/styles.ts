// The style map the quiz narrows through: 4 families, each with 4 specific
// styles, then a color mood. Garments are tagged with the specific style ids.

export type Family = { id: string; label: string; bg: string; leaves: string[] };
export type Leaf = { id: string; label: string; family: string; bg: string };
export type Palette = { id: string; label: string; bg: string; colors: string[] };

export const FAMILIES: Family[] = [
  { id: "preppy", label: "PREPPY", bg: "#f3e3a6", leaves: ["clueless", "oldmoney", "tennis", "academia"] },
  { id: "edgy", label: "EDGY", bg: "#b9b3c9", leaves: ["grunge", "goth", "punk", "moto"] },
  { id: "soft", label: "SOFT", bg: "#f6c9cf", leaves: ["coquette", "ballet", "cottage", "y2k"] },
  { id: "easy", label: "EASY", bg: "#cfe3d6", leaves: ["clean", "minimal", "athleisure", "street"] },
];

export const LEAVES: Leaf[] = [
  { id: "clueless", label: "CLUELESS", family: "preppy", bg: "#f6dd7a" },
  { id: "oldmoney", label: "OLD MONEY", family: "preppy", bg: "#e9dfcc" },
  { id: "tennis", label: "TENNIS CLUB", family: "preppy", bg: "#d4ecd9" },
  { id: "academia", label: "DARK ACADEMIA", family: "preppy", bg: "#c9b49a" },
  { id: "grunge", label: "90S GRUNGE", family: "edgy", bg: "#b7b29c" },
  { id: "goth", label: "GOTH", family: "edgy", bg: "#a99bb8" },
  { id: "punk", label: "PUNK", family: "edgy", bg: "#e0a3a3" },
  { id: "moto", label: "MOTO", family: "edgy", bg: "#c4c8cf" },
  { id: "coquette", label: "COQUETTE", family: "soft", bg: "#f7cdd8" },
  { id: "ballet", label: "BALLETCORE", family: "soft", bg: "#f3dde3" },
  { id: "cottage", label: "COTTAGECORE", family: "soft", bg: "#dfe8c5" },
  { id: "y2k", label: "Y2K", family: "soft", bg: "#d9c9f3" },
  { id: "clean", label: "CLEAN GIRL", family: "easy", bg: "#efe6d8" },
  { id: "minimal", label: "MINIMALIST", family: "easy", bg: "#dcdcdc" },
  { id: "athleisure", label: "ATHLEISURE", family: "easy", bg: "#cde0ee" },
  { id: "street", label: "STREETWEAR", family: "easy", bg: "#d8d2c2" },
];

// The last step: what colors feel right today.
export const PALETTES: Palette[] = [
  { id: "dark", label: "DARK & MOODY", bg: "#9f97ad", colors: ["black", "navy", "burgundy", "brown", "gray", "silver"] },
  { id: "light", label: "LIGHT & AIRY", bg: "#f4f0ea", colors: ["white", "cream", "babypink", "beige", "lavender", "gold"] },
  { id: "bold", label: "BOLD COLOR", bg: "#f3b9a6", colors: ["red", "yellow", "pink", "green", "blue", "purple"] },
  { id: "earthy", label: "EARTHY", bg: "#d6c7a5", colors: ["brown", "olive", "beige", "cream", "burgundy", "denim"] },
];

export const leaf = (id: string) => LEAVES.find((l) => l.id === id);
export const family = (id: string) => FAMILIES.find((f) => f.id === id);
export const palette = (id: string) => PALETTES.find((p) => p.id === id);

// Families a garment belongs to, from its specific style tags.
export function familiesOf(styles: string[]): string[] {
  return [...new Set(styles.map((s) => leaf(s)?.family ?? s))];
}

export type MyStyle = { family: string; leaf: string; palette: string };

export function describe(s: MyStyle) {
  return `${leaf(s.leaf)?.label ?? s.leaf} / ${palette(s.palette)?.label ?? s.palette}`;
}
