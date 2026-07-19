// Mock service layer. Every service is an interface with a mock implementation, so
// dropping in a real provider later is one new file and zero UI changes.
export { visionFoodService, type VisionFoodService } from "./visionFoodService";
export { nlpMealService, type NlpMealService } from "./nlpMealService";
export { barcodeService, type BarcodeService } from "./barcodeService";
export { labelOcrService, type LabelOcrService } from "./labelOcrService";
export { recipeOcrService, type RecipeOcrService } from "./recipeOcrService";
export { recipeStructurer, type RecipeStructurer } from "./recipeStructurer";
export { urlScrapeService, type UrlScrapeService } from "./urlScrapeService";
export { translationService, translateText, type TranslationService } from "./translationService";
export { substitutionService, type SubstitutionService } from "./substitutionService";
export { healthySwapService, type HealthySwapService } from "./healthySwapService";
export { cartExportService, type CartExportService } from "./cartExportService";
export { storageService, type StorageService, type StorageBucket } from "./storageService";
export { supabase, isSupabaseConfigured } from "./supabase";
