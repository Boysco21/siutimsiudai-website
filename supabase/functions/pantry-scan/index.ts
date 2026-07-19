// Supabase Edge Function: pantry-scan
//
// Server-side proxy for Google Cloud Vertex AI (Gemini vision). The billable credential lives HERE
// as a Supabase secret (GCP_SERVICE_ACCOUNT_KEY) and never ships to a device or the app bundle.
// The client (services/pantryVisionService.ts) sends { imageBase64, mediaType? }; we ask Gemini to
// identify the RAW ingredients in the photo and return them as a clean JSON list.
//
// Deploy:  supabase functions deploy pantry-scan
// Secrets (shared by pantry-scan and generate-recipe):
//   supabase secrets set GCP_SERVICE_ACCOUNT_KEY="$(cat service-account.json)"
//   supabase secrets set GOOGLE_CLOUD_PROJECT=your-gcp-project-id   # optional; falls back to the
//                                                                   # project_id inside the JSON
//   supabase secrets set VERTEX_LOCATION=us-central1                # optional; default us-central1
//   supabase secrets set VERTEX_MODEL=gemini-2.5-flash          # optional; default below
// The service account needs the "Vertex AI User" role. Auth flow + token minting: ../_shared/vertex.ts.
//
// Auth: Supabase's gateway requires a valid apikey/JWT on the request by default, and
// supabase.functions.invoke attaches the user's session automatically — so this proxy is not an
// open relay. (Run `--no-verify-jwt` only if you deliberately want it public.)
//
// This file runs in the Supabase Deno runtime, not the React Native bundle, so it is excluded from
// the app tsconfig (see "exclude": ["supabase"]). `Deno` is a runtime global here.

import { CORS, extractJson, json, proxyError, vertexGenerateContent } from "../_shared/vertex.ts";

// Vision-capable Gemini. Swappable to any current Gemini vision model (env override) without
// touching the client.
const MODEL = Deno.env.get("VERTEX_MODEL") || "gemini-2.5-flash";

const INSTRUCTION = [
  "You are a kitchen inventory assistant. Look at the photo and list only the RAW food",
  "ingredients you can see (produce, meat, eggs, tofu, sauces, dry goods). Ignore plates,",
  "utensils, packaging text, and prepared/cooked dishes.",
  "",
  "Respond with ONLY a JSON object, no prose, in exactly this shape:",
  '{"items":[{"name":"English name","nameZh":"繁體中文名","quantity":<number>,"unit":"g"|"ml"|"piece","confidence":<0..1>}]}',
  "",
  "Rules: nameZh must be Traditional Chinese in Hong Kong usage (e.g. 豉油, 蒜頭, 薯仔).",
  "Use unit 'piece' for countable items, 'g' for weighed solids, 'ml' for liquids.",
  "quantity is your best visual estimate. confidence is how sure you are (0..1).",
  "If you see no food ingredients, return {\"items\":[]}.",
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { imageBase64, mediaType } = await req.json();
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json({ error: "bad_request" }, 400);
    }
    const mimeType = typeof mediaType === "string" && mediaType ? mediaType : "image/jpeg";

    const text = await vertexGenerateContent(MODEL, {
      maxOutputTokens: 1024,
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: INSTRUCTION },
      ],
    });

    const parsed = extractJson(text) as { items?: unknown };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    // The client re-validates and sanitises every row (parseScanResponse), so we can forward the
    // model's list as-is; the app never trusts it blindly and always routes it through the human
    // review screen before saving.
    return json({ items }, 200);
  } catch (err) {
    return proxyError(err);
  }
});
