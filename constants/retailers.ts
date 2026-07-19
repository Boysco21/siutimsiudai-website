import { GroceryRetailer } from "@/types";

export type SearchLanguage = "en" | "zh";

export interface RetailerConfig {
  id: GroceryRetailer;
  name: string;
  nameZh: string;
  // Which name field we search this store with. HKTVmall's catalogue is indexed in English; the
  // two local supermarket chains match far better on Traditional Chinese SKU names, so we hand
  // them nameZh. This is the whole of the "language rule" as data.
  searchLanguage: SearchLanguage;
  brandColor: string; // drives the store row accent in the comparison modal
  // https search-results endpoint. {q} is replaced with the URL-encoded first missing item so the
  // shopper lands on a real results page. These are best-effort public search URLs: correct them
  // at build time or swap for an official endpoint later. The clipboard carries the full list
  // regardless, so a stale template degrades to "store opens, user pastes" rather than breaking.
  webSearchTemplate: string;
  // Native app deep link, attempted before the web fallback and guarded by Linking.canOpenURL at
  // the call site. Absent where the retailer exposes no documented scheme, in which case the
  // export opens the web URL instead.
  appSearchTemplate?: string;
}

// Fixed display order for the comparison modal (widest catalogue first).
export const RETAILER_ORDER: GroceryRetailer[] = ["hktvmall", "wellcome", "parknshop"];

export const RETAILERS: Record<GroceryRetailer, RetailerConfig> = {
  hktvmall: {
    id: "hktvmall",
    name: "HKTVmall",
    nameZh: "HKTVmall",
    searchLanguage: "en",
    brandColor: "#00A040",
    webSearchTemplate: "https://www.hktvmall.com/hktv/en/search?q={q}",
    appSearchTemplate: "hktvmall://search?q={q}",
  },
  wellcome: {
    id: "wellcome",
    name: "Wellcome",
    nameZh: "惠康",
    searchLanguage: "zh",
    brandColor: "#E2231A",
    webSearchTemplate: "https://www.wellcome.com.hk/zh-hk/search?q={q}",
  },
  parknshop: {
    id: "parknshop",
    name: "PARKnSHOP",
    nameZh: "百佳",
    searchLanguage: "zh",
    brandColor: "#F26521",
    webSearchTemplate: "https://www.parknshop.com/zh-hk/search?q={q}",
  },
};

// Canonical ingredient keys each retailer does NOT stock in our mock catalogue. HKTVmall is the
// online megastore (no gaps); the supermarket chains miss a few specialty items, which is exactly
// what gives the comparison modal something to compare. Deterministic on purpose so the numbers
// are stable across renders and unit-testable. Swap this for a live product-search API behind
// cartExportService and neither the types nor the UI change.
export const MOCK_RETAILER_GAPS: Record<GroceryRetailer, string[]> = {
  hktvmall: [],
  wellcome: ["shaoxing wine"],
  parknshop: ["dark soy sauce"],
};
