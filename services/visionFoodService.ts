import { FoodRecognitionResult } from "@/types";
import { HK_DISHES, HkDish } from "@/constants/hkDishes";
import { delay } from "./util";

export interface VisionFoodService {
  // The UI always shows these as editable guesses with a confidence badge, never as a
  // silent auto-log: recognition is fuzzy, so a one-tap manual correction is the guardrail.
  recognize(imageUri: string): Promise<FoodRecognitionResult[]>;
}

function toResult(dish: HkDish, confidence: number): FoodRecognitionResult {
  const { keywords, ...macros } = dish;
  return { ...macros, confidence };
}

// Rotate through a few photogenic dishes so repeated captures during a demo vary.
const POOL = ["Har Gow", "Siu Mai", "Baked Pork Chop Rice", "Egg Tart", "Pineapple Bun"];
let cursor = 0;

export const visionFoodService: VisionFoodService = {
  async recognize() {
    await delay(900);
    const primaryName = POOL[cursor % POOL.length];
    cursor += 1;
    const primary = HK_DISHES.find((d) => d.name === primaryName) ?? HK_DISHES[0];
    const alt = HK_DISHES.find((d) => d.name !== primary.name) ?? HK_DISHES[1];
    return [toResult(primary, 0.86), toResult(alt, 0.41)];
  },
};
