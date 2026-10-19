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
// unit, so fine details (lashes, fingers, strands of hair) get real pixels.
// Proportions are fashion-plate: about 6 1/2 heads tall, the legs parting at
// y 67, a little over half way down.

const U_W = 64;
const U_H = 128;
const K = 2;
export const GRID_W = U_W * K;
export const GRID_H = U_H * K;

// ---- what the user can change ----

export type HairStyle = "bows" | "long" | "pony" | "bob" | "puff" | "messy" | "short" | "curls" | "buzz";
export type PixelLook = { figure: Figure; hair: HairStyle; hairColor: string; eyes: string; skin: string };

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "bows", label: "LONG + BOWS" },
  { id: "long", label: "LONG" },
  { id: "pony", label: "PONYTAIL" },
  { id: "bob", label: "BOB" },
  { id: "puff", label: "AFRO PUFF" },
  { id: "messy", label: "MESSY" },
  { id: "short", label: "SHORT" },
  { id: "curls", label: "CURLY TOP" },
  { id: "buzz", label: "BUZZ CUT" },
];
export const HAIR_COLORS = [
  { label: "Dark brown", hex: "#4a3230" },
  { label: "Honey blonde", hex: "#e2b04e" },
  { label: "Platinum", hex: "#ece0c0" },
  { label: "Brown", hex: "#6a4630" },
  { label: "Black", hex: "#2a2024" },
  { label: "Auburn", hex: "#a0442a" },
  { label: "Pink", hex: "#f08ab8" },
  { label: "Lavender", hex: "#b9a6f2" },
  { label: "Blue", hex: "#4a6ad8" },
];
export const EYE_COLORS = [
  { label: "Dark", hex: "#3e3a56" },
  { label: "Blue", hex: "#3a5a9a" },
  { label: "Brown", hex: "#5a3418" },
  { label: "Green", hex: "#2f7a4a" },
  { label: "Hazel", hex: "#8a6a2a" },
  { label: "Gray", hex: "#5a6270" },
  { label: "Violet", hex: "#6a4ab0" },
];
export const SKIN_TONES = [
  { label: "Fair", hex: "#f8d8c4" },
  { label: "Light", hex: "#f2c6a8" },
  { label: "Medium", hex: "#dca37e" },
  { label: "Tan", hex: "#bb7f58" },
  { label: "Brown", hex: "#8f5c3e" },
  { label: "Deep", hex: "#603c28" },
];

export const defaultLook = (figure: Figure): PixelLook =>
  figure === "mens"
    ? { figure, hair: "messy", hairColor: "#4a3230", eyes: "#5a3418", skin: "#f2c6a8" }
    : { figure, hair: "bows", hairColor: "#4a3230", eyes: "#3e3a56", skin: "#f2c6a8" };
// a saved look from before a style was retired falls back to the default
export const validLook = (l: PixelLook | null | undefined): l is PixelLook => !!l && HAIR_STYLES.some((h) => h.id === l.hair);

// ---- the idle animation ----

// One moment: each arm's swing (-1 in to 1 out, in halves), the eyes (0 open,
// 1 half shut, 2 shut), where she looks, her mouth (0 at rest, 1 a small
// smile, 2 a big one) and raised brows.
// `stance` is a held pose for STRIKE A POSE (the arms stop swaying).
export type Stance = "idle" | "wave" | "hip" | "peace";
export const STANCES: Stance[] = ["wave", "hip", "peace"];
export type Pose = { armL: number; armR: number; blink: 0 | 1 | 2; gaze: -1 | 0 | 1; mouth: 0 | 1 | 2; brow: 0 | 1; stance?: Stance };
export const REST: Pose = { armL: 0, armR: 0, blink: 0, gaze: 0, mouth: 0, brow: 0 };
const half = (v: number) => Math.round(v * 2) / 2;

// The pose `t` seconds in: arms swaying gently, each on its own beat; a
// blink every few seconds (half shut, shut, half shut); glances to each
// side; and now and then a smile that grows and fades, with the brows lifting.
export function poseAt(t: number): Pose {
  const sway = (2 * Math.PI * t) / 4.4;
  const b = t % 3.9;
  const blink = b < 0.05 ? 1 : b < 0.15 ? 2 : b < 0.21 ? 1 : 0;
  const gaze = ([0, 0, -1, 0, 1, 0] as const)[Math.floor(t / 2.3) % 6];
  const m = t % 9.5;
  const mouth = m > 3 && m < 3.35 ? 1 : m >= 3.35 && m < 5.9 ? 2 : m >= 5.9 && m < 6.4 ? 1 : 0;
  return { armL: half(Math.sin(sway) * 0.9), armR: half(Math.sin(sway + 1.3) * 0.9), blink, gaze, mouth, brow: mouth === 2 ? 1 : 0 };
}
export const poseKey = (p: Pose) => `${p.armL},${p.armR},${p.blink},${p.gaze},${p.mouth},${p.brow},${p.stance ?? "idle"}`;

// ---- masks ----

type Mask = Uint8Array; // 1 where covered, GRID_W x GRID_H
type Pt = [number, number];

const idx = (x: number, y: number) => y * GRID_W + x;
const shared = makeCanvas(GRID_W, GRID_H);
const sctx = shared.getContext("2d", { willReadFrequently: true })!;

// Shapes are drawn with the canvas in units, then snapped to whole pixels.
function shape(draw: (ctx: CanvasRenderingContext2D) => void): Mask {
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, GRID_W, GRID_H);
  sctx.setTransform(K, 0, 0, K, 0, 0);
  sctx.fillStyle = "#fff";
  sctx.strokeStyle = "#fff";
  sctx.lineCap = "round";
  sctx.lineJoin = "round";
  draw(sctx);
  const d = sctx.getImageData(0, 0, GRID_W, GRID_H).data;
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
// a limb: a tapering stroke through `pts`, `w0` wide at the start, `w1` at the end
const limb = (pts: Pt[], w0: number, w1: number) => shape((ctx) => {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const along = (i - 1 + f) / (pts.length - 1);
      ctx.beginPath();
      ctx.arc(ax + (bx - ax) * f, ay + (by - ay) * f, (w0 + (w1 - w0) * along) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
const straps = (torso: Mask) => and(rows(grow(torso), 30, 34), or(rect(26, 0, 26, U_H - 1), rect(38, 0, 38, U_H - 1)));

// ---- the figures ----

type Body = {
  torso: Mask; armL: Mask; armR: Mask; legL: Mask; legR: Mask; neck: Mask; head: Mask; ears: Mask; feet: Mask; hands: Mask;
  /** the tops of the arms, where a short sleeve ends */
  shortSleeves: Mask;
  handL: Pt; handR: Pt; earL: Pt; earR: Pt;
  /** hands raised with the fingers up (a wave, a peace sign) */
  fingers: { at: Pt; count: number }[];
  /** the arms cross in front of the body, so they're drawn over the clothes */
  posed: boolean;
};

// An arm: shoulder, elbow, wrist, and the middle of the hand.
type Arm = { s: Pt; e: Pt; w: Pt; h: Pt };
const lerp = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const mirrorPt = ([x, y]: Pt): Pt => [64 - x, y];
const mirrorArm = (a: Arm): Arm => ({ s: mirrorPt(a.s), e: mirrorPt(a.e), w: mirrorPt(a.w), h: mirrorPt(a.h) });

// The left arm (on the viewer's left) in each pose; `sway` is the idle swing.
function leftArm(stance: Stance, sh: number, sway: number): Arm {
  const s: Pt = [23.5 - sh, 33];
  switch (stance) {
    case "wave":
      return { s, e: [14.5 - sh, 27], w: [15 - sh, 17.5], h: [15 - sh, 14.5] };
    case "hip":
      return { s, e: [14.5 - sh, 44], w: [20.5, 55], h: [22, 56.5] };
    case "peace":
      return { s, e: [15.5 - sh, 38], w: [19.5, 26], h: [20.5, 23] };
    default:
      return { s, e: [19.6 - sh - sway * 0.8, 49], w: [17 - sh - sway * 1.8, 63], h: [17 - sh - sway * 1.8, 66] };
  }
}

const CROTCH = 67;

const bodies = new Map<string, Body>();
function bodyOf(figure: Figure, armL: number, armR: number, stance: Stance = "idle"): Body {
  const key = `${figure}${armL},${armR},${stance}`;
  const hit = bodies.get(key);
  if (hit) return hit;
  const m = figure === "mens";
  const sh = m ? 1.6 : 0; // broader shoulders
  // in a pose: the left arm does it (a wave, a peace sign) while the right
  // rests on the hip, or both go on the hips
  const L = leftArm(stance, sh, armL);
  const R = mirrorArm(stance === "idle" ? leftArm("idle", sh, armR) : leftArm("hip", sh, 0));
  const w0 = m ? 5.4 : 4.6;
  const w1 = m ? 3.8 : 3.2;
  const wm = (w0 + w1) / 2;
  const arm = (a: Arm) => or(limb([a.s, a.e], w0, wm), limb([a.e, a.w], wm, w1));
  const handL = L.h;
  const handR = R.h;
  const legL: Pt[] = m
    ? [[21.5, 62], [32.6, 62], [32.2, CROTCH], [31, 80], [30.8, 88], [30.4, 115], [25.4, 115], [23.6, 88], [22, 74]]
    : [[21, 62], [32.6, 62], [32.2, CROTCH], [30.8, 80], [30.6, 88], [30.2, 115], [25.6, 115], [23.8, 88], [21.4, 74]];
  const body: Body = {
    torso: m
      ? poly([[20.5, 31], [43.5, 31], [43, 40], [41.6, 50], [41.6, 60], [42.4, 65], [21.6, 65], [22.4, 60], [22.4, 50], [21, 40]])
      : poly([[22.5, 31], [41.5, 31], [41, 38], [39.4, 47], [40.4, 53], [42.8, 59], [43, 65], [21, 65], [21.2, 59], [23.6, 53], [24.6, 47], [23, 38]]),
    armL: arm(L),
    armR: arm(R),
    shortSleeves: or(limb([L.s, lerp(L.s, L.e, 0.6)], w0, w0 - 0.2), limb([R.s, lerp(R.s, R.e, 0.6)], w0, w0 - 0.2)),
    legL: poly(legL),
    legR: poly(legL.map(([x, y]) => [64 - x, y] as Pt)),
    neck: m ? rect(28.5, 24, 35.5, 32) : rect(29.5, 24, 34.5, 32),
    head: ellipse(32, 15, 9.5, 11),
    ears: or(ellipse(22.6, 17, 1.6, 2.6), ellipse(41.4, 17, 1.6, 2.6)),
    feet: or(poly([[25, 114], [31, 114], [31, 120], [21.5, 120], [21.5, 118]]), poly([[33, 114], [39, 114], [42.5, 118], [42.5, 120], [33, 120]])),
    hands: or(ellipse(handL[0], handL[1], 2.2, 3), ellipse(handR[0], handR[1], 2.2, 3)),
    handL,
    handR,
    earL: [22.5, 18],
    earR: [41.5, 18],
    fingers: stance === "wave" ? [{ at: L.h, count: 4 }] : stance === "peace" ? [{ at: L.h, count: 2 }] : [],
    posed: stance !== "idle",
  };
  bodies.set(key, body);
  return body;
}

// ---- painting ----

type RGBA = Uint8ClampedArray<ArrayBuffer>; // GRID_W x GRID_H x 4
const newBuffer = (): RGBA => new Uint8ClampedArray(GRID_W * GRID_H * 4);

const hexCache = new Map<string, [number, number, number]>();
const hex = (h: string): [number, number, number] => {
  let v = hexCache.get(h);
  if (!v) {
    const n = parseInt(h.replace("#", "").slice(0, 6), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(h, v);
  }
  return v;
};
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const darker = (h: string, f = 0.55): string => {
  const [r, g, b] = hex(h);
  return toHex(r * f, g * f, b * f);
};
// toward white (and a touch warmer), for highlights
const lighter = (h: string, f = 0.3): string => {
  const [r, g, b] = hex(h);
  return toHex(r + (255 - r) * f, g + (250 - g) * f, b + (235 - b) * f);
};
const mix = (a: string, b: string, f: number): string => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return toHex(r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f);
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
const isEdge = (m: Mask, x: number, y: number) => x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 || !m[idx(x - 1, y)] || !m[idx(x + 1, y)] || !m[idx(x, y - 1)] || !m[idx(x, y + 1)];

// Fills a mask with a color (or pattern), shaded round the sides so it has
// some volume, with a one-pixel outline in a darker shade.
function fillMask(px: RGBA, m: Mask, color: string | ((x: number, y: number) => string), outline?: string, shade = true) {
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (!m[idx(x, y)]) continue;
      if (outline && isEdge(m, x, y)) {
        dot(px, x, y, outline);
        continue;
      }
      let c = typeof color === "string" ? color : color(x, y);
      // the sides turn away from the light: two pixels in, a little darker
      if (shade && ((x > 1 && !m[idx(x - 2, y)]) || (x < GRID_W - 2 && !m[idx(x + 2, y)]))) c = darker(c, 0.86);
      dot(px, x, y, c);
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
//
// Hair is drawn the way the pixel artists in the references draw it: in big
// pixels (one per unit, the same size as the face's), laid out column by
// column. Each style lists where every column of hair starts and ends, so
// the bangs end in pointed locks at chosen heights, the side strands frame
// the face, and the part and lock lines sit where they're placed. Then
// every style gets the same finish: a flat base color, darker lock lines,
// shadow next to the face and the part, a shiny arc across the crown, and
// a dark outline.

// tones: 1 shine, 2 light, 3 base, 4 shadow, 5 lock line, 6 outline
type Tones = Uint8Array; // U_W x U_H
const tIdx = (x: number, y: number) => y * U_W + x;
const newTones = (): Tones => new Uint8Array(U_W * U_H);

// a style's columns: hair from top[i] to bottom[i] in column from + i
function columns(t: Tones, from: number, top: number[], bottom: number[], tone = 3) {
  top.forEach((y0, i) => {
    for (let y = Math.max(0, y0); y <= bottom[i]; y++) t[tIdx(from + i, y)] = tone;
  });
}
// recolors hair already there (a lock line, a shadow), from y0 to y1
function stroke(t: Tones, x: number, y0: number, y1: number, tone: number) {
  for (let y = y0; y <= y1; y++) if (t[tIdx(x, y)]) t[tIdx(x, y)] = tone;
}
// the crown: an arc over the head, its top at y 3 in the middle
const crownTop = (x: number) => Math.round(12 - Math.sqrt(Math.max(0, 132 - (x - 32) ** 2)) * 0.78);
const crownTops = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => crownTop(from + i));
// shine: an arc of light two and three rows below the top of each column
function shine(t: Tones, from: number, to: number) {
  for (let x = from; x <= to; x++) {
    let top = 0;
    while (top < U_H && !t[tIdx(x, top)]) top++;
    if (t[tIdx(x, top + 2)] === 3) t[tIdx(x, top + 2)] = x % 3 === 0 ? 1 : 2;
    if (x % 2 === 0 && t[tIdx(x, top + 3)] === 3) t[tIdx(x, top + 3)] = 2;
  }
}
// a dark outline round every edge
function outline(t: Tones) {
  const src = t.slice();
  const empty = (x: number, y: number) => x < 0 || y < 0 || x >= U_W || y >= U_H || !src[tIdx(x, y)];
  for (let y = 0; y < U_H; y++)
    for (let x = 0; x < U_W; x++) if (src[tIdx(x, y)] && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) t[tIdx(x, y)] = 6;
}

// a small fixed scramble, so the back of long hair ends unevenly
const jitter = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

type HairLayers = { front: Tones; back: Tones | null; bows?: boolean; tie?: Pt };

// Long and straight, with curtain bangs parted in the middle and strands
// framing the face down past the shoulders (the scrimsart look).
function longHair(): HairLayers {
  const front = newTones();
  columns(front, 19, [11, 9], [35, 39]);
  columns(front, 21, crownTops(21, 43), [41, 38, 12, 13, 13, 12, 11, 12, 13, 13, 12, 10, 9, 10, 12, 13, 13, 12, 11, 12, 13, 38, 41]);
  columns(front, 44, [9, 11], [39, 35]);
  for (const x of [25, 28, 36, 39]) stroke(front, x, 9, 12, 5);
  for (const x of [31, 33]) stroke(front, x, 5, 12, 4);
  stroke(front, 22, 12, 38, 4);
  stroke(front, 42, 12, 38, 4);
  stroke(front, 20, 15, 37, 5);
  stroke(front, 44, 15, 37, 5);
  for (const x of [21, 43]) stroke(front, x, 16, 19, 2);
  shine(front, 21, 43);
  outline(front);
  const back = newTones();
  for (let x = 18; x <= 46; x++) columns(back, x, [8], [49 + Math.round(jitter(x) * 3) - (x < 20 || x > 44 ? 5 : 0)], 4);
  for (const x of [20, 24, 28, 36, 40, 44]) stroke(back, x, 28, 52, 5);
  for (const x of [19, 45]) stroke(back, x, 18, 44, 3);
  outline(back);
  return { front, back };
}

// A chin-length bob with blunt bangs.
function bob(): HairLayers {
  const front = newTones();
  columns(front, 19, [10, 8], [26, 28]);
  columns(front, 21, crownTops(21, 43), [28, 27, 12, 12, 13, 12, 12, 12, 13, 12, 12, 12, 12, 12, 13, 12, 12, 12, 13, 12, 12, 27, 28]);
  columns(front, 44, [8, 10], [28, 26]);
  for (const x of [26, 30, 34, 38]) stroke(front, x, 10, 12, 5);
  for (const x of [20, 44]) stroke(front, x, 15, 26, 5);
  stroke(front, 22, 12, 27, 4);
  stroke(front, 42, 12, 27, 4);
  shine(front, 21, 43);
  outline(front);
  const back = newTones();
  columns(back, 20, Array(25).fill(8), Array(25).fill(28), 4);
  outline(back);
  return { front, back };
}

// A high ponytail, bangs swept to one side.
function pony(): HairLayers {
  const front = newTones();
  columns(front, 20, [9], [15]);
  columns(front, 21, crownTops(21, 43), [20, 22, 13, 13, 12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 10, 10, 11, 11, 12, 13, 14, 16, 15]);
  columns(front, 44, [9], [13]);
  for (const x of [25, 28, 31]) stroke(front, x, 7, 12, 5);
  stroke(front, 22, 12, 21, 4);
  shine(front, 21, 43);
  outline(front);
  const back = newTones();
  columns(back, 43, [4, 3, 2, 2, 3, 5, 8, 12, 16], [10, 24, 34, 40, 42, 40, 35, 28, 22]);
  for (const x of [46, 48]) stroke(back, x, 10, 38, 5);
  stroke(back, 44, 8, 22, 2);
  outline(back);
  return { front, back, tie: [43, 4] };
}

// Messy and tousled (the boy in the references): chunky tufts on top and a
// choppy fringe falling to the brows.
function messy(): HairLayers {
  const front = newTones();
  columns(front, 20, [9], [16]);
  columns(front, 21, [7, 6, 4, 4, 5, 2, 2, 3, 4, 1, 1, 2, 4, 3, 3, 1, 2, 4, 5, 4, 5, 6, 8], [17, 15, 12, 13, 14, 12, 11, 13, 14, 13, 11, 12, 14, 13, 12, 11, 13, 14, 12, 11, 12, 15, 17]);
  columns(front, 44, [9], [16]);
  for (const x of [25, 29, 33, 37]) stroke(front, x, 8, 13, 5);
  for (const x of [22, 42]) stroke(front, x, 10, 15, 4);
  shine(front, 21, 43);
  outline(front);
  return { front, back: null };
}

// Short and neat, swept to the side.
function short(): HairLayers {
  const front = newTones();
  columns(front, 20, [10], [14]);
  columns(front, 21, crownTops(21, 43), [15, 15, 10, 9, 9, 10, 10, 10, 10, 9, 9, 9, 9, 9, 10, 10, 11, 11, 12, 12, 13, 15, 15]);
  columns(front, 44, [10], [14]);
  for (const x of [27, 31, 35]) stroke(front, x, 6, 10, 4);
  shine(front, 21, 43);
  outline(front);
  return { front, back: null };
}

// The rest are drawn from shapes and painted in curls or fine strands.
function shapedHair(style: HairStyle): [Mask | null, Mask] {
  switch (style) {
    case "puff":
      return [null, or(and(ellipse(32, 11.5, 11, 9.5), rect(0, 0, U_W - 1, 11)), rect(21.5, 8, 23, 15), rect(41, 8, 42.5, 15), ellipse(32, 0.5, 9, 6.5))];
    case "curls":
      return [null, or(and(or(ellipse(32, 8, 11.5, 6.5), ellipse(23, 5, 4.5, 4.5), ellipse(29, 2.5, 5, 4), ellipse(36, 2.5, 5, 4), ellipse(41.5, 6, 4.5, 4.5)), rect(0, 0, U_W - 1, 11)), rect(21, 10, 22.5, 17), rect(41.5, 10, 43, 17))];
    default:
      return [null, or(and(ellipse(32, 12.5, 11, 10), rect(0, 0, U_W - 1, 10)), rect(21.5, 8, 23, 15), rect(41, 8, 42.5, 15))];
  }
}

// Curls: little round curls, a light top-left and dark bottom-right on each.
function paintCurls(px: RGBA, m: Mask, base: string, curly: boolean) {
  const ink = darker(base, 0.42);
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (!m[idx(x, y)]) continue;
      if (isEdge(m, x, y)) {
        dot(px, x, y, ink);
        continue;
      }
      if (!curly) {
        dot(px, x, y, (x + y) % 5 === 0 ? darker(base, 0.8) : base);
        continue;
      }
      const cx = (x + ((y >> 2) % 2) * 2) % 4;
      const cy = y % 4;
      dot(px, x, y, cx + cy <= 1 ? lighter(base, 0.16) : cx + cy >= 5 ? darker(base, 0.62) : base);
    }
}

const authored: Partial<Record<HairStyle, () => HairLayers>> = { bows: () => ({ ...longHair(), bows: true }), long: longHair, bob, pony, messy, short };
const hairCache = new Map<HairStyle, HairLayers>();
const hairOf = (style: HairStyle) => {
  let h = hairCache.get(style);
  if (!h && authored[style]) hairCache.set(style, (h = authored[style]!()));
  return h;
};

// a white satin bow, 10 x 7, centred on (cx, cy): two loops and a knot,
// the ribbon ends hanging below
const BOW = [".cc....cc.", "cBBc..cBBc", "cBBBckBBBc", "cbBBkkBBbc", ".cbbckbbc.", "..cc..cc..", ".cBc..cBc.", ".cc....cc."];
const BOW_COLORS: Record<string, string> = { B: "#f8f8fe", b: "#d8dcf2", k: "#c2c8ea", c: "#8a90c4" };
function drawBow(px: RGBA, cx: number, cy: number) {
  BOW.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && unit(px, cx - 5 + i, cy - 3 + j, BOW_COLORS[ch])));
}

function drawHair(px: RGBA, look: PixelLook, layer: 0 | 1) {
  const c = look.hairColor;
  const h = hairOf(look.hair);
  if (h) {
    const t = layer === 0 ? h.back : h.front;
    if (!t) return;
    const palette = ["", lighter(c, 0.4), lighter(c, 0.18), c, darker(c, 0.78), darker(c, 0.6), darker(c, 0.42)];
    for (let y = 0; y < U_H; y++) for (let x = 0; x < U_W; x++) if (t[tIdx(x, y)]) unit(px, x, y, palette[t[tIdx(x, y)]]);
    if (layer === 1 && h.bows) {
      drawBow(px, 21, 5);
      drawBow(px, 44, 5);
    }
    if (layer === 0 && h.tie) for (let i = -1; i <= 1; i++) unit(px, h.tie[0] + i, h.tie[1], i ? "#f08ab8" : "#d86a9a");
    return;
  }
  const m = shapedHair(look.hair)[layer];
  if (!m) return;
  paintCurls(px, m, c, look.hair !== "buzz");
  if (layer === 1 && look.hair === "puff") for (let x = 24; x <= 40; x++) unit(px, x, 5.5, x % 2 ? "#f08ab8" : "#d86a9a");
}

// ---- the body ----

function drawBody(px: RGBA, look: PixelLook, b: Body) {
  const skin = look.skin;
  const shade = darker(skin, 0.86);
  const line = darker(skin, 0.64);
  const glow = lighter(skin, 0.22);
  if (!b.posed) drawArms(px, look, b);
  fillMask(px, or(b.legL, b.legR), skin, line);
  fillMask(px, or(b.torso, b.neck), skin, line);
  fillMask(px, b.ears, skin, line, false);
  fillMask(px, b.head, skin, line, false);
  fillMask(px, b.feet, skin, line, false);

  // a shadow under the chin
  for (let x = 58; x <= 69; x++) dot(px, x, 52, shade);
  for (let x = 59; x <= 68; x++) dot(px, x, 53, shade);
  for (let x = 60; x <= 67; x++) dot(px, x, 54, shade);
  // knees: a kneecap with a light top and a curved line under it
  for (const kx of [27.4, 36.6]) {
    const X = Math.round(kx * K);
    for (let dx = -2; dx <= 2; dx++) dot(px, X + dx, 173, glow);
    for (let dx = -2; dx <= 2; dx++) dot(px, X + dx, 174, glow);
    for (let dx = -3; dx <= 3; dx++) dot(px, X + dx, 177 - (Math.abs(dx) === 3 ? 1 : 0), line);
    dot(px, X - 1, 180, shade);
    dot(px, X + 1, 180, shade);
  }
  // toes: four on each foot, with a light nail at the tip
  for (const side of [-1, 1]) {
    for (let t = 0; t < 4; t++) {
      const ux = 32 + side * (9.6 - t * 1.25);
      const X = Math.round(ux * K);
      dot(px, X, 237, line);
      dot(px, X, 238, line);
      dot(px, X, 239, line);
      dot(px, X + side, 239, glow);
    }
  }
  // collarbones, navel
  for (let dx = -6; dx <= 6; dx++) if (Math.abs(dx) > 1) dot(px, 64 + dx, 66 + Math.abs(dx) * 0.25, shade);
  dot(px, 64, 104, line);
  dot(px, 64, 105, shade);

  // underwear
  if (look.figure === "mens") fillMask(px, or(rows(b.torso, 58, 65), rows(or(b.legL, b.legR), 60, 72)), "#2a3a66", "#141c38");
  else {
    fillMask(px, rows(b.torso, 35, 41), "#1c1622", "#0c0a10");
    fillMask(px, or(rows(b.torso, 59, 65), rows(or(b.legL, b.legR), 62, CROTCH + 1)), "#1c1622", "#0c0a10");
  }
}

// Arms and hands. A hand hanging down shows three finger creases; a raised
// hand shows its fingers up (four for a wave, two for a peace sign).
function drawArms(px: RGBA, look: PixelLook, b: Body) {
  const skin = look.skin;
  const line = darker(skin, 0.64);
  const raised = b.fingers.map((f) => f.at);
  const fingers = b.fingers.map(({ at: [hx, hy], count }) =>
    or(...Array.from({ length: count }, (_, i) => {
      const off = count === 2 ? (i ? 0.9 : -0.9) : -1.6 + i * 1.07;
      const tall = count === 2 ? 4.2 : 3.2;
      return poly([[hx + off - 0.5, hy - 1.5], [hx + off + 0.5, hy - 1.5], [hx + off * 1.35 + 0.5, hy - 1.5 - tall], [hx + off * 1.35 - 0.5, hy - 1.5 - tall]]);
    })),
  );
  fillMask(px, or(b.armL, b.armR, b.hands, ...fingers), skin, line);
  for (const [hx, hy] of [b.handL, b.handR]) {
    if (raised.some(([x, y]) => x === hx && y === hy)) continue;
    for (const dx of [-1.4, 0, 1.4]) for (let dy = 0.8; dy <= 2.8; dy += 0.5) dot(px, (hx + 0.5) * K + dx, (hy + dy) * K, line);
  }
}

// The face, in big pixels like the hair (one per unit), for a pose. Left
// and right are mirror images about the middle of the head (columns c and
// 63 - c). Eyes: a thick black upper lash flicking out at the corner, a
// two-tone iris with a pupil and two catchlights, a soft lower lash. Lips:
// full, with a dark line between, a highlight on the lower lip.
function drawFace(px: RGBA, look: PixelLook, pose: Pose) {
  const mens = look.figure === "mens";
  const skin = look.skin;
  const both = (x: number, y: number, c: string) => {
    unit(px, x, y, c);
    unit(px, 63 - x, y, c);
  };
  const U = (x: number, y: number, c: string) => unit(px, x, y, c);
  const lash = "#1c1426";
  const white = "#fbf8f6";
  const lowLash = mix(skin, lash, 0.22);
  const brow = mix(look.hairColor, skin, 0.35);

  // brows (mostly under the bangs, as in the references)
  // a soft arc: high in the middle, both ends a little lower
  const by = 12 - pose.brow;
  for (let x = 26; x <= 28; x++) both(x, by, brow);
  both(29, by + 1, brow);

  // eyes: columns 25..30 on the left, 33..38 on the right
  if (pose.blink === 2) {
    for (let x = 26; x <= 29; x++) both(x, 16, lash);
    both(25, 15, lash);
    both(30, 15, lash);
    both(27, 17, lowLash);
    both(28, 17, lowLash);
  } else {
    const lid = pose.blink === 1 ? 1 : 0;
    for (let x = 25; x <= 29; x++) both(x, 14 + lid, lash); // thinner toward the nose
    both(25, 13 + lid, lash); // the flick
    both(25, 15 + lid, lash);
    for (let y = 15 + lid; y <= 17; y++) for (let x = 26; x <= 30; x++) both(x, y, white);
    // the iris follows her gaze; on the right eye "left" is the mirror
    for (const side of [0, 1]) {
      const g = side ? -pose.gaze : pose.gaze;
      const ic = 28 + g; // iris centre column, 3 wide
      const put = (x: number, y: number, c: string) => U(side ? 63 - x : x, y, c);
      for (let x = ic - 1; x <= ic + 1; x++) {
        if (!lid) put(x, 15, darker(look.eyes, 0.55));
        put(x, 16, look.eyes);
        put(x, 17, lighter(look.eyes, 0.22));
      }
      put(ic, 16, "#120c1a");
      if (!lid) put(ic, 15, "#120c1a");
      if (!lid) put(ic - 1, 15, "#ffffff");
      put(ic + 1, 17, white);
    }
    for (let x = 27; x <= 29; x++) both(x, 18, lowLash);
  }

  // nose: a soft shadow and the tip
  U(32, 19, darker(skin, 0.9));
  U(31, 20, darker(skin, 0.86));
  U(32, 20, darker(skin, 0.72));

  // blush: a soft round flush under each eye
  const blush = mix(skin, "#f27a8c", pose.mouth === 2 ? 0.55 : 0.42);
  const blushSoft = mix(skin, "#f27a8c", 0.24);
  for (const [x, y, strong] of [[24, 19, 1], [25, 19, 1], [23, 19, 0], [26, 19, 0], [24, 20, 0], [25, 20, 0]] as const) both(x, y, strong ? blush : blushSoft);

  // lips: columns 29..34
  const lip = mens ? mix(skin, "#b0605e", 0.4) : "#e06a86";
  const lipDark = mens ? darker(lip, 0.82) : "#a8405e";
  const lipHi = mens ? lip : "#f6b4c4";
  const row = (y: number, x0: number, x1: number, c: string) => {
    for (let x = x0; x <= x1; x++) U(x, y, c);
  };
  if (pose.mouth === 0) {
    if (mens) {
      row(22, 30, 33, lipDark);
      row(23, 31, 32, lip);
    } else {
      row(21, 30, 33, lip);
      row(22, 29, 34, lipDark);
      row(23, 29, 34, lip);
      U(31, 23, lipHi);
      row(24, 30, 33, lip);
    }
  } else if (pose.mouth === 1) {
    U(29, 21, lipDark);
    U(34, 21, lipDark);
    row(22, 30, 33, lipDark);
    row(23, 30, 33, lip);
    if (!mens) U(31, 23, lipHi);
  } else {
    U(29, 21, lipDark);
    U(34, 21, lipDark);
    U(29, 22, lipDark);
    U(34, 22, lipDark);
    row(22, 30, 33, "#fffaf4");
    row(23, 30, 33, mens ? lipDark : lip);
  }
}

// ---- garments ----

const spec = new Map(DEMO_SPECS.map((s) => [s.id, s]));
export const pixelSpec = (g: Garment): DemoSpec | undefined => spec.get(g.id);

type Sleeves = "none" | "short" | "long";
const TOPS: Partial<Record<Shape, { to: number; sleeves: Sleeves; from?: number; neck?: "v" | "high" | "scoop" }>> = {
  tank: { to: 62, sleeves: "none", from: 34 },
  tee: { to: 62, sleeves: "short", neck: "scoop" },
  cropTop: { to: 49, sleeves: "short", from: 33 },
  corset: { to: 60, sleeves: "none", from: 35 },
  vest: { to: 63, sleeves: "none", neck: "v" },
  blouse: { to: 63, sleeves: "long", neck: "scoop" },
  blazer: { to: 68, sleeves: "long", neck: "v" },
  cropJacket: { to: 51, sleeves: "long", neck: "v" },
  turtleneck: { to: 63, sleeves: "long", neck: "high" },
  hoodie: { to: 68, sleeves: "long", neck: "high" },
  chore: { to: 68, sleeves: "long", neck: "v" },
  puffer: { to: 66, sleeves: "long", neck: "high" },
  bralette: { to: 42, sleeves: "none", from: 34 },
};

// A top's sleeves, cut from the arms themselves so they follow any pose.
function sleeveMask(b: Body, s: Shape): Mask | null {
  const t = TOPS[s];
  if (!t || t.sleeves === "none") return null;
  const m = t.sleeves === "short" ? grow(b.shortSleeves) : grow(or(b.armL, b.armR));
  return s === "puffer" ? grow(m) : m;
}

function topMask(b: Body, s: Shape): Mask | null {
  const t = TOPS[s];
  if (!t) return null;
  const from = t.from ?? 31;
  let m = rows(grow(b.torso), from, t.to);
  if (s === "puffer") m = grow(m);
  if (t.neck === "high") m = or(m, grow(rows(b.neck, 27, 32)));
  if (t.neck === "v") m = minus(m, poly([[29, 30], [35, 30], [32, s === "vest" ? 40 : 45]]));
  if (t.neck === "scoop") m = minus(m, ellipse(32, 30, 3.5, 2.5));
  if (s === "tank" || s === "corset" || s === "bralette") m = or(m, straps(b.torso));
  return m;
}

// The waist sits at y 56; every skirt and pair of shorts reaches well past
// where the legs part (y 67).
function bottomMask(b: Body, s: Shape): Mask | null {
  const legs = or(b.legL, b.legR);
  const hips = rows(grow(or(b.torso, legs)), 56, CROTCH);
  switch (s) {
    case "mini": return or(hips, poly([[21, 56], [43, 56], [46.5, 79], [17.5, 79]]));
    case "aline": return or(hips, poly([[22, 56], [42, 56], [48, 87], [16, 87]]));
    case "midi": return or(hips, poly([[22, 56], [42, 56], [47, 100], [17, 100]]));
    case "maxi": return or(hips, poly([[22, 56], [42, 56], [48, 115], [16, 115]]));
    case "shorts": return or(hips, rows(grow(legs), 56, 77));
    case "leggings": return or(hips, rows(legs, 56, 113));
    case "pants": return or(hips, rows(grow(legs), 56, 114));
    case "joggers": return or(hips, rows(grow(legs), 56, 112));
    case "wideLeg": return or(hips, poly([[21, 58], [32.6, CROTCH], [31, 115], [17.5, 115]]), poly([[31.4, CROTCH], [43, 58], [46.5, 115], [33, 115]]));
    default: return null;
  }
}

const dressMask = (b: Body): Mask => or(rows(grow(b.torso), 34, 58), poly([[23, 50], [41, 50], [47, 88], [17, 88]]), straps(b.torso));

// a gap down the middle, so a pair of shoes (or socks) stays a pair
function parted(m: Mask): Mask {
  const out = m.slice();
  for (let y = 0; y < GRID_H; y++) for (const x of [62, 63, 64, 65]) out[idx(x, y)] = 0;
  return out;
}

function shoeMask(b: Body, s: Shape): Mask {
  const legs = or(b.legL, b.legR);
  if (s === "boots") return parted(or(grow(b.feet), rows(grow(legs), 97, 117)));
  if (s === "cowboyBoots") return parted(or(grow(b.feet), rows(grow(legs), 93, 117)));
  if (s === "sneakers") return parted(grow(rows(b.feet, 114, 120)));
  return parted(or(b.feet, rows(grow(b.feet), 118, 120)));
}

const isHat = (g: Garment) => g.category === "hats";

// Draws one pixel garment onto the figure.
function drawGarment(px: RGBA, b: Body, look: PixelLook, g: Garment, s: DemoSpec) {
  const outline = darker(baseOf(s.fill));
  const fill = (m: Mask) => fillMask(px, m, (x, y) => patternAt(s.fill, x, y), outline);
  const legs = or(b.legL, b.legR);
  switch (g.category) {
    case "pantyhose":
      if (s.shape === "socks") return fill(parted(rows(legs, 99, 116)));
      return fillMask(px, rows(legs, 62, 116), (x, y) => (s.name.includes("Fishnet") ? ((x + y) % 3 ? look.skin : "#1a1420") : patternAt(s.fill, x, y)), outline);
    case "shoes": {
      fill(shoeMask(b, s.shape));
      if (s.shape === "sneakers") fillMask(px, parted(rows(grow(b.feet), 120, 120)), "#f4f4f4", undefined, false);
      if (s.shape === "heels") for (const x of [22.5, 41.5]) for (let y = 121; y <= 122; y++) unit(px, x, y, outline);
      return;
    }
    case "scarves": {
      if (s.shape === "bandana") return fill(poly([[26, 28], [38, 28], [32, 36]]));
      return fill(or(rect(26, 28, 38, 32), rect(35, 32, 37, 47)));
    }
    case "jewelry": {
      const kind = jewelryKind(g.name);
      const color = baseOf(s.fill);
      if (kind === "ears") {
        for (const [ex, ey] of [b.earL, b.earR]) {
          if (s.shape === "hoops") for (let a = 0; a < 14; a++) dot(px, ex * K + 1 + Math.cos((a / 14) * Math.PI * 2) * 2.5, (ey + 3.5) * K + Math.sin((a / 14) * Math.PI * 2) * 3, color);
          else unit(px, ex, ey + 1.5, color);
        }
        return;
      }
      if (kind === "wrist" || kind === "hand") {
        const [hx, hy] = b.handL;
        for (let dx = -3; dx <= 3; dx++) unit(px, hx + dx * 0.6, hy - (kind === "hand" ? -1 : 3), color);
        return;
      }
      // a necklace: a curve of beads or chain under the collarbone
      for (let a = 0; a <= 18; a++) {
        const t = (a / 18) * Math.PI;
        if (s.shape === "pearls" && a % 2) continue;
        dot(px, 64 + Math.cos(t) * 9, 64 + Math.sin(t) * 7, color);
        if (s.shape === "pearls") dot(px, 64 + Math.cos(t) * 9 + 1, 64 + Math.sin(t) * 7, lighter(color, 0.4));
      }
      if (s.shape === "pendant") unit(px, 32, 35.5, color);
      return;
    }
    case "bags": {
      const color = baseOf(s.fill);
      const [hx, hy] = b.handR;
      if (s.shape === "backpack") return fillMask(px, or(rect(25.5, 31, 26.5, 50), rect(37.5, 31, 38.5, 50)), color, outline, false);
      if (s.shape === "shoulderBag") {
        for (let k = 0; k <= 46; k++) dot(px, (40 + k * 0.16) * K, (31 + k * 0.52) * K, outline);
        return fill(rect(44, 54, 53, 62));
      }
      if (s.shape === "tote") return fill(or(rect(hx - 4, hy - 1, hx + 6, hy + 10), rect(hx - 3, hy - 4, hx - 2, hy - 1), rect(hx + 4, hy - 4, hx + 5, hy - 1)));
      return fill(rect(hx - 2, hy + 1, hx + 5, hy + 7));
    }
    case "hats": {
      if (s.shape === "cowboyHat") return fill(or(rect(17, 6, 47, 8), poly([[24, 6], [26, -1], [32, 1], [38, -1], [40, 6]])));
      if (s.shape === "cap") return fill(or(and(ellipse(32, 8, 11, 7.5), rect(0, 0, U_W - 1, 8)), rect(36, 7, 47, 8)));
      if (s.shape === "bucketHat") return fill(or(and(ellipse(32, 8, 10, 7), rect(0, 0, U_W - 1, 8)), rect(19, 7, 45, 9)));
      return fill(or(and(ellipse(32, 8, 11, 8), rect(0, 0, U_W - 1, 9)), rect(21, 8, 43, 10)));
    }
  }
  if (g.category === "dresses" || s.shape === "dress") return fill(dressMask(b));
  const top = topMask(b, s.shape);
  if (top) {
    fill(top);
    // the sleeves go on after (over the clothes, with the arms, in a pose)
    const sleeves = sleeveMask(b, s.shape);
    if (sleeves && !b.posed) fill(sleeves);
    if (s.band) fillMask(px, rows(top, (TOPS[s.shape]?.to ?? 60) - 2, TOPS[s.shape]?.to ?? 60), s.band, undefined, false);
    // a blazer or jacket shows a white shirt in its V
    if (TOPS[s.shape]?.neck === "v" && s.shape !== "vest") fillMask(px, and(poly([[30, 31], [34, 31], [32, 42]]), b.torso), "#f4f2f6", undefined, false);
    return;
  }
  const bottom = bottomMask(b, s.shape);
  if (bottom) {
    fill(bottom);
    if (s.shape === "joggers") fillMask(px, rows(bottom, 110, 112), outline, undefined, false);
  }
}

// In a pose the arms cross in front of the clothes: they're drawn last,
// then each top's sleeves over them.
function drawSleeves(px: RGBA, b: Body, s: DemoSpec) {
  const sleeves = sleeveMask(b, s.shape);
  if (sleeves) fillMask(px, sleeves, (x, y) => patternAt(s.fill, x, y), darker(baseOf(s.fill)));
}

// Layering order, bottom to top.
const ORDER = ["pantyhose", "bottom", "top", "shoes", "scarves", "jewelry", "bags", "hats"];
const layerOf = (g: Garment) => (g.slot === "top" ? "top" : g.slot === "bottom" ? "bottom" : g.category);

// Whether every piece is one the pixel model knows how to wear.
export const canWearPixel = (pieces: Garment[]) => pieces.every((g) => spec.has(g.id));

// ---- putting her together ----

function toCanvas(px: RGBA): HTMLCanvasElement {
  const c = makeCanvas(GRID_W, GRID_H);
  c.getContext("2d")!.putImageData(new ImageData(px, GRID_W, GRID_H), 0, 0);
  return c;
}

// Everything that makes up the figure in one look and outfit, built in
// layers (hair behind; body; clothes; face; hair in front; hats) so each
// frame of the animation is just those layers stacked: the body and clothes
// are drawn once per arm position, the face once per expression.
export function pixelScene(look: PixelLook, pieces: Garment[]) {
  const sorted = [...pieces].sort((p, q) => ORDER.indexOf(layerOf(p)) - ORDER.indexOf(layerOf(q)));
  const worn = sorted.filter((g) => spec.has(g.id));
  const once = <T,>(make: () => T) => {
    let v: T | undefined;
    return () => (v ??= make());
  };
  const hairBack = once(() => {
    const px = newBuffer();
    drawHair(px, look, 0);
    return toCanvas(px);
  });
  const hairFront = once(() => {
    const px = newBuffer();
    drawHair(px, look, 1);
    return toCanvas(px);
  });
  const hats = once(() => {
    const px = newBuffer();
    const b = bodyOf(look.figure, 0, 0);
    for (const g of worn.filter(isHat)) drawGarment(px, b, look, g, spec.get(g.id)!);
    return toCanvas(px);
  });
  const bodies = new Map<string, HTMLCanvasElement>();
  const bodyLayer = (pose: Pose, dressed: boolean) => {
    const stance = pose.stance ?? "idle";
    const key = `${pose.armL},${pose.armR},${stance},${dressed}`;
    let c = bodies.get(key);
    if (!c) {
      const px = newBuffer();
      const b = bodyOf(look.figure, pose.armL, pose.armR, stance);
      drawBody(px, look, b);
      if (dressed) for (const g of worn) if (!isHat(g)) drawGarment(px, b, look, g, spec.get(g.id)!);
      if (b.posed) {
        drawArms(px, look, b);
        if (dressed) for (const g of worn) if (g.slot === "top" && !isHat(g)) drawSleeves(px, b, spec.get(g.id)!);
      }
      c = toCanvas(px);
      bodies.set(key, c);
    }
    return c;
  };
  const faces = new Map<string, HTMLCanvasElement>();
  const faceLayer = (pose: Pose) => {
    const key = `${pose.blink},${pose.gaze},${pose.mouth},${pose.brow}`;
    let c = faces.get(key);
    if (!c) {
      const px = newBuffer();
      drawFace(px, look, pose);
      c = toCanvas(px);
      faces.set(key, c);
    }
    return c;
  };
  const frame = (pose: Pose, dressed: boolean): HTMLCanvasElement => {
    const c = makeCanvas(GRID_W, GRID_H);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(hairBack(), 0, 0);
    ctx.drawImage(bodyLayer(pose, dressed), 0, 0);
    ctx.drawImage(faceLayer(pose), 0, 0);
    ctx.drawImage(hairFront(), 0, 0);
    if (dressed) ctx.drawImage(hats(), 0, 0);
    return c;
  };
  // every arm position the animation can reach, so they can be drawn ahead
  const armSteps = [-1, -0.5, 0, 0.5, 1];
  const warmups = armSteps.flatMap((armL) => armSteps.map((armR) => () => bodyLayer({ ...REST, armL, armR }, true)));
  return {
    /** the figure in her underwear, standing still */
    bare: () => frame(REST, false),
    /** dressed, in a pose */
    dressed: (pose: Pose = REST) => frame(pose, true),
    /** whether this pose can be shown without drawing anything new */
    ready: (pose: Pose) => bodies.has(`${pose.armL},${pose.armR},${pose.stance ?? "idle"},true`),
    /** draws one more arm position ahead of time; false when all are done */
    warm: () => {
      const next = warmups.shift();
      next?.();
      return warmups.length > 0;
    },
  };
}

// Scales a figure up to `cw` x `ch` canvas pixels: whole pixels, centred,
// with a margin so she never touches the edges.
export function fitFigure(small: HTMLCanvasElement, cw: number, ch: number, into?: CanvasRenderingContext2D): HTMLCanvasElement | undefined {
  const s = Math.max(1, Math.floor(Math.min((cw * 0.96) / GRID_W, (ch * 0.94) / GRID_H)));
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, Math.round((cw - GRID_W * s) / 2), Math.round((ch - GRID_H * s) / 2), GRID_W * s, GRID_H * s);
  };
  if (into) return draw(into), undefined;
  const out = makeCanvas(cw, ch);
  draw(out.getContext("2d")!);
  return out;
}
