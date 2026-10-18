import { makeCanvas } from "../pixel/raster";

// Where garments sit on a body photo, as fractions of the photo's box.
// Stored per photo once users upload their own (body_photos.anchors).
export type Anchor = { x: number; y: number; w: number; h: number };
// `extras` places accessories by category; ones without an anchor (underwear)
// aren't drawn on the body.
export type BodyAnchors = { top: Anchor; bottom: Anchor; extras: Record<string, Anchor> };

export const PLACEHOLDER_ANCHORS: BodyAnchors = {
  top: { x: 0.25, y: 0.165, w: 0.5, h: 0.3 },
  bottom: { x: 0.31, y: 0.415, w: 0.38, h: 0.2 },
  extras: {
    pantyhose: { x: 0.36, y: 0.5, w: 0.28, h: 0.44 },
    shoes: { x: 0.34, y: 0.885, w: 0.32, h: 0.09 },
    scarves: { x: 0.38, y: 0.15, w: 0.24, h: 0.17 },
    jewelry: { x: 0.43, y: 0.15, w: 0.14, h: 0.07 },
    bags: { x: 0.64, y: 0.37, w: 0.22, h: 0.15 },
  },
};

// Layering order on the body, bottom to top; "outfit" is the top and bottom.
export const LAYERS = ["pantyhose", "outfit", "shoes", "scarves", "jewelry", "bags"];

// A simple stand-in figure, used until the user uploads a full-body photo.
export function placeholderBody(w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const X = (f: number) => f * w;
  const Y = (f: number) => f * h;
  const skin = "#e9b9a0";
  const limb = (pts: [number, number][], width: number, color = skin) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
  };
  const poly = (pts: [number, number][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
  };

  // hair behind the shoulders
  poly([[0.42, 0.06], [0.58, 0.06], [0.61, 0.25], [0.39, 0.25]], "#d9b06a");
  // arms
  limb([[0.38, 0.19], [0.32, 0.33], [0.27, 0.47]], X(0.06));
  limb([[0.62, 0.19], [0.68, 0.33], [0.73, 0.47]], X(0.06));
  // legs
  limb([[0.43, 0.48], [0.42, 0.7], [0.43, 0.93]], X(0.09));
  limb([[0.57, 0.48], [0.58, 0.7], [0.57, 0.93]], X(0.09));
  // torso and neck
  poly([[0.37, 0.175], [0.63, 0.175], [0.61, 0.3], [0.6, 0.38], [0.63, 0.47], [0.37, 0.47], [0.4, 0.38], [0.39, 0.3]], skin);
  poly([[0.47, 0.12], [0.53, 0.12], [0.53, 0.18], [0.47, 0.18]], skin);
  // head and fringe
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(X(0.5), Y(0.095), X(0.065), Y(0.045), 0, 0, Math.PI * 2);
  ctx.fill();
  poly([[0.43, 0.08], [0.5, 0.05], [0.57, 0.08], [0.57, 0.06], [0.5, 0.045], [0.43, 0.06]], "#d9b06a");
  // underwear
  poly([[0.39, 0.23], [0.61, 0.23], [0.61, 0.275], [0.39, 0.275]], "#141018");
  poly([[0.37, 0.44], [0.63, 0.44], [0.64, 0.53], [0.51, 0.53], [0.5, 0.5], [0.49, 0.53], [0.36, 0.53]], "#141018");
  // shoes
  poly([[0.39, 0.93], [0.46, 0.93], [0.47, 0.96], [0.38, 0.96]], "#2a2030");
  poly([[0.54, 0.93], [0.61, 0.93], [0.62, 0.96], [0.53, 0.96]], "#2a2030");
  return c;
}
