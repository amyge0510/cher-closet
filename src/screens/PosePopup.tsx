import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { Bevel, DIM } from "./Parts";

// STRIKE A POSE: the board she posed for, to save or try another pose.
export function PosePopup({ image, onSave, onAgain, onClose }: { image: string | null; onSave: () => void; onAgain: () => void; onClose: () => void }) {
  const box = L.poseBox;
  const pad = 10;
  const foot = 34;
  return (
    <>
      <div onClick={onClose} style={{ ...DIM, zIndex: 30 }} />
      <div
        role="dialog"
        aria-label="Strike a pose"
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
        <div style={{ position: "absolute", left: box.x + pad + 2, top: box.y + pad + 4 }}>
          <PixelText text="STRIKE A POSE!" color={C.invText} sx={1.8} sy={2.1} bold />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="bevel"
          style={{ left: box.x + box.w - pad - 26, top: box.y + pad, width: 26, height: 26, background: C.btnGray, borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}` }}
        >
          <PixelText text="X" color={C.ink} sx={2} sy={2} />
        </button>
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 44, width: box.w - pad * 2, height: box.h - 44 - foot - pad * 2, display: "grid", placeItems: "center" }}>
          {image ? (
            <img src={image} alt="Your pose on a board" style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated", boxShadow: `3px 3px 0 ${C.invSlotShadow}` }} />
          ) : (
            <PixelText text="SAY CHEESE..." color={C.invText} sx={2} sy={2.4} />
          )}
        </div>
        <Bevel box={{ x: box.x + pad, y: box.y + box.h - pad - foot, w: (box.w - pad * 3) / 2, h: foot }} tone="gray" onClick={onAgain} label="Another pose" style={{ borderWidth: 2 }}>
          <PixelText text="NEW POSE" color={C.ink} sx={1.6} sy={2} bold />
        </Bevel>
        <Bevel box={{ x: box.x + pad * 2 + (box.w - pad * 3) / 2, y: box.y + box.h - pad - foot, w: (box.w - pad * 3) / 2, h: foot }} tone="blue" onClick={image ? onSave : undefined} label="Save the picture" style={{ borderWidth: 2 }}>
          <PixelText text="SAVE PICTURE" color={C.white} sx={1.6} sy={2} bold shadow={C.btnBlueDark} />
        </Bevel>
      </div>
    </>
  );
}
