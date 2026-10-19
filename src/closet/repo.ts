import { supabase } from "../lib/supabase";
import { slotFor } from "./categories";
import type { Garment, Pattern, Slot } from "./types";

type Row = {
  id: string;
  category: string;
  slot: Slot | null;
  name: string;
  cutout_path: string | null;
  colors: string[];
  pattern: Pattern;
  styles: string[];
  set_name: string | null;
};

const SIGNED_URL_SECONDS = 60 * 60 * 12;

// The signed-in user's finished garments, with short-lived links to their
// cut-outs. Empty when there's no backend or nothing has been uploaded yet.
export async function loadCloset(): Promise<Garment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("garments")
    .select("id, category, slot, name, cutout_path, colors, pattern, styles, set_name")
    .eq("status", "ready")
    .order("created_at");
  const rows = (data ?? []) as Row[];
  if (error || !rows.length) return [];

  const paths = rows.map((r) => r.cutout_path).filter((p): p is string => !!p);
  const { data: signed } = await supabase.storage.from("closet").createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  return rows
    .filter((r) => r.cutout_path && urls.has(r.cutout_path))
    .map((r) => ({
      id: r.id,
      category: r.category,
      slot: r.slot ?? slotFor(r.category),
      name: r.name,
      image: urls.get(r.cutout_path!)!,
      colors: r.colors,
      pattern: r.pattern,
      styles: r.styles,
      set: r.set_name ?? undefined,
    }));
}

// Files an uploaded garment: the cut-out goes to the private "closet" bucket
// under the owner's folder, and a ready row goes in the garments table.
export async function saveGarment(owner: string, g: Garment, png: Blob): Promise<void> {
  if (!supabase) return;
  const path = `${owner}/garments/${g.id}.png`;
  const up = await supabase.storage.from("closet").upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from("garments").insert({
    id: g.id,
    category: g.category,
    slot: g.slot,
    name: g.name,
    cutout_path: path,
    colors: g.colors,
    pattern: g.pattern,
    styles: g.styles,
    status: "ready",
  });
  if (error) throw error;
}

// Deletes an uploaded garment: its row and its cut-out.
export async function deleteGarment(owner: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("garments").delete().eq("id", id);
  if (error) throw error;
  await supabase.storage.from("closet").remove([`${owner}/garments/${id}.png`]);
}

