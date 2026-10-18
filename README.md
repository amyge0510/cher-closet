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
Sign-ins aren't remembered, so every visit starts on the sign-in screen and
needs a new code. Returning users skip the name step, since their name is
kept with the account.

Right after the name, first sign-in only, it asks **"What do you like to
wear?"**: WOMENSWEAR, MENSWEAR or A MIX OF BOTH. It asks about the clothes,
not the person's gender, so anyone can pick any answer and nobody has to
label themselves. The answer picks which demo clothes and quiz styles they
see, and the stand-in figure on the reveal. It's kept with the account and
can be switched any time under MORE (CLOTHES: ...). When running locally, a SKIP (DEV) button bypasses sign-in.
To look at the sign-in screens while signed in, add `?preview=signin` to the
address: every step works without sending a text or saving anything, and
the welcome intro plays at the end, as it does for a new user.

**Welcome intro.** Right after the "What do you like to wear?" question, a leopard screen
reads "A REMINDER..." over a TV playing the movie clip. When the clip ends,
the screen brightens and a quick whirlpool of sparkles sucks the TV and title
away, then bursts into a light pink puff of smoke that clears to reveal the
swinging hangers. It plays once per account, right after that question (so accounts made
before the question existed see it once more), and has a SKIP button. Add
`?preview=intro` to the address to watch it again; that starts from a pretend
sign-in, in the same order a new user sees.

The clip lives at `public/intro.mp4`: about 14 seconds of the film (Cher, then
the computer scene: hangers → browsing → MIS-MATCH! → her reaction), cut from
4.5s to 18.75s of the source and scaled down to 640px wide. An H.264 MP4
plays in every modern browser. Without the file, the TV shows static for a few seconds before the whirlpool.

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

1. a family (preppy, edgy, soft, easy, rugged)
2. a specific style inside it (e.g. goth, punk, grunge, moto)

The menswear quiz is the same quiz: it leaves out the styles cut only for
womenswear (the SOFT family and CLEAN GIRL) and adds the RUGGED family:
WORKWEAR, GORPCORE, SKATE and WESTERN. A mix of both gets everything.

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
accessories included. The style map lives
in `src/style/styles.ts`, and the quiz and board logic in `src/style/quiz.ts`.

**The demo closet.** 139 drawn pieces: a womenswear rack, a menswear rack
(48 pieces, including hats), and about 30 pieces in both, such as jeans,
hoodies, loafers and blazers. Each person sees the rack for their answer.
BAGS and HATS show how custom categories land under MORE. Empty built-in
categories are hidden from the bar (a menswear closet has no SKIRTS), except
TOPS and BOTTOMS. Every piece is
tagged with styles, colors and a pattern, so the quiz and matching have
something to work with until real uploads exist.

**MIS-MATCH!** judges the whole look, accessories included, and says why
under the banner. The top and bottom must have at most one pattern, share a
style family, and not mix warm colors (brown, burgundy, red, yellow, olive,
gold) with cool ones (navy, blue, pink, purple, green, silver). Black, white,
gray, denim, cream and beige go with either. Black tights only go with an
all-dark or an all-white/cream outfit; with anything else they're a
MIS-MATCH! on their own. Other accessories only count as
"strikes", and it takes two to make a MIS-MATCH! (one odd bag is a choice;
an odd bag and an odd scarf is a mess). Strikes:

- an accessory has to share a style family with the top or bottom (plain
  black/white/brown shoes go with anything)
- an accessory's accent color has to echo a color in the top or bottom, so a
  pink bag doesn't go on an all-white outfit
- a dark scarf, bag or jewelry is too heavy for an all-light outfit
- at most one patterned piece among top, bottom, scarf and bag
- no more than two accent colors in the whole look

Quiz boards and AUTO DRESS only ever suggest outfits with no strikes at all,
and only add tights when the style calls for them by name (fishnets for goth,
knee socks for Clueless), since most people don't wear tights.
MIS-MATCH! clears itself after three seconds.

**♥ SAVE** appears on the dressed screen after DRESS ME, and saves that outfit.
**LOOKS**, beside MORE on the bottom bar, opens the saved looks as flat-lay
boards. Click one to wear it again, or use its X to delete it. Looks are kept
with the account.

**UPLOAD.** The UPLOAD button on the bottom bar opens a pop-up. Photos can
be added in three ways:

- click UPLOAD FROM COMPUTER (several at once is fine)
- drop them on it
- paste one with Ctrl+V or Cmd+V (this works anywhere on the closet)

Each photo goes through:

1. **Removing the background.** The photo turns into chunky pixels with a
   scan bar sweeping over it. When the cut-out is ready, the background
   blocks flash pink and pop away one by one.
2. **Tagging.** It gets a category, a short name, colors, a pattern and
   styles, all from the app's own lists, so MIS-MATCH! and the quiz can use
   them.
3. **A quick look.** FIX IT lets you rename it or move it to another
   category. Claude's tags file themselves after about three seconds, while
   a guess waits for FILE IT.
4. **Filing.** The piece floats down into its tab on the bar (or into MORE),
   and the tab blinks.

Uploads are saved to the account. Until someone has uploaded at least one
top and one bottom, their pieces are mixed in with the demo rack (theirs
come first in each category). After that, only their own clothes show.

Background removal runs in the browser with
[`@imgly/background-removal`](https://github.com/imgly/background-removal-js).
It's free, needs no account or key, and the photo never leaves the computer.
The first upload downloads the model (about 40MB) from IMG.LY's servers, and
the browser keeps it after that. If the model can't load, a simple fallback
clears everything that matches the photo's edges, which works for clothes
laid on a plain bed, floor or wall. The library is AGPL-licensed: that's
fine while this repo's code is public. A closed-source or paid app would
need IMG.LY's commercial license, or a hosted service instead, such as
remove.bg or a BiRefNet model on Replicate or fal. A hosted service would be
called from an Edge Function like the tagger, so its key stays private.

Tagging uses Claude, through the Supabase Edge Function in
`supabase/functions/tag-garment`, which keeps the API key on the server (see
"Claude tagging" below). Until that's set up, or for anyone not signed in,
the app guesses the colors and category from the pixels.

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
| `src/screens/` | Splash (swinging hangers), Wardrobe (browse/mismatch/match), Reveal (body + block dissolve), Upload |
| `src/upload/` | Background removal, the pixel scanner animation, and tagging (Claude or the pixel guess) |
| `supabase/functions/` | The tag-garment Edge Function (Claude) |
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

## Claude tagging (the tag-garment Edge Function)

`supabase/functions/tag-garment/index.ts` sends each cut-out to Claude
(`claude-opus-5-5`). It uses structured output, so the answer always uses
the app's category, color, pattern and style lists. Refusal fallbacks are
switched on (`fallbacks: "default"`): if the model declines a photo,
Anthropic retries it on its recommended fallback model instead of failing.
Only signed-in users can call the function. Each tag costs a cent or two.

To switch it on:

1. Make an API key at [console.anthropic.com](https://console.anthropic.com)
   (Settings → API Keys) and add a little credit under Billing.
2. In Supabase, go to **Edge Functions → Secrets**. Add one named
   `ANTHROPIC_API_KEY` with the key as its value. Never put this key in
   `.env` or anywhere in the app.
3. Deploy the function, either way:
   - **Dashboard:** Edge Functions → Deploy a new function → Via Editor.
     Name it `tag-garment`, paste in the file, and deploy.
   - **CLI:** `supabase functions deploy tag-garment`.

## Next

1. Full-body photo upload, with anchor placement for the reveal.
2. Editing a filed piece's tags from the closet pop-up.
