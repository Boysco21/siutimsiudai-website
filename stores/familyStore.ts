import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./persistStorage";
import { getMyFamily } from "@/services/familyService";
import type { FamilySnapshot } from "@/types/family";

interface FamilyState {
  // An invite token captured from a deep link while the user was signed out. Persisted so it survives
  // the sign-in -> verify-email detour (which can bounce the user out to their mail app and back). The
  // token is single-use and stored only as a sha256 hash server-side, and it is the same value that
  // was already public in the shared link, so stashing the raw token on-device is low risk. Cleared
  // on sign-out (authStore.reset path) and the moment the Accept screen consumes it.
  pendingInviteToken: string | null;
  setPendingInviteToken: (token: string | null) => void;

  // In-memory cache of the family roster. NOT persisted: the server (under RLS) is the source of
  // truth, so we re-fetch on screen focus rather than risk a stale or cross-account snapshot.
  snapshot: FamilySnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;

  // Wipe per-account family state at the sign-out boundary.
  reset: () => void;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set) => ({
      pendingInviteToken: null,
      setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),

      snapshot: null,
      loading: false,
      refresh: async () => {
        set({ loading: true });
        try {
          const snapshot = await getMyFamily();
          set({ snapshot, loading: false });
        } catch {
          // Leave the last snapshot in place; just drop the spinner so the screen can offer a retry.
          set({ loading: false });
        }
      },

      reset: () => set({ pendingInviteToken: null, snapshot: null, loading: false }),
    }),
    {
      name: "siutimsiudai-family",
      storage: persistStorage,
      // Persist only the pending invite token; the roster stays in memory (server is source of truth).
      partialize: (s) => ({ pendingInviteToken: s.pendingInviteToken }),
    },
  ),
);
