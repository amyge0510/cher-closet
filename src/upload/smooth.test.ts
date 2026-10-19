import { describe, expect, it } from "vitest";
import { keyOut, smoothEdges } from "./smooth";

const W = 40;
// a white square garment on a clear background
function garment() {
  const d = new Uint8ClampedArray(W * W * 4);
  for (let y = 8; y < 32; y++) for (let x = 8; x < 32; x++) d.set([245, 245, 245, 255], (y * W + x) * 4);
  return d;
}
const a = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4 + 3];

describe("smoothEdges", () => {
  it("clears bits of background color stuck to the edge", () => {
    const d = garment();
    for (let y = 14; y < 18; y++) for (let x = 32; x < 35; x++) d.set([40, 120, 40, 255], (y * W + x) * 4); // hedge
    smoothEdges(d, W, W);
    expect(a(d, 33, 15)).toBeLessThan(80);
    expect(a(d, 20, 20)).toBe(255);
  });

  it("fills a small nick in the edge with the garment's color", () => {
    const d = garment();
    d[(8 * W + 20) * 4 + 3] = 0;
    d[(9 * W + 20) * 4 + 3] = 0;
    smoothEdges(d, W, W);
    expect(a(d, 20, 9)).toBeGreaterThan(200);
    expect(d[(9 * W + 20) * 4]).toBeGreaterThan(200);
  });

  it("softens the edge instead of a hard step", () => {
    const d = garment();
    smoothEdges(d, W, W);
    const edge = a(d, 8, 20);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });
});

describe("keyOut", () => {
  it("removes a chroma-green background and its tint on the edge", () => {
    const d = new Uint8ClampedArray(4 * 4);
    d.set([10, 250, 20, 255], 0); // background
    d.set([200, 230, 200, 255], 4); // garment pixel tinted green
    d.set([200, 200, 200, 255], 8);
    d.set([200, 200, 200, 255], 12);
    keyOut(d, 4, 1, "green");
    expect(d[3]).toBe(0);
    expect(d[5]).toBe(200);
  });
});
