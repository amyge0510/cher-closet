import type { CSSProperties, ReactNode } from "react";
import { leopardTile } from "../pixel/leopard";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L, type Box } from "../stage/layout";

const pos = (b: Box): CSSProperties => ({ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h });

const BEVELS = {
  gray: { bg: C.btnGray, light: C.btnGrayLight, dark: C.btnGrayDark },
  blue: { bg: C.btnBlue, light: C.btnBlueLight, dark: C.btnBlueDark },
  banner: { bg: C.banner, light: C.bannerLight, dark: C.bannerDark },
};

export function Bevel({ box, tone, children, onClick, label, style }: {
  box: Box; tone: keyof typeof BEVELS; children: ReactNode; onClick?: () => void; label?: string; style?: CSSProperties;
}) {
  const t = BEVELS[tone];
  const look: CSSProperties = {
    ...pos(box),
    background: t.bg,
    borderColor: `${t.light} ${t.dark} ${t.dark} ${t.light}`,
    ...style,
  };
  if (!onClick) return <div className="bevel" style={{ ...look, cursor: "default" }}>{children}</div>;
  return (
    <button type="button" className="bevel" style={look} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

// Big two-line button label, e.g. DRESS / ME.
export function ButtonLabel({ lines }: { lines: string[] }) {
  const { sx, sy } = L.buttonText;
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: sy * 1.2 }}>
      {lines.map((l) => (
        <PixelText key={l} text={l} color={C.ink} sx={sx} sy={sy} bold shadow={C.btnBlueLight} />
      ))}
    </div>
  );
}

export function Leopard({ box }: { box: Box }) {
  return (
    <div
      style={{
        ...pos(box),
        backgroundImage: `url(${leopardTile()})`,
        backgroundSize: "192px 192px",
        imageRendering: "pixelated",
      }}
    />
  );
}

export function Header() {
  const { sx, sy } = L.seasonText;
  return (
    <>
      <div style={{ ...pos(L.header), background: C.navy }} />
      <div style={{ position: "absolute", left: L.title.x, top: L.title.y }}>
        <PixelText text="CHER'S WARDROBE" color={C.lavender} sx={L.title.sx} sy={L.title.sy} shadow={C.frameDark} />
      </div>
      <div
        style={{
          ...pos(L.season),
          boxSizing: "border-box",
          border: `2px solid ${C.lavender}`,
          borderRightColor: C.frame,
          borderBottomColor: C.frame,
          display: "grid",
          placeItems: "center",
        }}
      >
        <PixelText text="FALL FASHIONS" color={C.lavender} sx={sx} sy={sy} />
      </div>
    </>
  );
}

export function CategoryBar() {
  const { sx, sy, y } = L.categoryText;
  return (
    <>
      <div style={{ ...pos(L.categoryBar), background: C.navy, borderTop: `2px solid ${C.frame}`, boxSizing: "border-box" }} />
      {L.categories.map((c) => (
        <div key={c.label} style={{ position: "absolute", left: c.x, top: y }}>
          <PixelText text={c.label} color={C.lavender} sx={sx} sy={sy} />
        </div>
      ))}
      <div
        style={{
          ...pos(L.more),
          boxSizing: "border-box",
          borderLeft: `2px solid ${C.lavender}`,
          borderTop: `2px solid ${C.lavender}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <PixelText text="MORE" color={C.lavender} sx={sx * 1.2} sy={sy * 1.1} />
      </div>
    </>
  );
}

const ICONS = ["[", ">", "]"] as const;
// the control buttons have a ribbed texture in the film
const STRIPES: CSSProperties = {
  backgroundImage: `repeating-linear-gradient(to right, transparent 0 2px, ${C.btnGrayDark}55 2px 3px)`,
};

export function ControlStrip({ box, onPrev, onNext, onScan, disabled }: {
  box: Box; onPrev: () => void; onNext: () => void; onScan: () => void; disabled?: boolean;
}) {
  const handlers = [onPrev, onNext, onScan];
  const labels = ["previous", "next", "scan"];
  return (
    <div style={{ ...pos(box), background: C.navyMid }}>
      {L.controlButtons.map((b, i) => (
        <Bevel key={i} box={b} tone="gray" onClick={disabled ? undefined : handlers[i]} label={labels[i]} style={STRIPES}>
          <PixelText text={ICONS[i]} color={C.ink} sx={3} sy={2.4} shadow={C.btnGrayLight} />
        </Bevel>
      ))}
    </div>
  );
}

export { pos };
