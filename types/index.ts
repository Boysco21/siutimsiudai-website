// Core domain interfaces for Siu Tim Siu Dai.
// Explicit interfaces are preferred over type unions for entity shapes.
// TypeScript fields are camelCase; the SQL schema in /database uses snake_case.

export type Locale = "en" | "zh-Hant";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type LogSource = "photo" | "voice" | "barcode" | "label" | "manual";

// Cha-chaan-teng-style order tweaks the user can tick on a logged item. Each one deducts a
// fixed macro delta (see utils/customizations.ts) and is fully reversible.
export type MealCustomization = "less_sugar" | "less_rice";

export type RecipeSourceType = "url" | "ocr" | "manual";

/** Units we persist in. Everything is normalised to one of these. */
export type CanonicalUnit = "g" | "ml" | "piece";

export type MeasurementSystem = "metric" | "imperial" | "hk_market";

export interface MacroNutrients {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
}

// --- Health profile & daily nutrient needs ---

export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type WeightGoal = "lose" | "maintain" | "gain";

// What the user enters. Metric only (cm / kg) since that is the HK norm.
export interface HealthProfile {
  sex: Sex;
  age: number; // years
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
}

// Per-meal micronutrient amounts. These are the premium "vitamins & minerals" set. The daily
// tracker charts five of them (iron, calcium, potassium, vitamin C, vitamin D); sodium is captured
// when a source provides it but shown as a ceiling elsewhere, and fibre stays a macro and is never
// gated here. Every field is optional because a capture (photo/voice AI, label scan) may only know
// a subset. Retained in history for paid tiers only, stripped to null for free users at the save
// path (see retainMicrosForTier in stores/nutritionStore).
export interface EntryMicronutrients {
  sodium?: number; // mg
  calcium?: number; // mg
  iron?: number; // mg
  potassium?: number; // mg
  vitaminC?: number; // mg
  vitaminD?: number; // mcg
}

// One micronutrient reference line. isLimit marks a ceiling (e.g. sodium) rather than a
// floor to reach.
export interface MicronutrientTarget {
  key: string;
  label: string;
  labelZh: string;
  amount: number;
  unit: string; // "mg" | "mcg" | "g"
  isLimit: boolean;
}

// The full daily target set computed from a HealthProfile.
export interface NutritionTargets extends MacroNutrients {
  fiber: number; // grams
  bmr: number; // basal metabolic rate, kcal
  tdee: number; // maintenance energy, kcal
  micros: MicronutrientTarget[];
}

export interface Profile {
  id: string;
  displayName: string | null;
  locale: Locale;
  dailyCalorieTarget: number;
  onboardingSkipped: boolean;
  createdAt: string;
}

export interface FoodEntry extends MacroNutrients {
  id: string;
  dailyLogId: string;
  name: string;
  nameZh: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  source: LogSource;
  imageUri: string | null;
  barcode: string | null;
  loggedAt: string;
  // Active order tweaks (少甜 / 少底). The stored macros above are always the untweaked
  // base; effective values are derived on read via utils/customizations.ts, so toggling
  // is lossless.
  customizations?: MealCustomization[];
  // Premium per-meal vitamins & minerals. Only retained in history for paid tiers; the save
  // path drops it to null for free users (see retainMicrosForTier). Absent on today's entries
  // since no capture flow populates it yet, but the gate is codified for when micro capture ships.
  micros?: EntryMicronutrients | null;
}

export interface DailyLog {
  id: string;
  userId: string;
  logDate: string; // YYYY-MM-DD
  entries: FoodEntry[];
}

export interface SavedMeal extends MacroNutrients {
  id: string;
  userId: string;
  name: string;
  nameZh: string;
  defaultMealType: MealType;
  useCount: number;
  lastUsedAt: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  nameZh: string;
  quantity: number; // stored in the canonical unit
  unit: CanonicalUnit;
  displayUnit: string; // catty / leung / bowl / piece / g ...
  rawText: string;
  substitutedFrom: string | null; // original ingredient name when swapped
}

export interface RecipeStep {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
  instructionZh: string;
  imageUri: string | null;
  durationSeconds: number | null; // powers in-step timers
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  titleZh: string;
  servings: number;
  sourceType: RecipeSourceType;
  sourceUrl: string | null;
  imageUri: string | null;
  totalMinutes: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  createdAt: string;
  // Healthy-swap mode. When healthyApplied is true the ingredients/steps above hold the
  // healthier version; healthySnapshot preserves the originals for one-tap revert.
  healthyApplied?: boolean;
  healthySnapshot?: RecipeHealthySnapshot | null;
  // Set once a URL-imported recipe has had its English title/ingredients/steps rendered into
  // Traditional Chinese by translationService, so the lazy translation runs at most once.
  zhTranslated?: boolean;
}

export interface RecipeHealthySnapshot {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  nameZh: string;
  quantity: number;
  unit: CanonicalUnit;
  inStock: boolean;
  updatedAt: string;
}

export interface MealPlanEntry {
  id: string;
  userId: string;
  planDate: string; // YYYY-MM-DD
  mealType: MealType;
  recipeId: string;
}

export interface GroceryListItem {
  id: string;
  groceryListId: string;
  name: string;
  nameZh: string;
  quantity: number;
  unit: CanonicalUnit;
  displayUnit: string;
  checked: boolean;
  sourceRecipeIds: string[];
  mergedFrom: string[]; // audit trail of raw labels folded into this line
  inPantry: boolean; // already on hand, deducted from quantity
}

export interface GroceryList {
  id: string;
  userId: string;
  name: string;
  recipeIds: string[];
  items: GroceryListItem[];
  createdAt: string;
}

// --- 1-Click Cart Export (Max perk) ---
//
// The three HK grocery retailers we can hand a missing-ingredient list to. The per-store search
// language lives in constants/retailers.ts: HKTVmall searches in English, Wellcome and ParknShop
// search in Traditional Chinese, so the local engines match the right SKUs.
export type GroceryRetailer = "hktvmall" | "wellcome" | "parknshop";

// One missing ingredient checked against a single retailer's catalog. `term` is the exact string
// we would search that store with, already in the store's language, so the availability check and
// the eventual export share one source of truth.
export interface StoreItemMatch {
  itemId: string; // the GroceryListItem this came from
  term: string; // language-correct search term for this retailer
  available: boolean; // whether this retailer's catalog carries it
}

// A retailer's availability across the whole missing list: the summary counts that drive the
// "4 / 5 items found" row, plus the per-item detail behind it.
export interface StoreAvailability {
  retailer: GroceryRetailer;
  foundCount: number;
  totalCount: number;
  matches: StoreItemMatch[];
}

// Everything needed to hand the list to one retailer. clipboardText holds the full list (never
// truncated, always in the store's language); deepLinkUrl tries the native app; webUrl is the
// https search-results fallback that is always valid.
export interface CartExportPayload {
  retailer: GroceryRetailer;
  clipboardText: string;
  deepLinkUrl: string;
  webUrl: string;
}

// --- Service result shapes (mock now, real provider later) ---

export interface FoodRecognitionResult extends MacroNutrients {
  name: string;
  nameZh: string;
  confidence: number; // 0..1
  portionLabel: string;
  portionLabelZh: string;
  // Premium per-serving vitamins & minerals the vision AI estimated for this dish. Threaded into
  // the logged entry (paid tiers) to feed the daily micronutrient tracker.
  micros?: EntryMicronutrients;
}

// One raw ingredient the pantry vision service thinks it saw in a photo. Deliberately NOT
// macro-bearing: this is inventory (what's in the kitchen), not a logged meal. Every field maps
// cleanly onto NewPantryItemInput so a confirmed row saves straight to the pantry. `confidence`
// is the AI's certainty (0..1); it is absent on rows the user typed in by hand on the review
// screen, which is exactly how the UI tells "AI guessed this" from "I added this".
export interface ScannedIngredient {
  name: string;
  nameZh: string;
  quantity: number;
  unit: CanonicalUnit;
  confidence?: number; // 0..1 from the model; undefined for manually added rows
}

export interface ParsedMeal extends MacroNutrients {
  name: string;
  nameZh: string;
  quantity: number;
  unit: string;
  mealType: MealType;
  // Premium per-serving vitamins & minerals the NLP AI estimated for this dish. Threaded into the
  // logged entry (paid tiers) to feed the daily micronutrient tracker.
  micros?: EntryMicronutrients;
}

export interface BarcodeProduct extends MacroNutrients {
  barcode: string;
  name: string;
  nameZh: string;
  brand: string | null;
  servingSize: string;
  isHongKong: boolean; // GS1 HK 489 prefix
}

export interface NutritionFacts extends MacroNutrients {
  servingSize: string;
  sodium: number | null; // mg, part of the HK 1+7 label
  sugar: number | null; // g
}

export interface StructuredRecipe {
  title: string;
  titleZh: string;
  servings: number;
  totalMinutes: number;
  sourceUrl: string | null;
  ingredients: Array<Omit<RecipeIngredient, "id" | "recipeId">>;
  steps: Array<Omit<RecipeStep, "id" | "recipeId">>;
  // Per-serving vitamins & minerals the recipe AI estimated for the finished dish (iron, calcium,
  // potassium, vitamin C, vitamin D). Descriptive only — never tailored to the user's targets, in
  // line with the generic "use up what you have" product constraint. Absent when the model omits it
  // or on the offline mock path.
  micros?: EntryMicronutrients;
}

export interface Substitution {
  original: string;
  originalZh: string;
  substitute: string;
  substituteZh: string;
  ratio: string; // e.g. "1:1"
  note: string;
  noteZh: string;
}

export interface HealthySwap {
  ingredientId: string;
  original: string;
  originalZh: string;
  substitute: string;
  substituteZh: string;
  quantityRatio: number; // multiply the ingredient's canonical quantity by this
  reason: string;
  reasonZh: string;
  source: "curated" | "ai"; // provenance: curated map or Claude fallback
}

export interface IngredientDictionaryEntry {
  canonical: string; // canonical English key used for merge equality
  en: string;
  zh: string;
  aliases: string[]; // alternative spellings / synonyms, English and Chinese
}
