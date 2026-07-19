import "../global.css";
import "@/i18n";

import { useEffect, useState } from "react";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useRecipeStore } from "@/stores/recipeStore";
import { usePantryStore } from "@/stores/pantryStore";
import { useSavedMealsStore } from "@/stores/savedMealsStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { SplashOverlay } from "@/components/SplashOverlay";
import { configureRevenueCat } from "@/services/revenueCatService";
import { useInviteDeepLink } from "@/hooks/useInviteDeepLink";
import { isAtTarget, isPreAppRoute, resolveGate } from "@/utils/authGate";

// The launch flow gate. Reads live store state, asks the pure resolver where the user belongs, and
// redirects there — but only once the navigator is mounted and the stores have settled, so it
// never fights the router or flashes a wrong screen. Onboarding -> auth -> verify -> profile -> app.
function useRouteGate() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  const hydrated = useAppStore((s) => s.hasHydrated);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const authReady = useAuthStore((s) => s.initialized);
  const signedIn = useAuthStore((s) => s.session !== null);
  const emailVerified = useAuthStore((s) => !!s.user?.email_confirmed_at);
  const pendingVerification = useAuthStore((s) => s.pendingEmail !== null);
  const profileComplete = useNutritionStore((s) => s.healthProfile !== null);

  const target = resolveGate({
    hydrated,
    authReady,
    onboardingComplete,
    signedIn,
    emailVerified,
    pendingVerification,
    profileComplete,
  });

  useEffect(() => {
    if (!navState?.key || !target) return; // navigator not ready, or still loading
    if (isAtTarget(target, segments as string[])) return; // already where we belong
    // Cleared into the app: only pull the user in from a pre-app screen. Leave any other in-app
    // stack route (subscription, recipe, cook, ...) put, so opening a pushed screen isn't yanked
    // back to the tabs.
    if (target === "/(tabs)" && !isPreAppRoute(segments as string[])) return;
    router.replace(target);
  }, [navState?.key, target, segments, router]);
}

export default function RootLayout() {
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const authReady = useAuthStore((s) => s.initialized);
  const [splashDone, setSplashDone] = useState(false);

  // Bring up the auth session mirror once: load any persisted session and subscribe to changes.
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  // Backup seed for environments where persist's rehydrate hook is a no-op (e.g. web).
  // Both calls are idempotent: they only fill empty, never-seeded stores.
  useEffect(() => {
    useRecipeStore.getState().seedIfEmpty();
    usePantryStore.getState().seedIfEmpty();
    useSavedMealsStore.getState().seedIfEmpty();
  }, []);

  // Bring up RevenueCat once at boot. Fire-and-forget and guarded: it configures native IAP when
  // a real build + key exist, and quietly no-ops into mock mode on web and in Expo Go. We hand it
  // a live accessor for the current user id (not a snapshot): auth may still be resolving now, so
  // configure re-reads it once the SDK is ready and associates the receipt, closing the boot race.
  useEffect(() => {
    configureRevenueCat(() => useAuthStore.getState().session?.user?.id).catch(() => {});
  }, []);

  useRouteGate();
  // Capture any family-invite deep link and resume onto the Accept screen once the user is past
  // the launch-flow gate (signed in, verified, profile complete).
  useInviteDeepLink();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/* The navigator always mounts; the route gate redirects between these screens and the
            splash sits on top until the stores hydrate and auth resolves, so no wrong frame shows. */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recipe/[id]" />
          <Stack.Screen name="cook/[id]" options={{ presentation: "fullScreenModal", animation: "fade" }} />
          <Stack.Screen name="subscription" options={{ presentation: "modal" }} />
          <Stack.Screen name="family/invite" />
          <Stack.Screen name="invite/[token]" />
          <Stack.Screen name="pantry-scan" />
          <Stack.Screen name="pantry-review" />
        </Stack>
        {!splashDone && (
          <SplashOverlay ready={hasHydrated && authReady} onDone={() => setSplashDone(true)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
