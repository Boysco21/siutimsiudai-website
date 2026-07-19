import { delay } from "./util";

export interface RecipeOcrService {
  // Transcribes a photographed recipe card to raw bilingual text. The recipeStructurer
  // then turns this into a StructuredRecipe. Kept as two steps so a real OCR engine and
  // a real parser can each be swapped independently later.
  parse(imageUri: string): Promise<string>;
}

const SAMPLE_CARD = `清蒸鱸魚 / Steamed Sea Bass
份量 Servings: 2

材料 Ingredients:
鱸魚 1 條 / sea bass 1
薑 5 片 / ginger 5 slices
葱 2 條 / spring onion 2
蒸魚豉油 2 湯匙 / soy sauce 2 tbsp
熱油 1 湯匙 / hot oil 1 tbsp

做法 Steps:
1. 魚身別花，薑墊底鋪面。
2. 大火蒸至剛熟。
3. 鋪葱，淋熱油同豉油。`;

export const recipeOcrService: RecipeOcrService = {
  async parse() {
    await delay(900);
    return SAMPLE_CARD;
  },
};
