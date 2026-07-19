// Family-linking domain interfaces (Max plan). TypeScript fields are camelCase; the SQL schema in
// database/0002_family_linking.sql uses snake_case, and services/familyService.ts maps between them.
//
// The model is one-way: a Max "manager" links "dependent" accounts and may view + manage their meal
// logs. A dependent gains no paid features and can leave at any time. See the SQL migration for the
// row-level security that enforces this.

export type FamilyRole = "manager" | "dependent";

export type FamilyInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface FamilyGroup {
  id: string;
  name: string | null;
  nameZh: string | null;
  maxMembers: number;
}

export interface FamilyMember {
  userId: string;
  role: FamilyRole;
  // The member's display name when row-level security lets the caller read it (a manager can read
  // each dependent's profile). Null when hidden by RLS (e.g. a dependent viewing the manager) or
  // simply unset.
  displayName: string | null;
}

export interface FamilyInvitation {
  id: string;
  inviteeLabel: string | null;
  status: FamilyInviteStatus;
  expiresAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
}

/** The assembled view the family screen renders in one shot. */
export interface FamilySnapshot {
  group: FamilyGroup | null;
  // The caller's own role, or null when they are not linked to any family.
  role: FamilyRole | null;
  members: FamilyMember[];
  // Pending invitations for the manager to track / revoke. Always empty in the dependent view.
  invitations: FamilyInvitation[];
}

/** A freshly created invitation, ready to share over SMS or any share sheet. */
export interface FamilyInvite {
  token: string;
  url: string;
  expiresAt: string; // ISO timestamp
}

// --- Service result shapes ------------------------------------------------------------------
// Discriminated unions so callers branch on `ok` and get a typed reason on failure. Reasons are
// machine codes the screens map to localized copy via utils/familyInvite.

export type CreateInviteReason = "max_required" | "group_full" | "unavailable" | "unknown";

export type CreateInviteResult =
  | { ok: true; invite: FamilyInvite; simulated?: boolean }
  | { ok: false; reason: CreateInviteReason };

// preview_family_invite resolves an invite by token hash WITHOUT accepting it, so the accept screen
// can show the inviter before the user commits.
export type PreviewResult =
  | {
      ok: true;
      // The invite is pending and unexpired, so accepting will succeed.
      canAccept: boolean;
      status: FamilyInviteStatus;
      expired: boolean;
      inviterName: string;
      groupName: string | null;
      groupNameZh: string | null;
      expiresAt: string | null;
    }
  | { ok: false; reason: "invalid" | "not_authenticated" | "unknown" };

export type AcceptResult =
  | { ok: true; groupId: string; inviterName: string; simulated?: boolean }
  | { ok: false; reason: string };
