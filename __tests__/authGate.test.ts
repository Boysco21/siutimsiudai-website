import { GateInput, isAtTarget, isPreAppRoute, resolveGate } from "@/utils/authGate";

// A fully-onboarded, signed-in, verified, profiled user — the "everything done" baseline. Each
// test flips one field to prove the gate blocks at exactly the right step.
const DONE: GateInput = {
  hydrated: true,
  authReady: true,
  onboardingComplete: true,
  signedIn: true,
  emailVerified: true,
  pendingVerification: false,
  profileComplete: true,
};

describe("resolveGate — loading", () => {
  it("waits (null) until the app store has hydrated", () => {
    expect(resolveGate({ ...DONE, hydrated: false })).toBeNull();
  });

  it("waits (null) until auth has initialized", () => {
    expect(resolveGate({ ...DONE, authReady: false })).toBeNull();
  });
});

describe("resolveGate — sequence", () => {
  it("sends a brand-new user to onboarding first", () => {
    expect(
      resolveGate({ ...DONE, onboardingComplete: false, signedIn: false, profileComplete: false }),
    ).toBe("/onboarding");
  });

  it("routes to sign-in once onboarding is done but no one is signed in", () => {
    expect(resolveGate({ ...DONE, signedIn: false, profileComplete: false })).toBe("/auth/sign-in");
  });

  it("routes a pending email signup to verify-email even without a session", () => {
    expect(
      resolveGate({ ...DONE, signedIn: false, pendingVerification: true, profileComplete: false }),
    ).toBe("/auth/verify-email");
  });

  it("blocks a signed-in but unverified email user at verify-email", () => {
    expect(resolveGate({ ...DONE, emailVerified: false, profileComplete: false })).toBe(
      "/auth/verify-email",
    );
  });

  it("sends a verified user with no profile to profile setup", () => {
    expect(resolveGate({ ...DONE, profileComplete: false })).toBe("/profile-setup");
  });

  it("lets a fully set-up user into the app", () => {
    expect(resolveGate(DONE)).toBe("/(tabs)");
  });
});

describe("resolveGate — OAuth bypasses verification", () => {
  it("routes an OAuth user (verified, no pending) straight to profile setup", () => {
    // OAuth accounts arrive already emailVerified with nothing pending.
    expect(
      resolveGate({ ...DONE, pendingVerification: false, emailVerified: true, profileComplete: false }),
    ).toBe("/profile-setup");
  });
});

describe("isAtTarget", () => {
  it("matches an exact leaf route", () => {
    expect(isAtTarget("/auth/sign-in", ["auth", "sign-in"])).toBe(true);
    expect(isAtTarget("/auth/verify-email", ["auth", "sign-in"])).toBe(false);
  });

  it("prefix-matches any screen inside the tabs group", () => {
    expect(isAtTarget("/(tabs)", ["(tabs)", "profile"])).toBe(true);
    expect(isAtTarget("/(tabs)", ["onboarding"])).toBe(false);
  });

  it("matches a single-segment route", () => {
    expect(isAtTarget("/onboarding", ["onboarding"])).toBe(true);
    expect(isAtTarget("/profile-setup", ["profile-setup"])).toBe(true);
  });
});

describe("isPreAppRoute", () => {
  it("treats the launch-flow screens (and the bare index) as pre-app", () => {
    expect(isPreAppRoute([])).toBe(true); // root index route reports no segments
    expect(isPreAppRoute(["index"])).toBe(true);
    expect(isPreAppRoute(["onboarding"])).toBe(true);
    expect(isPreAppRoute(["auth", "sign-in"])).toBe(true);
    expect(isPreAppRoute(["auth", "verify-email"])).toBe(true);
    expect(isPreAppRoute(["profile-setup"])).toBe(true);
  });

  it("treats in-app stack routes as NOT pre-app, so the gate leaves them put", () => {
    expect(isPreAppRoute(["(tabs)"])).toBe(false);
    expect(isPreAppRoute(["(tabs)", "profile"])).toBe(false);
    expect(isPreAppRoute(["subscription"])).toBe(false);
    expect(isPreAppRoute(["recipe", "123"])).toBe(false);
    expect(isPreAppRoute(["cook", "123"])).toBe(false);
  });
});
