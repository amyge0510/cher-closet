// All positions are in stage pixels on the 640x480 screen, measured from the
// film frames in dev-reference/. Tweak here, check with the dev overlay (`).
// Phones held upright get their own 400x780 screen (PHONE_L below): the same
// pieces, stacked to fit.

// Decided once at start-up; turning the phone sideways reloads (main.tsx).
// It goes by the device's screen, not the window: the on-screen keyboard
// shrinks the window until it's wider than tall, which isn't a turn.
export function isPhone(): boolean {
  if (typeof window === "undefined" || typeof screen === "undefined") return false;
  const small = Math.min(screen.width, screen.height) <= 700;
  const type = screen.orientation?.type;
  const upright = type ? type.startsWith("portrait") : screen.height >= screen.width;
  return small && upright;
}
export const PHONE = isPhone();

// a phone's screen is as wide as its shape allows (the part between the
// browser's bars), between 400 and 520 stage pixels
function phoneWidth(): number {
  if (typeof window === "undefined") return 400;
  const h = Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity);
  return Math.max(400, Math.min(520, Math.floor((780 * window.innerWidth) / h)));
}
export const STAGE_W = PHONE ? phoneWidth() : 640;
export const STAGE_H = PHONE ? 780 : 480;

export type Box = { x: number; y: number; w: number; h: number };

// Where worn accessories sit on the leopard sides, next to the top and bottom.
const DESK_SPOTS: Record<string, Box> = {
  jewelry: { x: 46, y: 64, w: 112, h: 68 }, // below the PIXEL | MY CLOTHES toggle
  scarves: { x: 40, y: 136, w: 124, h: 108 },
  bags: { x: 36, y: 256, w: 132, h: 122 },
  underwear: { x: 484, y: 44, w: 116, h: 80 },
  // a jacket shares the underwear spot (hardly anyone wears both on show)
  jackets: { x: 484, y: 44, w: 116, h: 80 },
  pantyhose: { x: 492, y: 132, w: 100, h: 118 },
  shoes: { x: 470, y: 262, w: 144, h: 112 },
  // hats share the tights spot (menswear has no tights)
  hats: { x: 492, y: 132, w: 100, h: 118 },
};
// on a phone the leopard sides are columns either side of the panels
function phoneSpots(W: number): Record<string, Box> {
  const col = Math.round((W - (244 + Math.round((W - 400) * 0.5))) / 2) - 10;
  const left = (y: number, h: number) => ({ x: 4, y, w: col, h });
  const right = (y: number, h: number) => ({ x: W - 4 - col, y, w: col, h });
  return {
    jewelry: left(84, 80),
    scarves: left(176, 120),
    bags: left(308, 120),
    underwear: right(84, 80),
    jackets: right(84, 80),
    pantyhose: right(176, 120),
    shoes: right(308, 120),
    hats: right(176, 120),
  };
}
export const EXTRA_SPOTS = PHONE ? phoneSpots(STAGE_W) : DESK_SPOTS;
// any other category (one a user made up) shares the underwear spot
export const extraSpot = (category: string): Box => EXTRA_SPOTS[category] ?? EXTRA_SPOTS.underwear;

const DESK_L = {
  header: { x: 0, y: 0, w: 640, h: 32 },
  title: { x: 2, y: 9, sx: 1.6, sy: 2 }, // "CHER'S WARDROBE"
  sourceToggle: { x: 6, y: 37, w: 176, h: 22 }, // AMY'S CLOSET | MY CLOSET, under the title
  showSeason: true,
  season: { x: 264, y: 8, w: 132, h: 21 }, // "FALL FASHIONS" box
  seasonText: { sx: 1.5, sy: 2 },

  leopardLeft: { x: 0, y: 32, w: 204, h: 418 },
  leopardRight: { x: 444, y: 32, w: 196, h: 418 },
  center: { x: 200, y: 32, w: 248, h: 418 },

  topPanel: { x: 206, y: 38, w: 236, h: 168 },
  topControls: { x: 206, y: 208, w: 236, h: 34 },
  bottomPanel: { x: 206, y: 246, w: 236, h: 164 },
  bottomControls: { x: 206, y: 412, w: 236, h: 34 },
  // the three buttons inside a controls strip, relative to the strip
  controlButtons: [
    { x: 3, y: 4, w: 76, h: 26 },
    { x: 92, y: 4, w: 56, h: 26 },
    { x: 158, y: 4, w: 75, h: 26 },
  ],

  leftButton: { x: 82, y: 392, w: 114, h: 54 }, // BROWSE / AUTO DRESS
  rightButton: { x: 453, y: 392, w: 117, h: 54 }, // DRESS ME
  buttonText: { sx: 2.4, sy: 2.6 },

  banner: { x: 80, y: 190, w: 490, h: 84 }, // MIS-MATCH!
  bannerText: { sx: 8.8, sy: 7.4 },

  revealPanel: { x: 206, y: 38, w: 236, h: 408 },

  categoryBar: { x: 0, y: 450, w: 640, h: 30 },
  categoryText: { sx: 1.5, sy: 2, y: 459 },
  // labels are placed left to right from `start`; ones that don't fit before
  // `end` go under MORE
  categoryRun: { start: 9, end: 380, gap: 14 },
  upload: { x: 388, y: 454, w: 98, h: 22 }, // UPLOAD, styled like MY STYLE
  looks: { x: 492, y: 453, w: 66, h: 24 },
  more: { x: 562, y: 453, w: 62, h: 24 },

  // the closet pop-up (Minecraft-style inventory), sitting just above the bar
  inventory: { x: 136, y: 250, w: 368, h: 196 },
  invSearch: { dx: 150, w: 168 }, // the search box, from the pop-up's left edge
  invPad: 10,
  invHeader: 26,
  invSlot: 36,
  invCols: 9,
  invRows: 3,
  invScrollW: 16,
  moreMenu: { x: 446, w: 184, rowH: 22 }, // grows upward from the bar

  // MY STYLE button in the header, and the style quiz pop-up
  styleButton: { x: 512, y: 6, w: 122, h: 21 },
  saveLook: { x: 350, y: 414, w: 86, h: 26 }, // ♥ SAVE, on the dressed screen
  bannerReason: { x: 80, y: 276, w: 490, h: 24 }, // why it's a mis-match
  styleQuiz: { x: 8, y: 36, w: 624, h: 410 },
  // the upload pop-up, in the middle of the screen
  uploadBox: { x: 130, y: 36, w: 380, h: 410 },
  quizBoard: { y: 80, w: 145, h: 290, gap: 8, cols: 4 },

  // sign-in, laid out inside the center column
  signPanel: { x: 206, y: 38, w: 236, h: 408 },
  signFrame: { x: 200, y: 32, w: 248, h: 418 },
  wardrobeButton: { w: 204, h: 32, gap: 8 },
  phoneErrorY: 360, // below the longer privacy note
  signTitle: { y: 52, sx: 3, sy: 3.4 },
  signLabel: { y: 196, sx: 1.6, sy: 2 },
  signField: { x: 216, y: 218, w: 216, h: 34 },
  signHint: { y: 266, sx: 1.4, sy: 1.8 },
  signError: { y: 316, sx: 1.4, sy: 1.8 },

  // the intro's little TV (16:9 inside a 10px frame) and its SKIP button
  introTv: { x: 50, y: 98, w: 540, h: 312 },
  introSkip: { x: 560, y: 444, w: 70, h: 26 },
  introTitle: { y: 30, sx: 5, sy: 5.4 },

  // MY CLOSET with nothing in it yet: the pop-up asking for uploads
  emptyBox: { x: 180, y: 150, w: 280, h: 150 },
};

type Layout = typeof DESK_L;

// Phones held upright: at least 400x780, and as wide as the phone's own
// shape (up to 520), so the title sits in the left corner and MY STYLE in
// the right. The center column (two windows and their controls) runs down
// the middle with leopard columns for accessories either side; BROWSE and
// DRESS ME sit under it, and the category bar gets a second row for UPLOAD,
// LOOKS and MORE.
function phoneLayout(W: number): Layout {
  const pw = 244 + Math.round((W - 400) * 0.5); // the windows get half the extra width
  const px = Math.round((W - pw) / 2);
  const third = Math.floor((W - 20 - 12) / 3);
  const button = Math.floor((W - 16 * 2 - 12) / 2);
  return {
    ...DESK_L,
    header: { x: 0, y: 0, w: W, h: 40 },
    title: { x: 8, y: 12, sx: 1.8, sy: 2.2 },
    sourceToggle: { x: 8, y: 48, w: 170, h: 26 },
    showSeason: false,

    leopardLeft: { x: 0, y: 40, w: W, h: 650 },
    leopardRight: { x: 0, y: 40, w: 0, h: 0 },
    center: { x: px - 6, y: 82, w: pw + 12, h: 524 },

    topPanel: { x: px, y: 88, w: pw, h: 214 },
    topControls: { x: px, y: 304, w: pw, h: 40 },
    bottomPanel: { x: px, y: 348, w: pw, h: 210 },
    bottomControls: { x: px, y: 560, w: pw, h: 40 },
    controlButtons: [
      { x: 3, y: 5, w: Math.round(pw * 0.33), h: 30 },
      { x: Math.round(pw * 0.38), y: 5, w: Math.round(pw * 0.24), h: 30 },
      { x: Math.round(pw * 0.67), y: 5, w: pw - Math.round(pw * 0.67) - 3, h: 30 },
    ],

    leftButton: { x: 16, y: 620, w: button, h: 52 },
    rightButton: { x: W - 16 - button, y: 620, w: button, h: 52 },
    buttonText: { sx: 2.1, sy: 2.3 },

    banner: { x: 8, y: 300, w: W - 16, h: 76 },
    bannerText: { sx: 6.8, sy: 6 },
    bannerReason: { x: 8, y: 378, w: W - 16, h: 26 },

    revealPanel: { x: px, y: 88, w: pw, h: 512 },

    categoryBar: { x: 0, y: 690, w: W, h: 90 },
    categoryText: { sx: 1.6, sy: 2.1, y: 700 },
    categoryRun: { start: 10, end: W - 8, gap: 14 },
    upload: { x: 10, y: 734, w: third, h: 34 },
    looks: { x: 10 + third + 6, y: 734, w: third, h: 34 },
    more: { x: W - 10 - third, y: 734, w: third, h: 34 },

    inventory: { x: Math.round((W - 350) / 2), y: 470, w: 350, h: 216 },
    invSearch: { dx: 140, w: 150 },
    invSlot: 44,
    invCols: 7,
    moreMenu: { x: W - 194, w: 190, rowH: 28 },

    styleButton: { x: W - 8 - 112, y: 8, w: 112, h: 24 },
    saveLook: { x: px + pw - 92, y: 566, w: 86, h: 28 },
    styleQuiz: { x: Math.round((W - 368) / 2), y: 72, w: 368, h: 566 }, // leopard shows all round
    uploadBox: { x: Math.round((W - 380) / 2), y: 110, w: 380, h: 470 },
    quizBoard: { y: 130, w: 160, h: 188, gap: 10, cols: 2 },

    // sign-in: one wide panel in the middle of the leopard
    signPanel: { x: Math.round((W - 340) / 2), y: 110, w: 340, h: 470 },
    signFrame: { x: Math.round((W - 352) / 2), y: 104, w: 352, h: 482 },
    wardrobeButton: { w: 260, h: 40, gap: 10 },
    phoneErrorY: 520,
    signTitle: { y: 132, sx: 3.4, sy: 3.8 },
    signLabel: { y: 300, sx: 1.8, sy: 2.2 },
    signField: { x: Math.round((W - 300) / 2), y: 326, w: 300, h: 40 },
    signHint: { y: 384, sx: 1.5, sy: 1.9 },
    signError: { y: 470, sx: 1.5, sy: 1.9 },

    introTv: { x: 10, y: Math.round(250 - ((W - 20) * 9) / 16 / 2 + 112), w: W - 20, h: Math.round(((W - 20) * 9) / 16) },
    introSkip: { x: W - 86, y: 736, w: 76, h: 30 },
    introTitle: { y: 170, sx: 3.4, sy: 4 },
    emptyBox: { x: Math.round((W - 320) / 2), y: 280, w: 320, h: 130 },
  };
}

export const L: Layout = PHONE ? phoneLayout(STAGE_W) : DESK_L;
