import { useCallback, useEffect, useRef, useState } from "react";
import { PixelText } from "../pixel/PixelText";
import { rng } from "../pixel/raster";
import { C } from "../stage/palette";
import { L, STAGE_H, STAGE_W } from "../stage/layout";
import { Bevel, Leopard } from "./Parts";

// The welcome intro, played once after someone first signs in:
//   1. brew:    leopard screen, "A REMINDER..." over a TV playing the movie clip
//   2. swirl:   a whirlpool of sparkles sucks the TV and title away while
//               the room brightens, then bursts into a light pink puff of
//               smoke that fills the screen; the hangers fade in out of it
// The clip is public/intro.mp4. Without it, the TV shows static and the brew
// step lasts a few seconds instead of the length of the clip.

const CLIP_SRC = "/intro.mp4";
const NO_CLIP_BREW_MS = 4500;
const MAX_CLIP_MS = 20000; // in case the clip never reports that it ended
const SWIRL_MS = 1600;
// the colour of the smoke the intro ends in; the hanger screen starts under the
// same colour and fades it away, so the hand-off is seamless
export const SMOKE = "#ffe1ec";

const TV = L.introTv; // a 16:9 screen inside a 10px frame
const SCREEN = { x: TV.x + 10, y: TV.y + 10, w: TV.w - 20, h: TV.h - 20 };
const RES = 2; // stage pixels per canvas pixel, for the clip and the sparkles

type Phase = "brew" | "swirl";

export function Intro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("brew");
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const sparkles = useRef<HTMLCanvasElement>(null);
  const hasClip = useRef(true);
  const swirl = useCallback(() => setPhase((p) => (p === "brew" ? "swirl" : p)), []);

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

  // the sparkle whirlpool: spirals in over the TV, then bursts into pink smoke
  useEffect(() => {
    if (phase !== "swirl") return;
    const canvas = sparkles.current!;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = (TV.y + TV.h / 2) / RES;
    const rand = rng(1995);
    const colors = ["#ffffff", "#fff4b0", "#ffc4dc", "#f7c6ff", "#ffd6e8", "#ffe08a"];
    const parts = Array.from({ length: 700 }, () => ({
      a: rand() * Math.PI * 2,
      r0: 20 + rand() * 240,
      delay: rand() * 0.2,
      spin: 1.2 + rand() * 1.8,
      color: colors[Math.floor(rand() * colors.length)],
      size: rand() < 0.45 ? 2 : rand() < 0.6 ? 1 : 0, // 0 dot, 1 square, 2 twinkle cross
      tw: rand() * Math.PI * 2,
    }));
    // the puff: soft pink clouds billowing out from the eye of the whirlpool
    const puffs = Array.from({ length: 40 }, () => ({
      a: rand() * Math.PI * 2,
      reach: 40 + rand() * 170,
      size: 30 + rand() * 60,
      delay: rand() * 0.15,
      pink: rand() < 0.5 ? "255,196,220" : "255,226,238",
    }));
    const BURST = 0.55; // when the sparkles reach the middle and the smoke starts
    const start = performance.now();
    let raf = 0;
    const at = (p: (typeof parts)[number], local: number) => {
      let r: number;
      let alpha = 1;
      if (local < BURST) {
        const k = local / BURST;
        r = p.r0 * (1 - k * k * 0.95);
      } else {
        const k = (local - BURST) / (1 - BURST);
        r = p.r0 * 0.05 + k * 280;
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
    const ease = (x: number) => 1 - (1 - x) * (1 - x);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SWIRL_MS);
      ctx.clearRect(0, 0, W, H);

      // smoke first, so the sparkles twinkle through it
      if (t > BURST) {
        const k = (t - BURST) / (1 - BURST);
        for (const p of puffs) {
          const local = Math.max(0, Math.min(1, (k - p.delay) / (1 - p.delay)));
          if (!local) continue;
          const d = ease(local) * p.reach;
          const x = cx + Math.cos(p.a) * d;
          const y = cy + Math.sin(p.a) * d * 0.8;
          const r = p.size * (0.3 + ease(local));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${p.pink},0.85)`);
          g.addColorStop(1, `rgba(${p.pink},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // by the end the smoke covers everything
        ctx.globalAlpha = Math.max(0, (k - 0.45) / 0.55);
        ctx.fillStyle = SMOKE;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      for (const p of parts) {
        const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
        if (local <= 0) continue;
        ctx.fillStyle = p.color;
        // a short fading trail makes the spiral read as motion
        for (let k = 3; k >= 0; k--) {
          const pos = at(p, Math.max(0, local - k * 0.015));
          ctx.globalAlpha = pos.alpha * (k ? 0.18 * (4 - k) : 0.7 + 0.3 * Math.sin(p.tw + now / 70));
          dot(pos.x, pos.y, k ? 0 : p.size);
        }
      }
      ctx.globalAlpha = 1;
      if (t < 1) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onDone]);

  // the TV and caption get sucked into the whirlpool
  const sucked = phase !== "brew";
  const swirlAway = {
    transform: sucked ? "scale(0) rotate(540deg)" : "none",
    opacity: sucked ? 0 : 1,
    transition: `transform ${SWIRL_MS * 0.55}ms cubic-bezier(.55,0,.85,.4), opacity ${SWIRL_MS * 0.55}ms cubic-bezier(.9,0,1,1)`,
    transformOrigin: `${STAGE_W / 2}px ${TV.y + TV.h / 2}px`,
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: C.black, zIndex: 45 }}>
      <div className="fade-in" style={{ position: "absolute", inset: 0 }}>
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

          <div style={{ position: "absolute", left: 0, top: L.introTitle.y, width: STAGE_W, display: "grid", justifyItems: "center" }}>
            <PixelText text="A REMINDER..." color={C.white} sx={L.introTitle.sx} sy={L.introTitle.sy} bold outline={C.navy} />
          </div>
        </div>

        {/* the room brightens as the whirlpool spins up */}
        <div style={{ position: "absolute", inset: 0, background: C.white, opacity: phase === "swirl" ? 0.45 : 0, transition: `opacity ${SWIRL_MS * 0.6}ms ease-out`, pointerEvents: "none" }} />
        <canvas ref={sparkles} width={STAGE_W / RES} height={STAGE_H / RES} style={{ position: "absolute", inset: 0, width: STAGE_W, height: STAGE_H, imageRendering: "pixelated", pointerEvents: "none" }} />

        {phase === "brew" && (
          <Bevel box={L.introSkip} tone="gray" onClick={swirl} label="Skip intro" style={{ borderWidth: 2 }}>
            <PixelText text="SKIP" color={C.ink} sx={1.6} sy={2} bold />
          </Bevel>
        )}
      </div>
    </div>
  );
}
