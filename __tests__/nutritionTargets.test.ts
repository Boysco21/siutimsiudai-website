import {
  computeNutritionTargets,
  micronutrientTargets,
  mifflinStJeorBmr,
  normalizeHealthProfile,
} from "@/utils/nutritionTargets";
import { HealthProfile } from "@/types";

const MALE: HealthProfile = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};

const FEMALE: HealthProfile = {
  sex: "female",
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activityLevel: "moderate",
  goal: "maintain",
};

describe("nutritionTargets: BMR (Mifflin-St Jeor)", () => {
  test("male uses the +5 constant", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(mifflinStJeorBmr(MALE)).toBe(1780);
  });

  test("female uses the -161 constant", () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25 -> 1320
    expect(mifflinStJeorBmr(FEMALE)).toBe(1320);
  });
});

describe("nutritionTargets: energy and macros", () => {
  const t = computeNutritionTargets(MALE);

  test("scales BMR by activity to maintenance energy", () => {
    expect(t.bmr).toBe(1780);
    expect(t.tdee).toBe(2759); // 1780 * 1.55
    expect(t.calories).toBe(2760); // maintain, rounded to nearest 10
  });

  test("protein tracks body weight and activity", () => {
    expect(t.protein).toBe(128); // 80kg * 1.6 g/kg (moderate)
  });

  test("macro calories reconcile to the calorie budget", () => {
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(fromMacros - t.calories)).toBeLessThanOrEqual(10);
  });

  test("fibre scales with energy", () => {
    expect(t.fiber).toBe(39); // 2760/1000 * 14
  });
});

describe("nutritionTargets: goal direction", () => {
  test("lose < maintain < gain for the same body", () => {
    const lose = computeNutritionTargets({ ...MALE, goal: "lose" }).calories;
    const maintain = computeNutritionTargets({ ...MALE, goal: "maintain" }).calories;
    const gain = computeNutritionTargets({ ...MALE, goal: "gain" }).calories;
    expect(lose).toBeLessThan(maintain);
    expect(maintain).toBeLessThan(gain);
  });
});

describe("nutritionTargets: micronutrients", () => {
  const get = (list: ReturnType<typeof micronutrientTargets>, key: string) =>
    list.find((m) => m.key === key)!;

  test("iron and vitamin C differ by sex", () => {
    const men = micronutrientTargets("male", 30);
    const women = micronutrientTargets("female", 30);
    expect(get(men, "iron").amount).toBe(8);
    expect(get(women, "iron").amount).toBe(18);
    expect(get(men, "vitaminC").amount).toBe(90);
    expect(get(women, "vitaminC").amount).toBe(75);
  });

  test("potassium follows the sex-based adequate intake", () => {
    expect(get(micronutrientTargets("male", 30), "potassium").amount).toBe(3400);
    expect(get(micronutrientTargets("female", 30), "potassium").amount).toBe(2600);
  });

  test("the five tracked micros are all present as reachable floors", () => {
    const list = micronutrientTargets("female", 30);
    for (const key of ["iron", "calcium", "potassium", "vitaminC", "vitaminD"]) {
      const m = get(list, key);
      expect(m.amount).toBeGreaterThan(0);
      expect(m.isLimit).toBe(false);
    }
  });

  test("calcium rises with age band for women 51+", () => {
    expect(get(micronutrientTargets("female", 40), "calcium").amount).toBe(1000);
    expect(get(micronutrientTargets("female", 55), "calcium").amount).toBe(1200);
    expect(get(micronutrientTargets("male", 55), "calcium").amount).toBe(1000);
    expect(get(micronutrientTargets("male", 75), "calcium").amount).toBe(1200);
  });

  test("sodium is a ceiling, not a floor", () => {
    const sodium = get(micronutrientTargets("male", 30), "sodium");
    expect(sodium.amount).toBe(2000);
    expect(sodium.isLimit).toBe(true);
  });

  test("fibre in the micro list matches the computed macro fibre", () => {
    const t = computeNutritionTargets(MALE);
    const fibreMicro = t.micros.find((m) => m.key === "fiber")!;
    expect(fibreMicro.amount).toBe(t.fiber);
  });
});

describe("nutritionTargets: input safety", () => {
  test("absurd inputs are clamped before use", () => {
    const p = normalizeHealthProfile({
      sex: "male",
      age: 5,
      heightCm: 9000,
      weightKg: 999,
      activityLevel: "sedentary",
      goal: "maintain",
    });
    expect(p.age).toBe(13);
    expect(p.heightCm).toBe(250);
    expect(p.weightKg).toBe(300);
  });

  test("computed targets stay finite and positive for clamped input", () => {
    const t = computeNutritionTargets({
      sex: "female",
      age: 0,
      heightCm: 0,
      weightKg: 0,
      activityLevel: "sedentary",
      goal: "lose",
    });
    expect(t.calories).toBeGreaterThan(0);
    expect(t.protein).toBeGreaterThan(0);
    expect(t.carbs).toBeGreaterThanOrEqual(0);
    expect(t.fat).toBeGreaterThan(0);
  });
});
