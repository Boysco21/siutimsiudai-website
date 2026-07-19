import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useFamilyStore } from "@/stores/familyStore";
import { parseInviteToken } from "@/utils/familyInvite";

/**
 * Capture an incoming family-invite deep link and resume onto the Accept screen once the user has
 * cleared the launch-flow gate. Mounted once from the root layout.
 *
 * Two effects:
 *   1. Stash the token from any invite URL the app opens with (cold start via getInitialURL) or
 *      receives while running (the "url" event). Stashing happens BEFORE the route gate can redirect
 *      a signed-out user to sign-in, so the token survives the sign-in -> verify-email detour.
 *   2. When the user is fully in the app (signed in, verified, profile complete), push the Accept
 *      screen for the stashed token exactly once, then clear it. A signed-in user who taps the link
 *      lands on /invite/[token] directly, so we detect that and just clear the flag instead.
 */
export function useInviteDeepLink() {
  const router = useRouter();
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;

  const signedIn = useAuthStore((s) => s.session !== null);
  const emailVerified = useAuthStore((s) => !!s.user?.email_confirmed_at);
  const profileComplete = useNutritionStore((s) => s.healthProfile !== null);

  const pendingToken = useFamilyStore((s) => s.pendingInviteToken);
  const setPendingInviteToken = useFamilyStore((s) => s.setPendingInviteToken);

  // 1. Capture incoming invite links.
  useEffect(() => {
    function handle(incoming: string | null) {
      const token = parseInviteToken(incoming);
      if (token) setPendingInviteToken(token);
    }
    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, [setPendingInviteToken]);

  // 2. Resume once the user is past the gate.
  useEffect(() => {
    if (!navReady || !pendingToken) return;
    if (!signedIn || !emailVerified || !profileComplete) return; // wait until cleared into the app
    if (segments[0] === "invite") {
      // Already on the Accept screen (a signed-in user tapped the link) — just drop the flag.
      setPendingInviteToken(null);
      return;
    }
    router.push(`/invite/${pendingToken}`);
    setPendingInviteToken(null);
  }, [
    navReady,
    pendingToken,
    signedIn,
    emailVerified,
    profileComplete,
    segments,
    router,
    setPendingInviteToken,
  ]);
}
