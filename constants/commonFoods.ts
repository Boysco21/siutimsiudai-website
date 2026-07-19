// Everyday foods beyond the curated cha-chaan-teng list. The logging AI mock (nlpMealService)
// falls back to these when a description is not one of the HK_DISHES, so common items like
// "kiwi" or "chicken breast" still estimate offline. These are "novel" for billing: they are NOT
// in parseMealText's free known-dish set, so logging one spends an AI log (known free, novel
// metered). Macros are per the stated everyday portion; micros are rough but plausible estimates
// (iron / calcium / potassium / vitaminC in mg, vitaminD in mcg) so the tracker gets real numbers.

import { EntryMicronutrients } from "@/types";

export interface CommonFood {
  name: string;
  nameZh: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionLabel: string;
  portionLabelZh: string;
  keywords: string[]; // English + Chinese, matched by the estimator
  micros: EntryMicronutrients;
}

export const COMMON_FOODS: CommonFood[] = [
  // Fruit
  { name: "Kiwi", nameZh: "奇異果", calories: 45, protein: 1, carbs: 11, fat: 0, portionLabel: "1 fruit", portionLabelZh: "一個", keywords: ["kiwi", "kiwifruit", "奇異果"], micros: { iron: 0.3, calcium: 25, potassium: 215, vitaminC: 64, vitaminD: 0 } },
  { name: "Apple", nameZh: "蘋果", calories: 95, protein: 0, carbs: 25, fat: 0, portionLabel: "1 fruit", portionLabelZh: "一個", keywords: ["apple", "蘋果"], micros: { iron: 0.2, calcium: 11, potassium: 195, vitaminC: 8, vitaminD: 0 } },
  { name: "Banana", nameZh: "香蕉", calories: 105, protein: 1, carbs: 27, fat: 0, portionLabel: "1 fruit", portionLabelZh: "一條", keywords: ["banana", "香蕉"], micros: { iron: 0.3, calcium: 6, potassium: 422, vitaminC: 10, vitaminD: 0 } },
  { name: "Orange", nameZh: "橙", calories: 62, protein: 1, carbs: 15, fat: 0, portionLabel: "1 fruit", portionLabelZh: "一個", keywords: ["orange", "橙"], micros: { iron: 0.1, calcium: 52, potassium: 237, vitaminC: 70, vitaminD: 0 } },
  { name: "Grapes", nameZh: "提子", calories: 104, protein: 1, carbs: 27, fat: 0, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["grape", "grapes", "提子", "葡萄"], micros: { iron: 0.5, calcium: 15, potassium: 288, vitaminC: 5, vitaminD: 0 } },
  { name: "Watermelon", nameZh: "西瓜", calories: 86, protein: 2, carbs: 22, fat: 0, portionLabel: "1 wedge", portionLabelZh: "一件", keywords: ["watermelon", "西瓜"], micros: { iron: 0.5, calcium: 20, potassium: 320, vitaminC: 23, vitaminD: 0 } },
  { name: "Strawberry", nameZh: "士多啤梨", calories: 49, protein: 1, carbs: 12, fat: 0, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["strawberry", "strawberries", "士多啤梨", "草莓"], micros: { iron: 0.6, calcium: 24, potassium: 220, vitaminC: 89, vitaminD: 0 } },

  // Protein
  { name: "Boiled Egg", nameZh: "烚蛋", calories: 78, protein: 6, carbs: 1, fat: 5, portionLabel: "1 egg", portionLabelZh: "一隻", keywords: ["egg", "eggs", "boiled egg", "雞蛋", "烚蛋", "蛋"], micros: { iron: 0.9, calcium: 28, potassium: 63, vitaminC: 0, vitaminD: 1.1 } },
  { name: "Chicken Breast", nameZh: "雞胸肉", calories: 165, protein: 31, carbs: 0, fat: 4, portionLabel: "100 g", portionLabelZh: "100 克", keywords: ["chicken breast", "chicken", "雞胸", "雞肉"], micros: { iron: 1.0, calcium: 15, potassium: 256, vitaminC: 0, vitaminD: 0.1 } },
  { name: "Salmon", nameZh: "三文魚", calories: 208, protein: 20, carbs: 0, fat: 13, portionLabel: "100 g", portionLabelZh: "100 克", keywords: ["salmon", "三文魚"], micros: { iron: 0.8, calcium: 12, potassium: 363, vitaminC: 0, vitaminD: 11 } },
  { name: "Tofu", nameZh: "豆腐", calories: 76, protein: 8, carbs: 2, fat: 5, portionLabel: "100 g", portionLabelZh: "100 克", keywords: ["tofu", "豆腐", "豆花"], micros: { iron: 2.7, calcium: 200, potassium: 121, vitaminC: 0, vitaminD: 0 } },
  { name: "Shrimp", nameZh: "蝦", calories: 99, protein: 24, carbs: 0, fat: 0, portionLabel: "100 g", portionLabelZh: "100 克", keywords: ["shrimp", "prawn", "prawns", "蝦"], micros: { iron: 0.5, calcium: 70, potassium: 259, vitaminC: 0, vitaminD: 0.1 } },
  { name: "Beef", nameZh: "牛肉", calories: 250, protein: 26, carbs: 0, fat: 15, portionLabel: "100 g", portionLabelZh: "100 克", keywords: ["beef", "steak", "牛肉"], micros: { iron: 2.6, calcium: 18, potassium: 315, vitaminC: 0, vitaminD: 0.1 } },

  // Staples
  { name: "White Rice", nameZh: "白飯", calories: 205, protein: 4, carbs: 45, fat: 0, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["white rice", "rice", "steamed rice", "白飯", "飯"], micros: { iron: 1.9, calcium: 16, potassium: 55, vitaminC: 0, vitaminD: 0 } },
  { name: "Toast", nameZh: "多士", calories: 80, protein: 3, carbs: 14, fat: 1, portionLabel: "1 slice", portionLabelZh: "一片", keywords: ["toast", "bread", "多士", "麵包"], micros: { iron: 0.9, calcium: 40, potassium: 37, vitaminC: 0, vitaminD: 0 } },
  { name: "Instant Noodles", nameZh: "即食麵", calories: 385, protein: 8, carbs: 55, fat: 14, portionLabel: "1 pack", portionLabelZh: "一包", keywords: ["instant noodles", "instant noodle", "即食麵", "公仔麵", "出前一丁"], micros: { sodium: 1700, iron: 4.3, calcium: 20, potassium: 120, vitaminC: 0 } },
  { name: "Pasta", nameZh: "意粉", calories: 220, protein: 8, carbs: 43, fat: 1, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["pasta", "spaghetti", "意粉", "意大利粉"], micros: { iron: 1.8, calcium: 10, potassium: 44, vitaminC: 0, vitaminD: 0 } },
  { name: "Sweet Potato", nameZh: "番薯", calories: 112, protein: 2, carbs: 26, fat: 0, portionLabel: "1 medium", portionLabelZh: "一個", keywords: ["sweet potato", "番薯", "地瓜"], micros: { iron: 0.8, calcium: 43, potassium: 438, vitaminC: 22, vitaminD: 0 } },

  // Vegetables
  { name: "Broccoli", nameZh: "西蘭花", calories: 55, protein: 4, carbs: 11, fat: 1, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["broccoli", "西蘭花"], micros: { iron: 0.7, calcium: 43, potassium: 288, vitaminC: 81, vitaminD: 0 } },
  { name: "Salad", nameZh: "沙律", calories: 20, protein: 2, carbs: 4, fat: 0, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["salad", "greens", "lettuce", "沙律", "菜"], micros: { iron: 1.0, calcium: 40, potassium: 200, vitaminC: 10, vitaminD: 0 } },

  // Dairy
  { name: "Milk", nameZh: "牛奶", calories: 122, protein: 8, carbs: 12, fat: 5, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["milk", "牛奶", "鮮奶"], micros: { iron: 0, calcium: 305, potassium: 366, vitaminC: 0, vitaminD: 3.2 } },
  { name: "Yogurt", nameZh: "乳酪", calories: 149, protein: 9, carbs: 11, fat: 8, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["yogurt", "yoghurt", "乳酪", "酸奶"], micros: { iron: 0.1, calcium: 296, potassium: 380, vitaminC: 1, vitaminD: 0.1 } },
  { name: "Cheese", nameZh: "芝士", calories: 113, protein: 7, carbs: 1, fat: 9, portionLabel: "1 slice", portionLabelZh: "一片", keywords: ["cheese", "芝士", "起司"], micros: { sodium: 174, calcium: 200, potassium: 20, iron: 0.1, vitaminD: 0.1 } },

  // Drinks
  { name: "Coffee", nameZh: "咖啡", calories: 5, protein: 0, carbs: 1, fat: 0, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["coffee", "咖啡", "齋啡"], micros: { iron: 0, calcium: 5, potassium: 116, vitaminC: 0, vitaminD: 0 } },
  { name: "Soft Drink", nameZh: "汽水", calories: 140, protein: 0, carbs: 39, fat: 0, portionLabel: "1 can", portionLabelZh: "一罐", keywords: ["soft drink", "soda", "cola", "coke", "汽水", "可樂"], micros: { sodium: 45, calcium: 0, potassium: 0, iron: 0, vitaminC: 0 } },

  // Snacks
  { name: "Almonds", nameZh: "杏仁", calories: 164, protein: 6, carbs: 6, fat: 14, portionLabel: "1 oz", portionLabelZh: "一安士", keywords: ["almond", "almonds", "nuts", "杏仁"], micros: { iron: 1.1, calcium: 76, potassium: 208, vitaminC: 0, vitaminD: 0 } },
  { name: "Dark Chocolate", nameZh: "黑朱古力", calories: 155, protein: 2, carbs: 13, fat: 9, portionLabel: "1 oz", portionLabelZh: "一安士", keywords: ["dark chocolate", "chocolate", "朱古力", "巧克力"], micros: { iron: 3.3, calcium: 22, potassium: 158, vitaminC: 0, vitaminD: 0 } },
];
