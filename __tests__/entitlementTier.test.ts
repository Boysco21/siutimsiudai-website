import {
  ENTITLEMENT_TIER_MAP,
  NEW_ACCOUNT_TIER,
  resolveTierFromEntitlements,
  useSubscriptionStore,
} from "@/stores/useSubscriptionStore";

// The entitlement -> tier resolver is the client-side reflection of RevenueCat's
// server-validated receipt. It must never over-grant (unknown ids stay free) and must always
// settle on the *highest* active tier so a user who owns Max is never shown as merely Pro.
describe("resolveTierFromEntitlements", () => {
  it("maps the pro_tier entitlement to the pro plan", () => {
    expect(resolveTierFromEntitlements(["pro_tier"])).toBe("pro");
  });

  it("maps the max_tier entitlement to the max plan", () => {
    expect(resolveTierFromEntitlements(["max_tier"])).toBe("max");
  });

  it("falls back to free when no entitlements are active (lapsed / never subscribed)", () => {
    expect(resolveTierFromEntitlements([])).toBe("free");
  });

  it("ignores entitlement ids that aren't in the tier map (promos, legacy grants)", () => {
    expect(resolveTierFromEntitlements(["some_promo", "legacy_grant"])).toBe("free");
  });

  it("resolves the highest tier when several are active, regardless of order", () => {
    expect(resolveTierFromEntitlements(["pro_tier", "max_tier"])).toBe("max");
    expect(resolveTierFromEntitlements(["max_tier", "pro_tier"])).toBe("max");
  });

  it("keeps the top tier even when lower or unknown entitlements sit alongside it", () => {
    expect(resolveTierFromEntitlements(["max_tier", "pro_tier", "mystery"])).toBe("max");
  });

  it("exposes exactly the dashboard entitlement mapping the service relies on", () => {
    expect(ENTITLEMENT_TIER_MAP).toEqual({ pro_tier: "pro", max_tier: "max" });
  });
});

// A first-time registrant must land on Free. The store's initial mirror and the explicit
// new-account reset both derive from NEW_ACCOUNT_TIER, so the default can't silently drift to a
// paid plan and a shared device can't leak a previous user's tier into a fresh sign-up.
describe("new account defaults to the free plan", () => {
  it("pins the new-account tier to free", () => {
    expect(NEW_ACCOUNT_TIER).toBe("free");
  });

  it("initialises the subscription mirror on the free plan", () => {
    expect(useSubscriptionStore.getState().activeTier).toBe("free");
  });

  it("resets a leftover paid mirror back to free for a fresh registration", () => {
    useSubscriptionStore.getState().setTier("max");
    expect(useSubscriptionStore.getState().activeTier).toBe("max");

    useSubscriptionStore.getState().resetTierForNewAccount();
    expect(useSubscriptionStore.getState().activeTier).toBe("free");
  });

  it("leaves the weekly AI-log quota untouched so signing out and back in can't refill it", () => {
    useSubscriptionStore.getState().incrementAiLog();
    const spent = useSubscriptionStore.getState().weeklyAiLogCount;
    expect(spent).toBeGreaterThan(0);

    useSubscriptionStore.getState().resetTierForNewAccount();
    const s = useSubscriptionStore.getState();
    expect(s.activeTier).toBe("free"); // tier reset...
    expect(s.weeklyAiLogCount).toBe(spent); // ...but the quota is preserved
  });
});
