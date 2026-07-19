// The logging AI's offline estimator. Free known-dish matching stays in parseMealText; this is the
// metered AI path, so it must resolve ANY real food (not just the curated HK list) and never
// dead-end. Pure and synchronous, so no service/clock mocking is needed.
import { estimateMealText } from "@/utils/estimateMeal";

describe("estimateMealText", () => {
  it("returns nothing for blank input", () => {
    expect(estimateMealText("   ")).toEqual([]);
  });

  it("prioritises a curated HK dish over the common-food table", () => {
    const meals = estimateMealText("had wonton noodles for lunch");
    expect(meals.map((m) => m.name)).toContain("Wonton Noodles");
    expect(meals[0].mealType).toBe("lunch");
  });

  it("estimates an everyday food that is not an HK dish (the kiwi case)", () => {
    const [kiwi] = estimateMealText("kiwi");
    expect(kiwi.name).toBe("Kiwi");
    expect(kiwi.calories).toBe(45);
    // Kiwi is a vitamin C standout, so the tracker gets a real micro number.
    expect(kiwi.micros?.vitaminC).toBeGreaterThan(50);
  });

  it("matches common foods by their Chinese name too", () => {
    const [chicken] = estimateMealText("食咗雞胸肉");
    expect(chicken.name).toBe("Chicken Breast");
    expect(chicken.protein).toBe(31);
  });

  it("falls back to a generic single-serving estimate rather than missing", () => {
    const result = estimateMealText("zzxq blorp");
    expect(result).toHaveLength(1);
    expect(result[0].calories).toBeGreaterThan(0);
    // The user's text becomes a tidy display name, and micros are still populated.
    expect(result[0].name).toBe("Zzxq Blorp");
    expect(result[0].micros).toBeDefined();
  });
});
