import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Look } from "../closet/types";
import type { MyStyle } from "../style/styles";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User; name: string | null }
  // no backend configured, or skipped in dev: runs on the demo closet
  | { status: "guest"; name: string };

// whether the welcome intro has played for this account
export const introSeenOf = (user: User): boolean => !!user.user_metadata?.intro_seen;
export const looksOf = (user: User): Look[] => (user.user_metadata?.looks as Look[] | undefined) ?? [];
export const styleOf = (user: User): MyStyle | null => (user.user_metadata?.style as MyStyle | undefined) ?? null;

const nameOf = (user: User): string | null => (user.user_metadata?.display_name as string | undefined)?.trim() || null;

// Phone-number sign-in: text a one-time code, check it, then ask for a name.
// Sign-ins aren't remembered (see lib/supabase.ts), so every visit starts here.
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

  // the style quiz result, kept with the account
  const saveStyle = useCallback(async (style: MyStyle) => {
    await supabase?.auth.updateUser({ data: { style } });
  }, []);

  // saved outfits, kept with the account
  const saveLooks = useCallback(async (looks: Look[]) => {
    await supabase?.auth.updateUser({ data: { looks } });
  }, []);

  const markIntroSeen = useCallback(async () => {
    await supabase?.auth.updateUser({ data: { intro_seen: true } });
  }, []);

  const signOut = useCallback(async () => {
    setState({ status: "signedOut" });
    await supabase?.auth.signOut();
  }, []);

  const skip = useCallback(() => setState({ status: "guest", name: "Cher" }), []);

  return { state, sendCode, verifyCode, saveName, saveStyle, saveLooks, markIntroSeen, signOut, skip };
}

// Turns Supabase errors into something short the pixel font can draw.
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code ?? "";
  console.error("sign-in failed:", code, msg); // the full reason, for debugging
  if (code === "phone_provider_disabled" || /unsupported phone provider/i.test(msg)) return "TEXT SIGN-IN ISN'T SWITCHED ON YET.";
  if (code === "sms_send_failed") return "THE TEXT COULDN'T BE SENT. TRY AGAIN LATER.";
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg + code)) return "THAT CODE DIDN'T WORK. TRY AGAIN.";
  if (/rate|security purposes|too many/i.test(msg)) return "TOO MANY TRIES. WAIT A MINUTE, THEN TRY AGAIN.";
  if (/phone/i.test(msg)) return "CHECK THE PHONE NUMBER AND TRY AGAIN.";
  if (/fetch|network/i.test(msg)) return "CAN'T REACH THE CLOSET. CHECK YOUR CONNECTION.";
  return msg.toUpperCase().replace(/[^A-Z0-9 '.,!?:\-+()/]/g, "").slice(0, 80) || "SOMETHING WENT WRONG.";
}
