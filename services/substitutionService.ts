import { Substitution } from "@/types";
import { canonicalizeIngredient, dictionaryEntry } from "@/constants/ingredientDictionary";
import { delay } from "./util";

export interface SubstitutionService {
  // HK-supermarket-accessible swaps. `context` (e.g. the recipe title) is accepted for
  // future ranking; the mock ignores it. The recipe store patches step text on apply.
  suggest(ingredientName: string, ingredientNameZh?: string, context?: string): Promise<Substitution[]>;
}

interface SwapTemplate {
  en: string;
  zh: string;
  ratio: string;
  note: string;
  noteZh: string;
}

// Keyed by canonical ingredient key (see ingredientDictionary.canonicalizeIngredient).
const SWAPS: Record<string, SwapTemplate[]> = {
  cream: [
    { en: "Evaporated milk", zh: "淡奶", ratio: "1:1", note: "Lighter, common in cha chaan teng cooking.", noteZh: "較輕盈，茶餐廳常用。" },
  ],
  butter: [
    { en: "Vegetable oil", zh: "植物油", ratio: "1:0.8", note: "Use a little less; skip for flavour-led bakes.", noteZh: "用少一點；講求牛油味嘅焗物則不宜。" },
  ],
  "coconut milk": [
    { en: "Evaporated milk", zh: "淡奶", ratio: "1:1", note: "Loses coconut aroma but keeps the richness.", noteZh: "冇椰香但同樣香濃。" },
  ],
  "shaoxing wine": [
    { en: "Dry sherry", zh: "雪利酒", ratio: "1:1", note: "Closest substitute; or use water for alcohol-free.", noteZh: "最接近；想無酒可用水代替。" },
  ],
  "dark soy sauce": [
    { en: "Light soy sauce + sugar", zh: "生抽加糖", ratio: "1:1", note: "Add a pinch of sugar for colour and body.", noteZh: "加少許糖補色補味。" },
  ],
  "oyster sauce": [
    { en: "Light soy sauce + sugar", zh: "生抽加糖", ratio: "1:1", note: "Vegetarian-friendly; slightly less savoury.", noteZh: "適合素食；鮮味略減。" },
  ],
  cornstarch: [
    { en: "Potato starch", zh: "薯粉", ratio: "1:1", note: "Same thickening power.", noteZh: "勾芡力相若。" },
  ],
  "spring onion": [
    { en: "Chives", zh: "韭菜", ratio: "1:1", note: "Milder; add at the end.", noteZh: "味較淡，最後落。" },
  ],
};

function originalZhFor(canonical: string, fallback: string | undefined): string {
  return fallback || dictionaryEntry(canonical)?.zh || "";
}

export const substitutionService: SubstitutionService = {
  async suggest(ingredientName, ingredientNameZh) {
    await delay(400);
    const canonical = canonicalizeIngredient(ingredientName);
    const templates =
      SWAPS[canonical] ?? (ingredientNameZh ? SWAPS[canonicalizeIngredient(ingredientNameZh)] : undefined);
    if (!templates || templates.length === 0) return [];
    const originalZh = originalZhFor(canonical, ingredientNameZh);
    return templates.map((t) => ({
      original: ingredientName,
      originalZh,
      substitute: t.en,
      substituteZh: t.zh,
      ratio: t.ratio,
      note: t.note,
      noteZh: t.noteZh,
    }));
  },
};
