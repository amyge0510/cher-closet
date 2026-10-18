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

const accents = (g: Garment) => new Set(g.colors.map((c) => HUE[c]).filter(Boolean));
const isBusy = (g: Garment) => g.pattern !== "solid";
const onlyIn = (g: Garment, group: Set<string>) => g.colors.length > 0 && g.colors.every((c) => group.has(c) || METAL.has(c));
const sharesFamily = (a: Garment, b: Garment) => {
  const fa = familiesOf(stylesOf(a));
  return familiesOf(stylesOf(b)).some((f) => fa.includes(f));
};
const short = (g: Garment) => g.name.toUpperCase();

// Decides whether a top and bottom go together. Deliberately simple and
// deterministic; the reason is shown under MIS-MATCH!.
export function judge(top: Garment, bottom: Garment): Verdict {
  if (top.set && top.set === bottom.set) return { match: true, reason: "same set" };
  if (isBusy(top) && isBusy(bottom)) return { match: false, reason: "TWO PATTERNS FIGHTING" };
  if (!sharesFamily(top, bottom)) return { match: false, reason: "THE TOP AND BOTTOM ARE DIFFERENT STYLES" };
  // two accent colors only work if they share a hue
  const ta = accents(top);
  const ba = accents(bottom);
  if (ta.size && ba.size && ![...ta].some((h) => ba.has(h))) return { match: false, reason: "THE TOP AND BOTTOM COLORS CLASH" };
  return { match: true, reason: "top and bottom go" };
}

// The whole look: top, bottom and every accessory. On top of judge():
// - accessories must share a style family with the top or bottom (plain,
//   neutral shoes are exempt; most people own only a few pairs)
// - an accessory's accent color has to echo a color in the top or bottom
// - a dark scarf, bag or jewelry weighs down an all-light outfit
// - at most one patterned piece among top, bottom, scarf and bag
// - no more than two accent hues in the whole look
export function judgeOutfit(top: Garment, bottom: Garment, extras: Garment[] = []): Verdict {
  const base = judge(top, bottom);
  if (!base.match) return base;
  const sameSet = !!top.set && top.set === bottom.set;
  const outfitAccents = new Set([...accents(top), ...accents(bottom)]);
  const lightOutfit = [top, bottom].every((g) => onlyIn(g, LIGHT) || [...accents(g)].every((h) => h === "pink"));

  const patterned = [top, bottom, ...extras.filter((e) => e.category === "scarves" || e.category === "bags")].filter(isBusy);
  if (patterned.length > (sameSet ? 2 : 1)) return { match: false, reason: "TOO MANY PATTERNS" };

  for (const e of extras) {
    const plainShoes = e.category === "shoes" && onlyIn(e, new Set([...LIGHT, ...DARK]));
    if (!plainShoes && !sharesFamily(e, top) && !sharesFamily(e, bottom)) return { match: false, reason: `THE ${short(e)} IS A DIFFERENT STYLE` };
    const stray = [...accents(e)].find((h) => !outfitAccents.has(h));
    if (stray) return { match: false, reason: `THE ${short(e)} DOESN'T GO WITH THE COLORS` };
    const heavy = ["scarves", "bags", "jewelry"].includes(e.category) && onlyIn(e, DARK);
    if (heavy && lightOutfit) return { match: false, reason: `THE ${short(e)} IS TOO DARK FOR THIS OUTFIT` };
  }

  const hues = new Set([...outfitAccents, ...extras.flatMap((e) => [...accents(e)])]);
  if (hues.size > 2) return { match: false, reason: "TOO MANY COLORS" };
  return { match: true, reason: extras.length ? "the whole look goes" : base.reason };
}

// Every matching (top, bottom) pair, for Auto Dress.
export function matchingPairs(tops: Garment[], bottoms: Garment[]) {
  const pairs: [number, number][] = [];
  tops.forEach((t, i) => bottoms.forEach((b, j) => judge(t, b).match && pairs.push([i, j])));
  return pairs;
}
