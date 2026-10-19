import { GLYPH_ROWS, layoutText, wrapText } from "../pixel/font";
import { makeCanvas } from "../pixel/raster";
import type { Garment } from "./types";

// STRIKE A POSE: the pixel model, posed, on a little keepsake board: a
// pastel background with pixel hearts, a polaroid with sparkles round her,
// an AS IF! sticker, and a caption with the date and what she's wearing.
// Built at 360x480 board pixels, then scaled up 3x so it stays crisp.

const BW = 360;
const BH = 480;
const SCALE = 3;

const THEMES = [
  { bg: "#ffd6e7", deep: "#e889ae", light: "#fff0f6", ink: "#6a2a48" }, // pink
  { bg: "#e2dcff", deep: "#9f8fe6", light: "#f4f1ff", ink: "#3a2a6a" }, // lavender
  { bg: "#d4f2e4", deep: "#7cc8a2", light: "#effbf5", ink: "#1f4a38" }, // mint
  { bg: "#fff1c2", deep: "#e8c25a", light: "#fffaea", ink: "#5a4210" }, // butter
];

const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
const SPARKLE = ["...#...", "...#...", ".#####.", "###.###", ".#####.", "...#...", "...#..."];

function sprite(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, color: string) {
  ctx.fillStyle = color;
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && ctx.fillRect(x + i, y + j, 1, 1)));
}

// pixel-font text, centred on `cx` when `center`
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, center = true, bold = false) {
  const { cells, width } = layoutText(s, { bold });
  const x0 = center ? Math.round(x - (width * size) / 2) : x;
  ctx.fillStyle = color;
  for (const [cx, cy] of cells) ctx.fillRect(x0 + cx * size, y + cy * size, size, size);
}

// the smallest box round everything drawn in a canvas
function bounds(c: HTMLCanvasElement) {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// `figure` is the posed model at 1 pixel per board pixel (the pixel scene).
export function poseBoard(figure: HTMLCanvasElement, pieces: Garment[], name: string, themeIndex: number): HTMLCanvasElement {
  const t = THEMES[themeIndex % THEMES.length];
  const board = makeCanvas(BW, BH);
  const ctx = board.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // background with a scatter of hearts
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, BW, BH);
  for (let y = 6; y < BH; y += 30)
    for (let x = ((y / 30) % 2) * 15 + 4; x < BW; x += 30) sprite(ctx, HEART, x, y, t.light);
  // a border: deep, then white
  ctx.fillStyle = t.deep;
  ctx.fillRect(0, 0, BW, 6);
  ctx.fillRect(0, BH - 6, BW, 6);
  ctx.fillRect(0, 0, 6, BH);
  ctx.fillRect(BW - 6, 0, 6, BH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(8, 8, BW - 16, 2);
  ctx.fillRect(8, BH - 10, BW - 16, 2);
  ctx.fillRect(8, 8, 2, BH - 16);
  ctx.fillRect(BW - 10, 8, 2, BH - 16);

  // the polaroid, with a hard shadow
  const P = { x: 44, y: 34, w: 272, h: 352 };
  ctx.fillStyle = t.deep;
  ctx.fillRect(P.x + 5, P.y + 5, P.w, P.h);
  ctx.fillStyle = "#141433";
  ctx.fillRect(P.x - 2, P.y - 2, P.w + 4, P.h + 4);
  ctx.fillStyle = "#fffdfb";
  ctx.fillRect(P.x, P.y, P.w, P.h);
  // the photo: a soft backdrop with a floor
  const F = { x: P.x + 12, y: P.y + 12, w: P.w - 24, h: 270 };
  ctx.fillStyle = t.light;
  ctx.fillRect(F.x, F.y, F.w, F.h);
  ctx.fillStyle = t.bg;
  ctx.fillRect(F.x, F.y + F.h - 34, F.w, 34);
  ctx.fillStyle = t.deep;
  ctx.fillRect(F.x, F.y + F.h - 34, F.w, 2);
  // the model, feet on the floor
  const b = bounds(figure);
  const fx = Math.round(F.x + (F.w - b.w) / 2);
  const fy = F.y + F.h - 14 - b.h;
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(fx + 6, F.y + F.h - 16, b.w - 12, 4);
  ctx.drawImage(figure, b.x, b.y, b.w, b.h, fx, Math.max(F.y + 2, fy), b.w, b.h);
  // sparkles
  for (const [x, y] of [[F.x + 16, F.y + 22], [F.x + F.w - 28, F.y + 40], [F.x + 26, F.y + 120], [F.x + F.w - 22, F.y + 150]] as const) sprite(ctx, SPARKLE, x, y, "#ffffff");
  for (const [x, y] of [[F.x + F.w - 40, F.y + 90], [F.x + 40, F.y + 70]] as const) sprite(ctx, SPARKLE, x, y, t.deep);
  // the caption on the polaroid
  text(ctx, "STRIKE A POSE!", P.x + P.w / 2, F.y + F.h + 14, 2, "#141433", true, true);
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  text(ctx, `${name} - ${date}`, P.x + P.w / 2, F.y + F.h + 38, 1, t.ink);

  // an AS IF! sticker over the corner
  const S = { x: P.x + P.w - 70, y: P.y - 16, w: 84, h: 28 };
  ctx.fillStyle = "#141433";
  ctx.fillRect(S.x - 2, S.y - 2, S.w + 4, S.h + 4);
  ctx.fillStyle = "#f08ab8";
  ctx.fillRect(S.x, S.y, S.w, S.h);
  ctx.fillStyle = "#ffd0e4";
  ctx.fillRect(S.x, S.y, S.w, 3);
  text(ctx, "AS IF!", S.x + S.w / 2, S.y + 7, 2, "#ffffff", true, true);

  // under the polaroid: the closet's name and the outfit
  text(ctx, "CHER'S CLOSET", BW / 2, P.y + P.h + 16, 2, t.ink, true, true);
  const outfit = pieces.map((g) => g.name.toUpperCase()).join(" + ");
  wrapText(outfit, BW - 40).slice(0, 2).forEach((line, i) => text(ctx, line, BW / 2, P.y + P.h + 38 + i * (GLYPH_ROWS + 3), 1, t.ink));

  const out = makeCanvas(BW * SCALE, BH * SCALE);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(board, 0, 0, out.width, out.height);
  return out;
}

// Saves the board: the share sheet where there is one (phones: Save Image),
// otherwise a download.
export async function saveBoard(board: HTMLCanvasElement, filename = "cher-closet-pose.png") {
  const blob = await new Promise<Blob | null>((done) => board.toBlob(done, "image/png"));
  if (!blob) return;
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: "Strike a pose" });
      return;
    } catch (e) {
      // closing the share sheet is a choice, not a failure
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
