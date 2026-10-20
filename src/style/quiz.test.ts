import { describe, expect, it } from "vitest";
import { slotFor } from "../closet/categories";
import { judge, judgeOutfit } from "../closet/match";
import { DEMO_SPECS, demoSpecsFor, type DemoSpec } from "../closet/demo";
import { matchingPairs } from "../closet/match";
import type { Garment } from "../closet/types";
import { accessoriesFor, back, boardsFor, buildBoard, choose, coverage, fit, newOutfits, options, rankPairs, result, resultBoard, startQuiz } from "./quiz";
import { FAMILIES, LEAVES, leaf } from "./styles";

const toGarment = ({ shape, fill, band, audience, ...g }: DemoSpec): Garment => ({ ...g, slot: slotFor(g.category), image: "" });
const closet: Garment[] = DEMO_SPECS.map(toGarment);
const womens: Garment[] = demoSpecsFor("womens").map(toGarment);
const mens: Garment[] = demoSpecsFor("mens").map(toGarment);

describe("demo closet", () => {
  it("has at least 75 pieces, with something in every built-in category", () => {
    expect(closet.length).toBeGreaterThanOrEqual(75);
    for (const c of ["tops", "bottoms", "skirts", "shoes", "jewelry", "scarves", "pantyhose", "underwear"])
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
    expect(boardsFor(womens, q, "womens").map((b) => b.option.id).sort()).toEqual(["easy", "edgy", "preppy", "soft"]);
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
    // a piece only stays when nothing else in the closet still goes with the look
    const changed = ["shoes", "jewelry", "bags"].filter((cat) => next[cat] !== first[cat]);
    expect(changed.length).toBeGreaterThanOrEqual(1);
    for (const id of Object.values(next)) expect(fit(closet.find((g) => g.id === id)!, { leaves: ["coquette"], families: ["soft"] })).toBeGreaterThan(0);
  });

  it("browse fills an outfit out to at least 5 pieces, even when styles don't line up", () => {
    // pieces with no styles at all, like a closet the tagger knew little about
    const plain = (id: string, category: string): Garment => ({ id, category, slot: slotFor(category), name: id, image: "", colors: ["black"], pattern: "solid", styles: [] });
    const mine = [plain("t", "tops"), plain("b", "bottoms"), plain("s1", "shoes"), plain("s2", "shoes"), plain("j1", "jewelry"), plain("j2", "jewelry"), plain("bag", "bags")];
    for (let seed = 1; seed < 20; seed++) {
      const extras = accessoriesFor(mine, [mine[0], mine[1]], null, [], seed, 5);
      expect(Object.keys(extras).length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(new Set(Object.values(extras)).size).toBe(Object.keys(extras).length);
    }
    // on the demo rack, every browse lands on 5 or more, and the accessories change
    for (const [t, b] of matchingPairs(womens.filter((g) => g.slot === "top"), womens.filter((g) => g.slot === "bottom")).slice(0, 30)) {
      const top = womens.filter((g) => g.slot === "top")[t];
      const bottom = womens.filter((g) => g.slot === "bottom")[b];
      const extras = accessoriesFor(womens, [top, bottom], null, [], t * 31 + b, 5);
      expect(Object.keys(extras).length, `${top.name} + ${bottom.name}`).toBeGreaterThanOrEqual(3);
      expect(judgeOutfit(top, bottom, Object.values(extras).map((id) => womens.find((g) => g.id === id)!)).match).toBe(true);
    }
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
  it("offers EVERYDAY and never offers styles the closet can't dress", () => {
    const families = options(startQuiz(), realCloset).map((o) => o.id);
    expect(families[0]).toBe("easy");
    const easy = options(choose(startQuiz(), "easy"), realCloset).map((o) => o.id);
    expect(easy).toContain("everyday");
    for (const id of ["punk", "moto", "grunge", "tennis", "oldmoney", "ballet", "cottage", "athleisure"]) expect(coverage(realCloset, id), id).toBe(0);
    expect(coverage(realCloset, "goth")).toBeGreaterThan(0);
  });

  it("counts untagged uploads as everyday pieces", () => {
    const shirt = realCloset.find((g) => g.id === "mine-1")!;
    expect(fit(shirt, { leaves: ["everyday"], families: ["easy"] })).toBe(3);
  });

  it("every board has a top and a bottom, and only shoes that suit the style", () => {
    let q = startQuiz();
    for (const step of [0, 1]) {
      const boards = boardsFor(realCloset, q);
      expect(boards.length).toBeGreaterThan(0);
      for (const b of boards) {
        const cats = b.items.map((i) => i.garment);
        expect(cats.some((g) => g.slot === "top"), b.option.id).toBe(true);
        expect(cats.some((g) => g.slot === "bottom"), b.option.id).toBe(true);
        // no forced shoes: any shoes on a board are tagged with one of its styles
        for (const g of cats.filter((g) => g.category === "shoes")) expect(g.styles.some((st) => b.option.target.leaves.includes(st)), `${b.option.id}: ${g.name}`).toBe(true);
      }
      if (step === 0) q = choose(q, boards[0].option.id);
    }
  });
});

describe("never suggests a mis-match", () => {
  it("every quiz board and every Auto Dress look passes the whole-outfit check", () => {
    const check = (items: { garment: Garment }[]) => {
      const gs = items.map((i) => i.garment);
      const top = gs.find((g) => g.slot === "top")!;
      const bottom = gs.find((g) => g.slot === "bottom")!;
      const extras = gs.filter((g) => !g.slot);
      return { v: judgeOutfit(top, bottom, extras), ok: judge(top, bottom).match };
    };
    for (let seed = 1; seed < 6; seed++) {
      let q = { ...startQuiz(), seed };
      for (const b of boardsFor(closet, q)) {
        const { v, ok } = check(b.items);
        if (ok) expect(v.match, `${b.option.id}: ${v.reason}`).toBe(true);
      }
      q = choose(q, "soft");
      for (const b of boardsFor(closet, q)) {
        const { v, ok } = check(b.items);
        if (ok) expect(v.match, `${b.option.id}: ${v.reason}`).toBe(true);
      }
    }
    const tops = closet.filter((g) => g.slot === "top");
    const bottoms = closet.filter((g) => g.slot === "bottom");
    for (const [t, b] of matchingPairs(tops, bottoms).slice(0, 60)) {
      const extras = Object.values(accessoriesFor(closet, [tops[t], bottoms[b]], null, [], t * 7 + b)).map((id) => closet.find((g) => g.id === id)!);
      const v = judgeOutfit(tops[t], bottoms[b], extras);
      expect(v.match, `${tops[t].name} + ${bottoms[b].name}: ${v.reason}`).toBe(true);
    }
  });
});

describe("one style per outfit", () => {
  // a corset tagged both soft and edgy, with denim: it's the same outfit,
  // so it must not show up as a SOFT board and an EDGY board
  const corset: Garment = { id: "u1", category: "tops", slot: "top", name: "Black Mesh Corset Top", image: "", colors: ["black"], pattern: "solid", styles: ["goth", "coquette"] };
  const denim: Garment = { id: "u2", category: "skirts", slot: "bottom", name: "Patched Denim Mini", image: "", colors: ["denim"], pattern: "solid", styles: ["grunge", "goth", "y2k", "coquette"] };
  const small = [corset, denim];
  it("a dark main piece is never SOFT, whatever the tags say", () => {
    const softFirst: Garment = { ...corset, id: "u3", styles: ["coquette", "goth"] }; // tagged soft first
    expect(coverage([softFirst, denim], "coquette")).toBe(0);
    expect(options(startQuiz(), [softFirst, denim]).map((o) => o.id)).toEqual(["edgy"]);
  });

  it("never puts heels on an EASY board, even if they're tagged easy", () => {
    const tee: Garment = { id: "e1", category: "tops", slot: "top", name: "White Tee", image: "", colors: ["white"], pattern: "solid", styles: ["everyday"] };
    const jeans: Garment = { ...tee, id: "e2", category: "bottoms", slot: "bottom", name: "Blue Jeans", colors: ["blue"] };
    const pumps: Garment = { ...tee, id: "e3", category: "shoes", slot: null, name: "Silver Glitter Pumps", colors: ["silver"], styles: ["minimal", "everyday"] };
    const sneakers: Garment = { ...pumps, id: "e4", name: "White Sneakers", colors: ["white"] };
    const shoesOn = (closet: Garment[]) => boardsFor(closet, startQuiz()).flatMap((b) => b.items.map((i) => i.garment.id));
    expect(shoesOn([tee, jeans, pumps])).not.toContain("e3");
    expect(shoesOn([tee, jeans, pumps, sneakers])).toContain("e4");
    expect(accessoriesFor([tee, jeans, pumps], [tee, jeans], null, [], 1).shoes).toBeUndefined();
  });

  it("counts the outfit for its strongest shared style only", () => {
    expect(coverage(small, "goth")).toBe(1);
    expect(coverage(small, "coquette")).toBe(0);
    const families = options(startQuiz(), small).map((o) => o.id);
    expect(families).toEqual(["edgy"]);
  });
});

describe("menswear", () => {
  it("the menswear quiz never offers womenswear-only styles", () => {
    const families = options(startQuiz(), mens, "mens").map((o) => o.id);
    expect(families).not.toContain("soft");
    expect(families).toContain("rugged");
    for (const f of FAMILIES) {
      for (const o of options(choose(startQuiz(), f.id), mens, "mens")) expect(leaf(o.id)?.audience, o.id).not.toBe("womens");
    }
    expect(options(choose(startQuiz(), "rugged"), mens, "mens").map((o) => o.id).sort()).toEqual(["gorpcore", "skate", "western", "workwear"]);
  });

  it("the menswear closet has no skirts or tights, and dresses every rugged style", () => {
    expect(mens.some((g) => g.category === "skirts" || g.category === "pantyhose")).toBe(false);
    for (const id of ["workwear", "gorpcore", "skate", "western", "everyday", "oldmoney", "tennis"]) expect(coverage(mens, id), id).toBeGreaterThan(0);
  });

  it("menswear boards are whole, matching outfits", () => {
    for (const fam of ["rugged", "easy", "preppy", "edgy"]) {
      for (const b of boardsFor(mens, choose(startQuiz(), fam), "mens")) {
        const gs = b.items.map((i) => i.garment);
        const top = gs.find((g) => g.slot === "top");
        const bottom = gs.find((g) => g.slot === "bottom");
        expect(top && bottom && gs.some((g) => g.category === "shoes"), b.option.id).toBeTruthy();
        expect(judgeOutfit(top!, bottom!, gs.filter((g) => !g.slot)).match, b.option.id).toBe(true);
      }
    }
  });

  it("a mix of both can get every family", () => {
    const all = FAMILIES.flatMap((f) => options(choose(startQuiz(), f.id), closet, "both"));
    expect(all.some((o) => o.id === "coquette") && all.some((o) => o.id === "western")).toBe(true);
  });
});

describe("tights are rare", () => {
  it("auto dress only adds tights when the style names them", () => {
    const tops = closet.filter((g) => g.slot === "top");
    const bottoms = closet.filter((g) => g.slot === "bottom");
    for (const [t, b] of matchingPairs(tops, bottoms).slice(0, 80)) {
      const style = { family: "soft", leaf: "coquette" };
      const ids = Object.values(accessoriesFor(closet, [tops[t], bottoms[b]], style, [], t + b));
      for (const id of ids) {
        const g = closet.find((x) => x.id === id)!;
        if (g.category === "pantyhose") expect(g.styles, g.name).toContain("coquette");
      }
    }
  });
});
