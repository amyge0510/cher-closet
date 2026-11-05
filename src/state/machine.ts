import { slotKeys } from "../closet/categories";
import type { Slot } from "../closet/types";

//  splash ─▶ browse ─[dress me]─▶ reveal ─(anim)─▶ dressed ─[dress me]─▶ browse
//  any (not mid-reveal) ─[auto dress]─▶ reveal
//  any screen but splash ─[pick from the closet pop-up]─▶ browse
export type Screen = "splash" | "browse" | "reveal" | "dressed";

export type State = {
  screen: Screen;
  top: number;
  bottom: number;
  /** worn accessories: category id -> garment id */
  extras: Record<string, string>;
};

export type Action =
  | { type: "SPLASH_DONE" }
  | { type: "STEP"; slot: Slot; delta: number; count: number }
  | { type: "DRESS_ME" }
  | { type: "AUTO_DRESS"; top: number; bottom: number; extras: Record<string, string> }
  | { type: "PICK"; slot: Slot; index: number }
  | { type: "SHOW_RACK" }
  | { type: "WEAR"; category: string; id: string } // an accessory; wearing it again takes it off
  | { type: "TAKE_OFF"; category: string } // a slot key: "shoes", "jewelry:2"...
  | { type: "SET_OUTFIT"; top: number; bottom: number; extras: Record<string, string> }
  | { type: "REVEAL_DONE" }
  | { type: "GOTO"; screen: Screen }; // dev overlay only

export const initialState: State = { screen: "splash", top: 0, bottom: 0, extras: {} };

const wrap = (i: number, n: number) => (n ? ((i % n) + n) % n : 0);

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SPLASH_DONE":
      return s.screen === "splash" ? { ...s, screen: "browse" } : s;
    case "STEP":
      if (s.screen !== "browse") return s;
      return { ...s, [a.slot]: wrap(s[a.slot] + a.delta, a.count) };
    case "DRESS_ME":
      // straight on: no checking whether it all goes
      if (s.screen === "browse") return { ...s, screen: "reveal" };
      if (s.screen === "dressed") return { ...s, screen: "browse" };
      return s;
    case "AUTO_DRESS":
      // works from any screen but the splash and mid-reveal
      if (s.screen === "splash" || s.screen === "reveal") return s;
      return { ...s, screen: "reveal", top: a.top, bottom: a.bottom, extras: a.extras };
    case "PICK":
      if (s.screen === "splash") return s;
      return { ...s, screen: "browse", [a.slot]: a.index };
    case "WEAR": {
      if (s.screen === "splash") return s;
      // wearing a worn piece again takes it off
      const wornAt = Object.keys(s.extras).find((k) => s.extras[k] === a.id);
      if (wornAt) {
        const { [wornAt]: _, ...rest } = s.extras;
        return { ...s, screen: "browse", extras: rest };
      }
      // jewelry layers into the first free slot (or replaces the last one);
      // anything else replaces what's worn in its category
      const keys = slotKeys(a.category);
      const key = keys.find((k) => !(k in s.extras)) ?? keys[keys.length - 1];
      return { ...s, screen: "browse", extras: { ...s.extras, [key]: a.id } };
    }
    case "TAKE_OFF": {
      if (s.screen === "splash" || !(a.category in s.extras)) return s;
      const { [a.category]: _, ...extras } = s.extras;
      return { ...s, extras };
    }
    case "SET_OUTFIT":
      if (s.screen === "splash") return s;
      return { ...s, screen: "browse", top: a.top, bottom: a.bottom, extras: a.extras };
    case "SHOW_RACK":
      return s.screen === "splash" || s.screen === "browse" ? s : { ...s, screen: "browse" };
    case "REVEAL_DONE":
      return s.screen === "reveal" ? { ...s, screen: "dressed" } : s;
    case "GOTO":
      return { ...s, screen: a.screen };
  }
}
