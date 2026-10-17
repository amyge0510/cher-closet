import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { STAGE_H, STAGE_W } from "./layout";

// A fixed 640x480 screen scaled to fit the window. Everything inside is laid
// out in stage pixels, so the look never reflows with the window size.
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
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
  return (
    <div className="viewport">
      <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
        {children}
        <div className="scanlines" aria-hidden />
      </div>
    </div>
  );
}

export function At({ x, y, w, h, children, style }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>;
}
