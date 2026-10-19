import { useEffect, useState, type Dispatch } from "react";
import { createPortal } from "react-dom";
import { STAGE_H, STAGE_W } from "../stage/layout";
import type { Action, Screen, State } from "../state/machine";

// Dev-only ghost overlay: lays a film frame over the live stage so the layout
// can be matched pixel for pixel. Toggle with the ` key. Never ships in builds.
const FRAMES = import.meta.glob("../../dev-reference/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const frameUrl = (name: string) => FRAMES[`../../dev-reference/${name}.png`];
const FRAME_NAMES = Object.keys(FRAMES).map((k) => k.split("/").pop()!.replace(".png", ""));

const AUTO: Record<Screen, string> = {
  splash: "splash",
  browse: "browse",
  mismatch: "mismatch",
  match: "match",
  reveal: "reveal",
  dressed: "dressed",
};
const SCREENS: Screen[] = ["splash", "browse", "mismatch", "match", "reveal", "dressed"];

type Nudge = { x: number; y: number; s: number };
type Prefs = { open: boolean; frame: string; opacity: number; blend: "normal" | "difference"; nudge: Record<string, Nudge> };

const KEY = "cher-dev-overlay";
const DEFAULTS: Prefs = { open: false, frame: "auto", opacity: 0.5, blend: "normal", nudge: {} };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function DevOverlay({ state, dispatch, verdictReason }: { state: State; dispatch: Dispatch<Action>; verdictReason?: string }) {
  const [p, setP] = useState<Prefs>(load);
  const set = (patch: Partial<Prefs>) => setP((old) => ({ ...old, ...patch }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  }, [p]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" && !(e.target instanceof HTMLInputElement)) set({ open: !p.open });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open]);

  if (!p.open) return null;

  const frame = p.frame === "auto" ? AUTO[state.screen] : p.frame;
  const n = p.nudge[frame] ?? { x: 0, y: 0, s: 1 };
  const setNudge = (patch: Partial<Nudge>) => set({ nudge: { ...p.nudge, [frame]: { ...n, ...patch } } });

  const ghost = (
    <img
      src={frameUrl(frame)}
      alt=""
      style={{
        position: "absolute",
        left: n.x,
        top: n.y,
        width: STAGE_W * n.s,
        height: STAGE_H * n.s,
        opacity: p.opacity,
        mixBlendMode: p.blend,
        pointerEvents: "none",
        zIndex: 60,
      }}
    />
  );

  const row = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const };
  const panel = (
    <div
      style={{
        position: "fixed",
        right: 8,
        top: 8,
        zIndex: 1000,
        width: 260,
        padding: 10,
        background: "rgba(10,10,20,0.92)",
        color: "#dde",
        font: "12px/1.5 ui-monospace, monospace",
        border: "1px solid #556",
        display: "grid",
        gap: 8,
      }}
    >
      <b>Ghost overlay ( ` to hide )</b>
      <label style={row}>
        frame
        <select value={p.frame} onChange={(e) => set({ frame: e.target.value })}>
          <option value="auto">auto ({AUTO[state.screen]})</option>
          {FRAME_NAMES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label style={row}>
        opacity
        <input type="range" min={0} max={1} step={0.05} value={p.opacity} onChange={(e) => set({ opacity: +e.target.value })} />
        {p.opacity.toFixed(2)}
      </label>
      <label style={row}>
        <input type="checkbox" checked={p.blend === "difference"} onChange={(e) => set({ blend: e.target.checked ? "difference" : "normal" })} />
        difference blend (black = aligned)
      </label>
      <div style={row}>
        nudge {frame}: x{n.x} y{n.y} s{n.s.toFixed(3)}
        <button onClick={() => setNudge({ x: n.x - 1 })}>←</button>
        <button onClick={() => setNudge({ x: n.x + 1 })}>→</button>
        <button onClick={() => setNudge({ y: n.y - 1 })}>↑</button>
        <button onClick={() => setNudge({ y: n.y + 1 })}>↓</button>
        <button onClick={() => setNudge({ s: n.s - 0.005 })}>−</button>
        <button onClick={() => setNudge({ s: n.s + 0.005 })}>+</button>
        <button onClick={() => setNudge({ x: 0, y: 0, s: 1 })}>reset</button>
      </div>
      <div style={row}>
        go to
        {SCREENS.map((s) => (
          <button key={s} onClick={() => dispatch({ type: "GOTO", screen: s })} disabled={s === state.screen}>
            {s}
          </button>
        ))}
      </div>
      {verdictReason && <div>verdict: {verdictReason}</div>}
    </div>
  );

  return (
    <>
      {ghost}
      {createPortal(panel, document.body)}
    </>
  );
}
