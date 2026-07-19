import { MealType, ParsedMeal } from "@/types";
import { detectMealType } from "@/utils/parseMeal";
import { estimateMealText } from "@/utils/estimateMeal";
import { sanitizeMicros } from "@/utils/micros";
import { isSupabaseConfigured, supabase } from "./supabase";
import { delay } from "./util";

// The logging AI: turns a free meal description ("朝早食咗一碗麥片加 mixed berries") into estimated
// foods with macros + micros. Two layers, exactly like pantryVisionService / recipeGenerationService:
//
//   1. Live: a Supabase Edge Function ("estimate-meal") holds the Google Cloud service account
//      SERVER-SIDE and asks Vertex AI (Gemini) to estimate the meal. The billable credential never
//      ships client-side, so it can't be pulled off a device the way an EXPO_PUBLIC_ key could. See
//      supabase/functions/estimate-meal/index.ts.
//   2. Fallback: an on-device three-tier mock (estimateMealText: HK dishes -> common foods ->
//      generic) used whenever Supabase is not configured (Expo Go, web, tests) or the call fails, so
//      the whole log flow stays demoable and testable with no key.
//
// Swapping AI providers is a server-only change (edit the Edge Function); this interface and every
// AI-backed tab (voice, smart manual) stay put.

export interface NlpMealService {
  // Handles code-switched input, e.g. "朝早食咗一碗麥片加 mixed berries".
  parse(text: string): Promise<ParsedMeal[]>;
}

const ESTIMATE_FN = "estimate-meal";
const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack"];

// --- Response validation (live path) --------------------------------------------------------
// A model can return almost anything; we sanitise every field before it reaches the log. Macros are
// clamped to finite, non-negative numbers; the meal type is clamped to our enum (falling back to the
// one detected from the text); micros run through the same sanitiseMicros used everywhere else.

function toNonNegative(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function toMeal(raw: unknown, fallbackMealType: MealType): ParsedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const nameZh = typeof r.nameZh === "string" ? r.nameZh.trim() : "";
  if (!name && !nameZh) return null; // a food we can't label is useless in the log
  const q = Number(r.quantity);
  const micros = sanitizeMicros(r.micros);
  return {
    name: name || nameZh,
    nameZh: nameZh || name,
    calories: toNonNegative(r.calories),
    protein: toNonNegative(r.protein),
    carbs: toNonNegative(r.carbs),
    fat: toNonNegative(r.fat),
    quantity: Number.isFinite(q) && q > 0 ? q : 1,
    unit: typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : "1 serving",
    mealType: MEAL_TYPES.includes(r.mealType as MealType) ? (r.mealType as MealType) : fallbackMealType,
    ...(micros ? { micros } : {}),
  };
}

// Parse and sanitise the Edge Function payload. Returns null (not throw) when the payload is
// malformed (no `meals` array) so the caller falls back to the local mock.
export function parseMealResponse(data: unknown, fallbackMealType: MealType): ParsedMeal[] | null {
  const meals = (data as { meals?: unknown })?.meals;
  if (!Array.isArray(meals)) return null;
  return meals.map((m) => toMeal(m, fallbackMealType)).filter((x): x is ParsedMeal => x !== null);
}

async function estimateViaProxy(text: string, fallbackMealType: MealType): Promise<ParsedMeal[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<{ meals?: unknown }>(ESTIMATE_FN, {
    body: { text },
  });
  if (error) return null;
  return parseMealResponse(data, fallbackMealType);
}

export const nlpMealService: NlpMealService = {
  async parse(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];

    // Secure live path first, on-device mock as a graceful fallback. An empty remote result (the
    // model found nothing) also falls through to the mock, whose generic tier guarantees logging
    // never dead-ends on a real description.
    if (isSupabaseConfigured) {
      const mealType = detectMealType(trimmed);
      const remote = await estimateViaProxy(trimmed, mealType).catch(() => null);
      if (remote && remote.length > 0) return remote;
    }

    await delay(450); // exercise the "estimating" state in mock mode
    return estimateMealText(trimmed);
  },
};
