import { PHONE } from "../stage/layout";
import { supabase } from "./supabase";

// Logs what signed-in people do, for the owner's dashboard (/#admin). Fire
// and forget: a failed log never gets in anyone's way. Guests aren't logged
// (the events table only takes rows from accounts).
export type EventKind =
  | "visit"
  | "browse"
  | "dress_me"
  | "auto_dress"
  | "save_look"
  | "style_quiz"
  | "upload_clothes"
  | "upload_me"
  | "switch_source";

let signedIn = false;
export const setTracking = (on: boolean) => {
  signedIn = on;
};

export function track(kind: EventKind, detail: Record<string, string | number | boolean> = {}) {
  if (!supabase || !signedIn) return;
  supabase
    .from("events")
    .insert({ kind, detail, device: PHONE ? "phone" : "computer" })
    .then(({ error }) => error && console.warn("couldn't log", kind, error.message));
}
