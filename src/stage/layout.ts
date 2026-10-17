// All positions are in stage pixels on the 640x480 screen, measured from the
// film frames in dev-reference/. Tweak here, check with the dev overlay (`).
export const STAGE_W = 640;
export const STAGE_H = 480;

export type Box = { x: number; y: number; w: number; h: number };

export const L = {
  header: { x: 0, y: 0, w: 640, h: 32 },
  title: { x: 2, y: 9, sx: 1.6, sy: 2 }, // "CHER'S WARDROBE"
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
  categories: [
    { label: "SHOES", x: 9 },
    { label: "JEWELRY", x: 66 },
    { label: "SCARVES", x: 148 },
    { label: "PANTYHOSE", x: 224 },
    { label: "UNDERWEAR", x: 315 },
    { label: "PANTS", x: 412 },
    { label: "SWEATERS", x: 466 },
  ],
  more: { x: 562, y: 453, w: 62, h: 24 },
} as const;
