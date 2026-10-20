import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Found } from "./tags";

// The AI calls are stood in for: listing a photo gives five pieces, and each
// redraw waits until the test lets it finish.
const item = (name: string): Found => ({ name, category: "tops", colors: [], pattern: "solid", styles: [], isClothing: true, description: name, partial: false });
let started: string[] = [];
let finish: Map<string, () => void>;
let live = 0;
let most = 0;

vi.mock("./cutout", () => ({
  loadPhoto: async () => ({ width: 10, height: 10 }) as HTMLCanvasElement,
  finishCutout: (c: HTMLCanvasElement) => c,
}));
vi.mock("./gemini", () => ({
  jpegOf: () => "jpeg",
  extractItem: (_photo: HTMLCanvasElement, name: string) => {
    started.push(name);
    most = Math.max(most, ++live);
    return new Promise((done) =>
      finish.set(name, () => {
        live--;
        done({ name } as unknown as HTMLCanvasElement);
      }),
    );
  },
}));
vi.mock("./tags", () => ({
  listItems: async () => ({ hasPerson: false, items: ["a", "b", "c", "d", "e"].map(item) }),
}));

const { Ahead, AT_ONCE } = await import("./ahead");
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("upload work done ahead", () => {
  beforeEach(() => {
    started = [];
    finish = new Map();
    live = 0;
    most = 0;
  });

  it("starts every piece as soon as they're listed, a few at a time", async () => {
    const ahead = new Ahead();
    const o = ahead.open(new Blob(["1"]), ["tops"], "womens");
    const listed = (await o.listed)!;
    await settle();
    expect(started).toEqual(["a", "b", "c"]);
    // one finishing lets the next one start, never more than AT_ONCE
    finish.get("a")!();
    await settle();
    expect(started).toEqual(["a", "b", "c", "d"]);
    for (const n of ["b", "c", "d"]) finish.get(n)!();
    await settle();
    finish.get("e")!();
    await settle();
    expect(started).toEqual(["a", "b", "c", "d", "e"]);
    expect(most).toBe(AT_ONCE);
    // asking for a piece gives the drawing already made, not a new one
    const photo = await o.photo;
    const drawn = await ahead.drawing(photo, listed.items[4]);
    expect((drawn as unknown as { name: string }).name).toBe("e");
    expect(started).toHaveLength(5);
  });

  it("opens each photo once, however often it's asked for", async () => {
    const ahead = new Ahead();
    const file = new Blob(["1"]);
    expect(ahead.open(file, [], "womens")).toBe(ahead.open(file, [], "womens"));
  });

  it("starts nothing new after STOP", async () => {
    const ahead = new Ahead();
    await ahead.open(new Blob(["1"]), [], "womens").listed;
    await settle();
    expect(started).toEqual(["a", "b", "c"]);
    ahead.stop();
    for (const n of ["a", "b", "c"]) finish.get(n)!();
    await settle();
    expect(started).toEqual(["a", "b", "c"]);
  });
});
