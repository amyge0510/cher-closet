import type { Garment } from "./types";

// Placeholder closet used until a user has uploaded their own clothes.
// Images are drawn procedurally (see demoArt.ts), so no photos ship with the app.

export type Fill =
  | { kind: "solid"; base: string }
  | { kind: "plaid"; base: string; lines: string[]; step: number }
  | { kind: "split"; left: Fill; right: Fill };

export type Shape = "vest" | "blazer" | "cropJacket" | "tee" | "mini" | "aline" | "pants";

export type DemoSpec = Omit<Garment, "image"> & { shape: Shape; fill: Fill; band?: string };

const burgundyPlaid: Fill = { kind: "plaid", base: "#4a1420", lines: ["#141014", "#c8a070"], step: 9 };
const yellowPlaid: Fill = { kind: "plaid", base: "#e8b818", lines: ["#5a2a10", "#c84020"], step: 10 };
const monoPlaid: Fill = { kind: "plaid", base: "#d8d4dc", lines: ["#1a1a2a", "#7a2030"], step: 8 };

export const DEMO_SPECS: DemoSpec[] = [
  { id: "demo-vest", slot: "top", name: "Plaid Sweater Vest", shape: "vest", fill: burgundyPlaid, band: "#2a1018",
    colors: ["burgundy", "black"], pattern: "plaid", styles: ["preppy"], set: "burgundy-plaid" },
  { id: "demo-crop-jacket", slot: "top", name: "Patchwork Crop Jacket", shape: "cropJacket",
    fill: { kind: "split", left: monoPlaid, right: { kind: "solid", base: "#16141e" } },
    colors: ["black", "white"], pattern: "plaid", styles: ["grunge"] },
  { id: "demo-blazer", slot: "top", name: "Yellow Plaid Blazer", shape: "blazer", fill: yellowPlaid,
    colors: ["yellow", "black"], pattern: "plaid", styles: ["preppy"], set: "yellow-plaid" },
  { id: "demo-tee", slot: "top", name: "White Baby Tee", shape: "tee", fill: { kind: "solid", base: "#f2f0f4" },
    colors: ["white"], pattern: "solid", styles: ["casual", "preppy"] },
  { id: "demo-pink", slot: "top", name: "Pink Fitted Tee", shape: "tee", fill: { kind: "solid", base: "#f08ab8" },
    colors: ["pink"], pattern: "solid", styles: ["casual", "preppy"] },

  { id: "demo-plaid-mini", slot: "bottom", name: "Plaid Mini", shape: "mini", fill: burgundyPlaid,
    colors: ["burgundy", "black"], pattern: "plaid", styles: ["preppy"], set: "burgundy-plaid" },
  { id: "demo-black-skirt", slot: "bottom", name: "Black Skater Skirt", shape: "aline", fill: { kind: "solid", base: "#121018" },
    colors: ["black"], pattern: "solid", styles: ["evening", "preppy"] },
  { id: "demo-yellow-mini", slot: "bottom", name: "Yellow Plaid Mini", shape: "mini", fill: yellowPlaid,
    colors: ["yellow", "black"], pattern: "plaid", styles: ["preppy"], set: "yellow-plaid" },
  { id: "demo-jeans", slot: "bottom", name: "Light Wash Jeans", shape: "pants", fill: { kind: "solid", base: "#7c9cc8" },
    colors: ["denim"], pattern: "solid", styles: ["casual", "grunge"] },
  { id: "demo-white-mini", slot: "bottom", name: "White Mini", shape: "mini", fill: { kind: "solid", base: "#eeeaf0" },
    colors: ["white"], pattern: "solid", styles: ["casual", "preppy"] },
];
