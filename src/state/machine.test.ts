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

  it("auto dress picks a new pair and re-runs the match", () => {
    const s = reducer({ ...browse, screen: "dressed" }, { type: "AUTO_DRESS", top: 2, bottom: 3 });
    expect(s).toMatchObject({ screen: "match", top: 2, bottom: 3 });
  });
});
