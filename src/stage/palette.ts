// Every color on screen. The film frames are washed out by the CRT and video
// transfer, so these are the "intended" colors; tune them with the dev overlay.
export const C = {
  black: "#000000",
  navy: "#1d1930", // header + category bar
  navyMid: "#2c2b54", // controls strip under each panel
  frame: "#5d5795", // light edge around the center column
  frameDark: "#141226",
  panel: "#c3cbf3", // garment panel background (browse)
  panelLight: "#b4c4ff",
  panelMatch: "#000000", // garment panel background once matched
  ink: "#141433", // dark lettering
  lavender: "#c8ccff", // light lettering
  btnGray: "#9a9db4",
  btnGrayLight: "#d8daea",
  btnGrayDark: "#4a4d66",
  btnBlue: "#4f56f8",
  btnBlueLight: "#9aa0ff",
  btnBlueDark: "#20248a",
  banner: "#7684fb",
  bannerLight: "#b8c0ff",
  bannerDark: "#262c8c",
  leopardTan: "#cbbfa6",
  leopardCream: "#eee6d6",
  leopardBrown: "#4c1d1c",
  leopardRust: "#b86c5a",
  splashBg: "#141226",
  splashHanger: "#d2d6ff",
  splashGlow: "#56589c",
  white: "#ffffff",
  // closet pop-up: the Minecraft inventory, but white
  invBg: "#f7f7fb",
  invEdge: "#141433",
  invSlot: "#dedee8",
  invSlotHover: "#ffffff",
  invSlotShadow: "#8c8ca6",
  invText: "#3a3a5a",
  dropGlow: "#ffffff",
} as const;
