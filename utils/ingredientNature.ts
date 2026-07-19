import { CanonicalUnit } from "@/types";

// Whether an ingredient is measured by volume, by weight, or can't be told from its name.
export type IngredientNature = "liquid" | "solid" | "unknown";

// Strong solid signals that must beat a liquid keyword sharing the same name, e.g. "milk
// powder" (奶粉) and "cream cheese" (忌廉芝士) are solids despite containing milk / cream.
const SOLID_OVERRIDE_EN = ["powder", "powdered", "cube", "cubes", "cheese"];
const SOLID_OVERRIDE_ZH = ["粉", "芝士"];

// Liquids and pourables. English matches on whole words so "oil" never fires on "boiled" or
// "spoiled". Traditional Chinese matches on multi-character tokens: a bare 油 or 水 would
// wrongly catch solids like 油菜 (choy sum), so every liquid is spelled out in full.
const LIQUID_EN = [
  "water", "oil", "milk", "buttermilk", "cream", "stock", "broth", "wine", "vinegar",
  "juice", "honey", "syrup", "sauce", "sake", "mirin", "dashi", "beer", "brine",
  "ketchup", "sriracha", "molasses", "extract", "essence",
];
const LIQUID_ZH = [
  "水", "豉油", "生抽", "老抽", "醬油", "蠔油", "魚露", "麻油", "香油", "花生油", "橄欖油",
  "粟米油", "菜油", "辣椒油", "紹興酒", "米酒", "料酒", "花雕", "啤酒", "米醋", "白醋",
  "黑醋", "陳醋", "香醋", "上湯", "高湯", "雞湯", "清湯", "牛奶", "椰奶", "椰漿", "淡奶",
  "煉奶", "忌廉", "蜂蜜", "糖漿", "檸檬汁", "青檸汁", "橙汁", "果汁", "茄汁", "汽水", "雲呢拿",
];

// Common dry / firm goods that are weighed, so a volume measure ("1 cup flour") reads in
// grams. A helper for accuracy only: unlisted solids measured in a spoon/cup are still caught
// by the reconcile heuristic below.
const SOLID_EN = [
  "flour", "sugar", "salt", "rice", "cornstarch", "cornflour", "starch", "butter", "cocoa",
  "oat", "oats", "breadcrumb", "breadcrumbs", "semolina", "yeast", "gelatin", "gelatine",
  "peanut",
];
const SOLID_ZH = [
  "麵粉", "麪粉", "粟粉", "生粉", "糖", "冰糖", "砂糖", "鹽", "米", "牛油", "燕麥", "可可",
];

function englishWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// Classify an ingredient from its name. Order matters: solid overrides win over a shared
// liquid keyword, then explicit liquids, then explicit solids, else unknown.
export function classifyIngredientNature(name: string): IngredientNature {
  const words = englishWords(name);
  const hasWord = (list: string[]) => words.some((token) => list.includes(token));
  const hasZh = (list: string[]) => list.some((token) => name.includes(token));

  if (hasWord(SOLID_OVERRIDE_EN) || hasZh(SOLID_OVERRIDE_ZH)) return "solid";
  if (hasWord(LIQUID_EN) || hasZh(LIQUID_ZH)) return "liquid";
  if (hasWord(SOLID_EN) || hasZh(SOLID_ZH)) return "solid";
  return "unknown";
}

// A spoon/cup source unit implies a home-cook volume scoop. When one lands on an ingredient we
// can't otherwise classify, it is almost always a dry good (spices, dry mixes), so it reads in
// grams rather than millilitres.
const SPOON_OR_CUP = new Set(["cup", "tbsp", "tsp"]);

// Reconcile a parsed canonical amount with the ingredient's physical nature, so metric shows
// mL / L for liquids and g / kg for solids even when the recipe wrote the "wrong" kind of unit
// (e.g. "1 cup flour" or "milk 250 g"). Conversions use a rough 1 mL ≈ 1 g (water density),
// honest for the app's estimate-level positioning. Counts (pieces) are never touched.
export function reconcileToNature(
  name: string,
  sourceUnitKey: string,
  canonical: { quantity: number; unit: CanonicalUnit },
): { quantity: number; unit: CanonicalUnit } {
  if (canonical.unit === "piece") return canonical;
  const nature = classifyIngredientNature(name);
  const isVolume = canonical.unit === "ml";
  const isMass = canonical.unit === "g";

  if (nature === "liquid" && isMass) return { quantity: canonical.quantity, unit: "ml" };
  if (nature === "solid" && isVolume) return { quantity: canonical.quantity, unit: "g" };
  if (nature === "unknown" && isVolume && SPOON_OR_CUP.has(sourceUnitKey)) {
    return { quantity: canonical.quantity, unit: "g" };
  }
  return canonical;
}
