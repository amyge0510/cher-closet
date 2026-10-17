# cher-closet

A recreation of Cher's computerized closet from *Clueless* (1995): flip through
tops and bottoms, hit **Dress Me**, get a **MIS-MATCH!** or watch the outfit
appear on a full-body photo. Desktop web first; a mobile redesign comes later.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (match rules, state machine, font)
npm run build    # production build in dist/
```

Controls: click the on-screen buttons, or use the keyboard. ← → flip tops,
↑ ↓ flip bottoms, Enter is Dress Me, Esc is Browse.

**Sign-in.** People sign in with their phone number: a code arrives by text,
then they give their first name, and the header becomes "AMY'S WARDROBE".
Browsers remember the sign-in, so returning visitors go straight to the
hangers. When running locally, a SKIP (DEV) button bypasses sign-in.

**The closet pop-up.** Click any category on the bottom bar (TOPS, BOTTOMS
and SKIRTS always come first) to open that part of the closet as a grid of
inventory slots. Overflow categories, and any category a user makes up, are
under MORE, along with SIGN OUT. Click a top or bottom to put it on the rack,
or drag it onto the top or bottom panel. Bottoms and skirts both go on the
bottom panel. The search box searches the whole closet.

## Matching the film: the ghost overlay

In dev mode, press **`** (backtick) to lay a film frame over the live screen.

- **frame**: `auto` follows the current screen. You can also pin any frame from `dev-reference/`.
- **opacity**: how strongly the frame shows through.
- **difference blend**: aligned pixels turn black, so anything still lit is off.
- **nudge**: shifts and scales the frame itself, in case a crop is slightly off. The setting is saved per frame.
- **go to**: jumps straight to any screen. `splash` replays the hanger animation.

To move something on screen, edit `src/stage/layout.ts` (all positions are in
pixels on a fixed 640×480 screen). To recolor something, edit
`src/stage/palette.ts`. The overlay and the frames never ship in the
production build.

## How it's built

| Path | What it is |
|---|---|
| `src/stage/` | The fixed 640×480 stage that scales to the window, plus layout and palette |
| `src/pixel/` | The pixel look: a hand-drawn 7-row bitmap font, nearest-neighbour image pixelation with a sticker outline, the procedural leopard tile |
| `src/state/machine.ts` | splash → browse → mismatch / match → reveal → dressed |
| `src/closet/` | Garment types, match rules, a procedurally drawn demo closet, and the placeholder body with its garment anchors |
| `src/screens/` | Splash (swinging hangers), Wardrobe (browse/mismatch/match), Reveal (body + block dissolve) |
| `src/dev/` | The ghost overlay (dev only) |
| `supabase/migrations/` | Database schema for per-user closets |

Everything is pixelated on purpose. Text is drawn as square SVG blocks.
Images are drawn small onto a canvas, then scaled up without smoothing.

## Supabase

The schema in `supabase/migrations/` creates:

- `garments`: one row per uploaded item, with slot, tags, and cut-out path. A `status` field tracks processing.
- `body_photos`: the photo used for the reveal, plus where tops and bottoms sit on it.
- A private `closet` storage bucket. Files live under `<user id>/…`.

Row-level security means each user only sees their own rows and files.

To apply it, either:

- paste the file into **Dashboard → SQL Editor** and run it, or
- run `supabase db push` with the Supabase CLI.

The project address and publishable key live in `.env`. Both are public by
design, so the file is committed. Never put the database password or a
secret / `service_role` key there: anything in a `VITE_` variable ends up in
the browser.

Run every file in `supabase/migrations/`, oldest first.

Phone sign-in also needs text messaging switched on. In Supabase, go to
**Authentication → Sign In / Providers → Phone**, turn it on, and connect an
SMS service such as Twilio.

Until someone uploads their own clothes, they see the demo closet.

## Next

1. Upload pipeline: background removal or garment segmentation, tagging, and a confirm screen.
2. Full-body photo upload, with anchor placement for the reveal.
