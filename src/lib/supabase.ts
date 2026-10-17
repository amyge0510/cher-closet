import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser client. Returns null until VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set (see .env.example); the app then runs on
// the demo closet.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
