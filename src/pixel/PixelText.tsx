import { useMemo, type CSSProperties } from "react";
import { layoutText, wrapText } from "./font";

type Props = {
  text: string;
  color: string;
  /** stage pixels per font pixel, horizontally and vertically */
  sx?: number;
  sy?: number;
  bold?: boolean;
  /** 1-font-pixel drop shadow down-right */
  shadow?: string;
  /** 1-font-pixel outline all round */
  outline?: string;
  style?: CSSProperties;
};

function pathFor(cells: [number, number][], dx = 0, dy = 0) {
  return cells.map(([x, y]) => `M${x + dx} ${y + dy}h1v1h-1z`).join("");
}

// Renders bitmap-font text as an SVG of hard-edged squares.
export function PixelText({ text, color, sx = 1, sy = sx, bold, shadow, outline, style }: Props) {
  const { cells, width, height } = useMemo(() => layoutText(text, { bold }), [text, bold]);
  const pad = outline || shadow ? 1 : 0;
  const vbW = width + pad * 2;
  const vbH = height + pad * 2;
  const around: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  return (
    <svg
      width={vbW * sx}
      height={vbH * sy}
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ display: "block", overflow: "visible", ...style }}
      aria-label={text}
      role="img"
    >
      {outline && <path d={around.map(([dx, dy]) => pathFor(cells, dx, dy)).join("")} fill={outline} />}
      {shadow && <path d={pathFor(cells, 1, 1)} fill={shadow} />}
      <path d={pathFor(cells)} fill={color} />
    </svg>
  );
}

// Word-wrapped, centered lines of bitmap text.
export function PixelLines({ text, maxWidth, color, sx = 1, sy = sx, gap = 0.6, align = "center", ...rest }: Props & {
  /** in stage pixels */
  maxWidth: number;
  gap?: number;
  align?: "center" | "left";
}) {
  const lines = wrapText(text, maxWidth / sx, { bold: rest.bold });
  return (
    <div style={{ display: "grid", justifyItems: align === "center" ? "center" : "start", rowGap: sy * 7 * gap }}>
      {lines.map((l, i) => (
        <PixelText key={i} text={l} color={color} sx={sx} sy={sy} {...rest} />
      ))}
    </div>
  );
}
