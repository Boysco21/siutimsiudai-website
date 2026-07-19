import { BarcodeProduct } from "@/types";
import { delay } from "./util";

export interface BarcodeService {
  // GS1 prefix 489 is Hong Kong. A real impl routes to Open Food Facts / FatSecret HK;
  // this mock serves a tiny catalogue and a generic fallback for any 489 code.
  lookup(code: string): Promise<BarcodeProduct | null>;
}

const CATALOGUE: Record<string, BarcodeProduct> = {
  "4891028714842": {
    barcode: "4891028714842",
    name: "Vitasoy Soya Milk",
    nameZh: "維他奶原味豆奶",
    brand: "Vitasoy",
    servingSize: "250 ml",
    isHongKong: true,
    calories: 130,
    protein: 7,
    carbs: 16,
    fat: 4,
  },
  "4892327000019": {
    barcode: "4892327000019",
    name: "Garden Life Bread",
    nameZh: "嘉頓生命麵包",
    brand: "Garden",
    servingSize: "2 slices",
    isHongKong: true,
    calories: 160,
    protein: 6,
    carbs: 30,
    fat: 2,
  },
};

export const barcodeService: BarcodeService = {
  async lookup(code) {
    await delay(500);
    const hit = CATALOGUE[code];
    if (hit) return hit;
    // Unknown but locally-issued code: hand back a generic HK product so the label-OCR
    // fallback is the explicit "no match" path rather than every 489 scan.
    if (code.startsWith("489")) {
      return {
        barcode: code,
        name: "HK packaged food",
        nameZh: "本地包裝食品",
        brand: null,
        servingSize: "1 serving",
        isHongKong: true,
        calories: 180,
        protein: 4,
        carbs: 28,
        fat: 6,
      };
    }
    return null;
  },
};
