import { isSupabaseConfigured, supabase } from "./supabase";
import { buildInviteUrl, FAMILY_MAX_MEMBERS, makeDemoToken } from "@/utils/familyInvite";
import type {
  AcceptResult,
  CreateInviteReason,
  CreateInviteResult,
  FamilyGroup,
  FamilyInvitation,
  FamilyInviteStatus,
  FamilyMember,
  FamilyRole,
  FamilySnapshot,
  PreviewResult,
} from "@/types/family";

/**
 * Thin, swappable wrapper over the family-linking backend so screens stay declarative.
 *
 * Security split (why this is safe to ship):
 *  - CREATE flows through the create-family-invite Edge Function, which re-verifies the caller's Max
 *    entitlement with the RevenueCat SECRET key server-side, then inserts the invite with the
 *    service role. No user-callable RPC can bypass that gate.
 *  - PREVIEW / ACCEPT are SECURITY DEFINER RPCs granted to authenticated users. A dependent needs no
 *    paid plan and no secret, so a plain RPC (which resolves an invite by its sha256 hash under a row
 *    lock) is the right tool. See database/0002_family_linking.sql.
 *  - LEAVE / REMOVE / REVOKE are ordinary table writes gated by the RLS policies in that migration.
 *
 * Local-first fallback: with no Supabase configured (Expo Go without env, jest, web preview) every
 * call degrades to an on-device simulation so the whole flow is walkable offline. A simulated invite
 * is stored nowhere and grants nothing a real gate would trust.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_SNAPSHOT: FamilySnapshot = { group: null, role: null, members: [], invitations: [] };

function sevenDaysFromNow(): string {
  return new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
}

// Read the signed-in user id from the locally cached session (no network round-trip).
async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// --- Create (manager, Max-gated) ------------------------------------------------------------

export async function createFamilyInvite(label?: string | null): Promise<CreateInviteResult> {
  // Local-first demo: mint an on-device invite so the invite UI is fully explorable offline.
  if (!isSupabaseConfigured || !supabase) {
    const token = makeDemoToken();
    return {
      ok: true,
      simulated: true,
      invite: { token, url: buildInviteUrl(token), expiresAt: sevenDaysFromNow() },
    };
  }
  const { data, error } = await supabase.functions.invoke("create-family-invite", {
    body: { label: label ?? null },
  });
  if (error) return { ok: false, reason: await invokeErrorReason(error) };
  const token = typeof data?.token === "string" ? data.token : null;
  const url = typeof data?.url === "string" ? data.url : token ? buildInviteUrl(token) : null;
  const expiresAt = typeof data?.expires_at === "string" ? data.expires_at : null;
  if (!token || !url || !expiresAt) return { ok: false, reason: "unknown" };
  return { ok: true, invite: { token, url, expiresAt } };
}

// The Edge Function signals refusal with a JSON body { error: <reason> } on a non-2xx status, which
// supabase-js surfaces as a FunctionsHttpError whose `context` is the raw Response.
async function invokeErrorReason(error: unknown): Promise<CreateInviteReason> {
  try {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === "function") {
      const body = (await (ctx as Response).json()) as { error?: string };
      if (body?.error === "max_required" || body?.error === "group_full") return body.error;
    }
  } catch {
    // Fall through to the generic reason below.
  }
  return "unknown";
}

// --- Preview + accept (dependent) -----------------------------------------------------------

export async function previewFamilyInvite(token: string): Promise<PreviewResult> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo: treat any token as a fresh, acceptable invite so the accept screen is walkable offline.
    return {
      ok: true,
      canAccept: true,
      status: "pending",
      expired: false,
      inviterName: "",
      groupName: null,
      groupNameZh: null,
      expiresAt: sevenDaysFromNow(),
    };
  }
  const { data, error } = await supabase.rpc("preview_family_invite", { p_token: token });
  if (error || !data) return { ok: false, reason: "unknown" };
  const d = data as Record<string, unknown>;
  // No status field means the invite was not found (or the caller is unauthenticated).
  if (!d.status) {
    return { ok: false, reason: d.reason === "not_authenticated" ? "not_authenticated" : "invalid" };
  }
  return {
    ok: true,
    canAccept: Boolean(d.ok),
    status: d.status as FamilyInviteStatus,
    expired: Boolean(d.expired),
    inviterName: String(d.inviter_name ?? ""),
    groupName: (d.group_name as string | null) ?? null,
    groupNameZh: (d.group_name_zh as string | null) ?? null,
    expiresAt: (d.expires_at as string | null) ?? null,
  };
}

export async function acceptFamilyInvite(token: string): Promise<AcceptResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, simulated: true, groupId: "demo-group", inviterName: "" };
  }
  const { data, error } = await supabase.rpc("accept_family_invite", { p_token: token });
  if (error || !data) return { ok: false, reason: "unknown" };
  const d = data as Record<string, unknown>;
  if (d.ok === true) {
    return { ok: true, groupId: String(d.group_id ?? ""), inviterName: String(d.inviter_name ?? "") };
  }
  return { ok: false, reason: String(d.reason ?? "unknown") };
}

// --- Roster read ----------------------------------------------------------------------------

export async function getMyFamily(): Promise<FamilySnapshot> {
  if (!isSupabaseConfigured || !supabase) return EMPTY_SNAPSHOT;
  const uid = await currentUserId();
  if (!uid) return EMPTY_SNAPSHOT;

  // 1. My own membership row -> which group, and my role in it.
  const { data: mineRows } = await supabase
    .from("family_members")
    .select("group_id, role")
    .eq("user_id", uid)
    .limit(1);
  const mine = mineRows?.[0];
  if (!mine) return EMPTY_SNAPSHOT;
  const groupId = mine.group_id as string;
  const role = mine.role as FamilyRole;

  // 2. The group and 3. the roster, fetched together.
  const [{ data: groupRow }, { data: memberRows }] = await Promise.all([
    supabase
      .from("family_groups")
      .select("id, name, name_zh, max_members")
      .eq("id", groupId)
      .maybeSingle(),
    supabase.from("family_members").select("user_id, role").eq("group_id", groupId),
  ]);

  // 4. Display names the caller is allowed to read (a manager can read each dependent's profile).
  const ids = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
  const nameById = new Map<string, string | null>();
  if (ids.length) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profileRows ?? []) {
      nameById.set(p.id as string, (p.display_name as string | null) ?? null);
    }
  }
  const members: FamilyMember[] = (memberRows ?? []).map(
    (m: { user_id: string; role: FamilyRole }) => ({
      userId: m.user_id,
      role: m.role,
      displayName: nameById.get(m.user_id) ?? null,
    }),
  );

  // 5. Pending invitations for the manager to track / revoke (RLS returns none to a dependent).
  let invitations: FamilyInvitation[] = [];
  if (role === "manager") {
    const { data: invRows } = await supabase
      .from("family_invitations")
      .select("id, invitee_label, status, expires_at, created_at")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    invitations = (invRows ?? []).map(
      (r: {
        id: string;
        invitee_label: string | null;
        status: FamilyInviteStatus;
        expires_at: string;
        created_at: string;
      }) => ({
        id: r.id,
        inviteeLabel: r.invitee_label ?? null,
        status: r.status,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      }),
    );
  }

  const group: FamilyGroup = groupRow
    ? {
        id: groupRow.id as string,
        name: (groupRow.name as string | null) ?? null,
        nameZh: (groupRow.name_zh as string | null) ?? null,
        maxMembers: (groupRow.max_members as number) ?? FAMILY_MAX_MEMBERS,
      }
    : { id: groupId, name: null, nameZh: null, maxMembers: FAMILY_MAX_MEMBERS };

  return { group, role, members, invitations };
}

// --- Membership + invitation writes (RLS-gated) ---------------------------------------------

/** A dependent leaves the family. A manager disbands instead (delete the group), which is elsewhere. */
export async function leaveFamily(): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true };
  const uid = await currentUserId();
  if (!uid) return { ok: false };
  const { error } = await supabase
    .from("family_members")
    .delete()
    .eq("user_id", uid)
    .eq("role", "dependent");
  return { ok: !error };
}

/**
 * The manager removes a dependent. RLS (family_members_delete) scopes the delete to the manager's own
 * group via is_family_group_owner, and the partial unique index guarantees a user is a dependent in
 * at most one group, so this removes exactly the right row without needing the group id here.
 */
export async function removeMember(userId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true };
  const { error } = await supabase
    .from("family_members")
    .delete()
    .eq("user_id", userId)
    .eq("role", "dependent");
  return { ok: !error };
}

/** The manager revokes a still-pending invitation. RLS (family_invitations_owner_update) gates it. */
export async function revokeInvite(id: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true };
  const { error } = await supabase
    .from("family_invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("status", "pending");
  return { ok: !error };
}
