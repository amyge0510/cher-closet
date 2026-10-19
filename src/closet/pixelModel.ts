import { makeCanvas } from "../pixel/raster";
import { jewelryKind } from "./categories";
import { DEMO_SPECS, type DemoSpec, type Fill, type Shape } from "./demo";
import type { Figure } from "./body";
import type { Garment } from "./types";

// The pixel model: when the closet is on PIXEL, the dressed-up screen shows a
// pixel-art girl (or guy, for menswear) instead of a photo, and each pixel
// garment is drawn onto that body. A garment isn't a picture laid on top: it
// is cut from the figure's own torso, arms and legs (a tee is the torso plus
// the tops of the arms, jeans are the legs from the waist down, a skirt flares
// out from the hips), so the same piece fits either figure.

export const GRID_W = 64;
export const GRID_H = 128;

type Mask = Uint8Array; // 1 where covered, GRID_W x GRID_H
type Pt = [number, number];

const idx = (x: number, y: number) => y * GRID_W + x;

// Shapes are drawn with the canvas, then snapped to whole pixels.
function shape(draw: (ctx: CanvasRenderingContext2D) => void): Mask {
  const c = makeCanvas(GRID_W, GRID_H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx);
  const d = ctx.getImageData(0, 0, GRID_W, GRID_H).data;
  const m = new Uint8Array(GRID_W * GRID_H);
  for (let p = 0; p < m.length; p++) m[p] = d[p * 4 + 3] >= 110 ? 1 : 0;
  return m;
}
const poly = (pts: Pt[]) => shape((ctx) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
});
const line = (pts: Pt[], width: number) => shape((ctx) => {
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
});
const ellipse = (cx: number, cy: number, rx: number, ry: number) => shape((ctx) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
});
const rect = (x0: number, y0: number, x1: number, y1: number): Mask => {
  const m = new Uint8Array(GRID_W * GRID_H);
  for (let y = Math.max(0, y0); y <= Math.min(GRID_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(GRID_W - 1, x1); x++) m[idx(x, y)] = 1;
  return m;
};
const or = (...ms: Mask[]): Mask => {
  const m = new Uint8Array(GRID_W * GRID_H);
  for (const a of ms) for (let p = 0; p < m.length; p++) m[p] |= a[p];
  return m;
};
const and = (a: Mask, b: Mask): Mask => a.map((v, p) => v & b[p]);
const minus = (a: Mask, b: Mask): Mask => a.map((v, p) => (b[p] ? 0 : v));
const rows = (m: Mask, y0: number, y1: number) => and(m, rect(0, y0, GRID_W - 1, y1));
// grows a mask by `n` pixels: clothes sit a little proud of the body
function grow(m: Mask, n = 1): Mask {
  let out = m;
  for (let k = 0; k < n; k++) {
    const src = out;
    out = new Uint8Array(src.length);
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++)
        out[idx(x, y)] = src[idx(x, y)] || (x > 0 && src[idx(x - 1, y)]) || (x < GRID_W - 1 && src[idx(x + 1, y)]) || (y > 0 && src[idx(x, y - 1)]) || (y < GRID_H - 1 && src[idx(x, y + 1)]) ? 1 : 0;
  }
  return out;
}

// ---- the figures ----

type Body = { torso: Mask; armL: Mask; armR: Mask; legL: Mask; legR: Mask; neck: Mask; head: Mask; feet: Mask; hands: Mask; earL: Pt; earR: Pt; wrist: Pt; neckTop: number };

function bodyOf(figure: Figure): Body {
  const m = figure === "mens";
  const sh = m ? 2 : 0; // broader shoulders
  const torso = m
    ? poly([[19, 32], [45, 32], [44, 42], [42, 52], [42, 62], [22, 62], [22, 52], [20, 42]])
    : poly([[21, 32], [43, 32], [42, 40], [40, 50], [42, 57], [43, 62], [21, 62], [22, 57], [24, 50], [22, 40]]);
  return {
    torso,
    armL: line([[22 - sh, 34], [18 - sh, 48], [16 - sh, 63]], m ? 6 : 5),
    armR: line([[42 + sh, 34], [46 + sh, 48], [48 + sh, 63]], m ? 6 : 5),
    legL: poly([[21, 60], [32, 60], [31, 90], [30, 116], [25, 116], [23, 90]]),
    legR: poly([[32, 60], [43, 60], [41, 90], [39, 116], [34, 116], [33, 90]]),
    neck: rect(m ? 28 : 29, 25, m ? 36 : 35, 33),
    // a big head (about a quarter of the height) so the face reads
    head: ellipse(32, 16, 10.5, 12),
    feet: or(poly([[24, 116], [31, 116], [31, 121], [21, 121], [21, 119]]), poly([[33, 116], [40, 116], [43, 119], [43, 121], [33, 121]])),
    hands: or(ellipse(16 - sh, 65, 2.6, 2.8), ellipse(48 + sh, 65, 2.6, 2.8)),
    earL: [21, 18],
    earR: [43, 18],
    wrist: [16 - sh, 61],
    neckTop: 25,
  };
}

// ---- painting ----

type RGBA = Uint8ClampedArray<ArrayBuffer>; // GRID_W x GRID_H x 4

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const darker = (h: string, f = 0.55): string => {
  const [r, g, b] = hex(h);
  return `#${[r, g, b].map((v) => Math.round(v * f).toString(16).padStart(2, "0")).join("")}`;
};
function set(px: RGBA, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const [r, g, b] = hex(color);
  const p = idx(x, y) * 4;
  px[p] = r;
  px[p + 1] = g;
  px[p + 2] = b;
  px[p + 3] = 255;
}
// solid color, with a one-pixel outline in a darker shade where it meets
// anything it doesn't cover
function fillMask(px: RGBA, m: Mask, color: string | ((x: number, y: number) => string), outline?: string) {
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (!m[idx(x, y)]) continue;
      const edge = outline && (x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 || !m[idx(x - 1, y)] || !m[idx(x + 1, y)] || !m[idx(x, y - 1)] || !m[idx(x, y + 1)]);
      set(px, x, y, edge ? outline! : typeof color === "string" ? color : color(x, y));
    }
}

const baseOf = (f: Fill): string => (f.kind === "split" ? baseOf(f.left) : f.base);
// a garment's pattern at pixel scale (the demo art draws them ~3x bigger)
function patternAt(f: Fill, x: number, y: number): string {
  if (f.kind === "split") return patternAt(x < GRID_W / 2 ? f.left : f.right, x, y);
  if (f.kind === "plaid") {
    const s = Math.max(3, Math.round(f.step / 3));
    if (x % s === 0 || y % s === 0) return f.lines[0];
    if ((x + Math.floor(s / 2)) % s === 0 || (y + Math.floor(s / 2)) % s === 0) return f.lines[1] ?? f.lines[0];
    return f.base;
  }
  if (f.kind === "stripe") {
    const s = Math.max(2, Math.round(f.step / 3));
    return (f.vertical ? x : y) % s === 0 ? f.line : f.base;
  }
  if (f.kind === "dots") {
    const s = Math.max(3, Math.round(f.step / 3));
    return y % s === 0 && (x + (Math.floor(y / s) % 2 ? Math.floor(s / 2) : 0)) % s === 0 ? f.dot : f.base;
  }
  if (f.kind === "knit") return (x + y) % 4 === 0 && y % 2 === 0 ? f.line : f.base;
  return f.base;
}

const SKIN = { womens: "#f1c4a6", mens: "#d9a07c" } as const;

// The figure in its underwear, with face and hair.
function drawBody(px: RGBA, figure: Figure, b: Body) {
  const skin = SKIN[figure];
  const shade = darker(skin, 0.78);
  fillMask(px, or(b.armL, b.armR, b.hands), skin, shade);
  fillMask(px, or(b.legL, b.legR), skin, shade);
  fillMask(px, or(b.torso, b.neck), skin, shade);
  fillMask(px, b.head, skin, shade);
  fillMask(px, b.feet, skin, shade);

  // underwear
  if (figure === "mens") fillMask(px, or(rows(b.torso, 56, 62), rows(or(b.legL, b.legR), 56, 70)), "#2a3a66", "#141c38");
  else {
    fillMask(px, rows(b.torso, 35, 41), "#1c1622", "#0c0a10");
    fillMask(px, or(rows(b.torso, 57, 62), rows(or(b.legL, b.legR), 60, 63)), "#1c1622", "#0c0a10");
  }

  // face: brows, eyes with a highlight, nose, mouth, cheeks
  const brow = figure === "mens" ? "#2a1a12" : "#8a5a2a";
  for (const x of [25, 26, 27, 28]) set(px, x, 13, brow);
  for (const x of [36, 37, 38, 39]) set(px, x, 13, brow);
  // eyes: three wide, with a white catchlight and (for her) a lash flick
  const iris = figure === "mens" ? "#3a2618" : "#3a5a9a";
  for (const ex of [26, 36]) {
    set(px, ex, 16, "#ffffff");
    set(px, ex + 1, 16, iris);
    set(px, ex + 2, 16, iris);
    set(px, ex, 17, iris);
    set(px, ex + 1, 17, "#1a1226");
    set(px, ex + 2, 17, iris);
    for (let x = ex; x <= ex + 2; x++) set(px, x, 15, "#1a1226");
  }
  if (figure !== "mens") {
    set(px, 25, 14, "#1a1226");
    set(px, 39, 14, "#1a1226");
  }
  set(px, 32, 20, shade);
  set(px, 31, 21, shade);
  if (figure === "mens") {
    for (const x of [30, 31, 32, 33, 34]) set(px, x, 24, "#9a5a4a");
    for (const x of [28, 36]) set(px, x, 26, shade); // jaw
  } else {
    for (const x of [30, 31, 32, 33, 34]) set(px, x, 24, "#d4485e");
    set(px, 31, 25, "#b83a50");
    set(px, 32, 25, "#b83a50");
    set(px, 33, 25, "#b83a50");
    for (const [x, y] of [[24, 21], [25, 21], [39, 21], [40, 21]] as Pt[]) set(px, x, y, "#f29a9a");
  }
  set(px, 21, 17, shade);
  set(px, 43, 17, shade);

  if (figure === "mens") {
    // a tall curly top with short faded sides
    const curls = or(ellipse(32, 8, 12, 6.5), ellipse(23, 5, 4.5, 4.5), ellipse(29, 2.5, 5, 4), ellipse(36, 2.5, 5, 4), ellipse(42, 6, 4.5, 4.5));
    fillMask(px, and(curls, rect(0, 0, GRID_W - 1, 11)), (x, y) => ((x * 3 + y * 5) % 7 < 2 ? "#5a3a24" : "#2a1a12"), "#160c08");
    fillMask(px, or(rect(21, 10, 22, 18), rect(42, 10, 43, 18)), "#3a2a20");
  } else {
    // honey-blonde with blunt bangs, face-framing pieces and two space buns
    // tied with lavender scrunchies
    const hair = "#e6b450";
    const hairShade = "#b8822c";
    const crown = and(ellipse(32, 12, 12.5, 9.5), rect(0, 0, GRID_W - 1, 12));
    const bangs = rect(23, 7, 41, 11);
    const sides = or(rect(19, 10, 22, 29), rect(42, 10, 45, 29));
    const buns = or(ellipse(20, 4, 6, 5.5), ellipse(44, 4, 6, 5.5));
    fillMask(px, or(crown, bangs, sides, buns), (x, y) => ((x + y * 2) % 6 === 0 ? hairShade : hair), "#7a5418");
    // a jagged fringe
    for (let x = 24; x <= 40; x += 2) set(px, x, 12, hair);
    for (const cx of [20, 44]) for (let x = cx - 4; x <= cx + 4; x++) for (const y of [9, 10]) set(px, x, y, "#b9a6f2");
  }
}

// ---- garments ----

const spec = new Map(DEMO_SPECS.map((s) => [s.id, s]));
export const pixelSpec = (g: Garment): DemoSpec | undefined => spec.get(g.id);

type Sleeves = "none" | "short" | "long";
const TOPS: Partial<Record<Shape, { to: number; sleeves: Sleeves; from?: number; neck?: "v" | "high" | "scoop" }>> = {
  tank: { to: 60, sleeves: "none", from: 35 },
  tee: { to: 60, sleeves: "short", neck: "scoop" },
  cropTop: { to: 48, sleeves: "short", from: 34 },
  corset: { to: 58, sleeves: "none", from: 36 },
  vest: { to: 62, sleeves: "none", neck: "v" },
  blouse: { to: 61, sleeves: "long", neck: "scoop" },
  blazer: { to: 66, sleeves: "long", neck: "v" },
  cropJacket: { to: 50, sleeves: "long", neck: "v" },
  turtleneck: { to: 62, sleeves: "long", neck: "high" },
  hoodie: { to: 66, sleeves: "long", neck: "high" },
  chore: { to: 66, sleeves: "long", neck: "v" },
  puffer: { to: 64, sleeves: "long", neck: "high" },
  bralette: { to: 42, sleeves: "none", from: 35 },
};

function topMask(b: Body, s: Shape): Mask | null {
  const t = TOPS[s];
  if (!t) return null;
  const from = t.from ?? 32;
  let m = rows(grow(b.torso), from, t.to);
  if (t.sleeves === "short") m = or(m, rows(grow(or(b.armL, b.armR)), 31, 42));
  if (t.sleeves === "long") m = or(m, rows(grow(or(b.armL, b.armR)), 31, 62));
  if (s === "puffer") m = grow(m);
  if (t.neck === "high") m = or(m, grow(rows(b.neck, 28, 33)));
  if (t.neck === "v") m = minus(m, poly([[29, 31], [35, 31], [32, s === "vest" ? 40 : 45]]));
  if (t.neck === "scoop") m = minus(m, ellipse(32, 31, 3.5, 2.5));
  if (s === "tank" || s === "corset" || s === "bralette") m = or(m, rows(grow(b.torso), 31, 35).map((v, p) => (v && (p % GRID_W === 25 || p % GRID_W === 39) ? 1 : 0)));
  return m;
}

function bottomMask(b: Body, s: Shape): Mask | null {
  const legs = or(b.legL, b.legR);
  const hips = rows(grow(or(b.torso, legs)), 56, 64);
  switch (s) {
    case "mini": return or(hips, poly([[21, 56], [43, 56], [46, 74], [18, 74]]));
    case "aline": return or(hips, poly([[22, 56], [42, 56], [48, 82], [16, 82]]));
    case "midi": return or(hips, poly([[22, 56], [42, 56], [47, 98], [17, 98]]));
    case "maxi": return or(hips, poly([[22, 56], [42, 56], [48, 116], [16, 116]]));
    case "shorts": return or(hips, rows(grow(legs), 56, 74));
    case "leggings": return or(hips, rows(legs, 56, 114));
    case "pants": return or(hips, rows(grow(legs), 56, 115));
    case "joggers": return or(hips, rows(grow(legs), 56, 113));
    case "wideLeg": return or(hips, poly([[21, 58], [32, 62], [31, 116], [18, 116]]), poly([[32, 62], [43, 58], [46, 116], [33, 116]]));
    default: return null;
  }
}

function dressMask(b: Body): Mask {
  return or(rows(grow(b.torso), 35, 58), poly([[22, 54], [42, 54], [47, 88], [17, 88]]), rows(grow(b.torso), 31, 35).map((v, p) => (v && (p % GRID_W === 25 || p % GRID_W === 39) ? 1 : 0)));
}

function shoeMask(b: Body, s: Shape): Mask {
  const legs = or(b.legL, b.legR);
  if (s === "boots") return or(grow(b.feet), rows(grow(legs), 98, 118));
  if (s === "cowboyBoots") return or(grow(b.feet), rows(grow(legs), 94, 118));
  if (s === "sneakers") return grow(rows(b.feet, 115, 121));
  return or(b.feet, rows(grow(b.feet), 119, 121));
}

// Draws one pixel garment onto the figure.
function drawGarment(px: RGBA, b: Body, g: Garment, s: DemoSpec) {
  const outline = darker(baseOf(s.fill));
  const fill = (m: Mask) => fillMask(px, m, (x, y) => patternAt(s.fill, x, y), outline);
  const legs = or(b.legL, b.legR);
  switch (g.category) {
    case "pantyhose":
      if (s.shape === "socks") return fill(rows(legs, 100, 117));
      return fillMask(px, rows(legs, 60, 117), (x, y) => (s.name.includes("Fishnet") ? ((x + y) % 2 ? "#1a1420" : SKIN.womens) : patternAt(s.fill, x, y)), outline);
    case "shoes": {
      fill(shoeMask(b, s.shape));
      if (s.shape === "sneakers") fillMask(px, rows(grow(b.feet), 121, 121), "#f4f4f4");
      if (s.shape === "heels") for (const x of [22, 42]) set(px, x, 122, outline);
      return;
    }
    case "scarves": {
      if (s.shape === "bandana") return fill(poly([[26, 29], [38, 29], [32, 37]]));
      return fill(or(rect(26, 29, 38, 33), rect(35, 33, 37, 48)));
    }
    case "jewelry": {
      const kind = jewelryKind(g.name);
      const color = baseOf(s.fill);
      if (kind === "ears") {
        for (const [ex, ey] of [b.earL, b.earR]) {
          if (s.shape === "hoops") for (const [dx, dy] of [[-1, 2], [-1, 3], [0, 4], [1, 3], [1, 2]]) set(px, ex + dx, ey + dy, color);
          else set(px, ex, ey + 2, color);
        }
        return;
      }
      if (kind === "wrist" || kind === "hand") {
        const [wx, wy] = b.wrist;
        for (let dx = -3; dx <= 3; dx++) set(px, wx + dx, wy + (kind === "hand" ? 4 : 0), color);
        return;
      }
      // a necklace: a curve of pixels under the collarbone
      const pts: Pt[] = [[28, 33], [29, 35], [30, 36], [31, 37], [32, 37], [33, 37], [34, 36], [35, 35], [36, 33]];
      pts.forEach(([x, y], i) => (s.shape !== "pearls" || i % 2 === 0 ? set(px, x, y, color) : undefined));
      if (s.shape === "pendant") set(px, 32, 38, color);
      return;
    }
    case "bags": {
      const color = baseOf(s.fill);
      if (s.shape === "backpack") return fillMask(px, or(rect(25, 32, 26, 50), rect(38, 32, 39, 50)), color, outline);
      if (s.shape === "shoulderBag") {
        for (let k = 0; k <= 22; k++) set(px, Math.round(41 + k * 0.32), 32 + k, outline);
        return fill(rect(45, 54, 54, 62));
      }
      if (s.shape === "tote") return fill(or(rect(46, 62, 56, 74), rect(47, 59, 48, 62), rect(54, 59, 55, 62)));
      return fill(rect(46, 64, 53, 70));
    }
    case "hats": {
      if (s.shape === "cowboyHat") return fill(or(rect(17, 7, 47, 9), poly([[24, 7], [26, 0], [32, 2], [38, 0], [40, 7]])));
      if (s.shape === "cap") return fill(or(and(ellipse(32, 9, 10, 7), rect(0, 0, GRID_W - 1, 9)), rect(36, 8, 46, 9)));
      if (s.shape === "bucketHat") return fill(or(and(ellipse(32, 9, 9, 7), rect(0, 0, GRID_W - 1, 9)), rect(20, 8, 44, 10)));
      return fill(or(and(ellipse(32, 9, 10, 8), rect(0, 0, GRID_W - 1, 10)), rect(22, 9, 42, 11)));
    }
  }
  if (g.category === "dresses" || s.shape === "dress") return fill(dressMask(b));
  const top = topMask(b, s.shape);
  if (top) {
    fill(top);
    if (s.band) fillMask(px, rows(top, (TOPS[s.shape]?.to ?? 60) - 2, TOPS[s.shape]?.to ?? 60), s.band);
    // a blazer or jacket shows a white shirt in its V
    if (TOPS[s.shape]?.neck === "v" && s.shape !== "vest") fillMask(px, and(poly([[30, 32], [34, 32], [32, 42]]), b.torso), "#f4f2f6");
    return;
  }
  const bottom = bottomMask(b, s.shape);
  if (bottom) {
    fill(bottom);
    if (s.shape === "joggers") fillMask(px, rows(bottom, 111, 113), outline);
  }
}

// Layering order, bottom to top.
const ORDER = ["pantyhose", "bottom", "top", "shoes", "scarves", "jewelry", "bags", "hats"];
const layerOf = (g: Garment) => (g.slot === "top" ? "top" : g.slot === "bottom" ? "bottom" : g.category);

// Whether every piece is one the pixel model knows how to wear.
export const canWearPixel = (pieces: Garment[]) => pieces.every((g) => spec.has(g.id));

function upscale(px: RGBA, cw: number, ch: number): HTMLCanvasElement {
  const small = makeCanvas(GRID_W, GRID_H);
  small.getContext("2d")!.putImageData(new ImageData(px, GRID_W, GRID_H), 0, 0);
  const out = makeCanvas(cw, ch);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  // whole-pixel scale, centred, feet near the bottom
  const s = Math.max(1, Math.floor(Math.min(cw / GRID_W, ch / GRID_H)));
  ctx.drawImage(small, Math.round((cw - GRID_W * s) / 2), Math.round((ch - GRID_H * s) / 2), GRID_W * s, GRID_H * s);
  return out;
}

// The bare figure, `cw` x `ch` canvas pixels.
export function pixelBody(cw: number, ch: number, figure: Figure): HTMLCanvasElement {
  const px = new Uint8ClampedArray(GRID_W * GRID_H * 4);
  drawBody(px, figure, bodyOf(figure));
  return upscale(px, cw, ch);
}

// Just the clothes, on a transparent canvas the same size as pixelBody's,
// so they can dissolve onto it.
export function pixelOutfit(cw: number, ch: number, figure: Figure, pieces: Garment[]): HTMLCanvasElement {
  const b = bodyOf(figure);
  const px = new Uint8ClampedArray(GRID_W * GRID_H * 4);
  const sorted = [...pieces].sort((p, q) => ORDER.indexOf(layerOf(p)) - ORDER.indexOf(layerOf(q)));
  for (const g of sorted) {
    const s = spec.get(g.id);
    if (s) drawGarment(px, b, g, s);
  }
  return upscale(px, cw, ch);
}
