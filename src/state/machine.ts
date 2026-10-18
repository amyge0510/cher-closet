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
  /** worn accessories: category id -> garment id */
  extras: Record<string, string>;
};

export type Action =
  | { type: "SPLASH_DONE" }
  | { type: "STEP"; slot: Slot; delta: number; count: number }
  | { type: "DRESS_ME"; verdict: Verdict }
  | { type: "BROWSE" }
  | { type: "AUTO_DRESS"; top: number; bottom: number }
  | { type: "PICK"; slot: Slot; index: number }
  | { type: "SHOW_RACK" }
  | { type: "WEAR"; category: string; id: string } // an accessory; wearing it again takes it off
  | { type: "TAKE_OFF"; category: string }
  | { type: "SET_OUTFIT"; top: number; bottom: number; extras: Record<string, string> }
  | { type: "MATCH_SHOWN" }
  | { type: "REVEAL_DONE" }
  | { type: "GOTO"; screen: Screen }; // dev overlay only

export const initialState: State = { screen: "splash", top: 0, bottom: 0, verdict: null, extras: {} };

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
    case "WEAR": {
      if (s.screen === "splash") return s;
      const { [a.category]: current, ...rest } = s.extras;
      const extras = current === a.id ? rest : { ...rest, [a.category]: a.id };
      return { ...s, screen: "browse", verdict: null, extras };
    }
    case "TAKE_OFF": {
      if (s.screen === "splash" || !(a.category in s.extras)) return s;
      const { [a.category]: _, ...extras } = s.extras;
      return { ...s, extras };
    }
    case "SET_OUTFIT":
      if (s.screen === "splash") return s;
      return { ...s, screen: "browse", verdict: null, top: a.top, bottom: a.bottom, extras: a.extras };
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
