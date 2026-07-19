// Cut the Supabase import chain so these stay pure, offline unit tests: the validator under test
// never touches the network, and forcing mock mode keeps it hermetic and fast.
jest.mock("@/services/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

import { parseMealResponse } from "@/services/nlpMealService";

// The logging AI's trust boundary lives in parseMealResponse: the estimate-meal Edge Function (or a
// tampered proxy) can return anything, so every field is validated and sanitised before it can reach
// the food log. Proving that here means the log never has to trust the model.

describe("parseMealResponse", () => {
  it("returns null only when the payload is malformed (no meals array)", () => {
    expect(parseMealResponse(null, "lunch")).toBeNull();
    expect(parseMealResponse({}, "lunch")).toBeNull();
    expect(parseMealResponse({ meals: "not-an-array" }, "lunch")).toBeNull();
  });

  it("treats a well-formed empty result as a real answer ([]), not a failure", () => {
    expect(parseMealResponse({ meals: [] }, "lunch")).toEqual([]);
  });

  it("drops rows with no usable name in either language", () => {
    const meals = parseMealResponse(
      {
        meals: [
          { name: "Kiwi", nameZh: "奇異果", calories: 45, protein: 1, carbs: 11, fat: 0 },
          { name: "   ", nameZh: "" },
          { calories: 90 },
        ],
      },
      "snack",
    );
    expect(meals).toHaveLength(1);
    expect(meals?.[0].name).toBe("Kiwi");
  });

  it("clamps negative / non-numeric macros to 0 and rounds the rest", () => {
    const meals = parseMealResponse(
      { meals: [{ name: "Mystery", nameZh: "神秘", calories: "-50", protein: "abc", carbs: 22.6, fat: 7.2 }] },
      "dinner",
    );
    expect(meals?.[0]).toMatchObject({ calories: 0, protein: 0, carbs: 23, fat: 7 });
  });

  it("falls back to the detected meal type when the model's is missing or invalid", () => {
    const meals = parseMealResponse(
      {
        meals: [
          { name: "Toast", nameZh: "多士", calories: 90, mealType: "brunch" },
          { name: "Egg", nameZh: "蛋", calories: 70, mealType: "breakfast" },
        ],
      },
      "lunch",
    );
    expect(meals?.[0].mealType).toBe("lunch"); // "brunch" is not in our enum -> fallback
    expect(meals?.[1].mealType).toBe("breakfast"); // a valid one is honoured
  });

  it("defaults a missing quantity/unit and sanitises micros through the shared helper", () => {
    const meals = parseMealResponse(
      {
        meals: [
          {
            nameZh: "雞胸肉",
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 4,
            quantity: 0, // bad -> default 1
            micros: { iron: 1, vitaminC: -3, junk: 999 }, // negative + unknown fields dropped
          },
        ],
      },
      "lunch",
    );
    const meal = meals?.[0];
    expect(meal).toMatchObject({ name: "雞胸肉", nameZh: "雞胸肉", quantity: 1, unit: "1 serving" });
    expect(meal?.micros).toEqual({ iron: 1 });
  });

  it("omits micros entirely when the model returns nothing usable", () => {
    const meals = parseMealResponse(
      { meals: [{ name: "Water", nameZh: "水", calories: 0, micros: {} }] },
      "snack",
    );
    expect(meals?.[0].micros).toBeUndefined();
  });
});
