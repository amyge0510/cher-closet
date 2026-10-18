import { describe, expect, it } from "vitest";
import { initialState, reducer, type State } from "./machine";

const browse: State = { ...initialState, screen: "browse" };

describe("reducer", () => {
  it("leaves the splash for browse", () => {
    expect(reducer(initialState, { type: "SPLASH_DONE" }).screen).toBe("browse");
  });

  it("wraps around when stepping past either end", () => {
    expect(reducer(browse, { type: "STEP", slot: "top", delta: -1, count: 5 }).top).toBe(4);
    expect(reducer({ ...browse, bottom: 4 }, { type: "STEP", slot: "bottom", delta: 1, count: 5 }).bottom).toBe(0);
  });

  it("shows MIS-MATCH and returns to browse", () => {
    const s = reducer(browse, { type: "DRESS_ME", verdict: { match: false, reason: "x" } });
    expect(s.screen).toBe("mismatch");
    expect(reducer(s, { type: "BROWSE" }).screen).toBe("browse");
  });

  it("runs match -> reveal -> dressed, and Dress Me goes back to browse", () => {
    let s = reducer(browse, { type: "DRESS_ME", verdict: { match: true, reason: "x" } });
    expect(s.screen).toBe("match");
    s = reducer(s, { type: "MATCH_SHOWN" });
    expect(s.screen).toBe("reveal");
    s = reducer(s, { type: "REVEAL_DONE" });
    expect(s.screen).toBe("dressed");
    expect(reducer(s, { type: "DRESS_ME", verdict: { match: true, reason: "x" } }).screen).toBe("browse");
  });

  it("ignores the carousels while matched or revealing", () => {
    const s: State = { ...browse, screen: "reveal" };
    expect(reducer(s, { type: "STEP", slot: "top", delta: 1, count: 5 })).toBe(s);
  });

  it("auto dress works straight from browsing, but not mid-reveal", () => {
    const extras = {};
    expect(reducer(browse, { type: "AUTO_DRESS", top: 1, bottom: 1, extras }).screen).toBe("match");
    const revealing: State = { ...browse, screen: "reveal" };
    expect(reducer(revealing, { type: "AUTO_DRESS", top: 1, bottom: 1, extras })).toBe(revealing);
  });

  it("auto dress picks a new pair and re-runs the match", () => {
    const s = reducer({ ...browse, screen: "dressed", extras: { shoes: "boots" } }, { type: "AUTO_DRESS", top: 2, bottom: 3, extras: { shoes: "flats", bags: "tote" } });
    expect(s).toMatchObject({ screen: "match", top: 2, bottom: 3, extras: { shoes: "flats", bags: "tote" } });
  });

  it("picking from the closet puts the item on the rack from any screen", () => {
    const s = reducer({ ...browse, screen: "dressed" }, { type: "PICK", slot: "bottom", index: 3 });
    expect(s).toMatchObject({ screen: "browse", bottom: 3, verdict: null });
    expect(reducer(initialState, { type: "PICK", slot: "top", index: 1 })).toBe(initialState);
  });

  it("brings the carousels back so an item can be dropped on them", () => {
    expect(reducer({ ...browse, screen: "match" }, { type: "SHOW_RACK" }).screen).toBe("browse");
    expect(reducer(browse, { type: "SHOW_RACK" })).toBe(browse);
  });

  it("wears accessories alongside the outfit, and wearing one again takes it off", () => {
    let s = reducer(browse, { type: "WEAR", category: "shoes", id: "boots" });
    s = reducer(s, { type: "WEAR", category: "jewelry", id: "hoops" });
    expect(s.extras).toEqual({ shoes: "boots", jewelry: "hoops" });
    s = reducer(s, { type: "WEAR", category: "shoes", id: "flats" });
    expect(s.extras.shoes).toBe("flats");
    s = reducer(s, { type: "WEAR", category: "shoes", id: "flats" });
    expect(s.extras).toEqual({ jewelry: "hoops" });
    expect(reducer(s, { type: "TAKE_OFF", category: "jewelry" }).extras).toEqual({});
  });

  it("swaps in a whole outfit (from MY STYLE)", () => {
    const s = reducer({ ...browse, screen: "dressed", extras: { bags: "tote" } }, { type: "SET_OUTFIT", top: 4, bottom: 2, extras: { shoes: "boots" } });
    expect(s).toMatchObject({ screen: "browse", top: 4, bottom: 2, extras: { shoes: "boots" } });
  });
});
