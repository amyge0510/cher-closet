import { describe, expect, it } from "vitest";
import { DEMO_SPECS } from "./demo";
import { judge, matchingPairs } from "./match";
import type { Garment } from "./types";

const g = (id: string): Garment => {
  const { shape, fill, band, ...rest } = DEMO_SPECS.find((s) => s.id === id)!;
  return { ...rest, image: "" };
};

describe("judge", () => {
  it("matches pieces from the same set", () => {
    expect(judge(g("demo-blazer"), g("demo-yellow-mini")).match).toBe(true);
    expect(judge(g("demo-vest"), g("demo-plaid-mini")).match).toBe(true);
  });

  it("calls the film's crop jacket + black skirt a mis-match", () => {
    expect(judge(g("demo-crop-jacket"), g("demo-black-skirt"))).toEqual({ match: false, reason: "styles clash" });
  });

  it("rejects two different patterns", () => {
    expect(judge(g("demo-blazer"), g("demo-plaid-mini"))).toEqual({ match: false, reason: "two competing patterns" });
  });

  it("accepts a solid top over a neutral bottom", () => {
    expect(judge(g("demo-pink"), g("demo-white-mini")).match).toBe(true);
  });
});

describe("matchingPairs", () => {
  it("finds at least one outfit for Auto Dress in the demo closet", () => {
    const tops = DEMO_SPECS.filter((s) => s.slot === "top").map((s) => g(s.id));
    const bottoms = DEMO_SPECS.filter((s) => s.slot === "bottom").map((s) => g(s.id));
    expect(matchingPairs(tops, bottoms).length).toBeGreaterThan(2);
  });
});
