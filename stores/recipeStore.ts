import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HealthySwap, Recipe, RecipeIngredient, RecipeSourceType, StructuredRecipe, Substitution } from "@/types";
import { SAMPLE_RECIPES } from "@/constants/sampleRecipes";
import { translationService } from "@/services/translationService";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";

const GUEST_USER = "guest";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Replace every occurrence of `from` with `to` without treating `from` as a regex.
function replaceAll(haystack: string, from: string, to: string): string {
  if (!from) return haystack;
  return haystack.split(from).join(to);
}

interface RecipeState {
  recipes: Recipe[];
  seeded: boolean;

  seedIfEmpty: () => void;
  addRecipe: (structured: StructuredRecipe, sourceType: RecipeSourceType) => Recipe;
  removeRecipe: (id: string) => void;
  scaleServings: (recipeId: string, targetServings: number) => void;
  applySubstitution: (recipeId: string, ingredientId: string, sub: Substitution) => void;
  applyHealthySwaps: (recipeId: string, swaps: HealthySwap[]) => void;
  revertHealthySwaps: (recipeId: string) => void;
  translateRecipeToZh: (id: string) => Promise<void>;

  getRecipe: (id: string) => Recipe | undefined;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      seeded: false,

      seedIfEmpty: () => {
        if (get().seeded) return;
        set((state) =>
          state.recipes.length === 0
            ? { recipes: SAMPLE_RECIPES, seeded: true }
            : { seeded: true },
        );
      },

      addRecipe: (structured, sourceType) => {
        const recipeId = newId("recipe");
        const recipe: Recipe = {
          id: recipeId,
          userId: GUEST_USER,
          title: structured.title,
          titleZh: structured.titleZh,
          servings: structured.servings,
          sourceType,
          sourceUrl: structured.sourceUrl,
          imageUri: null,
          totalMinutes: structured.totalMinutes,
          createdAt: new Date().toISOString(),
          ingredients: structured.ingredients.map((ing) => ({
            ...ing,
            id: newId("ri"),
            recipeId,
          })),
          steps: structured.steps.map((st) => ({
            ...st,
            id: newId("rs"),
            recipeId,
          })),
        };
        set((state) => ({ recipes: [recipe, ...state.recipes] }));
        return recipe;
      },

      removeRecipe: (id) => set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) })),

      // Scale stored ingredient quantities proportionally and persist the new serving count.
      scaleServings: (recipeId, targetServings) =>
        set((state) => {
          if (targetServings < 1) return state;
          return {
            recipes: state.recipes.map((r) => {
              if (r.id !== recipeId || r.servings === targetServings) return r;
              const factor = targetServings / r.servings;
              return {
                ...r,
                servings: targetServings,
                ingredients: r.ingredients.map((ing) => ({
                  ...ing,
                  quantity: round2(ing.quantity * factor),
                })),
                // Keep the revert snapshot in step with scaling so toggling back to the
                // original after a scale change does not silently undo the new serving count.
                healthySnapshot: r.healthySnapshot
                  ? {
                      ...r.healthySnapshot,
                      ingredients: r.healthySnapshot.ingredients.map((ing) => ({
                        ...ing,
                        quantity: round2(ing.quantity * factor),
                      })),
                    }
                  : r.healthySnapshot,
              };
            }),
          };
        }),

      // Swap an ingredient for its substitute and patch the affected step text so the
      // instructions stay coherent (e.g. "cream" -> "evaporated milk").
      applySubstitution: (recipeId, ingredientId, sub) =>
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== recipeId) return r;
            const ingredients: RecipeIngredient[] = r.ingredients.map((ing) =>
              ing.id === ingredientId
                ? {
                    ...ing,
                    substitutedFrom: ing.name,
                    name: sub.substitute,
                    nameZh: sub.substituteZh,
                  }
                : ing,
            );
            const steps = r.steps.map((st) => ({
              ...st,
              instruction: replaceAll(st.instruction, sub.original, sub.substitute),
              instructionZh: replaceAll(st.instructionZh, sub.originalZh, sub.substituteZh),
            }));
            return { ...r, ingredients, steps };
          }),
        })),

      // Hybrid healthy-swap: apply every swap at once, snapshot the originals for revert,
      // adjust each quantity by its ratio, and patch step text so the instructions match.
      applyHealthySwaps: (recipeId, swaps) =>
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== recipeId || swaps.length === 0) return r;
            const snapshot =
              r.healthyApplied && r.healthySnapshot
                ? r.healthySnapshot
                : { ingredients: r.ingredients, steps: r.steps };
            const byId = new Map(swaps.map((s) => [s.ingredientId, s]));
            const ingredients: RecipeIngredient[] = r.ingredients.map((ing) => {
              const s = byId.get(ing.id);
              if (!s) return ing;
              return {
                ...ing,
                substitutedFrom: ing.substitutedFrom ?? ing.name,
                name: s.substitute,
                nameZh: s.substituteZh,
                quantity: round2(ing.quantity * s.quantityRatio),
              };
            });
            let steps = r.steps;
            for (const s of swaps) {
              steps = steps.map((st) => ({
                ...st,
                instruction: replaceAll(st.instruction, s.original, s.substitute),
                instructionZh: replaceAll(st.instructionZh, s.originalZh, s.substituteZh),
              }));
            }
            return { ...r, ingredients, steps, healthyApplied: true, healthySnapshot: snapshot };
          }),
        })),

      // Restore the pre-healthy snapshot so nothing the user tweaked is lost.
      revertHealthySwaps: (recipeId) =>
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== recipeId || !r.healthyApplied || !r.healthySnapshot) return r;
            return {
              ...r,
              ingredients: r.healthySnapshot.ingredients,
              steps: r.healthySnapshot.steps,
              healthyApplied: false,
              healthySnapshot: null,
            };
          }),
        })),

      // Lazily render a URL-imported recipe into Traditional Chinese via translationService and
      // cache the result on the recipe. Skips anything already translated, non-URL recipes (manual
      // and OCR entries are authored bilingually at capture), and missing ids, so it is safe to
      // fire on every locale switch. The batch is built title -> ingredients -> steps and the
      // translated slices are re-applied in that exact order, with a per-field fallback to the
      // original English if the provider ever returns a short array.
      translateRecipeToZh: async (id) => {
        const recipe = get().recipes.find((r) => r.id === id);
        if (!recipe || recipe.zhTranslated || recipe.sourceType !== "url") return;
        const sources = [
          recipe.title,
          ...recipe.ingredients.map((i) => i.name),
          ...recipe.steps.map((s) => s.instruction),
        ];
        const translated = await translationService.translateBatch(sources, "zh-Hant");
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== id) return r;
            let k = 0;
            const titleZh = translated[k++] ?? r.title;
            const ingredients = r.ingredients.map((ing) => ({
              ...ing,
              nameZh: translated[k++] ?? ing.name,
            }));
            const steps = r.steps.map((st) => ({
              ...st,
              instructionZh: translated[k++] ?? st.instruction,
            }));
            return { ...r, titleZh, ingredients, steps, zhTranslated: true };
          }),
        }));
      },

      getRecipe: (id) => get().recipes.find((r) => r.id === id),
    }),
    {
      name: "siutimsiudai-recipes",
      storage: persistStorage,
      partialize: (s) => ({ recipes: s.recipes, seeded: s.seeded }),
      onRehydrateStorage: () => (state) => {
        // First ever launch (nothing persisted yet) still needs the demo recipes.
        state?.seedIfEmpty();
      },
    },
  ),
);
