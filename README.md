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
↑ ↓ flip bottoms, Enter is Dress Me, Esc clears MIS-MATCH! early.

As in the film, the left button is **BROWSE** while you're picking. It flicks
through the tops on its own (the row's ▶▶ lights up), then the bottoms, and
settles on an outfit; press it again to stop. Once you're dressed, it becomes
**AUTO DRESS**.

**Sign-in.** People sign in with their phone number: a code arrives by text,
then they give their first name, and the header becomes "AMY'S WARDROBE".
Browsers remember the sign-in, so returning visitors go straight to the
hangers. When running locally, a SKIP (DEV) button bypasses sign-in.
To look at the sign-in screens while signed in, add `?preview=signin` to the
address: every step works without sending a text or saving anything.

**Welcome intro.** Right after someone's first sign-in, a leopard screen plays
the movie clip on a little TV. Under it, captions alternate between
"BREWING..." and closet phrases every two seconds. When the clip ends, a
whirlpool of sparkles sucks the TV and captions away and reveals "WELCOME TO
AMY'S CLOSET", then it fades into the hangers. It plays once per account and
has a SKIP button. Add `?preview=intro` to the address to watch it again.

The clip lives at `public/intro.mp4`: about 11 seconds of the film's
computer scene (hangers → browsing → MIS-MATCH! → Cher's reaction), cut from
7.5s to 18.75s of the source and scaled down to 640px wide. An H.264 MP4
plays in every modern browser. Until the file is added, the TV shows static and the
captions run for a few seconds before the whirlpool.

**The closet pop-up.** Click any category on the bottom bar (TOPS, BOTTOMS
and SKIRTS always come first) to open that part of the closet as a grid of
inventory slots. Overflow categories, and any category a user makes up, are
under MORE, along with SIGN OUT. Everything can be worn. Click a piece or drag
it out: tops go on the top panel, and bottoms and skirts on the bottom panel.
Accessories (shoes, jewelry, scarves, pantyhose, underwear, bags) stand on
the leopard beside the outfit, one per category; click one to take it off.
They are drawn onto the body in the reveal too. The search box only searches
the open category.

**MY STYLE.** The pencil button in the header opens a two-step style quiz.
Each step shows four outfit boards built from the user's own closet:

1. a family (preppy, edgy, soft, easy)
2. a specific style inside it (e.g. goth, punk, grunge, moto)

Only styles the closet can really dress are offered: a style needs a top and
a bottom that are both tagged with it and go together. The ones with the most
outfits come first, so a closet of jeans and tees leads with EVERYDAY, and a
closet that can only make two styles shows two boards. Untagged uploads count
as EVERYDAY pieces. Shoes may repeat across boards, and when no shoes suit a
style the most neutral pair is used.

OTHER OUTFITS rebuilds the boards from different pieces, without changing
the choices, and BACK steps out. On the result screen, NEW OUTFIT does the same
for the final board. WEAR IT saves the result with
the account and swaps the outfit on screen, accessories included, for the
final board. Auto Dress then prefers outfits that fit the saved style, shows
that style's name under its label, and changes everything on each press,
accessories included. A small tab under MY STYLE says what it's for ("FIND
YOUR STYLE", then "TWEAK YOUR STYLE"). The style map lives
in `src/style/styles.ts`, and the quiz and board logic in `src/style/quiz.ts`.

**The demo closet.** 91 drawn pieces across every category, plus a
BAGS category to show how custom categories land under MORE. Every piece is
tagged with styles, colors and a pattern, so the quiz and matching have
something to work with until real uploads exist.

**MIS-MATCH!** judges the whole look, accessories included, and says why
under the banner. On top of the top/bottom check (patterns, style, clashing
colors):

- an accessory has to share a style family with the top or bottom (plain
  black/white/brown shoes go with anything)
- an accessory's accent color has to echo a color in the top or bottom, so a
  pink bag doesn't go on an all-white outfit
- a dark scarf, bag or jewelry is too heavy for an all-light outfit
- at most one patterned piece among top, bottom, scarf and bag
- no more than two accent colors in the whole look

Quiz boards and AUTO DRESS only ever pick accessories that pass these rules.
MIS-MATCH! clears itself after three seconds.

**SAVE LOOK** (top of the screen) saves what's on right now. The **MY LOOKS (n)**
tab under it opens the saved looks as flat-lay boards. Click one to wear it
again, or use its X to delete it. Looks are kept with the account.

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
