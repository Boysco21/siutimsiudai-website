import { NutritionFacts } from "@/types";
import { delay } from "./util";

export interface LabelOcrService {
  // Fallback when a barcode misses: read the HK "1+7" nutrition label off a photo.
  parse(imageUri: string): Promise<NutritionFacts>;
}

export const labelOcrService: LabelOcrService = {
  async parse() {
    await delay(800);
    return {
      servingSize: "100 g",
      calories: 250,
      protein: 9,
      carbs: 34,
      fat: 8,
      sodium: 420, // mg
      sugar: 12, // g
    };
  },
};
