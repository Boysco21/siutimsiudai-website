import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MealPlanEntry, MealType } from "@/types";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";

const GUEST_USER = "guest";

interface MealPlanState {
  entries: MealPlanEntry[];

  assign: (planDate: string, mealType: MealType, recipeId: string) => void;
  unassign: (id: string) => void;
  // Drop every assignment of a recipe, e.g. when that recipe is deleted, so the planner
  // never shows a dangling entry.
  unassignRecipe: (recipeId: string) => void;
  clearDay: (planDate: string) => void;

  forDate: (planDate: string) => MealPlanEntry[];
  forWeek: (dates: string[]) => MealPlanEntry[];
  // Distinct recipe ids planned across the given dates; feeds the grocery compiler.
  recipeIdsForWeek: (dates: string[]) => string[];
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      entries: [],

      assign: (planDate, mealType, recipeId) =>
        set((state) => {
          const duplicate = state.entries.some(
            (e) => e.planDate === planDate && e.mealType === mealType && e.recipeId === recipeId,
          );
          if (duplicate) return state;
          const entry: MealPlanEntry = {
            id: newId("mp"),
            userId: GUEST_USER,
            planDate,
            mealType,
            recipeId,
          };
          return { entries: [...state.entries, entry] };
        }),

      unassign: (id) => set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      unassignRecipe: (recipeId) =>
        set((state) => ({ entries: state.entries.filter((e) => e.recipeId !== recipeId) })),

      clearDay: (planDate) =>
        set((state) => ({ entries: state.entries.filter((e) => e.planDate !== planDate) })),

      forDate: (planDate) => get().entries.filter((e) => e.planDate === planDate),

      forWeek: (dates) => {
        const set7 = new Set(dates);
        return get().entries.filter((e) => set7.has(e.planDate));
      },

      recipeIdsForWeek: (dates) => {
        const set7 = new Set(dates);
        const ids = new Set<string>();
        for (const e of get().entries) {
          if (set7.has(e.planDate)) ids.add(e.recipeId);
        }
        return Array.from(ids);
      },
    }),
    {
      name: "siutimsiudai-meal-plan",
      storage: persistStorage,
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);
