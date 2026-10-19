import { describe, expect, it } from "vitest";
import { coverage } from "./gemini";

const W = 100;
const shape = (fill: (x: number, y: number) => boolean) => {
  const d = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (fill(x, y)) d[(y * W + x) * 4 + 3] = 255;
  return d;
};

describe("redraw quality", () => {
  it("a whole pair of jeans scores well", () => {
    const jeans = shape((x, y) => y > 10 && y < 90 && ((x > 25 && x < 48) || (x > 52 && x < 75) || (y < 35 && x > 25 && x < 75)));
    expect(coverage(jeans, W, W)).toBeGreaterThan(0.03);
  });

  it("jeans with the legs missing (just a waistband and a strip) score badly", () => {
    const broken = shape((x, y) => (y > 10 && y < 18 && x > 25 && x < 75) || (x > 48 && x < 51 && y < 50));
    expect(coverage(broken, W, W)).toBeLessThan(0.03);
  });
});
