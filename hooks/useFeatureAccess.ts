import { useCallback } from "react";
import { router } from "expo-router";
import { todayKey } from "@/utils/formatters";
import {
  SubscriptionTier,
  effectiveWeeklyCount,
  useSubscriptionStore,
} from "@/stores/useSubscriptionStore";

// Every gated capability in the app, keyed by a stable string and grouped by the tier that
// unlocks it. Add a row here plus one line in FEATURE_MIN_TIER and any surface can gate on
// it without touching the store or this hook's return shape.
export type Feature =
  // Free — the daily habit every casual eater gets
  | "total_calories"
  | "ai_log"
  | "local_metrics"
  | "local_checklist"
  // Pro — the Healthy Foodie kit
  | "unlimited_ai"
  | "macro_drawer"
  | "micro_tracker"
  | "recipe_modifier"
  | "url_scraper"
  | "wet_market_units"
  | "pantry_suggest"
  // Max — the Household Executive suite
  | "family_sync"
  | "household_calendar"
  | "grocery_export";

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

// The lowest tier that unlocks each feature. The single place feature-to-tier policy lives.
const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  total_calories: "free",
  ai_log: "free",
  local_metrics: "free",
  local_checklist: "free",
  unlimited_ai: "pro",
  macro_drawer: "pro",
  micro_tracker: "pro",
  recipe_modifier: "pro",
  url_scraper: "pro",
  wet_market_units: "pro",
  pantry_suggest: "pro",
  family_sync: "max",
  household_calendar: "max",
  grocery_export: "max",
};

// Pure tier-policy check: does `tier` clear the minimum tier that unlocks `feature`? This is the
// tier half of hasAccess, split out so gating policy is unit-testable without rendering the hook.
// Metered rules (the free ai_log weekly quota) live in the hook on top of this.
export function featureMeetsTier(tier: SubscriptionTier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export interface FeatureAccess {
  // Can the current tier use this feature right now? For "ai_log" this also respects the
  // free weekly quota, so it flips to false once a free user spends their last log.
  hasAccess: boolean;
  // AI logs left this week. Infinity for paid tiers (unlimited); use Number.isFinite to branch UI.
  remainingLogs: number;
  // Send the user to the paywall. Call this when hasAccess is false and they tap the action.
  triggerPaywall: () => void;
}

/**
 * The one hook every gated surface calls. Pass the feature string; get back whether the
 * active tier can use it, how many free AI logs remain this week, and a paywall opener.
 */
export function useFeatureAccess(feature: Feature): FeatureAccess {
  const activeTier = useSubscriptionStore((s) => s.activeTier);
  const weeklyAiLogCount = useSubscriptionStore((s) => s.weeklyAiLogCount);
  const quotaResetDate = useSubscriptionStore((s) => s.quotaResetDate);
  const maxWeeklyFreeAiLogs = useSubscriptionStore((s) => s.maxWeeklyFreeAiLogs);

  // A lapsed weekly cycle shouldn't shrink this week's quota. effectiveWeeklyCount reads a
  // stale cycle as zero without mutating; incrementAiLog does the actual reset on the next write.
  const usedThisWeek = effectiveWeeklyCount(weeklyAiLogCount, quotaResetDate, Date.now());
  const isPaid = TIER_RANK[activeTier] >= TIER_RANK.pro;
  const remainingLogs = isPaid
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxWeeklyFreeAiLogs - usedThisWeek);

  const meetsTier = featureMeetsTier(activeTier, feature);

  // AI logging is a free feature, but the free tier is metered: once this week's quota is spent
  // the door closes until the cycle rolls over or an upgrade. Paid tiers stay unlimited.
  const hasAccess = feature === "ai_log" ? meetsTier && remainingLogs > 0 : meetsTier;

  const triggerPaywall = useCallback(() => {
    router.push("/subscription");
  }, []);

  return { hasAccess, remainingLogs, triggerPaywall };
}

// --- Time-based history gating -------------------------------------------------------------
//
// The logbook is free for the current day only: a free user records and reviews today's intake,
// but every past day is a Pro perk. Free users still SEE that earlier days exist (the ledger
// archive) — the numbers stay sealed behind the paywall. Paid tiers read and edit the whole
// history. The window is whole calendar days, parsed at local midnight, so it never drifts by a
// few hours across a day boundary.

export const HISTORY_WINDOW_DAYS = 1;

/**
 * Whole calendar days from `dateKey` back to `today` (both yyyy-mm-dd). Today is 0, yesterday
 * is 1, a future date is negative. Pure and timezone-stable.
 */
export function daysAgo(dateKey: string, today: string = todayKey()): number {
  const then = new Date(`${dateKey}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return Math.round((now - then) / 86_400_000);
}

/**
 * Is `dateKey` inside the free window? With a one-day window that means today only. Future
 * dates count as inside, so a forward-dated entry is never accidentally locked.
 */
export function isWithinHistoryWindow(dateKey: string, today: string = todayKey()): boolean {
  return daysAgo(dateKey, today) <= HISTORY_WINDOW_DAYS - 1;
}

export interface HistoryAccess {
  // Selected date sits inside the free window — today only (independent of tier).
  withinWindow: boolean;
  // May the current tier read this day's numbers and graphs?
  canView: boolean;
  // May the current tier add / remove / tweak this day's entries? Same rule as canView.
  canEdit: boolean;
  // Free user peering past the window: render the locked-ledger teaser instead of data.
  isLocked: boolean;
  triggerPaywall: () => void;
}

/**
 * Gate a specific logbook date. Today is free for every tier (full read/write). For any past
 * day, Pro and Max keep full access while Free is sealed out and should be shown the
 * locked-ledger teaser rather than any real figures.
 */
export function useHistoryAccess(dateKey: string): HistoryAccess {
  const activeTier = useSubscriptionStore((s) => s.activeTier);
  const isPaid = TIER_RANK[activeTier] >= TIER_RANK.pro;
  const withinWindow = isWithinHistoryWindow(dateKey);
  const canView = withinWindow || isPaid;

  const triggerPaywall = useCallback(() => {
    router.push("/subscription");
  }, []);

  return { withinWindow, canView, canEdit: canView, isLocked: !canView, triggerPaywall };
}
