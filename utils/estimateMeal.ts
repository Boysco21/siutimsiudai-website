import { MealType, ParsedMeal } from "@/types";
import { COMMON_FOODS } from "@/constants/commonFoods";
import { detectMealType, parseMealText } from "./parseMeal";

// Title-case a free-text description for a tidy display name on the generic fallback.
function titleCase(text: string): string {
  return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

// A believable single-serving guess for a description the mock cannot place. A real AI would do
// better; this just keeps the offline estimator from ever dead-ending on a genuine food. Micros
// are a light, neutral profile so the tracker still gets non-empty numbers.
function genericEstimate(text: string, mealType: MealType): ParsedMeal {
  const clean = text.trim();
  return {
    name: titleCase(clean),
    nameZh: clean,
    calories: 180,
    protein: 6,
    carbs: 22,
    fat: 7,
    quantity: 1,
    unit: "1 serving",
    mealType,
    micros: { iron: 1, calcium: 40, potassium: 150, vitaminC: 3, vitaminD: 0.2 },
  };
}

/**
 * The logging AI's estimator (mock). Layers three tiers so any real food resolves offline:
 *   1. Curated HK dishes (exact keyword match, the same set the free known-dish check uses).
 *   2. Everyday common foods (fruit, protein, staples, dairy...) so "kiwi" or "chicken" estimate.
 *   3. A generic single-serving guess, so a novel description never dead-ends.
 *
 * Returns [] only for blank input. Pure and synchronous so it stays unit-testable; the service
 * layer (nlpMealService) wraps it async, and a real provider swaps in by replacing that one file.
 */
export function estimateMealText(text: string): ParsedMeal[] {
  if (!text.trim()) return [];

  // 1) Curated HK dishes take priority (exact, and free elsewhere via matchKnownDish).
  const known = parseMealText(text);
  if (known.length) return known;

  // 2) Everyday common foods.
  const mealType = detectMealType(text);
  const lower = text.toLowerCase();
  const seen = new Set<string>();
  const matches: ParsedMeal[] = [];
  for (const food of COMMON_FOODS) {
    const hit = food.keywords.some((k) => lower.includes(k.toLowerCase()));
    if (hit && !seen.has(food.name)) {
      seen.add(food.name);
      matches.push({
        name: food.name,
        nameZh: food.nameZh,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        quantity: 1,
        unit: food.portionLabel,
        mealType,
        micros: food.micros,
      });
    }
  }
  if (matches.length) return matches;

  // 3) Nothing recognised: a generic estimate rather than a miss.
  return [genericEstimate(text, mealType)];
}
