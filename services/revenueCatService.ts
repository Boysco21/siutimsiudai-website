import { Platform } from "react-native";
import type {
  CustomerInfo,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import {
  resolveTierFromEntitlements,
  SubscriptionTier,
  useSubscriptionStore,
} from "@/stores/useSubscriptionStore";
import { PurchasesSDK } from "./purchasesModule";

/**
 * RevenueCat integration for native Apple In-App Purchase across Free / Pro / Max.
 *
 * Security model (why this is safe to ship):
 *  - The key embedded here is the RevenueCat *public* (publishable) Apple SDK key. Public keys
 *    are meant to live in the client binary: they can fetch offerings and start a purchase, but
 *    they cannot read another user's data, mutate entitlements, or grant access. Only Apple's
 *    signed StoreKit receipt, validated on RevenueCat's servers over TLS, unlocks a tier.
 *  - The *secret* server key (sk_...) is NEVER referenced in the app. It belongs on a backend.
 *  - Entitlement truth flows one way: App Store -> RevenueCat server -> `customerInfo` -> store.
 *    The local `activeTier` is only a UX mirror; a tampered client can flip a pixel, not a plan,
 *    because every gated purchase is re-validated server-side on the next `customerInfo` sync.
 *
 * Availability model (why the app never crashes without it):
 *  - On web and in Expo Go the native module is absent, so `PurchasesSDK` is null (web) or
 *    `configure()` throws (Expo Go). Either way we settle into "unavailable" and the paywall
 *    falls back to its simulated checkout. Nothing here can block boot or throw uncaught.
 */

// Supplied at build time (EXPO_PUBLIC_ vars are inlined into the client bundle, which is correct
// for a *publishable* key). The obviously-fake placeholder makes a misconfigured build fail
// safe — the SDK stays "unavailable" rather than pointing at the wrong RevenueCat project.
const APPLE_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "appl_PLACEHOLDER_NOT_CONFIGURED";

// A real Apple public key starts with "appl_" and isn't our placeholder. Anything else means the
// build wasn't configured for live purchases, so we deliberately stay in mock mode.
const KEY_LOOKS_REAL = APPLE_API_KEY.startsWith("appl_") && !APPLE_API_KEY.includes("PLACEHOLDER");

type Availability = "unknown" | "ready" | "unavailable";
let availability: Availability = "unknown";
let configuring: Promise<boolean> | null = null;

/** True only once the SDK is loaded, configured, and talking to a real RevenueCat project. */
export function isRevenueCatAvailable(): boolean {
  return availability === "ready";
}

// --- Error classification -------------------------------------------------------------------
// RevenueCat error codes are string enums. We match the two buckets the paywall shows distinct
// copy for and treat the rest as a generic failure. Matching raw values (not the runtime enum)
// keeps this dependency-free so it also classifies synthesized errors in mock mode.
export type PurchaseFailure = "cancelled" | "network" | "error";

const CANCELLED_CODE = "1"; // PURCHASE_CANCELLED_ERROR
const NETWORK_CODES = new Set(["10", "35", "32"]); // NETWORK_ERROR, OFFLINE_CONNECTION_ERROR, PRODUCT_REQUEST_TIMED_OUT_ERROR

function classifyError(err: unknown): PurchaseFailure {
  const e = err as Partial<PurchasesError> | undefined;
  if (e?.userCancelled === true || e?.code === CANCELLED_CODE) return "cancelled";
  if (e?.code != null && NETWORK_CODES.has(String(e.code))) return "network";
  return "error";
}

// --- Entitlement sync -----------------------------------------------------------------------
// The single funnel from RevenueCat's server-validated receipt to our store. Called by the
// update listener and after every purchase/restore so the tier always mirrors the real receipt.
function syncTierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
  const activeIds = Object.keys(info.entitlements.active);
  useSubscriptionStore.getState().setTierFromEntitlements(activeIds);
  return resolveTierFromEntitlements(activeIds);
}

/**
 * Configure RevenueCat exactly once. Idempotent and safe to call from app boot on every
 * platform: returns true only when a live SDK + real key are present, false (mock mode)
 * otherwise. Never throws.
 *
 * Pass `getCurrentUserId` as a live accessor (not a snapshot): auth may still be resolving when
 * this is called at boot, so once the SDK is ready we read it and re-identify that user. This
 * closes the race where authStore.applySession already ran identifyUser() against an unready SDK.
 */
export async function configureRevenueCat(
  getCurrentUserId?: () => string | null | undefined,
): Promise<boolean> {
  if (availability === "ready") return true;
  if (configuring) return configuring;

  configuring = (async () => {
    // No native SDK (web / Expo Go), or the build shipped without a real key: stay in mock mode.
    if (!PurchasesSDK || Platform.OS === "web" || !KEY_LOOKS_REAL) {
      availability = "unavailable";
      return false;
    }
    try {
      // Anonymous identity by default: RevenueCat mints a stable anonymous appUserID and keeps it
      // in the device keychain, so entitlements survive reinstalls with zero PII on our side.
      // When real auth lands, call Purchases.logIn(backendUserId) to move the receipt onto it.
      PurchasesSDK.configure({ apiKey: APPLE_API_KEY });
      PurchasesSDK.addCustomerInfoUpdateListener(syncTierFromCustomerInfo);
      // Prime the tier from the store's current view of this device's receipt.
      const info = await PurchasesSDK.getCustomerInfo();
      syncTierFromCustomerInfo(info);
      availability = "ready";
      // Now that we're ready, associate the receipt with whoever is signed in. If auth resolved
      // first, its identifyUser() no-oped against the unready SDK; if it resolves later,
      // applySession identifies then. Either way the signed-in user's tier ends up correct.
      const currentUserId = getCurrentUserId?.();
      if (currentUserId) await identifyUser(currentUserId);
      return true;
    } catch {
      // Most commonly Expo Go, where configure() throws because the native module is absent.
      availability = "unavailable";
      return false;
    }
  })();

  const result = await configuring;
  configuring = null;
  return result;
}

// --- Identity -------------------------------------------------------------------------------
// Move this device's receipt onto the signed-in account and back to anonymous on sign-out, so a
// user's tier follows them across reinstalls and devices. Both are boot-safe no-ops until a real
// build makes the SDK available (Expo Go / web / mock mode return immediately) and never throw.
// authStore.applySession calls these on every auth state change.

/** Associate RevenueCat's receipt with our backend (Supabase) user id after sign-in. */
export async function identifyUser(appUserId: string): Promise<void> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return;
  try {
    const { customerInfo } = await PurchasesSDK.logIn(appUserId);
    syncTierFromCustomerInfo(customerInfo);
  } catch {
    // Leave the tier as-is; the update listener re-syncs on the next receipt change.
  }
}

/** Detach on sign-out: logOut returns a fresh anonymous customer, so entitlements reset to free. */
export async function forgetUser(): Promise<void> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return;
  try {
    const info = await PurchasesSDK.logOut();
    syncTierFromCustomerInfo(info);
  } catch {
    // logOut throws when already anonymous; the local tier reset in authStore covers that case.
  }
}

// --- Entitlement checks ---------------------------------------------------------------------
// The RevenueCat entitlement id that unlocks the Max tier. Mirrors ENTITLEMENT_TIER_MAP in
// stores/useSubscriptionStore and the dashboard's Entitlements setup.
export const MAX_ENTITLEMENT_ID = "max_tier";

/**
 * Client-side convenience check: does this device's server-validated receipt currently carry the
 * Max entitlement? Reads RevenueCat's CustomerInfo when a live SDK is present.
 *
 * This is a UX pre-check ONLY — it decides how fast the invite affordance appears, nothing more.
 * The real, unspoofable Max gate lives in the create-family-invite Edge Function, which re-verifies
 * the entitlement with the RevenueCat SECRET key server-side before it will mint an invite. Returns
 * false in mock mode (web / Expo Go), where the family screen falls back to the local activeTier
 * mirror instead. Never throws.
 */
export async function hasActiveMaxEntitlement(): Promise<boolean> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return false;
  try {
    const info = await PurchasesSDK.getCustomerInfo();
    return Boolean(info.entitlements.active[MAX_ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

// --- Offerings ------------------------------------------------------------------------------
// Normalized shape the paywall renders. Each tier may expose a monthly and/or annual package
// with a store-localized price string (e.g. "HK$48", "US$5.99") straight from StoreKit.
export interface TierOption {
  package: PurchasesPackage;
  priceString: string;
}
export interface TierPricing {
  monthly: TierOption | null;
  annual: TierOption | null;
}
export interface LiveOfferings {
  pro: TierPricing;
  max: TierPricing;
}

function offeringToPricing(offering: PurchasesOffering | null | undefined): TierPricing {
  const toOption = (p: PurchasesPackage | null): TierOption | null =>
    p ? { package: p, priceString: p.product.priceString } : null;
  if (!offering) return { monthly: null, annual: null };
  return { monthly: toOption(offering.monthly), annual: toOption(offering.annual) };
}

/**
 * Fetch and normalize the current offerings. Returns null in mock mode or on any failure, which
 * the paywall reads as "use the built-in HK$ fallback prices". Convention: the dashboard exposes
 * one offering per paid tier keyed "pro" and "max"; a single-offering project falls back to
 * `current` for both so the screen still shows live prices rather than blanks.
 */
export async function getSubscriptionOfferings(): Promise<LiveOfferings | null> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return null;
  try {
    const offerings = await PurchasesSDK.getOfferings();
    const proOffering = offerings.all["pro"] ?? offerings.current ?? null;
    const maxOffering = offerings.all["max"] ?? offerings.current ?? null;
    return {
      pro: offeringToPricing(proOffering),
      max: offeringToPricing(maxOffering),
    };
  } catch {
    return null;
  }
}

// --- Purchase / restore ---------------------------------------------------------------------
export type PurchaseResult =
  | { ok: true; tier: SubscriptionTier }
  | { ok: false; reason: PurchaseFailure };

/** Buy a package. On success the store tier is synced from the returned, server-validated receipt. */
export async function purchaseSubscription(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return { ok: false, reason: "error" };
  try {
    const { customerInfo } = await PurchasesSDK.purchasePackage(pkg);
    return { ok: true, tier: syncTierFromCustomerInfo(customerInfo) };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
  }
}

/** Restore prior purchases (App Store account is the source of truth) and re-sync the tier. */
export async function restoreSubscription(): Promise<PurchaseResult> {
  if (!isRevenueCatAvailable() || !PurchasesSDK) return { ok: false, reason: "error" };
  try {
    const customerInfo = await PurchasesSDK.restorePurchases();
    return { ok: true, tier: syncTierFromCustomerInfo(customerInfo) };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
  }
}
