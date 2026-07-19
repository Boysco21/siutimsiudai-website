import { CanonicalUnit, StructuredRecipe } from "@/types";
import { sanitizeMicros } from "@/utils/micros";
import { isSupabaseConfigured, supabase } from "./supabase";
import { delay } from "./util";

// AI recipe generation from a pantry list. Same two-layer shape as translationService and
// pantryVisionService:
//
//   1. Live: a Supabase Edge Function ("generate-recipe") holds the Google Cloud service account
//      SERVER-SIDE and asks Vertex AI (Gemini) for ONE simple recipe built only from a sensible
//      subset of the ingredients we pass. The billable credential never ships client-side. See
//      supabase/functions/generate-recipe/index.ts.
//   2. Fallback: an on-device mock (buildGenericRecipe) used when Supabase is not configured
//      (Expo Go, web, tests) or the call fails, so the feature is fully demoable offline.
//
// Product constraint (enforced on BOTH paths): the recipe is a purely generic "use up what you
// scanned" dish. It is deliberately NOT tailored to the user's calorie / macro / micro targets —
// we never send those to the model, and the mock never reads them. Nutrition targets belong to the
// logging flow, not here.

// Minimal seed the generator needs. PantryItem and ScannedIngredient both satisfy this, so callers
// can hand over either without a mapping step. Quantity/unit are optional and only used to make the
// generated ingredient line look realistic.
export interface RecipeSeedIngredient {
  name: string;
  nameZh: string;
  quantity?: number;
  unit?: CanonicalUnit;
}

export interface RecipeGenerationService {
  generate(ingredients: RecipeSeedIngredient[]): Promise<StructuredRecipe>;
}

const GENERATE_FN = "generate-recipe";
const UNITS: readonly CanonicalUnit[] = ["g", "ml", "piece"];

// --- Response validation (live path) --------------------------------------------------------
// A model can return almost anything; we only trust a payload that already matches StructuredRecipe
// closely, and we sanitise every field. Returns null (not throw) on any mismatch so the caller
// falls back to the local mock.

function toIngredient(raw: unknown): StructuredRecipe["ingredients"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const nameZh = typeof r.nameZh === "string" ? r.nameZh.trim() : "";
  if (!name && !nameZh) return null;
  const unit = UNITS.includes(r.unit as CanonicalUnit) ? (r.unit as CanonicalUnit) : "piece";
  const q = Number(r.quantity);
  return {
    name: name || nameZh,
    nameZh: nameZh || name,
    quantity: Number.isFinite(q) && q > 0 ? q : 1,
    unit,
    displayUnit: typeof r.displayUnit === "string" && r.displayUnit ? r.displayUnit : unit,
    rawText: typeof r.rawText === "string" ? r.rawText : name || nameZh,
    substitutedFrom: null,
  };
}

function toStep(raw: unknown, index: number): StructuredRecipe["steps"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const instruction = typeof r.instruction === "string" ? r.instruction.trim() : "";
  const instructionZh = typeof r.instructionZh === "string" ? r.instructionZh.trim() : "";
  if (!instruction && !instructionZh) return null;
  const d = Number(r.durationSeconds);
  return {
    stepNumber: index + 1,
    instruction: instruction || instructionZh,
    instructionZh: instructionZh || instruction,
    imageUri: null,
    durationSeconds: Number.isFinite(d) && d > 0 ? Math.round(d) : null,
  };
}

export function parseRecipeResponse(data: unknown): StructuredRecipe | null {
  const recipe = (data as { recipe?: unknown })?.recipe;
  if (!recipe || typeof recipe !== "object") return null;
  const r = recipe as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const titleZh = typeof r.titleZh === "string" ? r.titleZh.trim() : "";
  if (!title && !titleZh) return null;
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.map(toIngredient).filter((x): x is StructuredRecipe["ingredients"][number] => x !== null)
    : [];
  const steps = Array.isArray(r.steps)
    ? r.steps.map(toStep).filter((x): x is StructuredRecipe["steps"][number] => x !== null)
    : [];
  if (ingredients.length === 0 || steps.length === 0) return null;
  const servings = Number(r.servings);
  const totalMinutes = Number(r.totalMinutes);
  // Descriptive per-serving vitamins & minerals, sanitised like every other model field. Omitted
  // when the model didn't return a usable object, so the recipe shape stays clean.
  const micros = sanitizeMicros(r.micros);
  return {
    title: title || titleZh,
    titleZh: titleZh || title,
    servings: Number.isFinite(servings) && servings > 0 ? Math.round(servings) : 2,
    totalMinutes: Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.round(totalMinutes) : 20,
    sourceUrl: null,
    ingredients,
    steps,
    ...(micros ? { micros } : {}),
  };
}

async function generateViaProxy(ingredients: RecipeSeedIngredient[]): Promise<StructuredRecipe | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<{ recipe?: unknown }>(GENERATE_FN, {
    // Send ONLY the ingredient names/amounts. No profile, no targets: the recipe must be generic.
    body: { ingredients: ingredients.map((i) => ({ name: i.name, nameZh: i.nameZh, quantity: i.quantity, unit: i.unit })) },
  });
  if (error) return null;
  return parseRecipeResponse(data);
}

// --- Local mock (fallback path) -------------------------------------------------------------
// A deterministic recipe assembled from a SUBSET of what was scanned. Pure and exported so a test
// can prove it only references ingredients it was given, never invents a main ingredient, and never
// touches nutrition targets. Not meant to be a great recipe, but it must be a plausible one: a cook
// does not fry cocoa powder with pork just because both are in the cupboard.
//
// The mock mirrors the live Edge Function's chef rules (see generate-recipe/index.ts): it splits the
// pantry into a sweet/breakfast lane and a savoury/dinner lane, cooks only the bigger lane, and caps
// the dish at a handful of ingredients so the rest are left as leftovers.

// Sweet / breakfast signals. Substring match, so "berr" catches blueberries and strawberries, "oat"
// stays out on purpose (it collides with "goat"). Chinese terms are matched as-is (toLowerCase is a
// no-op on CJK).
const SWEET_MARKERS: readonly string[] = [
  "berr", "cocoa", "chocolate", "yogurt", "yoghurt", "honey", "jam", "cereal",
  "oatmeal", "granola", "muesli", "banana", "vanilla", "maple", "syrup", "custard", "marshmallow",
  "可可", "朱古力", "莓", "乳酪", "酸奶", "蜂蜜", "果醬", "麥皮", "燕麥", "麥片", "香蕉", "雲呢拿", "楓糖", "糖漿",
];

// Seasonings / staples. Kept out of the dish TITLE (nobody names a dish "Salt & Oil"), but still fine
// to appear in the ingredient list. Everything not sweet lands in the savoury lane by default.
const SEASONING_MARKERS: readonly string[] = [
  "soy", "salt", "oil", "sugar", "pepper", "water", "vinegar", "sauce", "stock", "broth",
  "豉油", "醬油", "鹽", "油", "糖", "胡椒", "水", "醋", "醬", "高湯", "上湯",
];

function matches(markers: readonly string[], i: RecipeSeedIngredient): boolean {
  const hay = `${i.name} ${i.nameZh}`.toLowerCase();
  return markers.some((m) => hay.includes(m));
}

export function buildGenericRecipe(ingredients: RecipeSeedIngredient[]): StructuredRecipe {
  const named = ingredients.filter((i) => (i.name || i.nameZh).trim().length > 0);
  const en = (i: RecipeSeedIngredient) => i.name || i.nameZh;
  const zh = (i: RecipeSeedIngredient) => i.nameZh || i.name;

  // Pick one lane and cook only that. Ties (and the empty pantry) go savoury: the wok is the default.
  const sweet = named.filter((i) => matches(SWEET_MARKERS, i));
  const savoury = named.filter((i) => !matches(SWEET_MARKERS, i));
  const useSavoury = savoury.length >= sweet.length;
  const lane = useSavoury ? savoury : sweet;

  // Cap the dish so the rest of the pantry is genuinely left over.
  const subset = lane.slice(0, 6);
  const list = subset.map(en).join(", ");
  const listZh = subset.map(zh).join("、");

  // Name the dish after its real stars, not its seasonings.
  const heroes = subset.filter((i) => !matches(SEASONING_MARKERS, i));
  const titleFrom = (heroes.length > 0 ? heroes : subset).slice(0, 2);
  const heroEn = titleFrom.map(en).join(" & ");
  const heroZh = titleFrom.map(zh).join("");
  const hasSoy = subset.some((i) => matches(["soy", "豉油", "醬油"], i));

  const steps: StructuredRecipe["steps"] = useSavoury
    ? [
        {
          stepNumber: 1,
          instruction: `Rinse and prep ${list || "your ingredients"}. Chop into bite-size pieces.`,
          instructionZh: `洗好切好${listZh || "你嘅材料"}，切成入口大細。`,
          imageUri: null,
          durationSeconds: null,
        },
        {
          stepNumber: 2,
          instruction: "Heat a little oil in a wok over medium-high heat until it shimmers.",
          instructionZh: "鑊落少少油，中大火燒到微微冒煙。",
          imageUri: null,
          durationSeconds: 120,
        },
        {
          stepNumber: 3,
          instruction: `Add ${list || "the ingredients"} and stir-fry for 4 to 5 minutes until just cooked through.`,
          instructionZh: `落${listZh || "材料"}，兜炒 4 至 5 分鐘到啱啱熟。`,
          imageUri: null,
          durationSeconds: 300,
        },
        {
          stepNumber: 4,
          instruction: hasSoy
            ? "Season with a splash of soy sauce, plus salt and pepper to taste. Plate and serve hot."
            : "Season with salt and pepper to taste. Plate and serve hot.",
          instructionZh: hasSoy
            ? "落少少豉油，再加鹽同胡椒調味，上碟趁熱食。"
            : "落鹽同胡椒調味，上碟趁熱食。",
          imageUri: null,
          durationSeconds: null,
        },
      ]
    : [
        {
          stepNumber: 1,
          instruction: `Prep ${list || "your ingredients"}: rinse any fruit and slice anything large.`,
          instructionZh: `整定${listZh || "你嘅材料"}：沖洗生果，大件嘅切開。`,
          imageUri: null,
          durationSeconds: null,
        },
        {
          stepNumber: 2,
          instruction: `Layer ${list || "everything"} into a bowl and gently fold together.`,
          instructionZh: `將${listZh || "全部"}放入碗，輕輕撈勻。`,
          imageUri: null,
          durationSeconds: null,
        },
        {
          stepNumber: 3,
          instruction: "Chill for a few minutes if you like, then serve.",
          instructionZh: "想凍啲可以雪一陣先食。",
          imageUri: null,
          durationSeconds: null,
        },
      ];

  return {
    title: heroEn ? (useSavoury ? `${heroEn} Stir-Fry` : `${heroEn} Bowl`) : "Pantry Stir-Fry",
    titleZh: heroZh ? (useSavoury ? `${heroZh}小炒` : `${heroZh}碗`) : "清冰箱小炒",
    servings: 2,
    totalMinutes: useSavoury ? 20 : 5,
    sourceUrl: null,
    ingredients: subset.map((i) => {
      const unit = i.unit ?? "piece";
      const quantity = i.quantity && i.quantity > 0 ? i.quantity : 1;
      return {
        name: en(i),
        nameZh: zh(i),
        quantity,
        unit,
        displayUnit: unit,
        rawText: `${quantity} ${unit} ${en(i)}`.trim(),
        substitutedFrom: null,
      };
    }),
    steps,
  };
}

export const recipeGenerationService: RecipeGenerationService = {
  async generate(ingredients) {
    if (isSupabaseConfigured) {
      const remote = await generateViaProxy(ingredients).catch(() => null);
      if (remote) return remote;
    }
    await delay(1200); // exercise the "generating" spinner in mock mode
    return buildGenericRecipe(ingredients);
  },
};
