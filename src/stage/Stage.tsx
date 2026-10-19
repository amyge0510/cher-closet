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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // on a phone the keyboard shortens the window; the screen keeps its size
    // (the tallest height seen at this width) instead of shrinking under it
    let tallest = { w: 0, h: 0 };
    const fit = () => {
      const w = window.innerWidth;
      let h = window.innerHeight;
      if (PHONE) {
        tallest = w === tallest.w ? { w, h: Math.max(tallest.h, h) } : { w, h };
        h = tallest.h;
      }
      const s = Math.min(w / STAGE_W, h / STAGE_H);
      // whole-number scales keep every pixel the same size when there is room
      setScale(s >= 2 ? Math.floor(s * 2) / 2 : s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const toStage = useCallback<ToStage>((cx, cy) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * STAGE_W, y: ((cy - r.top) / r.height) * STAGE_H };
  }, []);
  return (
    <div className="viewport">
      <div ref={ref} className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
        <StageContext.Provider value={toStage}>{children}</StageContext.Provider>
        <div className="scanlines" aria-hidden />
      </div>
    </div>
  );
}

export function At({ x, y, w, h, children, style }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>;
}
