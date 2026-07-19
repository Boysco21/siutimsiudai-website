import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import * as authService from "@/services/authService";
import type { AuthOutcome } from "@/services/authService";
import { forgetUser, identifyUser } from "@/services/revenueCatService";
import { useAppStore } from "./appStore";
import { useSubscriptionStore } from "./useSubscriptionStore";

// The persisted stores that hold the user's own content. Cleared from the device on account
// deletion so nothing personal is left at rest. Device preferences that are not personal data
// (siutimsiudai-app: locale / units / onboarding) are left alone, and the subscription mirror is reset
// separately by applySession(null).
const PERSONAL_DATA_KEYS = [
  "siutimsiudai-nutrition",
  "siutimsiudai-recipes",
  "siutimsiudai-pantry",
  "siutimsiudai-meal-plan",
  "siutimsiudai-grocery",
  "siutimsiudai-saved-meals",
];

// Best-effort wipe of the on-device copy of the user's data. Runs only after the account is already
// gone server-side, so a failure here must never block the sign-out that follows.
async function wipeLocalUserData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(PERSONAL_DATA_KEYS);
  } catch {
    // Ignore: the account is deleted regardless; the keys clear on the next launch at worst.
  }
}

// In-memory mirror of the Supabase auth session. Supabase persists the real session itself (see
// services/supabase.ts), so this store is NOT persisted; it just exposes the current session to
// React and the route gate, and holds the transient state the email-verification flow needs.

interface AuthState {
  // False until the initial getSession() resolves. The route gate waits on this to avoid a flash.
  initialized: boolean;
  session: Session | null;
  user: User | null;
  // The email + password of an account that just signed up and is awaiting verification. RAM only,
  // never persisted, so the verify screen can retry sign-in the moment the user clicks the link.
  pendingEmail: string | null;
  pendingPassword: string | null;

  init: () => void;
  applySession: (session: Session | null) => void;
  setPending: (email: string, password: string) => void;
  clearPending: () => void;
  signOut: () => Promise<void>;
  // Permanently delete the account server-side, wipe the device's copy of the user's data, and
  // clear the session. Resolves with the service outcome so the screen can surface a failure.
  deleteAccount: () => Promise<AuthOutcome>;
}

let subscribed = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  session: null,
  user: null,
  pendingEmail: null,
  pendingPassword: null,

  init: () => {
    if (!supabase) {
      // No backend in this environment: settle immediately so the gate can route to sign-in
      // (which will show a friendly "unavailable" message if the user tries to authenticate).
      set({ initialized: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      get().applySession(data.session);
      set({ initialized: true });
    });
    if (!subscribed) {
      subscribed = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        get().applySession(session);
      });
    }
  },

  applySession: (session) => {
    set({ session, user: session?.user ?? null });
    // Keep the legacy appStore id in sync for existing consumers.
    useAppStore.getState().setSession(session?.user?.id ?? null);
    if (session) {
      // A live session means verification is done; drop any pending retry credentials.
      set({ pendingEmail: null, pendingPassword: null });
      // Attach RevenueCat's receipt to this account so the tier follows the user across devices
      // and reinstalls. Fire-and-forget and a no-op until a real build makes the SDK available.
      identifyUser(session.user.id).catch(() => {});
    } else {
      // No authenticated user: reset the per-account subscription mirror so the next account (e.g.
      // a fresh sign-up) starts on free instead of inheriting the previous user's tier. A live
      // RevenueCat build repopulates the real entitlement once the next user signs in.
      useSubscriptionStore.getState().resetTierForNewAccount();
      // Detach from RevenueCat so the next account starts from its own anonymous receipt.
      forgetUser().catch(() => {});
    }
  },

  setPending: (pendingEmail, pendingPassword) => set({ pendingEmail, pendingPassword }),
  clearPending: () => set({ pendingEmail: null, pendingPassword: null }),

  signOut: async () => {
    await authService.signOut();
    // onAuthStateChange will also fire; clear locally for an instant UI response.
    get().applySession(null);
  },

  deleteAccount: async () => {
    const outcome = await authService.deleteAccount();
    if (!outcome.ok) return outcome;
    // Account is gone server-side: erase this device's copy of the user's data, then clear the
    // in-memory session. The route gate drops back to sign-in the moment the session is null.
    await wipeLocalUserData();
    get().applySession(null);
    return outcome;
  },
}));
