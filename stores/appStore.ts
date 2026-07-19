import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Locale, MeasurementSystem } from "@/types";
import { detectInitialLocale, setI18nLocale } from "@/i18n";
import { persistStorage } from "./persistStorage";

interface AppState {
  locale: Locale;
  measurementSystem: MeasurementSystem;
  // True once the user has finished (or skipped) the first-run onboarding intro. Drives the
  // route gate's first hop.
  onboardingComplete: boolean;
  // True once the user has acknowledged how the app uses AI (which of their content is sent to our
  // Google Cloud AI proxies). Gates the one-time consent notice shown over the main tabs. Required
  // for App Store review (Guideline 5.1.2): informed consent before any content reaches an AI vendor.
  aiConsentAccepted: boolean;
  // Mirror of the Supabase auth user id, kept in sync by authStore so existing consumers (e.g. the
  // dashboard's guest banner) keep working. null = signed out. Source of truth is authStore.
  sessionUserId: string | null;
  hasHydrated: boolean;

  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  acceptAiConsent: () => void;
  setSession: (userId: string | null) => void;
  signOut: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      locale: detectInitialLocale(),
      measurementSystem: "metric",
      onboardingComplete: false,
      aiConsentAccepted: false,
      sessionUserId: null,
      hasHydrated: false,

      setLocale: (locale) => {
        setI18nLocale(locale);
        set({ locale });
      },
      toggleLocale: () => {
        const next: Locale = get().locale === "zh-Hant" ? "en" : "zh-Hant";
        setI18nLocale(next);
        set({ locale: next });
      },
      setMeasurementSystem: (measurementSystem) => set({ measurementSystem }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      // Re-show the first-run flow. Used by a dev-only affordance for testing and demos.
      resetOnboarding: () => set({ onboardingComplete: false }),
      acceptAiConsent: () => set({ aiConsentAccepted: true }),
      setSession: (sessionUserId) => set({ sessionUserId }),
      signOut: () => set({ sessionUserId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "siutimsiudai-app",
      storage: persistStorage,
      version: 1,
      // v0 called this flag `onboardingSkipped`; carry existing installs over so returning users
      // are not shown onboarding again.
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown> | undefined;
        if (state && version < 1 && "onboardingSkipped" in state) {
          state.onboardingComplete = state.onboardingSkipped;
          delete state.onboardingSkipped;
        }
        return state as unknown as AppState;
      },
      partialize: (s) => ({
        locale: s.locale,
        measurementSystem: s.measurementSystem,
        onboardingComplete: s.onboardingComplete,
        aiConsentAccepted: s.aiConsentAccepted,
        sessionUserId: s.sessionUserId,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-apply the saved language to i18next, then release the splash gate.
        if (state?.locale) setI18nLocale(state.locale);
        state?.setHasHydrated(true);
      },
    },
  ),
);
