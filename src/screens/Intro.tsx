import { useCallback, useEffect, useRef, useState } from "react";
import { closetHeadline } from "../auth/names";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { rng } from "../pixel/raster";
import { C } from "../stage/palette";
import { STAGE_H, STAGE_W } from "../stage/layout";
import { Bevel, Leopard } from "./Parts";

// The welcome intro, played once after someone first signs in:
//   1. brew:    leopard screen, the movie clip on a little TV, captions
//               alternating "BREWING..." with closet phrases every 2 seconds
//   2. swirl:   a whirlpool of sparkles sucks the TV and captions away
//   3. welcome: "WELCOME TO AMY'S CLOSET", then fade into the hangers
// The clip is public/intro.mp4. Without it, the TV shows static and the brew
// step lasts a few seconds instead of the length of the clip.

const CLIP_SRC = "/intro.mp4";
const PHRASE_MS = 2000;
const NO_CLIP_BREW_MS = 4500;
const MAX_CLIP_MS = 20000; // in case the clip never reports that it ended
const SWIRL_MS = 2800;
const WELCOME_MS = 2600;
const FADE_MS = 600;

const BREWING = ["BREWING", "STILL BREWING", "BREWING SOMETHING CUTE", "BREWING"];
const CLOSET = ["PUTTING TOGETHER YOUR DREAM CLOSET", "STEAMING THE PLAID", "MATCHING THE KNEE SOCKS", "FLUFFING THE CARDIGANS"];
const phraseAt = (i: number) => (i % 2 === 0 ? BREWING[(i / 2) % BREWING.length] : CLOSET[Math.floor(i / 2) % CLOSET.length]);

const TV = { x: 150, y: 46, w: 340, h: 232 };
const SCREEN = { x: TV.x + 10, y: TV.y + 10, w: TV.w - 20, h: TV.h - 20 };
const CAPTION = { x: 110, y: 298, w: 420, h: 64 };
const RES = 2; // stage pixels per canvas pixel, for the clip and the sparkles

type Phase = "brew" | "swirl" | "welcome" | "out";

export function Intro({ name, onDone }: { name: string | null; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("brew");
  const [phrase, setPhrase] = useState(0);
  const [dots, setDots] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const sparkles = useRef<HTMLCanvasElement>(null);
  const hasClip = useRef(true);
  const swirl = useCallback(() => setPhase((p) => (p === "brew" ? "swirl" : p)), []);

  // captions: alternate brewing / closet phrases, with animated dots
  useEffect(() => {
    if (phase !== "brew") return;
    const p = window.setInterval(() => setPhrase((i) => i + 1), PHRASE_MS);
    const d = window.setInterval(() => setDots((n) => (n + 1) % 4), 400);
    return () => {
      clearInterval(p);
      clearInterval(d);
    };
  }, [phase]);

  // the clip: try with sound (the sign-in click usually allows it), else muted;
  // drawn onto a small canvas each frame so it's as pixelated as everything else
  useEffect(() => {
    const v = video.current!;
    const ctx = screen.current!.getContext("2d")!;
    const rand = rng(7);
    let raf = 0;
    const draw = () => {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      if (hasClip.current && v.readyState >= 2) {
        const s = Math.max(cw / v.videoWidth, ch / v.videoHeight);
        const w = v.videoWidth * s;
        const h = v.videoHeight * s;
        ctx.drawImage(v, (cw - w) / 2, (ch - h) / 2, w, h);
      } else {
        // no clip (yet): TV static
        const img = ctx.createImageData(cw, ch);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = 40 + rand() * 160;
          img.data[i] = img.data[i + 1] = n;
          img.data[i + 2] = n + 20;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
    const cap = window.setTimeout(swirl, MAX_CLIP_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cap);
      v.pause();
    };
  }, [swirl]);

  const noClip = useCallback(() => {
    hasClip.current = false;
    window.setTimeout(swirl, NO_CLIP_BREW_MS);
  }, [swirl]);

  // the sparkle whirlpool: spirals in over the TV, then bursts outward
  useEffect(() => {
    if (phase !== "swirl") return;
    const canvas = sparkles.current!;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = (TV.y + TV.h / 2 + 30) / RES;
    const rand = rng(1995);
    const colors = ["#ffffff", "#fff4b0", "#f7c6ff", "#c8ccff", "#ffd6e8", "#ffe08a"];
    const parts = Array.from({ length: 900 }, () => ({
      a: rand() * Math.PI * 2,
      r0: 20 + rand() * 260, // reaches past the screen edges
      delay: rand() * 0.3,
      spin: 1.5 + rand() * 2.5,
      color: colors[Math.floor(rand() * colors.length)],
      size: rand() < 0.45 ? 2 : rand() < 0.6 ? 1 : 0, // 0 dot, 1 square, 2 twinkle cross
      tw: rand() * Math.PI * 2,
    }));
    const start = performance.now();
    let raf = 0;
    const at = (p: (typeof parts)[number], local: number) => {
      // 0..0.72 spiral in, faster near the middle; then burst out and fade
      let r: number;
      let alpha = 1;
      if (local < 0.72) {
        const k = local / 0.72;
        r = p.r0 * (1 - k * k * 0.95);
      } else {
        const k = (local - 0.72) / 0.28;
        r = p.r0 * 0.05 + k * 300;
        alpha = 1 - k;
      }
      const a = p.a + local * p.spin * Math.PI * 2 * (1 + Math.max(0, 1 - r / 200) * 2);
      return { x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r * 0.75), alpha };
    };
    const dot = (x: number, y: number, size: number) => {
      if (size === 2) {
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      } else ctx.fillRect(x, y, size + 1, size + 1);
    };
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SWIRL_MS);
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
        if (local <= 0) continue;
        ctx.fillStyle = p.color;
        // a short fading trail makes the spiral read as motion
        for (let k = 3; k >= 0; k--) {
          const pos = at(p, Math.max(0, local - k * 0.012));
          ctx.globalAlpha = pos.alpha * (k ? 0.18 * (4 - k) : 0.7 + 0.3 * Math.sin(p.tw + now / 70));
          dot(pos.x, pos.y, k ? 0 : p.size);
        }
      }
      // a bright flash at the eye of the whirlpool as it bursts
      const flash = Math.max(0, 1 - Math.abs(t - 0.74) / 0.12);
      if (flash > 0) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * flash})`);
        g.addColorStop(1, "rgba(255,240,255,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPhase("welcome");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === "welcome") {
      const t = window.setTimeout(() => setPhase("out"), WELCOME_MS);
      return () => clearTimeout(t);
    }
    if (phase === "out") {
      const t = window.setTimeout(onDone, FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  // the TV and caption get sucked into the whirlpool
  const sucked = phase !== "brew";
  const swirlAway = {
    transform: sucked ? "scale(0) rotate(540deg)" : "none",
    opacity: sucked ? 0 : 1,
    transition: `transform ${SWIRL_MS * 0.7}ms cubic-bezier(.55,0,.85,.4), opacity ${SWIRL_MS * 0.7}ms cubic-bezier(.9,0,1,1)`,
    transformOrigin: `${STAGE_W / 2}px ${TV.y + TV.h / 2 + 30}px`,
  };
  const headline = closetHeadline(name);

  return (
    <div style={{ position: "absolute", inset: 0, background: C.black, zIndex: 45 }}>
      <div className="fade-in" style={{ position: "absolute", inset: 0, opacity: phase === "out" ? 0 : 1, transition: `opacity ${FADE_MS}ms steps(5)` }}>
        <Leopard box={{ x: 0, y: 0, w: STAGE_W, h: STAGE_H }} />

        <div style={{ position: "absolute", inset: 0, ...swirlAway }}>
          {/* the little TV */}
          <div style={{ position: "absolute", left: TV.x, top: TV.y, width: TV.w, height: TV.h, background: C.navy, boxSizing: "border-box", border: `4px solid ${C.frame}`, boxShadow: `4px 4px 0 ${C.frameDark}` }} />
          <canvas
            ref={screen}
            width={SCREEN.w / RES}
            height={SCREEN.h / RES}
            style={{ position: "absolute", left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, imageRendering: "pixelated", background: C.black }}
          />
          <video ref={video} src={CLIP_SRC} preload="auto" playsInline onEnded={swirl} onError={noClip} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />

          {/* caption */}
          <div style={{ position: "absolute", left: CAPTION.x, top: CAPTION.y, width: CAPTION.w, height: CAPTION.h, background: C.navy, boxSizing: "border-box", border: `3px solid ${C.lavender}`, display: "grid", placeItems: "center" }}>
            <PixelLines text={`${phraseAt(phrase)}${".".repeat(dots)}`} maxWidth={CAPTION.w - 30} color={C.lavender} sx={2} sy={2.4} />
          </div>
        </div>

        {/* the room dims as the whirlpool spins up, so the sparkles pop */}
        <div style={{ position: "absolute", inset: 0, background: C.frameDark, opacity: phase === "swirl" ? 0.6 : phase === "brew" ? 0 : 0.35, transition: "opacity 700ms", pointerEvents: "none" }} />
        <canvas ref={sparkles} width={STAGE_W / RES} height={STAGE_H / RES} style={{ position: "absolute", inset: 0, width: STAGE_W, height: STAGE_H, imageRendering: "pixelated", pointerEvents: "none" }} />

        {(phase === "welcome" || phase === "out") && (
          <div className="fade-in" style={{ position: "absolute", left: 70, top: 150, width: 500, height: 150, background: C.navy, boxSizing: "border-box", border: `4px solid ${C.lavender}`, boxShadow: `5px 5px 0 ${C.frameDark}`, display: "grid", placeItems: "center", alignContent: "center", gap: 14 }}>
            <PixelText text="WELCOME TO" color={C.lavender} sx={2.5} sy={2.8} />
            <PixelLines text={headline} maxWidth={470} color={C.white} sx={headline.length > 14 ? 3.4 : 4.6} sy={5} bold shadow={C.btnBlue} />
          </div>
        )}

        {phase === "brew" && (
          <Bevel box={{ x: 560, y: 444, w: 70, h: 26 }} tone="gray" onClick={swirl} label="Skip intro" style={{ borderWidth: 2 }}>
            <PixelText text="SKIP" color={C.ink} sx={1.6} sy={2} bold />
          </Bevel>
        )}
      </div>
    </div>
  );
}
