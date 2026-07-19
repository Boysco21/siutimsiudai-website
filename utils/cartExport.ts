import { GroceryListItem, PantryItem, Recipe, StoreItemMatch } from "@/types";
import { RetailerConfig, SearchLanguage } from "@/constants/retailers";
import { canonicalizeIngredient } from "@/constants/ingredientDictionary";
import { mergeIngredients, MergeInput } from "./groceryMerge";

/**
 * The missing shopping list for a single recipe: merge the recipe's ingredients (folding bilingual
 * duplicates and canonicalising names through the dictionary), deduct whatever the pantry already
 * has in stock, and keep only what's still short. Reuses the exact grocery-merge path the app uses
 * everywhere else, so "missing" here means the same thing as on the grocery screen.
 */
export function missingItemsFromRecipe(recipe: Recipe, pantry: PantryItem[]): GroceryListItem[] {
  const inputs: MergeInput[] = recipe.ingredients.map((ing) => ({
    ingredient: {
      name: ing.name,
      nameZh: ing.nameZh,
      quantity: ing.quantity,
      unit: ing.unit,
      displayUnit: ing.displayUnit,
    },
    recipeId: recipe.id,
  }));
  return mergeIngredients(inputs, pantry, recipe.id).filter((item) => item.quantity > 0);
}

/**
 * The language rule, in one place: HKTVmall (en) searches the English name; Wellcome and ParknShop
 * (zh) search the Traditional Chinese name, falling back to the other field if a line somehow lacks
 * the preferred one.
 */
export function searchTermFor(
  item: Pick<GroceryListItem, "name" | "nameZh">,
  lang: SearchLanguage,
): string {
  if (lang === "zh") return item.nameZh.trim() || item.name;
  return item.name.trim() || item.nameZh;
}

/**
 * A compact, human-readable amount for the clipboard list. Piece counts read as "x3"; masses and
 * volumes read as "400g" / "15ml". The store search itself only needs the name, but a shopper
 * reading the pasted list wants the quantities too.
 */
export function humanizeAmount(quantity: number, unit: string): string {
  if (unit === "piece") return `x${quantity}`;
  return `${quantity}${unit}`;
}

/**
 * The full missing list as newline-separated text, every line in the store's language:
 * "<term> <amount>". This is the clipboard payload, and nothing is ever truncated, so even though a
 * deep link can only seed one search term the shopper still has the whole basket ready to paste.
 */
export function formatClipboardList(
  items: Array<Pick<GroceryListItem, "name" | "nameZh" | "quantity" | "unit">>,
  lang: SearchLanguage,
): string {
  return items
    .map((item) => `${searchTermFor(item, lang)} ${humanizeAmount(item.quantity, item.unit)}`)
    .join("\n");
}

// Fill a retailer URL template's {q} slot with a single URL-encoded search term. Kept separate so
// the encoding rule lives in one testable spot.
function fillTemplate(template: string, term: string): string {
  return template.replace("{q}", encodeURIComponent(term));
}

/**
 * The URL(s) to open for a retailer, seeded with the FIRST missing item so the shopper lands on a
 * real results page (the clipboard holds the rest). webUrl is always valid; deepLinkUrl is the
 * native app scheme when the retailer exposes one, otherwise it mirrors webUrl.
 */
export function buildSearchUrl(
  retailer: RetailerConfig,
  items: Array<Pick<GroceryListItem, "name" | "nameZh">>,
): { webUrl: string; deepLinkUrl: string } {
  const firstTerm = items.length > 0 ? searchTermFor(items[0], retailer.searchLanguage) : "";
  const webUrl = fillTemplate(retailer.webSearchTemplate, firstTerm);
  const deepLinkUrl = retailer.appSearchTemplate
    ? fillTemplate(retailer.appSearchTemplate, firstTerm)
    : webUrl;
  return { webUrl, deepLinkUrl };
}

/**
 * Check one retailer's catalogue against the missing list. Carry-status is decided on the canonical
 * key (language-independent) so it stays consistent, while the `term` we surface is in the store's
 * language. `gaps` is the set of canonical keys the store does not stock.
 */
export function matchAvailabilityFor(
  items: Array<Pick<GroceryListItem, "id" | "name" | "nameZh">>,
  retailer: RetailerConfig,
  gaps: string[],
): StoreItemMatch[] {
  const gapSet = new Set(gaps);
  return items.map((item) => ({
    itemId: item.id,
    term: searchTermFor(item, retailer.searchLanguage),
    available: !gapSet.has(canonicalizeIngredient(item.name)),
  }));
}
