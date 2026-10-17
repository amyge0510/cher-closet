// Small text helpers for sign-in and the personalised header.

export const NAME_MAX = 14;

// "Cher" -> "CHER'S WARDROBE", "James" -> "JAMES' WARDROBE"
export function wardrobeTitle(name: string | null | undefined) {
  const n = (name ?? "").trim().toUpperCase();
  if (!n) return "YOUR WARDROBE";
  return `${n}${n.endsWith("S") ? "'" : "'S"} WARDROBE`;
}

// For the browser tab: "Cher's Closet"
export function closetTitle(name: string | null | undefined) {
  const n = (name ?? "").trim();
  if (!n) return "Cher's Closet";
  return `${n}${/s$/i.test(n) ? "'" : "'s"} Closet`;
}

// Letters, spaces, apostrophes and hyphens only, so it renders in the pixel font.
export function cleanName(raw: string) {
  return raw.replace(/[^a-zA-Z' -]/g, "").replace(/\s{2,}/g, " ").slice(0, NAME_MAX);
}

export const keepPhoneChars = (raw: string) => raw.replace(/[^\d+()\- ]/g, "").slice(0, 20);
export const keepDigits = (raw: string) => raw.replace(/\D/g, "");

// Turns what someone typed into the +<country><number> form Supabase expects.
// No "+" means a US/Canada number. Returns null when it can't be a phone number.
export function toE164(raw: string): string | null {
  const plus = raw.trim().startsWith("+");
  const digits = keepDigits(raw);
  if (plus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
