import { describe, expect, it } from "vitest";
import { cleanName, closetHeadline, closetTitle, toE164, wardrobeTitle } from "./names";

describe("wardrobeTitle", () => {
  it("makes the header possessive", () => {
    expect(wardrobeTitle("Cher")).toBe("CHER'S WARDROBE");
    expect(wardrobeTitle("Dionne")).toBe("DIONNE'S WARDROBE");
    expect(wardrobeTitle("James")).toBe("JAMES' WARDROBE");
    expect(wardrobeTitle("")).toBe("YOUR WARDROBE");
    expect(closetHeadline("Amy")).toBe("AMY'S CLOSET");
  });

  it("names the browser tab too", () => {
    expect(closetTitle("Tai")).toBe("Tai's Closet");
    expect(closetTitle(null)).toBe("Cher's Closet");
  });
});

describe("cleanName", () => {
  it("keeps only characters the pixel font can draw, up to 14", () => {
    expect(cleanName("Amy 🌸 Ge!!")).toBe("Amy Ge");
    expect(cleanName("Mary-Kate O'Neil")).toBe("Mary-Kate O'Ne");
  });
});

describe("toE164", () => {
  it("assumes US numbers without a country code", () => {
    expect(toE164("(213) 555-0123")).toBe("+12135550123");
    expect(toE164("1 213 555 0123")).toBe("+12135550123");
  });

  it("keeps international numbers that start with +", () => {
    expect(toE164("+44 7700 900123")).toBe("+447700900123");
  });

  it("rejects things that can't be phone numbers", () => {
    expect(toE164("555-0123")).toBeNull();
    expect(toE164("+12")).toBeNull();
  });
});
