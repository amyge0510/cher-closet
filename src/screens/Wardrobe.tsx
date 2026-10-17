import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { judge, matchingPairs } from "../closet/match";
import type { Garment, Slot } from "../closet/types";
import { PixelImage } from "../pixel/PixelImage";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L, type Box } from "../stage/layout";
import type { Action, State } from "../state/machine";
import { Bevel, ButtonLabel, CategoryBar, ControlStrip, Header, Leopard, pos } from "./Parts";
import { Reveal } from "./Reveal";

const MATCH_HOLD_MS = 1400; // black panels stay up this long before the reveal
const SCAN_STEP_MS = 70;

function GarmentPanel({ box, garment, matched }: { box: Box; garment?: Garment; matched: boolean }) {
  return (
    <div style={{ ...pos(box), background: matched ? C.panelMatch : C.panel, display: "grid", placeItems: "center" }}>
      {garment && (
        <PixelImage key={garment.id} src={garment.image} w={box.w - 16} h={box.h - 10} pixel={2} fill={0.92} outline={C.white} />
      )}
    </div>
  );
}

export function Wardrobe({ state, dispatch, tops, bottoms }: {
  state: State; dispatch: Dispatch<Action>; tops: Garment[]; bottoms: Garment[];
}) {
  const { screen } = state;
  const top = tops[state.top];
  const bottom = bottoms[state.bottom];
  const scanTimer = useRef(0);

  const step = useCallback(
    (slot: Slot, delta: number) => dispatch({ type: "STEP", slot, delta, count: slot === "top" ? tops.length : bottoms.length }),
    [dispatch, tops.length, bottoms.length],
  );

  // fast-forward: flick through the rack and land somewhere random
  const scan = useCallback(
    (slot: Slot) => {
      clearInterval(scanTimer.current);
      let left = 6 + Math.floor(Math.random() * 8);
      scanTimer.current = window.setInterval(() => {
        step(slot, 1);
        if (--left <= 0) clearInterval(scanTimer.current);
      }, SCAN_STEP_MS);
    },
    [step],
  );
  useEffect(() => () => clearInterval(scanTimer.current), []);

  const dressMe = useCallback(() => {
    if (!top || !bottom) return;
    dispatch({ type: "DRESS_ME", verdict: judge(top, bottom) });
  }, [dispatch, top, bottom]);

  const autoDress = useCallback(() => {
    const pairs = matchingPairs(tops, bottoms);
    if (!pairs.length) return;
    const others = pairs.filter(([t, b]) => t !== state.top || b !== state.bottom);
    const [t, b] = (others.length ? others : pairs)[Math.floor(Math.random() * (others.length || pairs.length))];
    dispatch({ type: "AUTO_DRESS", top: t, bottom: b });
  }, [dispatch, tops, bottoms, state.top, state.bottom]);

  useEffect(() => {
    if (screen !== "match") return;
    const t = window.setTimeout(() => dispatch({ type: "MATCH_SHOWN" }), MATCH_HOLD_MS);
    return () => clearTimeout(t);
  }, [screen, state.top, state.bottom, dispatch]);

  const revealDone = useCallback(() => dispatch({ type: "REVEAL_DONE" }), [dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") dressMe();
      else if (e.key === "Escape") dispatch({ type: "BROWSE" });
      else if (e.key === "ArrowLeft") step("top", -1);
      else if (e.key === "ArrowRight") step("top", 1);
      else if (e.key === "ArrowUp") step("bottom", -1);
      else if (e.key === "ArrowDown") step("bottom", 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dressMe, step, dispatch]);

  const matched = screen === "match";
  const fullBody = screen === "reveal" || screen === "dressed";
  const leftIsAuto = screen === "match" || fullBody;

  return (
    <div className="fade-in" style={{ position: "absolute", inset: 0, background: C.frameDark }}>
      <Header />
      <Leopard box={L.leopardLeft} />
      <Leopard box={L.leopardRight} />
      <div style={{ ...pos(L.center), background: C.frameDark, borderLeft: `2px solid ${C.frame}`, borderRight: `2px solid ${C.frame}`, boxSizing: "border-box" }} />

      {fullBody && top && bottom ? (
        <div style={{ ...pos(L.revealPanel), background: C.panel }}>
          <Reveal w={L.revealPanel.w} h={L.revealPanel.h} top={top} bottom={bottom} animate={screen === "reveal"} onDone={revealDone} />
        </div>
      ) : (
        <>
          <GarmentPanel box={L.topPanel} garment={top} matched={matched} />
          <ControlStrip box={L.topControls} onPrev={() => step("top", -1)} onNext={() => step("top", 1)} onScan={() => scan("top")} disabled={matched} />
          <GarmentPanel box={L.bottomPanel} garment={bottom} matched={matched} />
          <ControlStrip box={L.bottomControls} onPrev={() => step("bottom", -1)} onNext={() => step("bottom", 1)} onScan={() => scan("bottom")} disabled={matched} />
        </>
      )}

      {screen === "mismatch" && (
        <Bevel box={L.banner} tone="banner" style={{ borderWidth: 4, zIndex: 5 }}>
          <div className="blink3">
            <PixelText text="MIS-MATCH!" color={C.ink} sx={L.bannerText.sx} sy={L.bannerText.sy} shadow={C.bannerLight} />
          </div>
        </Bevel>
      )}

      {leftIsAuto ? (
        <Bevel box={L.leftButton} tone="blue" onClick={autoDress} label="Auto dress">
          <ButtonLabel lines={["AUTO", "DRESS"]} />
        </Bevel>
      ) : (
        <Bevel box={L.leftButton} tone="gray" onClick={() => dispatch({ type: "BROWSE" })} label="Browse">
          <ButtonLabel lines={["BROWSE"]} />
        </Bevel>
      )}
      <Bevel box={L.rightButton} tone="blue" onClick={dressMe} label="Dress me">
        <ButtonLabel lines={["DRESS", "ME"]} />
      </Bevel>

      <CategoryBar />
    </div>
  );
}
