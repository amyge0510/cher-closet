import { describe, expect, it } from "vitest";
import { anchorsFromParts } from "./bodyPhoto";
import { PLACEHOLDER_ANCHORS } from "./body";

const W = 100, H = 200;
const part = (label: string, x0: number, y0: number, x1: number, y1: number) => {
  const data = new Uint8Array(W * H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * W + x] = 255;
  return { label, mask: { data, width: W, height: H } };
};

describe("anchorsFromParts", () => {
  const frame = { x: 0, y: 0, w: W, h: H };
  it("puts the top on the tank and the bottom on the shorts", () => {
    const a = anchorsFromParts([part("Face", 40, 10, 60, 30), part("Upper-clothes", 35, 40, 65, 90), part("Pants", 34, 90, 66, 120), part("Left-leg", 36, 110, 49, 195), part("Right-leg", 51, 110, 64, 195)], W, H, frame);
    expect(a.top.y).toBeCloseTo(0.18, 2);
    expect(a.top.x).toBeLessThan(0.35); // wider than the tank, out to the shoulders
    expect(a.top.x + a.top.w).toBeGreaterThan(0.65);
    expect(a.bottom.y).toBeCloseTo(0.44, 2);
    expect(a.bottom.y + a.bottom.h).toBeGreaterThan(0.97); // room for full-length pants
    expect(a.extras.shoes.y).toBeGreaterThan(0.9);
    expect(a.extras.hats.y).toBeLessThan(0.05);
  });

  it("falls back to the stand-in's spots when nothing is labelled", () => {
    expect(anchorsFromParts([], W, H, frame)).toEqual(PLACEHOLDER_ANCHORS);
  });
});
