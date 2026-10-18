import { judge } from "../closet/match";
import { rng } from "../pixel/raster";
import type { Garment } from "../closet/types";
import { FAMILIES, LEAVES, familiesOf, leaf as leafOf, type MyStyle } from "./styles";

// The style quiz narrows in two steps, each showing four outfit boards built
// from the user's own closet:
//   1. family  (preppy / edgy / soft / easy)
//   2. specific style inside that family (e.g. goth, punk, grunge, moto)
// The answer is the chosen style, which Auto Dress then prefers.

export type Target = { leaves: string[]; families: string[] };

export type Box = { x: number; y: number; w: number; h: number };
export type BoardItem = { garment: Garment; box: Box };
export type Option = { id: string; label: string; bg: string; target: Target };

// step 2 is the result screen
export type QuizState = { step: 0 | 1 | 2; family?: string; leaf?: string; seed: number };

export const STEP_TITLES = ["PICK A VIBE", "GET MORE SPECIFIC", "YOUR STYLE"];
export const QUESTIONS = 2;

export const startQuiz = (seed = 1): QuizState => ({ step: 0, seed });

export function targetFor(s: MyStyle): Target {
  return { leaves: [s.leaf], families: [s.family] };
}

export function options(q: QuizState): Option[] {
  if (q.step === 0) return FAMILIES.map((f) => ({ id: f.id, label: f.label, bg: f.bg, target: { leaves: f.leaves, families: [f.id] } }));
  if (q.step === 1)
    return LEAVES.filter((l) => l.family === q.family).map((l) => ({ id: l.id, label: l.label, bg: l.bg, target: { leaves: [l.id], families: [l.family] } }));
  return [];
}

export function choose(q: QuizState, id: string): QuizState {
  if (q.step === 0) return { ...q, step: 1, family: id };
  if (q.step === 1) return { ...q, step: 2, leaf: id };
  return q;
}

export function back(q: QuizState): QuizState {
  if (q.step === 2) return { ...q, step: 1, leaf: undefined };
  if (q.step === 1) return { ...q, step: 0, family: undefined };
  return q;
}

export function result(q: QuizState): MyStyle | null {
  return q.family && q.leaf ? { family: q.family, leaf: q.leaf } : null;
}

// How well a garment fits a target: its specific style counts most, then its
// family.
export function fit(g: Garment, t: Target): number {
  let s = 0;
  if (g.styles.some((x) => t.leaves.includes(x))) s += 3;
  else if (familiesOf(g.styles).some((f) => t.families.includes(f))) s += 1;
  else return 0;
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
// Picks the best-fitting piece from a pool, with a little randomness.
// Pieces in `avoid` lose `penalty` points, so they're only picked if nothing
// else fits.
function picker(t: Target, seed: number, avoid: Set<string>, penalty: number) {
  const rand = rng(seed);
  return (pool: Garment[], bonus: (g: Garment) => number = () => 0) => {
    let pick: Garment | undefined;
    let top = -Infinity;
    for (const g of pool) {
      const base = fit(g, t);
      if (!base) continue;
      const s = base + bonus(g) - (avoid.has(g.id) ? penalty : 0) + rand() * 1.5;
      if (s > top) [top, pick] = [s, g];
    }
    return pick;
  };
}

// The accessories that go with an outfit: shoes, jewelry, a bag, and a scarf
// or tights.
const ACCESSORY_ROLES: [keyof typeof SPOTS, string[]][] = [
  ["shoes", ["shoes"]],
  ["jewelry", ["jewelry"]],
  ["bags", ["bags"]],
  ["extra", ["scarves", "pantyhose"]],
];

function accessories(closet: Garment[], best: ReturnType<typeof picker>) {
  return ACCESSORY_ROLES.map(([spot, cats]) => [spot, best(closet.filter((g) => cats.includes(g.category)))] as const);
}

// Builds one outfit board for a target. `avoid` holds garment ids already used
// on the other boards of the same step, so the four boards look different.
export function buildBoard(closet: Garment[], t: Target, seed: number, avoid = new Set<string>()): BoardItem[] {
  const best = picker(t, seed, avoid, 2.5);
  const top = best(closet.filter((g) => g.slot === "top"));
  const bottom = best(closet.filter((g) => g.slot === "bottom"), (g) => (top && judge(top, g).match ? 3 : 0));
  const picks: (readonly [keyof typeof SPOTS, Garment | undefined])[] = [["top", top], ["bottom", bottom], ...accessories(closet, best)];
  const items = picks.filter(([, g]) => g).map(([spot, g]) => ({ garment: g!, box: SPOTS[spot] }));
  items.forEach((i) => avoid.add(i.garment.id));
  return items;
}

// Fresh accessories for Auto Dress: chosen to suit the saved style (or, with
// no style yet, the outfit itself), and different from what's being worn.
export function accessoriesFor(closet: Garment[], outfit: Garment[], style: MyStyle | null, wearing: string[], seed: number): Record<string, string> {
  const styles = outfit.flatMap((g) => g.styles);
  const t = style ? targetFor(style) : { leaves: styles, families: familiesOf(styles) };
  const best = picker(t, seed, new Set(wearing), 100);
  return Object.fromEntries(accessories(closet, best).flatMap(([, g]) => (g ? [[g.category, g.id]] : [])));
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
