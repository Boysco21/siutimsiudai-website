// Rough daily nutrient needs from a user's body metrics. Everything here is pure and
// unit-tested. The numbers are estimates for general guidance, not medical advice.
//
// Energy uses the Mifflin-St Jeor equation (the current clinical standard for predicting
// resting metabolic rate), scaled by an activity factor to maintenance energy (TDEE) and
// then by a goal factor. Macros split the calorie budget; micros are age/sex references
// drawn from NIH RDAs, with the WHO 2 g/day sodium ceiling (a good fit for the HK market).

import {
  ActivityLevel,
  HealthProfile,
  MicronutrientTarget,
  NutritionTargets,
  Sex,
  WeightGoal,
} from "@/types";

// Multiplier on BMR for typical weekly movement, sedentary through athlete.
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Nudge maintenance energy for the chosen direction: a gentle 15% cut or 10% surplus.
const GOAL_FACTORS: Record<WeightGoal, number> = {
  lose: 0.85,
  maintain: 1,
  gain: 1.1,
};

// Grams of protein per kg of body weight, rising with training load.
const PROTEIN_PER_KG: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.4,
  moderate: 1.6,
  active: 1.8,
  very_active: 2,
};

const FAT_CALORIE_SHARE = 0.27; // ~27% of energy from fat, mid of the healthy range
const FIBER_PER_1000_KCAL = 14; // US Dietary Guidelines reference

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

// Sanitize raw inputs so a stray keystroke can't produce absurd targets.
export function normalizeHealthProfile(profile: HealthProfile): HealthProfile {
  return {
    sex: profile.sex,
    age: Math.round(clamp(profile.age, 13, 100)),
    heightCm: Math.round(clamp(profile.heightCm, 100, 250)),
    weightKg: Math.round(clamp(profile.weightKg, 25, 300)),
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  };
}

// Mifflin-St Jeor basal metabolic rate in kcal/day.
export function mifflinStJeorBmr(profile: HealthProfile): number {
  const { weightKg, heightCm, age, sex } = normalizeHealthProfile(profile);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

// Curated daily micronutrient references. Floors to reach, except sodium which is a ceiling.
// Values vary by sex and, where the RDA does, by age band.
export function micronutrientTargets(sex: Sex, age: number): MicronutrientTarget[] {
  const a = clamp(age, 13, 100);

  const calcium = a >= 71 || (sex === "female" && a >= 51) ? 1200 : 1000;
  const iron = sex === "female" && a <= 50 ? 18 : 8;
  const potassium = sex === "male" ? 3400 : 2600; // NIH adequate intake, adults
  const vitaminC = sex === "male" ? 90 : 75;
  const vitaminD = a >= 71 ? 20 : 15;

  return [
    { key: "sodium", label: "Sodium", labelZh: "鈉", amount: 2000, unit: "mg", isLimit: true },
    { key: "fiber", label: "Fibre", labelZh: "纖維", amount: 0, unit: "g", isLimit: false }, // filled by caller from calories
    { key: "calcium", label: "Calcium", labelZh: "鈣", amount: calcium, unit: "mg", isLimit: false },
    { key: "iron", label: "Iron", labelZh: "鐵", amount: iron, unit: "mg", isLimit: false },
    { key: "potassium", label: "Potassium", labelZh: "鉀", amount: potassium, unit: "mg", isLimit: false },
    { key: "vitaminC", label: "Vitamin C", labelZh: "維他命C", amount: vitaminC, unit: "mg", isLimit: false },
    { key: "vitaminD", label: "Vitamin D", labelZh: "維他命D", amount: vitaminD, unit: "mcg", isLimit: false },
  ];
}

// The headline function: body metrics in, full daily target set out.
export function computeNutritionTargets(profile: HealthProfile): NutritionTargets {
  const p = normalizeHealthProfile(profile);
  const bmr = mifflinStJeorBmr(p);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[p.activityLevel]);
  const calories = round10(tdee * GOAL_FACTORS[p.goal]);

  const protein = Math.round(p.weightKg * PROTEIN_PER_KG[p.activityLevel]);
  const fat = Math.round((calories * FAT_CALORIE_SHARE) / 9);
  // Carbs take whatever calories are left after protein (4 kcal/g) and fat (9 kcal/g).
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * FIBER_PER_1000_KCAL);

  const micros = micronutrientTargets(p.sex, p.age).map((m) =>
    m.key === "fiber" ? { ...m, amount: fiber } : m,
  );

  return { calories, protein, carbs, fat, fiber, bmr, tdee, micros };
}
