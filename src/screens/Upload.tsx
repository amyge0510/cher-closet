import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "../closet/categories";
import type { Garment } from "../closet/types";
import { PixelField } from "../pixel/PixelField";
import { PixelImage } from "../pixel/PixelImage";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { leaf, type Wardrobe } from "../style/styles";
import { finishCutout, forTagging, loadPhoto, pngBlob, removeBackground, type Progress } from "../upload/cutout";
import { Scanner } from "../upload/Scanner";
import { garmentFrom, tagCategories, tagGarment, type Tags } from "../upload/tags";
import { Bevel } from "./Parts";

// The UPLOAD pop-up: pick photos, drop them, or paste one. Each photo goes
// through: background removal (the pixel scanner), tagging, a quick look at
// the result, then it's filed and floats down to its category tab.

type Phase =
  | { kind: "pick" }
  | { kind: "cutting"; photo: HTMLCanvasElement; progress: { what: "download" | "cut"; f: number } | null }
  | { kind: "popping"; photo: HTMLCanvasElement; cut: HTMLCanvasElement }
  | { kind: "tagging"; photo: HTMLCanvasElement; cut: HTMLCanvasElement }
  | { kind: "show"; image: string; png: Blob; tags: Tags; how: "claude" | "guess"; fixing: boolean }
  | { kind: "error"; message: string };

const AUTO_FILE_MS = 3200; // Claude's tags file themselves after this long
const CUT_PHRASES = ["SNIPPING...", "FINDING THE CLOTHES...", "LOSING THE BACKGROUND...", "AS IF!", "ALMOST..."];
const TAG_PHRASES = ["READING THE TAG...", "NAMING IT...", "PICKING ITS STYLE..."];

const pad = 14;
const SCAN = 216; // the scanner's size on screen

const imageFiles = (list: FileList | File[] | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

export function Upload({ categories, wardrobe, incoming, onFile, onClose }: {
  categories: Category[];
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
        const { canvas: cut } = await removeBackground(photo, progress);
        if (cancelled) return;
        setPhase({ kind: "popping", photo, cut });
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
    async (photo: HTMLCanvasElement, cut: HTMLCanvasElement) => {
      setPhase({ kind: "tagging", photo, cut });
      const final = finishCutout(cut);
      const [{ tags, how }, png] = await Promise.all([tagGarment(final, await forTagging(final), cats, wardrobe), pngBlob(final)]);
      setPhase({ kind: "show", image: final.toDataURL("image/png"), png, tags, how, fixing: false });
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

  const file = useCallback(() => {
    if (phase.kind !== "show") return;
    const g = garmentFrom(crypto.randomUUID(), phase.image, phase.tags);
    onFile(g, phase.png, imageBox);
    if (queue.length <= 1) onClose();
    next();
  }, [phase, onFile, queue.length, onClose, next]);

  // Claude's tags file themselves after a moment, unless you hit FIX IT
  useEffect(() => {
    if (phase.kind !== "show" || phase.fixing || phase.how !== "claude" || !phase.tags.isClothing) return;
    const t = window.setTimeout(file, AUTO_FILE_MS);
    return () => clearTimeout(t);
  }, [phase, file]);

  const setTags = (patch: Partial<Tags>) => setPhase((p) => (p.kind === "show" ? { ...p, tags: { ...p.tags, ...patch } } : p));
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id.toUpperCase();
  const position = total > 1 ? `${total - queue.length + 1} OF ${total}` : "";

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
          <Scanner size={SCAN} photo={phase.photo} cutout={cut} onCleared={phase.kind === "popping" ? () => tag(phase.photo, phase.cut) : undefined} />
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
          <PixelImage key={phase.image} src={phase.image} w={phase.fixing ? 100 : SCAN - 24} h={phase.fixing ? 100 : SCAN - 24} pixel={2} fill={0.95} outline={C.white} />
        </div>
        {!phase.fixing ? (
          <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 10, width: box.w - pad * 2, display: "grid", gap: 6, justifyItems: "center" }}>
            <PixelLines text={tags.name.toUpperCase()} maxWidth={box.w - pad * 2} color={C.invEdge} sx={2.2} sy={2.6} bold />
            <PixelLines text={`GOES IN ${catLabel(tags.category)}. ${tags.colors.join(", ").toUpperCase()}. ${styles}.`} maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            {!tags.isClothing && <PixelLines text="HMM, THAT DOESN'T LOOK LIKE CLOTHES." maxWidth={box.w - pad * 2} color="#a3123a" sx={1.4} sy={1.8} />}
            {phase.how === "guess" && <PixelLines text="BEST GUESS. FIX IT IF IT'S WRONG." maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />}
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
        <Bevel box={{ x: box.x + pad, y: box.y + box.h - pad - 34, w: 150, h: 34 }} tone="gray" onClick={() => setPhase({ ...phase, fixing: !phase.fixing })} label="Fix the tags" style={{ borderWidth: 2 }}>
          <PixelText text={phase.fixing ? "DONE FIXING" : "FIX IT"} color={C.ink} sx={1.8} sy={2} bold />
        </Bevel>
        <Bevel box={{ x: box.x + box.w - pad - 170, y: box.y + box.h - pad - 34, w: 170, h: 34 }} tone="blue" onClick={file} label="File it" style={{ borderWidth: 2 }}>
          <PixelText text="FILE IT" color={C.white} sx={1.8} sy={2} bold shadow={C.btnBlueDark} />
        </Bevel>
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 140, width: box.w - pad * 2 }}>
          <PixelLines text={phase.message} maxWidth={box.w - pad * 2} color="#a3123a" sx={2} sy={2.4} />
        </div>
        <Bevel box={{ x: box.x + (box.w - 170) / 2, y: box.y + 230, w: 170, h: 34 }} tone="blue" onClick={next} label="OK" style={{ borderWidth: 2 }}>
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
