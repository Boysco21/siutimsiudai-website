// Curated local dish list. The vision and NLP mock services match against this,
// and the seed file mirrors it. Macros are per the stated portion.

import { EntryMicronutrients } from "@/types";

export interface HkDish {
  name: string;
  nameZh: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionLabel: string;
  portionLabelZh: string;
  keywords: string[]; // English + Chinese, used by the NLP and vision mocks
  // Rough per-portion vitamins & minerals for the premium micronutrient tracker. iron / calcium /
  // potassium / vitaminC in mg, vitaminD in mcg. Estimates only, but a plausible one so the mock
  // AI paths (photo + voice) feed the tracker with believable numbers offline.
  micros: EntryMicronutrients;
}

export const HK_DISHES: HkDish[] = [
  { name: "Har Gow", nameZh: "蝦餃", calories: 200, protein: 10, carbs: 24, fat: 6, portionLabel: "4 pieces", portionLabelZh: "四隻", keywords: ["har gow", "har gau", "shrimp dumpling", "蝦餃"], micros: { iron: 1.5, calcium: 60, potassium: 180, vitaminC: 1, vitaminD: 0.3 } },
  { name: "Siu Mai", nameZh: "燒賣", calories: 240, protein: 14, carbs: 20, fat: 10, portionLabel: "4 pieces", portionLabelZh: "四粒", keywords: ["siu mai", "shumai", "燒賣"], micros: { iron: 1.8, calcium: 40, potassium: 220, vitaminC: 1, vitaminD: 0.4 } },
  { name: "Char Siu Bao", nameZh: "叉燒包", calories: 230, protein: 8, carbs: 38, fat: 6, portionLabel: "1 bun", portionLabelZh: "一個", keywords: ["char siu bao", "bbq pork bun", "叉燒包"], micros: { iron: 1.6, calcium: 50, potassium: 160, vitaminC: 1, vitaminD: 0.2 } },
  { name: "Baked Pork Chop Rice", nameZh: "焗豬扒飯", calories: 850, protein: 35, carbs: 95, fat: 35, portionLabel: "1 plate", portionLabelZh: "一碟", keywords: ["baked pork chop rice", "pork chop rice", "焗豬扒飯"], micros: { iron: 3.5, calcium: 120, potassium: 700, vitaminC: 12, vitaminD: 0.6 } },
  { name: "Pineapple Bun", nameZh: "菠蘿包", calories: 300, protein: 6, carbs: 45, fat: 11, portionLabel: "1 bun", portionLabelZh: "一個", keywords: ["pineapple bun", "polo bao", "菠蘿包"], micros: { iron: 1.4, calcium: 40, potassium: 90, vitaminC: 0, vitaminD: 0.3 } },
  { name: "Egg Tart", nameZh: "蛋撻", calories: 200, protein: 4, carbs: 22, fat: 11, portionLabel: "1 tart", portionLabelZh: "一個", keywords: ["egg tart", "daan tat", "蛋撻"], micros: { iron: 0.6, calcium: 40, potassium: 60, vitaminC: 0, vitaminD: 0.8 } },
  { name: "HK Milk Tea", nameZh: "港式奶茶", calories: 120, protein: 3, carbs: 16, fat: 5, portionLabel: "1 cup", portionLabelZh: "一杯", keywords: ["milk tea", "nai cha", "奶茶", "港式奶茶"], micros: { iron: 0.1, calcium: 90, potassium: 150, vitaminC: 0, vitaminD: 0.5 } },
  { name: "Wonton Noodles", nameZh: "雲吞麵", calories: 430, protein: 22, carbs: 60, fat: 10, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["wonton noodles", "wantan mee", "雲吞麵"], micros: { iron: 2.5, calcium: 60, potassium: 300, vitaminC: 3, vitaminD: 0.4 } },
  { name: "Beef Brisket Noodles", nameZh: "牛腩麵", calories: 520, protein: 28, carbs: 62, fat: 16, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["beef brisket noodles", "牛腩麵"], micros: { iron: 3.8, calcium: 50, potassium: 450, vitaminC: 4, vitaminD: 0.3 } },
  { name: "French Toast", nameZh: "西多士", calories: 560, protein: 12, carbs: 60, fat: 30, portionLabel: "1 serving", portionLabelZh: "一份", keywords: ["french toast", "sai do si", "西多士"], micros: { iron: 2.2, calcium: 90, potassium: 180, vitaminC: 0, vitaminD: 1.0 } },
  { name: "Pork Chop Bun", nameZh: "豬扒包", calories: 480, protein: 22, carbs: 48, fat: 22, portionLabel: "1 bun", portionLabelZh: "一個", keywords: ["pork chop bun", "豬扒包"], micros: { iron: 2.0, calcium: 70, potassium: 320, vitaminC: 2, vitaminD: 0.5 } },
  { name: "Century Egg Congee", nameZh: "皮蛋瘦肉粥", calories: 270, protein: 16, carbs: 40, fat: 5, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["congee", "century egg congee", "粥", "皮蛋瘦肉粥"], micros: { iron: 2.4, calcium: 50, potassium: 200, vitaminC: 1, vitaminD: 1.2 } },
  { name: "Roast Goose Rice", nameZh: "燒鵝飯", calories: 780, protein: 38, carbs: 90, fat: 30, portionLabel: "1 plate", portionLabelZh: "一碟", keywords: ["roast goose rice", "燒鵝飯"], micros: { iron: 4.0, calcium: 40, potassium: 600, vitaminC: 3, vitaminD: 0.5 } },
  { name: "Steamed Rice Roll", nameZh: "腸粉", calories: 250, protein: 7, carbs: 48, fat: 4, portionLabel: "1 plate", portionLabelZh: "一碟", keywords: ["rice roll", "cheung fun", "腸粉"], micros: { iron: 1.2, calcium: 40, potassium: 90, vitaminC: 0, vitaminD: 0.1 } },
  { name: "Curry Fish Balls", nameZh: "咖喱魚蛋", calories: 180, protein: 12, carbs: 16, fat: 8, portionLabel: "5 balls", portionLabelZh: "五粒", keywords: ["fish balls", "fish ball", "咖喱魚蛋", "魚蛋"], micros: { iron: 1.0, calcium: 40, potassium: 200, vitaminC: 2, vitaminD: 0.6 } },
  { name: "Cereal", nameZh: "麥片", calories: 150, protein: 5, carbs: 27, fat: 3, portionLabel: "1 bowl", portionLabelZh: "一碗", keywords: ["cereal", "oatmeal", "oats", "麥片"], micros: { iron: 4.5, calcium: 120, potassium: 200, vitaminC: 6, vitaminD: 1.5 } },
  { name: "Mixed Berries", nameZh: "雜莓", calories: 60, protein: 1, carbs: 14, fat: 0, portionLabel: "1 handful", portionLabelZh: "一把", keywords: ["mixed berries", "berries", "莓", "雜莓"], micros: { iron: 0.4, calcium: 15, potassium: 110, vitaminC: 20, vitaminD: 0 } },
];
