// The style map the quiz narrows through: 4 families, each with 4 specific
// styles. Garments are tagged with the specific style ids.

export type Family = { id: string; label: string; bg: string; leaves: string[] };
export type Leaf = { id: string; label: string; family: string; bg: string };

export const FAMILIES: Family[] = [
  { id: "preppy", label: "PREPPY", bg: "#f3e3a6", leaves: ["clueless", "oldmoney", "tennis", "academia"] },
  { id: "edgy", label: "EDGY", bg: "#b9b3c9", leaves: ["grunge", "goth", "punk", "moto"] },
  { id: "soft", label: "SOFT", bg: "#f6c9cf", leaves: ["coquette", "ballet", "cottage", "y2k"] },
  { id: "easy", label: "EASY", bg: "#cfe3d6", leaves: ["everyday", "clean", "minimal", "athleisure", "street"] },
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
  { id: "everyday", label: "EVERYDAY", family: "easy", bg: "#dde6f2" },
  { id: "clean", label: "CLEAN GIRL", family: "easy", bg: "#efe6d8" },
  { id: "minimal", label: "MINIMALIST", family: "easy", bg: "#dcdcdc" },
  { id: "athleisure", label: "ATHLEISURE", family: "easy", bg: "#cde0ee" },
  { id: "street", label: "STREETWEAR", family: "easy", bg: "#d8d2c2" },
];

export const leaf = (id: string) => LEAVES.find((l) => l.id === id);
export const family = (id: string) => FAMILIES.find((f) => f.id === id);

// The jeans-and-a-top style most people actually wear. Pieces nobody has
// tagged yet count as everyday, so any real closet has a style to offer.
export const EVERYDAY = "everyday";
export const stylesOf = (g: { styles: string[] }) => (g.styles.length ? g.styles : [EVERYDAY]);

// Families a garment belongs to, from its specific style tags.
export function familiesOf(styles: string[]): string[] {
  return [...new Set(styles.map((s) => leaf(s)?.family ?? s))];
}

// `palette` is left over from when the quiz had a color step; it's ignored.
export type MyStyle = { family: string; leaf: string; palette?: string };
