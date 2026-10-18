import { makeCanvas, trimCanvas } from "../pixel/raster";
import { slotFor } from "./categories";
import { demoSpecsFor, type DemoSpec, type Fill, type Shape } from "./demo";
import type { Wardrobe } from "../style/styles";
import type { Garment } from "./types";

// Shapes on a 100x100 grid. Tops hang from the shoulders, bottoms from the
// waist. A shape is filled polygons, rings (outer and inner radius) and
// ellipses, plus thick strokes for straps and chains.
type Pt = [number, number];
type ShapeDef = { polys?: Pt[][]; rings?: [number, number, number, number][]; ellipses?: [number, number, number, number][]; strokes?: { pts: Pt[]; w: number }[] };

const mirror = (pts: Pt[], dx: number): Pt[] => pts.map(([x, y]) => [x + dx, y]);
const sneaker: Pt[] = [[4, 52], [18, 42], [30, 44], [44, 58], [47, 70], [4, 70]];
const boot: Pt[] = [[8, 6], [26, 6], [27, 66], [44, 74], [45, 92], [8, 92]];
const heel: Pt[] = [[4, 56], [14, 50], [40, 66], [46, 76], [36, 76], [33, 92], [30, 92], [30, 76], [4, 76]];
const flat: Pt[] = [[4, 60], [16, 52], [38, 56], [46, 66], [44, 74], [4, 74]];
const loafer: Pt[] = [[4, 54], [14, 48], [36, 52], [46, 64], [46, 74], [4, 74]];
const leg: Pt[] = [[30, 0], [48, 0], [46, 96], [32, 96]];
const cowboyBoot: Pt[] = [[10, 4], [30, 4], [30, 62], [48, 80], [44, 90], [8, 90]];

const SHAPES: Record<Shape, ShapeDef> = {
  vest: { polys: [[[28, 4], [42, 4], [50, 34], [58, 4], [72, 4], [74, 18], [84, 30], [84, 96], [16, 96], [16, 30], [26, 18]]] },
  blazer: { polys: [[[32, 4], [44, 4], [50, 40], [56, 4], [68, 4], [90, 12], [98, 84], [86, 87], [80, 42], [80, 97], [20, 97], [20, 42], [14, 87], [2, 84], [10, 12]]] },
  cropJacket: { polys: [[[34, 4], [66, 4], [90, 12], [98, 92], [86, 95], [78, 44], [78, 72], [22, 72], [22, 44], [14, 95], [2, 92], [10, 12]]] },
  tee: { polys: [[[36, 4], [44, 9], [56, 9], [64, 4], [90, 18], [82, 36], [72, 31], [72, 96], [28, 96], [28, 31], [18, 36], [10, 18]]] },
  tank: { polys: [[[34, 4], [40, 4], [44, 16], [56, 16], [60, 4], [66, 4], [70, 26], [74, 30], [74, 96], [26, 96], [26, 30], [30, 26]]] },
  cropTop: { polys: [[[30, 20], [42, 20], [46, 28], [54, 28], [58, 20], [70, 20], [80, 30], [74, 38], [74, 72], [26, 72], [26, 38], [20, 30]]] },
  blouse: { polys: [[[34, 4], [44, 10], [56, 10], [66, 4], [90, 12], [98, 84], [86, 87], [80, 40], [78, 97], [22, 97], [20, 40], [14, 87], [2, 84], [10, 12]]] },
  corset: { polys: [[[28, 10], [50, 18], [72, 10], [76, 30], [72, 60], [74, 90], [50, 96], [26, 90], [28, 60], [24, 30]]] },
  turtleneck: { polys: [[[40, 0], [60, 0], [60, 8], [88, 14], [98, 84], [86, 87], [78, 38], [78, 97], [22, 97], [22, 38], [14, 87], [2, 84], [12, 14], [40, 8]]] },
  hoodie: { polys: [[[34, 0], [66, 0], [70, 12], [90, 16], [98, 84], [86, 87], [78, 40], [80, 97], [20, 97], [22, 40], [14, 87], [2, 84], [10, 16], [30, 12]]] },

  mini: { polys: [[[18, 6], [82, 6], [90, 92], [10, 92]]] },
  aline: { polys: [[[28, 6], [72, 6], [98, 92], [2, 92]]] },
  midi: { polys: [[[30, 2], [70, 2], [86, 98], [14, 98]]] },
  maxi: { polys: [[[36, 0], [64, 0], [92, 100], [8, 100]]] },
  pants: { polys: [[[24, 2], [76, 2], [82, 98], [56, 98], [50, 34], [44, 98], [18, 98]]] },
  wideLeg: { polys: [[[26, 2], [74, 2], [96, 98], [56, 98], [50, 30], [44, 98], [4, 98]]] },
  shorts: { polys: [[[20, 22], [80, 22], [88, 74], [54, 74], [50, 52], [46, 74], [12, 74]]] },
  leggings: { polys: [[[30, 2], [70, 2], [66, 98], [54, 98], [50, 30], [46, 98], [34, 98]]] },

  sneakers: { polys: [sneaker, mirror(sneaker, 50)] },
  boots: { polys: [boot, mirror(boot, 50)] },
  heels: { polys: [heel, mirror(heel, 50)] },
  flats: { polys: [flat, mirror(flat, 50)], strokes: [{ pts: [[14, 54], [24, 46], [30, 56]], w: 3 }, { pts: [[64, 54], [74, 46], [80, 56]], w: 3 }] },
  loafers: { polys: [loafer, mirror(loafer, 50)] },

  hoops: { rings: [[28, 50, 20, 13], [72, 50, 20, 13]] },
  pendant: { strokes: [{ pts: [[20, 6], [28, 40], [50, 62], [72, 40], [80, 6]], w: 3 }], ellipses: [[50, 72, 10, 12]] },
  pearls: { ellipses: Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.1 + (0.8 * i) / 10); return [50 - Math.cos(a) * 36, 20 + Math.sin(a) * 52, 6, 6] as [number, number, number, number]; }) },
  chain: { strokes: [{ pts: [[14, 10], [22, 50], [50, 72], [78, 50], [86, 10]], w: 6 }] },
  studs: { strokes: [{ pts: [[10, 40], [30, 58], [50, 64], [70, 58], [90, 40]], w: 10 }], polys: [[[28, 58], [32, 70], [36, 60]], [[48, 64], [50, 78], [54, 64]], [[64, 60], [68, 70], [72, 58]]] },

  scarf: { polys: [[[10, 10], [90, 10], [90, 30], [62, 30], [66, 96], [46, 96], [42, 30], [10, 30]]] },
  tights: { polys: [leg, mirror(leg, 22)] },
  socks: { polys: [[[26, 4], [44, 4], [44, 80], [48, 92], [22, 92], [26, 80]], [[56, 4], [74, 4], [74, 80], [78, 92], [52, 92], [56, 80]]] },
  bralette: { polys: [[[14, 30], [30, 12], [46, 44], [14, 50]], [[54, 44], [70, 12], [86, 30], [86, 50]], [[14, 48], [86, 48], [86, 58], [14, 58]]] },

  shoulderBag: { ellipses: [[50, 64, 40, 26]], strokes: [{ pts: [[16, 56], [30, 14], [70, 14], [84, 56]], w: 5 }] },
  tote: { polys: [[[14, 34], [86, 34], [80, 96], [20, 96]]], strokes: [{ pts: [[30, 36], [32, 8], [68, 8], [70, 36]], w: 4 }] },
  miniBag: { polys: [[[22, 46], [78, 46], [74, 86], [26, 86]]], strokes: [{ pts: [[34, 48], [40, 20], [60, 20], [66, 48]], w: 4 }] },

  chore: { polys: [[[32, 4], [68, 4], [92, 14], [96, 86], [84, 88], [80, 44], [80, 98], [20, 98], [20, 44], [16, 88], [4, 86], [8, 14]]] },
  puffer: { polys: [[[34, 2], [66, 2], [90, 12], [98, 80], [84, 84], [80, 46], [82, 94], [18, 94], [20, 46], [16, 84], [2, 80], [10, 12]]] },
  joggers: { polys: [[[28, 2], [72, 2], [70, 86], [66, 98], [54, 98], [52, 86], [50, 30], [48, 86], [46, 98], [34, 98], [30, 86]]] },
  cowboyBoots: { polys: [cowboyBoot, mirror(cowboyBoot, 50)] },
  watch: { polys: [[[42, 0], [58, 0], [58, 100], [42, 100]]], rings: [[50, 50, 20, 13]] },
  bandana: { polys: [[[6, 14], [94, 14], [50, 90]]] },
  backpack: { polys: [[[20, 22], [80, 22], [84, 96], [16, 96]]], strokes: [{ pts: [[38, 22], [40, 8], [60, 8], [62, 22]], w: 4 }] },
  cap: { polys: [[[10, 66], [14, 42], [28, 28], [50, 24], [72, 28], [86, 42], [88, 62], [98, 64], [96, 74], [10, 74]]] },
  beanie: { polys: [[[16, 84], [16, 46], [28, 26], [50, 18], [72, 26], [84, 46], [84, 84]]], ellipses: [[50, 14, 9, 8]] },
  cowboyHat: { polys: [[[30, 60], [32, 30], [42, 22], [50, 28], [58, 22], [68, 30], [70, 60], [98, 56], [92, 74], [8, 74], [2, 56]]] },
  bucketHat: { polys: [[[26, 30], [74, 30], [80, 60], [96, 76], [4, 76], [20, 60]]] },
};

const SIZE = 160;
const u = (n: number) => (n / 100) * SIZE;

function base(fill: Fill): string {
  return fill.kind === "split" ? base(fill.left) : fill.base;
}

function paint(ctx: CanvasRenderingContext2D, fill: Fill, x0: number, w: number) {
  ctx.fillStyle = base(fill);
  ctx.fillRect(x0, 0, w, SIZE);
  if (fill.kind === "plaid") {
    fill.lines.forEach((color, k) => {
      ctx.fillStyle = color;
      const off = k * Math.floor(fill.step / 2);
      for (let p = off; p < SIZE; p += fill.step) {
        ctx.fillRect(x0, p, w, k === 0 ? 2 : 1);
        ctx.fillRect(Math.max(x0, p), 0, k === 0 ? 2 : 1, SIZE);
      }
    });
  } else if (fill.kind === "stripe") {
    ctx.fillStyle = fill.line;
    for (let p = 0; p < SIZE; p += fill.step) {
      if (fill.vertical) ctx.fillRect(x0 + p, 0, 2, SIZE);
      else ctx.fillRect(x0, p, w, 2);
    }
  } else if (fill.kind === "dots") {
    ctx.fillStyle = fill.dot;
    for (let y = 0; y < SIZE; y += fill.step)
      for (let x = (y / fill.step) % 2 ? fill.step / 2 : 0; x < w; x += fill.step) ctx.fillRect(x0 + x, y, 3, 3);
  } else if (fill.kind === "knit") {
    ctx.fillStyle = fill.line;
    for (let x = 6; x < w; x += 14)
      for (let y = 0; y < SIZE; y += 6) {
        ctx.fillRect(x0 + x, y, 3, 3);
        ctx.fillRect(x0 + x + 3, y + 3, 3, 3);
      }
  } else if (fill.kind === "split") {
    paint(ctx, fill.left, x0, w / 2);
    paint(ctx, fill.right, x0 + w / 2, w / 2);
  }
}

function tracePath(ctx: CanvasRenderingContext2D, def: ShapeDef) {
  ctx.beginPath();
  for (const poly of def.polys ?? []) {
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(u(x), u(y)) : ctx.moveTo(u(x), u(y))));
    ctx.closePath();
  }
  for (const [cx, cy, r, inner] of def.rings ?? []) {
    ctx.moveTo(u(cx + r), u(cy));
    ctx.arc(u(cx), u(cy), u(r), 0, Math.PI * 2);
    ctx.moveTo(u(cx + inner), u(cy));
    ctx.arc(u(cx), u(cy), u(inner), 0, Math.PI * 2, true);
  }
  for (const [cx, cy, rx, ry] of def.ellipses ?? []) {
    ctx.moveTo(u(cx + rx), u(cy));
    ctx.ellipse(u(cx), u(cy), u(rx), u(ry), 0, 0, Math.PI * 2);
  }
}

export function drawDemo(spec: DemoSpec): string {
  const canvas = makeCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d")!;
  const def = SHAPES[spec.shape];
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const s of def.strokes ?? []) {
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(u(x), u(y)) : ctx.moveTo(u(x), u(y))));
    ctx.strokeStyle = "rgba(10,8,20,0.8)";
    ctx.lineWidth = u(s.w) + 2;
    ctx.stroke();
    ctx.strokeStyle = base(spec.fill);
    ctx.lineWidth = u(s.w);
    ctx.stroke();
  }

  if (def.polys || def.rings || def.ellipses) {
    ctx.save();
    tracePath(ctx, def);
    ctx.clip("evenodd");
    paint(ctx, spec.fill, 0, SIZE);
    if (spec.band) {
      ctx.fillStyle = spec.band;
      ctx.fillRect(0, SIZE * 0.82, SIZE, SIZE * 0.18);
    }
    // soft shading for a bit of depth
    const shade = ctx.createLinearGradient(0, 0, SIZE, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.25)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
    tracePath(ctx, def);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(10,8,20,0.8)";
    ctx.stroke();
  }
  return trimCanvas(canvas).toDataURL();
}

const images = new Map<string, string>();

// The demo rack for someone's wardrobe choice: womenswear, menswear, or both.
export function demoCloset(wardrobe?: Wardrobe | null): Garment[] {
  return demoSpecsFor(wardrobe).map((spec) => {
    const { shape, fill, band, audience, ...garment } = spec;
    if (!images.has(spec.id)) images.set(spec.id, drawDemo(spec));
    return { ...garment, slot: slotFor(garment.category), image: images.get(spec.id)! };
  });
}
