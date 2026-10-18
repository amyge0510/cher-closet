import type { Garment, Pattern } from "./types";

// Placeholder closet used until a user has uploaded their own clothes.
// Images are drawn procedurally (see demoArt.ts), so no photos ship with the
// app. Style tags are the specific styles in src/style/styles.ts.

export type Fill =
  | { kind: "solid"; base: string }
  | { kind: "plaid"; base: string; lines: string[]; step: number }
  | { kind: "stripe"; base: string; line: string; step: number; vertical?: boolean }
  | { kind: "dots"; base: string; dot: string; step: number }
  | { kind: "knit"; base: string; line: string }
  | { kind: "split"; left: Fill; right: Fill };

export type Shape =
  | "vest" | "blazer" | "cropJacket" | "tee" | "tank" | "cropTop" | "blouse" | "corset" | "turtleneck" | "hoodie"
  | "mini" | "aline" | "midi" | "maxi" | "pants" | "wideLeg" | "shorts" | "leggings"
  | "sneakers" | "boots" | "heels" | "flats" | "loafers"
  | "hoops" | "pendant" | "pearls" | "chain" | "studs"
  | "scarf" | "tights" | "socks" | "bralette"
  | "shoulderBag" | "tote" | "miniBag";

export type DemoSpec = Omit<Garment, "image" | "slot"> & { shape: Shape; fill: Fill; band?: string };

const solid = (base: string): Fill => ({ kind: "solid", base });
const plaid = (base: string, a: string, b: string, step = 9): Fill => ({ kind: "plaid", base, lines: [a, b], step });
const stripe = (base: string, line: string, step = 8, vertical = false): Fill => ({ kind: "stripe", base, line, step, vertical });
const dots = (base: string, dot: string, step = 12): Fill => ({ kind: "dots", base, dot, step });
const knit = (base: string, line: string): Fill => ({ kind: "knit", base, line });

const PATTERN: Record<Fill["kind"], Pattern> = { solid: "solid", plaid: "plaid", stripe: "stripe", dots: "print", knit: "knit", split: "plaid" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function item(category: string, shape: Shape, name: string, fill: Fill, colors: string[], styles: string[], extra: Partial<DemoSpec> = {}): DemoSpec {
  return { id: `demo-${slug(name)}`, category, shape, name, fill, colors, pattern: PATTERN[fill.kind], styles, ...extra };
}

const burgundyPlaid = plaid("#4a1420", "#141014", "#c8a070");
const yellowPlaid = plaid("#e8b818", "#5a2a10", "#c84020", 10);
const monoPlaid = plaid("#d8d4dc", "#1a1a2a", "#7a2030", 8);
const redTartan = plaid("#b0182a", "#141018", "#e8c040", 10);
const brownPlaid = plaid("#7a5236", "#3a2416", "#c8a070", 10);

export const DEMO_SPECS: DemoSpec[] = [
  // the first ten are the original rack, in their original order
  item("tops", "vest", "Plaid Sweater Vest", burgundyPlaid, ["burgundy", "black"], ["clueless", "academia"], { id: "demo-vest", set: "burgundy-plaid", band: "#2a1018" }),
  item("tops", "cropJacket", "Patchwork Crop Jacket", { kind: "split", left: monoPlaid, right: solid("#16141e") }, ["black", "white"], ["grunge", "punk"], { id: "demo-crop-jacket" }),
  item("tops", "blazer", "Yellow Plaid Blazer", yellowPlaid, ["yellow", "black"], ["clueless"], { id: "demo-blazer", set: "yellow-plaid" }),
  item("tops", "tee", "White Baby Tee", solid("#f2f0f4"), ["white"], ["clean", "y2k", "tennis", "minimal", "everyday"], { id: "demo-tee" }),
  item("tops", "tee", "Pink Fitted Tee", solid("#f08ab8"), ["pink"], ["y2k", "coquette"], { id: "demo-pink" }),
  item("skirts", "mini", "Plaid Mini", burgundyPlaid, ["burgundy", "black"], ["clueless", "academia"], { id: "demo-plaid-mini", set: "burgundy-plaid" }),
  item("skirts", "aline", "Black Skater Skirt", solid("#121018"), ["black"], ["academia", "minimal"], { id: "demo-black-skirt" }),
  item("skirts", "mini", "Yellow Plaid Mini", yellowPlaid, ["yellow", "black"], ["clueless"], { id: "demo-yellow-mini", set: "yellow-plaid" }),
  item("bottoms", "pants", "Light Wash Jeans", solid("#7c9cc8"), ["denim"], ["street", "grunge", "clean", "everyday"], { id: "demo-jeans" }),
  item("skirts", "mini", "White Mini", solid("#eeeaf0"), ["white"], ["tennis", "clean", "y2k"], { id: "demo-white-mini" }),

  // tops
  item("tops", "blouse", "Red Flannel Shirt", redTartan, ["red", "black"], ["grunge"]),
  item("tops", "tee", "Faded Band Tee", solid("#2a2830"), ["black"], ["grunge", "punk", "street"]),
  item("tops", "corset", "Black Lace Corset", solid("#141018"), ["black"], ["goth", "coquette"]),
  item("tops", "turtleneck", "Black Mesh Top", stripe("#141018", "#3a3444", 4, true), ["black"], ["goth", "minimal"]),
  item("tops", "blazer", "Studded Leather Jacket", solid("#1a181e"), ["black", "silver"], ["punk", "moto"]),
  item("tops", "cropJacket", "Biker Jacket", solid("#2a2628"), ["black"], ["moto", "street"]),
  item("tops", "tank", "White Ribbed Tank", stripe("#f4f2ee", "#dedad2", 4, true), ["white"], ["clean", "moto", "minimal", "athleisure"]),
  item("tops", "blouse", "White Button-Up", solid("#f6f6f8"), ["white"], ["oldmoney", "minimal", "clean"]),
  item("tops", "blazer", "Navy Blazer", solid("#1e2a4a"), ["navy", "gold"], ["oldmoney", "academia"]),
  item("tops", "blazer", "Tweed Blazer", plaid("#8a6a4a", "#5a4030", "#b89a70", 6), ["brown", "beige"], ["academia", "oldmoney"]),
  item("tops", "tee", "White Polo", solid("#fbfbf6"), ["white", "green"], ["tennis", "oldmoney"]),
  item("tops", "corset", "Blush Ribbon Corset", solid("#f4c4cc"), ["babypink"], ["coquette", "ballet"]),
  item("tops", "blouse", "Lace Peasant Blouse", dots("#f6efe2", "#e2d4bc", 8), ["cream", "white"], ["cottage", "coquette"]),
  item("tops", "blouse", "Floral Blouse", dots("#f2e4c8", "#c86070", 10), ["cream", "pink", "green"], ["cottage"]),
  item("tops", "cropTop", "Butterfly Crop Top", solid("#c8b0f0"), ["lavender"], ["y2k"]),
  item("tops", "hoodie", "Gray Zip Hoodie", solid("#9a9aa2"), ["gray"], ["athleisure", "street", "everyday"]),
  item("tops", "hoodie", "Oversized Black Hoodie", solid("#202024"), ["black"], ["street", "athleisure"]),
  item("tops", "tank", "Beige Ribbed Tank", stripe("#e2d2b8", "#cdbb9e", 4, true), ["beige"], ["clean", "minimal", "everyday"]),
  item("tops", "cropTop", "Wrap Top", solid("#f6d4dc"), ["babypink"], ["ballet", "coquette"]),

  // sweaters
  item("sweaters", "blouse", "Cream Cable Knit", knit("#efe4cc", "#d6c6a4"), ["cream"], ["oldmoney", "academia", "cottage"]),
  item("sweaters", "turtleneck", "Black Turtleneck", solid("#16161a"), ["black"], ["minimal", "academia", "goth"]),
  item("sweaters", "blouse", "Gray Crewneck", knit("#a4a4aa", "#8c8c92"), ["gray"], ["minimal", "athleisure", "clean", "everyday"]),
  item("sweaters", "blazer", "Pink Fuzzy Cardigan", knit("#f4a8c4", "#e48cb0"), ["pink"], ["clueless", "y2k", "coquette"]),
  item("sweaters", "vest", "Argyle Sweater Vest", plaid("#6a1e2a", "#e8d8b0", "#2a3a2a", 12), ["burgundy", "cream"], ["academia", "tennis"]),
  item("sweaters", "blazer", "Ballet Wrap Cardigan", knit("#f8dde4", "#ecc8d2"), ["babypink"], ["ballet"]),
  item("sweaters", "blouse", "Navy Quarter Zip", solid("#22305a"), ["navy", "white"], ["tennis", "oldmoney", "athleisure", "everyday"]),

  // bottoms
  item("bottoms", "pants", "Ripped Black Jeans", solid("#2a2a32"), ["black"], ["grunge", "punk", "moto"]),
  item("bottoms", "leggings", "Leather Pants", solid("#18161a"), ["black"], ["moto", "goth", "punk"]),
  item("bottoms", "wideLeg", "Beige Trousers", solid("#d8c6a6"), ["beige"], ["oldmoney", "clean", "minimal"]),
  item("bottoms", "wideLeg", "Black Wide-Leg Trousers", solid("#1c1c20"), ["black"], ["minimal", "academia"]),
  item("bottoms", "pants", "Cargo Pants", solid("#6a6a44"), ["olive"], ["street", "grunge"]),
  item("bottoms", "wideLeg", "Low-Rise Flares", solid("#6e8cc0"), ["denim", "blue"], ["y2k", "street"]),
  item("bottoms", "leggings", "Black Leggings", solid("#1a1a1e"), ["black"], ["athleisure", "ballet"]),
  item("bottoms", "shorts", "Bike Shorts", solid("#2a2a30"), ["black"], ["athleisure", "street"]),
  item("bottoms", "wideLeg", "Linen Pants", solid("#f0e8da"), ["cream"], ["clean", "cottage", "oldmoney"]),

  // skirts
  item("skirts", "midi", "Brown Plaid Midi", brownPlaid, ["brown", "cream"], ["academia", "oldmoney"]),
  item("skirts", "mini", "Red Tartan Mini", redTartan, ["red", "black"], ["punk", "grunge", "clueless"]),
  item("skirts", "maxi", "Black Maxi Skirt", solid("#141218"), ["black"], ["goth", "minimal"]),
  item("skirts", "midi", "Satin Slip Skirt", solid("#e8d6c4"), ["beige", "cream"], ["clean", "ballet", "minimal"]),
  item("skirts", "aline", "White Tennis Skirt", stripe("#fafafa", "#e4e4e4", 6, true), ["white"], ["tennis", "athleisure"]),
  item("skirts", "aline", "Pink Pleated Mini", stripe("#f6a8c4", "#e48aae", 6, true), ["pink"], ["coquette", "clueless", "y2k"]),
  item("skirts", "maxi", "Tulle Skirt", solid("#f6d6de"), ["babypink"], ["ballet", "coquette"]),
  item("skirts", "maxi", "Gingham Prairie Skirt", plaid("#f4f0e8", "#8ab0d8", "#8ab0d8", 8), ["blue", "white"], ["cottage"]),
  item("skirts", "mini", "Denim Mini", solid("#7090c0"), ["denim"], ["y2k", "grunge", "street", "everyday"]),
  item("skirts", "midi", "Camel Pleated Midi", stripe("#c8a070", "#b08858", 6, true), ["beige", "brown"], ["oldmoney"]),

  // shoes
  item("shoes", "sneakers", "White Sneakers", solid("#f4f4f4"), ["white"], ["clean", "tennis", "street", "athleisure", "everyday"]),
  item("shoes", "boots", "Combat Boots", solid("#1a1818"), ["black"], ["grunge", "punk", "goth", "moto"]),
  item("shoes", "boots", "Platform Boots", solid("#121014"), ["black", "silver"], ["goth", "y2k"]),
  item("shoes", "flats", "White Mary Janes", solid("#f2f0ee"), ["white"], ["clueless", "coquette"]),
  item("shoes", "flats", "Ballet Flats", solid("#f2c8d0"), ["babypink"], ["ballet", "coquette", "clean"]),
  item("shoes", "loafers", "Brown Loafers", solid("#5a3420"), ["brown"], ["oldmoney", "academia", "minimal"]),
  item("shoes", "loafers", "Black Loafers", solid("#141214"), ["black"], ["academia", "minimal", "clueless"]),
  item("shoes", "heels", "Kitten Heels", solid("#c81830"), ["red"], ["coquette", "oldmoney"]),
  item("shoes", "sneakers", "Chunky Sneakers", solid("#d8d8e0"), ["gray", "white"], ["street", "y2k", "athleisure"]),
  item("shoes", "boots", "Lace-Up Boots", solid("#6a4428"), ["brown"], ["cottage", "grunge", "academia"]),

  // jewelry
  item("jewelry", "hoops", "Gold Hoops", solid("#e0b440"), ["gold"], ["clean", "y2k", "street", "everyday"]),
  item("jewelry", "hoops", "Silver Hoops", solid("#c8ccd4"), ["silver"], ["minimal", "moto", "clean"]),
  item("jewelry", "pearls", "Pearl Necklace", solid("#f4f0e6"), ["white", "cream"], ["oldmoney", "coquette", "ballet"]),
  item("jewelry", "chain", "Silver Chain", solid("#b8bcc6"), ["silver"], ["street", "punk", "moto"]),
  item("jewelry", "pendant", "Gold Pendant", solid("#d8a838"), ["gold"], ["academia", "cottage", "oldmoney"]),
  item("jewelry", "studs", "Spiked Choker", solid("#1a1a1e"), ["black", "silver"], ["punk", "goth"]),
  item("jewelry", "pendant", "Cherry Pendant", solid("#8a1428"), ["burgundy", "red"], ["coquette", "y2k", "grunge"]),
  item("jewelry", "pearls", "Beaded Bracelet", solid("#b8a0e8"), ["lavender"], ["y2k", "cottage"]),

  // scarves
  item("scarves", "scarf", "Silk Print Scarf", dots("#22305a", "#e0b440", 10), ["navy", "gold"], ["oldmoney", "clueless"]),
  item("scarves", "scarf", "Burgundy Wool Scarf", solid("#6a1a28"), ["burgundy"], ["academia", "grunge"]),
  item("scarves", "scarf", "Crochet Scarf", knit("#f0e2c4", "#d6c09a"), ["cream"], ["cottage", "clean"]),
  item("scarves", "scarf", "Plaid Blanket Scarf", redTartan, ["red", "black"], ["grunge", "clueless", "punk"]),
  item("scarves", "scarf", "Black Velvet Scarf", solid("#16121a"), ["black"], ["goth", "minimal"]),

  // pantyhose
  item("pantyhose", "tights", "Sheer Black Tights", solid("#2a2630"), ["black"], ["minimal", "academia", "goth"]),
  item("pantyhose", "tights", "Fishnets", plaid("#18161c", "#3a3640", "#3a3640", 5), ["black"], ["goth", "punk", "grunge"]),
  item("pantyhose", "socks", "White Knee Socks", solid("#f6f6f6"), ["white"], ["clueless", "coquette", "y2k"]),
  item("pantyhose", "socks", "Leg Warmers", knit("#f2d6dc", "#e4bcc6"), ["babypink"], ["ballet", "y2k"]),

  // underwear
  item("underwear", "bralette", "Lace Bralette", solid("#f2d8de"), ["babypink"], ["coquette", "ballet"]),
  item("underwear", "bralette", "Sports Bra", solid("#2a2c34"), ["black"], ["athleisure", "street"]),
  item("underwear", "bralette", "Black Bralette", solid("#141216"), ["black"], ["goth", "minimal"]),

  // bags: not a built-in category, so it shows up under MORE like a user-made one
  item("bags", "shoulderBag", "Black Shoulder Bag", solid("#18161a"), ["black", "silver"], ["moto", "minimal", "y2k", "street"]),
  item("bags", "tote", "Leather Tote", solid("#8a5a34"), ["brown"], ["oldmoney", "academia", "clean"]),
  item("bags", "tote", "Straw Tote", stripe("#e2c894", "#c8aa70", 4), ["beige"], ["cottage", "clean"]),
  item("bags", "miniBag", "Pink Bow Bag", solid("#f2a8c0"), ["pink"], ["coquette", "clueless", "y2k"]),
  item("bags", "miniBag", "Rhinestone Mini Bag", dots("#c8ccd8", "#ffffff", 6), ["silver"], ["y2k", "goth"]),
  item("bags", "shoulderBag", "Canvas Crossbody", solid("#6a6a48"), ["olive"], ["street", "grunge", "athleisure", "everyday"]),
];
