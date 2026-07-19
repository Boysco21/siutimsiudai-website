import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./persistStorage";

// The three tiers the whole app gates on. Ranked free < pro < max in useFeatureAccess.
export type SubscriptionTier = "free" | "pro" | "max";

// A casual eater gets five AI-assisted logs a week before the paywall taps them on the
// shoulder. Exported as a constant so gating logic can reference it without a store read,
// and mirrored into state below so the store stays the single source of truth.
export const MAX_WEEKLY_FREE_AI_LOGS = 5;

// One weekly cycle in milliseconds. The rolling allotment resets exactly seven days after the
// first log of a cycle, not on a fixed calendar weekday, so the clock starts when the user
// actually starts logging.
export const QUOTA_CYCLE_MS = 7 * 24 * 60 * 60 * 1000;

// --- Pure quota-cycle helpers --------------------------------------------------------------
//
// Kept free of store and clock so the weekly-allotment policy can be unit-tested with an
// explicit `nowMs`. The gating hook reads through these (a stale cycle reports zero without
// mutating anything); incrementAiLog is the only writer that physically rolls the cycle over.

// Is the weekly cycle still open? A null reset date means no cycle has started (fresh install
// or just after a reset); a reset date at or before now means last week's cycle has lapsed.
export function isQuotaCycleActive(quotaResetDate: string | null, nowMs: number): boolean {
  if (!quotaResetDate) return false;
  const resetMs = Date.parse(quotaResetDate);
  return Number.isFinite(resetMs) && nowMs < resetMs;
}

// The tally that actually applies right now. Once the cycle lapses this reads as zero, so a
// free user's quota is restored the moment the week is up even before the next write lands.
export function effectiveWeeklyCount(
  weeklyAiLogCount: number,
  quotaResetDate: string | null,
  nowMs: number,
): number {
  return isQuotaCycleActive(quotaResetDate, nowMs) ? weeklyAiLogCount : 0;
}

// Stamp a fresh cycle expiry: exactly seven days out from the first log of the cycle.
export function nextQuotaReset(nowMs: number): string {
  return new Date(nowMs + QUOTA_CYCLE_MS).toISOString();
}

// RevenueCat entitlement identifiers, mapped to our tiers. These strings are configured in
// the RevenueCat dashboard and, once a purchase clears, arrive inside the server-validated
// customerInfo.entitlements.active map. That server truth is the security boundary; the local
// activeTier below is only a UX mirror of it, never a gate a client can forge. Keep the keys
// here in lockstep with the dashboard's "Entitlements" setup (see services/revenueCatService).
export const ENTITLEMENT_TIER_MAP: Record<string, SubscriptionTier> = {
  pro_tier: "pro",
  max_tier: "max",
};

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

// True for any paying tier (pro or max). The single predicate premium-only capabilities gate on,
// e.g. retaining per-meal micronutrients in history or unlocking the detailed vitamins & minerals
// panel. Pure so it can be unit-tested and read imperatively from stores that can't use the
// useFeatureAccess hook. The server entitlement stays the real boundary; this only mirrors it.
export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier !== "free";
}

// The plan every brand-new account begins on. A first-time registrant has purchased nothing, so
// the local tier mirror must read "free" until — and unless — a server-validated RevenueCat
// entitlement raises it. Exported as the SINGLE definition the store's initial state AND the
// new-account reset both derive from, so the default can never silently drift to a paid plan.
export const NEW_ACCOUNT_TIER: SubscriptionTier = "free";

// How the health-profile form should present the premium daily vitamins & minerals panel.
//   values  -> show the real numbers (paid tiers only)
//   upsell  -> a locked •••• teaser with a tappable paywall prompt (free tier, where /subscription
//              is reachable, e.g. the profile-tab "Nutrition needs" sheet)
//   hidden  -> omit the panel entirely (free tier on the forced first-run setup, where the route
//              gate pins the user on /profile-setup so the paywall can't open — an inert lock there
//              would be worse than simply not surfacing premium data)
export type MicrosPresentation = "values" | "upsell" | "hidden";

// The single decision that keeps daily micronutrient figures premium-only. Paid tiers always see
// the real values; a free tier NEVER does — it only chooses between an upsell teaser and hiding the
// panel, per the screen's policy. Pure so the "free users can't see micros" guarantee is provable
// in a unit test without rendering the form or booting the paywall.
export function resolveMicrosPresentation(
  tier: SubscriptionTier,
  freeTierMode: "upsell" | "hidden",
): MicrosPresentation {
  return isPaidTier(tier) ? "values" : freeTierMode;
}

// Resolve the highest tier a customer is actually entitled to from their *active* entitlement
// ids (the keys of customerInfo.entitlements.active). Unknown ids are ignored, and an empty
// list means every subscription has lapsed, so we fall back to free. Kept pure and SDK-free so
// the entitlement policy can be unit-tested without pulling in react-native-purchases.
export function resolveTierFromEntitlements(activeEntitlementIds: string[]): SubscriptionTier {
  let best: SubscriptionTier = "free";
  for (const id of activeEntitlementIds) {
    const tier = ENTITLEMENT_TIER_MAP[id];
    if (tier && TIER_RANK[tier] > TIER_RANK[best]) best = tier;
  }
  return best;
}

interface SubscriptionState {
  activeTier: SubscriptionTier;
  // Total AI-assisted logs submitted in the current weekly cycle. Read through
  // effectiveWeeklyCount so a lapsed cycle counts as zero without a write.
  weeklyAiLogCount: number;
  // Fixed ceiling on free AI logs per week. Lives in state to match the spec; never persisted,
  // so it always tracks the constant above even after an app update changes it.
  maxWeeklyFreeAiLogs: number;
  // ISO timestamp the current weekly cycle expires, or null when no cycle is running. Set to
  // "now + 7 days" on the first log of a cycle; once now passes it, the tally resets.
  quotaResetDate: string | null;
  hasHydrated: boolean;

  setTier: (tier: SubscriptionTier) => void;
  // Sync the tier from RevenueCat's server-validated active entitlements. Pass the keys of
  // customerInfo.entitlements.active; unmapped ids are ignored and an empty list resets to free.
  // This is what the CustomerInfo listener calls, so the store always mirrors the store receipt.
  setTierFromEntitlements: (activeEntitlementIds: string[]) => void;
  // Reset the local tier mirror to the free default for a brand-new account (a fresh sign-up, or
  // the account boundary when a user signs out). Tier only — never the weekly quota. See the impl.
  resetTierForNewAccount: () => void;
  incrementAiLog: () => void;
  resetWeeklyLogs: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      activeTier: NEW_ACCOUNT_TIER,
      weeklyAiLogCount: 0,
      maxWeeklyFreeAiLogs: MAX_WEEKLY_FREE_AI_LOGS,
      quotaResetDate: null,
      hasHydrated: false,

      setTier: (activeTier) => set({ activeTier }),

      setTierFromEntitlements: (ids) => set({ activeTier: resolveTierFromEntitlements(ids) }),

      // Force the local tier mirror back to the free default for a brand-new account — a fresh
      // sign-up, or the account boundary the moment a user signs out. Guards two shared-device
      // leaks that live only in the persisted mirror: a previous user's paid tier, and a leftover
      // simulated-checkout purchase. Tier ONLY: the weekly AI-log quota is deliberately preserved
      // so signing out and back in can't refill it. A live RevenueCat sync then raises this to the
      // real server-validated entitlement (still free for a genuine first-time user).
      resetTierForNewAccount: () => set({ activeTier: NEW_ACCOUNT_TIER }),

      incrementAiLog: () =>
        set((state) => {
          const now = Date.now();
          // First log of a fresh cycle (or the previous week has fully lapsed): restart the
          // tally at one and anchor a new seven-day expiry from this moment.
          if (!isQuotaCycleActive(state.quotaResetDate, now)) {
            return { weeklyAiLogCount: 1, quotaResetDate: nextQuotaReset(now) };
          }
          return { weeklyAiLogCount: state.weeklyAiLogCount + 1 };
        }),

      // Wipe the weekly tally and clear the cycle so the next log starts a fresh seven days.
      resetWeeklyLogs: () => set({ weeklyAiLogCount: 0, quotaResetDate: null }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "siutimsiudai-subscription",
      storage: persistStorage,
      // Persist the tier and the weekly tally + its expiry so an upgrade survives a reboot and
      // the free quota can't be reset by force-quitting. maxWeeklyFreeAiLogs stays out on purpose.
      partialize: (s) => ({
        activeTier: s.activeTier,
        weeklyAiLogCount: s.weeklyAiLogCount,
        quotaResetDate: s.quotaResetDate,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
