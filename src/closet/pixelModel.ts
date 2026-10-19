import { makeCanvas } from "../pixel/raster";
import { jewelryKind } from "./categories";
import { DEMO_SPECS, type DemoSpec, type Fill, type Shape } from "./demo";
import type { Figure } from "./body";
import type { Garment } from "./types";

// The pixel model: when the closet is on PIXEL, the dressed-up screen shows a
// pixel-art girl (or guy) instead of a photo, and each pixel garment is drawn
// onto that body. A garment isn't a picture laid on top: it is cut from the
// figure's own torso, arms and legs (a tee is the torso plus the tops of the
// arms, jeans are the legs from the waist down, a skirt flares out from the
// hips), so the same piece fits either figure, and moves with her arms.
//
// Shapes are laid out in "units" on a 64x128 figure and drawn at K pixels per
// unit, so fine details (fingers, knees, toes, lashes) get real pixels.

const U_W = 64;
const U_H = 128;
const K = 2;
export const GRID_W = U_W * K;
export const GRID_H = U_H * K;

// ---- what the user can change ----

export type HairStyle = "buns" | "waves" | "pony" | "bob" | "puff" | "curls" | "buzz" | "sidePart" | "long";
export type PixelLook = { figure: Figure; hair: HairStyle; hairColor: string; eyes: string; skin: string };

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "buns", label: "SPACE BUNS" },
  { id: "waves", label: "LONG WAVES" },
  { id: "pony", label: "PONYTAIL" },
  { id: "bob", label: "BOB" },
  { id: "puff", label: "AFRO PUFF" },
  { id: "curls", label: "CURLY TOP" },
  { id: "sidePart", label: "SIDE PART" },
  { id: "buzz", label: "BUZZ CUT" },
  { id: "long", label: "SHOULDER" },
];
export const HAIR_COLORS = [
  { label: "Honey blonde", hex: "#e6b450" },
  { label: "Platinum", hex: "#efe2b8" },
  { label: "Brown", hex: "#6b4024" },
  { label: "Black", hex: "#221a1c" },
  { label: "Auburn", hex: "#a8441e" },
  { label: "Pink", hex: "#f08ab8" },
  { label: "Lavender", hex: "#b9a6f2" },
  { label: "Blue", hex: "#4a6ad8" },
];
export const EYE_COLORS = [
  { label: "Blue", hex: "#3a5a9a" },
  { label: "Brown", hex: "#5a3418" },
  { label: "Green", hex: "#2f7a4a" },
  { label: "Hazel", hex: "#8a6a2a" },
  { label: "Gray", hex: "#6a7280" },
  { label: "Violet", hex: "#7a4ab8" },
];
export const SKIN_TONES = [
  { label: "Fair", hex: "#f6d3bd" },
  { label: "Light", hex: "#f1c4a6" },
  { label: "Medium", hex: "#d9a07c" },
  { label: "Tan", hex: "#b97c56" },
  { label: "Brown", hex: "#8d5a3c" },
  { label: "Deep", hex: "#5e3a26" },
];

export const defaultLook = (figure: Figure): PixelLook =>
  figure === "mens"
    ? { figure, hair: "curls", hairColor: "#221a1c", eyes: "#5a3418", skin: "#d9a07c" }
    : { figure, hair: "buns", hairColor: "#e6b450", eyes: "#3a5a9a", skin: "#f1c4a6" };

// A moment of the idle animation: eyes shut, smiling, arms swung out (+1) or in (-1).
export type Pose = { blink: boolean; smile: boolean; sway: -1 | 0 | 1 };
export const REST: Pose = { blink: false, smile: false, sway: 0 };

// The pose at `t` seconds: a blink every few seconds, a smile now and then,
// and the arms drifting slowly in and out.
export function poseAt(t: number): Pose {
  const b = t % 3.7;
  const blink = b < 0.13 || (Math.floor(t / 3.7) % 3 === 2 && b > 0.3 && b < 0.43);
  const smile = t % 7 > 3.2 && t % 7 < 6.2;
  const s = Math.sin((t * 2 * Math.PI) / 3.2);
  return { blink, smile, sway: s > 0.55 ? 1 : s < -0.55 ? -1 : 0 };
}

// ---- masks ----

type Mask = Uint8Array; // 1 where covered, GRID_W x GRID_H
type Pt = [number, number];

const idx = (x: number, y: number) => y * GRID_W + x;

// Shapes are drawn with the canvas in units, then snapped to whole pixels.
function shape(draw: (ctx: CanvasRenderingContext2D) => void): Mask {
  const c = makeCanvas(GRID_W, GRID_H);
  const ctx = c.getContext("2d")!;
  ctx.scale(K, K);
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
// a box of whole units, both ends included
const rect = (x0: number, y0: number, x1: number, y1: number): Mask => {
  const m = new Uint8Array(GRID_W * GRID_H);
  for (let y = Math.max(0, Math.round(y0 * K)); y <= Math.min(GRID_H - 1, Math.round((y1 + 1) * K) - 1); y++)
    for (let x = Math.max(0, Math.round(x0 * K)); x <= Math.min(GRID_W - 1, Math.round((x1 + 1) * K) - 1); x++) m[idx(x, y)] = 1;
  return m;
};
const or = (...ms: Mask[]): Mask => {
  const m = new Uint8Array(GRID_W * GRID_H);
  for (const a of ms) for (let p = 0; p < m.length; p++) m[p] |= a[p];
  return m;
};
const and = (a: Mask, b: Mask): Mask => a.map((v, p) => v & b[p]);
const minus = (a: Mask, b: Mask): Mask => a.map((v, p) => (b[p] ? 0 : v));
const rows = (m: Mask, y0: number, y1: number) => and(m, rect(0, y0, U_W - 1, y1));
// grows a mask by `n` pixels: clothes sit a little proud of the body
function grow(m: Mask, n = K): Mask {
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
// straps: two thin columns over the shoulders
const straps = (torso: Mask) => and(rows(grow(torso), 31, 35), or(rect(25, 0, 25, U_H - 1), rect(39, 0, 39, U_H - 1)));

// ---- the figures ----

type Body = {
  torso: Mask; armL: Mask; armR: Mask; legL: Mask; legR: Mask; neck: Mask; head: Mask; feet: Mask; hands: Mask;
  handL: Pt; handR: Pt; earL: Pt; earR: Pt;
};

const bodies = new Map<string, Body>();
function bodyOf(figure: Figure, sway: number): Body {
  const key = `${figure}${sway}`;
  const hit = bodies.get(key);
  if (hit) return hit;
  const m = figure === "mens";
  const sh = m ? 2 : 0; // broader shoulders
  const handL: Pt = [16 - sh - sway * 1.5, 65];
  const handR: Pt = [48 + sh + sway * 1.5, 65];
  const body: Body = {
    torso: m
      ? poly([[19, 32], [45, 32], [44, 42], [42, 52], [42, 62], [22, 62], [22, 52], [20, 42]])
      : poly([[21, 32], [43, 32], [42, 40], [40, 50], [42, 57], [43, 62], [21, 62], [22, 57], [24, 50], [22, 40]]),
    armL: line([[22 - sh, 34], [18 - sh - sway * 0.6, 48], [handL[0], 62.5]], m ? 6 : 5),
    armR: line([[42 + sh, 34], [46 + sh + sway * 0.6, 48], [handR[0], 62.5]], m ? 6 : 5),
    // the thighs meet down to y 78, so every skirt covers where they part
    legL: poly([[21, 60], [32.5, 60], [32.3, 78], [31, 90], [30, 116], [25, 116], [23, 90]]),
    legR: poly([[31.5, 60], [43, 60], [41, 90], [39, 116], [34, 116], [33, 90], [31.7, 78]]),
    neck: rect(m ? 28 : 29, 25, m ? 36 : 35, 33),
    head: ellipse(32, 16, 10.5, 12),
    feet: or(poly([[24, 116], [31, 116], [31, 121], [21, 121], [21, 119]]), poly([[33, 116], [40, 116], [43, 119], [43, 121], [33, 121]])),
    hands: or(ellipse(handL[0], handL[1], 2.6, 3), ellipse(handR[0], handR[1], 2.6, 3)),
    handL,
    handR,
    earL: [21, 18],
    earR: [43, 18],
  };
  bodies.set(key, body);
  return body;
}

// ---- painting ----

type RGBA = Uint8ClampedArray<ArrayBuffer>; // GRID_W x GRID_H x 4

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const darker = (h: string, f = 0.55): string => {
  const [r, g, b] = hex(h);
  return `#${[r, g, b].map((v) => Math.min(255, Math.round(v * f)).toString(16).padStart(2, "0")).join("")}`;
};
// one real pixel
function dot(px: RGBA, X: number, Y: number, color: string) {
  X = Math.round(X);
  Y = Math.round(Y);
  if (X < 0 || Y < 0 || X >= GRID_W || Y >= GRID_H) return;
  const [r, g, b] = hex(color);
  const p = idx(X, Y) * 4;
  px[p] = r;
  px[p + 1] = g;
  px[p + 2] = b;
  px[p + 3] = 255;
}
// one unit (K x K pixels)
const unit = (px: RGBA, x: number, y: number, color: string) => {
  for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) dot(px, x * K + dx, y * K + dy, color);
};
// solid color, with a one-pixel outline in a darker shade where it meets
// anything it doesn't cover
function fillMask(px: RGBA, m: Mask, color: string | ((x: number, y: number) => string), outline?: string) {
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (!m[idx(x, y)]) continue;
      const edge = outline && (x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 || !m[idx(x - 1, y)] || !m[idx(x + 1, y)] || !m[idx(x, y - 1)] || !m[idx(x, y + 1)]);
      dot(px, x, y, edge ? outline! : typeof color === "string" ? color : color(x, y));
    }
}

const baseOf = (f: Fill): string => (f.kind === "split" ? baseOf(f.left) : f.base);
// a garment's pattern in pixels (the demo art draws them a little bigger)
function patternAt(f: Fill, x: number, y: number): string {
  if (f.kind === "split") return patternAt(x < GRID_W / 2 ? f.left : f.right, x, y);
  if (f.kind === "plaid") {
    const s = Math.max(4, Math.round((f.step * 2) / 3));
    if (x % s === 0 || y % s === 0) return f.lines[0];
    if ((x + Math.floor(s / 2)) % s === 0 || (y + Math.floor(s / 2)) % s === 0) return f.lines[1] ?? f.lines[0];
    return f.base;
  }
  if (f.kind === "stripe") {
    const s = Math.max(3, Math.round((f.step * 2) / 3));
    return (f.vertical ? x : y) % s === 0 ? f.line : f.base;
  }
  if (f.kind === "dots") {
    const s = Math.max(4, Math.round((f.step * 2) / 3));
    return y % s === 0 && (x + (Math.floor(y / s) % 2 ? Math.floor(s / 2) : 0)) % s === 0 ? f.dot : f.base;
  }
  if (f.kind === "knit") return (x + y) % 6 === 0 && y % 3 === 0 ? f.line : f.base;
  return f.base;
}

// ---- hair ----

const crown = (ry = 9.5) => and(ellipse(32, 12, 12.5, ry), rect(0, 0, U_W - 1, 12));

// [behind the body, in front of the face]
function hairShapes(style: HairStyle): [Mask | null, Mask] {
  switch (style) {
    case "buns":
      return [null, or(crown(), rect(23, 7, 41, 11), rect(19, 10, 22, 29), rect(42, 10, 45, 29), ellipse(20, 4, 6, 5.5), ellipse(44, 4, 6, 5.5))];
    case "waves": {
      const back = or(rect(18, 10, 46, 40), ellipse(20, 41, 3, 3), ellipse(26, 42, 3, 3), ellipse(32, 41, 3, 3), ellipse(38, 42, 3, 3), ellipse(44, 41, 3, 3));
      return [back, or(crown(), poly([[21, 8], [40, 6], [42, 12], [30, 10], [22, 14]]), rect(19, 10, 22, 38), rect(42, 10, 45, 38))];
    }
    case "pony":
      return [poly([[38, 3], [46, 1], [51, 8], [50, 26], [46, 36], [44, 24], [42, 8]]), or(crown(8.5), rect(20, 9, 22, 18), rect(42, 9, 44, 18))];
    case "bob":
      return [null, or(crown(), rect(23, 7, 41, 11), poly([[19, 9], [23, 9], [23, 27], [18, 28]]), poly([[41, 9], [45, 9], [46, 28], [41, 27]]))];
    case "puff":
      return [null, or(and(ellipse(32, 12, 11.5, 8.5), rect(0, 0, U_W - 1, 10)), ellipse(32, 0, 10, 7))];
    case "curls":
      return [null, or(and(or(ellipse(32, 8, 12, 6.5), ellipse(23, 5, 4.5, 4.5), ellipse(29, 2.5, 5, 4), ellipse(36, 2.5, 5, 4), ellipse(42, 6, 4.5, 4.5)), rect(0, 0, U_W - 1, 11)), rect(21, 10, 22, 18), rect(42, 10, 43, 18))];
    case "buzz":
      return [null, or(and(ellipse(32, 13, 11, 10), rect(0, 0, U_W - 1, 8)), rect(21, 8, 22, 15), rect(42, 8, 43, 15))];
    case "sidePart":
      return [null, or(and(ellipse(32, 12, 11.5, 9), rect(0, 0, U_W - 1, 10)), poly([[21, 7], [44, 5], [44, 11], [31, 9], [22, 14]]), rect(21, 9, 22, 17), rect(42, 9, 43, 17))];
    case "long":
      return [rect(19, 10, 45, 33), or(crown(), rect(19, 10, 22, 32), rect(42, 10, 45, 32))];
  }
}

function drawHair(px: RGBA, look: PixelLook, layer: 0 | 1) {
  const m = hairShapes(look.hair)[layer];
  if (!m) return;
  const c = look.hairColor;
  const shade = darker(c, 0.78);
  const curly = look.hair === "curls" || look.hair === "puff";
  // fine strands (or curls) in a slightly darker shade
  fillMask(px, m, (x, y) => (curly ? ((x * 3 + y * 5) % 9 < 2 ? shade : c) : (x + (y >> 2)) % 5 === 0 ? shade : c), darker(c, 0.5));
  if (layer === 1) {
    // a jagged fringe, and a tie in a contrasting color
    if (look.hair === "buns" || look.hair === "bob") for (let x = 24; x <= 40; x += 2) unit(px, x, 12, c);
    if (look.hair === "buns") for (const cx of [20, 44]) for (let x = cx - 4; x <= cx + 4; x++) for (const y of [9, 10]) unit(px, x, y, "#b9a6f2");
    if (look.hair === "puff") for (let x = 24; x <= 40; x++) unit(px, x, 6, "#f08ab8");
  }
  if (layer === 0 && look.hair === "pony") for (let x = 39; x <= 43; x++) unit(px, x, 4, "#f08ab8");
}

// ---- the body ----

function drawBody(px: RGBA, look: PixelLook, b: Body, pose: Pose) {
  const skin = look.skin;
  const shade = darker(skin, 0.8);
  const line = darker(skin, 0.62);
  const mens = look.figure === "mens";
  drawHair(px, look, 0);
  fillMask(px, or(b.armL, b.armR, b.hands), skin, line);
  fillMask(px, or(b.legL, b.legR), skin, line);
  fillMask(px, or(b.torso, b.neck), skin, line);
  fillMask(px, b.head, skin, line);
  fillMask(px, b.feet, skin, line);

  // fingers: creases on each hand; knees; toes; collarbones; navel
  for (const [hx, hy] of [b.handL, b.handR]) for (const dx of [-1.6, 0, 1.6]) for (let dy = 0.5; dy <= 2.6; dy += 0.5) dot(px, (hx + 0.5) * K + dx, (hy + dy) * K, line);
  for (const kx of [27, 37]) for (let dx = -2; dx <= 2; dx++) dot(px, kx * K + dx, 89 * K + Math.abs(dx) * 0.5, shade);
  for (const [fx, dir] of [[21.5, 1], [42.5, -1]] as const) for (let t = 0; t < 4; t++) dot(px, (fx + dir * t * 0.9) * K + 1, 120 * K, line);
  for (let dx = -6; dx <= 6; dx++) if (Math.abs(dx) > 1) dot(px, 32 * K + dx, 34 * K + Math.abs(dx) * 0.25, shade);
  dot(px, 32 * K, 53 * K, line);

  // underwear
  if (mens) fillMask(px, or(rows(b.torso, 56, 62), rows(or(b.legL, b.legR), 56, 70)), "#2a3a66", "#141c38");
  else {
    fillMask(px, rows(b.torso, 35, 41), "#1c1622", "#0c0a10");
    fillMask(px, or(rows(b.torso, 57, 62), rows(or(b.legL, b.legR), 60, 66)), "#1c1622", "#0c0a10");
  }

  // the face, in real pixels: brows, eyes (or a blink), nose, mouth, cheeks
  const P = (x: number, y: number, c: string) => dot(px, x, y, c);
  const browC = darker(look.hairColor, mens ? 0.7 : 0.62);
  for (const bx of [50, 71]) for (let i = 0; i < 7; i++) P(bx + i, 26 - (i > 1 && i < 5 ? 1 : 0), browC);
  for (const ex of [51, 71]) {
    if (pose.blink) {
      for (let i = 0; i < 6; i++) P(ex + i, 33 + (i > 0 && i < 5 ? 1 : 0), "#1a1226");
      continue;
    }
    for (let i = 0; i < 6; i++) P(ex + i, 30, "#1a1226"); // lash line
    for (let y = 31; y <= 34; y++) for (let i = 0; i < 6; i++) P(ex + i, y, "#ffffff");
    for (let y = 31; y <= 34; y++) for (let i = 1; i <= 4; i++) P(ex + i, y, look.eyes);
    for (let y = 32; y <= 33; y++) for (let i = 2; i <= 3; i++) P(ex + i, y, "#120c1a");
    P(ex + 3, 31, "#ffffff");
  }
  if (!mens) {
    P(50, 29, "#1a1226");
    P(49, 28, "#1a1226");
    P(77, 29, "#1a1226");
    P(78, 28, "#1a1226");
  }
  P(64, 40, shade);
  P(63, 41, shade);
  P(65, 42, line);
  const lip = mens ? darker(skin, 0.7) : "#d4485e";
  if (pose.smile) {
    // a curve up at the corners, with a line of teeth
    P(57, 46, lip);
    P(71, 46, lip);
    for (let x = 58; x <= 70; x++) P(x, 47, lip);
    for (let x = 59; x <= 69; x++) P(x, 48, "#fff6f0");
    for (let x = 60; x <= 68; x++) P(x, 49, lip);
  } else {
    for (let x = 59; x <= 69; x++) P(x, 47, lip);
    for (let x = 60; x <= 68; x++) P(x, 48, mens ? lip : darker(lip, 0.82));
  }
  if (!mens) for (const cx of [48, 77]) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) P(cx + i, 42 + j, "#f29a9a");
  else for (const x of [56, 72]) P(x, 52, shade);
  P(42, 35, shade);
  P(85, 35, shade);
  drawHair(px, look, 1);
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
  if (s === "tank" || s === "corset" || s === "bralette") m = or(m, straps(b.torso));
  return m;
}

// Every skirt and pair of shorts reaches past where the thighs part (y 78).
function bottomMask(b: Body, s: Shape): Mask | null {
  const legs = or(b.legL, b.legR);
  const hips = rows(grow(or(b.torso, legs)), 56, 64);
  switch (s) {
    case "mini": return or(hips, poly([[21, 56], [43, 56], [46.5, 82], [17.5, 82]]));
    case "aline": return or(hips, poly([[22, 56], [42, 56], [48, 88], [16, 88]]));
    case "midi": return or(hips, poly([[22, 56], [42, 56], [47, 100], [17, 100]]));
    case "maxi": return or(hips, poly([[22, 56], [42, 56], [48, 116], [16, 116]]));
    case "shorts": return or(hips, rows(grow(legs), 56, 81));
    case "leggings": return or(hips, rows(legs, 56, 114));
    case "pants": return or(hips, rows(grow(legs), 56, 115));
    case "joggers": return or(hips, rows(grow(legs), 56, 113));
    case "wideLeg": return or(hips, poly([[21, 58], [32.5, 62], [31, 116], [18, 116]]), poly([[31.5, 62], [43, 58], [46, 116], [33, 116]]));
    default: return null;
  }
}

const dressMask = (b: Body): Mask => or(rows(grow(b.torso), 35, 58), poly([[22, 54], [42, 54], [47, 90], [17, 90]]), straps(b.torso));

function shoeMask(b: Body, s: Shape): Mask {
  const legs = or(b.legL, b.legR);
  if (s === "boots") return or(grow(b.feet), rows(grow(legs), 98, 118));
  if (s === "cowboyBoots") return or(grow(b.feet), rows(grow(legs), 94, 118));
  if (s === "sneakers") return grow(rows(b.feet, 115, 121));
  return or(b.feet, rows(grow(b.feet), 119, 121));
}

// Draws one pixel garment onto the figure.
function drawGarment(px: RGBA, b: Body, look: PixelLook, g: Garment, s: DemoSpec) {
  const outline = darker(baseOf(s.fill));
  const fill = (m: Mask) => fillMask(px, m, (x, y) => patternAt(s.fill, x, y), outline);
  const legs = or(b.legL, b.legR);
  switch (g.category) {
    case "pantyhose":
      if (s.shape === "socks") return fill(rows(legs, 100, 117));
      return fillMask(px, rows(legs, 60, 117), (x, y) => (s.name.includes("Fishnet") ? ((x + y) % 3 ? look.skin : "#1a1420") : patternAt(s.fill, x, y)), outline);
    case "shoes": {
      fill(shoeMask(b, s.shape));
      if (s.shape === "sneakers") fillMask(px, rows(grow(b.feet), 121, 121), "#f4f4f4");
      if (s.shape === "heels") for (const x of [22, 42]) for (let y = 122; y <= 123; y++) unit(px, x, y, outline);
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
          if (s.shape === "hoops") for (let a = 0; a < 12; a++) dot(px, ex * K + 1 + Math.cos((a / 12) * Math.PI * 2) * 2.5, (ey + 4) * K + Math.sin((a / 12) * Math.PI * 2) * 3, color);
          else unit(px, ex, ey + 2, color);
        }
        return;
      }
      if (kind === "wrist" || kind === "hand") {
        const [hx, hy] = b.handL;
        for (let dx = -3; dx <= 3; dx++) unit(px, hx + dx * 0.6, hy - (kind === "hand" ? -1 : 3), color);
        return;
      }
      // a necklace: a curve of beads or chain under the collarbone
      for (let a = 0; a <= 16; a++) {
        const t = (a / 16) * Math.PI;
        if (s.shape === "pearls" && a % 2) continue;
        dot(px, 32 * K + Math.cos(t) * 9, 33 * K + Math.sin(t) * 6, color);
        if (s.shape === "pearls") dot(px, 32 * K + Math.cos(t) * 9 + 1, 33 * K + Math.sin(t) * 6, color);
      }
      if (s.shape === "pendant") unit(px, 32, 39.5, color);
      return;
    }
    case "bags": {
      const color = baseOf(s.fill);
      const [hx, hy] = b.handR;
      if (s.shape === "backpack") return fillMask(px, or(rect(25, 32, 26, 50), rect(38, 32, 39, 50)), color, outline);
      if (s.shape === "shoulderBag") {
        for (let k = 0; k <= 44; k++) dot(px, (41 + k * 0.16) * K, (32 + k * 0.5) * K, outline);
        return fill(rect(45, 54, 54, 62));
      }
      if (s.shape === "tote") return fill(or(rect(hx - 4, hy - 1, hx + 6, hy + 10), rect(hx - 3, hy - 4, hx - 2, hy - 1), rect(hx + 4, hy - 4, hx + 5, hy - 1)));
      return fill(rect(hx - 2, hy + 1, hx + 5, hy + 7));
    }
    case "hats": {
      if (s.shape === "cowboyHat") return fill(or(rect(17, 7, 47, 9), poly([[24, 7], [26, 0], [32, 2], [38, 0], [40, 7]])));
      if (s.shape === "cap") return fill(or(and(ellipse(32, 9, 11, 7.5), rect(0, 0, U_W - 1, 9)), rect(36, 8, 47, 9)));
      if (s.shape === "bucketHat") return fill(or(and(ellipse(32, 9, 10, 7), rect(0, 0, U_W - 1, 9)), rect(19, 8, 45, 10)));
      return fill(or(and(ellipse(32, 9, 11, 8), rect(0, 0, U_W - 1, 10)), rect(21, 9, 43, 11)));
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
  // whole-pixel scale, centred
  const s = Math.max(1, Math.floor(Math.min(cw / GRID_W, ch / GRID_H)));
  ctx.drawImage(small, Math.round((cw - GRID_W * s) / 2), Math.round((ch - GRID_H * s) / 2), GRID_W * s, GRID_H * s);
  return out;
}

// The bare figure, `cw` x `ch` canvas pixels.
export function pixelBody(cw: number, ch: number, look: PixelLook, pose: Pose = REST): HTMLCanvasElement {
  const px: RGBA = new Uint8ClampedArray(GRID_W * GRID_H * 4);
  drawBody(px, look, bodyOf(look.figure, pose.sway), pose);
  return upscale(px, cw, ch);
}

// Just the clothes, on a transparent canvas the same size as pixelBody's,
// so they can dissolve onto it.
export function pixelOutfit(cw: number, ch: number, look: PixelLook, pieces: Garment[], pose: Pose = REST): HTMLCanvasElement {
  const b = bodyOf(look.figure, pose.sway);
  const px: RGBA = new Uint8ClampedArray(GRID_W * GRID_H * 4);
  const sorted = [...pieces].sort((p, q) => ORDER.indexOf(layerOf(p)) - ORDER.indexOf(layerOf(q)));
  for (const g of sorted) {
    const s = spec.get(g.id);
    if (s) drawGarment(px, b, look, g, s);
  }
  return upscale(px, cw, ch);
}
