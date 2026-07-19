import { RecipeIngredient, RecipeStep, StructuredRecipe } from "@/types";
import { toCanonical } from "@/utils/unitConverter";

type StructuredIngredient = Omit<RecipeIngredient, "id" | "recipeId">;
type StructuredStep = Omit<RecipeStep, "id" | "recipeId">;

// Build an ingredient from a wet-market unit, normalising to canonical g/ml/piece.
// `unitKey` is an English converter key (catty / tael / tbsp / bowl ...); count words
// like 個 / 隻 / 條 fall through to "piece". This is where 斤→604.79g and 兩→37.8g happen.
function ing(
  name: string,
  nameZh: string,
  qty: number,
  unitKey: string,
  rawText: string,
): StructuredIngredient {
  const { quantity, unit } = toCanonical(qty, unitKey);
  const displayUnit = unit === "piece" ? "piece" : unitKey;
  return { name, nameZh, quantity, unit, displayUnit, rawText, substitutedFrom: null };
}

function step(
  stepNumber: number,
  instruction: string,
  instructionZh: string,
  durationSeconds: number | null,
): StructuredStep {
  return { stepNumber, instruction, instructionZh, imageUri: null, durationSeconds };
}

// DayDayCook-style braise. Uses 斤 (catty) and 兩 (tael) so the converter is exercised.
export const BRAISED_BEEF: StructuredRecipe = {
  title: "Braised Beef Brisket with Radish",
  titleZh: "蘿蔔炆牛腩",
  servings: 4,
  totalMinutes: 90,
  sourceUrl: null,
  ingredients: [
    ing("Beef", "牛腩", 1, "catty", "beef brisket / 牛腩 1 斤"),
    ing("Radish", "白蘿蔔", 2, "piece", "white radish / 白蘿蔔 2 個"),
    ing("Ginger", "薑", 4, "piece", "ginger slices / 薑 4 片"),
    ing("Spring onion", "葱", 2, "條", "spring onion / 葱 2 條"),
    ing("Soy sauce", "豉油", 2, "tbsp", "light soy sauce / 生抽 2 湯匙"),
    ing("Sugar", "糖", 1, "tael", "rock sugar / 冰糖 1 兩"),
    ing("Shaoxing wine", "紹興酒", 2, "tbsp", "shaoxing wine / 紹興酒 2 湯匙"),
  ],
  steps: [
    step(1, "Blanch the brisket, then cut into bite-size cubes.", "牛腩汆水，切件。", null),
    step(2, "Fry ginger and spring onion, return beef, splash in the wine.", "爆香薑葱，回牛腩，灒酒。", null),
    step(3, "Add soy sauce, sugar and water to cover; braise on low.", "加豉油、糖同水蓋過，細火炆。", 3600),
    step(4, "Add radish chunks and braise until tender.", "加蘿蔔件，炆至腍。", 1200),
  ],
};

// OCR / handwritten-card style. Uses 條 (count) and 湯匙 to show count + volume mapping.
export const STEAMED_FISH: StructuredRecipe = {
  title: "Steamed Sea Bass",
  titleZh: "清蒸鱸魚",
  servings: 2,
  totalMinutes: 20,
  sourceUrl: null,
  ingredients: [
    ing("Sea bass", "鱸魚", 1, "條", "sea bass / 鱸魚 1 條"),
    ing("Ginger", "薑", 5, "piece", "ginger / 薑 5 片"),
    ing("Spring onion", "葱", 2, "條", "spring onion / 葱 2 條"),
    ing("Soy sauce", "豉油", 2, "tbsp", "steamed-fish soy / 蒸魚豉油 2 湯匙"),
    ing("Oil", "油", 1, "tbsp", "hot oil / 熱油 1 湯匙"),
  ],
  steps: [
    step(1, "Score the fish, lay ginger underneath and on top.", "魚身別花，薑墊底鋪面。", null),
    step(2, "Steam over high heat until just cooked.", "大火蒸至剛熟。", 480),
    step(3, "Top with spring onion, pour over hot oil and soy.", "鋪葱，淋熱油同豉油。", null),
  ],
};
