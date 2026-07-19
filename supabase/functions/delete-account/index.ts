// Supabase Edge Function: delete-account
//
// Permanently deletes the signed-in user's account. Deleting an auth user requires the Supabase
// SERVICE ROLE key — a full-admin secret that must NEVER ship in the app bundle — so it runs here,
// server-side, where the key exists only as a platform-injected Edge runtime secret. The client
// (services/authService.ts) calls this with the user's own session; we read that JWT, resolve which
// user is calling, and delete exactly that account. A caller can therefore only ever delete
// themselves — never another user.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into every Edge Function by the
//          platform, so there is no manual secret setup. Leave JWT verification ON (the default) so
//          only authenticated callers ever reach this code.
//
// Runs in the Supabase Deno runtime, excluded from the app tsconfig. `Deno` is a runtime global.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "not_configured" }, 500);

  // The caller's access token rides in the Authorization header (supabase-js attaches it to
  // functions.invoke automatically). No token -> no deletion.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  // Admin client (service role). Never created on a device; the key lives only in this runtime.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Resolve the token to its user. This is the ONLY identity we act on, so a caller can delete only
  // their own account, never someone else's.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userErr || !userId) return json({ error: "unauthorized" }, 401);

  // Deletes the auth user; any app tables keyed to auth.users with ON DELETE CASCADE go with it.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    // Full reason stays in the server logs only, never in the client response.
    console.error("[delete-account] deleteUser failed:", delErr.message);
    return json({ error: "delete_failed" }, 500);
  }

  return json({ ok: true }, 200);
});
