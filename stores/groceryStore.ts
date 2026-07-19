import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GroceryList, PantryItem, Recipe } from "@/types";
import { mergeIngredients, MergeInput } from "@/utils/groceryMerge";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";

const GUEST_USER = "guest";

interface GroceryState {
  // One active list at a time keeps the UX simple; shared/household lists are out of scope.
  list: GroceryList | null;

  compileFromRecipes: (recipeIds: string[], recipes: Recipe[], pantry: PantryItem[]) => void;
  toggleItem: (itemId: string) => void;
  setItemChecked: (itemId: string, checked: boolean) => void;
  clear: () => void;

  uncheckedCount: () => number;
}

export const useGroceryStore = create<GroceryState>()(
  persist(
    (set, get) => ({
      list: null,

      compileFromRecipes: (recipeIds, recipes, pantry) => {
        const selected = recipes.filter((r) => recipeIds.includes(r.id));
        const inputs: MergeInput[] = [];
        for (const recipe of selected) {
          for (const ing of recipe.ingredients) {
            inputs.push({
              ingredient: {
                name: ing.name,
                nameZh: ing.nameZh,
                quantity: ing.quantity,
                unit: ing.unit,
                displayUnit: ing.displayUnit,
              },
              recipeId: recipe.id,
            });
          }
        }
        const listId = newId("gl");
        const items = mergeIngredients(inputs, pantry, listId);
        const list: GroceryList = {
          id: listId,
          userId: GUEST_USER,
          name: "Grocery list",
          recipeIds: selected.map((r) => r.id),
          items,
          createdAt: new Date().toISOString(),
        };
        set({ list });
      },

      toggleItem: (itemId) =>
        set((state) => {
          if (!state.list) return state;
          return {
            list: {
              ...state.list,
              items: state.list.items.map((it) =>
                it.id === itemId ? { ...it, checked: !it.checked } : it,
              ),
            },
          };
        }),

      setItemChecked: (itemId, checked) =>
        set((state) => {
          if (!state.list) return state;
          return {
            list: {
              ...state.list,
              items: state.list.items.map((it) =>
                it.id === itemId ? { ...it, checked } : it,
              ),
            },
          };
        }),

      clear: () => set({ list: null }),

      uncheckedCount: () => (get().list?.items.filter((it) => !it.checked).length ?? 0),
    }),
    {
      name: "siutimsiudai-grocery",
      storage: persistStorage,
      partialize: (s) => ({ list: s.list }),
    },
  ),
);
