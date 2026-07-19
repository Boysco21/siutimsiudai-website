import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

// Thin, swappable wrapper over Supabase Auth so screens stay declarative and the provider can be
// replaced in one file. Every call is null-guarded: when Supabase is not configured (Expo Go
// without env, jest, web preview) the flow degrades to a friendly "unavailable" outcome instead
// of throwing, keeping the whole app testable offline.

// Dismisses the web auth popup once the redirect completes. No-op on native.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

export interface AuthOutcome {
  ok: boolean;
  // Machine code for the caller to branch on; screens map it to localized copy.
  error?: "unavailable" | "cancelled" | "invalid_credentials" | "already_registered" | "not_confirmed" | "unknown";
  // Email signup only: true when the project requires email confirmation, so no session exists yet.
  needsVerification?: boolean;
}

// The single redirect target for every browser-based auth return. `siutimsiudai://auth/callback` in a
// standalone build, an Expo Go proxy URL in development. Matches app/auth/callback.tsx.
function callbackUrl(): string {
  return Linking.createURL("/auth/callback");
}

function classify(message: string | undefined): AuthOutcome["error"] {
  const m = (message ?? "").toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "already_registered";
  if (m.includes("not confirmed") || m.includes("email not confirmed")) return "not_confirmed";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "invalid_credentials";
  return "unknown";
}

const UNAVAILABLE: AuthOutcome = { ok: false, error: "unavailable" };

export async function signUpWithEmail(email: string, password: string): Promise<AuthOutcome> {
  if (!supabase) return UNAVAILABLE;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return { ok: false, error: classify(error.message) };
  // With "Confirm email" enabled, signUp returns no session until the link is clicked.
  return { ok: true, needsVerification: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthOutcome> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: classify(error.message) };
  return { ok: true };
}

export async function resendVerification(email: string): Promise<AuthOutcome> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return { ok: false, error: classify(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

// Permanently delete the signed-in user's account. The deletion itself needs the Supabase service
// role key — an admin secret that must never ship in the app — so it runs in the delete-account
// Edge Function (supabase/functions/delete-account), which reads the caller's own session token and
// deletes exactly that user. We then clear the now-invalid local session. Null-guarded like the
// rest of this file, so a no-backend environment returns "unavailable" instead of throwing.
export async function deleteAccount(): Promise<AuthOutcome> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) return { ok: false, error: "unknown" };
  // Local scope: just drop this device's tokens. The account is already gone server-side, so a
  // global sign-out would only try (and fail) to revoke a session that no longer exists.
  await supabase.auth.signOut({ scope: "local" });
  return { ok: true };
}

// Supabase's public auth settings list which providers the project has enabled. We check this
// before opening the browser: a not-yet-configured provider (e.g. Google switched off in the
// dashboard) otherwise dumps the user on Supabase's raw JSON error page. Any fetch hiccup returns
// true so a genuinely working provider is never blocked by a flaky settings call.
async function providerEnabled(provider: OAuthProvider): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return true;
    const json = (await res.json()) as { external?: Record<string, boolean> };
    return json.external?.[provider] !== false;
  } catch {
    return true;
  }
}

// Browser OAuth (works in Expo Go, web, and simulators; no native modules). We ask Supabase for
// the provider consent URL, open it in a secure auth session, then exchange the returned PKCE
// code for a session. On success onAuthStateChange fires and the route gate advances.
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthOutcome> {
  if (!supabase) return UNAVAILABLE;
  // Fail clean when the provider is not enabled server-side, instead of opening the browser onto
  // Supabase's "provider is not enabled" error page.
  if (!(await providerEnabled(provider))) return UNAVAILABLE;
  const redirectTo = callbackUrl();
  // Dev aid: the exact return URL Supabase must have on its Redirect URLs allowlist. In Expo Go
  // this is an exp:// URL tied to your machine's LAN IP, so it shifts between networks.
  if (__DEV__) console.log("[auth] OAuth redirect URL (allowlist this in Supabase):", redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, error: "unknown" };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) return { ok: false, error: "cancelled" };

  const completed = await completeAuthFromUrl(result.url);
  return completed ? { ok: true } : { ok: false, error: "unknown" };
}

// Establish a session from a returned/deep-linked auth URL. Handles the three shapes Supabase can
// send: a PKCE `code` (OAuth), an email `token_hash`+`type` (confirmation link), or implicit
// tokens in the URL fragment. Returns true when a session was set. Safe to call with any URL.
export async function completeAuthFromUrl(url: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { queryParams } = Linking.parse(url);
    const code = typeof queryParams?.code === "string" ? queryParams.code : null;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return !error;
    }

    const tokenHash = typeof queryParams?.token_hash === "string" ? queryParams.token_hash : null;
    const type = typeof queryParams?.type === "string" ? queryParams.type : null;
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "email" | "recovery" | "invite" | "email_change",
      });
      return !error;
    }

    // Implicit flow: #access_token=...&refresh_token=...
    const fragment = url.split("#")[1] ?? "";
    const frag = Object.fromEntries(
      fragment
        .split("&")
        .filter(Boolean)
        .map((kv) => kv.split("=").map(decodeURIComponent) as [string, string]),
    );
    if (frag.access_token && frag.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: frag.access_token,
        refresh_token: frag.refresh_token,
      });
      return !error;
    }
  } catch {
    // Malformed URL or network error: fall through to false so the caller can show a retry.
  }
  return false;
}
