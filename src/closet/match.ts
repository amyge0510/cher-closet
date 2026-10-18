import { familiesOf } from "../style/styles";
import type { Garment, Verdict } from "./types";

const NEUTRALS = new Set(["black", "white", "cream", "gray", "denim", "navy", "beige"]);

// Decides whether a top and bottom go together. Deliberately simple and
// deterministic: the reason is shown in the dev overlay for tuning.
export function judge(top: Garment, bottom: Garment): Verdict {
  if (top.set && top.set === bottom.set) return { match: true, reason: "same set" };

  const busyTop = top.pattern !== "solid";
  const busyBottom = bottom.pattern !== "solid";
  if (busyTop && busyBottom) return { match: false, reason: "two competing patterns" };

  // styles go together if they share a specific style or a family (e.g. two edgy looks)
  const topFamilies = familiesOf(top.styles);
  const styleOverlap = familiesOf(bottom.styles).some((f) => topFamilies.includes(f));
  if (!styleOverlap) return { match: false, reason: "styles clash" };

  const shared = top.colors.some((c) => bottom.colors.includes(c));
  const neutral = top.colors.some((c) => NEUTRALS.has(c)) || bottom.colors.every((c) => NEUTRALS.has(c));
  if (!shared && !neutral) return { match: false, reason: "colors clash" };

  return { match: true, reason: shared ? "shared color" : "neutral base" };
}

// Every matching (top, bottom) pair, for Auto Dress.
export function matchingPairs(tops: Garment[], bottoms: Garment[]) {
  const pairs: [number, number][] = [];
  tops.forEach((t, i) => bottoms.forEach((b, j) => judge(t, b).match && pairs.push([i, j])));
  return pairs;
}
