import { describe, expect, it } from "vitest";
import { isStale } from "./supabase";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 19);

describe("remembering the browser", () => {
  it("keeps a sign-in used within the last week", () => {
    expect(isStale(String(now - 6 * DAY), now)).toBe(false);
    expect(isStale(String(now - 60 * 1000), now)).toBe(false);
  });

  it("forgets it after a week without a visit", () => {
    expect(isStale(String(now - 8 * DAY), now)).toBe(true);
  });

  it("forgets a sign-in saved before visits were tracked", () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale("garbage", now)).toBe(true);
  });
});
