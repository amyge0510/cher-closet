import { fillSeams, keepMainBlobs } from "./cutout";

// Cleans up the edge of a cut-out, in place on RGBA pixels:
// 1. Edge pixels whose color isn't found anywhere inside the garment (a bit
//    of green hedge left on a white top) are cleared.
// 2. The outline is smoothed: small nicks fill in and jagged steps round off.
// 3. The edge is softened by about a pixel, so it doesn't look cut with
//    pinking shears.
export function smoothEdges(d: Uint8ClampedArray, w: number, h: number) {
  const n = w * h;
  let mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) mask[p] = d[p * 4 + 3] >= 128 ? 1 : 0;

  // 1. the garment's own colors, from well inside its edge
  let interior = mask;
  for (let i = 0; i < 4; i++) interior = erode(interior, w, h);
  const palette = coreColors(d, interior);
  if (palette.length) {
    for (let p = 0; p < n; p++) {
      if (!mask[p] || interior[p]) continue;
      const i = p * 4;
      let best = Infinity;
      for (const [r, g, b] of palette) best = Math.min(best, (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2);
      if (best > STRAY * STRAY) mask[p] = 0;
    }
    fillSeams(mask, w, h);
    keepMainBlobs(mask, w, h);
  }

  // 2. round the outline: blur the mask, then cut it at half
  const round = blur(mask, w, h, 2);
  const solid = new Uint8Array(n);
  for (let p = 0; p < n; p++) solid[p] = round[p] >= 0.5 ? 1 : 0;

  // pixels that just became part of the garment take their neighbours' color
  borrowColors(d, mask, solid, w, h);
  mask = solid;

  // 3. a soft, one-pixel edge
  const soft = blur(mask, w, h, 1);
  for (let p = 0; p < n; p++) d[p * 4 + 3] = Math.round(Math.min(mask[p] ? 1 : 0.6, soft[p]) * 255);
}

const STRAY = 70; // how far (RGB distance) an edge pixel may be from the garment's colors

function erode(m: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(m.length);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      out[p] = m[p] && m[p - 1] && m[p + 1] && m[p - w] && m[p + w] ? 1 : 0;
    }
  return out;
}

// The colors that make up nearly all of the masked area, as RGB averages of
// coarse color buckets.
function coreColors(d: Uint8ClampedArray, m: Uint8Array): [number, number, number][] {
  const buckets = new Map<number, [number, number, number, number]>();
  let total = 0;
  for (let p = 0; p < m.length; p++) {
    if (!m[p]) continue;
    const i = p * 4;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = buckets.get(k) ?? [0, 0, 0, 0];
    b[0] += d[i];
    b[1] += d[i + 1];
    b[2] += d[i + 2];
    b[3]++;
    buckets.set(k, b);
    total++;
  }
  const sorted = [...buckets.values()].sort((a, b) => b[3] - a[3]);
  const out: [number, number, number][] = [];
  let covered = 0;
  for (const [r, g, b, c] of sorted) {
    if (covered >= total * 0.97 || out.length >= 32) break;
    out.push([r / c, g / c, b / c]);
    covered += c;
  }
  return out;
}

// Box blur of a 0/1 mask (radius r), using a summed-area table. Values 0..1.
function blur(m: Uint8Array, w: number, h: number, r: number) {
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += m[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const sum = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  return out;
}

// Fills in the color of pixels that are in `after` but weren't in `before`,
// from the nearest pixels that were.
function borrowColors(d: Uint8ClampedArray, before: Uint8Array, after: Uint8Array, w: number, h: number) {
  const known = before.slice();
  for (let pass = 0; pass < 4; pass++) {
    const add: number[] = [];
    for (let p = 0; p < w * h; p++) {
      if (!after[p] || known[p]) continue;
      const x = p % w;
      let r = 0, g = 0, b = 0, c = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || !known[q]) continue;
        r += d[q * 4];
        g += d[q * 4 + 1];
        b += d[q * 4 + 2];
        c++;
      }
      if (!c) continue;
      d.set([r / c, g / c, b / c], p * 4);
      add.push(p);
    }
    for (const p of add) known[p] = 1;
  }
}

// Makes a flat chroma-key background (from a Gemini redraw) transparent, and
// takes the key color's tint off the garment's edge.
export function keyOut(d: Uint8ClampedArray, w: number, h: number, key: "green" | "magenta") {
  const keyed = (i: number) =>
    key === "green"
      ? d[i + 1] > 100 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.4
      : d[i] > 100 && d[i + 2] > 100 && d[i + 1] < Math.min(d[i], d[i + 2]) * 0.7;
  const clear = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (keyed(p * 4)) clear[p] = 1;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (clear[p]) {
      d[i + 3] = 0;
      continue;
    }
    // de-spill the garment's edge (pixels next to the background)
    const x = p % w;
    const edge = (x > 0 && clear[p - 1]) || (x < w - 1 && clear[p + 1]) || (p >= w && clear[p - w]) || (p + w < w * h && clear[p + w]);
    if (!edge) continue;
    if (key === "green") d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]));
    else {
      const extra = Math.min(d[i], d[i + 2]) - d[i + 1];
      if (extra > 0) {
        d[i] -= extra * 0.6;
        d[i + 2] -= extra * 0.6;
      }
    }
  }
}
