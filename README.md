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
through the tops and dresses on its own (the row's ▶▶ lights up), then the
bottoms if it landed on a top, and settles on an outfit with freshly shuffled
accessories; press it again to stop. Once you're dressed, it becomes
**AUTO DRESS**.

**Sign-in.** People sign in with their phone number. The screen says the
number is only used to sign in and keep the closet saved. A code arrives by
text and lets them in as soon as all six digits are typed (there's no
button for it), then they give their first name, and the header becomes "AMY'S WARDROBE".
The browser is remembered, so coming back skips the code, but only while it's
in use: after a week without a visit, the next visit asks for a new code
(`REMEMBER_DAYS` in `src/lib/supabase.ts`). SIGN OUT forgets the browser
straight away. Returning users skip the name step, since their name is
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

**Play with: mine or pixels.** Under MORE, PLAY WITH switches the rack
between your own uploaded clothes and the built-in pixel clothes. It starts on
yours once you've uploaded a top and a bottom, and uploading something always
switches back to yours. Until then, MINE keeps the pixel clothes mixed in so
there's always an outfit to make. The choice is remembered on this browser.

**Dresses.** DRESSES is its own category. A dress rides the top carousel and
is a whole outfit: the two windows in the middle become one tall window for
the dress, and its controls (and ← →) flip through dresses only. BROWSE
always flicks through everything, so it can land on a dress or a top and bottom.
Picking a top or bottom brings the two windows back. DRESS ME judges the dress with its accessories, and on the figure
it hangs from the shoulders to the knees. Auto Dress and the quiz boards
build two-piece outfits only.

**The last outfit.** Whatever's on (top, bottom, accessories) is remembered
in the browser for each account and put back on the next visit, after the
hangers.

**Jewelry layers.** Jewelry is the one category you can wear several of:
up to four pieces at once, like layered necklaces and stacked bracelets.
Clicking a worn piece takes it off. On the figure, necklaces sit at the
neck, bracelets and watches at the wrist, earrings at the ears and rings on
the hand (worked out from the name). Everything else is one at a time.

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
as EVERYDAY pieces. Shoes may repeat across boards.

Each outfit (a top and a bottom that go together) belongs to one style
only: of the styles both pieces are tagged with, the one they claim most
strongly (tags are listed best first). So a black mesh corset tagged both
goth and coquette can't make the same outfit a SOFT board and an EDGY one.
Heels and pumps never go on an EASY board (everyday, clean girl, minimal,
athleisure, streetwear), whatever their tags say.
SOFT also never takes an outfit whose top or bottom is mainly black, navy,
brown, burgundy, gray or olive, whatever the tags say.
EVERYDAY is the exception: any outfit both tagged everyday counts for it.
Boards only use pieces tagged with that style, accessories included: when
nothing in the closet suits a style, the board goes without it (no party
heels on an EASY board). When the closet can make fewer than four styles,
the quiz says to upload more clothes to see more.

OTHER OUTFITS rebuilds the boards from different pieces, without changing
the choices, and BACK steps out. On the result screen, NEW OUTFIT does the same
for the final board. WEAR IT saves the result with
the account and swaps the outfit on screen, accessories included, for the
final board. Auto Dress then prefers outfits that fit the saved style and
changes everything on each press, accessories included. The style map lives
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
under the banner. When the outfit has any uploaded piece and someone is
signed in, Gemini looks at the pictures and judges it (DRESS ME shows
"HMM..." for a moment), since rules can't see that a dressy blouse doesn't
go with bike shorts; each verdict is remembered. The demo rack uses the rules
below. The top and bottom must have at most one pattern, share a
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

**UPLOAD.** The UPLOAD button on the bottom bar opens a pop-up with UPLOAD
CLOTHES and, signed in, UPLOAD A PICTURE OF ME (which makes the model photo
straight away). Signed in,
every photo goes to the AI first: Gemini lists every piece in it (tagged,
with a description of what's visible), then redraws each piece straight-on
as a product shot from the whole photo, faithful to what it can see and
never adding details. A redraw that comes out broken (tiny, or with big
chunks missing) is quietly drawn again once, and the better one shown. A
piece that was mostly hidden says so. If there's a person in the photo, it then offers to make them the
model (MY MODEL PHOTO). Without the AI, the in-browser steps below take over. Photos can
be added in three ways:

- click UPLOAD CLOTHES (several at once is fine)
- drop them on it
- paste one with Ctrl+V or Cmd+V (this works anywhere on the closet)

Each photo goes through:

1. **Removing the background.** The photo turns into chunky pixels with a
   scan bar sweeping over it. When the cut-out is ready, the background
   blocks flash pink and pop away one by one.
2. **Tagging.** It gets a category, a short name, colors, a pattern and
   styles, all from the app's own lists, so MIS-MATCH! and the quiz can use
   them.
3. **A quick look.** Nothing is filed until you say so: every piece waits
   on FILE IT. SKIP drops it (a bad redraw, or something you don't want),
   REDRAW or TIDY UP asks Gemini to draw it again (first asking what was wrong,
e.g. "it's a long dress", which goes into the redraw), and FIX IT lets you
   rename it or move it to another category.
   Edges are cleaned up automatically: bits of background stuck to the edge
   (in colors the garment doesn't have) are trimmed, jagged steps are
   rounded off, and the edge is softened by a pixel.
   **TIDY UP** (signed in only) has Gemini redraw the piece as a straight-on
   product shot, keeping its colors, prints and details. It's drawn on a
   chroma-green background (magenta for green clothes), which the app keys
   out. ORIGINAL switches back. Each redraw costs a few cents.
4. **Filing.** The piece floats down into its tab on the bar (or into MORE),
   and the tab blinks.

Uploads are saved to the account. Until someone has uploaded at least one
top and one bottom, their pieces are mixed in with the demo rack (theirs
come first in each category). After that, only their own clothes show.

Background removal runs in the browser, for free, with no account or key,
and photos never leave the computer. The models download the first time
(and the browser keeps them):

1. A clothes model, [SegFormer for clothes](https://huggingface.co/Xenova/segformer_b2_clothes),
   run with [Transformers.js](https://github.com/huggingface/transformers.js)
   (MIT and Apache licenses, about 30MB from Hugging Face). When the photo
   shows someone wearing an outfit, it finds each piece separately: the top,
   skirt or pants, a dress, shoes, a bag, a hat, a scarf. Each piece then gets
   its own pop, tag and filing ("PIECE 1 OF 2"), and SKIP drops a piece you
   don't want.
2. With no one in the photo (a flat lay or a hanger shot), a general
   background remover, [`@imgly/background-removal`](https://github.com/imgly/background-removal-js),
   cuts out the one item. It downloads about 40MB from IMG.LY. It's
   AGPL-licensed, which is fine while this repo's code is public; a
   closed-source or paid app would need IMG.LY's commercial license or a
   hosted service.
3. If neither model loads, a simple fallback clears everything matching the
   photo's edges. That only works on plain backgrounds, so its result is only
   used when what's left is one clean piece; otherwise the pop-up says the
   background remover couldn't load, instead of filing junk.

Tagging uses Gemini, through the Supabase Edge Function in
`supabase/functions/tag-garment`, which keeps the API key on the server (see
"Tagging" below). Until that's set up, or for anyone not signed in,
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
| `src/upload/` | Background removal, the pixel scanner animation, and tagging (Gemini or the pixel guess) |
| `supabase/functions/` | The tag-garment and gemini-image Edge Functions (Gemini) |
| `src/dev/` | The ghost overlay (dev only) |
| `supabase/migrations/` | Database schema for per-user closets |

The screen is pixelated on purpose: text is drawn as square SVG blocks, and
the leopard print and hanger art are drawn small and scaled up without
smoothing. The clothes are not. As on the film's monitor, each garment shows
as the real photo, drawn sharp, with a thin soft white outline
(`src/pixel/GarmentImage.tsx`). Only the reveal's dissolve and the upload
scanner come in blocks.

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

**DRESS ME with your own figure.** With a model photo and signed in, the
reveal shows your figure with a scan bar ("DRESSING YOU..."), while Gemini
dresses it in the outfit's actual pieces, keeping your face, body and pose
exactly, with exactly one of each item (one bag, one pair of shoes). The
dressed photo (shown whole, on its own lavender background)
then dissolves in block by block. Results are
remembered for the visit. **HAIR**, in the top-right corner above the head,
re-dresses you in another hairstyle (or your own). If the AI can't answer,
the clothes are placed on the figure instead.

**RE-TAG MY CLOSET** (under MORE, signed in) has the AI read the styles of
everything you've uploaded again, with the current rules (names and
categories stay as they are).

**Deleting.** Hover over one of your own pieces in the closet pop-up and an
X appears. It asks to confirm, with a red DELETE button, and removes the
piece and its picture from your account. The demo rack can't be deleted.

**MY MODEL PHOTO** (under MORE, signed in only). Pick or paste any photo of
yourself. Gemini redraws you head-to-toe, standing straight, facing forward,
in a plain black tank and shorts, on the panel's lavender. The picture is
kept whole (no cutting out), and if it isn't head-to-toe it's asked for
again once before you see it. The clothes model then finds
the tank, shorts, legs and head on that picture. That gives the exact spots
where tops, bottoms, tights, shoes, hats, scarves, jewelry and bags go on your
own figure (`src/closet/bodyPhoto.ts`). The figure is cut out and replaces
the stand-in on the dressed-up screen. USE THE STAND-IN goes back. The
pop-up says plainly that the photo goes to Google only for this.

Garments are fitted to their spot's width and hang from its top, so long
tops and full-length pants keep their real proportions.

## Gemini redraws (the gemini-image Edge Function)

`supabase/functions/gemini-image/index.ts` sends a picture to Google's Gemini
image model and returns the redraw. It asks Google which image models the key
can use and takes the newest Flash one, so it keeps working when Google
renames models. To pin one, add a `GEMINI_IMAGE_MODEL` secret. Each person
gets 60 garment pictures (uploads, TIDY UP, REDRAW, DRESS ME) and 5 model
photos a day. Every prompt with a person in it stresses keeping their face,
skin, body and age exactly the same. Requests are counted in the
`ai_usage` table, and people can't delete their own rows to reset the count.
Past the limit the app says "YOU'VE REACHED TODAY'S IMAGE LIMIT! COME BACK
TOMORROW." instead of an error.

To switch it on:

1. In **SQL Editor**, run `supabase/migrations/20261019000000_ai_usage.sql`.
2. Make sure the secret `GEMINI_API_KEY` (or `gemini_api_key`) is under
   **Edge Functions → Secrets**.
3. Deploy the function: **Edge Functions → Deploy a new function → Via
   Editor**, name it `gemini-image`, paste in the file, and deploy.

## Tagging (the tag-garment Edge Function)

`supabase/functions/tag-garment/index.ts` does three jobs: lists and tags
every piece in an uploaded photo, tags a single cut-out, and judges a whole
outfit for DRESS ME. It sends them to Google's
Gemini, using the same `GEMINI_API_KEY` secret as the redraws. It asks Google
which models the key can use and takes the newest Flash model; to pin one,
add a `GEMINI_TEXT_MODEL` secret. The answer is forced into a JSON schema, so
it always uses the app's category, color, pattern and style lists, and the
app checks every value again before filing. Only signed-in users can call
the function. Each tag costs a fraction of a cent.

To switch it on, deploy the function: **Edge Functions → Deploy a new
function → Via Editor**, name it `tag-garment`, paste in the file, and deploy
(or run `supabase functions deploy tag-garment` with the CLI).

## Next

1. Editing a filed piece's tags (and TIDY UP) from the closet pop-up.
2. An AI try-on of the whole outfit on DRESS ME, saved per outfit.
