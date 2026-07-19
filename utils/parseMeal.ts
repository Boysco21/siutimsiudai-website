import { MealType, ParsedMeal } from "@/types";
import { HK_DISHES } from "@/constants/hkDishes";

export function detectMealType(text: string): MealType {
  const t = text.toLowerCase();
  if (/朝早|早餐|breakfast|morning/.test(t)) return "breakfast";
  if (/午餐|晏晝|lunch|noon/.test(t)) return "lunch";
  if (/晚餐|夜晚|dinner|tonight|evening/.test(t)) return "dinner";
  if (/小食|宵夜|下午茶|snack|tea/.test(t)) return "snack";
  return "snack";
}

/**
 * Mock NLP for mixed English/Cantonese meal text. Matches dish keywords from the
 * curated HK dish list, e.g. "朝早食咗一碗麥片加 mixed berries" -> Cereal + Mixed Berries.
 * Pure and synchronous so it is unit-testable; the service layer wraps it async.
 */
export function parseMealText(text: string): ParsedMeal[] {
  if (!text.trim()) return [];
  const mealType = detectMealType(text);
  const lower = text.toLowerCase();
  const seen = new Set<string>();
  const meals: ParsedMeal[] = [];

  for (const dish of HK_DISHES) {
    const matched = dish.keywords.some((k) => lower.includes(k.toLowerCase()));
    if (matched && !seen.has(dish.name)) {
      seen.add(dish.name);
      meals.push({
        name: dish.name,
        nameZh: dish.nameZh,
        calories: dish.calories,
        protein: dish.protein,
        carbs: dish.carbs,
        fat: dish.fat,
        quantity: 1,
        unit: dish.portionLabel,
        mealType,
        micros: dish.micros,
      });
    }
  }
  return meals;
}
