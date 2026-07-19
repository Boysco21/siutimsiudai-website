import { MeasurementSystem } from "@/types";

// Hong Kong wet-market standards. These are deliberately the HK values, not the
// Mainland Chinese rounded metric ones (500 g jin / 50 g liang would be wrong here).
export const GRAMS_PER_CATTY = 604.79; // 斤
export const TAELS_PER_CATTY = 16;
export const GRAMS_PER_TAEL = 37.8; // 兩  (604.79 / 16, rounded to the HK standard)

// Imperial helpers.
export const GRAMS_PER_POUND = 453.59237;
export const GRAMS_PER_OUNCE = 28.349523;

// Volume helpers (approximate kitchen measures used in HK home recipes).
export const ML_PER_BOWL = 250; // 碗
export const ML_PER_CUP = 240;
export const ML_PER_TABLESPOON = 15;
export const ML_PER_TEASPOON = 5;

export interface MarketUnit {
  key: string;
  en: string;
  zh: string;
  system: MeasurementSystem;
  base: "mass" | "volume" | "count";
  /** grams per one unit, for mass units */
  gramsPerUnit?: number;
  /** millilitres per one unit, for volume units */
  mlPerUnit?: number;
}

// Units offered in the recipe UnitToggle, grouped by system.
export const MARKET_UNITS: MarketUnit[] = [
  { key: "g", en: "g", zh: "克", system: "metric", base: "mass", gramsPerUnit: 1 },
  { key: "kg", en: "kg", zh: "公斤", system: "metric", base: "mass", gramsPerUnit: 1000 },
  { key: "ml", en: "ml", zh: "毫升", system: "metric", base: "volume", mlPerUnit: 1 },
  { key: "oz", en: "oz", zh: "安士", system: "imperial", base: "mass", gramsPerUnit: GRAMS_PER_OUNCE },
  { key: "lb", en: "lb", zh: "磅", system: "imperial", base: "mass", gramsPerUnit: GRAMS_PER_POUND },
  { key: "catty", en: "catty", zh: "斤", system: "hk_market", base: "mass", gramsPerUnit: GRAMS_PER_CATTY },
  { key: "tael", en: "tael", zh: "兩", system: "hk_market", base: "mass", gramsPerUnit: GRAMS_PER_TAEL },
  { key: "bowl", en: "bowl", zh: "碗", system: "hk_market", base: "volume", mlPerUnit: ML_PER_BOWL },
  { key: "piece", en: "piece", zh: "件", system: "metric", base: "count" },
];

export const SYSTEM_LABELS: Record<MeasurementSystem, { en: string; zh: string }> = {
  metric: { en: "Metric", zh: "公制" },
  imperial: { en: "Imperial", zh: "英制" },
  hk_market: { en: "HK market", zh: "街市" },
};
