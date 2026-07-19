import { Recipe } from "@/types";

// Local demo recipes seeded into the recipe store on first run. The first two mirror
// database/seed.sql exactly so the Supabase seed and the on-device seed agree. Quantities
// are stored in canonical units (g / ml / piece); displayUnit keeps the cook's original
// wet-market unit so the UnitToggle can show 兩 / 湯匙 etc.
const SEED_DATE = "2026-01-01T00:00:00.000Z";
const SEED_USER = "guest";

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: "seed-steamed-egg",
    userId: SEED_USER,
    title: "Steamed Egg with Minced Pork",
    titleZh: "肉碎蒸水蛋",
    servings: 2,
    sourceType: "manual",
    sourceUrl: null,
    imageUri: null,
    totalMinutes: 20,
    createdAt: SEED_DATE,
    ingredients: [
      { id: "se-i1", recipeId: "seed-steamed-egg", name: "Egg", nameZh: "雞蛋", quantity: 3, unit: "piece", displayUnit: "piece", rawText: "3 eggs / 雞蛋三隻", substitutedFrom: null },
      { id: "se-i2", recipeId: "seed-steamed-egg", name: "Pork", nameZh: "豬肉", quantity: 151.2, unit: "g", displayUnit: "tael", rawText: "minced pork / 免治豬肉 4 兩", substitutedFrom: null },
      { id: "se-i3", recipeId: "seed-steamed-egg", name: "Soy sauce", nameZh: "豉油", quantity: 15, unit: "ml", displayUnit: "tbsp", rawText: "soy sauce / 豉油 1 湯匙", substitutedFrom: null },
    ],
    steps: [
      { id: "se-s1", recipeId: "seed-steamed-egg", stepNumber: 1, instruction: "Beat eggs with 1.5x water and a pinch of salt.", instructionZh: "雞蛋加 1.5 倍水同少許鹽拂勻。", imageUri: null, durationSeconds: null },
      { id: "se-s2", recipeId: "seed-steamed-egg", stepNumber: 2, instruction: "Add minced pork, steam on medium for 10 minutes.", instructionZh: "加免治豬肉，中火蒸 10 分鐘。", imageUri: null, durationSeconds: 600 },
      { id: "se-s3", recipeId: "seed-steamed-egg", stepNumber: 3, instruction: "Drizzle soy sauce and sesame oil, then serve.", instructionZh: "灒豉油同麻油，完成。", imageUri: null, durationSeconds: null },
    ],
  },
  {
    id: "seed-tomato-egg",
    userId: SEED_USER,
    title: "Tomato and Egg Stir-fry",
    titleZh: "番茄炒蛋",
    servings: 2,
    sourceType: "manual",
    sourceUrl: null,
    imageUri: null,
    totalMinutes: 15,
    createdAt: SEED_DATE,
    ingredients: [
      { id: "te-i1", recipeId: "seed-tomato-egg", name: "Tomato", nameZh: "番茄", quantity: 3, unit: "piece", displayUnit: "piece", rawText: "tomatoes / 番茄三個", substitutedFrom: null },
      { id: "te-i2", recipeId: "seed-tomato-egg", name: "Egg", nameZh: "雞蛋", quantity: 4, unit: "piece", displayUnit: "piece", rawText: "eggs / 雞蛋四隻", substitutedFrom: null },
      { id: "te-i3", recipeId: "seed-tomato-egg", name: "Sugar", nameZh: "糖", quantity: 10, unit: "g", displayUnit: "tsp", rawText: "sugar / 糖 2 茶匙", substitutedFrom: null },
      { id: "te-i4", recipeId: "seed-tomato-egg", name: "Spring onion", nameZh: "葱", quantity: 1, unit: "piece", displayUnit: "piece", rawText: "spring onion / 葱一條", substitutedFrom: null },
    ],
    steps: [
      { id: "te-s1", recipeId: "seed-tomato-egg", stepNumber: 1, instruction: "Beat eggs, scramble until just set, then set aside.", instructionZh: "雞蛋拂勻，炒至剛熟盛起。", imageUri: null, durationSeconds: null },
      { id: "te-s2", recipeId: "seed-tomato-egg", stepNumber: 2, instruction: "Stir-fry tomato wedges with a little sugar until soft.", instructionZh: "番茄切角，加少許糖炒軟。", imageUri: null, durationSeconds: null },
      { id: "te-s3", recipeId: "seed-tomato-egg", stepNumber: 3, instruction: "Return eggs, toss together, finish with spring onion.", instructionZh: "回鑊兜勻，灑葱花完成。", imageUri: null, durationSeconds: null },
    ],
  },
  {
    id: "seed-soy-chicken",
    userId: SEED_USER,
    title: "Soy Sauce Braised Chicken",
    titleZh: "豉油雞",
    servings: 4,
    sourceType: "manual",
    sourceUrl: null,
    imageUri: null,
    totalMinutes: 45,
    createdAt: SEED_DATE,
    ingredients: [
      { id: "sc-i1", recipeId: "seed-soy-chicken", name: "Chicken", nameZh: "雞肉", quantity: 786.23, unit: "g", displayUnit: "catty", rawText: "chicken / 雞 1.3 斤", substitutedFrom: null },
      { id: "sc-i2", recipeId: "seed-soy-chicken", name: "Soy sauce", nameZh: "豉油", quantity: 60, unit: "ml", displayUnit: "tbsp", rawText: "light soy sauce / 生抽 4 湯匙", substitutedFrom: null },
      { id: "sc-i3", recipeId: "seed-soy-chicken", name: "Dark soy sauce", nameZh: "老抽", quantity: 15, unit: "ml", displayUnit: "tbsp", rawText: "dark soy sauce / 老抽 1 湯匙", substitutedFrom: null },
      { id: "sc-i4", recipeId: "seed-soy-chicken", name: "Sugar", nameZh: "糖", quantity: 20, unit: "g", displayUnit: "g", rawText: "rock sugar / 冰糖 20 克", substitutedFrom: null },
      { id: "sc-i5", recipeId: "seed-soy-chicken", name: "Ginger", nameZh: "薑", quantity: 3, unit: "piece", displayUnit: "piece", rawText: "ginger slices / 薑 3 片", substitutedFrom: null },
      { id: "sc-i6", recipeId: "seed-soy-chicken", name: "Spring onion", nameZh: "葱", quantity: 2, unit: "piece", displayUnit: "piece", rawText: "spring onion / 葱 2 條", substitutedFrom: null },
      { id: "sc-i7", recipeId: "seed-soy-chicken", name: "Shaoxing wine", nameZh: "紹興酒", quantity: 15, unit: "ml", displayUnit: "tbsp", rawText: "shaoxing wine / 紹興酒 1 湯匙", substitutedFrom: null },
    ],
    steps: [
      { id: "sc-s1", recipeId: "seed-soy-chicken", stepNumber: 1, instruction: "Smash ginger and spring onion, lay them in a pot with the chicken.", instructionZh: "薑同葱拍鬆，連雞放入鍋。", imageUri: null, durationSeconds: null },
      { id: "sc-s2", recipeId: "seed-soy-chicken", stepNumber: 2, instruction: "Add soy sauces, sugar, wine and enough water to half-cover.", instructionZh: "加生抽、老抽、糖、酒同半浸嘅水。", imageUri: null, durationSeconds: null },
      { id: "sc-s3", recipeId: "seed-soy-chicken", stepNumber: 3, instruction: "Cover and braise on low, turning once, for 25 minutes.", instructionZh: "加蓋細火炆，中途反一次，炆 25 分鐘。", imageUri: null, durationSeconds: 1500 },
      { id: "sc-s4", recipeId: "seed-soy-chicken", stepNumber: 4, instruction: "Rest off the heat for 5 minutes, then chop and serve.", instructionZh: "熄火焗 5 分鐘，斬件上碟。", imageUri: null, durationSeconds: 300 },
    ],
  },
];
