import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MealType, SavedMeal } from "@/types";
import { HK_DISHES } from "@/constants/hkDishes";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";

const GUEST_USER = "guest";

export type NewSavedMealInput = Pick<
  SavedMeal,
  "name" | "nameZh" | "calories" | "protein" | "carbs" | "fat"
> & { defaultMealType?: MealType };

// A few common cha-chaan-teng picks so the one-tap quick-add row is useful immediately.
const SEED_NAMES: { name: string; mealType: MealType }[] = [
  { name: "HK Milk Tea", mealType: "snack" },
  { name: "Pineapple Bun", mealType: "breakfast" },
  { name: "Wonton Noodles", mealType: "lunch" },
];

interface SavedMealsState {
  meals: SavedMeal[];
  seeded: boolean;

  seedIfEmpty: () => void;
  saveMeal: (input: NewSavedMealInput) => void;
  markUsed: (id: string) => void;
  removeMeal: (id: string) => void;

  // Most-used first, then most-recent. Powers the one-tap quick-repeat row.
  topMeals: (limit?: number) => SavedMeal[];
}

function seedMeal(name: string, mealType: MealType): SavedMeal | null {
  const dish = HK_DISHES.find((d) => d.name === name);
  if (!dish) return null;
  return {
    id: newId("sm"),
    userId: GUEST_USER,
    name: dish.name,
    nameZh: dish.nameZh,
    calories: dish.calories,
    protein: dish.protein,
    carbs: dish.carbs,
    fat: dish.fat,
    defaultMealType: mealType,
    useCount: 0,
    lastUsedAt: null,
  };
}

export const useSavedMealsStore = create<SavedMealsState>()(
  persist(
    (set, get) => ({
      meals: [],
      seeded: false,

      seedIfEmpty: () => {
        if (get().seeded) return;
        set((state) => {
          if (state.meals.length > 0) return { seeded: true };
          const seeded = SEED_NAMES.map((s) => seedMeal(s.name, s.mealType)).filter(
            (m): m is SavedMeal => m !== null,
          );
          return { meals: seeded, seeded: true };
        });
      },

      saveMeal: (input) =>
        set((state) => {
          const meal: SavedMeal = {
            id: newId("sm"),
            userId: GUEST_USER,
            name: input.name,
            nameZh: input.nameZh,
            calories: input.calories,
            protein: input.protein,
            carbs: input.carbs,
            fat: input.fat,
            defaultMealType: input.defaultMealType ?? "snack",
            useCount: 0,
            lastUsedAt: null,
          };
          return { meals: [meal, ...state.meals] };
        }),

      markUsed: (id) =>
        set((state) => ({
          meals: state.meals.map((m) =>
            m.id === id
              ? { ...m, useCount: m.useCount + 1, lastUsedAt: new Date().toISOString() }
              : m,
          ),
        })),

      removeMeal: (id) => set((state) => ({ meals: state.meals.filter((m) => m.id !== id) })),

      topMeals: (limit = 6) =>
        [...get().meals]
          .sort((a, b) => {
            if (b.useCount !== a.useCount) return b.useCount - a.useCount;
            return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
          })
          .slice(0, limit),
    }),
    {
      name: "siutimsiudai-saved-meals",
      storage: persistStorage,
      partialize: (s) => ({ meals: s.meals, seeded: s.seeded }),
      onRehydrateStorage: () => (state) => {
        state?.seedIfEmpty();
      },
    },
  ),
);
