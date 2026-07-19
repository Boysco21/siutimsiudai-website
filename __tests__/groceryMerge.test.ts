import { mergeIngredients, MergeInput } from "@/utils/groceryMerge";
import { CanonicalUnit, PantryItem } from "@/types";

function ing(
  name: string,
  nameZh: string,
  quantity: number,
  unit: CanonicalUnit,
  recipeId: string,
): MergeInput {
  return { ingredient: { name, nameZh, quantity, unit, displayUnit: unit }, recipeId };
}

describe("bilingual grocery merge", () => {
  test("English and Chinese names for the same item collapse into one line", () => {
    const items = mergeIngredients(
      [ing("Onion", "洋蔥", 2, "piece", "r1"), ing("洋蔥", "洋蔥", 1, "piece", "r2")],
      [],
    );
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(3);
    expect(items[0].sourceRecipeIds.sort()).toEqual(["r1", "r2"]);
    expect(items[0].mergedFrom).toContain("Onion");
    expect(items[0].mergedFrom).toContain("洋蔥");
  });

  test("items in stock are deducted and pre-checked", () => {
    const pantry: PantryItem[] = [
      {
        id: "p1",
        userId: "u",
        name: "Onion",
        nameZh: "洋蔥",
        quantity: 0,
        unit: "piece",
        inStock: true,
        updatedAt: "",
      },
    ];
    const items = mergeIngredients([ing("Onion", "洋蔥", 2, "piece", "r1")], pantry);
    expect(items[0].inPantry).toBe(true);
    expect(items[0].checked).toBe(true);
    expect(items[0].quantity).toBe(0);
  });

  test("partial pantry stock reduces the remaining quantity", () => {
    const pantry: PantryItem[] = [
      {
        id: "p1",
        userId: "u",
        name: "Rice",
        nameZh: "白米",
        quantity: 200,
        unit: "g",
        inStock: true,
        updatedAt: "",
      },
    ];
    const items = mergeIngredients([ing("Rice", "白米", 500, "g", "r1")], pantry);
    expect(items[0].quantity).toBe(300);
    expect(items[0].checked).toBe(false);
  });

  test("the same item in different units does not merge", () => {
    const items = mergeIngredients(
      [ing("Rice", "白米", 500, "g", "r1"), ing("Rice", "白米", 2, "piece", "r2")],
      [],
    );
    expect(items.length).toBe(2);
  });
});
