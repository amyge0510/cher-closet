import type { Slot, Verdict } from "../closet/types";

//  splash ─▶ browse ─[dress me]─▶ mismatch ─[browse]─▶ browse
//                       └────────▶ match ─(timer)─▶ reveal ─(anim)─▶ dressed
//  dressed ─[dress me]─▶ browse        match/dressed ─[auto dress]─▶ match
//  any screen but splash ─[pick from the closet pop-up]─▶ browse
export type Screen = "splash" | "browse" | "mismatch" | "match" | "reveal" | "dressed";

export type State = {
  screen: Screen;
  top: number;
  bottom: number;
  verdict: Verdict | null;
};

export type Action =
  | { type: "SPLASH_DONE" }
  | { type: "STEP"; slot: Slot; delta: number; count: number }
  | { type: "DRESS_ME"; verdict: Verdict }
  | { type: "BROWSE" }
  | { type: "AUTO_DRESS"; top: number; bottom: number }
  | { type: "PICK"; slot: Slot; index: number }
  | { type: "SHOW_RACK" }
  | { type: "MATCH_SHOWN" }
  | { type: "REVEAL_DONE" }
  | { type: "GOTO"; screen: Screen }; // dev overlay only

export const initialState: State = { screen: "splash", top: 0, bottom: 0, verdict: null };

const wrap = (i: number, n: number) => (n ? ((i % n) + n) % n : 0);

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SPLASH_DONE":
      return s.screen === "splash" ? { ...s, screen: "browse" } : s;
    case "STEP":
      if (s.screen !== "browse" && s.screen !== "mismatch") return s;
      return { ...s, screen: "browse", verdict: null, [a.slot]: wrap(s[a.slot] + a.delta, a.count) };
    case "DRESS_ME":
      if (s.screen === "browse" || s.screen === "mismatch")
        return { ...s, screen: a.verdict.match ? "match" : "mismatch", verdict: a.verdict };
      if (s.screen === "dressed") return { ...s, screen: "browse", verdict: null };
      return s;
    case "BROWSE":
      return s.screen === "mismatch" ? { ...s, screen: "browse", verdict: null } : s;
    case "AUTO_DRESS":
      if (s.screen === "match" || s.screen === "dressed")
        return { ...s, screen: "match", top: a.top, bottom: a.bottom, verdict: { match: true, reason: "auto dress" } };
      return s;
    case "PICK":
      if (s.screen === "splash") return s;
      return { ...s, screen: "browse", verdict: null, [a.slot]: a.index };
    case "SHOW_RACK":
      return s.screen === "splash" || s.screen === "browse" ? s : { ...s, screen: "browse", verdict: null };
    case "MATCH_SHOWN":
      return s.screen === "match" ? { ...s, screen: "reveal" } : s;
    case "REVEAL_DONE":
      return s.screen === "reveal" ? { ...s, screen: "dressed" } : s;
    case "GOTO":
      return { ...s, screen: a.screen };
  }
}
