import { useState } from "react";
import type { Garment, Look } from "../closet/types";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { boardFromOutfit } from "../style/quiz";
import { C } from "../stage/palette";
import { L, PHONE } from "../stage/layout";
import { Bevel, DIM } from "./Parts";
import { Board } from "./StyleQuiz";

const pad = 10;
const COLS = PHONE ? 2 : 4; // a 2-wide grid on a phone
const ROWS = 2;
const PER_PAGE = COLS * ROWS;
const BOARD_BGS = ["#f6dd7a", "#f7cdd8", "#cde0ee", "#dfe8c5", "#d9c9f3", "#e9dfcc"];

// The SAVED LOOKS pop-up: every outfit the user saved, as small flat-lay
// boards. Click one to put it back on; the X deletes it.
export function SavedLooks({ looks, closet, onWear, onDelete, onClose }: {
  looks: Look[];
  closet: Garment[];
  onWear: (look: Look) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const byId = (id: string) => closet.find((g) => g.id === id);
  // looks whose top or bottom has since left the closet can't be worn
  const wearable = looks.filter((l) => byId(l.top) && byId(l.bottom));
  const pages = Math.max(1, Math.ceil(wearable.length / PER_PAGE));
  const shown = wearable.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const box = L.styleQuiz;
  const bw = PHONE ? 170 : 145;
  const bh = PHONE ? 200 : 150;
  const gap = 8;

  return (
    <>
      <div onClick={onClose} style={{ ...DIM, zIndex: 30 }} />
      <div
        role="dialog"
        aria-label="Saved looks"
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
          zIndex: 31,
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, zIndex: 32 }}>
        <div style={{ position: "absolute", left: box.x + pad + 2, top: box.y + pad + 4, display: "flex", gap: 14, alignItems: "baseline" }}>
          <PixelText text="SAVED LOOKS" color={C.invText} sx={2} sy={2.2} bold />
          <PixelText text={wearable.length ? "CLICK ONE TO WEAR IT" : ""} color={C.invText} sx={1.5} sy={2} />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="bevel"
          style={{
            left: box.x + box.w - pad - 29,
            top: box.y + pad,
            width: 26,
            height: 26,
            background: C.btnGray,
            borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
          }}
        >
          <PixelText text="X" color={C.ink} sx={2} sy={2} />
        </button>

        {wearable.length === 0 && (
          <div style={{ position: "absolute", left: box.x + 60, top: box.y + 150, width: box.w - 120 }}>
            <PixelLines text="NO SAVED LOOKS YET. AFTER DRESS ME, HIT ♥ SAVE ON AN OUTFIT YOU LOVE." maxWidth={box.w - 120} color={C.invText} sx={2} sy={2.4} />
          </div>
        )}

        {shown.map((look, i) => {
          const garments = [look.top, look.bottom, ...Object.values(look.extras)].map(byId).filter((g): g is Garment => !!g);
          const x = box.x + (PHONE ? (box.w - COLS * bw - gap) / 2 : pad + 3) + (i % COLS) * (bw + gap);
          const y = box.y + 46 + Math.floor(i / COLS) * (bh + gap);
          const n = page * PER_PAGE + i + 1;
          return (
            <div key={look.id} style={{ position: "absolute", left: x, top: y }}>
              <Board items={boardFromOutfit(garments)} bg={BOARD_BGS[n % BOARD_BGS.length]} w={bw} h={bh} label={`Wear look ${n}`} onPick={() => onWear(look)} />
              <button
                type="button"
                aria-label={`Delete look ${n}`}
                onClick={() => onDelete(look.id)}
                className="bevel"
                style={{ left: bw - 22, top: 4, width: 18, height: 18, borderWidth: 2, background: C.btnGray, borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}` }}
              >
                <PixelText text="X" color={C.ink} sx={1.2} sy={1.2} />
              </button>
            </div>
          );
        })}

        {pages > 1 && (
          <>
            <div style={{ position: "absolute", left: box.x + pad + 3, top: box.y + box.h - pad - 21 }}>
              <PixelText text={`PAGE ${page + 1} OF ${pages}`} color={C.invText} sx={1.5} sy={1.8} />
            </div>
            <Bevel box={{ x: box.x + box.w - pad - 232, y: box.y + box.h - pad - 30, w: 110, h: 30 }} tone="gray" onClick={() => setPage((p) => Math.max(0, p - 1))} label="Previous page" style={{ borderWidth: 2 }}>
              <PixelText text="BACK" color={C.ink} sx={1.8} sy={2} bold />
            </Bevel>
            <Bevel box={{ x: box.x + box.w - pad - 115, y: box.y + box.h - pad - 30, w: 112, h: 30 }} tone="gray" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} label="Next page" style={{ borderWidth: 2 }}>
              <PixelText text="NEXT" color={C.ink} sx={1.8} sy={2} bold />
            </Bevel>
          </>
        )}
      </div>
    </>
  );
}
