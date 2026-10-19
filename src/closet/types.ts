// Where a garment goes on the outfit machine. Accessories (shoes, jewelry,
// custom categories...) live in the closet but have no carousel yet.
export type Slot = "top" | "bottom";

export type Pattern = "solid" | "plaid" | "stripe" | "print" | "knit";

export type Garment = {
  id: string;
  /** category id, e.g. "tops", "skirts", "shoes", or a user-made one */
  category: string;
  slot: Slot | null;
  name: string;
  /** transparent cut-out (URL, data URL, or signed storage URL) */
  image: string;
  colors: string[];
  pattern: Pattern;
  styles: string[];
  /** pieces made to be worn together, e.g. a suit */
  set?: string;
};

// `strikes` counts small accessory problems (see judgeOutfit)
export type Verdict = { match: boolean; reason: string; strikes?: number };

// A saved outfit, by garment id (accessories by category).
export type Look = { id: string; top: string; bottom: string; extras: Record<string, string> };
