import { describe, expect, it } from "vitest";
import { GLYPHS, GLYPH_ROWS, layoutText } from "./font";

describe("bitmap font", () => {
  it("every glyph is 7 rows of equal width", () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows.length, ch).toBe(GLYPH_ROWS);
      expect(new Set(rows.map((r) => r.length)).size, ch).toBe(1);
    }
  });

  it("covers every label on screen", () => {
    const labels = ["CHER'S WARDROBE", "FALL FASHIONS", "MIS-MATCH!", "AUTO DRESS", "SHOES JEWELRY SCARVES PANTYHOSE UNDERWEAR PANTS SWEATERS MORE"];
    for (const l of labels) for (const ch of l) expect(GLYPHS[ch], ch).toBeDefined();
  });

  it("bold widens each glyph by one column", () => {
    expect(layoutText("A", { bold: true }).width).toBe(layoutText("A").width + 1);
  });
});
