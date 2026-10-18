import { familiesOf, stylesOf } from "../style/styles";
import type { Garment, Verdict } from "./types";

// Colors sort into light neutrals, dark neutrals, metals (go with anything)
// and accent hues. Shades of one hue count as the same accent.
const LIGHT = new Set(["white", "cream", "beige"]);
const DARK = new Set(["black", "navy", "brown", "gray", "denim"]);
const METAL = new Set(["gold", "silver"]);
const HUE: Record<string, string> = {
  pink: "pink", babypink: "pink",
  red: "red", burgundy: "red",
  yellow: "yellow",
  green: "green", olive: "green",
  blue: "blue",
  lavender: "purple", purple: "purple",
};

// Warm and cool colors don't mix between a top and a bottom (a navy sweater
// with a brown skirt). Black, white, gray, denim, cream and beige go either way.
const COOL = new Set(["navy", "blue", "lavender", "purple", "pink", "babypink", "green", "silver"]);
const WARM = new Set(["brown", "burgundy", "red", "yellow", "olive", "orange", "gold"]);
const temperature = (g: Garment) => {
  const cool = g.colors.some((c) => COOL.has(c));
  const warm = g.colors.some((c) => WARM.has(c));
  return cool && !warm ? "cool" : warm && !cool ? "warm" : null; // null: neutral or already mixed
};

const accents = (g: Garment) => new Set(g.colors.map((c) => HUE[c]).filter(Boolean));
const isBusy = (g: Garment) => g.pattern !== "solid";
const onlyIn = (g: Garment, group: Set<string>) => g.colors.length > 0 && g.colors.every((c) => group.has(c) || METAL.has(c));
const sharesFamily = (a: Garment, b: Garment) => {
  const fa = familiesOf(stylesOf(a));
  return familiesOf(stylesOf(b)).some((f) => fa.includes(f));
};
const short = (g: Garment) => g.name.toUpperCase();

// Decides whether a top and bottom go together: one pattern at most, a shared
// style family, no warm/cool mix, and accent colors that agree. Simple and
// deterministic; the reason is shown under MIS-MATCH!.
export function judge(top: Garment, bottom: Garment): Verdict {
  if (top.set && top.set === bottom.set) return { match: true, reason: "same set" };
  if (isBusy(top) && isBusy(bottom)) return { match: false, reason: "TWO PATTERNS FIGHTING" };
  if (!sharesFamily(top, bottom)) return { match: false, reason: "THE TOP AND BOTTOM ARE DIFFERENT STYLES" };
  const tt = temperature(top);
  const bt = temperature(bottom);
  if (tt && bt && tt !== bt) return { match: false, reason: "WARM AND COOL COLORS CLASH" };
  // two accent colors only work if they share a hue
  const ta = accents(top);
  const ba = accents(bottom);
  if (ta.size && ba.size && ![...ta].some((h) => ba.has(h))) return { match: false, reason: "THE TOP AND BOTTOM COLORS CLASH" };
  return { match: true, reason: "top and bottom go" };
}

// The whole look: top, bottom and every accessory. The top and bottom must
// pass judge(), and black tights need an all-dark or all-white/cream outfit. Accessory problems are only "strikes", and it takes two to
// make a MIS-MATCH! (one odd bag is a choice; an odd bag and an odd scarf is
// a mess). Strikes:
// - an accessory from a different style family (plain, neutral shoes are
//   exempt; most people own only a few pairs)
// - an accessory whose accent color isn't in the top or bottom
// - a dark scarf, bag or jewelry on an all-light outfit
// - more than one patterned piece among top, bottom, scarf and bag
// - more than two accent hues in the whole look
export const STRIKES_FOR_MISMATCH = 2;

export function judgeOutfit(top: Garment, bottom: Garment, extras: Garment[] = []): Verdict {
  const base = judge(top, bottom);
  if (!base.match) return base;
  // black tights only go with an all-dark outfit or an all-white/cream one
  const darkTights = extras.find((e) => e.category === "pantyhose" && onlyIn(e, DARK));
  if (darkTights && !(onlyIn(top, DARK) && onlyIn(bottom, DARK)) && !(onlyIn(top, LIGHT) && onlyIn(bottom, LIGHT)))
    return { match: false, reason: "BLACK TIGHTS DON'T GO WITH THIS OUTFIT", strikes: 0 };
  const sameSet = !!top.set && top.set === bottom.set;
  const outfitAccents = new Set([...accents(top), ...accents(bottom)]);
  const lightOutfit = [top, bottom].every((g) => onlyIn(g, LIGHT) || [...accents(g)].every((h) => h === "pink"));
  const strikes: string[] = [];

  for (const e of extras) {
    const plainShoes = e.category === "shoes" && onlyIn(e, new Set([...LIGHT, ...DARK]));
    if (!plainShoes && !sharesFamily(e, top) && !sharesFamily(e, bottom)) strikes.push(`THE ${short(e)} IS A DIFFERENT STYLE`);
    if ([...accents(e)].some((h) => !outfitAccents.has(h))) strikes.push(`THE ${short(e)} DOESN'T GO WITH THE COLORS`);
    const heavy = ["scarves", "bags", "jewelry"].includes(e.category) && onlyIn(e, DARK);
    if (heavy && lightOutfit) strikes.push(`THE ${short(e)} IS TOO DARK FOR THIS OUTFIT`);
  }
  const patterned = [top, bottom, ...extras.filter((e) => e.category === "scarves" || e.category === "bags")].filter(isBusy);
  if (patterned.length > (sameSet ? 2 : 1)) strikes.push("TOO MANY PATTERNS");
  const hues = new Set([...outfitAccents, ...extras.flatMap((e) => [...accents(e)])]);
  if (hues.size > 2) strikes.push("TOO MANY COLORS");

  if (strikes.length >= STRIKES_FOR_MISMATCH) return { match: false, reason: strikes[0], strikes: strikes.length };
  if (strikes.length) return { match: true, reason: `one thing's a little off: ${strikes[0].toLowerCase()}`, strikes: strikes.length };
  return { match: true, reason: extras.length ? "the whole look goes" : base.reason, strikes: 0 };
}

// Every matching (top, bottom) pair, for Auto Dress.
export function matchingPairs(tops: Garment[], bottoms: Garment[]) {
  const pairs: [number, number][] = [];
  tops.forEach((t, i) => bottoms.forEach((b, j) => judge(t, b).match && pairs.push([i, j])));
  return pairs;
}
