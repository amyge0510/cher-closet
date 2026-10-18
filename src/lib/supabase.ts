import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser client. Returns null until VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set (see .env.example); the app then runs on
// the demo closet.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sign-ins are not remembered between visits: every visit starts on the
// sign-in screen. The session lives in memory only, so reloading or coming
// back later asks for a new code.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

// Clear any sign-in a browser kept from before sign-ins stopped being
// remembered.
try {
  for (const key of Object.keys(localStorage)) if (key.startsWith("sb-") && key.endsWith("-auth-token")) localStorage.removeItem(key);
} catch {
  /* storage unavailable: nothing to clear */
}
