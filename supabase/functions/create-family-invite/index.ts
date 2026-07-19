// Supabase Edge Function: create-family-invite
//
// The UNSPOOFABLE Max gate for family linking. A user may only mint a family invitation if they hold
// an active "Max" entitlement, and that check happens HERE, server-side, with the RevenueCat SECRET
// key — never on the device, where any value could be tampered with. Splitting invite CREATION into
// this function (secret Max check + service-role insert) means no user-callable RPC can bypass the
// paywall; invite ACCEPTANCE, which needs no paid plan, stays a plain SECURITY DEFINER RPC (see
// database/0002_family_linking.sql).
//
// Flow:
//   1. Resolve the caller from their own JWT (a caller can only ever act as themselves).
//   2. Ask RevenueCat's REST API whether that user's receipt carries an active max_tier entitlement.
//      Fail CLOSED: no secret, RevenueCat error, or no active Max -> no invite.
//   3. With the service role, find-or-create the caller's family group + manager membership, enforce
//      the group-size cap, mint a CSPRNG token, store ONLY its sha256 hash, and return the raw token
//      once so the client can build the shareable https link.
//
// Deploy:  supabase functions deploy create-family-invite
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into every Edge Function by the
//          platform. You MUST additionally set the RevenueCat secret (server key, starts with "sk_"):
//              supabase secrets set REVENUECAT_SECRET_KEY=sk_xxx
//          Never commit or echo that value; it lives only in this runtime. Leave JWT verification ON
//          (the default) so only authenticated callers reach this code.
//
// Runs in the Supabase Deno runtime, excluded from the app tsconfig. `Deno` is a runtime global.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The entitlement id that unlocks Max. Mirrors ENTITLEMENT_TIER_MAP in stores/useSubscriptionStore
// and MAX_ENTITLEMENT_ID in services/revenueCatService. Self-contained here: the Edge runtime cannot
// import the app's modules.
const MAX_ENTITLEMENT_ID = "max_tier";

// The public landing domain that hosts the AASA / assetlinks files and the /invite page. Keep in
// lockstep with INVITE_WEB_BASE in utils/familyInvite.ts.
const INVITE_WEB_BASE = "https://siutimsiudai.app";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// URL-safe base64 of random bytes, for an opaque bearer token that rides in a link.
function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// sha256 hex, matching the database's encode(sha256(convert_to(token,'UTF8')),'hex') so the RPCs can
// resolve the raw token the client presents on acceptance.
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Ask RevenueCat whether this app user currently holds an active Max entitlement. The client keys the
// RevenueCat subscriber by the Supabase user id (Purchases.logIn(userId) in identifyUser), so we look
// the subscriber up by that same id. Returns "error" (distinct from false) so the caller can fail
// closed on any transport/API problem rather than silently treating it as "not Max".
async function hasActiveMax(appUserId: string, secretKey: string): Promise<boolean | "error"> {
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" } },
    );
    if (!res.ok) return "error";
    const body = await res.json();
    const ent = body?.subscriber?.entitlements?.[MAX_ENTITLEMENT_ID];
    if (!ent) return false;
    // A null expiry is a non-expiring grant; otherwise it must be in the future to count as active.
    const expires = ent.expires_date as string | null | undefined;
    return expires == null || Date.parse(expires) > Date.now();
  } catch {
    return "error";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rcSecret = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!url || !serviceKey) return json({ error: "not_configured" }, 500);
  // Fail CLOSED: without the RevenueCat secret the Max gate cannot be enforced, so no invite is minted.
  if (!rcSecret) return json({ error: "not_configured" }, 500);

  // The caller's access token rides in the Authorization header (supabase-js attaches it to
  // functions.invoke automatically). No token -> no invite.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  // Optional free-text label ("Mom") the manager can attach to the invite. Not depended-on PII.
  let label: string | null = null;
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed.label === "string") label = parsed.label.slice(0, 120);
  } catch {
    // No / invalid body is fine; the label is optional.
  }

  // Admin client (service role). Never created on a device; the key lives only in this runtime.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Resolve the token to its user. This is the ONLY identity we act on, so a caller can create an
  // invite only for their own household.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  if (userErr || !uid) return json({ error: "unauthorized" }, 401);

  // The Max gate. Fail closed on both "not Max" and any RevenueCat error.
  const maxState = await hasActiveMax(uid, rcSecret);
  if (maxState === "error") return json({ error: "verification_failed" }, 502);
  if (maxState === false) return json({ error: "max_required" }, 403);

  // Find-or-create the caller's one household. The unique index family_groups_one_per_owner keeps it
  // to exactly one per owner; on a lost insert race we simply re-select the winner's row.
  let groupId: string | null = null;
  let maxMembers = 6;
  {
    const { data: existing } = await admin
      .from("family_groups")
      .select("id, max_members")
      .eq("owner_id", uid)
      .maybeSingle();
    if (existing) {
      groupId = existing.id;
      maxMembers = existing.max_members;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("family_groups")
        .insert({ owner_id: uid })
        .select("id, max_members")
        .single();
      if (!insErr && inserted) {
        groupId = inserted.id;
        maxMembers = inserted.max_members;
      } else {
        const { data: retry } = await admin
          .from("family_groups")
          .select("id, max_members")
          .eq("owner_id", uid)
          .maybeSingle();
        if (retry) {
          groupId = retry.id;
          maxMembers = retry.max_members;
        }
      }
    }
  }
  if (!groupId) return json({ error: "insert_failed" }, 500);

  // Ensure the caller is recorded as this group's manager (idempotent).
  await admin
    .from("family_members")
    .upsert({ group_id: groupId, user_id: uid, role: "manager" }, {
      onConflict: "group_id,user_id",
      ignoreDuplicates: true,
    });

  // Enforce the group-size cap (1 manager + up to 5 dependents). A full household can't be invited to.
  const { count } = await admin
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if ((count ?? 0) >= maxMembers) return json({ error: "group_full" }, 409);

  // Mint the single-use token, store ONLY its hash, and hand the raw token back once.
  const rawToken = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { error: invErr } = await admin.from("family_invitations").insert({
    group_id: groupId,
    inviter_id: uid,
    token_hash: tokenHash,
    invitee_label: label,
    status: "pending",
    expires_at: expiresAt,
  });
  if (invErr) {
    console.error("[create-family-invite] invitation insert failed:", invErr.message);
    return json({ error: "insert_failed" }, 500);
  }

  return json({ url: `${INVITE_WEB_BASE}/invite/${rawToken}`, token: rawToken, expires_at: expiresAt }, 200);
});
