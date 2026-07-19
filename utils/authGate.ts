// Pure routing policy for the launch flow. Kept free of React and expo-router so it is trivially
// unit-testable: given a snapshot of app state, it returns the single route the user belongs on.
// app/_layout.tsx feeds it live store values and performs the actual router.replace.
//
// Order of the gate (each step blocks the next):
//   onboarding intro -> sign in -> email verification -> health profile setup -> the app.

export type GateTarget =
  | "/onboarding"
  | "/auth/sign-in"
  | "/auth/verify-email"
  | "/profile-setup"
  | "/(tabs)";

export interface GateInput {
  /** appStore rehydrated from storage yet? */
  hydrated: boolean;
  /** authStore has resolved the initial getSession()? */
  authReady: boolean;
  onboardingComplete: boolean;
  signedIn: boolean;
  /** The signed-in user's email is confirmed (always true for OAuth accounts). */
  emailVerified: boolean;
  /** An email account just signed up and is awaiting its confirmation link. */
  pendingVerification: boolean;
  /** A health profile has been saved. */
  profileComplete: boolean;
}

/**
 * Resolve the route the user should be on, or null while state is still loading (caller should do
 * nothing and keep the splash up). Pure and synchronous.
 */
export function resolveGate(i: GateInput): GateTarget | null {
  if (!i.hydrated || !i.authReady) return null;
  if (!i.onboardingComplete) return "/onboarding";
  if (!i.signedIn) {
    // A pending email signup has no session yet but must land on the verify screen, not sign-in.
    return i.pendingVerification ? "/auth/verify-email" : "/auth/sign-in";
  }
  // Signed in: an unconfirmed email session (rare) still can't pass the verification wall.
  if (!i.emailVerified) return "/auth/verify-email";
  if (!i.profileComplete) return "/profile-setup";
  return "/(tabs)";
}

// The route segments (as returned by expo-router's useSegments) that satisfy each target. Used by
// the layout to decide whether a redirect is actually needed, so it never replaces onto the route
// it is already on. A prefix match allows any leaf inside (tabs).
export const GATE_SEGMENTS: Record<GateTarget, string[]> = {
  "/onboarding": ["onboarding"],
  "/auth/sign-in": ["auth", "sign-in"],
  "/auth/verify-email": ["auth", "verify-email"],
  "/profile-setup": ["profile-setup"],
  "/(tabs)": ["(tabs)"],
};

/** True when the current router segments already satisfy the target (so no redirect is needed). */
export function isAtTarget(target: GateTarget, segments: string[]): boolean {
  return GATE_SEGMENTS[target].every((seg, idx) => segments[idx] === seg);
}

// The pre-app "gating" routes: the launch-flow screens a user sits on before being cleared into the
// app, plus the bare index entry route. Once the gate resolves to "/(tabs)" (user is cleared), the
// layout only pulls them in from one of these; any other in-app stack route they pushed
// (subscription, recipe, cook, ...) is left alone. Without this the gate would yank every non-tab
// route straight back to the tabs.
const PRE_APP_ROOTS = ["index", "onboarding", "auth", "profile-setup"];

export function isPreAppRoute(segments: string[]): boolean {
  const root = segments[0];
  // expo-router reports the root index route ("/") as no segments; treat that as pre-app too.
  return root === undefined || PRE_APP_ROOTS.includes(root);
}
