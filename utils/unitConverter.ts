import {
  GRAMS_PER_CATTY,
  GRAMS_PER_TAEL,
  GRAMS_PER_POUND,
  GRAMS_PER_OUNCE,
  ML_PER_BOWL,
  ML_PER_CUP,
  ML_PER_TABLESPOON,
  ML_PER_TEASPOON,
} from "@/constants/units";
import { CanonicalUnit, MeasurementSystem } from "@/types";

// All mass units expressed in grams. HK catty/tael use the HK standard values.
const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: GRAMS_PER_OUNCE,
  lb: GRAMS_PER_POUND,
  catty: GRAMS_PER_CATTY,
  tael: GRAMS_PER_TAEL,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  bowl: ML_PER_BOWL,
  cup: ML_PER_CUP,
  tbsp: ML_PER_TABLESPOON,
  tsp: ML_PER_TEASPOON,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isMassUnit(unit: string): boolean {
  return unit.toLowerCase() in MASS_TO_GRAMS;
}

export function isVolumeUnit(unit: string): boolean {
  return unit.toLowerCase() in VOLUME_TO_ML;
}

export function gramsFrom(quantity: number, unit: string): number {
  const factor = MASS_TO_GRAMS[unit.toLowerCase()];
  if (factor === undefined) throw new Error(`Unknown mass unit: ${unit}`);
  return quantity * factor;
}

export function mlFrom(quantity: number, unit: string): number {
  const factor = VOLUME_TO_ML[unit.toLowerCase()];
  if (factor === undefined) throw new Error(`Unknown volume unit: ${unit}`);
  return quantity * factor;
}

export function cattyToGrams(catty: number): number {
  return catty * GRAMS_PER_CATTY;
}
export function taelToGrams(tael: number): number {
  return tael * GRAMS_PER_TAEL;
}
export function gramsToCatty(grams: number): number {
  return grams / GRAMS_PER_CATTY;
}
export function gramsToTael(grams: number): number {
  return grams / GRAMS_PER_TAEL;
}

/** Convert a mass between any two known mass units. */
export function convertMass(quantity: number, from: string, to: string): number {
  const toFactor = MASS_TO_GRAMS[to.toLowerCase()];
  if (toFactor === undefined) throw new Error(`Unknown mass unit: ${to}`);
  return gramsFrom(quantity, from) / toFactor;
}

/** Convert a volume between any two known volume units. */
export function convertVolume(quantity: number, from: string, to: string): number {
  const toFactor = VOLUME_TO_ML[to.toLowerCase()];
  if (toFactor === undefined) throw new Error(`Unknown volume unit: ${to}`);
  return mlFrom(quantity, from) / toFactor;
}

/** Normalise any recipe unit to the canonical storage unit (g / ml / piece). */
export function toCanonical(
  quantity: number,
  unit: string,
): { quantity: number; unit: CanonicalUnit } {
  const u = unit.toLowerCase();
  if (u in MASS_TO_GRAMS) return { quantity: round2(gramsFrom(quantity, u)), unit: "g" };
  if (u in VOLUME_TO_ML) return { quantity: round2(mlFrom(quantity, u)), unit: "ml" };
  return { quantity, unit: "piece" };
}

export interface DisplayMeasure {
  quantity: number;
  unit: string;
  unitZh: string;
}

/** Present a canonical quantity in the requested measurement system, choosing a readable unit. */
export function displayInSystem(
  quantity: number,
  unit: CanonicalUnit,
  system: MeasurementSystem,
): DisplayMeasure {
  if (unit === "piece") {
    return { quantity: round2(quantity), unit: "piece", unitZh: "件" };
  }
  if (unit === "g") {
    if (system === "hk_market") {
      return quantity >= GRAMS_PER_CATTY
        ? { quantity: round2(gramsToCatty(quantity)), unit: "catty", unitZh: "斤" }
        : { quantity: round2(gramsToTael(quantity)), unit: "tael", unitZh: "兩" };
    }
    if (system === "imperial") {
      return quantity >= GRAMS_PER_POUND
        ? { quantity: round2(quantity / GRAMS_PER_POUND), unit: "lb", unitZh: "磅" }
        : { quantity: round2(quantity / GRAMS_PER_OUNCE), unit: "oz", unitZh: "安士" };
    }
    return quantity >= 1000
      ? { quantity: round2(quantity / 1000), unit: "kg", unitZh: "公斤" }
      : { quantity: round2(quantity), unit: "g", unitZh: "克" };
  }
  // volume (ml)
  if (system === "hk_market") {
    return { quantity: round2(quantity / ML_PER_BOWL), unit: "bowl", unitZh: "碗" };
  }
  if (system === "imperial") {
    return { quantity: round2(quantity / ML_PER_CUP), unit: "cup", unitZh: "杯" };
  }
  return quantity >= 1000
    ? { quantity: round2(quantity / 1000), unit: "L", unitZh: "公升" }
    : { quantity: round2(quantity), unit: "ml", unitZh: "毫升" };
}
