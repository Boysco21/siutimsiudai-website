// Pure, dependency-free helpers for the Max-plan family-linking feature. Kept free of React,
// expo-linking and Supabase so the invite-link math and the reason -> i18n-key maps are trivially
// unit-testable (see utils/__tests__/familyInvite.test.ts) and safe to import from anywhere.
//
// The link transport is an HTTPS universal link: https://siutimsiudai.app/invite/<token>. The same
// path also resolves through the app scheme (siutimsiudai://invite/<token>) and the Expo Go dev
// proxy (exp://host/--/invite/<token>), so parseInviteToken accepts all three shapes.

import type { FamilyRole } from "@/types/family";

// The domain that hosts the Apple App Site Association / Android assetlinks files and the public
// /invite landing page. A tap on this link opens the app straight onto the Accept screen.
export const INVITE_WEB_BASE = "https://siutimsiudai.app";

// Group-size cap: 1 manager + up to 5 dependents. MUST stay in lockstep with
// family_groups.max_members (default 6) in database/0002_family_linking.sql.
export const FAMILY_MAX_MEMBERS = 6;

/** The shareable https link for an invite token. The token is opaque and single-use. */
export function buildInviteUrl(token: string): string {
  return `${INVITE_WEB_BASE}/invite/${encodeURIComponent(token.trim())}`;
}

/**
 * Pull the invite token out of any incoming deep link, or null when the URL is not an invite link.
 * Handles the https universal link, the siutimsiudai:// app scheme and the exp:// Expo Go proxy by
 * simply locating the segment after "/invite/". Pure string work — no expo-linking — so it runs in
 * jest and can never pull a native module into a util.
 */
export function parseInviteToken(url: string | null | undefined): string | null {
  if (!url) return null;
  // Drop any query string or fragment first so "?x=1" / "#frag" never leak into the token.
  const withoutQuery = url.split(/[?#]/)[0];
  const match = withoutQuery.match(/\/invite\/([^/]+)\/?$/);
  if (!match) return null;
  let token = match[1];
  try {
    token = decodeURIComponent(token);
  } catch {
    // Leave the raw segment if it isn't valid percent-encoding.
  }
  token = token.trim();
  return token.length > 0 ? token : null;
}

// --- Group-size math ------------------------------------------------------------------------

/** Is the group at capacity (no room for another dependent)? */
export function isGroupFull(memberCount: number, maxMembers: number = FAMILY_MAX_MEMBERS): boolean {
  return memberCount >= maxMembers;
}

/** How many more members can join before the cap. Never negative. */
export function remainingSeats(memberCount: number, maxMembers: number = FAMILY_MAX_MEMBERS): number {
  return Math.max(0, maxMembers - memberCount);
}

// --- Role helpers ---------------------------------------------------------------------------

export function isManager(role: FamilyRole | null | undefined): boolean {
  return role === "manager";
}

export function isDependent(role: FamilyRole | null | undefined): boolean {
  return role === "dependent";
}

// --- Reason -> i18n-key maps ----------------------------------------------------------------
// The server returns a stable machine reason; the UI maps it to localized copy. Kept here (pure)
// so the mapping is unit-testable and one place governs it, matching the auth screen's approach.

// Reasons the accept RPC (accept_family_invite) can return, mapped to i18n keys. `not_authenticated`
// is handled by the signed-out flow before we ever call accept, but it is mapped for completeness.
export const ACCEPT_REASON_KEYS: Record<string, string> = {
  invalid: "family.errInvalid",
  expired: "family.errExpired",
  already_used: "family.errAlreadyUsed",
  already_linked: "family.errAlreadyLinked",
  self: "family.errSelf",
  group_full: "family.errGroupFull",
  revoked: "family.errInvalid",
  not_authenticated: "family.signInToAccept",
};

/** Map an accept reason to its i18n key, falling back to the generic accept error. */
export function acceptReasonKey(reason: string | null | undefined): string {
  return (reason && ACCEPT_REASON_KEYS[reason]) || "family.errAcceptGeneric";
}

// Reasons the create-family-invite Edge Function can return, mapped to i18n keys.
export const CREATE_REASON_KEYS: Record<string, string> = {
  max_required: "family.errMaxRequired",
  group_full: "family.errGroupFull",
  unavailable: "family.errGenerate",
  unknown: "family.errGenerate",
};

/** Map a create-invite reason to its i18n key, falling back to the generic generate error. */
export function createReasonKey(reason: string | null | undefined): string {
  return (reason && CREATE_REASON_KEYS[reason]) || "family.errGenerate";
}

// --- Offline demo token ---------------------------------------------------------------------

/**
 * A clearly-fake token for the local-first demo path (no Supabase configured: Expo Go / web / jest).
 * It only drives the on-device UI so the whole invite -> accept flow can be walked through offline;
 * it is never a real, server-stored credential. A real token is minted server-side with a CSPRNG in
 * the create-family-invite Edge Function and only its sha256 hash is ever stored.
 */
export function makeDemoToken(): string {
  return `demo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** True for the demo tokens minted above, so screens can label the simulated path honestly. */
export function isDemoToken(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith("demo-");
}
