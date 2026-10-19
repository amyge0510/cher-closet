import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PHONE, STAGE_H, STAGE_W } from "./layout";

type ToStage = (clientX: number, clientY: number) => { x: number; y: number };
const StageContext = createContext<ToStage>((x, y) => ({ x, y }));

// Converts pointer positions on the page into stage pixels (for drag and drop).
export const useToStage = () => useContext(StageContext);

// A fixed 640x480 screen scaled to fit the window. Everything inside is laid
// out in stage pixels, so the look never reflows with the window size.
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  // a phone wider than the screen's shape: the bars and leopard run on past
  // its sides by this many stage pixels (the "bleed"), so they reach the edges
  const [bleed, setBleed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // on a phone the keyboard shortens the window; while someone is typing
    // the screen keeps its size instead of shrinking under it. Otherwise it
    // follows the window, since browser toolbars come and go.
    let last = { w: 0, h: 0 };
    const typing = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    };
    const fit = () => {
      const w = window.innerWidth;
      // the part actually visible, between the browser's own bars
      let h = Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity);
      if (PHONE && typing() && w === last.w && h < last.h) h = last.h;
      last = { w, h };
      const s = Math.min(w / STAGE_W, h / STAGE_H);
      // whole-number scales keep every pixel the same size when there is room
      const scaled = s >= 2 ? Math.floor(s * 2) / 2 : s;
      setScale(scaled);
      setBleed(PHONE ? Math.max(0, Math.ceil((w / scaled - STAGE_W) / 2)) : 0);
    };
    fit();
    const refit = () => setTimeout(() => ((last = { w: 0, h: 0 }), fit()), 300);
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.addEventListener("focusout", refit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.removeEventListener("focusout", refit);
    };
  }, []);
  const toStage = useCallback<ToStage>((cx, cy) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * STAGE_W, y: ((cy - r.top) / r.height) * STAGE_H };
  }, []);
  return (
    <div className="viewport">
      <div
        className="stage"
        style={{ position: "absolute", left: "50%", top: "50%", width: STAGE_W + bleed * 2, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})`, ["--bleed" as string]: `${bleed}px` }}
      >
        {/* the screen itself; full-width pieces reach past it by var(--bleed) */}
        <div ref={ref} style={{ position: "absolute", left: bleed, top: 0, width: STAGE_W, height: STAGE_H }}>
          <StageContext.Provider value={toStage}>{children}</StageContext.Provider>
        </div>
        <div className="scanlines" aria-hidden />
      </div>
    </div>
  );
}

export function At({ x, y, w, h, children, style }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>;
}
