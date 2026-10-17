export type Slot = "top" | "bottom";

export type Pattern = "solid" | "plaid" | "stripe" | "print" | "knit";

export type Garment = {
  id: string;
  slot: Slot;
  name: string;
  /** transparent cut-out (URL, data URL, or signed storage URL) */
  image: string;
  colors: string[];
  pattern: Pattern;
  styles: string[];
  /** pieces made to be worn together, e.g. a suit */
  set?: string;
};

export type Verdict = { match: boolean; reason: string };
