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

export type HairStyle = "buns" | "waves" | "pony" | "bob" | "puff" | "messy" | "curls" | "buzz" | "sidePart" | "long";
export type PixelLook = { figure: Figure; hair: HairStyle; hairColor: string; eyes: string; skin: string };

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "buns", label: "SPACE BUNS" },
  { id: "waves", label: "LONG WAVES" },
  { id: "pony", label: "PONYTAIL" },
  { id: "bob", label: "BOB" },
  { id: "puff", label: "AFRO PUFF" },
  { id: "messy", label: "MESSY" },
  { id: "curls", label: "CURLY TOP" },
  { id: "sidePart", label: "SIDE PART" },
  { id: "buzz", label: "BUZZ CUT" },
  { id: "long", label: "SHOULDER" },
];
export const HAIR_COLORS = [
  { label: "Honey blonde", hex: "#e2b04e" },
  { label: "Platinum", hex: "#ece0c0" },
  { label: "Brown", hex: "#5a3a2a" },
  { label: "Black", hex: "#2a2024" },
  { label: "Auburn", hex: "#a0442a" },
  { label: "Pink", hex: "#f08ab8" },
  { label: "Lavender", hex: "#b9a6f2" },
  { label: "Blue", hex: "#4a6ad8" },
];
export const EYE_COLORS = [
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
    ? { figure, hair: "messy", hairColor: "#5a3a2a", eyes: "#5a3418", skin: "#f2c6a8" }
    : { figure, hair: "buns", hairColor: "#e2b04e", eyes: "#3a5a9a", skin: "#f2c6a8" };

// ---- the idle animation ----

// One moment: each arm's swing (-1 in to 1 out, in halves), the eyes (0 open,
// 1 half shut, 2 shut), where she looks, her mouth (0 at rest, 1 a small
// smile, 2 a big one) and raised brows.
export type Pose = { armL: number; armR: number; blink: 0 | 1 | 2; gaze: -1 | 0 | 1; mouth: 0 | 1 | 2; brow: 0 | 1 };
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
export const poseKey = (p: Pose) => `${p.armL},${p.armR},${p.blink},${p.gaze},${p.mouth},${p.brow}`;

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
  handL: Pt; handR: Pt; earL: Pt; earR: Pt;
};

const CROTCH = 67;

const bodies = new Map<string, Body>();
function bodyOf(figure: Figure, armL: number, armR: number): Body {
  const key = `${figure}${armL},${armR}`;
  const hit = bodies.get(key);
  if (hit) return hit;
  const m = figure === "mens";
  const sh = m ? 1.6 : 0; // broader shoulders
  const handL: Pt = [17 - sh - armL * 1.8, 66];
  const handR: Pt = [47 + sh + armR * 1.8, 66];
  const legL: Pt[] = m
    ? [[21.5, 62], [32.6, 62], [32.4, CROTCH], [31.6, 88], [30.6, 115], [25.4, 115], [23.6, 88], [22, 74]]
    : [[21, 62], [32.6, 62], [32.4, CROTCH], [31.4, 88], [30.4, 115], [25.6, 115], [23.8, 88], [21.4, 74]];
  const body: Body = {
    torso: m
      ? poly([[20.5, 31], [43.5, 31], [43, 40], [41.6, 50], [41.6, 60], [42.4, 65], [21.6, 65], [22.4, 60], [22.4, 50], [21, 40]])
      : poly([[22.5, 31], [41.5, 31], [41, 38], [39.4, 47], [40.4, 53], [42.8, 59], [43, 65], [21, 65], [21.2, 59], [23.6, 53], [24.6, 47], [23, 38]]),
    armL: limb([[23.5 - sh, 33], [19.6 - sh - armL * 0.8, 49], handL.map((v, i) => (i ? v - 3 : v)) as Pt], m ? 5.4 : 4.6, m ? 3.8 : 3.2),
    armR: limb([[40.5 + sh, 33], [44.4 + sh + armR * 0.8, 49], handR.map((v, i) => (i ? v - 3 : v)) as Pt], m ? 5.4 : 4.6, m ? 3.8 : 3.2),
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

// a small fixed scramble, so strands and tips vary column to column
const jitter = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const crown = (ry = 9) => and(ellipse(32, 12, 11.5, ry), rect(0, 0, U_W - 1, 12));
// a fringe of pointed locks across the forehead, from x0 to x1, hanging to y
const fringe = (x0: number, x1: number, y: number, locks = 6) => {
  const pts: Pt[] = [[x0, 6], [x1, 6]];
  const w = (x1 - x0) / locks;
  for (let i = locks; i >= 0; i--) {
    pts.push([x0 + i * w, y - (i % 2 ? 0 : 2.2) - jitter(i + y) * 1.2]);
  }
  return poly(pts);
};

// [behind the body, in front of the face]
function hairShapes(style: HairStyle): [Mask | null, Mask] {
  switch (style) {
    case "buns":
      return [null, or(crown(), fringe(22.5, 41.5, 12.5, 7), poly([[20, 9], [24, 9], [24, 30], [22, 32], [20, 30]]), poly([[40, 9], [44, 9], [44, 30], [42, 32], [40, 30]]), ellipse(21, 4, 5.5, 5), ellipse(43, 4, 5.5, 5))];
    case "waves": {
      const back = or(rect(19, 10, 45, 44), ...[20, 25, 30, 35, 40, 44].map((x, i) => ellipse(x, 45 + (i % 2), 2.8, 2.6)));
      return [back, or(crown(), poly([[21.5, 7], [42, 6], [42.5, 11], [33, 9.5], [27, 13], [22, 16]]), poly([[19.5, 10], [23.5, 10], [23, 30], [21, 40], [19, 38]]), poly([[40.5, 10], [44.5, 10], [45, 38], [43, 40], [41, 30]]))];
    }
    case "pony":
      return [poly([[37, 2], [45, 0], [51, 7], [51.5, 22], [49, 34], [46, 40], [45, 28], [43, 10]]), or(crown(8.5), poly([[21.5, 8], [30, 7], [27, 12], [22.5, 17]]), rect(21, 9, 22.5, 19), rect(41.5, 9, 43, 19))];
    case "bob":
      return [null, or(crown(), fringe(22.5, 41.5, 12, 7), poly([[20, 8], [24, 8], [24, 26], [22.5, 28], [19, 28]]), poly([[40, 8], [44, 8], [45, 28], [41.5, 28], [40, 26]]))];
    case "puff":
      return [null, or(and(ellipse(32, 12, 10.5, 8.5), rect(0, 0, U_W - 1, 10)), ellipse(32, 0.5, 9, 6.5))];
    case "messy": {
      // tousled: a full crown, a choppy fringe falling into the eyes, and a
      // few strands sticking up
      const spikes = poly([[22, 6], [24, 1.5], [26.5, 4.5], [29, -0.5], [31.5, 3.5], [35, 0], [36.5, 4], [40.5, 1.5], [41, 6]]);
      return [null, or(crown(9.5), spikes, fringe(22, 42, 14.5, 8), rect(21, 9, 22.5, 18), rect(41.5, 9, 43, 18), poly([[42, 7], [45.5, 5], [44, 10]]), poly([[22, 7], [18.5, 6], [20.5, 11]]))];
    }
    case "curls":
      return [null, or(and(or(ellipse(32, 8, 11.5, 6.5), ellipse(23, 5, 4.5, 4.5), ellipse(29, 2.5, 5, 4), ellipse(36, 2.5, 5, 4), ellipse(41.5, 6, 4.5, 4.5)), rect(0, 0, U_W - 1, 11)), rect(21, 10, 22.5, 17), rect(41.5, 10, 43, 17))];
    case "buzz":
      return [null, or(and(ellipse(32, 13, 10.5, 9.5), rect(0, 0, U_W - 1, 8)), rect(21.5, 8, 22.5, 14), rect(41.5, 8, 42.5, 14))];
    case "sidePart":
      return [null, or(and(ellipse(32, 12, 11, 9), rect(0, 0, U_W - 1, 10)), poly([[21.5, 7], [43, 5], [43.5, 10.5], [31, 8.5], [23, 13.5]]), rect(21, 9, 22.5, 16), rect(41.5, 9, 43, 16))];
    case "long":
      return [rect(20, 10, 44, 33), or(crown(), poly([[21.5, 7], [31.5, 6], [27, 11], [22.5, 15]]), poly([[32.5, 6], [42.5, 7], [41.5, 15], [37, 11]]), rect(20, 10, 22.5, 32), rect(41.5, 10, 44, 32))];
  }
}

// Paints hair the way pixel artists do: a base color with darker clumps of
// strands, deeper shadow toward the sides and under the crown, a curved band
// of shine near the top, uneven tips, and a dark outline.
function paintHair(px: RGBA, m: Mask, base: string, curly: boolean) {
  const hi = lighter(base, 0.38);
  const soft = lighter(base, 0.16);
  const mid = darker(base, 0.8);
  const deep = darker(base, 0.62);
  const ink = darker(base, 0.42);
  const top = new Int16Array(GRID_W).fill(-1);
  const bottom = new Int16Array(GRID_W).fill(-1);
  for (let x = 0; x < GRID_W; x++)
    for (let y = 0; y < GRID_H; y++)
      if (m[idx(x, y)]) {
        if (top[x] < 0) top[x] = y;
        bottom[x] = y;
      }
  // uneven tips: each column ends a pixel or two short of the next
  const trimmed = m.slice();
  for (let x = 0; x < GRID_W; x++) if (bottom[x] - top[x] > 16) for (let k = 0; k < Math.floor(jitter(x >> 1) * 3); k++) trimmed[idx(x, bottom[x] - k)] = 0;
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (!trimmed[idx(x, y)]) continue;
      if (isEdge(trimmed, x, y)) {
        dot(px, x, y, ink);
        continue;
      }
      const depth = y - top[x];
      let c = base;
      if (curly) {
        // little round curls: a light top-left, a dark bottom-right on each
        const cx = (x + ((y >> 2) % 2) * 2) % 4;
        const cy = y % 4;
        c = cx + cy <= 1 ? soft : cx + cy >= 5 ? deep : (x * 7 + y * 3) % 11 === 0 ? mid : base;
        if (depth < 6 && (x + y) % 3 === 0) c = hi;
      } else {
        // rounded locks, about 6 pixels wide, fanning out from the crown:
        // each lit on its left, shaded on its right, with a thin dark line
        // where two locks meet (broken here and there)
        const fan = x - ((x - GRID_W / 2) * Math.min(depth, 24)) / 48;
        const lockW = 6;
        const lock = Math.floor((fan + jitter(Math.floor(fan / lockW)) * 2) / lockW);
        const u = (fan - lock * lockW) / lockW;
        if (u < 0.22) c = soft;
        else if (u > 0.78) c = mid;
        if (u > 0.9 && (y + lock * 5) % 9 > 1) c = deep;
        // the shine: a curved band a little below the top of each column
        const band = 7 + Math.round(Math.abs(x - GRID_W / 2) * 0.05);
        if (depth >= band && depth <= band + 2 && u > 0.1 && u < 0.7) c = depth === band + 1 ? hi : soft;
      }
      // volume: darker toward the sides and at the very ends
      const l = x > 2 && !trimmed[idx(x - 3, y)];
      const r = x < GRID_W - 3 && !trimmed[idx(x + 3, y)];
      if (l || r) c = c === hi || c === soft ? base : mid;
      if (bottom[x] - y < 3) c = deep;
      dot(px, x, y, c);
    }
}

function hairMask(look: PixelLook, layer: 0 | 1): Mask | null {
  return hairShapes(look.hair)[layer];
}

function drawHair(px: RGBA, look: PixelLook, layer: 0 | 1) {
  const m = hairMask(look, layer);
  if (!m) return;
  paintHair(px, m, look.hairColor, look.hair === "curls" || look.hair === "puff");
  // ties and scrunchies in a contrasting color
  if (layer === 1 && look.hair === "buns") for (const cx of [21, 43]) for (let x = cx - 4; x <= cx + 4; x++) for (const y of [8.5, 9.5]) unit(px, x, y, (x + Math.round(y)) % 2 ? "#c8b8f8" : "#a894e8");
  if (layer === 1 && look.hair === "puff") for (let x = 24; x <= 40; x++) unit(px, x, 5.5, x % 2 ? "#f08ab8" : "#d86a9a");
  if (layer === 0 && look.hair === "pony") for (let x = 41; x <= 44; x++) unit(px, x, 3, "#f08ab8");
}

// ---- the body ----

function drawBody(px: RGBA, look: PixelLook, b: Body) {
  const skin = look.skin;
  const shade = darker(skin, 0.86);
  const line = darker(skin, 0.64);
  fillMask(px, or(b.armL, b.armR, b.hands), skin, line);
  fillMask(px, or(b.legL, b.legR), skin, line);
  fillMask(px, or(b.torso, b.neck), skin, line);
  fillMask(px, b.ears, skin, line, false);
  fillMask(px, b.head, skin, line, false);
  fillMask(px, b.feet, skin, line, false);

  // a shadow under the chin, fingers, knees, toes, collarbones, navel
  for (let x = 59; x <= 69; x++) dot(px, x, 52, shade);
  for (let x = 60; x <= 68; x++) dot(px, x, 53, shade);
  for (const [hx, hy] of [b.handL, b.handR]) for (const dx of [-1.4, 0, 1.4]) for (let dy = 0.8; dy <= 2.8; dy += 0.5) dot(px, (hx + 0.5) * K + dx, (hy + dy) * K, line);
  for (const kx of [27.4, 36.6]) for (let dx = -2; dx <= 2; dx++) dot(px, kx * K + dx, 88 * K + Math.abs(dx) * 0.5, shade);
  for (const [fx, dir] of [[22, 1], [42, -1]] as const) for (let t = 0; t < 4; t++) dot(px, (fx + dir * t * 0.9) * K + 1, 119 * K, line);
  for (let dx = -6; dx <= 6; dx++) if (Math.abs(dx) > 1) dot(px, 64 + dx, 66 + Math.abs(dx) * 0.25, shade);
  dot(px, 64, 104, line);

  // underwear
  if (look.figure === "mens") fillMask(px, or(rows(b.torso, 58, 65), rows(or(b.legL, b.legR), 60, 72)), "#2a3a66", "#141c38");
  else {
    fillMask(px, rows(b.torso, 35, 41), "#1c1622", "#0c0a10");
    fillMask(px, or(rows(b.torso, 59, 65), rows(or(b.legL, b.legR), 62, CROTCH + 1)), "#1c1622", "#0c0a10");
  }
}

// The face, in real pixels, for a pose: brows, big eyes (or a blink), nose,
// mouth and cheeks. The head is centred on x 64, y 30.
function drawFace(px: RGBA, look: PixelLook, pose: Pose) {
  const P = (x: number, y: number, c: string) => dot(px, x, y, c);
  const mens = look.figure === "mens";
  const skin = look.skin;
  const shade = darker(skin, 0.84);
  const line = darker(skin, 0.62);
  const lash = "#1c1426";
  const brow = darker(look.hairColor, 0.62);
  const by = 24 - pose.brow;
  // brows: thin and slightly arched (straighter and thicker for him)
  for (const [x0, dir] of [[50, 1], [70, -1]] as const)
    for (let i = 0; i < 8; i++) {
      const x = dir === 1 ? x0 + i : x0 + 7 - i;
      P(x, by + (i === 0 || i === 7 ? 1 : 0), brow);
      if (mens && i > 0 && i < 7) P(x, by + 1, brow);
    }
  // eyes: 9 wide; outer corner flicks up
  for (const [x0, outer] of [[50, -1], [70, 1]] as const) {
    const y0 = 29;
    if (pose.blink === 2) {
      for (let i = 0; i < 9; i++) P(x0 + i, y0 + 4 + (i > 1 && i < 7 ? 1 : 0), lash);
      if (!mens) P(outer < 0 ? x0 - 1 : x0 + 9, y0 + 3, lash);
      continue;
    }
    const lid = pose.blink === 1 ? 2 : 0; // a half blink drops the upper lid
    for (let i = 1; i < 8; i++) P(x0 + i, y0 + lid, lash);
    for (let i = 0; i < 9; i++) if ((outer < 0 ? i < 4 : i > 4) || mens) P(x0 + i, y0 + lid + 1, lash);
    if (!mens) {
      const ox = outer < 0 ? x0 - 1 : x0 + 9;
      P(ox, y0 + lid, lash);
      P(ox + outer, y0 + lid - 1, lash);
    }
    const cx = x0 + 4 + pose.gaze * 1;
    for (let y = y0 + lid + 2; y <= y0 + 6; y++)
      for (let i = 1; i < 8; i++) {
        const x = x0 + i;
        const iris = Math.abs(x - cx) <= 2;
        P(x, y, iris ? (y <= y0 + lid + 2 ? darker(look.eyes, 0.6) : y >= y0 + 5 ? lighter(look.eyes, 0.25) : look.eyes) : "#fbf8f6");
      }
    for (let y = Math.max(y0 + 3, y0 + lid + 2); y <= y0 + 4; y++) for (const x of [cx, cx + 1]) P(x - (x === cx + 1 ? 1 : 0), y, "#120c1a");
    if (!lid) {
      P(cx - 1, y0 + 3, "#ffffff");
      P(cx - 2, y0 + 3, "#ffffff");
      P(cx + 1, y0 + 5, "#ffffff");
    }
    for (let i = 2; i < 7; i++) P(x0 + i, y0 + 7, line); // lower lash
  }
  // nose: a soft shadow and a nostril
  P(64, 37, shade);
  P(64, 38, shade);
  P(63, 40, line);
  P(65, 40, shade);
  // mouth
  const lip = mens ? mix(skin, "#a85a5a", 0.45) : "#d65a74";
  const lipDark = darker(lip, 0.78);
  const lipHi = lighter(lip, 0.35);
  if (pose.mouth === 0) {
    for (let x = 61; x <= 67; x++) P(x, 44, lipDark);
    if (!mens) {
      for (let x = 62; x <= 66; x++) P(x, 45, lip);
      P(64, 45, lipHi);
    }
  } else if (pose.mouth === 1) {
    P(60, 43, lipDark);
    P(68, 43, lipDark);
    for (let x = 61; x <= 67; x++) P(x, 44, lipDark);
    if (!mens) for (let x = 62; x <= 66; x++) P(x, 45, lip);
  } else {
    P(59, 42, lipDark);
    P(69, 42, lipDark);
    P(60, 43, lipDark);
    P(68, 43, lipDark);
    for (let x = 61; x <= 67; x++) P(x, 44, lipDark);
    for (let x = 61; x <= 67; x++) P(x, 45, "#fffaf4");
    for (let x = 62; x <= 66; x++) P(x, 46, lip);
  }
  // cheeks: soft blush, brighter when she smiles
  const blush = mix(skin, "#f07a8a", pose.mouth === 2 ? 0.5 : 0.36);
  for (const cx of [48, 76]) for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) if (!(j === 1 && (i === 0 || i === 4))) P(cx + i, 38 + j, blush);
  if (!mens) P(80, 41, darker(skin, 0.7)); // a beauty mark
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

function topMask(b: Body, s: Shape): Mask | null {
  const t = TOPS[s];
  if (!t) return null;
  const from = t.from ?? 31;
  let m = rows(grow(b.torso), from, t.to);
  if (t.sleeves === "short") m = or(m, rows(grow(or(b.armL, b.armR)), 30, 42));
  if (t.sleeves === "long") m = or(m, rows(grow(or(b.armL, b.armR)), 30, 63));
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

function shoeMask(b: Body, s: Shape): Mask {
  const legs = or(b.legL, b.legR);
  if (s === "boots") return or(grow(b.feet), rows(grow(legs), 97, 117));
  if (s === "cowboyBoots") return or(grow(b.feet), rows(grow(legs), 93, 117));
  if (s === "sneakers") return grow(rows(b.feet, 114, 120));
  return or(b.feet, rows(grow(b.feet), 118, 120));
}

const isHat = (g: Garment) => g.category === "hats";

// Draws one pixel garment onto the figure.
function drawGarment(px: RGBA, b: Body, look: PixelLook, g: Garment, s: DemoSpec) {
  const outline = darker(baseOf(s.fill));
  const fill = (m: Mask) => fillMask(px, m, (x, y) => patternAt(s.fill, x, y), outline);
  const legs = or(b.legL, b.legR);
  switch (g.category) {
    case "pantyhose":
      if (s.shape === "socks") return fill(rows(legs, 99, 116));
      return fillMask(px, rows(legs, 62, 116), (x, y) => (s.name.includes("Fishnet") ? ((x + y) % 3 ? look.skin : "#1a1420") : patternAt(s.fill, x, y)), outline);
    case "shoes": {
      fill(shoeMask(b, s.shape));
      if (s.shape === "sneakers") fillMask(px, rows(grow(b.feet), 120, 120), "#f4f4f4", undefined, false);
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
    const key = `${pose.armL},${pose.armR},${dressed}`;
    let c = bodies.get(key);
    if (!c) {
      const px = newBuffer();
      const b = bodyOf(look.figure, pose.armL, pose.armR);
      drawBody(px, look, b);
      if (dressed) for (const g of worn) if (!isHat(g)) drawGarment(px, b, look, g, spec.get(g.id)!);
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
    ready: (pose: Pose) => bodies.has(`${pose.armL},${pose.armR},true`),
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
