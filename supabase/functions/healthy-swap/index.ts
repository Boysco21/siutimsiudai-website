// Supabase Edge Function: healthy-swap
//
// Server-side proxy for Google Cloud Vertex AI (Gemini). The billable credential lives HERE as a
// Supabase secret (GCP_SERVICE_ACCOUNT_KEY) and never ships to a device or the app bundle. The
// client (services/healthySwapService.ts) applies its curated HK swap map first, then sends only
// the leftovers it could not place as { ingredients: [{ name, nameZh }] }. We ask Gemini for ONE
// healthier substitute per ingredient (omitting the ones already healthy) and return them keyed by
// the 1-based index into the list we received, so the client can rejoin each swap to its ingredient
// id without any id ever leaving the device.
//
// Deploy:  supabase functions deploy healthy-swap
// Secrets: shared with the other Vertex proxies (GCP_SERVICE_ACCOUNT_KEY, and optional
//          GOOGLE_CLOUD_PROJECT / VERTEX_LOCATION / VERTEX_MODEL). Auth flow + token minting live
//          in ../_shared/vertex.ts. The service account needs the "Vertex AI User" role.
//
// Runs in the Supabase Deno runtime, excluded from the app tsconfig. `Deno` is a runtime global.

import { CORS, extractJson, json, proxyError, vertexGenerateContent } from "../_shared/vertex.ts";

const MODEL = Deno.env.get("VERTEX_MODEL") || "gemini-2.5-flash";

// The nutritionist's brief. Kept as a proper Gemini system instruction so the judgement below
// governs every generation; the user turn only carries the numbered ingredient list and the
// required JSON shape.
const SYSTEM_PROMPT = [
  "You are a Hong Kong nutritionist. For each ingredient you are given, suggest ONE healthier",
  "cooking substitute that is easy to buy in a Hong Kong supermarket, plus a numeric ratio to",
  "adjust the amount (substitute quantity / original quantity — e.g. butter to olive oil is 0.75).",
  "Follow these rules strictly:",
  "",
  "1. OMIT freely: if an ingredient is already healthy or has no genuinely better swap, leave it",
  "   out. Do not force a substitute you would not actually recommend.",
  "2. Keep every reason to 10 words or fewer.",
  "3. nameZh / substituteZh / reasonZh must be Traditional Chinese as used in Hong Kong.",
].join("\n");

interface SeedIngredient {
  name?: unknown;
  nameZh?: unknown;
}

function buildPrompt(ingredients: SeedIngredient[]): string {
  const lines = ingredients
    .map((i, idx) => {
      const en = typeof i.name === "string" ? i.name : "";
      const zh = typeof i.nameZh === "string" ? i.nameZh : "";
      const label = [en, zh].filter(Boolean).join(" / ");
      return `${idx + 1}. ${label || "(unknown)"}`;
    })
    .join("\n");

  return [
    "Ingredients (each line is numbered; use that number as `index`):",
    lines,
    "",
    "Respond with ONLY a JSON object, no prose, in exactly this shape:",
    "{",
    '  "swaps": [',
    '    {"index": <1-based number matching the list>, "substitute": "English",',
    '     "substituteZh": "中文", "quantityRatio": <number>, "reason": "English, <= 10 words",',
    '     "reasonZh": "中文，10 字以內"}',
    "  ]",
    "}",
    "Include an entry ONLY for ingredients that have a healthier swap; omit all the others.",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { ingredients } = await req.json();
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return json({ error: "bad_request" }, 400);
    }

    const text = await vertexGenerateContent(MODEL, {
      system: SYSTEM_PROMPT,
      parts: [{ text: buildPrompt(ingredients) }],
      maxOutputTokens: 1024,
    });

    const parsed = extractJson(text) as { swaps?: unknown };
    const swaps = Array.isArray(parsed?.swaps) ? parsed.swaps : [];
    // The client re-validates every row (swapsFromProxy) and rejoins it to an ingredient id before
    // anything reaches the recipe store, so forwarding the parsed array as-is is safe.
    return json({ swaps }, 200);
  } catch (err) {
    return proxyError(err);
  }
});
