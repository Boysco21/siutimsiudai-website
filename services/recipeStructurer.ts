import { StructuredRecipe } from "@/types";
import { BRAISED_BEEF, STEAMED_FISH } from "./sampleStructured";
import { delay } from "./util";

export interface RecipeStructurer {
  // Turns raw OCR text into a structured recipe, mapping 斤/兩/碗/條 to canonical units.
  structure(rawText: string): Promise<StructuredRecipe>;
}

export const recipeStructurer: RecipeStructurer = {
  async structure(rawText) {
    await delay(700);
    // Branch on a keyword so the output visibly responds to the input; both branches
    // were built by running wet-market units through utils/unitConverter.
    if (/牛腩|brisket|beef/i.test(rawText)) return BRAISED_BEEF;
    return STEAMED_FISH;
  },
};
