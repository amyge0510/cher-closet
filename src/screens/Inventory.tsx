import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { DIM, wide } from "./Parts";
import type { Category } from "../closet/categories";
import type { Garment, Slot } from "../closet/types";
import { PixelField } from "../pixel/PixelField";
import { GarmentImage } from "../pixel/GarmentImage";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { extraSpot, L, STAGE_W, type Box } from "../stage/layout";
import { useToStage } from "../stage/Stage";

const DELETE_RED = "#c0183a";
const DRAG_START_PX = 4; // stage pixels the pointer must travel before a press becomes a drag
const DRAG_ICON = 56;

const inside = (b: Box, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const panelAt = (x: number, y: number): Slot | null => (inside(L.topPanel, x, y) ? "top" : inside(L.bottomPanel, x, y) ? "bottom" : null);

// Where a dragged piece would land: tops and bottoms on their own panel;
// accessories anywhere above the category bar, landing in their side spot.
function dropAt(g: Garment, x: number, y: number): { box: Box; ok: boolean } | null {
  if (!g.slot) return y < L.categoryBar.y ? { box: extraSpot(g.category), ok: true } : null;
  const panel = panelAt(x, y);
  return panel ? { box: panel === "top" ? L.topPanel : L.bottomPanel, ok: panel === g.slot } : null;
}

const bevelIn: CSSProperties = {
  boxSizing: "border-box",
  border: "2px solid",
  borderColor: `${C.invSlotShadow} ${C.white} ${C.white} ${C.invSlotShadow}`,
};

const searchText = (g: Garment) => [g.name, ...g.colors, g.pattern, ...g.styles].join(" ").toLowerCase();

type Press = { g: Garment; x0: number; y0: number; dragging: boolean };

// The closet pop-up: every garment in a category as a grid of inventory slots.
// Click a piece to wear it, or drag it out: tops and bottoms onto their panel,
// accessories anywhere on the screen.
export function Inventory({ category, categories, closet, onClose, onWear, onDragStart, onDelete }: {
  category: string;
  categories: Category[];
  closet: Garment[];
  onClose: () => void;
  onWear: (g: Garment) => void;
  onDragStart: () => void;
  /** deletes one of the user's own pieces (the demo rack can't be deleted) */
  onDelete?: (g: Garment) => void;
}) {
  // the piece waiting on "are you sure?"
  const [confirming, setConfirming] = useState<Garment | null>(null);
  const deletable = (g: Garment) => !!onDelete && !g.id.startsWith("demo-");
  const toStage = useToStage();
  const [query, setQuery] = useState("");
  const [scroll, setScroll] = useState(0);
  const [hover, setHover] = useState<Garment | null>(null);
  const [drag, setDrag] = useState<{ g: Garment; x: number; y: number; over: { box: Box; ok: boolean } | null } | null>(null);
  const press = useRef<Press | null>(null);

  const cat = categories.find((c) => c.id === category);
  const q = query.trim().toLowerCase();
  // search stays inside the open category, and matches tags as well as names
  const items = useMemo(
    () =>
      closet
        .filter((g) => g.category === category && (!q || searchText(g).includes(q)))
        // the user's own pieces come before the demo rack
        .sort((a, b) => Number(a.id.startsWith("demo-")) - Number(b.id.startsWith("demo-"))),
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
        if (Math.hypot(x - p.x0, y - p.y0) < DRAG_START_PX) return;
        p.dragging = true;
        onDragStart();
      }
      setDrag({ g: p.g, x, y, over: dropAt(p.g, x, y) });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      if (!p.dragging) return onWear(p.g);
      const { x, y } = toStage(e.clientX, e.clientY);
      setDrag(null);
      if (dropAt(p.g, x, y)?.ok) onWear(p.g);
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
    ? hover.name
    : items.length
      ? `${items.length} ${items.length === 1 ? "ITEM" : "ITEMS"}`
      : q
        ? "NO MATCHES"
        : "NOTHING HERE YET";

  return (
    <>
      {/* click outside to close; the category bar stays usable as tabs */}
      <div onClick={onClose} style={{ ...wide({ x: 0, y: 0, w: STAGE_W, h: L.categoryBar.y }), zIndex: 20, display: drag ? "none" : "block" }} />

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
          box={{ x: box.x + L.invSearch.dx, y: box.y + pad, w: L.invSearch.w, h: invHeader }}
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
                cursor: g ? "grab" : "default",
                touchAction: "none",
              }}
            >
              {g && <GarmentImage src={g.image} w={S - 6} h={S - 6} fill={0.95} spinner />}
              {g && hover === g && deletable(g) && (
                <button
                  type="button"
                  aria-label={`Delete ${g.name}`}
                  title="Delete"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(g);
                  }}
                  style={{ position: "absolute", right: -1, top: -1, width: 13, height: 13, padding: 0, border: `1px solid ${C.white}`, background: DELETE_RED, display: "grid", placeItems: "center", cursor: "pointer" }}
                >
                  <PixelText text="X" color={C.white} sx={1} sy={1} />
                </button>
              )}
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

      {confirming && (
        <>
          <div onClick={() => setConfirming(null)} style={{ ...DIM, zIndex: 25 }} />
          <div role="alertdialog" aria-label="Delete this piece?" style={{ position: "absolute", left: (STAGE_W - 240) / 2, top: L.categoryBar.y / 2 - 75, width: 240, height: 150, boxSizing: "border-box", padding: 12, background: C.invBg, border: `3px solid ${C.invEdge}`, zIndex: 26, display: "grid", gridTemplateRows: "1fr auto", gap: 10 }}>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <PixelLines text={`DELETE THE ${confirming.name.toUpperCase()}?`} maxWidth={210} color={C.invEdge} sx={1.6} sy={2} bold />
              <PixelLines text="IT'S REMOVED FROM YOUR CLOSET FOR GOOD. THIS CAN'T BE UNDONE." maxWidth={210} color={C.invText} sx={1.3} sy={1.7} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="bevel" onClick={() => setConfirming(null)} style={{ position: "relative", width: 96, height: 30, borderWidth: 2, background: C.btnGray, borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}` }}>
                <PixelText text="CANCEL" color={C.ink} sx={1.5} sy={1.9} bold />
              </button>
              <button
                type="button"
                className="bevel"
                autoFocus
                onClick={() => {
                  onDelete?.(confirming);
                  setConfirming(null);
                }}
                style={{ position: "relative", width: 96, height: 30, borderWidth: 2, background: DELETE_RED, borderColor: "#e4677f #6a0a1f #6a0a1f #e4677f" }}
              >
                <PixelText text="DELETE" color={C.white} sx={1.5} sy={1.9} bold />
              </button>
            </div>
          </div>
        </>
      )}

      {drag && (
        <>
          {drag.over && (
            <div
              style={{
                position: "absolute",
                left: drag.over.box.x,
                top: drag.over.box.y,
                width: drag.over.box.w,
                height: drag.over.box.h,
                boxSizing: "border-box",
                border: `4px ${drag.g.slot ? "solid" : "dashed"} ${drag.over.ok ? C.dropGlow : C.btnGrayDark}`,
                zIndex: 23,
                pointerEvents: "none",
              }}
            />
          )}
          <div style={{ position: "absolute", left: drag.x - DRAG_ICON / 2, top: drag.y - DRAG_ICON / 2, zIndex: 24, pointerEvents: "none" }}>
            <GarmentImage src={drag.g.image} w={DRAG_ICON} h={DRAG_ICON} outline={C.white} />
          </div>
        </>
      )}
    </>
  );
}

// The list that pops up from MORE: categories that didn't fit on the bar.
export function MoreMenu({ categories, onPick, onSignOut, settings = [], onClose }: {
  categories: Category[];
  onPick: (id: string) => void;
  onSignOut?: () => void;
  /** rows above SIGN OUT, e.g. CLOTHES: MENSWEAR (click to switch) */
  settings?: { key: string; label: string; title?: string; act: () => void }[];
  onClose: () => void;
}) {
  const rows: { key: string; label: string; title?: string; act: () => void }[] = [
    ...categories.map((c) => ({ key: c.id, label: c.label, act: () => onPick(c.id) })),
    ...settings.map((r) => ({ ...r, key: `setting-${r.key}` })),
    ...(onSignOut ? [{ key: "sign-out", label: "SIGN OUT", act: onSignOut }] : []),
  ];
  const firstSetting = rows.findIndex((r) => r.key.startsWith("setting-") || r.key === "sign-out");
  const { x, w, rowH } = L.moreMenu;
  const h = rows.length * rowH + 10;
  return (
    <>
      <div onClick={onClose} style={{ ...wide({ x: 0, y: 0, w: STAGE_W, h: L.categoryBar.y }), zIndex: 20 }} />
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
            aria-label={r.label}
            title={r.title}
            onClick={r.act}
            className="menu-row"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: rowH,
              padding: "0 6px",
              border: 0,
              borderTop: i === firstSetting && i > 0 ? `2px solid ${C.invSlot}` : 0,
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
