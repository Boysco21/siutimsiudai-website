// The history gate is a paywall boundary (free users get today only), so its date math gets
// pinned here. Everything is pure and takes an explicit `today`, so no clock mocking is needed.
// expo-router is stubbed only so importing the hook module (which references `router`) stays
// side-effect free.
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { daysAgo, isWithinHistoryWindow, HISTORY_WINDOW_DAYS } from "@/hooks/useFeatureAccess";

const TODAY = "2026-07-05";

describe("daysAgo", () => {
  it("is 0 for today", () => {
    expect(daysAgo(TODAY, TODAY)).toBe(0);
  });

  it("is 1 for yesterday", () => {
    expect(daysAgo("2026-07-04", TODAY)).toBe(1);
  });

  it("is 7 for a week ago", () => {
    expect(daysAgo("2026-06-28", TODAY)).toBe(7);
  });

  it("is negative for a future date", () => {
    expect(daysAgo("2026-07-06", TODAY)).toBe(-1);
  });

  it("counts across a month boundary", () => {
    expect(daysAgo("2026-06-30", "2026-07-02")).toBe(2);
  });

  it("counts across a year boundary", () => {
    expect(daysAgo("2025-12-31", "2026-01-02")).toBe(2);
  });
});

describe("isWithinHistoryWindow", () => {
  it("includes today", () => {
    expect(isWithinHistoryWindow(TODAY, TODAY)).toBe(true);
  });

  it("excludes yesterday (free tier is today only)", () => {
    expect(isWithinHistoryWindow("2026-07-04", TODAY)).toBe(false);
  });

  it("excludes anything older", () => {
    expect(isWithinHistoryWindow("2026-05-01", TODAY)).toBe(false);
  });

  it("treats future dates as inside the window", () => {
    expect(isWithinHistoryWindow("2026-07-10", TODAY)).toBe(true);
  });
});

it("HISTORY_WINDOW_DAYS is 1 (today only)", () => {
  expect(HISTORY_WINDOW_DAYS).toBe(1);
});
