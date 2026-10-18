import { describe, expect, it } from "vitest";
import { BUILT_IN, categoriesFor } from "../closet/categories";
import type { Garment } from "../closet/types";
import { clearEdgeBackground, fillSeams, keepMainBlobs } from "./cutout";
import { guessTags, nearestColor, normalizeTags, tagCategories } from "./tags";

// A w x h RGBA picture filled with `bg`, with a `fg` rectangle in it.
function picture(w: number, h: number, bg: number[], fg: number[], rect: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3];
      d.set([...(inside ? fg : bg), 255], (y * w + x) * 4);
    }
  return d;
}
const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("edge background fallback", () => {
  it("clears a plain background and keeps the garment", () => {
    const d = picture(40, 40, [235, 232, 228], [30, 40, 90], [10, 8, 20, 26]);
    const kept = clearEdgeBackground(d, 40, 40);
    expect(alphaAt(d, 40, 2, 2)).toBe(0);
    expect(alphaAt(d, 40, 20, 20)).toBe(255);
    expect(kept).toBeCloseTo((20 * 26) / 1600, 2);
  });

  it("follows a soft shadow across the background", () => {
    const w = 60;
    const d = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) d.set(x >= 20 && x < 40 && y >= 20 && y < 40 ? [160, 20, 40, 255] : [240 - x, 240 - x, 236 - x, 255], (y * w + x) * 4);
    clearEdgeBackground(d, w, w);
    expect(alphaAt(d, w, 50, 10)).toBe(0); // darker side of the shadow
    expect(alphaAt(d, w, 30, 30)).toBe(255);
  });

  it("leaves the photo alone when nothing looks like background", () => {
    const d = picture(20, 20, [10, 200, 30], [10, 200, 30], [0, 0, 20, 20]);
    clearEdgeBackground(d, 20, 20);
    expect(alphaAt(d, 20, 10, 10)).toBe(255);
  });
});

describe("keepMainBlobs", () => {
  it("keeps the garment and drops stray specks", () => {
    const w = 20;
    const m = new Uint8Array(w * w);
    for (let y = 2; y < 14; y++) for (let x = 2; x < 12; x++) m[y * w + x] = 1; // the garment
    m[18 * w + 18] = 1; // a speck
    const share = keepMainBlobs(m, w, w);
    expect(m[18 * w + 18]).toBe(0);
    expect(m[5 * w + 5]).toBe(1);
    expect(share).toBeCloseTo(120 / 121, 3);
  });

  it("closes hairline seams so a striped shirt stays one piece", () => {
    const w = 10;
    const m = new Uint8Array(w * w).fill(1);
    for (let x = 0; x < w; x++) m[5 * w + x] = 0;
    fillSeams(m, w, w);
    expect(m[5 * w + 4]).toBe(1);
  });

  it("says when what's left is scattered bits", () => {
    const w = 30;
    const m = new Uint8Array(w * w);
    for (let i = 0; i < w * w; i += 7) m[i] = 1;
    expect(keepMainBlobs(m, w, w)).toBeLessThan(0.1);
  });
});

describe("tags", () => {
  const cats = tagCategories(BUILT_IN);

  it("keeps only values the app understands", () => {
    const t = normalizeTags({ is_clothing: true, category: "tops", name: "black leather jacket!!", colors: ["black", "neon", "silver"], pattern: "zigzag", styles: ["moto", "made-up"] }, cats);
    expect(t).toEqual({ category: "tops", name: "Black Leather Jacket", colors: ["black", "silver"], pattern: "solid", styles: ["moto"], isClothing: true });
  });

  it("rejects an unknown category", () => {
    expect(normalizeTags({ category: "spaceships", name: "x", colors: [], pattern: "solid", styles: [] }, cats)).toBeNull();
    expect(cats).toEqual(expect.arrayContaining(["tops", "bottoms", "bags", "hats"]));
  });

  it("names colors from the closet's list", () => {
    expect(nearestColor(20, 22, 26)).toBe("black");
    expect(nearestColor(248, 248, 246)).toBe("white");
    expect(nearestColor(30, 44, 80)).toBe("navy");
    expect(nearestColor(108, 134, 182)).toBe("denim");
  });

  it("guesses from the pixels when Claude isn't set up", () => {
    // tall and blue on a clear background: jeans
    const d = picture(30, 60, [0, 0, 0], [104, 132, 180], [5, 2, 20, 56]);
    for (let i = 3; i < d.length; i += 4) if (d[i - 3] === 0) d[i] = 0;
    expect(guessTags(d, 30, 60)).toMatchObject({ category: "bottoms", colors: ["denim"], pattern: "solid", name: "Denim Pants" });
  });
});

describe("category bar", () => {
  const g = (category: string): Garment => ({ id: category, category, slot: null, name: "", image: "", colors: [], pattern: "solid", styles: [] });
  it("hides empty built-ins but always keeps TOPS and BOTTOMS", () => {
    const ids = categoriesFor([g("shoes"), g("hats")]).map((c) => c.id);
    expect(ids).toEqual(["tops", "bottoms", "shoes", "hats"]);
  });
});
