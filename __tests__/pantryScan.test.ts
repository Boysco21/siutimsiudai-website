// Cut the Supabase import chain so these stay pure, offline unit tests: the helpers under test
// never touch the network, and forcing mock mode keeps them hermetic and fast.
jest.mock("@/services/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

import { mockScan, parseScanResponse } from "@/services/pantryVisionService";
import {
  buildGenericRecipe,
  parseRecipeResponse,
  RecipeSeedIngredient,
} from "@/services/recipeGenerationService";

// The AI pantry scanner's trust boundary lives in these pure functions: a model (or a tampered
// proxy) can return anything, so every row is validated and sanitised before it can reach the
// review screen or the recipe store. Proving that here means the UI never has to.

describe("parseScanResponse", () => {
  it("returns null only when the payload is malformed (no items array)", () => {
    expect(parseScanResponse(null)).toBeNull();
    expect(parseScanResponse({})).toBeNull();
    expect(parseScanResponse({ items: "not-an-array" })).toBeNull();
  });

  it("treats a well-formed empty result as a real answer ([]), not a failure", () => {
    // This is what stops a genuine 'saw nothing' from being papered over with mock data in prod.
    expect(parseScanResponse({ items: [] })).toEqual([]);
  });

  it("drops rows with no usable name in either language", () => {
    const rows = parseScanResponse({
      items: [
        { name: "Egg", nameZh: "雞蛋", quantity: 6, unit: "piece" },
        { name: "   ", nameZh: "" },
        { quantity: 3, unit: "g" },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows?.[0].name).toBe("Egg");
  });

  it("clamps the unit to our enum and coerces a bad quantity to 0", () => {
    const rows = parseScanResponse({ items: [{ name: "Milk", unit: "bucket", quantity: "-3" }] });
    expect(rows?.[0]).toMatchObject({ name: "Milk", nameZh: "Milk", unit: "piece", quantity: 0 });
    expect(rows?.[0].confidence).toBeUndefined();
  });

  it("fills a missing name side from the other and clamps confidence into 0..1", () => {
    const rows = parseScanResponse({
      items: [{ nameZh: "豉油", unit: "ml", quantity: 200, confidence: 5 }],
    });
    expect(rows?.[0]).toEqual({ name: "豉油", nameZh: "豉油", unit: "ml", quantity: 200, confidence: 1 });
  });
});

describe("mockScan", () => {
  it("returns a non-empty list of fully-formed, bilingual ingredients", () => {
    const items = mockScan();
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.name.length).toBeGreaterThan(0);
      expect(it.nameZh.length).toBeGreaterThan(0);
      expect(["g", "ml", "piece"]).toContain(it.unit);
      expect(it.quantity).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("buildGenericRecipe", () => {
  const seeds: RecipeSeedIngredient[] = [
    { name: "Egg", nameZh: "雞蛋", quantity: 6, unit: "piece" },
    { name: "Tomato", nameZh: "番茄" }, // no quantity/unit -> sensible defaults
  ];

  it("uses ONLY the ingredients it was given (never invents a main ingredient)", () => {
    const recipe = buildGenericRecipe(seeds);
    const allowed = new Set(seeds.map((s) => s.name));
    expect(recipe.ingredients).toHaveLength(2);
    for (const ing of recipe.ingredients) {
      expect(allowed.has(ing.name)).toBe(true);
      expect(ing.substitutedFrom).toBeNull();
    }
  });

  it("carries a provided quantity/unit through and defaults a missing one to 1 piece", () => {
    const recipe = buildGenericRecipe(seeds);
    const egg = recipe.ingredients.find((i) => i.name === "Egg");
    const tomato = recipe.ingredients.find((i) => i.name === "Tomato");
    expect(egg).toMatchObject({ quantity: 6, unit: "piece" });
    expect(tomato).toMatchObject({ quantity: 1, unit: "piece" });
  });

  it("produces a bilingual, numbered, functional method", () => {
    const recipe = buildGenericRecipe(seeds);
    expect(recipe.title.length).toBeGreaterThan(0);
    expect(recipe.titleZh.length).toBeGreaterThan(0);
    expect(recipe.sourceUrl).toBeNull();
    expect(recipe.steps.length).toBeGreaterThan(0);
    recipe.steps.forEach((s, i) => {
      expect(s.stepNumber).toBe(i + 1);
      expect(s.instruction.length).toBeGreaterThan(0);
      expect(s.instructionZh.length).toBeGreaterThan(0);
    });
  });

  it("still returns a usable scaffold when handed no ingredients", () => {
    const recipe = buildGenericRecipe([]);
    expect(recipe.ingredients).toHaveLength(0);
    expect(recipe.steps.length).toBeGreaterThan(0);
    expect(recipe.title.length).toBeGreaterThan(0);
  });

  it("picks ONE compatible lane and never fries breakfast items into a savoury dish", () => {
    // The bug this locks in: a pantry with dinner + breakfast items used to force all of them into a
    // single "stir-fry cocoa, yogurt, berries and pork" dish. A real cook picks a lane.
    const recipe = buildGenericRecipe([
      { name: "Pork", nameZh: "豬肉", quantity: 300, unit: "g" },
      { name: "Tomato", nameZh: "番茄", quantity: 2, unit: "piece" },
      { name: "Soy sauce", nameZh: "豉油", quantity: 30, unit: "ml" },
      { name: "Spring onion", nameZh: "蔥", quantity: 2, unit: "piece" },
      { name: "Cocoa powder", nameZh: "可可粉", quantity: 100, unit: "g" },
      { name: "Blueberries", nameZh: "藍莓", quantity: 50, unit: "g" },
      { name: "Yogurt", nameZh: "乳酪", quantity: 200, unit: "g" },
    ]);
    const names = recipe.ingredients.map((i) => i.name);
    // Cooks the savoury lane...
    expect(names).toEqual(expect.arrayContaining(["Pork", "Tomato"]));
    // ...and leaves every breakfast item behind, out of both the ingredient list and the method.
    expect(names).not.toContain("Cocoa powder");
    expect(names).not.toContain("Blueberries");
    expect(names).not.toContain("Yogurt");
    const method = recipe.steps.map((s) => `${s.instruction} ${s.instructionZh}`).join(" ").toLowerCase();
    expect(method).not.toMatch(/cocoa|blueberr|yogurt|可可|藍莓|乳酪/);
    // Names itself after real stars, not seasonings.
    expect(recipe.title).toMatch(/Pork|Tomato/);
  });

  it("cooks the sweet lane (no-cook bowl) when the whole pantry is breakfast items", () => {
    const seeds: RecipeSeedIngredient[] = [
      { name: "Yogurt", nameZh: "乳酪", quantity: 200, unit: "g" },
      { name: "Blueberries", nameZh: "藍莓", quantity: 60, unit: "g" },
      { name: "Honey", nameZh: "蜂蜜", quantity: 20, unit: "ml" },
    ];
    const recipe = buildGenericRecipe(seeds);
    const allowed = new Set(seeds.map((s) => s.name));
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    for (const ing of recipe.ingredients) expect(allowed.has(ing.name)).toBe(true);
    // A bowl, not a stir-fry, and quick.
    expect(recipe.title.toLowerCase()).toContain("bowl");
    expect(recipe.totalMinutes).toBeLessThan(20);
  });
});

describe("parseRecipeResponse", () => {
  it("returns null when the recipe is missing, malformed, or has no ingredients/steps", () => {
    expect(parseRecipeResponse(null)).toBeNull();
    expect(parseRecipeResponse({})).toBeNull();
    expect(parseRecipeResponse({ recipe: { title: "X", ingredients: [], steps: [] } })).toBeNull();
    expect(
      parseRecipeResponse({
        recipe: { title: "X", ingredients: [{ name: "Egg" }], steps: [] },
      }),
    ).toBeNull();
  });

  it("sanitises a valid recipe: forces sourceUrl null, fills defaults, renumbers safely", () => {
    const recipe = parseRecipeResponse({
      recipe: {
        title: "Tomato Egg",
        titleZh: "番茄炒蛋",
        servings: "abc", // bad -> default 2
        sourceUrl: "https://evil.example", // must be dropped to null
        ingredients: [{ name: "Egg", nameZh: "蛋", quantity: 2, unit: "piece" }],
        steps: [{ stepNumber: 9, instruction: "Fry", instructionZh: "炒" }],
      },
    });
    expect(recipe).not.toBeNull();
    expect(recipe?.servings).toBe(2);
    expect(recipe?.totalMinutes).toBe(20);
    expect(recipe?.sourceUrl).toBeNull();
    expect(recipe?.ingredients[0]).toMatchObject({
      name: "Egg",
      nameZh: "蛋",
      quantity: 2,
      unit: "piece",
      displayUnit: "piece",
      substitutedFrom: null,
    });
    expect(recipe?.steps[0]).toMatchObject({
      stepNumber: 1,
      instruction: "Fry",
      imageUri: null,
      durationSeconds: null,
    });
  });
});
