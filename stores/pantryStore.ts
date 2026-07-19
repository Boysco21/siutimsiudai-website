import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CanonicalUnit, PantryItem, Recipe } from "@/types";
import { canonicalizeIngredient } from "@/constants/ingredientDictionary";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";

const GUEST_USER = "guest";

export type NewPantryItemInput = Pick<PantryItem, "name" | "nameZh"> & {
  quantity?: number;
  unit?: CanonicalUnit;
  inStock?: boolean;
};

// A small starter pantry so the "cook now" highlight and grocery deduction have
// something to work with on first run. Some staples are tracked by amount, some are
// just flagged in-stock (quantity 0 = "I have this, no specific amount").
const SEED_PANTRY: Array<NewPantryItemInput> = [
  { name: "Egg", nameZh: "雞蛋", quantity: 10, unit: "piece", inStock: true },
  { name: "Soy sauce", nameZh: "豉油", quantity: 0, unit: "ml", inStock: true },
  { name: "Sugar", nameZh: "糖", quantity: 500, unit: "g", inStock: true },
  { name: "Spring onion", nameZh: "葱", quantity: 3, unit: "piece", inStock: true },
  { name: "Tomato", nameZh: "番茄", quantity: 4, unit: "piece", inStock: true },
  { name: "Pork", nameZh: "豬肉", quantity: 300, unit: "g", inStock: true },
  { name: "Rice", nameZh: "白米", quantity: 2000, unit: "g", inStock: true },
  { name: "Ginger", nameZh: "薑", quantity: 0, unit: "piece", inStock: false },
];

function makeItem(input: NewPantryItemInput): PantryItem {
  return {
    id: newId("pi"),
    userId: GUEST_USER,
    name: input.name,
    nameZh: input.nameZh,
    quantity: input.quantity ?? 0,
    unit: input.unit ?? "piece",
    inStock: input.inStock ?? true,
    updatedAt: new Date().toISOString(),
  };
}

interface PantryState {
  items: PantryItem[];
  seeded: boolean;

  seedIfEmpty: () => void;
  addItem: (input: NewPantryItemInput) => void;
  // Bulk insert (the AI scan -> review -> confirm flow lands a whole basket at once). Returns the
  // created rows so the caller can mirror them to Supabase without re-reading the store.
  addManyItems: (inputs: NewPantryItemInput[]) => PantryItem[];
  toggleInStock: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;

  // Recipes whose every ingredient maps to an in-stock pantry item (bilingual match).
  cookableRecipes: (recipes: Recipe[]) => Recipe[];
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
      items: [],
      seeded: false,

      seedIfEmpty: () => {
        if (get().seeded) return;
        set((state) =>
          state.items.length === 0
            ? { items: SEED_PANTRY.map(makeItem), seeded: true }
            : { seeded: true },
        );
      },

      addItem: (input) => set((state) => ({ items: [makeItem(input), ...state.items] })),

      addManyItems: (inputs) => {
        const created = inputs.map(makeItem);
        if (created.length === 0) return [];
        // Newest first, preserving the order the review screen showed them in.
        set((state) => ({ items: [...created, ...state.items] }));
        return created;
      },

      toggleInStock: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id
              ? { ...it, inStock: !it.inStock, updatedAt: new Date().toISOString() }
              : it,
          ),
        })),

      setQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id
              ? { ...it, quantity: Math.max(0, quantity), updatedAt: new Date().toISOString() }
              : it,
          ),
        })),

      removeItem: (id) => set((state) => ({ items: state.items.filter((it) => it.id !== id) })),

      cookableRecipes: (recipes) => {
        const inStock = new Set(
          get()
            .items.filter((it) => it.inStock)
            .map((it) => canonicalizeIngredient(it.name) || canonicalizeIngredient(it.nameZh)),
        );
        return recipes.filter((r) =>
          r.ingredients.every((ing) => {
            const key = canonicalizeIngredient(ing.name);
            const keyZh = canonicalizeIngredient(ing.nameZh);
            return inStock.has(key) || inStock.has(keyZh);
          }),
        );
      },
    }),
    {
      name: "siutimsiudai-pantry",
      storage: persistStorage,
      partialize: (s) => ({ items: s.items, seeded: s.seeded }),
      onRehydrateStorage: () => (state) => {
        state?.seedIfEmpty();
      },
    },
  ),
);
