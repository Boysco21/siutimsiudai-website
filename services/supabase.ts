import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

// Supabase client. With no env vars set this stays null and the whole app runs local-first
// against the Zustand stores (Expo Go without config, jest, web preview).
// Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY to activate. Only the *publishable*
// anon key belongs here; it is inlined into the bundle and is safe to ship. Billable secrets
// (service_role, Google key) never live client-side.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // The user's own session (a short-lived JWT + refresh token), not a billable secret.
        // AsyncStorage is the documented Expo adapter and has no size cap; a future hardening
        // pass can swap in an encrypted SecureStore adapter without touching call sites.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // PKCE is the secure flow for native OAuth: the code is exchanged for a session using a
        // verifier held only on-device, so an intercepted redirect URL is useless on its own.
        flowType: "pkce",
        // Native RN has no page URL to parse a session from; only the web build lands the OAuth
        // redirect back in the address bar.
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;

// Keep tokens fresh only while the app is foregrounded. Supabase's own timer pauses in the
// background where JS is frozen anyway; this restarts it on resume. Web manages this itself.
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
