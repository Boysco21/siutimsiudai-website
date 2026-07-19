import { IngredientDictionaryEntry } from "@/types";

// Bilingual ingredient map. Drives grocery merge equality so "Onion" and "洋蔥"
// collapse into one line, and backs the substitution engine's display names.
export const INGREDIENT_DICTIONARY: IngredientDictionaryEntry[] = [
  { canonical: "onion", en: "Onion", zh: "洋蔥", aliases: ["onions", "yellow onion", "洋葱", "葱頭"] },
  { canonical: "garlic", en: "Garlic", zh: "蒜頭", aliases: ["garlic clove", "cloves", "蒜", "蒜蓉", "大蒜"] },
  { canonical: "ginger", en: "Ginger", zh: "薑", aliases: ["薑片", "生薑"] },
  { canonical: "spring onion", en: "Spring onion", zh: "葱", aliases: ["scallion", "green onion", "蔥", "青葱"] },
  { canonical: "soy sauce", en: "Soy sauce", zh: "豉油", aliases: ["light soy sauce", "生抽", "醬油"] },
  { canonical: "dark soy sauce", en: "Dark soy sauce", zh: "老抽", aliases: [] },
  { canonical: "oyster sauce", en: "Oyster sauce", zh: "蠔油", aliases: [] },
  { canonical: "sesame oil", en: "Sesame oil", zh: "麻油", aliases: ["芝麻油"] },
  { canonical: "sugar", en: "Sugar", zh: "糖", aliases: ["caster sugar", "白糖", "砂糖"] },
  { canonical: "salt", en: "Salt", zh: "鹽", aliases: ["食鹽"] },
  { canonical: "rice", en: "Rice", zh: "白米", aliases: ["white rice", "米", "飯"] },
  { canonical: "egg", en: "Egg", zh: "雞蛋", aliases: ["eggs", "蛋"] },
  { canonical: "chicken", en: "Chicken", zh: "雞肉", aliases: ["chicken thigh", "雞", "雞髀"] },
  { canonical: "pork", en: "Pork", zh: "豬肉", aliases: ["pork belly", "豬", "五花腩"] },
  { canonical: "beef", en: "Beef", zh: "牛肉", aliases: ["牛", "牛腩"] },
  { canonical: "shrimp", en: "Shrimp", zh: "蝦", aliases: ["prawn", "prawns", "蝦仁"] },
  { canonical: "tofu", en: "Tofu", zh: "豆腐", aliases: ["bean curd"] },
  { canonical: "cream", en: "Cream", zh: "忌廉", aliases: ["heavy cream", "whipping cream", "淡忌廉"] },
  { canonical: "milk", en: "Milk", zh: "牛奶", aliases: ["全脂奶", "鮮奶"] },
  { canonical: "coconut milk", en: "Coconut milk", zh: "椰奶", aliases: ["椰漿"] },
  { canonical: "butter", en: "Butter", zh: "牛油", aliases: [] },
  { canonical: "flour", en: "Flour", zh: "麵粉", aliases: ["plain flour", "all-purpose flour", "低筋麵粉"] },
  { canonical: "tomato", en: "Tomato", zh: "番茄", aliases: ["tomatoes", "蕃茄", "西紅柿"] },
  { canonical: "potato", en: "Potato", zh: "薯仔", aliases: ["potatoes", "馬鈴薯", "土豆"] },
  { canonical: "carrot", en: "Carrot", zh: "甘筍", aliases: ["carrots", "紅蘿蔔", "胡蘿蔔"] },
  { canonical: "bok choy", en: "Bok choy", zh: "白菜", aliases: ["pak choi", "小白菜", "青菜"] },
  { canonical: "chili", en: "Chili", zh: "辣椒", aliases: ["chilli", "辣椒仔"] },
  { canonical: "cornstarch", en: "Cornstarch", zh: "生粉", aliases: ["corn starch", "粟粉", "鷹粟粉"] },
  { canonical: "shaoxing wine", en: "Shaoxing wine", zh: "紹興酒", aliases: ["cooking wine", "料酒", "花雕酒"] },
];

export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasCjk(s: string): boolean {
  return /[一-鿿]/.test(s);
}

// Normalized alias -> canonical key, built once at module load.
const aliasIndex: Map<string, string> = new Map();
for (const entry of INGREDIENT_DICTIONARY) {
  for (const term of [entry.canonical, entry.en, entry.zh, ...entry.aliases]) {
    aliasIndex.set(normalizeTerm(term), entry.canonical);
  }
}

/**
 * Resolve an English or Traditional Chinese label to a canonical key so the same
 * item written two ways merges into one grocery line. Exact match first, then a
 * conservative CJK substring match (handles "新鮮洋蔥"), else the normalized term.
 */
export function canonicalizeIngredient(raw: string): string {
  const norm = normalizeTerm(raw);
  const exact = aliasIndex.get(norm);
  if (exact) return exact;
  for (const [term, canonical] of aliasIndex.entries()) {
    if (hasCjk(term) && term.length >= 1 && norm.includes(term)) return canonical;
  }
  return norm;
}

export function dictionaryEntry(canonical: string): IngredientDictionaryEntry | undefined {
  return INGREDIENT_DICTIONARY.find((e) => e.canonical === canonical);
}
