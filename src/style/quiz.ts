import { judge, judgeOutfit } from "../closet/match";
import { rng } from "../pixel/raster";
import type { Garment } from "../closet/types";
import { EVERYDAY, FAMILIES, familiesOf, forWardrobe, leaf as leafOf, stylesOf, type MyStyle, type Wardrobe } from "./styles";

// The style quiz narrows in two steps, each showing up to four outfit boards
// built from the user's own closet:
//   1. family  (preppy / edgy / soft / easy / rugged)
//   2. specific style inside that family (e.g. goth, punk, grunge, moto)
// Only styles the closet can actually dress are offered, most outfits first,
// so a closet of jeans and tees gets EVERYDAY, not GOTH. The answer is the
// chosen style, which Auto Dress then prefers.

export type Target = { leaves: string[]; families: string[] };

export type Box = { x: number; y: number; w: number; h: number };
export type BoardItem = { garment: Garment; box: Box };
export type Option = { id: string; label: string; bg: string; target: Target };

// step 2 is the result screen; `board` is the outfit shown there, which is
// exactly the board that was picked (until NEW OUTFIT swaps it)
export type QuizState = { step: 0 | 1 | 2; family?: string; leaf?: string; seed: number; board?: BoardItem[] };

export const STEP_TITLES = ["PICK A VIBE", "GET MORE SPECIFIC", "YOUR STYLE"];
export const QUESTIONS = 2;

export const startQuiz = (seed = 1): QuizState => ({ step: 0, seed });

export function targetFor(s: MyStyle): Target {
  return { leaves: [s.leaf], families: [s.family] };
}

const MAX_OPTIONS = 4;

// How many outfits the closet can make in a style: matching top + bottom
// pairs where both pieces are tagged with exactly that style. (Counting
// looser fits made one white tee look like a whole tennis wardrobe.)
export function coverage(closet: Garment[], leafId: string): number {
  if (!leafOf(leafId)) return 0;
  const exact = (g: Garment) => stylesOf(g).includes(leafId);
  const tops = closet.filter((g) => g.slot === "top" && g.category !== "dresses" && exact(g));
  const bottoms = closet.filter((g) => g.slot === "bottom" && exact(g));
  let n = 0;
  for (const top of tops) for (const bottom of bottoms) if (judge(top, bottom).match) n++;
  return n;
}

// The choices for a step: only what this closet can dress, best-stocked first.
// `wardrobe` (womenswear / menswear / both) leaves out styles cut for the
// other side of the store, so a menswear closet never gets COQUETTE.
export function options(q: QuizState, closet: Garment[], wardrobe?: Wardrobe | null): Option[] {
  const dressable = (leaves: string[]) =>
    leaves
      .filter((id) => forWardrobe(leafOf(id)!, wardrobe))
      .map((id) => ({ id, n: coverage(closet, id) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
  if (q.step === 0)
    return FAMILIES.filter((f) => forWardrobe(f, wardrobe))
      .map((f) => ({ f, leaves: dressable(f.leaves) }))
      .filter((x) => x.leaves.length)
      .sort((a, b) => b.leaves.reduce((s, l) => s + l.n, 0) - a.leaves.reduce((s, l) => s + l.n, 0))
      .slice(0, MAX_OPTIONS)
      .map(({ f, leaves }) => ({ id: f.id, label: f.label, bg: f.bg, target: { leaves: leaves.map((l) => l.id), families: [f.id] } }));
  if (q.step === 1) {
    const leaves = dressable(FAMILIES.find((f) => f.id === q.family)?.leaves ?? []);
    // EVERYDAY always keeps a spot when the closet can dress it
    const shown = leaves.slice(0, MAX_OPTIONS);
    const everyday = leaves.find((l) => l.id === EVERYDAY);
    if (everyday && !shown.includes(everyday)) shown[MAX_OPTIONS - 1] = everyday;
    return shown
      .map(({ id }) => {
        const l = leafOf(id)!;
        return { id, label: l.label, bg: l.bg, target: { leaves: [id], families: [l.family] } };
      });
  }
  return [];
}

// `board` is the outfit that was clicked; picking the specific style keeps it.
export function choose(q: QuizState, id: string, board?: BoardItem[]): QuizState {
  if (q.step === 0) return { ...q, step: 1, family: id };
  if (q.step === 1) return { ...q, step: 2, leaf: id, board };
  return q;
}

// A different outfit for the same choices: on the question screens it rebuilds
// all four boards; on the result screen it builds a new board for the style.
export function newOutfits(q: QuizState, closet: Garment[]): QuizState {
  const seed = q.seed + 1;
  const style = result(q);
  if (q.step !== 2 || !style) return { ...q, seed };
  return { ...q, seed, board: buildBoard(closet, targetFor(style), seed * 31, new Set((q.board ?? []).map((i) => i.garment.id))) };
}

// The result screen's outfit: the picked board, or one built for a saved style.
export function resultBoard(q: QuizState, closet: Garment[]): BoardItem[] {
  const style = result(q);
  if (!style) return [];
  return q.board ?? buildBoard(closet, targetFor(style), q.seed * 31);
}

export function back(q: QuizState): QuizState {
  if (q.step === 2) return { ...q, step: 1, leaf: undefined, board: undefined };
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
  const styles = stylesOf(g);
  if (styles.some((x) => t.leaves.includes(x))) s += 3;
  else if (familiesOf(styles).some((f) => t.families.includes(f))) s += 1;
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

// Lays out any outfit (e.g. a saved look) as a flat-lay board.
export function boardFromOutfit(garments: Garment[]): BoardItem[] {
  const spotFor = (g: Garment): keyof typeof SPOTS =>
    g.slot === "top" ? "top" : g.slot === "bottom" ? "bottom" : g.category === "shoes" ? "shoes" : g.category === "jewelry" ? "jewelry" : g.category === "bags" ? "bags" : "extra";
  const used = new Set<string>();
  return garments.flatMap((g) => {
    const spot = spotFor(g);
    if (used.has(spot)) return [];
    used.add(spot);
    return [{ garment: g, box: SPOTS[spot] }];
  });
}

// Picks the best-fitting piece from a pool, with a little randomness.
// Pieces in `avoid` lose `penalty` points, so they're only picked if nothing
// else fits.
// Only pieces tagged with one of the target's own styles count (fit 3): a
// piece that's merely in the same family isn't "in" the style.
function picker(t: Target, seed: number, avoid: Set<string>, penalty: number) {
  const rand = rng(seed);
  return (pool: Garment[], bonus: (g: Garment) => number = () => 0) => {
    let pick: Garment | undefined;
    let top = -Infinity;
    for (const g of pool) {
      const base = fit(g, t);
      if (base < 3) continue;
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


// Accessories are only picked if they're tagged with the style itself and the
// whole look still passes judgeOutfit, so quiz boards and Auto Dress never
// hand you a MIS-MATCH! or force something in (no party heels on an easy
// board). Most people own only a few pairs of shoes, so shoes may repeat
// across boards (a small penalty, not a big one). When nothing in a role
// suits the style, the board simply goes without it.
// Most people don't wear tights, so they're only suggested when the style
// calls for them by name (fishnets for goth, knee socks for Clueless).
function accessories(closet: Garment[], top: Garment | undefined, bottom: Garment | undefined, t: Target, best: ReturnType<typeof picker>, bestShoes: ReturnType<typeof picker>) {
  const chosen: Garment[] = [];
  const wanted = (g: Garment) => g.category !== "pantyhose" || stylesOf(g).some((s) => t.leaves.includes(s));
  // suggestions stay spotless: no strikes at all, not just under the limit
  const goes = (g: Garment) => {
    if (!top || !bottom) return true;
    const v = judgeOutfit(top, bottom, [...chosen, g]);
    return v.match && v.strikes === 0;
  };
  return ACCESSORY_ROLES.map(([spot, cats]) => {
    const pool = closet.filter((g) => cats.includes(g.category) && wanted(g) && goes(g));
    const pick = spot !== "shoes" ? best(pool) : bestShoes(pool);
    if (pick) chosen.push(pick);
    return [spot, pick] as const;
  });
}


// Builds one outfit board for a target. `avoid` holds garment ids already used
// on the other boards of the same step, so the four boards look different.
export function buildBoard(closet: Garment[], t: Target, seed: number, avoid = new Set<string>()): BoardItem[] {
  const best = picker(t, seed, avoid, 2.5);
  const top = best(closet.filter((g) => g.slot === "top" && g.category !== "dresses"));
  const bottom = best(closet.filter((g) => g.slot === "bottom"), (g) => (top && judge(top, g).match ? 3 : 0));
  const picks: (readonly [keyof typeof SPOTS, Garment | undefined])[] = [
    ["top", top],
    ["bottom", bottom],
    ...accessories(closet, top, bottom, t, best, picker(t, seed + 1, avoid, 0.5)),
  ];
  const items = picks.filter(([, g]) => g).map(([spot, g]) => ({ garment: g!, box: SPOTS[spot] }));
  items.forEach((i) => avoid.add(i.garment.id));
  return items;
}

// Fresh accessories for Auto Dress: chosen to suit the saved style (or, with
// no style yet, the outfit itself), and different from what's being worn.
export function accessoriesFor(closet: Garment[], outfit: Garment[], style: MyStyle | null, wearing: string[], seed: number): Record<string, string> {
  const styles = outfit.flatMap(stylesOf);
  const t = style ? targetFor(style) : { leaves: styles, families: familiesOf(styles) };
  const best = picker(t, seed, new Set(wearing), 100);
  return Object.fromEntries(accessories(closet, outfit[0], outfit[1], t, best, best).flatMap(([, g]) => (g ? [[g.category, g.id]] : [])));
}

// The boards for a step, each kept distinct from the ones before it.
export function boardsFor(closet: Garment[], q: QuizState, wardrobe?: Wardrobe | null): { option: Option; items: BoardItem[] }[] {
  const avoid = new Set<string>();
  return options(q, closet, wardrobe).map((option, i) => ({ option, items: buildBoard(closet, option.target, q.seed * 97 + i * 13 + q.step, avoid) }));
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
