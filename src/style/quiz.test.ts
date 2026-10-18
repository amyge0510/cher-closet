import { describe, expect, it } from "vitest";
import { slotFor } from "../closet/categories";
import { DEMO_SPECS } from "../closet/demo";
import { matchingPairs } from "../closet/match";
import type { Garment } from "../closet/types";
import { accessoriesFor, back, boardsFor, buildBoard, choose, coverage, fit, newOutfits, options, rankPairs, result, resultBoard, startQuiz } from "./quiz";
import { FAMILIES, LEAVES, leaf } from "./styles";

const closet: Garment[] = DEMO_SPECS.map(({ shape, fill, band, ...g }) => ({ ...g, slot: slotFor(g.category), image: "" }));

describe("demo closet", () => {
  it("has at least 75 pieces, with something in every built-in category", () => {
    expect(closet.length).toBeGreaterThanOrEqual(75);
    for (const c of ["tops", "bottoms", "skirts", "shoes", "jewelry", "scarves", "pantyhose", "underwear", "sweaters"])
      expect(closet.some((g) => g.category === c), c).toBe(true);
  });

  it("uses only known style ids and unique ids", () => {
    for (const g of closet) for (const s of g.styles) expect(leaf(s), `${g.name}: ${s}`).toBeDefined();
    expect(new Set(closet.map((g) => g.id)).size).toBe(closet.length);
  });

  it("can dress every specific style with a top, a bottom and shoes", () => {
    for (const l of LEAVES) {
      const t = { leaves: [l.id], families: [l.family] };
      for (const pick of [(g: Garment) => g.slot === "top", (g: Garment) => g.slot === "bottom", (g: Garment) => g.category === "shoes"])
        expect(closet.some((g) => pick(g) && g.styles.includes(l.id)) || closet.some((g) => pick(g) && fit(g, t) > 0), l.id).toBe(true);
    }
  });
});

describe("quiz", () => {
  it("narrows family -> specific style in two steps, and can step back", () => {
    let q = startQuiz();
    expect(boardsFor(closet, q).map((b) => b.option.id).sort()).toEqual(FAMILIES.map((f) => f.id).sort());
    q = choose(q, "edgy");
    expect(boardsFor(closet, q).map((b) => b.option.id).sort()).toEqual(["goth", "grunge", "moto", "punk"]);
    expect(options(choose(startQuiz(), "easy"), closet).map((o) => o.id)).toContain("everyday");
    q = choose(q, "goth");
    expect(result(q)).toEqual({ family: "edgy", leaf: "goth" });
    expect(boardsFor(closet, q)).toEqual([]);
    expect(back(q).step).toBe(1);
  });

  it("builds full, on-style boards that don't all repeat the same top", () => {
    const boards = boardsFor(closet, choose(startQuiz(), "preppy"));
    for (const b of boards) {
      const roles = b.items.map((i) => i.garment);
      expect(roles.some((g) => g.slot === "top")).toBe(true);
      expect(roles.some((g) => g.slot === "bottom")).toBe(true);
      expect(roles.some((g) => g.category === "shoes")).toBe(true);
      const top = roles.find((g) => g.slot === "top")!;
      expect(top.styles).toContain(b.option.id);
    }
    const tops = boards.map((b) => b.items[0].garment.id);
    expect(new Set(tops).size).toBeGreaterThan(2);
  });

  it("result boards stay on style instead of chasing colors", () => {
    const board = boardsFor(closet, choose(choose(startQuiz(), "soft"), "coquette"));
    expect(board).toEqual([]);
    const items = buildBoard(closet, { leaves: ["coquette"], families: ["soft"] }, 7);
    for (const { garment } of items) expect(fit(garment, { leaves: ["coquette"], families: ["soft"] })).toBeGreaterThan(0);
  });

  it("auto dress favours the saved style", () => {
    const tops = closet.filter((g) => g.slot === "top");
    const bottoms = closet.filter((g) => g.slot === "bottom");
    const ranked = rankPairs(matchingPairs(tops, bottoms), tops, bottoms, { family: "edgy", leaf: "goth" });
    expect(ranked.length).toBeGreaterThan(0);
    for (const [t, b] of ranked) expect([...tops[t].styles, ...bottoms[b].styles].some((s) => leaf(s)?.family === "edgy")).toBe(true);
  });

  it("auto dress swaps every accessory for a new one that suits the style", () => {
    const style = { family: "soft", leaf: "coquette" };
    const outfit = [closet.find((g) => g.id === "demo-pink")!, closet.find((g) => g.id === "demo-white-mini")!];
    const first = accessoriesFor(closet, outfit, style, [], 1);
    expect(Object.keys(first).sort()).toEqual(expect.arrayContaining(["bags", "jewelry", "shoes"]));
    const next = accessoriesFor(closet, outfit, style, Object.values(first), 2);
    for (const cat of ["shoes", "jewelry", "bags"]) expect(next[cat], cat).not.toBe(first[cat]);
    for (const id of Object.values(next)) expect(fit(closet.find((g) => g.id === id)!, { leaves: ["coquette"], families: ["soft"] })).toBeGreaterThan(0);
  });

  it("only ever shows pieces from the closet it was given", () => {
    const small = closet.filter((_, i) => i % 3 === 0); // a smaller, different closet
    const ids = new Set(small.map((g) => g.id));
    let q = startQuiz();
    for (const b of boardsFor(small, q)) for (const i of b.items) expect(ids.has(i.garment.id)).toBe(true);
    q = choose(q, "soft");
    const boards = boardsFor(small, q);
    for (const b of boards) for (const i of b.items) expect(ids.has(i.garment.id)).toBe(true);
    q = choose(q, boards[0].option.id, boards[0].items);
    for (const i of resultBoard(newOutfits(q, small), small)) expect(ids.has(i.garment.id)).toBe(true);
  });

  it("the result is exactly the board that was picked", () => {
    let q = choose(startQuiz(), "soft");
    const picked = boardsFor(closet, q)[0];
    q = choose(q, picked.option.id, picked.items);
    expect(resultBoard(q, closet)).toBe(picked.items);
    const next = resultBoard(newOutfits(q, closet), closet);
    expect(next.map((i) => i.garment.id)).not.toEqual(picked.items.map((i) => i.garment.id));
  });
});

// A realistic closet: mostly basics, a couple of statement pieces, few shoes.
const byName = (...names: string[]) => names.map((n) => closet.find((g) => g.name === n)!);
const realCloset: Garment[] = [
  ...byName("White Baby Tee", "Beige Ribbed Tank", "Gray Crewneck", "Light Wash Jeans", "Black Wide-Leg Trousers", "Denim Mini"),
  ...byName("Black Lace Corset", "Black Maxi Skirt"), // one goth-ish outfit
  ...byName("White Sneakers", "Combat Boots"), // only two pairs of shoes
  // something uploaded but not tagged yet
  { id: "mine-1", category: "tops", slot: "top", name: "Striped Shirt", image: "", colors: ["navy", "white"], pattern: "stripe", styles: [] },
];

describe("quiz on a real, mostly-basic closet", () => {
  it("leads with EVERYDAY and never offers styles the closet can't dress", () => {
    const families = options(startQuiz(), realCloset).map((o) => o.id);
    expect(families[0]).toBe("easy");
    const easy = options(choose(startQuiz(), "easy"), realCloset).map((o) => o.id);
    expect(easy[0]).toBe("everyday");
    for (const id of ["punk", "moto", "grunge", "tennis", "oldmoney", "ballet", "cottage", "athleisure"]) expect(coverage(realCloset, id), id).toBe(0);
    expect(coverage(realCloset, "goth")).toBeGreaterThan(0);
  });

  it("counts untagged uploads as everyday pieces", () => {
    const shirt = realCloset.find((g) => g.id === "mine-1")!;
    expect(fit(shirt, { leaves: ["everyday"], families: ["easy"] })).toBe(3);
  });

  it("every board is a full outfit, re-using the two pairs of shoes", () => {
    let q = startQuiz();
    for (const step of [0, 1]) {
      const boards = boardsFor(realCloset, q);
      expect(boards.length).toBeGreaterThan(0);
      for (const b of boards) {
        const cats = b.items.map((i) => i.garment);
        expect(cats.some((g) => g.slot === "top"), b.option.id).toBe(true);
        expect(cats.some((g) => g.slot === "bottom"), b.option.id).toBe(true);
        expect(cats.some((g) => g.category === "shoes"), b.option.id).toBe(true);
      }
      if (step === 0) q = choose(q, boards[0].option.id);
    }
  });
});
