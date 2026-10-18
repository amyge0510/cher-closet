import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import type { Category } from "../closet/categories";
import { judgeOutfit, matchingPairs } from "../closet/match";
import type { Garment, Look, Slot } from "../closet/types";
import { PixelImage } from "../pixel/PixelImage";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { extraSpot, L, type Box } from "../stage/layout";
import type { Action, State } from "../state/machine";
import { accessoriesFor, rankPairs, type BoardItem } from "../style/quiz";
import { leaf, type MyStyle } from "../style/styles";
import { Inventory, MoreMenu } from "./Inventory";
import { SavedLooks } from "./SavedLooks";
import { StyleQuiz } from "./StyleQuiz";
import { Bevel, ButtonLabel, CategoryBar, ControlStrip, Header, Leopard, overflowCategories, pos } from "./Parts";
import { Reveal } from "./Reveal";

const MATCH_HOLD_MS = 1400; // black panels stay up this long before the reveal
const MISMATCH_MS = 3000; // MIS-MATCH! clears itself after this long
const SCAN_STEP_MS = 110;

function GarmentPanel({ box, garment, matched }: { box: Box; garment?: Garment; matched: boolean }) {
  return (
    <div style={{ ...pos(box), background: matched ? C.panelMatch : C.panel, display: "grid", placeItems: "center" }}>
      {garment && (
        <PixelImage key={garment.id} src={garment.image} w={box.w - 16} h={box.h - 10} pixel={2} fill={0.92} outline={C.white} />
      )}
    </div>
  );
}

// A worn accessory, standing on the leopard beside the outfit. Click to take it off.
function ExtraSticker({ garment, onTakeOff }: { garment: Garment; onTakeOff: () => void }) {
  const b = extraSpot(garment.category);
  return (
    <button
      type="button"
      aria-label={`Take off ${garment.name}`}
      title={`${garment.name} (click to take off)`}
      onClick={onTakeOff}
      style={{ ...pos(b), padding: 0, border: 0, background: "transparent", cursor: "pointer", zIndex: 3 }}
    >
      <PixelImage key={garment.id} src={garment.image} w={b.w} h={b.h} pixel={2} fill={0.9} outline={C.white} />
    </button>
  );
}

type Popup = { kind: "closet"; category: string } | { kind: "more" } | { kind: "style" } | { kind: "looks" } | null;

const MAX_LOOKS = 48;
const SAVED_FLASH_MS = 1500;

export function Wardrobe({ state, dispatch, closet, categories, title, onSignOut, myStyle, onSaveStyle, looks, onSaveLooks }: {
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
  const worn = useMemo(
    () => Object.values(state.extras).map((id) => closet.find((g) => g.id === id)).filter((g): g is Garment => !!g),
    [state.extras, closet],
  );
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
  const top = tops[state.top];
  const bottom = bottoms[state.bottom];
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
      const b = bottoms.findIndex((g) => g.id === look.bottom);
      if (t < 0 || b < 0) return;
      dispatch({ type: "SET_OUTFIT", top: t, bottom: b, extras: look.extras });
      setPopup(null);
    },
    [dispatch, tops, bottoms],
  );

  const step = useCallback(
    (slot: Slot, delta: number) => dispatch({ type: "STEP", slot, delta, count: slot === "top" ? tops.length : bottoms.length }),
    [dispatch, tops.length, bottoms.length],
  );

  // fast-forward: flick through one row and land somewhere random; `then`
  // runs once it settles. The row's ▶▶ button lights up while it flicks.
  const [scanning, setScanning] = useState<Slot | null>(null);
  const scan = useCallback(
    (slot: Slot, then?: () => void) => {
      clearInterval(scanTimer.current);
      setScanning(slot);
      let left = 6 + Math.floor(Math.random() * 8);
      scanTimer.current = window.setInterval(() => {
        step(slot, 1);
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
  const browse = useCallback(() => {
    if (scanning) return stopScan();
    dispatch({ type: "BROWSE" });
    scan("top", () => scan("bottom"));
  }, [scanning, stopScan, dispatch, scan]);
  useEffect(() => () => clearInterval(scanTimer.current), []);

  const dressMe = useCallback(() => {
    if (!top || !bottom) return;
    dispatch({ type: "DRESS_ME", verdict: judgeOutfit(top, bottom, worn) });
  }, [dispatch, top, bottom, worn]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && popup) return setPopup(null);
      // leave typing, and Enter/space on a focused button, to the element itself
      if (popup || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.key === "Enter") dressMe();
      else if (e.key === "Escape") dispatch({ type: "BROWSE" });
      else if (e.key === "ArrowLeft") step("top", -1);
      else if (e.key === "ArrowRight") step("top", 1);
      else if (e.key === "ArrowUp") step("bottom", -1);
      else if (e.key === "ArrowDown") step("bottom", 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dressMe, step, dispatch, popup]);

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
      <div style={{ ...pos(L.center), background: C.frameDark, borderLeft: `2px solid ${C.frame}`, borderRight: `2px solid ${C.frame}`, boxSizing: "border-box" }} />

      {fullBody && top && bottom ? (
        <div style={{ ...pos(L.revealPanel), background: C.panel }}>
          <Reveal w={L.revealPanel.w} h={L.revealPanel.h} top={top} bottom={bottom} extras={worn} animate={screen === "reveal"} onDone={revealDone} />
        </div>
      ) : (
        <>
          <GarmentPanel box={L.topPanel} garment={top} matched={matched} />
          <ControlStrip box={L.topControls} onPrev={() => step("top", -1)} onNext={() => step("top", 1)} onScan={() => scan("top")} lit={scanning === "top" ? 2 : undefined} disabled={matched} />
          <GarmentPanel box={L.bottomPanel} garment={bottom} matched={matched} />
          <ControlStrip box={L.bottomControls} onPrev={() => step("bottom", -1)} onNext={() => step("bottom", 1)} onScan={() => scan("bottom")} lit={scanning === "bottom" ? 2 : undefined} disabled={matched} />
        </>
      )}

      {screen === "dressed" && (
        <Bevel box={L.saveLook} tone={justSaved ? "blue" : "gray"} onClick={saveLook} label="Save this look" style={{ borderWidth: 2, zIndex: 6 }}>
          <PixelText text={justSaved ? "♥ SAVED" : "♥ SAVE"} color={C.ink} sx={1.6} sy={2} bold />
        </Bevel>
      )}

      {!fullBody && worn.map((g) => <ExtraSticker key={g.category} garment={g} onTakeOff={() => dispatch({ type: "TAKE_OFF", category: g.category })} />)}

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
          <ButtonLabel lines={["AUTO", "DRESS"]} sub={myStyle ? leaf(myStyle.leaf)?.label : undefined} />
        </Bevel>
      )}
      <Bevel box={L.rightButton} tone="blue" onClick={dressMe} label="Dress me">
        <ButtonLabel lines={["DRESS", "ME"]} />
      </Bevel>

      <CategoryBar
        categories={categories}
        active={popup?.kind === "closet" ? popup.category : popup?.kind}
        onPick={(id) => setPopup(popup?.kind === "closet" && popup.category === id ? null : { kind: "closet", category: id })}
        onMore={() => setPopup(popup?.kind === "more" ? null : { kind: "more" })}
        onLooks={() => setPopup(popup?.kind === "looks" ? null : { kind: "looks" })}
      />

      {popup?.kind === "closet" && (
        <Inventory category={popup.category} categories={categories} closet={closet} onClose={closePopup} onWear={wear} onDragStart={showRack} />
      )}
      {popup?.kind === "style" && (
        <StyleQuiz
          closet={closet}
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
          onClose={closePopup}
        />
      )}
    </div>
  );
}
