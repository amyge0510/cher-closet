import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "../closet/categories";
import type { Garment } from "../closet/types";
import { PixelField } from "../pixel/PixelField";
import { GarmentImage } from "../pixel/GarmentImage";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { leaf, type Wardrobe } from "../style/styles";
import { findPieces, finishCutout, forTagging, loadPhoto, pngBlob, type Piece, type Progress } from "../upload/cutout";
import { Scanner } from "../upload/Scanner";
import { garmentFrom, tagCategories, tagGarment, type Tags } from "../upload/tags";
import { RedrawError, tidyGarment } from "../upload/gemini";
import { Bevel } from "./Parts";

// The UPLOAD pop-up: pick photos, drop them, or paste one. Each photo goes
// through: background removal (the pixel scanner), tagging, a quick look at
// the result, then it's filed and floats down to its category tab.

type Phase =
  | { kind: "pick" }
  | { kind: "cutting"; photo: HTMLCanvasElement; progress: { what: "download" | "cut"; f: number } | null }
  | { kind: "popping"; photo: HTMLCanvasElement; cut: HTMLCanvasElement; hint?: string }
  | { kind: "tagging"; photo: HTMLCanvasElement; cut: HTMLCanvasElement }
  | {
      kind: "show"; image: string; png: Blob; canvas: HTMLCanvasElement; tags: Tags; how: "claude" | "guess"; fixing: boolean;
      /** TIDY UP: the cut-out before the redraw, to switch back to */
      original?: { image: string; png: Blob; canvas: HTMLCanvasElement };
      redrawing?: boolean;
      note?: string;
    }
  | { kind: "error"; message: string };

const AUTO_FILE_MS = 3200; // Claude's tags file themselves after this long
const CUT_PHRASES = ["SNIPPING...", "FINDING THE CLOTHES...", "LOSING THE BACKGROUND...", "AS IF!", "ALMOST..."];
const TAG_PHRASES = ["READING THE TAG...", "NAMING IT...", "PICKING ITS STYLE..."];

const pad = 14;
const SCAN = 216; // the scanner's size on screen

const imageFiles = (list: FileList | File[] | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

export function Upload({ categories, wardrobe, incoming, canRedraw, onFile, onClose }: {
  categories: Category[];
  /** signed in, so TIDY UP (Gemini) is available */
  canRedraw: boolean;
  wardrobe: Wardrobe;
  /** images pasted or dropped from outside the pop-up */
  incoming: { files: Blob[]; key: number } | null;
  /** a finished garment, its PNG, and where on screen it was shown (to fly from) */
  onFile: (g: Garment, png: Blob, from: { x: number; y: number; size: number }) => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<Blob[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [phrase, setPhrase] = useState(0);
  // the pieces found in the current photo that are still to be filed
  const [pieces, setPieces] = useState<{ photo: HTMLCanvasElement; left: Piece[]; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const box = L.uploadBox;
  const cats = tagCategories(categories);

  const add = useCallback((files: Blob[]) => {
    if (!files.length) return;
    setQueue((q) => [...q, ...files]);
    setTotal((t) => t + files.length);
  }, []);

  useEffect(() => {
    if (incoming) add(incoming.files);
  }, [incoming, add]);

  // the next photo in line starts as soon as the last one is done
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    (async () => {
      try {
        const photo = await loadPhoto(current);
        if (cancelled) return;
        setPhase({ kind: "cutting", photo, progress: null });
        const progress: Progress = (what, f) => !cancelled && setPhase((p) => (p.kind === "cutting" ? { ...p, progress: { what, f } } : p));
        const found = await findPieces(photo, progress);
        if (cancelled) return;
        if (!found.pieces.length) {
          setPhase({
            kind: "error",
            message: found.problem
              ? `THE BACKGROUND REMOVER COULDN'T LOAD. CHECK YOUR CONNECTION AND TRY AGAIN. (${found.problem})`
              : "COULDN'T FIND ANY CLOTHES IN THAT PHOTO. TRY ONE WITH THE OUTFIT IN FULL VIEW.",
          });
          return;
        }
        const [first, ...rest] = found.pieces;
        setPieces({ photo, left: rest, total: found.pieces.length });
        setPhase({ kind: "popping", photo, cut: first.canvas, hint: first.hint });
      } catch (e) {
        console.error(e);
        if (!cancelled) setPhase({ kind: "error", message: "THAT PHOTO WOULDN'T OPEN. TRY A JPEG OR PNG." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  // once the background has popped away: tag it
  const tag = useCallback(
    async (photo: HTMLCanvasElement, cut: HTMLCanvasElement, hint?: string) => {
      setPhase({ kind: "tagging", photo, cut });
      const final = finishCutout(cut);
      const [{ tags, how }, png] = await Promise.all([tagGarment(final, await forTagging(final), cats, wardrobe, hint), pngBlob(final)]);
      setPhase({ kind: "show", image: final.toDataURL("image/png"), png, canvas: final, tags, how, fixing: false });
    },
    [cats.join(), wardrobe],
  );

  // rotating status phrases while working
  useEffect(() => {
    if (phase.kind !== "cutting" && phase.kind !== "tagging") return;
    const t = window.setInterval(() => setPhrase((n) => n + 1), 1300);
    return () => clearInterval(t);
  }, [phase.kind]);

  const imageBox = { x: box.x + (box.w - SCAN) / 2, y: box.y + 48, size: SCAN };
  const next = useCallback(() => {
    setQueue((q) => q.slice(1));
    setPhase({ kind: "pick" });
  }, []);
  // nothing left: reset the count for the next batch
  useEffect(() => {
    if (!queue.length && phase.kind === "pick") setTotal(0);
  }, [queue.length, phase.kind]);

  // the next piece from the same photo, or the next photo
  const advance = useCallback(() => {
    if (pieces?.left.length) {
      const [piece, ...rest] = pieces.left;
      setPieces({ ...pieces, left: rest });
      setPhase({ kind: "popping", photo: pieces.photo, cut: piece.canvas, hint: piece.hint });
      return;
    }
    setPieces(null);
    if (queue.length <= 1) onClose();
    next();
  }, [pieces, queue.length, onClose, next]);

  const file = useCallback(() => {
    if (phase.kind !== "show") return;
    const g = garmentFrom(crypto.randomUUID(), phase.image, phase.tags);
    onFile(g, phase.png, imageBox);
    advance();
  }, [phase, onFile, advance]);

  // Claude's tags file themselves after a moment, unless you hit FIX IT
  useEffect(() => {
    if (phase.kind !== "show" || phase.fixing || phase.redrawing || phase.original || phase.how !== "claude" || !phase.tags.isClothing) return;
    const t = window.setTimeout(file, AUTO_FILE_MS);
    return () => clearTimeout(t);
  }, [phase, file]);

  // TIDY UP: Gemini redraws the piece as a straight-on product shot; the
  // button then switches between the redraw and the original
  const tidy = useCallback(async () => {
    if (phase.kind !== "show" || phase.redrawing) return;
    if (phase.original) {
      const { original, ...rest } = phase;
      return setPhase({ ...rest, ...original, original: undefined, note: undefined });
    }
    setPhase({ ...phase, redrawing: true, note: undefined });
    try {
      const final = finishCutout(await tidyGarment(phase.canvas, phase.tags.name, phase.tags.colors));
      const png = await pngBlob(final);
      setPhase((p) => (p.kind === "show" ? { ...p, image: final.toDataURL("image/png"), png, canvas: final, redrawing: false, original: { image: p.image, png: p.png, canvas: p.canvas } } : p));
    } catch (e) {
      setPhase((p) => (p.kind === "show" ? { ...p, redrawing: false, note: e instanceof RedrawError ? e.message : "THE REDRAW DIDN'T WORK." } : p));
    }
  }, [phase]);

  const setTags = (patch: Partial<Tags>) => setPhase((p) => (p.kind === "show" ? { ...p, tags: { ...p.tags, ...patch } } : p));
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id.toUpperCase();
  const position = [total > 1 && `PHOTO ${total - queue.length + 1} OF ${total}`, pieces && pieces.total > 1 && `PIECE ${pieces.total - pieces.left.length} OF ${pieces.total}`]
    .filter(Boolean)
    .join(" · ");

  let body;
  if (phase.kind === "pick") {
    body = (
      <>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(imageFiles(e.dataTransfer.files));
          }}
          style={{
            position: "absolute",
            left: box.x + pad,
            top: box.y + 46,
            width: box.w - pad * 2,
            height: 214,
            boxSizing: "border-box",
            border: `3px dashed ${C.invSlotShadow}`,
            background: C.white,
            display: "grid",
            placeContent: "center",
            justifyItems: "center",
            gap: 14,
          }}
        >
          <PixelText text="^" color={C.btnBlue} sx={7} sy={7} />
          <PixelText text="DROP PHOTOS HERE" color={C.invText} sx={2.2} sy={2.6} bold />
          <PixelText text="OR PASTE ONE: CTRL+V OR CMD+V" color={C.invText} sx={1.5} sy={1.9} />
        </div>
        <Bevel box={{ x: box.x + pad, y: box.y + 274, w: box.w - pad * 2, h: 38 }} tone="blue" onClick={() => input.current?.click()} label="Upload from computer" style={{ borderWidth: 3 }}>
          <PixelText text="UPLOAD FROM COMPUTER" color={C.white} sx={2} sy={2.4} bold shadow={C.btnBlueDark} />
        </Bevel>
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 326, width: box.w - pad * 2 }}>
          <PixelLines text="ONE PIECE PER PHOTO, LAID FLAT OR HUNG ON A PLAIN BACKGROUND, WORKS BEST." maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
        </div>
      </>
    );
  } else if (phase.kind === "cutting" || phase.kind === "popping" || phase.kind === "tagging") {
    const cut = phase.kind === "cutting" ? null : phase.cut;
    const status =
      phase.kind === "tagging"
        ? TAG_PHRASES[phrase % TAG_PHRASES.length]
        : phase.kind === "cutting" && phase.progress?.what === "download" && phase.progress.f < 1
          ? `GETTING THE SCISSORS... ${Math.round(phase.progress.f * 100)}%`
          : CUT_PHRASES[phrase % CUT_PHRASES.length];
    body = (
      <>
        <div style={{ position: "absolute", left: imageBox.x, top: imageBox.y }}>
          <Scanner size={SCAN} photo={phase.photo} cutout={cut} onCleared={phase.kind === "popping" ? () => tag(phase.photo, phase.cut, phase.hint) : undefined} />
        </div>
        <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 18, width: box.w - pad * 2 }}>
          <PixelLines text={phase.kind === "tagging" ? "TAGGING" : "REMOVING THE BACKGROUND"} maxWidth={box.w - pad * 2} color={C.invEdge} sx={2} sy={2.4} bold />
        </div>
        <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 46, width: box.w - pad * 2 }}>
          <PixelLines text={status} maxWidth={box.w - pad * 2} color={C.invText} sx={1.5} sy={1.9} />
        </div>
      </>
    );
  } else if (phase.kind === "show") {
    const { tags } = phase;
    const styles = tags.styles.map((s) => leaf(s)?.label ?? s).join(", ") || "EVERYDAY";
    body = (
      <>
        <div style={{ position: "absolute", left: imageBox.x, top: imageBox.y, width: SCAN, height: phase.fixing ? 120 : SCAN, background: C.invSlot, display: "grid", placeItems: "center", boxSizing: "border-box", border: `3px solid ${C.invEdge}` }}>
          {phase.note && !phase.redrawing && (
            <div role="alert" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 8px", background: "#a3123a", zIndex: 1 }}>
              <PixelLines text={phase.note} maxWidth={SCAN - 22} color={C.white} sx={1.3} sy={1.7} />
            </div>
          )}
          {phase.redrawing ? (
            <Scanner size={SCAN - 6} photo={phase.canvas} cutout={null} />
          ) : (
            <GarmentImage key={phase.image} src={phase.image} w={phase.fixing ? 100 : SCAN - 24} h={phase.fixing ? 100 : SCAN - 24} fill={0.95} outline={C.white} />
          )}
        </div>
        {!phase.fixing ? (
          <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 10, width: box.w - pad * 2, display: "grid", gap: 6, justifyItems: "center" }}>
            <PixelLines text={tags.name.toUpperCase()} maxWidth={box.w - pad * 2} color={C.invEdge} sx={2.2} sy={2.6} bold />
            <PixelLines text={`GOES IN ${catLabel(tags.category)}. ${tags.colors.join(", ").toUpperCase()}. ${styles}.`} maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            {!tags.isClothing && <PixelLines text="HMM, THAT DOESN'T LOOK LIKE CLOTHES." maxWidth={box.w - pad * 2} color="#a3123a" sx={1.4} sy={1.8} />}
            {phase.redrawing ? (
              <PixelLines text="TIDYING IT UP..." maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            ) : phase.original ? (
              <PixelLines text="REDRAWN BY AI. ORIGINAL SWITCHES BACK." maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            ) : (
              phase.how === "guess" && <PixelLines text="BEST GUESS. FIX IT IF IT'S WRONG." maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            )}
          </div>
        ) : (
          <>
            <PixelField box={{ x: box.x + pad, y: imageBox.y + 130, w: box.w - pad * 2, h: 30 }} label="Name" value={tags.name.toUpperCase()} onChange={(v) => setTags({ name: v })} maxLength={28} sx={1.8} sy={2.2} />
            <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + 168, width: box.w - pad * 2, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {cats.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="bevel"
                  onClick={() => setTags({ category: id })}
                  style={{
                    position: "relative",
                    height: 24,
                    padding: "0 6px",
                    borderWidth: 2,
                    background: tags.category === id ? C.btnBlue : C.btnGray,
                    borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
                  }}
                >
                  <PixelText text={catLabel(id)} color={tags.category === id ? C.white : C.ink} sx={1.3} sy={1.7} />
                </button>
              ))}
            </div>
          </>
        )}
        {(() => {
          // SKIP · FIX IT · (TIDY UP) · FILE IT along the bottom
          const y = box.y + box.h - pad - 34;
          const widths = canRedraw ? [76, 84, 100, 80] : [104, 120, 0, 120];
          const left = box.x + pad;
          const xs = canRedraw ? [left, left + 80, left + 168, left + 272] : [left, left + 112, 0, box.x + box.w - pad - 120];
          const sx = canRedraw ? 1.5 : 1.8;
          return (
            <>
              <Bevel box={{ x: xs[0], y, w: widths[0], h: 34 }} tone="gray" onClick={advance} label="Skip this piece" title="Don't file this one" style={{ borderWidth: 2 }}>
                <PixelText text="SKIP" color={C.ink} sx={sx} sy={2} bold />
              </Bevel>
              <Bevel box={{ x: xs[1], y, w: widths[1], h: 34 }} tone="gray" onClick={() => setPhase({ ...phase, fixing: !phase.fixing })} label="Fix the tags" style={{ borderWidth: 2 }}>
                <PixelText text={phase.fixing ? "DONE" : "FIX IT"} color={C.ink} sx={sx} sy={2} bold />
              </Bevel>
              {canRedraw && (
                <Bevel box={{ x: xs[2], y, w: widths[2], h: 34 }} tone="gray" onClick={tidy} label={phase.original ? "Show the original" : "Tidy up with AI"} title="Gemini redraws it as a straight-on product shot (a few cents)" style={{ borderWidth: 2, opacity: phase.redrawing ? 0.6 : 1 }}>
                  <PixelText text={phase.original ? "ORIGINAL" : "TIDY UP"} color={C.ink} sx={sx} sy={2} bold />
                </Bevel>
              )}
              <Bevel box={{ x: xs[3], y, w: widths[3], h: 34 }} tone="blue" onClick={phase.redrawing ? undefined : file} label="File it" style={{ borderWidth: 2 }}>
                <PixelText text="FILE IT" color={C.white} sx={sx} sy={2} bold shadow={C.btnBlueDark} />
              </Bevel>
            </>
          );
        })()}
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 140, width: box.w - pad * 2 }}>
          <PixelLines text={phase.message} maxWidth={box.w - pad * 2} color="#a3123a" sx={1.6} sy={2} />
        </div>
        <Bevel box={{ x: box.x + (box.w - 170) / 2, y: box.y + 250, w: 170, h: 34 }} tone="blue" onClick={advance} label="OK" style={{ borderWidth: 2 }}>
          <PixelText text="OK" color={C.white} sx={1.8} sy={2} bold />
        </Bevel>
      </>
    );
  }

  const busy = phase.kind === "cutting" || phase.kind === "popping" || phase.kind === "tagging";
  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(10,8,30,0.35)" }} />
      <div
        role="dialog"
        aria-label="Upload clothes"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(imageFiles(e.dataTransfer.files));
        }}
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
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + pad + 2, display: "flex", gap: 12, alignItems: "baseline" }}>
          <PixelText text="UPLOAD" color={C.invText} sx={2} sy={2.2} bold />
          {position && <PixelText text={position} color={C.invText} sx={1.5} sy={2} />}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="bevel"
          style={{
            left: box.x + box.w - pad - 26,
            top: box.y + pad - 4,
            width: 26,
            height: 26,
            background: C.btnGray,
            borderColor: `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
          }}
        >
          <PixelText text="X" color={C.ink} sx={2} sy={2} />
        </button>
        {body}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(imageFiles(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}
