import { C } from "../stage/palette";
import { hexToRgb, makeCanvas, rng } from "./raster";

// Procedural seamless leopard tile, drawn at low resolution and snapped to a
// four-color palette. Replace with a hand-painted tile later if wanted.
const TILE = 96;

let cached: string | null = null;

export function leopardTile(): string {
  if (cached) return cached;
  const canvas = makeCanvas(TILE, TILE);
  const ctx = canvas.getContext("2d")!;
  const rand = rng(1995);

  ctx.fillStyle = C.leopardTan;
  ctx.fillRect(0, 0, TILE, TILE);

  // spot centers on a jittered grid so coverage is even
  const spots: { x: number; y: number; r: number; seed: number }[] = [];
  const cols = 4;
  const rows = 4;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      spots.push({
        x: ((i + (j % 2) * 0.5 + (rand() - 0.5) * 0.3) * TILE) / cols,
        y: ((j + (rand() - 0.5) * 0.3) * TILE) / rows,
        r: 9 + rand() * 2.5,
        seed: Math.floor(rand() * 1e9),
      });
    }
  }

  // draw with wrap-around copies so the tile repeats seamlessly
  const wrapped = (fn: (dx: number, dy: number) => void) => {
    for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) fn(dx, dy);
  };
  type Lobe = { x: number; y: number; rx: number; ry: number; a: number };
  const ellipse = (e: Lobe, grow: number, color: string, dx: number, dy: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(e.x + dx, e.y + dy, e.rx + grow, e.ry + grow, e.a, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const s of spots) {
    const sr = rng(s.seed);
    const squash = 0.8 + sr() * 0.35;
    const tilt = (sr() - 0.5) * 0.8;
    // a rosette: rust middle inside a broken ring of chunky dark lobes
    const middle: Lobe = { x: s.x, y: s.y, rx: s.r * 0.6, ry: s.r * 0.6 * squash, a: tilt };
    const count = 3 + Math.floor(sr() * 3);
    const lobes: Lobe[] = Array.from({ length: count }, (_, k) => {
      const ang = (k / count) * Math.PI * 2 + sr() * 0.9;
      return {
        x: s.x + Math.cos(ang) * s.r * 0.72,
        y: s.y + Math.sin(ang) * s.r * 0.72 * squash,
        rx: s.r * (0.42 + sr() * 0.18),
        ry: s.r * (0.26 + sr() * 0.12),
        a: ang + Math.PI / 2,
      };
    });
    wrapped((dx, dy) => [middle, ...lobes].forEach((e) => ellipse(e, 1.2, C.leopardCream, dx, dy)));
    wrapped((dx, dy) => ellipse(middle, 0, C.leopardRust, dx, dy));
    wrapped((dx, dy) => lobes.forEach((e) => ellipse(e, 0, C.leopardBrown, dx, dy)));
  }

  // snap anti-aliased edges to the nearest palette color
  const pal = [C.leopardTan, C.leopardCream, C.leopardBrown, C.leopardRust].map(hexToRgb);
  const img = ctx.getImageData(0, 0, TILE, TILE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let best = pal[0];
    let bestD = Infinity;
    for (const p of pal) {
      const dist = (d[i] - p[0]) ** 2 + (d[i + 1] - p[1]) ** 2 + (d[i + 2] - p[2]) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = p;
      }
    }
    d[i] = best[0];
    d[i + 1] = best[1];
    d[i + 2] = best[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL();
  return cached;
}
