import { retainMicrosForTier } from "@/stores/nutritionStore";
import { isPaidTier, resolveMicrosPresentation } from "@/stores/useSubscriptionStore";
import type { EntryMicronutrients } from "@/types";

// The premium policy for per-meal micronutrients, gated at the single daily-log save path. Free
// users' history holds macros + calories only; paid tiers (pro / max) also retain the detailed
// vitamins & minerals. Pure so the policy is provable without booting the store or the paywall UI.

const SAMPLE: EntryMicronutrients = {
  sodium: 480,
  calcium: 120,
  iron: 3.2,
  vitaminC: 15,
  vitaminD: 1.5,
};

describe("isPaidTier", () => {
  it("treats free as not paid", () => {
    expect(isPaidTier("free")).toBe(false);
  });

  it("treats pro and max as paid", () => {
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("max")).toBe(true);
  });
});

describe("retainMicrosForTier", () => {
  it("drops micros to null for free users so nothing premium lands in their history", () => {
    expect(retainMicrosForTier("free", SAMPLE)).toBeNull();
  });

  it("keeps the captured micros for paid tiers", () => {
    expect(retainMicrosForTier("pro", SAMPLE)).toEqual(SAMPLE);
    expect(retainMicrosForTier("max", SAMPLE)).toEqual(SAMPLE);
  });

  it("normalises an absent capture to null on every tier (no fabricated fields)", () => {
    expect(retainMicrosForTier("free", undefined)).toBeNull();
    expect(retainMicrosForTier("free", null)).toBeNull();
    expect(retainMicrosForTier("pro", undefined)).toBeNull();
    expect(retainMicrosForTier("max", null)).toBeNull();
  });

  it("does not invent data for a free user even when a capture is present", () => {
    // The gate strips, never mutates the source object: the caller's input is left intact.
    const input = { ...SAMPLE };
    expect(retainMicrosForTier("free", input)).toBeNull();
    expect(input).toEqual(SAMPLE);
  });
});

describe("resolveMicrosPresentation", () => {
  it("always shows real values to paid tiers, whatever the free-tier mode asks for", () => {
    // The free-tier preference is irrelevant once you're paying: pro/max always see the numbers.
    expect(resolveMicrosPresentation("pro", "upsell")).toBe("values");
    expect(resolveMicrosPresentation("pro", "hidden")).toBe("values");
    expect(resolveMicrosPresentation("max", "upsell")).toBe("values");
    expect(resolveMicrosPresentation("max", "hidden")).toBe("values");
  });

  it("never leaks real values to a free user on any screen", () => {
    // This is the guarantee: a free tier can only ever get the teaser or nothing, never "values".
    expect(resolveMicrosPresentation("free", "upsell")).not.toBe("values");
    expect(resolveMicrosPresentation("free", "hidden")).not.toBe("values");
  });

  it("gives a free user the upsell teaser where the paywall is reachable", () => {
    expect(resolveMicrosPresentation("free", "upsell")).toBe("upsell");
  });

  it("hides the panel entirely for a free user where the paywall can't open (first-run setup)", () => {
    expect(resolveMicrosPresentation("free", "hidden")).toBe("hidden");
  });
});
