import { describe, expect, it } from "vitest";
import { DEMO_SPECS } from "./demo";
import { slotFor } from "./categories";
import { judge, judgeOutfit, matchingPairs } from "./match";
import type { Garment } from "./types";

const g = (id: string): Garment => {
  const { shape, fill, band, ...rest } = DEMO_SPECS.find((s) => s.id === id)!;
  return { ...rest, slot: slotFor(rest.category), image: "" };
};

describe("judge", () => {
  it("matches pieces from the same set", () => {
    expect(judge(g("demo-blazer"), g("demo-yellow-mini")).match).toBe(true);
    expect(judge(g("demo-vest"), g("demo-plaid-mini")).match).toBe(true);
  });

  it("calls the film's crop jacket + black skirt a mis-match", () => {
    expect(judge(g("demo-crop-jacket"), g("demo-black-skirt"))).toEqual({ match: false, reason: "THE TOP AND BOTTOM ARE DIFFERENT STYLES" });
  });

  it("rejects two different patterns", () => {
    expect(judge(g("demo-blazer"), g("demo-plaid-mini"))).toEqual({ match: false, reason: "TWO PATTERNS FIGHTING" });
  });

  it("accepts a solid top over a neutral bottom", () => {
    expect(judge(g("demo-pink"), g("demo-white-mini")).match).toBe(true);
  });
});

describe("matchingPairs", () => {
  it("finds at least one outfit for Auto Dress in the demo closet", () => {
    const tops = DEMO_SPECS.filter((s) => slotFor(s.category) === "top").map((s) => g(s.id));
    const bottoms = DEMO_SPECS.filter((s) => slotFor(s.category) === "bottom").map((s) => g(s.id));
    expect(matchingPairs(tops, bottoms).length).toBeGreaterThan(2);
  });
});

const n = (name: string) => g(`demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);

describe("warm and cool colors", () => {
  it("a navy sweater doesn't go with a brown or burgundy skirt", () => {
    expect(judge(n("Navy Quarter Zip"), n("Brown Plaid Midi"))).toEqual({ match: false, reason: "WARM AND COOL COLORS CLASH" });
    expect(judge(n("Navy Quarter Zip"), g("demo-plaid-mini")).match).toBe(false);
  });

  it("neutrals still go either way", () => {
    expect(judge(n("Navy Quarter Zip"), n("White Tennis Skirt")).match).toBe(true);
    expect(judge(n("White Button-Up"), n("Brown Plaid Midi")).match).toBe(true);
  });
});

describe("judgeOutfit (accessories count too)", () => {
  const tee = g("demo-tee");
  const whiteMini = g("demo-white-mini");

  it("one odd accessory is a choice, not a mis-match", () => {
    expect(judgeOutfit(tee, whiteMini, [n("Pink Bow Bag")]).match).toBe(true);
    expect(judgeOutfit(tee, whiteMini, [n("Black Velvet Scarf")]).match).toBe(true);
    expect(judgeOutfit(g("demo-blazer"), g("demo-yellow-mini"), [n("Spiked Choker")]).match).toBe(true);
  });

  it("a white outfit with a pink handbag and a black scarf is a mis-match", () => {
    expect(judgeOutfit(tee, whiteMini, [n("Pink Bow Bag"), n("Black Velvet Scarf")])).toMatchObject({ match: false, reason: "THE PINK BOW BAG DOESN'T GO WITH THE COLORS" });
  });

  it("but the same pink bag works once pink is in the outfit", () => {
    expect(judgeOutfit(g("demo-pink"), whiteMini, [n("Pink Bow Bag"), n("White Sneakers")])).toMatchObject({ match: true, reason: "the whole look goes" });
  });

  it("plain shoes go with anything, even off-style", () => {
    expect(judgeOutfit(n("Black Lace Corset"), n("Black Maxi Skirt"), [n("White Sneakers")]).reason).toBe("the whole look goes");
  });

  it("a clash between top and bottom is still a mis-match on its own", () => {
    expect(judgeOutfit(n("Navy Quarter Zip"), n("Brown Plaid Midi"), [n("White Sneakers")]).match).toBe(false);
  });

  it("a patterned scarf plus a clashing-color bag adds up", () => {
    const v = judgeOutfit(n("Faded Band Tee"), n("Red Tartan Mini"), [n("Plaid Blanket Scarf"), n("Pink Bow Bag")]);
    expect(v.match).toBe(false);
  });
});
