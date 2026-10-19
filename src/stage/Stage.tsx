import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { STAGE_H, STAGE_W } from "./layout";

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
    const fit = () => {
      const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
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
