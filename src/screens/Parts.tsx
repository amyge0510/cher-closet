import type { CSSProperties, ReactNode } from "react";
import { leopardTile } from "../pixel/leopard";
import { splitForBar, type Category } from "../closet/categories";
import { layoutText } from "../pixel/font";
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
// `sub` is a small extra line underneath, e.g. the saved style on AUTO DRESS.
export function ButtonLabel({ lines, sub }: { lines: string[]; sub?: string }) {
  const { sx, sy } = L.buttonText;
  const s = sub ? 0.74 : 1; // make room for the extra line
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: sub ? 1 : sy }}>
      {lines.map((l) => (
        <PixelText key={l} text={l} color={C.ink} sx={sx * s} sy={sy * s} bold shadow={C.btnBlueLight} />
      ))}
      {sub && <PixelText text={sub} color={C.white} sx={1.1} sy={1.4} />}
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

export function Header({ title, season = "FALL FASHIONS", onStyle, styleHint }: {
  title: string;
  season?: string;
  onStyle?: () => void;
  /** tiny explainer under MY STYLE */
  styleHint?: string;
}) {
  const { sx, sy } = L.seasonText;
  return (
    <>
      <div style={{ ...pos(L.header), background: C.navy }} />
      <div style={{ position: "absolute", left: L.title.x, top: L.title.y }}>
        <PixelText text={title} color={C.lavender} sx={L.title.sx} sy={L.title.sy} shadow={C.frameDark} />
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
        <PixelText text={season} color={C.lavender} sx={sx} sy={sy} />
      </div>
      {onStyle && (
        <Bevel box={L.styleButton} tone="gray" onClick={onStyle} label="My style" style={{ borderWidth: 2 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <PixelText text="MY STYLE" color={C.ink} sx={1.5} sy={1.8} bold />
            <PixelText text="~" color={C.ink} sx={1.5} sy={1.8} />
          </div>
        </Bevel>
      )}
      {onStyle && styleHint && (
        <button
          type="button"
          onClick={onStyle}
          aria-label={styleHint}
          style={{ ...pos(L.styleHint), padding: 0, border: 0, background: C.navy, display: "grid", placeItems: "center", cursor: "pointer", zIndex: 4 }}
        >
          <PixelText text={styleHint} color={C.lavender} sx={1} sy={1.4} />
        </button>
      )}
    </>
  );
}

const labelWidth = (label: string) => layoutText(label).width * L.categoryText.sx;

// The bottom bar. Clicking a category opens the closet pop-up on it; whatever
// doesn't fit goes under MORE. Without handlers it is just decoration.
export function CategoryBar({ categories, active, onPick, onMore }: {
  categories: Category[];
  /** highlighted label: a category id, or "more" */
  active?: string | null;
  onPick?: (id: string) => void;
  onMore?: () => void;
}) {
  const { sx, sy, y } = L.categoryText;
  const { start, end, gap } = L.categoryRun;
  const { shown, more } = splitForBar(categories, labelWidth, start, end, gap);
  const moreActive = active === "more" || (!!active && more.some((c) => c.id === active));
  const label = (text: string, on: boolean) => <PixelText text={text} color={on ? C.navy : C.lavender} sx={sx} sy={sy} />;
  const hit = (on: boolean): CSSProperties => ({
    position: "absolute",
    padding: "4px 3px",
    margin: "-4px -3px",
    background: on ? C.lavender : "transparent",
    border: 0,
    cursor: onPick ? "pointer" : "default",
    font: "inherit",
  });
  return (
    <>
      <div style={{ ...pos(L.categoryBar), background: C.navy, borderTop: `2px solid ${C.frame}`, boxSizing: "border-box" }} />
      {shown.map(({ cat, x }) => (
        <button key={cat.id} type="button" aria-label={cat.label} disabled={!onPick} onClick={() => onPick?.(cat.id)}
          style={{ ...hit(active === cat.id), left: x, top: y }}>
          {label(cat.label, active === cat.id)}
        </button>
      ))}
      <button
        type="button"
        aria-label="More categories"
        disabled={!onMore}
        onClick={onMore}
        style={{
          ...pos(L.more),
          boxSizing: "border-box",
          border: 0,
          borderLeft: `2px solid ${C.lavender}`,
          borderTop: `2px solid ${C.lavender}`,
          background: moreActive ? C.lavender : "transparent",
          display: "grid",
          placeItems: "center",
          cursor: onMore ? "pointer" : "default",
          padding: 0,
        }}
      >
        <PixelText text="MORE" color={moreActive ? C.navy : C.lavender} sx={sx * 1.2} sy={sy * 1.1} />
      </button>
    </>
  );
}

export function overflowCategories(categories: Category[]) {
  const { start, end, gap } = L.categoryRun;
  return splitForBar(categories, labelWidth, start, end, gap).more;
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
