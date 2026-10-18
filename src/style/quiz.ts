import { judge } from "../closet/match";
import { rng } from "../pixel/raster";
import type { Garment } from "../closet/types";
import { FAMILIES, LEAVES, PALETTES, familiesOf, leaf as leafOf, type MyStyle } from "./styles";

// The style quiz narrows in three steps, each showing four outfit boards
// built from the user's own closet:
//   1. family  (preppy / edgy / soft / easy)
//   2. specific style inside that family (e.g. goth, punk, grunge, moto)
//   3. color mood for today (dark / light / bold / earthy)
// The answer is the chosen style + palette, which Auto Dress then prefers.

export type Target = { leaves: string[]; families: string[]; colors?: string[] };

export type Box = { x: number; y: number; w: number; h: number };
export type BoardItem = { garment: Garment; box: Box };
export type Option = { id: string; label: string; bg: string; target: Target };

export type QuizState = { step: 0 | 1 | 2 | 3; family?: string; leaf?: string; palette?: string; seed: number };

export const STEP_TITLES = ["PICK A VIBE", "GET MORE SPECIFIC", "TODAY'S COLORS", "YOUR STYLE"];

export const startQuiz = (seed = 1): QuizState => ({ step: 0, seed });

export function targetFor(s: MyStyle): Target {
  return { leaves: [s.leaf], families: [s.family], colors: PALETTES.find((p) => p.id === s.palette)?.colors };
}

export function options(q: QuizState): Option[] {
  if (q.step === 0) return FAMILIES.map((f) => ({ id: f.id, label: f.label, bg: f.bg, target: { leaves: f.leaves, families: [f.id] } }));
  if (q.step === 1)
    return LEAVES.filter((l) => l.family === q.family).map((l) => ({ id: l.id, label: l.label, bg: l.bg, target: { leaves: [l.id], families: [l.family] } }));
  if (q.step === 2)
    return PALETTES.map((p) => ({ id: p.id, label: p.label, bg: p.bg, target: { leaves: [q.leaf!], families: [q.family!], colors: p.colors } }));
  return [];
}

export function choose(q: QuizState, id: string): QuizState {
  if (q.step === 0) return { ...q, step: 1, family: id };
  if (q.step === 1) return { ...q, step: 2, leaf: id };
  if (q.step === 2) return { ...q, step: 3, palette: id };
  return q;
}

export function back(q: QuizState): QuizState {
  if (q.step === 3) return { ...q, step: 2, palette: undefined };
  if (q.step === 2) return { ...q, step: 1, leaf: undefined };
  if (q.step === 1) return { ...q, step: 0, family: undefined };
  return q;
}

export function result(q: QuizState): MyStyle | null {
  return q.family && q.leaf && q.palette ? { family: q.family, leaf: q.leaf, palette: q.palette } : null;
}

// How well a garment fits a target: its specific style counts most, then its
// family, then (when a palette is in play) each of its colors in the palette.
export function fit(g: Garment, t: Target): number {
  let s = 0;
  if (g.styles.some((x) => t.leaves.includes(x))) s += 3;
  else if (familiesOf(g.styles).some((f) => t.families.includes(f))) s += 1;
  else return 0;
  if (t.colors) s += 2 * g.colors.filter((c) => t.colors!.includes(c)).length;
  return s;
}

// Where each piece sits on a board, as fractions of the board (like a flat-lay).
const SPOTS = {
  top: { x: 0.12, y: 0.1, w: 0.56, h: 0.34 },
  bottom: { x: 0.3, y: 0.43, w: 0.58, h: 0.36 },
  shoes: { x: 0.03, y: 0.78, w: 0.42, h: 0.2 },
  jewelry: { x: 0.66, y: 0.03, w: 0.32, h: 0.2 },
  bags: { x: 0.02, y: 0.47, w: 0.32, h: 0.24 },
  extra: { x: 0.68, y: 0.25, w: 0.3, h: 0.18 },
};

// Builds one outfit board for a target. `avoid` holds garment ids already used
// on the other boards of the same step, so the four boards look different.
export function buildBoard(closet: Garment[], t: Target, seed: number, avoid = new Set<string>()): BoardItem[] {
  const rand = rng(seed);
  const best = (pool: Garment[], bonus: (g: Garment) => number = () => 0) => {
    let pick: Garment | undefined;
    let top = 0;
    for (const g of pool) {
      const base = fit(g, t);
      if (!base) continue;
      const s = base + bonus(g) - (avoid.has(g.id) ? 2.5 : 0) + rand() * 1.5;
      if (s > top) [top, pick] = [s, g];
    }
    return pick;
  };
  const inCat = (...cats: string[]) => closet.filter((g) => cats.includes(g.category));

  const top = best(closet.filter((g) => g.slot === "top"));
  const bottom = best(closet.filter((g) => g.slot === "bottom"), (g) => (top && judge(top, g).match ? 3 : 0));
  const picks: [keyof typeof SPOTS, Garment | undefined][] = [
    ["top", top],
    ["bottom", bottom],
    ["shoes", best(inCat("shoes"))],
    ["jewelry", best(inCat("jewelry"))],
    ["bags", best(inCat("bags"))],
    ["extra", best(inCat("scarves", "pantyhose"))],
  ];
  const items = picks.filter(([, g]) => g).map(([spot, g]) => ({ garment: g!, box: SPOTS[spot] }));
  items.forEach((i) => avoid.add(i.garment.id));
  return items;
}

// All four boards for a step, each kept distinct from the ones before it.
export function boardsFor(closet: Garment[], q: QuizState): { option: Option; items: BoardItem[] }[] {
  const avoid = new Set<string>();
  return options(q).map((option, i) => ({ option, items: buildBoard(closet, option.target, q.seed * 97 + i * 13 + q.step, avoid) }));
}

// Auto Dress with a saved style: among matching outfits, prefer the ones that
// fit the style best, with a little randomness so it doesn't repeat.
export function rankPairs(pairs: [number, number][], tops: Garment[], bottoms: Garment[], style: MyStyle | null) {
  if (!style || !leafOf(style.leaf)) return pairs;
  const t = targetFor(style);
  const scored = pairs.map((p) => ({ p, s: fit(tops[p[0]], t) + fit(bottoms[p[1]], t) }));
  const bestScore = Math.max(...scored.map((x) => x.s));
  return scored.filter((x) => x.s >= bestScore - 2).map((x) => x.p);
}
