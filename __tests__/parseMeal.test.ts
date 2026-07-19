import { parseMealText } from "@/utils/parseMeal";

describe("bilingual meal text parsing", () => {
  test("parses a code-switched Cantonese + English sentence", () => {
    const meals = parseMealText("朝早食咗一碗麥片加 mixed berries");
    const names = meals.map((m) => m.name).sort();
    expect(names).toEqual(["Cereal", "Mixed Berries"]);
    expect(meals.every((m) => m.mealType === "breakfast")).toBe(true);
  });

  test("returns empty for blank input", () => {
    expect(parseMealText("   ")).toEqual([]);
  });

  test("attaches the dish's micronutrient estimate so meal-log AI feeds the tracker", () => {
    const [cereal] = parseMealText("had cereal");
    expect(cereal.micros).toBeDefined();
    // Fortified cereal is the iron standout in the dish table.
    expect(cereal.micros?.iron).toBe(4.5);
    expect(cereal.micros?.potassium).toBeGreaterThan(0);
  });

  test("detects a single dish by its English keyword", () => {
    const meals = parseMealText("had wonton noodles for lunch");
    expect(meals.map((m) => m.name)).toContain("Wonton Noodles");
    expect(meals[0].mealType).toBe("lunch");
  });
});
