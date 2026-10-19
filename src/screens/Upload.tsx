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
import { garmentFrom, listItems, tagCategories, tagGarment, type Found, type Tags } from "../upload/tags";
import { extractItem, jpegOf, RedrawError, tidyGarment } from "../upload/gemini";
import { Bevel } from "./Parts";

// The UPLOAD pop-up: pick photos, drop them, or paste one.
//
// Signed in, each photo goes to the AI first: Gemini lists every piece in it
// (tagged), then redraws each one, straight-on, from the whole photo. If the
// photo has a person in it, it offers to make them the model too.
// Otherwise (or if the AI fails) the in-browser models cut the pieces out
// and the pixels are tagged as a best guess.
// Either way: the pixel scanner while working, a quick look at the result,
// then it's filed and floats down to its category tab.

// One piece still to file from the current photo: a cut-out made in the
// browser, or an item the AI listed and still has to redraw.
type Job = { kind: "cut"; piece: Piece } | { kind: "ai"; item: Found };

type Phase =
  | { kind: "pick" }
  | { kind: "cutting"; photo: HTMLCanvasElement; ai: boolean; progress: { what: "download" | "cut"; f: number } | null }
  | { kind: "drawing"; photo: HTMLCanvasElement; name: string }
  | { kind: "offer"; photo: HTMLCanvasElement }
  | { kind: "popping"; photo: HTMLCanvasElement; cut: HTMLCanvasElement; hint?: string }
  | { kind: "tagging"; photo: HTMLCanvasElement; cut: HTMLCanvasElement }
  | {
      kind: "show"; image: string; png: Blob; canvas: HTMLCanvasElement; tags: Tags; how: "ai" | "guess"; fixing: boolean;
      /** an AI-listed item: redrawing again goes back to the whole photo */
      source?: { photo: HTMLCanvasElement; item: Found };
      /** TIDY UP / REDRAW: the version before the redraw, to switch back to */
      original?: { image: string; png: Blob; canvas: HTMLCanvasElement };
      /** REDRAW asks what's wrong first; `ask` is what's been typed */
      asking?: boolean;
      ask?: string;
      redrawing?: boolean;
      note?: string;
    }
  | { kind: "error"; message: string };

const CUT_PHRASES = ["SNIPPING...", "FINDING THE CLOTHES...", "LOSING THE BACKGROUND...", "AS IF!", "ALMOST..."];
const TAG_PHRASES = ["READING THE TAG...", "NAMING IT...", "PICKING ITS STYLE..."];
const AI_PHRASES = ["LOOKING CLOSELY...", "STRAIGHTENING IT OUT...", "GETTING EVERY DETAIL...", "AS IF!", "ALMOST..."];

const pad = 14;
const SCAN = 216; // the scanner's size on screen

const imageFiles = (list: FileList | File[] | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

export function Upload({ categories, wardrobe, incoming, canRedraw, onFile, onWantModel, onClose }: {
  categories: Category[];
  /** signed in, so TIDY UP (Gemini) is available */
  canRedraw: boolean;
  wardrobe: Wardrobe;
  /** images pasted or dropped from outside the pop-up */
  incoming: { files: Blob[]; key: number } | null;
  /** a finished garment, its PNG, and where on screen it was shown (to fly from) */
  onFile: (g: Garment, png: Blob, from: { x: number; y: number; size: number }) => void;
  /** the photo had a person in it and they want to be the model */
  onWantModel: (photo: HTMLCanvasElement) => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<Blob[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [phrase, setPhrase] = useState(0);
  // the pieces found in the current photo that are still to be filed
  const [pieces, setPieces] = useState<{ photo: HTMLCanvasElement; left: Job[]; total: number; hasPerson: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // UPLOAD A PICTURE OF ME: goes straight to making the model photo
  const meInput = useRef<HTMLInputElement>(null);
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

  // Starts on one piece: a browser cut-out pops its background away; an AI
  // item gets redrawn from the whole photo.
  const startJob = useCallback(
    async (photo: HTMLCanvasElement, job: Job) => {
      if (job.kind === "cut") return setPhase({ kind: "popping", photo, cut: job.piece.canvas, hint: job.piece.hint });
      const { item } = job;
      setPhase({ kind: "drawing", photo, name: item.name });
      try {
        const final = finishCutout(await extractItem(photo, item.name, item.description, item.colors));
        const png = await pngBlob(final);
        setPhase({
          kind: "show", image: final.toDataURL("image/png"), png, canvas: final, tags: item, how: "ai", fixing: false, source: { photo, item },
          note: item.partial ? "ONLY PART OF IT WAS IN THE PHOTO, SO SOME OF IT IS A GUESS. CHECK IT OVER." : undefined,
        });
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof RedrawError ? e.message : `COULDN'T REDRAW THE ${item.name.toUpperCase()}. TRY ANOTHER PHOTO.` });
      }
    },
    [],
  );

  // the next photo in line starts as soon as the last one is done
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    (async () => {
      try {
        const photo = await loadPhoto(current);
        if (cancelled) return;
        // signed in: the AI finds and redraws every piece
        if (canRedraw) {
          setPhase({ kind: "cutting", photo, ai: true, progress: null });
          const listed = await listItems(jpegOf(photo), cats, wardrobe);
          if (cancelled) return;
          if (listed) {
            const jobs: Job[] = listed.items.map((item) => ({ kind: "ai", item }));
            if (!jobs.length) {
              if (listed.hasPerson) return setPhase({ kind: "offer", photo });
              return setPhase({ kind: "error", message: "COULDN'T FIND ANY CLOTHES IN THAT PHOTO. TRY ONE WITH THE OUTFIT IN FULL VIEW." });
            }
            setPieces({ photo, left: jobs.slice(1), total: jobs.length, hasPerson: listed.hasPerson });
            return startJob(photo, jobs[0]);
          }
          // the AI isn't answering: cut the pieces out in the browser instead
        }
        setPhase({ kind: "cutting", photo, ai: false, progress: null });
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
        const jobs: Job[] = found.pieces.map((piece) => ({ kind: "cut", piece }));
        setPieces({ photo, left: jobs.slice(1), total: jobs.length, hasPerson: false });
        startJob(photo, jobs[0]);
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
    if (phase.kind !== "cutting" && phase.kind !== "tagging" && phase.kind !== "drawing") return;
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

  // the next piece from the same photo; then, if there was a person in it,
  // the offer to make them the model; then the next photo
  const advance = useCallback(() => {
    if (pieces?.left.length) {
      const [job, ...rest] = pieces.left;
      setPieces({ ...pieces, left: rest });
      startJob(pieces.photo, job);
      return;
    }
    if (pieces?.hasPerson && phase.kind !== "offer") {
      setPhase({ kind: "offer", photo: pieces.photo });
      return;
    }
    setPieces(null);
    if (queue.length <= 1) onClose();
    next();
  }, [pieces, phase.kind, queue.length, onClose, next, startJob]);

  const file = useCallback(() => {
    if (phase.kind !== "show") return;
    const g = garmentFrom(crypto.randomUUID(), phase.image, phase.tags);
    onFile(g, phase.png, imageBox);
    advance();
  }, [phase, onFile, advance]);


  // TIDY UP (a browser cut-out) or REDRAW (an AI item): Gemini draws the
  // piece again as a straight-on product shot; the button then switches
  // back to the version before
  const tidy = useCallback(() => {
    if (phase.kind !== "show" || phase.redrawing) return;
    if (phase.original) {
      const { original, ...rest } = phase;
      return setPhase({ ...rest, ...original, original: undefined, note: undefined });
    }
    // first: what's wrong with it? (the FIX IT buttons make way)
    setPhase({ ...phase, asking: !phase.asking, fixing: false, note: undefined });
  }, [phase]);

  // the redraw itself, with the owner's note on what was wrong
  const redrawWith = useCallback(async () => {
    if (phase.kind !== "show" || phase.redrawing) return;
    const fix = (phase.ask ?? "").trim();
    setPhase({ ...phase, redrawing: true, asking: false, fixing: false, note: undefined });
    try {
      const { source } = phase;
      const drawn = source
        ? await extractItem(source.photo, phase.tags.name, source.item.description, phase.tags.colors, fix)
        : await tidyGarment(phase.canvas, phase.tags.name, phase.tags.colors, fix);
      const final = finishCutout(drawn);
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
            height: 176,
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
        <Bevel box={{ x: box.x + pad, y: box.y + 232, w: box.w - pad * 2, h: 38 }} tone="blue" onClick={() => input.current?.click()} label="Upload clothes" style={{ borderWidth: 3 }}>
          <PixelText text="UPLOAD CLOTHES" color={C.white} sx={2} sy={2.4} bold shadow={C.btnBlueDark} />
        </Bevel>
        {canRedraw && (
          <Bevel box={{ x: box.x + pad, y: box.y + 278, w: box.w - pad * 2, h: 38 }} tone="gray" onClick={() => meInput.current?.click()} label="Upload a picture of me" style={{ borderWidth: 3 }}>
            <PixelText text="UPLOAD A PICTURE OF ME" color={C.ink} sx={1.8} sy={2.2} bold />
          </Bevel>
        )}
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + (canRedraw ? 326 : 284), width: box.w - pad * 2 }}>
          <PixelLines
            text={canRedraw ? "CLOTHES: ANY PHOTO, WORN OR LAID FLAT. ME: BECOMES YOUR MODEL FOR DRESS ME." : "ONE PIECE PER PHOTO, LAID FLAT OR HUNG ON A PLAIN BACKGROUND, WORKS BEST."}
            maxWidth={box.w - pad * 2}
            color={C.invText}
            sx={1.4}
            sy={1.8}
          />
        </div>
      </>
    );
  } else if (phase.kind === "offer") {
    body = (
      <>
        <div style={{ position: "absolute", left: box.x + (box.w - 150) / 2, top: box.y + 46, width: 150, height: 190, border: `3px solid ${C.invEdge}`, boxSizing: "border-box", overflow: "hidden", background: C.invSlot }}>
          <GarmentImage src={phase.photo.toDataURL("image/jpeg", 0.8)} w={144} h={184} fill={1} />
        </div>
        <div style={{ position: "absolute", left: box.x + pad, top: box.y + 250, width: box.w - pad * 2, display: "grid", gap: 8 }}>
          <PixelLines text="WANT TO BE THE MODEL TOO?" maxWidth={box.w - pad * 2} color={C.invEdge} sx={2} sy={2.4} bold />
          <PixelLines text="GEMINI REDRAWS YOU FROM THIS PHOTO STANDING STRAIGHT, READY TO BE DRESSED. THE PHOTO GOES TO GOOGLE ONLY FOR THIS." maxWidth={box.w - pad * 2} color={C.invText} sx={1.3} sy={1.7} />
        </div>
        <Bevel box={{ x: box.x + pad, y: box.y + box.h - pad - 34, w: 140, h: 34 }} tone="gray" onClick={advance} label="No thanks" style={{ borderWidth: 2 }}>
          <PixelText text="NO THANKS" color={C.ink} sx={1.7} sy={2} bold />
        </Bevel>
        <Bevel box={{ x: box.x + box.w - pad - 196, y: box.y + box.h - pad - 34, w: 196, h: 34 }} tone="blue" onClick={() => onWantModel(phase.photo)} label="Make my model photo" style={{ borderWidth: 2 }}>
          <PixelText text="MAKE MY MODEL PHOTO" color={C.white} sx={1.5} sy={2} bold shadow={C.btnBlueDark} />
        </Bevel>
      </>
    );
  } else if (phase.kind === "cutting" || phase.kind === "popping" || phase.kind === "tagging" || phase.kind === "drawing") {
    const cut = phase.kind === "popping" || phase.kind === "tagging" ? phase.cut : null;
    const ai = (phase.kind === "cutting" && phase.ai) || phase.kind === "drawing";
    const title =
      phase.kind === "tagging" ? "TAGGING"
      : phase.kind === "drawing" ? "REDRAWING IT STRAIGHT"
      : ai ? "FINDING THE CLOTHES"
      : "REMOVING THE BACKGROUND";
    const status =
      phase.kind === "tagging"
        ? TAG_PHRASES[phrase % TAG_PHRASES.length]
        : phase.kind === "drawing"
          ? `${phase.name.toUpperCase()}: ${AI_PHRASES[phrase % AI_PHRASES.length]}`
          : ai
          ? AI_PHRASES[phrase % AI_PHRASES.length]
        : phase.kind === "cutting" && phase.progress?.what === "download" && phase.progress.f < 1
          ? `GETTING THE SCISSORS... ${Math.round(phase.progress.f * 100)}%`
          : CUT_PHRASES[phrase % CUT_PHRASES.length];
    body = (
      <>
        <div style={{ position: "absolute", left: imageBox.x, top: imageBox.y }}>
          <Scanner size={SCAN} photo={phase.photo} cutout={cut} onCleared={phase.kind === "popping" ? () => tag(phase.photo, phase.cut, phase.hint) : undefined} />
        </div>
        <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 18, width: box.w - pad * 2 }}>
          <PixelLines text={title} maxWidth={box.w - pad * 2} color={C.invEdge} sx={2} sy={2.4} bold />
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
        {phase.asking ? (
          <>
            <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 8, width: box.w - pad * 2 }}>
              <PixelLines text="WHAT'S WRONG WITH IT? E.G. IT'S A LONG DRESS" maxWidth={box.w - pad * 2} color={C.invText} sx={1.3} sy={1.7} />
            </div>
            <PixelField
              box={{ x: box.x + pad, y: imageBox.y + SCAN + 26, w: box.w - pad * 2 - 70, h: 28 }}
              label="What's wrong with it"
              value={phase.ask ?? ""}
              onChange={(v) => setPhase((p) => (p.kind === "show" ? { ...p, ask: v.slice(0, 120) } : p))}
              placeholder="OPTIONAL"
              maxLength={120}
              autoFocus
              onEnter={redrawWith}
              sx={1.4}
              sy={1.8}
            />
            <Bevel box={{ x: box.x + box.w - pad - 62, y: imageBox.y + SCAN + 26, w: 62, h: 28 }} tone="blue" onClick={redrawWith} label="Redraw with this note" style={{ borderWidth: 2 }}>
              <PixelText text="GO" color={C.white} sx={1.8} sy={2} bold shadow={C.btnBlueDark} />
            </Bevel>
          </>
        ) : !phase.fixing ? (
          <div style={{ position: "absolute", left: box.x + pad, top: imageBox.y + SCAN + 10, width: box.w - pad * 2, display: "grid", gap: 6, justifyItems: "center" }}>
            <PixelLines text={tags.name.toUpperCase()} maxWidth={box.w - pad * 2} color={C.invEdge} sx={2.2} sy={2.6} bold />
            <PixelLines text={`GOES IN ${catLabel(tags.category)}. ${tags.colors.join(", ").toUpperCase()}. ${styles}.`} maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            {!tags.isClothing && <PixelLines text="HMM, THAT DOESN'T LOOK LIKE CLOTHES." maxWidth={box.w - pad * 2} color="#a3123a" sx={1.4} sy={1.8} />}
            {phase.redrawing ? (
              <PixelLines text={phase.source ? "REDRAWING IT..." : "TIDYING IT UP..."} maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
            ) : phase.original ? (
              <PixelLines text={phase.source ? "REDRAWN AGAIN. UNDO SWITCHES BACK." : "REDRAWN BY AI. ORIGINAL SWITCHES BACK."} maxWidth={box.w - pad * 2} color={C.invText} sx={1.4} sy={1.8} />
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
              <Bevel box={{ x: xs[1], y, w: widths[1], h: 34 }} tone="gray" onClick={() => setPhase({ ...phase, fixing: !phase.fixing, asking: false })} label="Fix the tags" style={{ borderWidth: 2 }}>
                <PixelText text={phase.fixing ? "DONE" : "FIX IT"} color={C.ink} sx={sx} sy={2} bold />
              </Bevel>
              {canRedraw && (
                <Bevel box={{ x: xs[2], y, w: widths[2], h: 34 }} tone="gray" onClick={tidy} label={phase.original ? "Switch back" : phase.asking ? "Cancel the redraw" : phase.source ? "Redraw it" : "Tidy up with AI"} title="Gemini draws it again as a straight-on product shot (a few cents)" style={{ borderWidth: 2, opacity: phase.redrawing ? 0.6 : 1 }}>
                  <PixelText text={phase.original ? (phase.source ? "UNDO" : "ORIGINAL") : phase.asking ? "CANCEL" : phase.source ? "REDRAW" : "TIDY UP"} color={C.ink} sx={sx} sy={2} bold />
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

  const busy = phase.kind === "cutting" || phase.kind === "popping" || phase.kind === "tagging" || phase.kind === "drawing";
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
        ref={meInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) loadPhoto(f).then(onWantModel, () => setPhase({ kind: "error", message: "THAT PHOTO WOULDN'T OPEN. TRY A JPEG OR PNG." }));
        }}
      />
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
