import { useCallback, useEffect, useRef, useState } from "react";
import { makeBody, type Body } from "../closet/bodyPhoto";
import type { BodyAnchors } from "../closet/body";
import { GarmentImage } from "../pixel/GarmentImage";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L, PHONE } from "../stage/layout";
import { loadPhoto } from "../upload/cutout";
import { RedrawError } from "../upload/gemini";
import { Scanner } from "../upload/Scanner";
import { Bevel, DIM } from "./Parts";

// MY MODEL PHOTO (under MORE): the user picks or pastes a photo of
// themselves, Gemini redraws them standing straight in a plain tank and
// shorts, and that figure replaces the stand-in on the reveal.

type Phase =
  | { kind: "intro" }
  | { kind: "working"; photo: HTMLCanvasElement }
  | { kind: "result"; canvas: HTMLCanvasElement; image: string; anchors: BodyAnchors }
  | { kind: "error"; message: string; limit?: boolean };

const PHRASES = ["STRIKING A POSE...", "FINDING YOUR ANGLES...", "STEPPING INTO THE STUDIO...", "ALMOST READY FOR THE RUNWAY..."];
const pad = 14;

export function BodyPhoto({ current, canRedraw, initialPhoto, onUse, onReset, onClose }: {
  current: Body | null;
  /** a photo from UPLOAD to start on straight away */
  initialPhoto?: HTMLCanvasElement;
  /** signed in: Gemini is only for accounts */
  canRedraw: boolean;
  onUse: (canvas: HTMLCanvasElement, anchors: BodyAnchors) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [phrase, setPhrase] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = L.uploadBox;
  const inner = box.w - pad * 2;

  const make = useCallback(async (photo: HTMLCanvasElement) => {
    try {
      setPhase({ kind: "working", photo });
      const { canvas, anchors } = await makeBody(photo);
      setPhase({ kind: "result", canvas, image: canvas.toDataURL("image/png"), anchors });
    } catch (e) {
      console.error(e);
      setPhase({ kind: "error", message: e instanceof RedrawError ? e.message : "THAT DIDN'T WORK. TRY ANOTHER PHOTO.", limit: e instanceof RedrawError && e.limit });
    }
  }, []);
  const start = useCallback(
    (file: Blob) =>
      loadPhoto(file).then(make, () => setPhase({ kind: "error", message: "THAT PHOTO WOULDN'T OPEN. TRY A JPEG OR PNG." })),
    [make],
  );
  // a photo handed over from UPLOAD starts once (never twice: it costs)
  const started = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!initialPhoto || !canRedraw || started.current === initialPhoto) return;
    started.current = initialPhoto;
    make(initialPhoto);
  }, [initialPhoto, canRedraw, make]);

  // paste a photo straight in
  useEffect(() => {
    if (!canRedraw) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file || phase.kind === "working") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      start(file);
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [canRedraw, phase.kind, start]);

  useEffect(() => {
    if (phase.kind !== "working") return;
    const t = window.setInterval(() => setPhrase((n) => n + 1), 1600);
    return () => clearInterval(t);
  }, [phase.kind]);

  const footY = box.y + box.h - pad - 34;
  const text = (t: string, y: number, color: string = C.invText, size = 1.4) => (
    <div style={{ position: "absolute", left: box.x + pad, top: y, width: inner }}>
      <PixelLines text={t} maxWidth={inner} color={color} sx={size} sy={size * 1.3} />
    </div>
  );

  let body;
  if (!canRedraw) {
    body = text("SIGN IN WITH YOUR PHONE NUMBER TO MAKE YOUR MODEL PHOTO.", box.y + 150, C.invText, 1.8);
  } else if (phase.kind === "intro" || phase.kind === "error") {
    body = (
      <>
        {current && (
          <div style={{ position: "absolute", left: box.x + box.w - pad - 70, top: box.y + 44, width: 70, height: 120, background: C.invSlot, border: `2px solid ${C.invEdge}`, boxSizing: "border-box" }}>
            <GarmentImage src={current.src} w={66} h={116} fill={0.95} />
          </div>
        )}
        {phase.kind === "error" ? (
          // something went wrong: say so plainly, in place of the explanation
          <div role="alert" style={{ position: "absolute", left: box.x + pad, top: box.y + 70, width: current ? inner - 84 : inner, display: "grid", gap: 14, justifyItems: "center" }}>
            <PixelText text={phase.limit ? "AS IF!" : "UH OH..."} color={C.invEdge} sx={3} sy={3.4} bold />
            <PixelLines text={phase.message} maxWidth={current ? inner - 84 : inner} color={C.invText} sx={1.7} sy={2.1} />
          </div>
        ) : (
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 48, width: current ? inner - 84 : inner, display: "grid", gap: 10 }}>
          <PixelLines text="PICK A PHOTO OF YOURSELF, HEAD TO TOE IF YOU CAN. ANY POSE OR OUTFIT IS FINE." maxWidth={current ? inner - 84 : inner} color={C.invText} sx={1.4} sy={1.8} align="left" />
          <PixelLines text="GEMINI, GOOGLE'S AI, REDRAWS YOU STANDING STRAIGHT IN A BLACK TANK AND SHORTS, SO THE CLOSET CAN DRESS YOU." maxWidth={current ? inner - 84 : inner} color={C.invText} sx={1.4} sy={1.8} align="left" />
          <PixelLines text="YOUR PHOTO IS SENT TO GOOGLE ONLY TO DO THIS, AND THE RESULT IS KEPT IN YOUR PRIVATE CLOSET." maxWidth={current ? inner - 84 : inner} color={C.invText} sx={1.4} sy={1.8} align="left" />
        </div>
        )}
        {!(phase.kind === "error" && phase.limit) && (
          <Bevel box={{ x: box.x + pad, y: box.y + 262, w: inner, h: 38 }} tone="blue" onClick={() => input.current?.click()} label="Pick a photo of yourself" style={{ borderWidth: 3 }}>
            <PixelText text={phase.kind === "error" ? "TRY ANOTHER PHOTO" : "OK, PICK A PHOTO"} color={C.white} sx={2} sy={2.4} bold shadow={C.btnBlueDark} />
          </Bevel>
        )}
        {!(phase.kind === "error" && phase.limit) && !PHONE && text("OR PASTE ONE: CTRL+V OR CMD+V", box.y + 310)}
        {current && (
          <Bevel box={{ x: box.x + pad, y: footY, w: 200, h: 34 }} tone="gray" onClick={onReset} label="Use the stand-in figure" style={{ borderWidth: 2 }}>
            <PixelText text="USE THE STAND-IN" color={C.ink} sx={1.5} sy={2} bold />
          </Bevel>
        )}
      </>
    );
  } else if (phase.kind === "working") {
    body = (
      <>
        <div style={{ position: "absolute", left: box.x + (box.w - 216) / 2, top: box.y + 48 }}>
          <Scanner size={216} photo={phase.photo} cutout={null} />
        </div>
        {text("MAKING YOUR MODEL PHOTO", box.y + 282, C.invEdge, 1.8)}
        {text(PHRASES[phrase % PHRASES.length], box.y + 310)}
        {text("THIS TAKES ABOUT 20 SECONDS.", box.y + 334)}
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: "absolute", left: box.x + (box.w - 150) / 2, top: box.y + 44, width: 150, height: 270, background: C.panel, border: `3px solid ${C.invEdge}`, boxSizing: "border-box", display: "grid", placeItems: "center" }}>
          <GarmentImage key={phase.image} src={phase.image} w={140} h={260} fill={0.96} />
        </div>
        <Bevel box={{ x: box.x + pad, y: footY, w: 150, h: 34 }} tone="gray" onClick={() => setPhase({ kind: "intro" })} label="Try another photo" style={{ borderWidth: 2 }}>
          <PixelText text="TRY AGAIN" color={C.ink} sx={1.8} sy={2} bold />
        </Bevel>
        <Bevel box={{ x: box.x + box.w - pad - 150, y: footY, w: 150, h: 34 }} tone="blue" onClick={() => onUse(phase.canvas, phase.anchors)} label="Use this photo" style={{ borderWidth: 2 }}>
          <PixelText text="USE IT" color={C.white} sx={1.8} sy={2} bold shadow={C.btnBlueDark} />
        </Bevel>
      </>
    );
  }

  return (
    <>
      <div onClick={phase.kind === "working" ? undefined : onClose} style={{ ...DIM, zIndex: 30 }} />
      <div
        role="dialog"
        aria-label="My model photo"
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
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + pad + 2 }}>
          <PixelText text="MY MODEL PHOTO" color={C.invText} sx={2} sy={2.2} bold />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="bevel"
          style={{ left: box.x + box.w - pad - 26, top: box.y + pad - 4, width: 26, height: 26, background: C.btnGray, borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}` }}
        >
          <PixelText text="X" color={C.ink} sx={2} sy={2} />
        </button>
        {body}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) start(f);
        }}
      />
    </>
  );
}
