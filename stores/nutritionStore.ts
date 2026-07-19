import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DailyLog,
  EntryMicronutrients,
  FoodEntry,
  HealthProfile,
  LogSource,
  MacroNutrients,
  MealCustomization,
  MealType,
  NutritionTargets,
} from "@/types";
import { todayKey } from "@/utils/formatters";
import { effectiveMacros } from "@/utils/customizations";
import { computeNutritionTargets } from "@/utils/nutritionTargets";
import { MicroTotals, sumMicroTotals } from "@/utils/micros";
import { newId } from "@/utils/id";
import { persistStorage } from "./persistStorage";
import { isPaidTier, SubscriptionTier, useSubscriptionStore } from "./useSubscriptionStore";

const GUEST_USER = "guest";

export interface NewFoodEntryInput extends MacroNutrients {
  name: string;
  nameZh: string;
  mealType: MealType;
  quantity?: number;
  unit?: string;
  source?: LogSource;
  imageUri?: string | null;
  barcode?: string | null;
  // Optional per-meal vitamins & minerals. Gated on save: kept for paid tiers, dropped for free.
  micros?: EntryMicronutrients | null;
}

// Premium policy at the single daily-log save path: only paid tiers keep per-meal micronutrients
// in history; free users store macros + calories only, so their micros are dropped to null. Pure
// and exported so the gate can be unit-tested without a store. A no-op in practice until a logging
// flow actually captures micros, but codifying it here means free micro history can never leak in.
export function retainMicrosForTier(
  tier: SubscriptionTier,
  micros: EntryMicronutrients | null | undefined,
): EntryMicronutrients | null {
  return isPaidTier(tier) ? micros ?? null : null;
}

const EMPTY_TOTALS: MacroNutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };

interface NutritionState {
  logsByDate: Record<string, DailyLog>;
  dailyCalorieTarget: number;
  // Body metrics the user entered, or null before they set them up. Drives the macro and
  // micro targets and, on save, the calorie target too.
  healthProfile: HealthProfile | null;

  addEntry: (input: NewFoodEntryInput, date?: string) => void;
  editEntry: (date: string, entryId: string, patch: Partial<FoodEntry>) => void;
  removeEntry: (date: string, entryId: string) => void;
  // Tick 少甜 / 少底 on a logged item on or off. Reversible: the base macros are untouched.
  toggleCustomization: (date: string, entryId: string, customization: MealCustomization) => void;
  repeatMeal: (meal: NewFoodEntryInput, date?: string) => void;
  setCalorieTarget: (target: number) => void;
  setHealthProfile: (profile: HealthProfile) => void;
  clearHealthProfile: () => void;

  entriesForDate: (date: string) => FoodEntry[];
  totalsForDate: (date: string) => MacroNutrients;
  // Running totals of the five premium micronutrients for the day. Free-tier entries never carry
  // micros (dropped at the save path), so their totals are all zero — this is premium-only by
  // construction, matching the gated tracker widget.
  microTotalsForDate: (date: string) => MicroTotals;
  remainingForDate: (date: string) => number;
  // Full computed target set, or null when no health profile has been entered yet.
  targets: () => NutritionTargets | null;
}

function ensureLog(logs: Record<string, DailyLog>, date: string): DailyLog {
  const existing = logs[date];
  if (existing) return existing;
  return { id: newId("log"), userId: GUEST_USER, logDate: date, entries: [] };
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      logsByDate: {},
      dailyCalorieTarget: 2000,
      healthProfile: null,

      addEntry: (input, date = todayKey()) =>
        set((state) => {
          const log = ensureLog(state.logsByDate, date);
          // Free users' history holds macros + calories only; paid tiers also retain micros.
          const tier = useSubscriptionStore.getState().activeTier;
          const entry: FoodEntry = {
            id: newId("fe"),
            dailyLogId: log.id,
            name: input.name,
            nameZh: input.nameZh,
            mealType: input.mealType,
            calories: input.calories,
            protein: input.protein,
            carbs: input.carbs,
            fat: input.fat,
            quantity: input.quantity ?? 1,
            unit: input.unit ?? "serving",
            source: input.source ?? "manual",
            imageUri: input.imageUri ?? null,
            barcode: input.barcode ?? null,
            loggedAt: new Date().toISOString(),
            micros: retainMicrosForTier(tier, input.micros),
          };
          return {
            logsByDate: {
              ...state.logsByDate,
              [date]: { ...log, entries: [...log.entries, entry] },
            },
          };
        }),

      editEntry: (date, entryId, patch) =>
        set((state) => {
          const log = state.logsByDate[date];
          if (!log) return state;
          return {
            logsByDate: {
              ...state.logsByDate,
              [date]: {
                ...log,
                entries: log.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
              },
            },
          };
        }),

      removeEntry: (date, entryId) =>
        set((state) => {
          const log = state.logsByDate[date];
          if (!log) return state;
          return {
            logsByDate: {
              ...state.logsByDate,
              [date]: { ...log, entries: log.entries.filter((e) => e.id !== entryId) },
            },
          };
        }),

      toggleCustomization: (date, entryId, customization) =>
        set((state) => {
          const log = state.logsByDate[date];
          if (!log) return state;
          return {
            logsByDate: {
              ...state.logsByDate,
              [date]: {
                ...log,
                entries: log.entries.map((e) => {
                  if (e.id !== entryId) return e;
                  const active = e.customizations ?? [];
                  const next = active.includes(customization)
                    ? active.filter((c) => c !== customization)
                    : [...active, customization];
                  return { ...e, customizations: next };
                }),
              },
            },
          };
        }),

      repeatMeal: (meal, date = todayKey()) =>
        get().addEntry({ ...meal, source: "manual" }, date),

      setCalorieTarget: (dailyCalorieTarget) => set({ dailyCalorieTarget }),

      setHealthProfile: (profile) =>
        set({ healthProfile: profile, dailyCalorieTarget: computeNutritionTargets(profile).calories }),

      clearHealthProfile: () => set({ healthProfile: null }),

      entriesForDate: (date) => get().logsByDate[date]?.entries ?? [],

      totalsForDate: (date) => {
        const entries = get().logsByDate[date]?.entries ?? [];
        return entries.reduce<MacroNutrients>((acc, e) => {
          const m = effectiveMacros(e, e.customizations);
          return {
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
          };
        }, { ...EMPTY_TOTALS });
      },

      microTotalsForDate: (date) => sumMicroTotals(get().logsByDate[date]?.entries ?? []),

      remainingForDate: (date) => get().dailyCalorieTarget - get().totalsForDate(date).calories,

      targets: () => {
        const profile = get().healthProfile;
        return profile ? computeNutritionTargets(profile) : null;
      },
    }),
    {
      name: "siutimsiudai-nutrition",
      storage: persistStorage,
      partialize: (s) => ({
        logsByDate: s.logsByDate,
        dailyCalorieTarget: s.dailyCalorieTarget,
        healthProfile: s.healthProfile,
      }),
    },
  ),
);
