// Closet pictures (cut-outs, the model photo) never change once uploaded:
// each has its own storage path. Their signed links do change every visit,
// though, so the browser can't reuse what it downloaded last time. This
// keeps a copy of each picture in the browser, by path, so a return visit
// shows them straight away instead of downloading them all again.

const CACHE = "cher-closet-images-v1";
// a picture is copied in once it's had time to show (by then the browser has
// it, so the copy doesn't download it a second time)
const COPY_AFTER_MS = 4000;

async function open(): Promise<Cache | null> {
  try {
    return "caches" in window ? await caches.open(CACHE) : null;
  } catch {
    return null; // private browsing, or not allowed
  }
}

// the Cache API wants a URL; this one never goes over the network
const keyOf = (path: string) => `${location.origin}/closet-image/${path}`;

// Links for these storage paths: kept copies where there are any, and links
// from `sign` (signed URLs) for the rest, which are kept for next time.
export async function cachedUrls(paths: string[], sign: (missing: string[]) => Promise<Map<string, string>>): Promise<Map<string, string>> {
  const cache = await open();
  const out = new Map<string, string>();
  const missing: string[] = [];
  await Promise.all(
    paths.map(async (p) => {
      const hit = cache ? await cache.match(keyOf(p)).catch(() => undefined) : undefined;
      const blob = hit ? await hit.blob().catch(() => null) : null;
      if (blob?.size) out.set(p, URL.createObjectURL(blob));
      else missing.push(p);
    }),
  );
  if (!missing.length) return out;
  const signed = await sign(missing);
  for (const [p, url] of signed) {
    out.set(p, url);
    if (cache)
      setTimeout(() => {
        fetch(url)
          .then((r) => (r.ok ? cache.put(keyOf(p), r) : undefined))
          .catch(() => {});
      }, COPY_AFTER_MS);
  }
  return out;
}

// Forgets a picture (when it's deleted).
export async function forgetImage(path: string) {
  const cache = await open();
  await cache?.delete(keyOf(path)).catch(() => false);
}
