// The weekly rolling-allotment math is the free-tier paywall boundary, so it gets pinned here.
// Every helper is pure and takes an explicit `nowMs`, so no clock mocking is needed. Importing
// from the store module is side-effect safe because jest.setup.js mocks AsyncStorage globally.
import {
  MAX_WEEKLY_FREE_AI_LOGS,
  QUOTA_CYCLE_MS,
  isQuotaCycleActive,
  effectiveWeeklyCount,
  nextQuotaReset,
} from "@/stores/useSubscriptionStore";

// A fixed anchor "now" so the arithmetic is deterministic and readable.
const NOW = Date.parse("2026-07-05T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("quota constants", () => {
  it("caps the free tier at 5 AI logs", () => {
    expect(MAX_WEEKLY_FREE_AI_LOGS).toBe(5);
  });

  it("runs a seven-day cycle", () => {
    expect(QUOTA_CYCLE_MS).toBe(7 * DAY);
  });
});

describe("isQuotaCycleActive", () => {
  it("is inactive when no cycle has started (null reset date)", () => {
    expect(isQuotaCycleActive(null, NOW)).toBe(false);
  });

  it("is active while now is before the reset timestamp", () => {
    const reset = new Date(NOW + 3 * DAY).toISOString();
    expect(isQuotaCycleActive(reset, NOW)).toBe(true);
  });

  it("is inactive once now has passed the reset timestamp (lapsed week)", () => {
    const reset = new Date(NOW - DAY).toISOString();
    expect(isQuotaCycleActive(reset, NOW)).toBe(false);
  });

  it("treats the exact reset instant as lapsed (strictly-before boundary)", () => {
    const reset = new Date(NOW).toISOString();
    expect(isQuotaCycleActive(reset, NOW)).toBe(false);
  });

  it("is inactive for an unparseable timestamp", () => {
    expect(isQuotaCycleActive("not-a-date", NOW)).toBe(false);
  });
});

describe("effectiveWeeklyCount", () => {
  it("returns the raw tally while the cycle is active", () => {
    const reset = new Date(NOW + DAY).toISOString();
    expect(effectiveWeeklyCount(5, reset, NOW)).toBe(5);
  });

  it("reads a lapsed cycle as zero without needing a write", () => {
    const reset = new Date(NOW - DAY).toISOString();
    expect(effectiveWeeklyCount(5, reset, NOW)).toBe(0);
  });

  it("reads a never-started cycle as zero", () => {
    expect(effectiveWeeklyCount(3, null, NOW)).toBe(0);
  });
});

describe("nextQuotaReset", () => {
  it("stamps an expiry exactly seven days out", () => {
    expect(nextQuotaReset(NOW)).toBe(new Date(NOW + QUOTA_CYCLE_MS).toISOString());
  });

  it("produces a timestamp that is active now and lapses right at the seven-day mark", () => {
    const reset = nextQuotaReset(NOW);
    expect(isQuotaCycleActive(reset, NOW)).toBe(true);
    expect(isQuotaCycleActive(reset, NOW + QUOTA_CYCLE_MS - 1)).toBe(true);
    expect(isQuotaCycleActive(reset, NOW + QUOTA_CYCLE_MS)).toBe(false);
  });
});

// The free-tier "remaining" figure the gating hook derives, exercised end to end through the
// pure helpers so the rolling reset is verified as a behaviour, not just per-function.
describe("free-tier remaining logs over a cycle", () => {
  const remaining = (count: number, reset: string | null, nowMs: number) =>
    Math.max(0, MAX_WEEKLY_FREE_AI_LOGS - effectiveWeeklyCount(count, reset, nowMs));

  it("starts at 5 before any log", () => {
    expect(remaining(0, null, NOW)).toBe(5);
  });

  it("counts down as logs are spent within the week", () => {
    const reset = nextQuotaReset(NOW);
    expect(remaining(1, reset, NOW + DAY)).toBe(4);
    expect(remaining(5, reset, NOW + DAY)).toBe(0);
  });

  it("stays at 0 anywhere inside the same locked week", () => {
    const reset = nextQuotaReset(NOW);
    expect(remaining(5, reset, NOW + 6 * DAY)).toBe(0);
  });

  it("restores the full 5 once the seven-day cycle rolls over", () => {
    const reset = nextQuotaReset(NOW);
    expect(remaining(5, reset, NOW + 7 * DAY)).toBe(5);
  });
});
