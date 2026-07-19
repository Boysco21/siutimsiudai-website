import { MacroNutrients, MealCustomization } from "@/types";

// 少甜 / 少底 order tweaks. Each one shaves a fixed macro amount off a logged item, the way a
// cha chaan teng waiter adjusts an order. Numbers are deliberate, rounded HK estimates:
// - less_sugar (少甜): drops the ~2 tsp of sugar in a sweetened drink or dessert.
// - less_rice (少底): halves a rice base under a 碟頭飯 style dish.
// Deltas are negative and applied on read, so toggling on and off is perfectly reversible.
export const CUSTOMIZATION_DELTAS: Record<MealCustomization, MacroNutrients> = {
  less_sugar: { calories: -45, protein: 0, carbs: -11, fat: 0 },
  less_rice: { calories: -140, protein: -3, carbs: -30, fat: -1 },
};

// Order the toggles render in.
export const ALL_CUSTOMIZATIONS: MealCustomization[] = ["less_sugar", "less_rice"];

// Macros for a base item after its active tweaks are applied. Never returns a negative
// field, so tweaking a small item can't push it below zero.
export function effectiveMacros(
  base: MacroNutrients,
  active: MealCustomization[] | undefined,
): MacroNutrients {
  const result: MacroNutrients = {
    calories: base.calories,
    protein: base.protein,
    carbs: base.carbs,
    fat: base.fat,
  };
  for (const key of active ?? []) {
    const d = CUSTOMIZATION_DELTAS[key];
    result.calories += d.calories;
    result.protein += d.protein;
    result.carbs += d.carbs;
    result.fat += d.fat;
  }
  return {
    calories: Math.max(0, Math.round(result.calories)),
    protein: Math.max(0, Math.round(result.protein)),
    carbs: Math.max(0, Math.round(result.carbs)),
    fat: Math.max(0, Math.round(result.fat)),
  };
}

// The kcal a set of tweaks removes from a base item (a positive number for display, e.g.
// "-45 kcal"). Used to caption the toggles.
export function customizationSavings(
  base: MacroNutrients,
  active: MealCustomization[] | undefined,
): number {
  return base.calories - effectiveMacros(base, active).calories;
}
