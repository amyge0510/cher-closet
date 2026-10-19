import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { categoriesFor, isDress, type Category } from "../closet/categories";
import { judgeOutfit, matchingPairs } from "../closet/match";
import type { Garment, Look, Slot, Verdict } from "../closet/types";
import { loadImage, makeCanvas } from "../pixel/raster";
import { dressUp, jpegOf, RedrawError } from "../upload/gemini";
import { judgeWithAi } from "../upload/tags";
import { GarmentImage } from "../pixel/GarmentImage";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { extraSpot, L, type Box } from "../stage/layout";
import type { Action, State } from "../state/machine";
import { accessoriesFor, rankPairs, type BoardItem } from "../style/quiz";
import { WARDROBES, type MyStyle, type Wardrobe as WardrobeChoice } from "../style/styles";
import { Inventory, MoreMenu } from "./Inventory";
import { Upload } from "./Upload";
import { BodyPhoto } from "./BodyPhoto";
import type { Body } from "../closet/bodyPhoto";
import type { BodyAnchors } from "../closet/body";
import { SavedLooks } from "./SavedLooks";
import { StyleQuiz } from "./StyleQuiz";
import { Bevel, ButtonLabel, CategoryBar, ControlStrip, Header, Leopard, overflowCategories, pos, tabCenter } from "./Parts";
import { Reveal } from "./Reveal";

const MATCH_HOLD_MS = 1400; // black panels stay up this long before the reveal
const MISMATCH_MS = 3000; // MIS-MATCH! clears itself after this long
const SCAN_STEP_MS = 110;

function GarmentPanel({ box, garment, matched }: { box: Box; garment?: Garment; matched: boolean }) {
  return (
    <div style={{ ...pos(box), background: matched ? C.panelMatch : C.panel, display: "grid", placeItems: "center" }}>
      {garment && (
        <GarmentImage key={garment.id} src={garment.image} w={box.w - 16} h={box.h - 10} fill={0.92} outline={C.white} />
      )}
    </div>
  );
}

// A worn accessory, standing on the leopard beside the outfit. Click to take
// it off. Layered jewelry shares its spot: `of` pieces in a small grid.
function ExtraSticker({ garment, index = 0, of = 1, onTakeOff }: { garment: Garment; index?: number; of?: number; onTakeOff: () => void }) {
  const spot = extraSpot(garment.category);
  const cols = of > 1 ? 2 : 1;
  const rows = Math.ceil(of / cols);
  const b = { x: spot.x + (index % cols) * (spot.w / cols), y: spot.y + Math.floor(index / cols) * (spot.h / rows), w: spot.w / cols, h: spot.h / rows };
  return (
    <button
      type="button"
      aria-label={`Take off ${garment.name}`}
      title={`${garment.name} (click to take off)`}
      onClick={onTakeOff}
      style={{ ...pos(b), padding: 0, border: 0, background: "transparent", cursor: "pointer", zIndex: 3 }}
    >
      <GarmentImage key={garment.id} src={garment.image} w={b.w} h={b.h} fill={0.9} outline={C.white} />
    </button>
  );
}

type Popup = { kind: "closet"; category: string } | { kind: "more" } | { kind: "style" } | { kind: "looks" } | { kind: "upload" } | { kind: "body"; photo?: HTMLCanvasElement } | { kind: "hair" } | null;

// Hairstyles for the dressed-up figure (HAIR, above the head). The id is
// what Gemini is asked for; "" keeps the user's own hair.
const HAIRSTYLES = [
  { id: "", label: "MY OWN HAIR" },
  { id: "a sleek high ponytail", label: "SLEEK PONYTAIL" },
  { id: "a messy high bun", label: "MESSY BUN" },
  { id: "long loose glossy waves", label: "LOOSE WAVES" },
  { id: "a big bouncy 90s blowout", label: "90S BLOWOUT" },
  { id: "half-up, half-down with a claw clip", label: "HALF-UP" },
  { id: "two long braids", label: "BRAIDS" },
  { id: "a sleek chin-length bob", label: "BOB" },
  { id: "soft curtain bangs with the rest down", label: "CURTAIN BANGS" },
];
const HAIR_KEY = "cher-hair";
// a dress fills the whole middle: from the top window down to the bottom one
const DRESS_PANEL = { x: L.topPanel.x, y: L.topPanel.y, w: L.topPanel.w, h: L.bottomPanel.y + L.bottomPanel.h - L.topPanel.y };
const HAIR_BUTTON = { x: L.revealPanel.x + L.revealPanel.w - 74, y: L.revealPanel.y + 6, w: 68, h: 22 };

const FLY_MS = 1000;
const FLASH_MS = 1500;

// A freshly filed upload, floating from the upload pop-up down into its
// category tab on the bar.
function FlyingItem({ garment, from, to, onLanded }: { garment: Garment; from: { x: number; y: number; size: number }; to: { x: number; y: number }; onLanded: () => void }) {
  const dx = to.x - (from.x + from.size / 2);
  const dy = to.y - (from.y + from.size / 2);
  const land = useRef(onLanded);
  land.current = onLanded;
  useEffect(() => {
    const t = window.setTimeout(() => land.current(), FLY_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="fly-to-tab"
      style={{ position: "absolute", left: from.x, top: from.y, width: from.size, height: from.size, zIndex: 40, pointerEvents: "none", ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDuration: `${FLY_MS}ms` }}
    >
      <GarmentImage src={garment.image} w={from.size} h={from.size} fill={0.9} outline={C.white} />
    </div>
  );
}

const MAX_LOOKS = 48;
const SAVED_FLASH_MS = 1500;

export function Wardrobe({ state, dispatch, closet, categories, title, onSignOut, myStyle, onSaveStyle, looks, onSaveLooks, wardrobe, onChangeWardrobe, source = "pixel", onChangeSource, onUploaded, onDeleteGarment, onRetag, notice, body, canRedraw, onBody, onResetBody, closetReady = true, outfitKey }: {
  state: State;
  dispatch: Dispatch<Action>;
  closet: Garment[];
  categories: Category[];
  title: string;
  onSignOut?: () => void;
  myStyle: MyStyle | null;
  onSaveStyle: (s: MyStyle) => void;
  looks: Look[];
  onSaveLooks: (l: Look[]) => void;
  /** womenswear / menswear / both: which styles and demo clothes to show */
  wardrobe: WardrobeChoice;
  onChangeWardrobe: (w: WardrobeChoice) => void;
  /** whose clothes are on the rack: the person's own uploads, or the built-in pixel ones */
  source?: "mine" | "pixel";
  onChangeSource?: (s: "mine" | "pixel") => void;
  /** a garment that was just uploaded and tagged */
  onUploaded: (g: Garment, png: Blob) => void;
  /** one of the user's own pieces, deleted from the closet pop-up */
  onDeleteGarment: (g: Garment) => void;
  /** RE-TAG MY CLOSET (signed in only) */
  onRetag?: () => void;
  /** a short message to show for a moment, e.g. a failed save */
  notice?: string | null;
  /** the user's own figure for the reveal (MY MODEL PHOTO), if any */
  body: Body | null;
  /** signed in, so the Gemini redraws (TIDY UP, MY MODEL PHOTO) work */
  canRedraw: boolean;
  onBody: (canvas: HTMLCanvasElement, anchors: BodyAnchors) => void;
  onResetBody: () => void;
  /** the user's own clothes have loaded, so the last outfit can be put back */
  closetReady?: boolean;
  /** where the last outfit is remembered (one per account, in this browser) */
  outfitKey?: string;
}) {
  const { screen } = state;
  const tops = useMemo(() => closet.filter((g) => g.slot === "top"), [closet]);
  const bottoms = useMemo(() => closet.filter((g) => g.slot === "bottom"), [closet]);
  const [popup, setPopup] = useState<Popup>(null);
  const closePopup = useCallback(() => setPopup(null), []);
  const wear = useCallback(
    (g: Garment) => {
      if (g.slot) dispatch({ type: "PICK", slot: g.slot, index: (g.slot === "top" ? tops : bottoms).indexOf(g) });
      else dispatch({ type: "WEAR", category: g.category, id: g.id });
      setPopup(null);
    },
    [dispatch, tops, bottoms],
  );
  // worn accessories, with the slot each is in ("jewelry:2" for layers)
  const wornSlots = useMemo(
    () => Object.entries(state.extras).flatMap(([key, id]) => {
      const g = closet.find((x) => x.id === id);
      return g ? [{ key, garment: g }] : [];
    }),
    [state.extras, closet],
  );
  const worn = useMemo(() => wornSlots.map((w) => w.garment), [wornSlots]);
  // The last outfit: put back on when the closet opens, and remembered
  // whenever it changes (only once it's been put back, so the opening rack
  // doesn't overwrite it).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !closetReady || !outfitKey) return;
    restored.current = true;
    try {
      const last = JSON.parse(localStorage.getItem(outfitKey) ?? "null") as Look | null;
      if (!last) return;
      const t = tops.findIndex((g) => g.id === last.top);
      const b = last.bottom === last.top ? 0 : bottoms.findIndex((g) => g.id === last.bottom);
      if (t < 0 || b < 0) return;
      const ids = new Set(closet.map((g) => g.id));
      const extras = Object.fromEntries(Object.entries(last.extras).filter(([, id]) => ids.has(id)));
      dispatch({ type: "SET_OUTFIT", top: t, bottom: b, extras });
    } catch {
      /* nothing remembered */
    }
  }, [closetReady, outfitKey, tops, bottoms, closet, dispatch]);
  const topId = tops[state.top % Math.max(1, tops.length)]?.id;
  const bottomId = bottoms[state.bottom % Math.max(1, bottoms.length)]?.id;
  useEffect(() => {
    if (!restored.current || !outfitKey || !topId || !bottomId) return;
    try {
      const look: Look = { id: "last", top: topId, bottom: isDress(tops.find((g) => g.id === topId)) ? topId : bottomId, extras: state.extras };
      localStorage.setItem(outfitKey, JSON.stringify(look));
    } catch {
      /* storage unavailable */
    }
  }, [outfitKey, topId, bottomId, state.extras, tops]);

  // MY STYLE: put the chosen style's board on, top to toe
  const wearBoard = useCallback(
    (items: BoardItem[]) => {
      const pick = (slot: "top" | "bottom", list: Garment[]) => {
        const g = items.find((i) => i.garment.slot === slot)?.garment;
        return g ? list.indexOf(g) : -1;
      };
      const t = pick("top", tops);
      const b = pick("bottom", bottoms);
      const extras = Object.fromEntries(items.filter((i) => !i.garment.slot).map((i) => [i.garment.category, i.garment.id]));
      dispatch({ type: "SET_OUTFIT", top: t < 0 ? state.top : t, bottom: b < 0 ? state.bottom : b, extras });
    },
    [dispatch, tops, bottoms, state.top, state.bottom],
  );
  const showRack = useCallback(() => dispatch({ type: "SHOW_RACK" }), [dispatch]);
  // the closet can shrink (the demo rack goes once someone has their own
  // top and bottom), so keep the indices in range
  const top = tops[state.top % Math.max(1, tops.length)];
  // a dress is the whole outfit: it stands in as its own bottom
  const wearingDress = isDress(top);
  const bottom = wearingDress ? top : bottoms[state.bottom % Math.max(1, bottoms.length)];
  const shownBottom = bottoms[state.bottom % Math.max(1, bottoms.length)];
  const scanTimer = useRef(0);

  // ♥ SAVE on the dressed screen: remember this outfit (skipping exact repeats)
  const [justSaved, setJustSaved] = useState(false);
  const saveLook = useCallback(() => {
    if (!top || !bottom) return;
    const look: Look = { id: `look-${Date.now()}`, top: top.id, bottom: bottom.id, extras: state.extras };
    const same = (l: Look) => l.top === look.top && l.bottom === look.bottom && JSON.stringify(l.extras) === JSON.stringify(look.extras);
    if (!looks.some(same)) onSaveLooks([look, ...looks].slice(0, MAX_LOOKS));
    setJustSaved(true);
  }, [top, bottom, state.extras, looks, onSaveLooks]);
  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(t);
  }, [justSaved]);
  const wearLook = useCallback(
    (look: Look) => {
      const t = tops.findIndex((g) => g.id === look.top);
      // a dress look saves the dress as its bottom too; the bottom row stays put
      const b = look.bottom === look.top ? state.bottom : bottoms.findIndex((g) => g.id === look.bottom);
      if (t < 0 || b < 0) return;
      dispatch({ type: "SET_OUTFIT", top: t, bottom: b, extras: look.extras });
      setPopup(null);
    },
    [dispatch, tops, bottoms, state.bottom],
  );

  const step = useCallback(
    (slot: Slot, delta: number) => dispatch({ type: "STEP", slot, delta, count: slot === "top" ? tops.length : bottoms.length }),
    [dispatch, tops.length, bottoms.length],
  );

  // fast-forward: flick through one row and land somewhere random; `then`
  // runs once it settles. The row's ▶▶ button lights up while it flicks.
  const [scanning, setScanning] = useState<Slot | null>(null);
  // the next or previous dress (dresses sit in the top carousel among tops)
  const topIndex = useRef(state.top);
  topIndex.current = state.top;
  const bottomIndex = useRef(state.bottom);
  bottomIndex.current = state.bottom;
  const extrasNow = useRef(state.extras);
  extrasNow.current = state.extras;
  const stepDress = useCallback(
    (delta: number) => {
      const dresses = tops.flatMap((g, i) => (isDress(g) ? [i] : []));
      if (!dresses.length) return;
      const at = dresses.indexOf(topIndex.current % Math.max(1, tops.length));
      const next = dresses[(((at < 0 ? 0 : at) + delta) % dresses.length + dresses.length) % dresses.length];
      topIndex.current = next;
      dispatch({ type: "PICK", slot: "top", index: next });
    },
    [tops, dispatch],
  );

  // `by` replaces the usual one-step (dresses flick through dresses only)
  const scan = useCallback(
    (slot: Slot, then?: () => void, by?: () => void) => {
      clearInterval(scanTimer.current);
      setScanning(slot);
      let left = 6 + Math.floor(Math.random() * 8);
      scanTimer.current = window.setInterval(() => {
        if (by) by();
        else step(slot, 1);
        if (--left > 0) return;
        clearInterval(scanTimer.current);
        setScanning(null);
        then?.();
      }, SCAN_STEP_MS);
    },
    [step],
  );
  const stopScan = useCallback(() => {
    clearInterval(scanTimer.current);
    setScanning(null);
  }, []);

  // BROWSE, as in the film: the tops flick by on their own, then the
  // bottoms, then it settles on an outfit. Pressing it again stops it.
  // BROWSE: the whole top row flicks by (tops and dresses alike); landing on
  // a top, the bottoms flick by too. Then new accessories that suit
  // whatever it settled on.
  const browse = useCallback(() => {
    if (scanning) return stopScan();
    dispatch({ type: "BROWSE" });
    const settle = () => {
      const t = tops[topIndex.current % Math.max(1, tops.length)];
      const b = isDress(t) ? t : bottoms[bottomIndex.current % Math.max(1, bottoms.length)];
      if (!t || !b) return;
      const extras = accessoriesFor(closet, [t, b], myStyle, Object.values(extrasNow.current), Math.floor(Math.random() * 1e9));
      dispatch({ type: "SET_OUTFIT", top: topIndex.current, bottom: bottomIndex.current, extras });
    };
    scan("top", () => (isDress(tops[topIndex.current % Math.max(1, tops.length)]) ? settle() : scan("bottom", settle)));
  }, [scanning, stopScan, dispatch, scan, tops, bottoms, closet, myStyle]);
  useEffect(() => () => clearInterval(scanTimer.current), []);

  // DRESS ME. The demo rack is judged by the rules in match.ts, instantly.
  // Real clothes are too varied for rules (a dressy blouse with bike shorts
  // passes every one of them), so when the outfit has any uploaded piece and
  // someone is signed in, Gemini looks at the whole outfit and judges it.
  // Each verdict is remembered, so the same outfit isn't asked twice.
  const [judging, setJudging] = useState(false);
  const verdicts = useRef(new Map<string, Verdict>());
  const dressMe = useCallback(async () => {
    if (!top || !bottom || judging) return;
    const rules = judgeOutfit(top, bottom, worn);
    const pieces = wearingDress ? [top, ...worn] : [top, bottom, ...worn];
    if (!canRedraw || pieces.every((g) => g.id.startsWith("demo-"))) return dispatch({ type: "DRESS_ME", verdict: rules });
    const key = pieces.map((g) => g.id).sort().join("|");
    let verdict = verdicts.current.get(key);
    if (!verdict) {
      setJudging(true);
      try {
        const images = await Promise.all(
          pieces.map(async (g) => {
            const img = await loadImage(g.image);
            const c = makeCanvas(img.width, img.height);
            c.getContext("2d")!.drawImage(img, 0, 0);
            return { label: `${g.slot ?? g.category}: ${g.name}`, image: jpegOf(c, 384) };
          }),
        );
        const ai = await judgeWithAi(images, wardrobe);
        if (ai) verdicts.current.set(key, (verdict = { match: ai.match, reason: ai.reason, strikes: 0 }));
      } catch (e) {
        console.warn("couldn't ask the AI, using the rules:", e);
      } finally {
        setJudging(false);
      }
    }
    dispatch({ type: "DRESS_ME", verdict: verdict ?? rules });
  }, [dispatch, top, bottom, worn, canRedraw, judging, wardrobe]);

  const autoDress = useCallback(() => {
    const pairs = rankPairs(matchingPairs(tops, bottoms), tops, bottoms, myStyle);
    if (!pairs.length) return;
    const others = pairs.filter(([t, b]) => t !== state.top || b !== state.bottom);
    const [t, b] = (others.length ? others : pairs)[Math.floor(Math.random() * (others.length || pairs.length))];
    // everything changes, accessories included
    const extras = accessoriesFor(closet, [tops[t], bottoms[b]], myStyle, Object.values(state.extras), Math.floor(Math.random() * 1e9));
    dispatch({ type: "AUTO_DRESS", top: t, bottom: b, extras });
  }, [dispatch, closet, tops, bottoms, state.top, state.bottom, state.extras, myStyle]);

  useEffect(() => {
    if (screen !== "match") return;
    const t = window.setTimeout(() => dispatch({ type: "MATCH_SHOWN" }), MATCH_HOLD_MS);
    return () => clearTimeout(t);
  }, [screen, state.top, state.bottom, dispatch]);

  useEffect(() => {
    if (screen !== "mismatch") return;
    const t = window.setTimeout(() => dispatch({ type: "BROWSE" }), MISMATCH_MS);
    return () => clearTimeout(t);
  }, [screen, dispatch]);

  const revealDone = useCallback(() => dispatch({ type: "REVEAL_DONE" }), [dispatch]);

  // Gemini dresses the user's own figure (MY MODEL PHOTO) in the outfit, in
  // the chosen hairstyle. Each result is remembered for this visit.
  const [hair, setHairState] = useState(() => {
    try {
      return localStorage.getItem(HAIR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const setHair = useCallback((h: string) => {
    setHairState(h);
    try {
      localStorage.setItem(HAIR_KEY, h);
    } catch {
      /* it lasts until reload */
    }
  }, []);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);
  const dressedPhotos = useRef(new Map<string, string>());
  const [dressed, setDressed] = useState<{ key: string; src: string | null; waiting: boolean; under?: string } | null>(null);
  // the last dressed photo of this outfit (any hairstyle): it stays on screen
  // while a new hairstyle is drawn, so the outfit never disappears
  const lastDressed = useRef<{ outfit: string; src: string } | null>(null);
  const outfitPieces = useMemo(() => (top && bottom ? (top === bottom ? [top, ...worn] : [top, bottom, ...worn]) : []), [top, bottom, worn]);
  const dressKey =
    body && canRedraw && outfitPieces.length && (screen === "reveal" || screen === "dressed")
      ? [body.src.length, body.src.slice(-48), ...outfitPieces.map((g) => g.id), hair].join("|")
      : null;
  useEffect(() => {
    if (!dressKey || !body) return;
    const outfit = dressKey.slice(0, dressKey.lastIndexOf("|"));
    const under = lastDressed.current?.outfit === outfit ? lastDressed.current.src : undefined;
    const done = (src: string) => {
      lastDressed.current = { outfit, src };
      setDressed({ key: dressKey, src, waiting: false, under });
    };
    const cached = dressedPhotos.current.get(dressKey);
    if (cached) return done(cached);
    let cancelled = false;
    setDressed({ key: dressKey, src: null, waiting: true, under });
    dressUp(body.src, outfitPieces.map((g) => ({ label: `${g.slot ?? g.category}: ${g.name}`, image: g.image })), hair)
      .then((src) => {
        dressedPhotos.current.set(dressKey, src);
        if (!cancelled) done(src);
      })
      .catch((e) => {
        console.warn("couldn't dress the model photo:", e);
        if (cancelled) return;
        setDressed({ key: dressKey, src: under ?? null, waiting: false });
        setNote(e instanceof RedrawError ? e.message : "COULDN'T DRESS YOUR PHOTO, SO HERE'S A QUICK PREVIEW.");
      });
    return () => {
      cancelled = true;
    };
    // dressKey covers the body, the outfit and the hair
  }, [dressKey]);

  // UPLOAD: photos can be pasted anywhere on the closet, not just in the pop-up
  const [incoming, setIncoming] = useState<{ files: Blob[]; key: number } | null>(null);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      setIncoming({ files, key: Date.now() });
      setPopup({ kind: "upload" });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
  const [flying, setFlying] = useState<{ garment: Garment; from: { x: number; y: number; size: number }; to: { x: number; y: number } }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const filed = useCallback(
    (g: Garment, png: Blob, from: { x: number; y: number; size: number }) => {
      onUploaded(g, png);
      // aim at the tab as it will be once the garment is in (a new category gets a tab)
      setFlying((f) => [...f, { garment: g, from, to: tabCenter(categoriesFor([...closet, g]), g.category) }]);
    },
    [onUploaded, closet],
  );
  const landed = useCallback((g: Garment) => {
    setFlying((f) => f.filter((x) => x.garment.id !== g.id));
    setFlash(g.category);
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && popup) return setPopup(null);
      // leave typing, and Enter/space on a focused button, to the element itself
      if (popup || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.key === "Enter") dressMe();
      else if (e.key === "Escape") dispatch({ type: "BROWSE" });
      else if (e.key === "ArrowLeft") wearingDress ? stepDress(-1) : step("top", -1);
      else if (e.key === "ArrowRight") wearingDress ? stepDress(1) : step("top", 1);
      else if (e.key === "ArrowUp" && !wearingDress) step("bottom", -1);
      else if (e.key === "ArrowDown" && !wearingDress) step("bottom", 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dressMe, step, stepDress, wearingDress, dispatch, popup]);

  const matched = screen === "match";
  const fullBody = screen === "reveal" || screen === "dressed";

  return (
    <div className="fade-in" style={{ position: "absolute", inset: 0, background: C.frameDark }}>
      <Header
        title={title}
        onStyle={() => setPopup({ kind: "style" })}
      />
      <Leopard box={L.leopardLeft} />
      <Leopard box={L.leopardRight} />
      {onChangeSource && <SourceToggle source={source} onChange={onChangeSource} />}
      <div style={{ ...pos(L.center), background: C.frameDark, borderLeft: `2px solid ${C.frame}`, borderRight: `2px solid ${C.frame}`, boxSizing: "border-box" }} />

      {fullBody && top && bottom ? (
        <div style={{ ...pos(L.revealPanel), background: C.panel }}>
          <Reveal w={L.revealPanel.w} h={L.revealPanel.h} top={top} bottom={bottom} extras={worn} figure={wardrobe === "mens" ? "mens" : "womens"} bodySrc={body?.src} anchors={body?.anchors} animate={screen === "reveal"} dressed={dressed && dressed.key === dressKey ? dressed : undefined} onDone={revealDone} />
        </div>
      ) : (
        <>
          {wearingDress ? (
            <>
              {/* a dress: one tall window, and the controls flip through dresses */}
              <GarmentPanel box={DRESS_PANEL} garment={top} matched={matched} />
              <ControlStrip box={L.bottomControls} onPrev={() => stepDress(-1)} onNext={() => stepDress(1)} onScan={() => scan("top", undefined, () => stepDress(1))} lit={scanning === "top" ? 2 : undefined} disabled={matched} />
            </>
          ) : (
            <>
              <GarmentPanel box={L.topPanel} garment={top} matched={matched} />
              <ControlStrip box={L.topControls} onPrev={() => step("top", -1)} onNext={() => step("top", 1)} onScan={() => scan("top")} lit={scanning === "top" ? 2 : undefined} disabled={matched} />
              <GarmentPanel box={L.bottomPanel} garment={shownBottom} matched={matched} />
              <ControlStrip box={L.bottomControls} onPrev={() => step("bottom", -1)} onNext={() => step("bottom", 1)} onScan={() => scan("bottom")} lit={scanning === "bottom" ? 2 : undefined} disabled={matched} />
            </>
          )}
        </>
      )}

      {fullBody && body && canRedraw && (
        <Bevel box={HAIR_BUTTON} tone={popup?.kind === "hair" ? "blue" : "gray"} onClick={() => setPopup(popup?.kind === "hair" ? null : { kind: "hair" })} label="Change the hairstyle" style={{ borderWidth: 2, zIndex: 6 }}>
          <PixelText text="HAIR ~" color={C.ink} sx={1.4} sy={1.8} bold />
        </Bevel>
      )}
      {popup?.kind === "hair" && (
        <>
          <div onClick={closePopup} style={{ position: "absolute", left: 0, top: 0, width: 640, height: 450, zIndex: 20 }} />
          <div role="menu" style={{ position: "absolute", left: HAIR_BUTTON.x + HAIR_BUTTON.w - 170, top: HAIR_BUTTON.y + HAIR_BUTTON.h + 4, width: 170, boxSizing: "border-box", padding: 3, background: C.invBg, border: `3px solid ${C.invEdge}`, zIndex: 21 }}>
            {HAIRSTYLES.map((h) => (
              <button
                key={h.id || "own"}
                type="button"
                role="menuitemradio"
                aria-checked={hair === h.id}
                className="menu-row"
                onClick={() => {
                  setHair(h.id);
                  setPopup(null);
                }}
                style={{ display: "flex", alignItems: "center", width: "100%", height: 22, padding: "0 6px", border: 0, background: hair === h.id ? C.invSlot : "transparent", cursor: "pointer" }}
              >
                <PixelText text={(hair === h.id ? "> " : "") + h.label} color={C.invText} sx={1.4} sy={1.8} />
              </button>
            ))}
          </div>
        </>
      )}
      {fullBody && dressed?.waiting && dressed.key === dressKey && (
        <div role="status" style={{ position: "absolute", left: L.revealPanel.x, top: L.revealPanel.y + L.revealPanel.h - 66, width: L.revealPanel.w, display: "grid", placeItems: "center", zIndex: 5, pointerEvents: "none" }}>
          <PixelText text="DRESSING YOU..." color={C.ink} sx={1.8} sy={2.2} bold shadow={C.white} />
        </div>
      )}

      {screen === "dressed" && (
        <Bevel box={L.saveLook} tone={justSaved ? "blue" : "gray"} onClick={saveLook} label="Save this look" style={{ borderWidth: 2, zIndex: 6 }}>
          <PixelText text={justSaved ? "♥ SAVED" : "♥ SAVE"} color={C.ink} sx={1.6} sy={2} bold />
        </Bevel>
      )}

      {!fullBody &&
        wornSlots.map(({ key, garment }) => {
          const same = wornSlots.filter((w) => w.garment.category === garment.category);
          return <ExtraSticker key={key} garment={garment} index={same.findIndex((w) => w.key === key)} of={same.length} onTakeOff={() => dispatch({ type: "TAKE_OFF", category: key })} />;
        })}

      {screen === "mismatch" && (
        <Bevel box={L.banner} tone="banner" style={{ borderWidth: 4, zIndex: 5 }}>
          <div className="blink3">
            <PixelText text="MIS-MATCH!" color={C.ink} sx={L.bannerText.sx} sy={L.bannerText.sy} shadow={C.bannerLight} />
          </div>
        </Bevel>
      )}
      {screen === "mismatch" && state.verdict && (
        <div role="status" style={{ ...pos(L.bannerReason), background: C.navy, display: "grid", placeItems: "center", zIndex: 5 }}>
          <PixelText text={state.verdict.reason} color={C.lavender} sx={1.4} sy={1.8} />
        </div>
      )}

      {/* as in the film: BROWSE while browsing, AUTO DRESS once you're dressed */}
      {screen === "browse" || screen === "mismatch" ? (
        <Bevel box={L.leftButton} tone="blue" onClick={browse} label="Browse" style={scanning ? { filter: "brightness(1.25)" } : undefined}>
          <ButtonLabel lines={["BROWSE"]} />
        </Bevel>
      ) : (
        <Bevel box={L.leftButton} tone="blue" onClick={autoDress} label="Auto dress">
          <ButtonLabel lines={["AUTO", "DRESS"]} />
        </Bevel>
      )}
      <Bevel box={L.rightButton} tone="blue" onClick={dressMe} label="Dress me">
        <ButtonLabel lines={judging ? ["HMM..."] : ["DRESS", "ME"]} />
      </Bevel>

      <CategoryBar
        categories={categories}
        active={popup?.kind === "closet" ? popup.category : popup?.kind}
        onPick={(id) => setPopup(popup?.kind === "closet" && popup.category === id ? null : { kind: "closet", category: id })}
        onMore={() => setPopup(popup?.kind === "more" ? null : { kind: "more" })}
        onLooks={() => setPopup(popup?.kind === "looks" ? null : { kind: "looks" })}
        onUpload={() => setPopup(popup?.kind === "upload" ? null : { kind: "upload" })}
        flash={flash}
      />

      {popup?.kind === "body" && (
        <BodyPhoto
          current={body}
          canRedraw={canRedraw}
          initialPhoto={popup.photo}
          onUse={(canvas, anchors) => {
            onBody(canvas, anchors);
            setPopup(null);
          }}
          onReset={() => {
            onResetBody();
            setPopup(null);
          }}
          onClose={closePopup}
        />
      )}
      {popup?.kind === "upload" && <Upload categories={categories} wardrobe={wardrobe} incoming={incoming} canRedraw={canRedraw} onFile={filed} onWantModel={(photo) => setPopup({ kind: "body", photo })} onClose={closePopup} />}
      {flying.map((f) => (
        <FlyingItem key={f.garment.id} garment={f.garment} from={f.from} to={f.to} onLanded={() => landed(f.garment)} />
      ))}
      {(notice ?? note) && (
        <div role="status" style={{ ...pos(L.bannerReason), background: C.navy, display: "grid", placeItems: "center", zIndex: 41 }}>
          <PixelText text={(notice ?? note)!} color={C.lavender} sx={1.4} sy={1.8} />
        </div>
      )}

      {popup?.kind === "closet" && (
        <Inventory category={popup.category} categories={categories} closet={closet} onClose={closePopup} onWear={wear} onDragStart={showRack} onDelete={(g) => {
          const wornAt = Object.keys(state.extras).find((k) => state.extras[k] === g.id);
          if (wornAt) dispatch({ type: "TAKE_OFF", category: wornAt });
          onDeleteGarment(g);
        }} />
      )}
      {popup?.kind === "style" && (
        <StyleQuiz
          closet={closet}
          wardrobe={wardrobe}
          saved={myStyle}
          onSave={(s, board) => {
            onSaveStyle(s);
            wearBoard(board);
            setPopup(null);
          }}
          onClose={closePopup}
        />
      )}
      {popup?.kind === "looks" && (
        <SavedLooks
          looks={looks}
          closet={closet}
          onWear={wearLook}
          onDelete={(id) => onSaveLooks(looks.filter((l) => l.id !== id))}
          onClose={closePopup}
        />
      )}
      {popup?.kind === "more" && (
        <MoreMenu
          categories={overflowCategories(categories)}
          onPick={(id) => setPopup({ kind: "closet", category: id })}
          onSignOut={onSignOut}
          settings={[
            { key: "body", label: "MY MODEL PHOTO", title: "Use a photo of yourself on the dressed-up screen", act: () => setPopup({ kind: "body" }) },
            ...(onRetag ? [{ key: "retag", label: "RE-TAG MY CLOSET", title: "Have the AI read the styles of your uploads again", act: () => (setPopup(null), onRetag()) }] : []),
            {
              key: "wardrobe",
              label: `CLOTHES: ${WARDROBES.find((w) => w.id === wardrobe)?.label}`,
              title: "Switch between womenswear, menswear and a mix of both",
              act: () => onChangeWardrobe(WARDROBES[(WARDROBES.findIndex((w) => w.id === wardrobe) + 1) % WARDROBES.length].id),
            },
          ]}
          onClose={closePopup}
        />
      )}
    </div>
  );
}

// PIXEL | MY CLOTHES, under the title: which clothes are on the rack.
function SourceToggle({ source, onChange }: { source: "mine" | "pixel"; onChange: (s: "mine" | "pixel") => void }) {
  const box = L.sourceToggle;
  const half = (id: "pixel" | "mine", text: string) => {
    const on = source === id;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={id === "pixel" ? "Play with the pixel clothes" : "Play with my clothes"}
        onClick={() => onChange(id)}
        style={{ flex: id === "pixel" ? 4 : 6, height: "100%", padding: 0, border: 0, cursor: "pointer", background: on ? C.btnBlue : "transparent", borderRadius: box.h, display: "grid", placeItems: "center" }}
      >
        <PixelText text={text} color={on ? C.white : C.lavender} sx={1.2} sy={1.6} bold={on} />
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Clothes on the rack" style={{ ...pos(box), boxSizing: "border-box", display: "flex", padding: 2, gap: 2, background: C.navy, border: `2px solid ${C.lavender}`, borderRadius: box.h, zIndex: 5 }}>
      {half("pixel", "PIXEL")}
      {half("mine", "MY CLOTHES")}
    </div>
  );
}
