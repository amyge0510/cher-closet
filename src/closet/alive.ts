import { makeCanvas } from "../pixel/raster";

// The dressed photo, alive: it breathes, shifts its weight a little, the
// head and hair sway, and the eyes blink every few seconds. All drawn in the
// browser from the one still picture (nothing is sent anywhere): the body
// stretches and leans a hair from the feet, the rows above the chin slide
// sideways a touch (more at the top, so the hair moves most), and a blink
// paints each eye shut with the skin just above it for a moment.
//
// The eyes are found with Google's MediaPipe face model, loaded the first
// time a photo is shown (about 17 MB, then kept by the browser). If it can't
// find a face, the photo still breathes and sways, just without blinking.

type Eye = { x: number; y: number; w: number; h: number };
export type Face = { eyes: Eye[]; chin: number; top: number };

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// eye outlines on the face mesh: corner, upper lid, corner, lower lid
const EYES = [
  [33, 159, 133, 145],
  [362, 386, 263, 374],
];
const CHIN = 152;
const FOREHEAD = 10;

type Landmarker = { detect: (image: HTMLCanvasElement) => { faceLandmarks: { x: number; y: number }[][] } };
let landmarker: Promise<Landmarker | null> | null = null;
function loadLandmarker(): Promise<Landmarker | null> {
  landmarker ??= (async () => {
    try {
      const [{ FaceLandmarker }, loader, binary] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        import("@mediapipe/tasks-vision/vision_wasm_internal.js?url"),
        import("@mediapipe/tasks-vision/vision_wasm_internal.wasm?url"),
      ]);
      return await FaceLandmarker.createFromOptions(
        { wasmLoaderPath: loader.default, wasmBinaryPath: binary.default },
        { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE", numFaces: 1 },
      );
    } catch (e) {
      console.warn("couldn't load the face model, so no blinking:", e);
      return null;
    }
  })();
  return landmarker;
}

const found = new Map<string, Promise<Face | null>>();

// Where the eyes, chin and top of the head are in `photo` (canvas pixels).
// The face is small in a head-to-toe picture, so the model looks at
// blown-up crops of it, top first. `key` remembers the answer per picture.
export function findFace(photo: HTMLCanvasElement, key: string): Promise<Face | null> {
  let f = found.get(key);
  if (!f) {
    f = (async () => {
      const lm = await loadLandmarker();
      if (!lm) return null;
      // small overlapping pieces, top first (where the head is in a model
      // photo): the face model only finds faces that fill a good part of
      // what it's shown
      let crop = { x: 0, y: 0, w: 0, h: 0 };
      let pts: { x: number; y: number }[] | undefined;
      search: for (const top of [0, 0.12, 0.24, 0.36, 0.48]) {
        for (const left of [0.3, 0.1, 0.5]) {
          crop = { x: photo.width * left, y: photo.height * top, w: photo.width * 0.4, h: photo.height * 0.22 };
          const s = 512 / crop.w;
          const c = makeCanvas(Math.round(crop.w * s), Math.round(crop.h * s));
          const cctx = c.getContext("2d")!;
          cctx.imageSmoothingQuality = "high";
          cctx.drawImage(photo, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
          pts = lm.detect(c).faceLandmarks[0];
          if (pts) break search;
        }
      }
      if (!pts) return null;
      const lms = pts;
      const at = (i: number) => ({ x: crop.x + lms[i].x * crop.w, y: crop.y + lms[i].y * crop.h });
      const eyes = EYES.map(([a, up, b, down]) => {
        const [p, u, q, d] = [at(a), at(up), at(b), at(down)];
        return { x: (p.x + q.x) / 2, y: (u.y + d.y) / 2, w: Math.abs(q.x - p.x), h: Math.max(2, (d.y - u.y) * 1.6) };
      });
      const chin = at(CHIN).y;
      const forehead = at(FOREHEAD).y;
      return { eyes, chin, top: Math.max(0, forehead - (chin - forehead) * 0.9) };
    })().catch(() => null);
    found.set(key, f);
  }
  return f;
}

const BREATH_S = 4.2;
const SWAY_S = 7;
const FPS = 30;

// Animates `still` into `ctx` until the returned stop is called. `feet` is
// the bottom middle of the figure, which stays put while the body moves.
export function bringToLife(ctx: CanvasRenderingContext2D, still: HTMLCanvasElement, face: Face | null, feet: { x: number; y: number }): () => void {
  const { width: w, height: h } = still;
  const frame = makeCanvas(w, h);
  const fctx = frame.getContext("2d")!;
  // the flat background, for the edges the lean uncovers
  const bg = (() => {
    const d = still.getContext("2d")!.getImageData(1, 1, 1, 1).data;
    return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
  })();
  // each eye's lid color: the skin just above it
  const lids = (face?.eyes ?? []).map((e) => {
    const d = still.getContext("2d")!.getImageData(Math.round(e.x), Math.max(0, Math.round(e.y - e.h * 2.2)), 1, 1).data;
    return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
  });
  let raf = 0;
  let last = 0;
  let nextBlink = 1.5 + Math.random() * 2;
  const t0 = performance.now();

  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 1000 / FPS) return;
    last = now;
    const t = (now - t0) / 1000;
    const breath = Math.sin((t / BREATH_S) * Math.PI * 2);
    const sway = Math.sin((t / SWAY_S) * Math.PI * 2);
    // the body: a breath stretches it up a touch, the weight shifts side to side
    const m = new DOMMatrix()
      .translate(feet.x, feet.y)
      .rotate(sway * 0.35)
      .scale(1 + sway * 0.002, 1 + breath * 0.004)
      .translate(-feet.x, -feet.y);
    fctx.fillStyle = bg;
    fctx.fillRect(0, 0, w, h);
    fctx.setTransform(m);
    fctx.drawImage(still, 0, 0);
    fctx.setTransform(1, 0, 0, 1, 0, 0);

    // the head and hair: rows above the chin slide sideways, the top most,
    // a beat behind the body
    const neck = face ? face.chin + (face.chin - face.top) * 0.25 : 0;
    const head = (y: number) => (face && y < neck ? Math.sin(((t - 0.6) / SWAY_S) * Math.PI * 2) * w * 0.004 * Math.pow(1 - Math.max(0, y - face.top) / (neck - face.top), 1.5) : 0);
    ctx.clearRect(0, 0, w, h);
    if (face) {
      ctx.drawImage(frame, 0, neck, w, h - neck, 0, neck, w, h - neck);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, neck);
      for (let y = 0; y < neck; y += 2) ctx.drawImage(frame, 0, y, w, 2, head(y), y, w, 2);
    } else ctx.drawImage(frame, 0, 0);

    // a blink: shut for a moment, now and then (sometimes twice)
    if (face && t >= nextBlink) {
      const into = t - nextBlink;
      const shut = into < 0.06 ? into / 0.06 : into < 0.12 ? 1 : into < 0.2 ? 1 - (into - 0.12) / 0.08 : 0;
      if (into > 0.2) nextBlink = t + (Math.random() < 0.2 ? 0.25 : 2.5 + Math.random() * 3.5);
      if (shut > 0)
        face.eyes.forEach((e, i) => {
          const p = m.transformPoint(new DOMPoint(e.x, e.y));
          ctx.fillStyle = lids[i];
          ctx.beginPath();
          // the lid comes down from the top
          const lidH = e.h * shut;
          ctx.ellipse(p.x + head(e.y), p.y - e.h / 2 + lidH / 2, e.w * 0.62, lidH / 2 + 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // and the lashes along its edge
          ctx.strokeStyle = "rgba(40, 24, 24, 0.75)";
          ctx.lineWidth = Math.max(1, e.h * 0.18);
          ctx.beginPath();
          ctx.moveTo(p.x + head(e.y) - e.w * 0.55, p.y - e.h / 2 + lidH);
          ctx.quadraticCurveTo(p.x + head(e.y), p.y - e.h / 2 + lidH + e.h * 0.25 * shut, p.x + head(e.y) + e.w * 0.55, p.y - e.h / 2 + lidH);
          ctx.stroke();
        });
    }
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

// People who've asked their device for less motion get the still picture.
export const wantsStill = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
