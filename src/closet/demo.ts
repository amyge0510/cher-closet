import { forWardrobe, type Wardrobe } from "../style/styles";
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
  | "shoulderBag" | "tote" | "miniBag"
  | "chore" | "puffer" | "joggers" | "cowboyBoots" | "watch" | "bandana" | "backpack"
  | "cap" | "beanie" | "cowboyHat" | "bucketHat" | "dress";

// `audience` says which demo closet a piece is in: womenswear, menswear, or
// (left out) both.
export type DemoSpec = Omit<Garment, "image" | "slot"> & { shape: Shape; fill: Fill; band?: string; audience?: "womens" | "mens" };

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

  // dresses
  item("dresses", "dress", "Little Black Dress", solid("#141218"), ["black"], ["minimal", "goth", "oldmoney"]),
  item("dresses", "dress", "Floral Sundress", dots("#f4ecd8", "#d0607a", 10), ["cream", "pink", "green"], ["cottage"]),
  item("dresses", "dress", "Pink Slip Dress", solid("#f4bccb"), ["babypink"], ["coquette", "y2k", "ballet"]),

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

// Pieces from the rack above that belong in the menswear closet too.
const UNISEX = new Set([
  "Faded Band Tee", "Studded Leather Jacket", "Biker Jacket", "White Button-Up", "Navy Blazer", "Tweed Blazer", "White Polo",
  "Red Flannel Shirt", "Gray Zip Hoodie", "Oversized Black Hoodie",
  "Cream Cable Knit", "Black Turtleneck", "Gray Crewneck", "Argyle Sweater Vest", "Navy Quarter Zip",
  "Light Wash Jeans", "Ripped Black Jeans", "Beige Trousers", "Black Wide-Leg Trousers", "Cargo Pants", "Linen Pants",
  "White Sneakers", "Combat Boots", "Brown Loafers", "Black Loafers", "Chunky Sneakers", "Lace-Up Boots",
  "Silver Chain", "Gold Pendant", "Burgundy Wool Scarf", "Leather Tote", "Canvas Crossbody",
]);
for (const spec of DEMO_SPECS) if (!UNISEX.has(spec.name)) spec.audience = "womens";

const mens = (...args: Parameters<typeof item>) => {
  const spec = item(...args);
  spec.audience = "mens";
  return spec;
};
const buffalo = plaid("#b0182a", "#141018", "#141018", 12);

// The menswear rack, including the RUGGED styles (workwear, gorpcore, skate,
// western). Hats aren't a built-in category, so they land under MORE.
DEMO_SPECS.push(
  // tops
  mens("tops", "tee", "White Crew Tee", solid("#f4f4f2"), ["white"], ["everyday", "minimal", "street", "skate"]),
  mens("tops", "tee", "Heather Gray Tee", solid("#a8a8ae"), ["gray"], ["everyday", "athleisure", "street"]),
  mens("tops", "tee", "Black Pocket Tee", solid("#1c1c20"), ["black"], ["minimal", "street", "everyday", "moto"]),
  mens("tops", "tee", "Navy Polo", solid("#22305a"), ["navy"], ["tennis", "oldmoney", "everyday"]),
  mens("tops", "blouse", "Light Blue Oxford", solid("#b8cce8"), ["blue"], ["oldmoney", "academia", "everyday"]),
  mens("tops", "blouse", "Buffalo Check Flannel", buffalo, ["red", "black"], ["workwear", "grunge", "western"]),
  mens("tops", "blouse", "Pearl Snap Shirt", solid("#6a86b0"), ["denim"], ["western"]),
  mens("tops", "tee", "Graphic Skate Tee", dots("#f2f2f0", "#c82030", 14), ["white", "red"], ["skate", "street"]),
  mens("tops", "blouse", "Camp Collar Shirt", dots("#e8dcc0", "#2a6a4a", 10), ["cream", "green"], ["street", "skate"]),
  mens("tops", "chore", "Tan Chore Coat", solid("#b08a5a"), ["brown"], ["workwear", "everyday"]),
  mens("tops", "chore", "Denim Trucker Jacket", solid("#5a78a8"), ["denim"], ["workwear", "western", "everyday"]),
  mens("tops", "blouse", "Olive Fleece", solid("#6a7044"), ["olive"], ["gorpcore"]),
  mens("tops", "puffer", "Black Puffer", solid("#1c1c22"), ["black"], ["gorpcore", "street"]),
  mens("tops", "puffer", "Orange Shell Jacket", solid("#d8641c"), ["orange"], ["gorpcore"]),
  mens("tops", "chore", "Varsity Jacket", solid("#22305a"), ["navy", "cream"], ["street", "everyday"], { band: "#efe4cc" }),

  // sweaters
  mens("sweaters", "blouse", "Navy Crewneck", knit("#22305a", "#2c3c6a"), ["navy"], ["oldmoney", "academia", "everyday"]),
  mens("sweaters", "blazer", "Charcoal Cardigan", knit("#4a4a52", "#5a5a62"), ["gray"], ["academia", "minimal"]),
  mens("sweaters", "blouse", "Fair Isle Sweater", dots("#efe4cc", "#b0182a", 9), ["cream", "red"], ["gorpcore", "academia"]),

  // bottoms
  mens("bottoms", "pants", "Khaki Chinos", solid("#c8b088"), ["beige"], ["oldmoney", "academia", "everyday", "workwear"]),
  mens("bottoms", "pants", "Navy Chinos", solid("#26304e"), ["navy"], ["oldmoney", "everyday"]),
  mens("bottoms", "pants", "Carpenter Pants", solid("#8a6238"), ["brown"], ["workwear", "skate"]),
  mens("bottoms", "wideLeg", "Baggy Skate Jeans", solid("#6c88b4"), ["denim"], ["skate", "street", "grunge"]),
  mens("bottoms", "joggers", "Gray Sweatpants", solid("#9c9ca4"), ["gray"], ["athleisure", "everyday", "street"]),
  mens("bottoms", "joggers", "Black Joggers", solid("#1c1c20"), ["black"], ["athleisure", "street", "gorpcore"]),
  mens("bottoms", "shorts", "Hiking Shorts", solid("#b4a47c"), ["beige"], ["gorpcore", "everyday"]),
  mens("bottoms", "shorts", "White Tennis Shorts", solid("#f6f6f4"), ["white"], ["tennis", "athleisure"]),
  mens("bottoms", "pants", "Bootcut Jeans", solid("#34466c"), ["denim"], ["western", "workwear", "everyday"]),
  mens("bottoms", "pants", "Brown Corduroys", solid("#7a5434"), ["brown"], ["academia", "workwear"]),

  // shoes
  mens("shoes", "boots", "Work Boots", solid("#9a6a3a"), ["brown"], ["workwear", "western", "grunge"]),
  mens("shoes", "cowboyBoots", "Cowboy Boots", solid("#6a3a20"), ["brown"], ["western"]),
  mens("shoes", "sneakers", "Skate Shoes", solid("#1c1c22"), ["black", "white"], ["skate", "street"]),
  mens("shoes", "sneakers", "Trail Runners", solid("#8a8e86"), ["gray", "orange"], ["gorpcore", "athleisure"]),
  mens("shoes", "loafers", "Boat Shoes", solid("#8a5a34"), ["brown"], ["oldmoney", "tennis"]),

  // jewelry
  mens("jewelry", "watch", "Steel Watch", solid("#c8ccd4"), ["silver"], ["minimal", "oldmoney", "everyday", "athleisure"]),
  mens("jewelry", "watch", "Leather Watch", solid("#6a4024"), ["brown"], ["academia", "workwear", "western", "oldmoney"]),
  mens("jewelry", "pearls", "Bead Necklace", solid("#e8e0cc"), ["cream"], ["skate", "street"]),

  // scarves
  mens("scarves", "bandana", "Red Bandana", dots("#b02028", "#f4f0e8", 8), ["red", "white"], ["western", "workwear", "skate"]),
  mens("scarves", "scarf", "Gray Knit Scarf", knit("#9a9aa2", "#8a8a92"), ["gray"], ["gorpcore", "minimal", "everyday"]),

  // bags
  mens("bags", "backpack", "Black Backpack", solid("#1c1c20"), ["black"], ["everyday", "skate", "street", "gorpcore"]),
  mens("bags", "backpack", "Hiking Pack", solid("#c86420"), ["orange"], ["gorpcore"]),
  mens("bags", "shoulderBag", "Leather Messenger", solid("#6a4428"), ["brown"], ["academia", "workwear", "oldmoney"]),

  // hats
  mens("hats", "cap", "Navy Baseball Cap", solid("#22305a"), ["navy"], ["everyday", "street", "athleisure", "tennis"]),
  mens("hats", "beanie", "Black Beanie", knit("#1c1c20", "#2c2c32"), ["black"], ["skate", "grunge", "workwear", "street"]),
  mens("hats", "beanie", "Orange Beanie", knit("#d8641c", "#c45414"), ["orange"], ["gorpcore", "workwear"]),
  mens("hats", "cowboyHat", "Cowboy Hat", solid("#c8a070"), ["beige"], ["western"]),
  mens("hats", "bucketHat", "Bucket Hat", solid("#6a7044"), ["olive"], ["gorpcore", "street"]),

  // underwear
  mens("underwear", "shorts", "Gray Boxer Briefs", solid("#8a8a94"), ["gray"], ["everyday", "athleisure"]),
  mens("underwear", "tank", "White Undershirt", solid("#f6f6f4"), ["white"], ["everyday", "minimal"]),
);

// The demo pieces for someone's wardrobe choice (everything for "both").
export const demoSpecsFor = (wardrobe: Wardrobe | null | undefined) => DEMO_SPECS.filter((s) => forWardrobe(s, wardrobe));
