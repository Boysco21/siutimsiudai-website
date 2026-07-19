import {
  emptyMicroTotals,
  sanitizeMicros,
  sumMicroTotals,
  TRACKED_MICRO_KEYS,
} from "@/utils/micros";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { parseRecipeResponse } from "@/services/recipeGenerationService";
import type { EntryMicronutrients } from "@/types";

// The premium micronutrient tracker. Everything here is pure or store-level so the two guarantees
// that matter — (1) untrusted numbers are sanitised, (2) the tracker is premium-only end to end —
// are provable without rendering the dashboard widget or booting the paywall.

describe("sanitizeMicros", () => {
  it("keeps known finite non-negative fields, rounded to 2dp", () => {
    expect(
      sanitizeMicros({ iron: 3.456, calcium: 120, potassium: 300, vitaminC: 12, vitaminD: 1.2 }),
    ).toEqual({ iron: 3.46, calcium: 120, potassium: 300, vitaminC: 12, vitaminD: 1.2 });
  });

  it("drops negatives, non-numbers and unknown keys (never trusts the model)", () => {
    expect(sanitizeMicros({ iron: -5, calcium: "lots", magnesium: 40, vitaminC: 9 })).toEqual({
      vitaminC: 9,
    });
  });

  it("returns undefined for non-objects or empty/unusable payloads", () => {
    expect(sanitizeMicros(null)).toBeUndefined();
    expect(sanitizeMicros("x")).toBeUndefined();
    expect(sanitizeMicros({})).toBeUndefined();
    expect(sanitizeMicros({ foo: 1 })).toBeUndefined();
  });

  it("retains sodium when present even though the tracker doesn't chart it", () => {
    expect(sanitizeMicros({ sodium: 480 })).toEqual({ sodium: 480 });
  });
});

describe("sumMicroTotals", () => {
  it("is all zero for no entries", () => {
    expect(sumMicroTotals([])).toEqual(emptyMicroTotals());
  });

  it("adds the five tracked micros across entries and ignores null / absent captures", () => {
    expect(
      sumMicroTotals([
        { micros: { iron: 2, calcium: 100, potassium: 200, vitaminC: 10, vitaminD: 1 } },
        { micros: null },
        { micros: { iron: 1, potassium: 50 } },
        {},
      ]),
    ).toEqual({ iron: 3, calcium: 100, potassium: 250, vitaminC: 10, vitaminD: 1 });
  });

  it("never folds sodium into the tracked totals", () => {
    const totals = sumMicroTotals([{ micros: { sodium: 999 } as EntryMicronutrients }]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
    expect(TRACKED_MICRO_KEYS).not.toContain("sodium" as never);
  });
});

// The gate that keeps the whole feature premium: micros are stripped at the save path for free
// users, so their running totals are structurally zero — no widget state can leak real figures.
describe("microTotalsForDate is premium-only by construction", () => {
  const DATE = "2026-07-12";
  const CAPTURE: EntryMicronutrients = {
    iron: 2,
    calcium: 50,
    potassium: 100,
    vitaminC: 5,
    vitaminD: 1,
  };

  beforeEach(() => {
    useNutritionStore.setState({ logsByDate: {} });
  });

  it("sums the captured micros for a paid user's logged meals", () => {
    useSubscriptionStore.setState({ activeTier: "pro" });
    useNutritionStore.getState().addEntry(
      {
        name: "Congee",
        nameZh: "粥",
        calories: 270,
        protein: 16,
        carbs: 40,
        fat: 5,
        mealType: "lunch",
        micros: CAPTURE,
      },
      DATE,
    );
    expect(useNutritionStore.getState().microTotalsForDate(DATE)).toEqual(CAPTURE);
  });

  it("stays all zero for a free user even when the meal carried micros", () => {
    useSubscriptionStore.setState({ activeTier: "free" });
    useNutritionStore.getState().addEntry(
      {
        name: "Congee",
        nameZh: "粥",
        calories: 270,
        protein: 16,
        carbs: 40,
        fat: 5,
        mealType: "lunch",
        micros: CAPTURE,
      },
      DATE,
    );
    expect(useNutritionStore.getState().microTotalsForDate(DATE)).toEqual(emptyMicroTotals());
  });
});

describe("parseRecipeResponse micros", () => {
  const base = {
    title: "Egg Bowl",
    titleZh: "蛋碗",
    ingredients: [{ name: "egg", nameZh: "蛋", quantity: 2, unit: "piece" }],
    steps: [{ stepNumber: 1, instruction: "cook", instructionZh: "煮" }],
  };

  it("sanitises the model's per-serving micro estimate onto the recipe", () => {
    const r = parseRecipeResponse({
      recipe: {
        ...base,
        micros: { iron: 2.5, calcium: 80, potassium: 210, vitaminC: 3, vitaminD: 1.1, magnesium: 99 },
      },
    });
    expect(r?.micros).toEqual({ iron: 2.5, calcium: 80, potassium: 210, vitaminC: 3, vitaminD: 1.1 });
  });

  it("omits micros entirely when the model returns none", () => {
    const r = parseRecipeResponse({ recipe: base });
    expect(r?.micros).toBeUndefined();
  });
});
