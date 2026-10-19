import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser client. Returns null until VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set (see .env.example); the app then runs on
// the demo closet.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sign-ins are remembered in this browser, so coming back doesn't need a new
// code, but only while it's in use: after a week without a visit, the saved
// sign-in is wiped and the next visit asks for a code again. SIGN OUT
// forgets the browser straight away.
export const REMEMBER_DAYS = 7;
const LAST_ACTIVE_KEY = "cher-last-active";
const DAY_MS = 24 * 60 * 60 * 1000;

const savedSignIns = () => {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
  } catch {
    return [];
  }
};

// Forgets the saved sign-in (expired, or signing out).
export function forgetBrowser() {
  try {
    for (const key of savedSignIns()) localStorage.removeItem(key);
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    /* storage unavailable: nothing saved */
  }
}

// Marks the browser as in use now (called while someone is signed in).
export function touchBrowser() {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable: the sign-in lasts until reload */
  }
}

// Before the client reads the saved sign-in: wipe it if it's gone stale (or
// was saved before visits were tracked).
export function isStale(lastActive: string | null, now: number, days = REMEMBER_DAYS): boolean {
  const at = Number(lastActive);
  return !lastActive || !Number.isFinite(at) || now - at > days * DAY_MS;
}
try {
  if (savedSignIns().length && isStale(localStorage.getItem(LAST_ACTIVE_KEY), Date.now())) forgetBrowser();
} catch {
  /* storage unavailable */
}

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
