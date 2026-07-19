// Supabase Edge Function: estimate-meal
//
// Server-side proxy for Google Cloud Vertex AI (Gemini). This is the LOGGING AI: it turns a free
// meal description ("朝早食咗一碗麥片加 mixed berries", "two boiled eggs and toast") into a clean list
// of foods with estimated macros AND the five tracked micronutrients, so a smart-manual / voice log
// resolves ANY real food, not just the curated HK list. The billable credential lives HERE as a
// Supabase secret (GCP_SERVICE_ACCOUNT_KEY) and never ships to a device or the app bundle — the same
// boundary as generate-recipe and pantry-scan.
//
// The client (services/nlpMealService.ts) sends { text }; we return { meals: [...] } shaped to
// ParsedMeal. The client re-validates and sanitises every field (parseMealResponse) and falls back
// to an on-device mock whenever this proxy is unconfigured or fails, so Expo Go / web / jest keep
// working with no key.
//
// Deploy:  supabase functions deploy estimate-meal
// Secrets: shared with pantry-scan / generate-recipe — see pantry-scan's header (GCP_SERVICE_ACCOUNT_KEY,
//          and optional GOOGLE_CLOUD_PROJECT / VERTEX_LOCATION / VERTEX_MODEL). Auth flow + token
//          minting live in ../_shared/vertex.ts. The service account needs the "Vertex AI User" role.
//
// Auth: Supabase's gateway requires a valid apikey/JWT by default and supabase.functions.invoke
// attaches the user's session automatically, so this proxy is not an open relay.
//
// Runs in the Supabase Deno runtime, excluded from the app tsconfig. `Deno` is a runtime global.

import { CORS, extractJson, json, proxyError, vertexGenerateContent } from "../_shared/vertex.ts";

const MODEL = Deno.env.get("VERTEX_MODEL") || "gemini-2.5-flash";

// The nutritionist's brief. Kept as a proper Gemini systemInstruction (not buried in the user turn)
// so this judgement governs every estimate. The user turn only carries the raw meal text and the
// required JSON shape.
const SYSTEM_PROMPT = [
  "You are a nutrition estimator for a Hong Kong meal-logging app. You read a short, free-text meal",
  "description that may mix English and Traditional Chinese / Cantonese, and you estimate its",
  "nutrition. Follow these rules strictly:",
  "",
  "1. SPLIT INTO FOODS: Identify each distinct food or dish in the description and return one entry",
  "   per food. 'two eggs and toast' is two entries; 'wonton noodles' is one.",
  "2. RESPECT THE PORTION: If the text states an amount ('2 eggs', '一碗', 'a large bowl'), reflect it",
  "   in the totals and describe it in `quantity` + `unit`. If no amount is given, assume one normal",
  "   serving (quantity 1).",
  "3. ESTIMATE REALISTICALLY: Give sensible per-portion figures for a typical version of the food.",
  "   calories in kcal; protein, carbs, fat in grams. These DESCRIBE the food — never tailor them to",
  "   anyone's calorie or macro target.",
  "4. ALWAYS FILL MICROS: iron, calcium, potassium and vitamin C in milligrams (mg); vitamin D in",
  "   micrograms (mcg). Use 0 for a micronutrient the food genuinely lacks, never null.",
  "5. NEVER DEAD-END: If the food is unclear, return your single best-guess entry rather than an",
  "   empty list. Only truly empty input yields an empty list.",
  "",
  "nameZh must be Traditional Chinese as used in Hong Kong (e.g. 雞胸肉, 奇異果, 多士).",
].join("\n");

function buildPrompt(text: string): string {
  return [
    "Estimate the nutrition for this meal description:",
    "",
    `"${text}"`,
    "",
    "Respond with ONLY a JSON object, no prose, in exactly this shape:",
    "{",
    '  "meals": [',
    "    {",
    '      "name": "English food name", "nameZh": "中文名",',
    '      "calories": <kcal>, "protein": <g>, "carbs": <g>, "fat": <g>,',
    '      "quantity": <number>, "unit": "portion label, e.g. 1 bowl / 2 pieces / 100 g",',
    '      "mealType": "breakfast" | "lunch" | "dinner" | "snack",',
    '      "micros": {"iron":<mg>,"calcium":<mg>,"potassium":<mg>,"vitaminC":<mg>,"vitaminD":<mcg>}',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return json({ error: "bad_request" }, 400);
    }

    const raw = await vertexGenerateContent(MODEL, {
      system: SYSTEM_PROMPT,
      parts: [{ text: buildPrompt(text.trim()) }],
      maxOutputTokens: 1024,
    });

    const parsed = extractJson(raw) as { meals?: unknown };
    const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
    // The client re-validates and sanitises every meal (parseMealResponse) before anything reaches
    // the log, so forwarding the model's list as-is is safe — the app never trusts it blindly.
    return json({ meals }, 200);
  } catch (err) {
    return proxyError(err);
  }
});
