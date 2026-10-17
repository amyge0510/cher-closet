import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User; name: string | null }
  // no backend configured, or skipped in dev: runs on the demo closet
  | { status: "guest"; name: string };

const nameOf = (user: User): string | null => (user.user_metadata?.display_name as string | undefined)?.trim() || null;

// Phone-number sign-in: text a one-time code, check it, then ask for a name.
// The session is remembered by the browser, so returning visitors skip it.
export function useAuth() {
  const [state, setState] = useState<AuthState>(supabase ? { status: "loading" } : { status: "guest", name: "Cher" });

  useEffect(() => {
    if (!supabase) return;
    const apply = (user: User | null | undefined) =>
      setState((old) => (old.status === "guest" ? old : user ? { status: "signedIn", user, name: nameOf(user) } : { status: "signedOut" }));
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  const sendCode = useCallback(async (phone: string) => {
    const { error } = await supabase!.auth.signInWithOtp({ phone });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase!.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw error;
  }, []);

  const saveName = useCallback(async (name: string) => {
    const { data, error } = await supabase!.auth.updateUser({ data: { display_name: name.trim() } });
    if (error) throw error;
    if (data.user) setState({ status: "signedIn", user: data.user, name: nameOf(data.user) });
  }, []);

  const signOut = useCallback(async () => {
    setState({ status: "signedOut" });
    await supabase?.auth.signOut();
  }, []);

  const skip = useCallback(() => setState({ status: "guest", name: "Cher" }), []);

  return { state, sendCode, verifyCode, saveName, signOut, skip };
}

// Turns Supabase errors into something short the pixel font can draw.
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code ?? "";
  if (/provider/i.test(msg) || /provider_disabled/.test(code)) return "TEXT SIGN-IN ISN'T SWITCHED ON YET.";
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg + code)) return "THAT CODE DIDN'T WORK. TRY AGAIN.";
  if (/rate|security purposes|too many/i.test(msg)) return "TOO MANY TRIES. WAIT A MINUTE, THEN TRY AGAIN.";
  if (/phone/i.test(msg)) return "CHECK THE PHONE NUMBER AND TRY AGAIN.";
  if (/fetch|network/i.test(msg)) return "CAN'T REACH THE CLOSET. CHECK YOUR CONNECTION.";
  return msg.toUpperCase().replace(/[^A-Z0-9 '.,!?:\-+()/]/g, "").slice(0, 80) || "SOMETHING WENT WRONG.";
}
