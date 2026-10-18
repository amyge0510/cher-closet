import { useMemo, useState } from "react";
import type { Garment } from "../closet/types";
import { PixelImage } from "../pixel/PixelImage";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { back, boardsFor, buildBoard, choose, QUESTIONS, result, startQuiz, STEP_TITLES, targetFor, type BoardItem, type QuizState } from "../style/quiz";
import { family, leaf, type MyStyle } from "../style/styles";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { Bevel } from "./Parts";

const pad = 10;

function Board({ items, bg, w, h, onPick, label }: { items: BoardItem[]; bg: string; w: number; h: number; onPick?: () => void; label: string }) {
  const [hover, setHover] = useState(false);
  const Tag = onPick ? "button" : "div";
  return (
    <Tag
      type={onPick ? "button" : undefined}
      aria-label={label}
      onClick={onPick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: w,
        height: h,
        padding: 0,
        background: bg,
        boxSizing: "border-box",
        border: `3px solid ${hover && onPick ? C.invEdge : C.white}`,
        boxShadow: `3px 3px 0 ${C.invSlotShadow}`,
        cursor: onPick ? "pointer" : "default",
        display: "block",
      }}
    >
      {items.map(({ garment, box }) => (
        <PixelImage
          key={garment.id}
          src={garment.image}
          w={Math.round(box.w * (w - 6))}
          h={Math.round(box.h * (h - 6))}
          pixel={2}
          outline={C.white}
          style={{ position: "absolute", left: Math.round(box.x * (w - 6)), top: Math.round(box.y * (h - 6)) }}
        />
      ))}
    </Tag>
  );
}

function SmallButton({ x, y, w, label, hint, tone = "gray", onClick }: {
  x: number; y: number; w: number; label: string; hint?: string; tone?: "gray" | "blue"; onClick: () => void;
}) {
  return (
    <Bevel box={{ x, y, w, h: 30 }} tone={tone} onClick={onClick} label={label} title={hint} style={{ borderWidth: 2 }}>
      <PixelText text={label} color={C.ink} sx={1.8} sy={2} bold />
    </Bevel>
  );
}

// The MY STYLE pop-up: two rounds of "which of these is you?", each a row
// of outfit boards made from the user's own closet, then the result.
export function StyleQuiz({ closet, saved, onSave, onClose }: {
  closet: Garment[];
  saved: MyStyle | null;
  /** the chosen style, and the board to dress in */
  onSave: (s: MyStyle, board: BoardItem[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState<QuizState>(() => (saved ? { step: 2, family: saved.family, leaf: saved.leaf, seed: 1 } : startQuiz()));
  const boards = useMemo(() => (q.step < QUESTIONS ? boardsFor(closet, q) : []), [closet, q]);
  const box = L.styleQuiz;
  const { y: by, w: bw, h: bh, gap } = L.quizBoard;
  const chosen = result(q);
  const finalBoard = useMemo(() => (chosen ? buildBoard(closet, targetFor(chosen), q.seed * 31) : []), [closet, chosen?.leaf, q.seed]);

  const crumbs = [q.family && family(q.family)?.label, q.leaf && leaf(q.leaf)?.label].filter(Boolean).join(" > ");
  const footY = box.y + box.h - pad - 30;

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(10,8,30,0.35)" }} />
      <div
        role="dialog"
        aria-label="My style"
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
          <PixelText text="MY STYLE" color={C.invText} sx={2} sy={2.2} bold />
          <PixelText text={q.step < QUESTIONS ? `STEP ${q.step + 1} OF ${QUESTIONS}: ${STEP_TITLES[q.step]}` : STEP_TITLES[q.step]} color={C.invText} sx={1.5} sy={2} />
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

        {q.step < QUESTIONS &&
          boards.map(({ option, items }, i) => {
            const x = box.x + pad + 3 + i * (bw + gap);
            return (
              <div key={option.id} style={{ position: "absolute", left: x, top: by }}>
                <Board items={items} bg={option.bg} w={bw} h={bh} label={option.label} onPick={() => setQ(choose(q, option.id))} />
                <div style={{ width: bw, marginTop: 6 }}>
                  <PixelLines text={option.label} maxWidth={bw} color={C.invText} sx={1.6} sy={2} bold />
                </div>
              </div>
            );
          })}

        {q.step === QUESTIONS && chosen && (
          <>
            <div style={{ position: "absolute", left: box.x + pad + 3, top: by }}>
              <Board items={finalBoard} bg={leaf(chosen.leaf)?.bg ?? C.white} w={200} h={bh} label="Your style board" />
            </div>
            <div style={{ position: "absolute", left: box.x + pad + 230, top: by + 10, width: 360, display: "grid", gap: 14 }}>
              <PixelText text="YOU'RE" color={C.invText} sx={2} sy={2} />
              <PixelLines text={leaf(chosen.leaf)?.label ?? ""} maxWidth={360} color={C.invEdge} sx={4.5} sy={5} bold align="left" shadow={C.invSlot} />
              <PixelLines text={`FROM THE ${family(chosen.family)?.label} FAMILY.`} maxWidth={360} color={C.invText} sx={1.8} sy={2.2} align="left" />
              <PixelLines text="WEAR IT PUTS THIS OUTFIT ON. AUTO DRESS WILL KEEP PICKING FROM YOUR CLOSET IN THIS STYLE." maxWidth={360} color={C.invText} sx={1.5} sy={1.8} align="left" />
            </div>
          </>
        )}

        <div style={{ position: "absolute", left: box.x + pad + 3, top: footY + 9 }}>
          {q.step < QUESTIONS && crumbs && <PixelText text={crumbs} color={C.invText} sx={1.5} sy={1.8} />}
        </div>
        {q.step > 0 && q.step < QUESTIONS && <SmallButton x={box.x + box.w - pad - 292} y={footY} w={110} label="BACK" onClick={() => setQ(back(q))} />}
        {q.step < QUESTIONS && (
          <SmallButton x={box.x + box.w - pad - 175} y={footY} w={172} label="OTHER OUTFITS" hint="Same choices, different pieces from your closet" onClick={() => setQ({ ...q, seed: q.seed + 1 })} />
        )}
        {q.step === QUESTIONS && (
          <>
            <SmallButton x={box.x + box.w - pad - 425} y={footY} w={127} label="RETAKE" onClick={() => setQ(startQuiz(q.seed + 1))} />
            <SmallButton x={box.x + box.w - pad - 290} y={footY} w={152} label="NEW OUTFIT" hint="Same style, different pieces from your closet" onClick={() => setQ({ ...q, seed: q.seed + 1 })} />
            <SmallButton x={box.x + box.w - pad - 130} y={footY} w={127} label="WEAR IT" tone="blue" onClick={() => onSave(chosen!, finalBoard)} />
          </>
        )}
      </div>
    </>
  );
}
