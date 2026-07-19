import {
  classifyIngredientNature,
  reconcileToNature,
} from "@/utils/ingredientNature";

describe("classifyIngredientNature", () => {
  test("recognises common liquids in English and Chinese", () => {
    for (const name of [
      "water",
      "soy sauce",
      "olive oil",
      "sesame oil",
      "whole milk",
      "chicken stock",
      "rice vinegar",
      "shaoxing wine",
      "豉油",
      "麻油",
      "上湯",
      "牛奶",
      "紹興酒",
    ]) {
      expect(classifyIngredientNature(name)).toBe("liquid");
    }
  });

  test("recognises common solids in English and Chinese", () => {
    for (const name of ["flour", "caster sugar", "table salt", "butter", "麵粉", "冰糖", "鹽"]) {
      expect(classifyIngredientNature(name)).toBe("solid");
    }
  });

  test("solid signals beat a liquid keyword in the same name", () => {
    expect(classifyIngredientNature("milk powder")).toBe("solid");
    expect(classifyIngredientNature("coconut milk powder")).toBe("solid");
    expect(classifyIngredientNature("cream cheese")).toBe("solid");
    expect(classifyIngredientNature("奶粉")).toBe("solid");
    expect(classifyIngredientNature("忌廉芝士")).toBe("solid");
  });

  test("whole-word matching avoids false positives like 'boiled'", () => {
    expect(classifyIngredientNature("boiled egg")).toBe("unknown");
    expect(classifyIngredientNature("watercress")).toBe("unknown");
  });

  test("an ingredient it cannot place is unknown", () => {
    expect(classifyIngredientNature("chopped walnuts")).toBe("unknown");
  });
});

describe("reconcileToNature", () => {
  test("a liquid written by weight flips to millilitres (1:1)", () => {
    expect(reconcileToNature("milk", "g", { quantity: 250, unit: "g" })).toEqual({
      quantity: 250,
      unit: "ml",
    });
  });

  test("a solid written by volume flips to grams (1:1)", () => {
    expect(reconcileToNature("flour", "cup", { quantity: 360, unit: "ml" })).toEqual({
      quantity: 360,
      unit: "g",
    });
  });

  test("an unknown ingredient scooped by spoon/cup is read as a dry good", () => {
    expect(reconcileToNature("curry paste", "tbsp", { quantity: 15, unit: "ml" })).toEqual({
      quantity: 15,
      unit: "g",
    });
  });

  test("a liquid already in a volume unit is left alone", () => {
    expect(reconcileToNature("milk", "cup", { quantity: 240, unit: "ml" })).toEqual({
      quantity: 240,
      unit: "ml",
    });
  });

  test("a solid already weighed is left alone", () => {
    expect(reconcileToNature("beef mince", "g", { quantity: 500, unit: "g" })).toEqual({
      quantity: 500,
      unit: "g",
    });
  });

  test("an unknown weighed ingredient is trusted as grams", () => {
    expect(reconcileToNature("mystery item", "g", { quantity: 100, unit: "g" })).toEqual({
      quantity: 100,
      unit: "g",
    });
  });

  test("counts (pieces) are never converted", () => {
    expect(reconcileToNature("egg", "piece", { quantity: 3, unit: "piece" })).toEqual({
      quantity: 3,
      unit: "piece",
    });
  });
});
