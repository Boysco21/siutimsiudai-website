import {
  buildSearchUrl,
  formatClipboardList,
  humanizeAmount,
  matchAvailabilityFor,
  missingItemsFromRecipe,
  searchTermFor,
} from "@/utils/cartExport";
import { cartExportService } from "@/services/cartExportService";
import { RETAILERS } from "@/constants/retailers";
import { canonicalizeIngredient } from "@/constants/ingredientDictionary";
import { CanonicalUnit, GroceryListItem, PantryItem, Recipe, RecipeIngredient } from "@/types";

// The 1-Click Cart Export logic (Max perk), proven without rendering. The three guarantees that
// matter: (1) the language rule — HKTVmall searches in English, Wellcome and ParknShop in Chinese;
// (2) availability numbers are deterministic per store so the comparison modal is stable and the
// mock is swap-ready; (3) "missing" reuses the same pantry-aware grocery merge as the rest of the
// app. No clipboard/Linking here: those are side effects wired at the UI call site.

function gli(
  over: Partial<GroceryListItem> & Pick<GroceryListItem, "name" | "nameZh">,
): GroceryListItem {
  const unit = over.unit ?? "piece";
  return {
    id: over.id ?? `gli-${over.name}`,
    groceryListId: "test",
    name: over.name,
    nameZh: over.nameZh,
    quantity: over.quantity ?? 1,
    unit,
    displayUnit: over.displayUnit ?? unit,
    checked: over.checked ?? false,
    sourceRecipeIds: over.sourceRecipeIds ?? ["r1"],
    mergedFrom: over.mergedFrom ?? [over.name],
    inPantry: over.inPantry ?? false,
  };
}

// The "Soy Sauce Braised Chicken" missing set: four items, each a canonical dictionary key.
const MISSING: GroceryListItem[] = [
  gli({ name: "Chicken", nameZh: "雞肉", quantity: 400, unit: "g" }),
  gli({ name: "Dark soy sauce", nameZh: "老抽", quantity: 15, unit: "ml" }),
  gli({ name: "Ginger", nameZh: "薑", quantity: 2, unit: "piece" }),
  gli({ name: "Shaoxing wine", nameZh: "紹興酒", quantity: 15, unit: "ml" }),
];

describe("searchTermFor — the language rule", () => {
  it("hands HKTVmall (en) the English name", () => {
    expect(searchTermFor(MISSING[0], "en")).toBe("Chicken");
  });

  it("hands Wellcome / ParknShop (zh) the Traditional Chinese name", () => {
    expect(searchTermFor(MISSING[0], "zh")).toBe("雞肉");
  });

  it("falls back to the other field when the preferred one is blank", () => {
    expect(searchTermFor({ name: "Egg", nameZh: "" }, "zh")).toBe("Egg");
    expect(searchTermFor({ name: "", nameZh: "蛋" }, "en")).toBe("蛋");
  });
});

describe("humanizeAmount", () => {
  it("reads piece counts as x-notation and masses/volumes with their unit", () => {
    expect(humanizeAmount(3, "piece")).toBe("x3");
    expect(humanizeAmount(400, "g")).toBe("400g");
    expect(humanizeAmount(15, "ml")).toBe("15ml");
  });
});

describe("formatClipboardList — full list, one language throughout", () => {
  it("uses English names end to end for HKTVmall", () => {
    expect(formatClipboardList(MISSING, "en")).toBe(
      "Chicken 400g\nDark soy sauce 15ml\nGinger x2\nShaoxing wine 15ml",
    );
  });

  it("uses Traditional Chinese names end to end for the supermarkets", () => {
    expect(formatClipboardList(MISSING, "zh")).toBe("雞肉 400g\n老抽 15ml\n薑 x2\n紹興酒 15ml");
  });
});

describe("buildSearchUrl — seeded with the first item, encoded, per-store language", () => {
  it("builds an English web + app URL for HKTVmall", () => {
    const { webUrl, deepLinkUrl } = buildSearchUrl(RETAILERS.hktvmall, MISSING);
    expect(webUrl).toBe("https://www.hktvmall.com/hktv/en/search?q=Chicken");
    expect(deepLinkUrl).toBe("hktvmall://search?q=Chicken");
  });

  it("builds a Chinese web URL for Wellcome and mirrors it as the deep link (no app scheme)", () => {
    const { webUrl, deepLinkUrl } = buildSearchUrl(RETAILERS.wellcome, MISSING);
    expect(webUrl).toBe(
      `https://www.wellcome.com.hk/zh-hk/search?q=${encodeURIComponent("雞肉")}`,
    );
    expect(deepLinkUrl).toBe(webUrl);
  });

  it("degrades to an empty query when there is nothing missing", () => {
    expect(buildSearchUrl(RETAILERS.hktvmall, []).webUrl).toBe(
      "https://www.hktvmall.com/hktv/en/search?q=",
    );
  });
});

describe("matchAvailabilityFor — canonical carry-status, language-correct term", () => {
  it("marks everything available for a store with no catalogue gaps", () => {
    const matches = matchAvailabilityFor(MISSING, RETAILERS.hktvmall, []);
    expect(matches.every((m) => m.available)).toBe(true);
    expect(matches[0].term).toBe("Chicken"); // en term surfaced
  });

  it("marks a gapped item unavailable while still surfacing its Chinese term", () => {
    const matches = matchAvailabilityFor(MISSING, RETAILERS.wellcome, ["shaoxing wine"]);
    const wine = matches.find((m) => m.itemId === MISSING[3].id)!;
    expect(wine.available).toBe(false);
    expect(wine.term).toBe("紹興酒");
    expect(matches.filter((m) => m.available).length).toBe(3);
  });
});

describe("cartExportService.checkAvailability — deterministic three-store comparison", () => {
  it("orders widest-catalogue first with the expected found counts", async () => {
    const res = await cartExportService.checkAvailability(MISSING);
    expect(res.map((r) => r.retailer)).toEqual(["hktvmall", "wellcome", "parknshop"]);
    expect(res[0]).toMatchObject({ retailer: "hktvmall", foundCount: 4, totalCount: 4 });
    expect(res[1]).toMatchObject({ retailer: "wellcome", foundCount: 3, totalCount: 4 });
    expect(res[2]).toMatchObject({ retailer: "parknshop", foundCount: 3, totalCount: 4 });
  });

  it("returns identical results across calls (stable, not random)", async () => {
    const a = await cartExportService.checkAvailability(MISSING);
    const b = await cartExportService.checkAvailability(MISSING);
    expect(a).toEqual(b);
  });
});

describe("cartExportService.buildExport — language-correct clipboard + URLs", () => {
  it("gives HKTVmall an English clipboard list and store URL", () => {
    const p = cartExportService.buildExport("hktvmall", MISSING);
    expect(p.clipboardText.split("\n")[0]).toBe("Chicken 400g");
    expect(p.webUrl).toContain("hktvmall.com");
    expect(p.retailer).toBe("hktvmall");
  });

  it("gives Wellcome a Chinese clipboard list", () => {
    const p = cartExportService.buildExport("wellcome", MISSING);
    expect(p.clipboardText.split("\n")[0]).toBe("雞肉 400g");
    expect(p.webUrl).toContain("wellcome.com.hk");
  });
});

describe("missingItemsFromRecipe — pantry-aware, reuses the grocery merge", () => {
  const ing = (
    name: string,
    nameZh: string,
    quantity: number,
    unit: CanonicalUnit,
  ): RecipeIngredient => ({
    id: `i-${name}`,
    recipeId: "r1",
    name,
    nameZh,
    quantity,
    unit,
    displayUnit: unit,
    rawText: name,
    substitutedFrom: null,
  });

  const recipe: Recipe = {
    id: "r1",
    userId: "guest",
    title: "Test dish",
    titleZh: "測試",
    servings: 2,
    sourceType: "manual",
    sourceUrl: null,
    imageUri: null,
    totalMinutes: 20,
    ingredients: [ing("Chicken", "雞肉", 400, "g"), ing("Egg", "雞蛋", 3, "piece")],
    steps: [],
    createdAt: new Date("2026-01-01").toISOString(),
  };

  const pantry: PantryItem[] = [
    {
      id: "p-egg",
      userId: "guest",
      name: "Egg",
      nameZh: "雞蛋",
      quantity: 10,
      unit: "piece",
      inStock: true,
      updatedAt: new Date("2026-01-01").toISOString(),
    },
  ];

  it("keeps only what the pantry cannot cover", () => {
    const missing = missingItemsFromRecipe(recipe, pantry);
    const keys = missing.map((m) => canonicalizeIngredient(m.name));
    expect(keys).toContain("chicken"); // not stocked -> still needed
    expect(keys).not.toContain("egg"); // 10 in the pantry covers the 3 required
    expect(missing.every((m) => m.quantity > 0)).toBe(true);
  });
});
