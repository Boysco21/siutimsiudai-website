import { HealthySwap, RecipeIngredient } from "@/types";
import { canonicalizeIngredient, dictionaryEntry } from "@/constants/ingredientDictionary";
import { supabase } from "./supabase";
import { delay } from "./util";

export interface HealthySwapService {
  // One-tap "make it healthy" for a whole recipe. Hybrid engine: a curated, HK-friendly
  // healthy-swap map runs first, then a server-side AI fallback (a Supabase Edge Function that
  // holds the AI credential and calls Gemini for us) covers ingredients the map does not know.
  // No API key ships in the app bundle; when Supabase is not configured (Expo Go, web, tests) or
  // the proxy fails, the fallback returns nothing and the app still works offline on the curated
  // set alone. Ingredients with no healthier swap are omitted from the result.
  suggest(ingredients: RecipeIngredient[]): Promise<HealthySwap[]>;
}

interface HealthyTemplate {
  en: string;
  zh: string;
  ratio: number; // substitute quantity / original quantity
  reason: string;
  reasonZh: string;
}

// Keyed by canonical ingredient key (see ingredientDictionary.canonicalizeIngredient).
// Ratios adjust the amount, not just the name: butter -> olive oil uses about 3/4 as much.
const HEALTHY_SWAPS: Record<string, HealthyTemplate> = {
  cream: { en: "Greek yogurt", zh: "希臘乳酪", ratio: 1, reason: "Same creaminess, far less saturated fat.", reasonZh: "同樣香滑，飽和脂肪大減。" },
  butter: { en: "Olive oil", zh: "橄欖油", ratio: 0.75, reason: "Heart-healthy fat; use about a quarter less.", reasonZh: "護心好油，用少約四分一。" },
  rice: { en: "Cauliflower rice", zh: "椰菜花飯", ratio: 1, reason: "A fraction of the carbs and calories.", reasonZh: "碳水同熱量大幅減少。" },
  sugar: { en: "Monk fruit sweetener", zh: "羅漢果糖", ratio: 1, reason: "Sweetness with near-zero calories.", reasonZh: "有甜味但近乎零卡。" },
  "coconut milk": { en: "Light coconut milk", zh: "低脂椰奶", ratio: 1, reason: "Same aroma, about half the fat.", reasonZh: "同樣椰香，脂肪減約一半。" },
  "soy sauce": { en: "Low-sodium soy sauce", zh: "低鈉生抽", ratio: 1, reason: "Cuts sodium without losing savour.", reasonZh: "減鈉但保留鮮味。" },
  "dark soy sauce": { en: "Low-sodium dark soy sauce", zh: "低鈉老抽", ratio: 1, reason: "Same colour, less sodium.", reasonZh: "同樣上色，鈉更低。" },
  "oyster sauce": { en: "Reduced-sodium oyster sauce", zh: "減鈉蠔油", ratio: 1, reason: "Keeps the umami, trims the salt.", reasonZh: "保留鮮味，減少鹽份。" },
  chicken: { en: "Skinless chicken breast", zh: "去皮雞胸", ratio: 1, reason: "Leaner cut, less saturated fat.", reasonZh: "更瘦，飽和脂肪較少。" },
  pork: { en: "Lean minced pork", zh: "瘦免治豬肉", ratio: 1, reason: "Less fat than belly or regular mince.", reasonZh: "比五花或普通免治少脂。" },
  beef: { en: "Lean beef", zh: "瘦牛肉", ratio: 1, reason: "Trims the saturated fat.", reasonZh: "減少飽和脂肪。" },
  flour: { en: "Wholemeal flour", zh: "全麥麵粉", ratio: 1, reason: "More fibre than white flour.", reasonZh: "纖維比白麵粉多。" },
  milk: { en: "Low-fat milk", zh: "低脂奶", ratio: 1, reason: "Same protein, less fat.", reasonZh: "蛋白質不變，脂肪減少。" },
};

// Resolve an ingredient to a curated key, trying its English label then its Chinese one.
function curatedKey(ing: RecipeIngredient): string | null {
  const byEn = canonicalizeIngredient(ing.name);
  if (HEALTHY_SWAPS[byEn]) return byEn;
  if (ing.nameZh) {
    const byZh = canonicalizeIngredient(ing.nameZh);
    if (HEALTHY_SWAPS[byZh]) return byZh;
  }
  return null;
}

function curatedSwapFor(ing: RecipeIngredient): HealthySwap | null {
  const canonical = curatedKey(ing);
  if (!canonical) return null;
  const tpl = HEALTHY_SWAPS[canonical];
  return {
    ingredientId: ing.id,
    original: ing.name,
    originalZh: ing.nameZh || dictionaryEntry(canonical)?.zh || "",
    substitute: tpl.en,
    substituteZh: tpl.zh,
    quantityRatio: tpl.ratio,
    reason: tpl.reason,
    reasonZh: tpl.reasonZh,
    source: "curated",
  };
}

// --- Server-side AI fallback (the "hybrid" long tail) ---
// The curated map covers common swaps offline. For anything it does not know, we ask a Supabase
// Edge Function (healthy-swap) that holds the AI credential SERVER-SIDE and calls Gemini on our
// behalf. No key ever ships in the client bundle — an EXPO_PUBLIC_ key would be extractable from
// the JS, so there is none. Returns [] on any failure (not configured, offline, non-2xx, bad
// shape) so the result degrades cleanly to the curated set. See supabase/functions/healthy-swap.
const HEALTHY_SWAP_FN = "healthy-swap";

// Rejoin the proxy's raw rows to the ingredients we sent. The server echoes a 1-based `index` into
// that list, so each row picks its ingredient back up here and the ids never leave the device.
// Rows that are malformed, out of range, or missing a substitute are skipped.
function swapsFromProxy(raw: unknown, ingredients: RecipeIngredient[]): HealthySwap[] {
  if (!Array.isArray(raw)) return [];
  const out: HealthySwap[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const index = typeof o.index === "number" ? o.index - 1 : -1;
    const ing = ingredients[index];
    const substitute = typeof o.substitute === "string" ? o.substitute.trim() : "";
    if (!ing || !substitute) continue;
    const ratio =
      typeof o.quantityRatio === "number" && o.quantityRatio > 0 ? o.quantityRatio : 1;
    out.push({
      ingredientId: ing.id,
      original: ing.name,
      originalZh: ing.nameZh,
      substitute,
      substituteZh:
        typeof o.substituteZh === "string" && o.substituteZh ? o.substituteZh : substitute,
      quantityRatio: ratio,
      reason: typeof o.reason === "string" ? o.reason : "",
      reasonZh: typeof o.reasonZh === "string" ? o.reasonZh : "",
      source: "ai",
    });
  }
  return out;
}

// Send only the ingredient labels (name + nameZh) the curated pass could not place. Guarded on
// `supabase` so Expo Go / web / jest — where it is null — never touch the network and fall straight
// through to the curated set alone.
async function aiSwapsFor(ingredients: RecipeIngredient[]): Promise<HealthySwap[]> {
  if (!supabase || ingredients.length === 0) return [];
  try {
    const { data, error } = await supabase.functions.invoke<{ swaps?: unknown }>(HEALTHY_SWAP_FN, {
      body: { ingredients: ingredients.map((ing) => ({ name: ing.name, nameZh: ing.nameZh })) },
    });
    if (error || !data) return [];
    return swapsFromProxy(data.swaps, ingredients);
  } catch {
    return [];
  }
}

export const healthySwapService: HealthySwapService = {
  async suggest(ingredients) {
    await delay(500);
    const curated: HealthySwap[] = [];
    const unmatched: RecipeIngredient[] = [];
    for (const ing of ingredients) {
      const swap = curatedSwapFor(ing);
      if (swap) curated.push(swap);
      else unmatched.push(ing);
    }
    const ai = await aiSwapsFor(unmatched);
    return [...curated, ...ai];
  },
};
