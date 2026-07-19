import { healthySwapService } from "@/services/healthySwapService";
import { RecipeIngredient } from "@/types";

// Supabase is not configured under Jest, so the server-side AI fallback is skipped and the
// service resolves purely from the curated map. That keeps these assertions deterministic.
function ing(partial: Partial<RecipeIngredient> & { id: string; name: string }): RecipeIngredient {
  return {
    recipeId: "r1",
    nameZh: "",
    quantity: 100,
    unit: "g",
    displayUnit: "g",
    rawText: partial.name,
    substitutedFrom: null,
    ...partial,
  };
}

describe("healthy swap engine (curated path)", () => {
  test("rewrites the user's named examples with adjusted ratios", async () => {
    const swaps = await healthySwapService.suggest([
      ing({ id: "a", name: "Heavy cream" }),
      ing({ id: "b", name: "Butter" }),
      ing({ id: "c", name: "White rice" }),
      ing({ id: "d", name: "Egg" }), // no healthier swap -> omitted
    ]);

    const byId = Object.fromEntries(swaps.map((s) => [s.ingredientId, s]));
    expect(swaps).toHaveLength(3);

    expect(byId.a.substitute).toBe("Greek yogurt");
    expect(byId.a.quantityRatio).toBe(1);
    expect(byId.a.source).toBe("curated");

    // Butter -> olive oil uses about three-quarters the amount: the quantity adjusts, not just the name.
    expect(byId.b.substitute).toBe("Olive oil");
    expect(byId.b.quantityRatio).toBe(0.75);

    expect(byId.c.substitute).toBe("Cauliflower rice");

    expect(byId.d).toBeUndefined();
  });

  test("resolves a swap from the Chinese name when the English label is unknown", async () => {
    const swaps = await healthySwapService.suggest([
      ing({ id: "x", name: "Some house blend", nameZh: "牛油" }), // 牛油 = butter
    ]);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].substitute).toBe("Olive oil");
  });

  test("returns nothing when no ingredient has a healthier option", async () => {
    const swaps = await healthySwapService.suggest([ing({ id: "e", name: "Egg" })]);
    expect(swaps).toEqual([]);
  });
});
