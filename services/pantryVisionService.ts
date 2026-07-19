import { CanonicalUnit, ScannedIngredient } from "@/types";
import { isSupabaseConfigured, supabase } from "./supabase";
import { delay } from "./util";

// AI pantry vision: turn a kitchen/fridge photo into a list of raw ingredients to review. Two
// layers, exactly like translationService:
//
//   1. Live: a Supabase Edge Function ("pantry-scan") holds the Google Cloud service account
//      SERVER-SIDE and calls Vertex AI (Gemini vision) on our behalf. The billable credential never
//      ships in the client bundle, so it cannot be pulled off a device or out of the JS the way an
//      EXPO_PUBLIC_ key could. See supabase/functions/pantry-scan/index.ts.
//   2. Fallback: an on-device mock (mockScan) used whenever Supabase is not configured (Expo Go,
//      web preview, tests) or the proxy call fails. It returns a rotating set of common HK
//      ingredients so the whole scan -> review -> save flow is demoable and testable with no key.
//
// Swapping vision providers is a server-only change (edit the Edge Function); this interface and
// every screen that calls it stay put.

export interface PantryVisionService {
  // imageBase64 is a raw base64 JPEG (no data: prefix). Returns the raw ingredients the model
  // thinks it saw. The UI ALWAYS routes these into an editable review screen before anything is
  // saved, never a silent write: vision is fuzzy, so human confirmation is the guardrail.
  scan(imageBase64: string): Promise<ScannedIngredient[]>;
}

const SCAN_FN = "pantry-scan";
const UNITS: readonly CanonicalUnit[] = ["g", "ml", "piece"];

// Coerce one loosely-typed row from the proxy (or a future provider) into a clean ScannedIngredient.
// Drops anything without a usable name, clamps the unit to our enum, and forces quantity to a
// finite non-negative number so a bad model response can never inject junk into the pantry.
function normalizeRow(raw: unknown): ScannedIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const nameZh = typeof r.nameZh === "string" ? r.nameZh.trim() : "";
  if (!name && !nameZh) return null; // a row we can't label is useless on the review screen
  const unit = UNITS.includes(r.unit as CanonicalUnit) ? (r.unit as CanonicalUnit) : "piece";
  const q = Number(r.quantity);
  const quantity = Number.isFinite(q) && q > 0 ? q : 0;
  const c = Number(r.confidence);
  const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : undefined;
  return {
    name: name || nameZh,
    nameZh: nameZh || name,
    quantity,
    unit,
    ...(confidence === undefined ? {} : { confidence }),
  };
}

// Parse and sanitise the Edge Function payload. Returns null (not throw) ONLY when the payload is
// malformed (no `items` array) so the caller falls back to the mock. A well-formed response is
// honoured even if it sanitises down to [] — a genuine "the model saw no ingredients" must NOT be
// papered over with fake mock data in production; the review screen handles the empty case.
export function parseScanResponse(data: unknown): ScannedIngredient[] | null {
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return null;
  return items.map(normalizeRow).filter((x): x is ScannedIngredient => x !== null);
}

// Returns null on transport/config FAILURE (so we fall back to the mock), or the parsed rows on a
// successful call — including an empty array, which is a real answer, not a failure.
async function scanViaProxy(imageBase64: string): Promise<ScannedIngredient[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<{ items?: unknown }>(SCAN_FN, {
    body: { imageBase64 },
  });
  if (error) return null;
  return parseScanResponse(data);
}

// A small pantry of common Hong Kong staples the mock rotates through, so repeated demo captures
// in Expo Go surface different (but plausible) ingredients instead of the same list every time.
const MOCK_POOL: ScannedIngredient[] = [
  { name: "Egg", nameZh: "雞蛋", quantity: 6, unit: "piece", confidence: 0.94 },
  { name: "Tomato", nameZh: "番茄", quantity: 3, unit: "piece", confidence: 0.9 },
  { name: "Spring onion", nameZh: "葱", quantity: 2, unit: "piece", confidence: 0.82 },
  { name: "Choy sum", nameZh: "菜心", quantity: 200, unit: "g", confidence: 0.78 },
  { name: "Pork", nameZh: "豬肉", quantity: 300, unit: "g", confidence: 0.86 },
  { name: "Tofu", nameZh: "豆腐", quantity: 1, unit: "piece", confidence: 0.8 },
  { name: "Garlic", nameZh: "蒜頭", quantity: 4, unit: "piece", confidence: 0.71 },
  { name: "Ginger", nameZh: "薑", quantity: 1, unit: "piece", confidence: 0.68 },
  { name: "Carrot", nameZh: "甘筍", quantity: 2, unit: "piece", confidence: 0.83 },
  { name: "Shiitake mushroom", nameZh: "冬菇", quantity: 100, unit: "g", confidence: 0.65 },
];
let mockCursor = 0;

// Deterministic-per-call rotating slice of the pool. Kept pure and exported so a test can assert
// the shape without booting a camera or a network client.
export function mockScan(): ScannedIngredient[] {
  const size = 5;
  const start = mockCursor % MOCK_POOL.length;
  mockCursor += 1;
  return Array.from({ length: size }, (_, i) => MOCK_POOL[(start + i) % MOCK_POOL.length]);
}

export const pantryVisionService: PantryVisionService = {
  async scan(imageBase64) {
    // Secure live path first, on-device mock as a graceful fallback. Only a null (failure) falls
    // through to the mock; a successful-but-empty scan returns [] so we never fabricate items.
    if (isSupabaseConfigured) {
      const remote = await scanViaProxy(imageBase64).catch(() => null);
      if (remote !== null) return remote;
    }
    await delay(1100); // let the capture screen show its "scanning" state in mock mode
    return mockScan();
  },
};
