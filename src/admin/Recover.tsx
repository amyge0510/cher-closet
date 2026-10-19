import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BUILT_IN } from "../closet/categories";
import { loadCloset, saveGarment } from "../closet/repo";
import { CLOSET_IMAGE_CACHE, closetImageKey } from "../lib/imageCache";
import { supabase } from "../lib/supabase";
import { loadImage, makeCanvas } from "../pixel/raster";
import { forTagging } from "../upload/cutout";
import { garmentFrom, tagCategories, tagGarment } from "../upload/tags";
import type { Wardrobe } from "../style/styles";

// /#recover: puts deleted clothes back from the copies this browser kept of
// their pictures (src/lib/imageCache.ts). Each comes back under its old id,
// so saved looks that used it work again; the AI tags it afresh, since the
// name, colors and styles went with the deleted row.

type Found = { id: string; path: string; blob: Blob; url: string };
type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "ready"; found: Found[]; kept: number }
  | { kind: "restoring"; done: number; of: number; failed: number }
  | { kind: "finished"; restored: number; failed: number };

const page: CSSProperties = { minHeight: "100vh", background: "#1d1930", color: "#141433", padding: 16, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" };
const card: CSSProperties = { maxWidth: 760, margin: "0 auto", background: "#f7f7fb", border: "3px solid #141433", padding: 20 };
const button: CSSProperties = { background: "#4f56f8", color: "#fff", border: "3px solid #141433", padding: "12px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer" };

export function Recover() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [owner, setOwner] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState<Wardrobe>("womens");

  useEffect(() => {
    (async () => {
      const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      const user = data.user;
      if (!user) return setState({ kind: "signedOut" });
      setOwner(user.id);
      if (user.user_metadata?.wardrobe === "mens") setWardrobe("mens");
      // what's still in the closet, so only missing pieces are offered
      const have = new Set((await loadCloset(user.id)).map((g) => g.id));
      const found: Found[] = [];
      let kept = 0;
      if ("caches" in window) {
        const cache = await caches.open(CLOSET_IMAGE_CACHE);
        const prefix = closetImageKey(`${user.id}/garments/`);
        for (const req of await cache.keys()) {
          if (!req.url.startsWith(prefix)) continue;
          kept++;
          const path = req.url.slice(closetImageKey("").length);
          const id = path.split("/").pop()!.replace(/\.png$/, "");
          if (have.has(id)) continue;
          const res = await cache.match(req);
          const blob = res ? await res.blob() : null;
          if (blob?.size) found.push({ id, path, blob, url: URL.createObjectURL(blob) });
        }
      }
      setState({ kind: "ready", found, kept });
    })().catch((e) => {
      console.error(e);
      setState({ kind: "ready", found: [], kept: 0 });
    });
  }, []);

  const restore = useCallback(
    async (found: Found[]) => {
      if (!owner) return;
      const cats = tagCategories(BUILT_IN);
      let done = 0;
      let failed = 0;
      setState({ kind: "restoring", done, of: found.length, failed });
      for (const f of found) {
        try {
          const img = await loadImage(f.url);
          const c = makeCanvas(img.width, img.height);
          c.getContext("2d")!.drawImage(img, 0, 0);
          const { tags } = await tagGarment(c, await forTagging(c), cats, wardrobe);
          await saveGarment(owner, garmentFrom(f.id, f.url, tags), f.blob);
        } catch (e) {
          console.error("couldn't put back", f.id, e);
          failed++;
        }
        done++;
        setState({ kind: "restoring", done, of: found.length, failed });
      }
      setState({ kind: "finished", restored: found.length - failed, failed });
    },
    [owner, wardrobe],
  );

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Put deleted clothes back</h1>
        {state.kind === "loading" && <p>Looking for pictures this browser kept…</p>}
        {state.kind === "signedOut" && (
          <p>
            Sign in first: open <a href="/">the closet</a>, sign in, then come back to this page.
          </p>
        )}
        {state.kind === "ready" &&
          (state.found.length ? (
            <>
              <p>
                Found <b>{state.found.length}</b> deleted {state.found.length === 1 ? "piece" : "pieces"} this browser kept a copy of. Putting them back
                files each one again with fresh tags from the AI (this takes a few seconds per piece; keep this page open).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
                {state.found.map((f) => (
                  <img key={f.id} src={f.url} alt="" style={{ width: 72, height: 72, objectFit: "contain", background: "#c3cbf3", border: "2px solid #141433" }} />
                ))}
              </div>
              <button type="button" style={button} onClick={() => restore(state.found)}>
                Put all {state.found.length} back
              </button>
            </>
          ) : (
            <p>
              This browser has no copies of deleted clothes{state.kept ? ` (it has ${state.kept} of the pieces still in your closet)` : ""}. Try this page on
              another phone or computer where you opened the closet recently, in the same browser you used there.
            </p>
          ))}
        {state.kind === "restoring" && (
          <p>
            Putting them back: <b>{state.done}</b> of {state.of}
            {state.failed ? ` (${state.failed} couldn't be saved)` : ""}… keep this page open.
          </p>
        )}
        {state.kind === "finished" && (
          <>
            <p>
              Done: <b>{state.restored}</b> {state.restored === 1 ? "piece is" : "pieces are"} back in your closet
              {state.failed ? `; ${state.failed} couldn't be saved (reload this page to try those again)` : ""}.
            </p>
            <a href="/" style={{ ...button, display: "inline-block", textDecoration: "none" }}>
              Open the closet
            </a>
          </>
        )}
      </div>
    </div>
  );
}
