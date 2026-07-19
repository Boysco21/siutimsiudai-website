// Shared helpers for the premium micronutrient tracker. The app follows five high-value daily
// micronutrients — iron, calcium, potassium, vitamin C and vitamin D — against the user's
// personalised targets. These pure helpers are the single source of truth for WHICH micros the
// tracker charts, how an untrusted payload (a Gemini estimate, a future label parse) is sanitised
// into EntryMicronutrients, and how a day's entries roll up into running totals. Kept free of
// React and stores so the policy is unit-testable in isolation.

import { EntryMicronutrients } from "@/types";

// The five nutrients the daily tracker surfaces, in display order. Sodium (a ceiling) and fibre
// (a macro, already in the macro drawer) are deliberately excluded: the brief is to focus on a few
// high-value floors, not every line on a label.
export type TrackedMicroKey = "iron" | "calcium" | "potassium" | "vitaminC" | "vitaminD";

export const TRACKED_MICRO_KEYS: readonly TrackedMicroKey[] = [
  "iron",
  "calcium",
  "potassium",
  "vitaminC",
  "vitaminD",
];

// Display name (EN/zh) and unit for each tracked micro. Mirrors the labels in nutritionTargets so
// UI that charts a micro (e.g. the history micro-trend toggle) can label it without a health
// profile, while the goal amount still comes from the computed targets.
export const TRACKED_MICRO_META: Record<
  TrackedMicroKey,
  { label: string; labelZh: string; unit: string }
> = {
  iron: { label: "Iron", labelZh: "鐵", unit: "mg" },
  calcium: { label: "Calcium", labelZh: "鈣", unit: "mg" },
  potassium: { label: "Potassium", labelZh: "鉀", unit: "mg" },
  vitaminC: { label: "Vitamin C", labelZh: "維他命C", unit: "mg" },
  vitaminD: { label: "Vitamin D", labelZh: "維他命D", unit: "mcg" },
};

// Every numeric field EntryMicronutrients may carry. Sodium is retained when a source provides it
// (e.g. a nutrition label) even though the tracker doesn't chart it, so no captured datum is lost.
const MICRO_FIELDS: readonly (keyof EntryMicronutrients)[] = [
  "sodium",
  "calcium",
  "iron",
  "potassium",
  "vitaminC",
  "vitaminD",
];

// Coerce an untrusted object (a Gemini recipe payload, a future label parse) into a clean
// EntryMicronutrients: keep only known, finite, non-negative numbers, rounded to 2 dp. Returns
// undefined when nothing usable is present so callers can omit the field entirely rather than
// store an empty husk. Never trusts the model — the same discipline as the recipe/ingredient
// sanitisers.
export function sanitizeMicros(raw: unknown): EntryMicronutrients | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: EntryMicronutrients = {};
  for (const key of MICRO_FIELDS) {
    const n = Number(r[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.round(n * 100) / 100;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Running totals of the five tracked micros for a set of logged entries. Micros are NOT touched by
// 少甜 / 少底 customizations (those only adjust macros), so this is a straight sum of stored values.
// Free-tier entries never carry micros (dropped at the save path, see retainMicrosForTier), so a
// free user's totals are all zero — the calculation is premium-only by construction.
export type MicroTotals = Record<TrackedMicroKey, number>;

export function emptyMicroTotals(): MicroTotals {
  return { iron: 0, calcium: 0, potassium: 0, vitaminC: 0, vitaminD: 0 };
}

export function sumMicroTotals(
  entries: ReadonlyArray<{ micros?: EntryMicronutrients | null }>,
): MicroTotals {
  const totals = emptyMicroTotals();
  for (const entry of entries) {
    const m = entry.micros;
    if (!m) continue;
    for (const key of TRACKED_MICRO_KEYS) totals[key] += m[key] ?? 0;
  }
  return totals;
}
