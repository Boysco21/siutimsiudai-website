import {
  cattyToGrams,
  taelToGrams,
  gramsToCatty,
  gramsToTael,
  convertMass,
  toCanonical,
  displayInSystem,
} from "@/utils/unitConverter";
import { GRAMS_PER_CATTY, GRAMS_PER_TAEL, GRAMS_PER_POUND } from "@/constants/units";

describe("Hong Kong wet-market unit conversions", () => {
  test("1 catty equals 604.79 g (HK standard, not Mainland 500 g)", () => {
    expect(GRAMS_PER_CATTY).toBe(604.79);
    expect(cattyToGrams(1)).toBeCloseTo(604.79, 2);
  });

  test("1 tael equals 37.8 g", () => {
    expect(GRAMS_PER_TAEL).toBe(37.8);
    expect(taelToGrams(1)).toBeCloseTo(37.8, 2);
  });

  test("16 taels make 1 catty (within HK rounding)", () => {
    expect(taelToGrams(16)).toBeCloseTo(GRAMS_PER_CATTY, 0);
  });

  test("grams round-trip back to catty and tael", () => {
    expect(gramsToCatty(GRAMS_PER_CATTY)).toBeCloseTo(1, 6);
    expect(gramsToTael(GRAMS_PER_TAEL)).toBeCloseTo(1, 6);
  });

  test("convertMass catty to pound", () => {
    expect(convertMass(1, "catty", "lb")).toBeCloseTo(GRAMS_PER_CATTY / GRAMS_PER_POUND, 4);
  });

  test("toCanonical normalises catty to grams", () => {
    expect(toCanonical(2, "catty")).toEqual({ quantity: 1209.58, unit: "g" });
  });

  test("displayInSystem prefers catty for large masses", () => {
    const d = displayInSystem(1200, "g", "hk_market");
    expect(d.unit).toBe("catty");
    expect(d.quantity).toBeCloseTo(1.98, 1);
  });

  test("displayInSystem prefers tael for small masses", () => {
    const d = displayInSystem(75.6, "g", "hk_market");
    expect(d.unit).toBe("tael");
    expect(d.quantity).toBeCloseTo(2, 1);
  });
});
