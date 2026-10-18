import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Category } from "../closet/categories";
import type { Garment, Slot } from "../closet/types";
import { PixelField } from "../pixel/PixelField";
import { PixelImage } from "../pixel/PixelImage";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L, type Box } from "../stage/layout";
import { useToStage } from "../stage/Stage";

const DRAG_START_PX = 4; // stage pixels the pointer must travel before a press becomes a drag
const DRAG_ICON = 56;

const inside = (b: Box, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const dropSlotAt = (x: number, y: number): Slot | null => (inside(L.topPanel, x, y) ? "top" : inside(L.bottomPanel, x, y) ? "bottom" : null);

const bevelIn: CSSProperties = {
  boxSizing: "border-box",
  border: "2px solid",
  borderColor: `${C.invSlotShadow} ${C.white} ${C.white} ${C.invSlotShadow}`,
};

const searchText = (g: Garment) => [g.name, ...g.colors, g.pattern, ...g.styles].join(" ").toLowerCase();

type Press = { g: Garment; x0: number; y0: number; dragging: boolean };

// The closet pop-up: every garment in a category as a grid of inventory slots.
// Click a top or bottom to put it on the rack, or drag it onto a panel.
export function Inventory({ category, categories, closet, onClose, onWear, onDragStart }: {
  category: string;
  categories: Category[];
  closet: Garment[];
  onClose: () => void;
  onWear: (g: Garment) => void;
  onDragStart: () => void;
}) {
  const toStage = useToStage();
  const [query, setQuery] = useState("");
  const [scroll, setScroll] = useState(0);
  const [hover, setHover] = useState<Garment | null>(null);
  const [drag, setDrag] = useState<{ g: Garment; x: number; y: number; over: Slot | null } | null>(null);
  const press = useRef<Press | null>(null);

  const cat = categories.find((c) => c.id === category);
  const q = query.trim().toLowerCase();
  // search stays inside the open category, and matches tags as well as names
  const items = useMemo(
    () => closet.filter((g) => g.category === category && (!q || searchText(g).includes(q))),
    [closet, category, q],
  );

  useEffect(() => setQuery(""), [category]);
  useEffect(() => setScroll(0), [category, q]);

  const { invPad: pad, invHeader, invSlot: S, invCols: cols, invRows: rows, invScrollW } = L;
  const box = L.inventory;
  const totalRows = Math.max(rows, Math.ceil(items.length / cols));
  const maxScroll = totalRows - rows;
  const visible = Array.from({ length: rows * cols }, (_, i) => items[(scroll + Math.floor(i / cols)) * cols + (i % cols)]);

  // pointer handling lives on window so a drag can leave the pop-up
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const { x, y } = toStage(e.clientX, e.clientY);
      if (!p.dragging) {
        if (!p.g.slot || Math.hypot(x - p.x0, y - p.y0) < DRAG_START_PX) return;
        p.dragging = true;
        onDragStart();
      }
      setDrag({ g: p.g, x, y, over: dropSlotAt(x, y) });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      if (!p.dragging) {
        if (p.g.slot) onWear(p.g);
        return;
      }
      const { x, y } = toStage(e.clientX, e.clientY);
      setDrag(null);
      if (dropSlotAt(x, y) === p.g.slot) onWear(p.g);
    };
    const cancel = () => {
      press.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [toStage, onDragStart, onWear]);

  const onSlotDown = (g: Garment | undefined, e: ReactPointerEvent) => {
    if (!g) return;
    e.preventDefault();
    const { x, y } = toStage(e.clientX, e.clientY);
    press.current = { g, x0: x, y0: y, dragging: false };
  };

  const gridX = box.x + pad;
  const gridY = box.y + pad + invHeader + 6;
  const footerY = gridY + rows * S + 8;
  const title = cat?.label ?? category.toUpperCase();
  const status = hover
    ? hover.name + (hover.slot ? "" : " - CAN'T WEAR YET")
    : items.length
      ? `${items.length} ${items.length === 1 ? "ITEM" : "ITEMS"}`
      : q
        ? "NO MATCHES"
        : "NOTHING HERE YET";

  return (
    <>
      {/* click outside to close; the category bar stays usable as tabs */}
      <div onClick={onClose} style={{ position: "absolute", left: 0, top: 0, width: 640, height: 450, zIndex: 20, display: drag ? "none" : "block" }} />

      <div
        role="dialog"
        aria-label={`${title} closet`}
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          boxSizing: "border-box",
          background: C.invBg,
          border: `3px solid ${C.invEdge}`,
          boxShadow: `inset 3px 3px 0 ${C.white}, inset -3px -3px 0 ${C.invSlotShadow}`,
          zIndex: 21,
          opacity: drag ? 0 : 1,
          pointerEvents: drag ? "none" : "auto",
        }}
      />

      <div style={{ position: "absolute", left: 0, top: 0, zIndex: 22, opacity: drag ? 0 : 1, pointerEvents: drag ? "none" : "auto" }}>
        <div style={{ position: "absolute", left: gridX, top: box.y + pad + 6 }}>
          <PixelText text={title} color={C.invText} sx={2} sy={2} />
        </div>
        <PixelField
          box={{ x: box.x + 150, y: box.y + pad, w: 168, h: invHeader }}
          label={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={setQuery}
          placeholder={`SEARCH ${title}`}
          maxLength={24}
          inputMode="search"
          sx={1.4}
          sy={1.8}
        />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="bevel"
          style={{
            left: box.x + box.w - pad - invHeader - 3,
            top: box.y + pad,
            width: invHeader,
            height: invHeader,
            background: C.btnGray,
            borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
          }}
        >
          <PixelText text="X" color={C.ink} sx={2} sy={2} />
        </button>

        <div
          onWheel={(e) => setScroll((s) => Math.min(maxScroll, Math.max(0, s + Math.sign(e.deltaY))))}
          style={{ position: "absolute", left: gridX, top: gridY, width: cols * S, height: rows * S }}
        >
          {visible.map((g, i) => (
            <div
              key={g ? g.id : `empty-${i}`}
              onPointerDown={(e) => onSlotDown(g, e)}
              onPointerEnter={() => setHover(g ?? null)}
              onPointerLeave={() => setHover(null)}
              title={g?.name}
              style={{
                ...bevelIn,
                position: "absolute",
                left: (i % cols) * S,
                top: Math.floor(i / cols) * S,
                width: S,
                height: S,
                background: g && hover === g ? C.invSlotHover : C.invSlot,
                display: "grid",
                placeItems: "center",
                cursor: g ? (g.slot ? "grab" : "help") : "default",
                touchAction: "none",
              }}
            >
              {g && <PixelImage src={g.image} w={S - 6} h={S - 6} pixel={2} fill={0.95} style={{ opacity: g.slot ? 1 : 0.85 }} />}
            </div>
          ))}
        </div>

        {/* scrollbar: click above or below the thumb to page */}
        <div
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const before = (e.clientY - r.top) / r.height < (scroll + rows / 2) / totalRows;
            setScroll((s) => Math.min(maxScroll, Math.max(0, s + (before ? -rows : rows))));
          }}
          style={{ ...bevelIn, position: "absolute", left: gridX + cols * S + 6, top: gridY, width: invScrollW, height: rows * S, background: C.invSlot }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${(scroll / totalRows) * 100}%`,
              height: `${(rows / totalRows) * 100}%`,
              background: maxScroll ? C.btnGray : C.btnGrayLight,
              boxSizing: "border-box",
              border: "2px solid",
              borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
            }}
          />
        </div>

        <div style={{ position: "absolute", left: gridX, top: footerY + 4 }}>
          <PixelText text={status} color={C.invText} sx={1.5} sy={2} />
        </div>
      </div>

      {drag && (
        <>
          {drag.over && (
            <div
              style={{
                position: "absolute",
                ...(() => {
                  const b = drag.over === "top" ? L.topPanel : L.bottomPanel;
                  return { left: b.x, top: b.y, width: b.w, height: b.h };
                })(),
                boxSizing: "border-box",
                border: `4px solid ${drag.over === drag.g.slot ? C.dropGlow : C.btnGrayDark}`,
                zIndex: 23,
                pointerEvents: "none",
              }}
            />
          )}
          <div style={{ position: "absolute", left: drag.x - DRAG_ICON / 2, top: drag.y - DRAG_ICON / 2, zIndex: 24, pointerEvents: "none" }}>
            <PixelImage src={drag.g.image} w={DRAG_ICON} h={DRAG_ICON} pixel={2} outline={C.white} />
          </div>
        </>
      )}
    </>
  );
}

// The list that pops up from MORE: categories that didn't fit on the bar.
export function MoreMenu({ categories, onPick, onSignOut, onClose }: {
  categories: Category[];
  onPick: (id: string) => void;
  onSignOut?: () => void;
  onClose: () => void;
}) {
  const rows = [...categories.map((c) => ({ key: c.id, label: c.label, act: () => onPick(c.id) })), ...(onSignOut ? [{ key: "sign-out", label: "SIGN OUT", act: onSignOut }] : [])];
  const { x, w, rowH } = L.moreMenu;
  const h = rows.length * rowH + 10;
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", left: 0, top: 0, width: 640, height: 450, zIndex: 20 }} />
      <div
        role="menu"
        style={{
          position: "absolute",
          left: x,
          top: L.categoryBar.y - h - 2,
          width: w,
          height: h,
          boxSizing: "border-box",
          padding: 3,
          background: C.invBg,
          border: `3px solid ${C.invEdge}`,
          zIndex: 21,
        }}
      >
        {rows.length === 0 && <PixelText text="NO MORE YET" color={C.invText} sx={1.5} sy={2} style={{ margin: 4 }} />}
        {rows.map((r, i) => (
          <button
            key={r.key}
            type="button"
            role="menuitem"
            onClick={r.act}
            className="menu-row"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: rowH,
              padding: "0 6px",
              border: 0,
              borderTop: r.key === "sign-out" && i > 0 ? `2px solid ${C.invSlot}` : 0,
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <PixelText text={r.label} color={C.invText} sx={1.5} sy={2} />
          </button>
        ))}
      </div>
    </>
  );
}
