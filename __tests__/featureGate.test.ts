import { featureMeetsTier } from "@/hooks/useFeatureAccess";

// The tier half of feature access, split out of the hook so the paywall policy is provable
// without rendering. `hasAccess` layers the free ai_log weekly quota on top of this; everything
// else is pure tier math. These tests pin the four Pro perks that have real UI surfaces
// (url_scraper, recipe_modifier, wet_market_units, pantry_suggest) plus the existing macro/micro
// drawers, so a stray edit to FEATURE_MIN_TIER can't silently drop a paywall.

describe("featureMeetsTier — free tier", () => {
  it("clears the everyday free features", () => {
    expect(featureMeetsTier("free", "total_calories")).toBe(true);
    expect(featureMeetsTier("free", "ai_log")).toBe(true);
    expect(featureMeetsTier("free", "local_metrics")).toBe(true);
    expect(featureMeetsTier("free", "local_checklist")).toBe(true);
  });

  it("is blocked from every Pro perk", () => {
    expect(featureMeetsTier("free", "url_scraper")).toBe(false);
    expect(featureMeetsTier("free", "recipe_modifier")).toBe(false);
    expect(featureMeetsTier("free", "wet_market_units")).toBe(false);
    expect(featureMeetsTier("free", "macro_drawer")).toBe(false);
    expect(featureMeetsTier("free", "micro_tracker")).toBe(false);
    expect(featureMeetsTier("free", "unlimited_ai")).toBe(false);
    expect(featureMeetsTier("free", "pantry_suggest")).toBe(false);
  });

  it("is blocked from every Max perk", () => {
    expect(featureMeetsTier("free", "family_sync")).toBe(false);
    expect(featureMeetsTier("free", "household_calendar")).toBe(false);
    expect(featureMeetsTier("free", "grocery_export")).toBe(false);
  });
});

describe("featureMeetsTier — pro tier", () => {
  it("unlocks the Pro perks, including the gated UI surfaces", () => {
    expect(featureMeetsTier("pro", "url_scraper")).toBe(true);
    expect(featureMeetsTier("pro", "recipe_modifier")).toBe(true);
    expect(featureMeetsTier("pro", "wet_market_units")).toBe(true);
    expect(featureMeetsTier("pro", "pantry_suggest")).toBe(true);
    expect(featureMeetsTier("pro", "macro_drawer")).toBe(true);
    expect(featureMeetsTier("pro", "micro_tracker")).toBe(true);
  });

  it("still cannot reach the Max suite", () => {
    expect(featureMeetsTier("pro", "family_sync")).toBe(false);
    expect(featureMeetsTier("pro", "household_calendar")).toBe(false);
    expect(featureMeetsTier("pro", "grocery_export")).toBe(false);
  });
});

describe("featureMeetsTier — max tier", () => {
  it("unlocks everything, Pro perks and Max suite alike", () => {
    expect(featureMeetsTier("max", "url_scraper")).toBe(true);
    expect(featureMeetsTier("max", "recipe_modifier")).toBe(true);
    expect(featureMeetsTier("max", "wet_market_units")).toBe(true);
    expect(featureMeetsTier("max", "pantry_suggest")).toBe(true);
    expect(featureMeetsTier("max", "family_sync")).toBe(true);
    expect(featureMeetsTier("max", "household_calendar")).toBe(true);
    expect(featureMeetsTier("max", "grocery_export")).toBe(true);
  });
});
