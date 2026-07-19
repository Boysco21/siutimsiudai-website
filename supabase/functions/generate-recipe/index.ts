// Supabase Edge Function: generate-recipe
//
// Server-side proxy for Google Cloud Vertex AI (Gemini). The billable credential lives HERE as a
// Supabase secret (GCP_SERVICE_ACCOUNT_KEY) and never ships to a device or the app bundle. The
// client (services/recipeGenerationService.ts) sends { ingredients: [{name,nameZh,quantity?,unit?}] };
// we ask Gemini for ONE simple recipe that uses only a sensible subset of those ingredients (plus
// basic staples) and return it as a StructuredRecipe-shaped JSON object.
//
// Deploy:  supabase functions deploy generate-recipe
// Secrets: shared with pantry-scan — see that function's header (GCP_SERVICE_ACCOUNT_KEY, and
//          optional GOOGLE_CLOUD_PROJECT / VERTEX_LOCATION / VERTEX_MODEL). Auth flow + token
//          minting live in ../_shared/vertex.ts. The service account needs the "Vertex AI User" role.
//
// Product constraint enforced here: the prompt NEVER receives the user's nutrition targets and is
// explicitly told not to optimise for them. This is a generic "use up what you have" recipe, by
// design — nutrition tailoring belongs to the logging flow, not the pantry.
//
// Runs in the Supabase Deno runtime, excluded from the app tsconfig. `Deno` is a runtime global.

import { CORS, extractJson, json, proxyError, vertexGenerateContent } from "../_shared/vertex.ts";

const MODEL = Deno.env.get("VERTEX_MODEL") || "gemini-2.5-flash";

// The chef's brief. Kept as a proper Gemini system instruction (systemInstruction, not buried in the
// user turn) so the culinary judgement below governs every generation. The user turn only carries the
// raw pantry list and the required JSON shape.
//
// The rules exist because "use only what's in the pantry" was read too literally: a pantry holding
// pork, tomato, cocoa powder, yogurt and berries would come back as one dish with all five in it.
// A real cook picks a compatible subset and leaves the rest.
const SYSTEM_PROMPT = [
  "You are a practical home cook writing ONE realistic, edible, appetising recipe from a list of",
  "ingredients someone already has. Follow these rules strictly:",
  "",
  "1. SUBSET SELECTION (most important): Do NOT use every ingredient. Choose only the ingredients",
  "   that genuinely belong together in one dish. A good cook leaves the rest in the pantry. Using an",
  "   ingredient that does not fit is a worse mistake than leaving it out.",
  "2. PICK ONE LANE: Never mix sweet / breakfast items (cocoa, chocolate, yogurt, berries, honey,",
  "   cereal, oats, banana) with savoury / dinner items (meat, fish, soy sauce, onion, garlic,",
  "   vegetables). Decide which lane the pantry leans toward and cook only that one.",
  "3. ASSUME BASICS: You may assume the cook has water, a neutral cooking oil, salt, and black",
  "   pepper, even if not listed. Do NOT assume any other ingredient that is not in the list.",
  "4. NO NUTRITION TAILORING: Do not optimise for calories, macros, or any health target. This is",
  "   simply a practical way to use up what the cook already has.",
  "5. List ONLY the ingredients you actually use in the `ingredients` array. Do not list the ones",
  "   you chose to leave out.",
  "",
  "Write for a Hong Kong home kitchen. Every nameZh / titleZh / instructionZh must be Traditional",
  "Chinese as used in Hong Kong.",
].join("\n");

interface SeedIngredient {
  name?: unknown;
  nameZh?: unknown;
  quantity?: unknown;
  unit?: unknown;
}

function buildPrompt(ingredients: SeedIngredient[]): string {
  const lines = ingredients
    .map((i) => {
      const en = typeof i.name === "string" ? i.name : "";
      const zh = typeof i.nameZh === "string" ? i.nameZh : "";
      const label = [en, zh].filter(Boolean).join(" / ");
      const qty = typeof i.quantity === "number" && i.quantity > 0 ? ` (~${i.quantity} ${typeof i.unit === "string" ? i.unit : ""})` : "";
      return label ? `- ${label}${qty}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return [
    "Here is everything the cook has in the pantry. Choose a compatible subset (see your rules) and",
    "build ONE recipe from it.",
    "",
    "Pantry ingredients:",
    lines || "- (none provided)",
    "",
    "Also estimate the nutrition for ONE serving of the finished dish and fill in `micros`: iron,",
    "calcium, potassium and vitamin C in milligrams (mg), vitamin D in micrograms (mcg). These are",
    "rough per-serving estimates that DESCRIBE the dish — do not tailor them to anyone's targets.",
    "",
    "Respond with ONLY a JSON object, no prose, in exactly this shape:",
    "{",
    '  "title": "English title", "titleZh": "中文標題",',
    '  "servings": <number>, "totalMinutes": <number>, "sourceUrl": null,',
    '  "ingredients": [{"name":"English","nameZh":"中文","quantity":<number>,"unit":"g"|"ml"|"piece","displayUnit":"g|ml|piece|bowl|...","rawText":"e.g. 2 pieces egg","substitutedFrom":null}],',
    '  "steps": [{"stepNumber":<1-based int>,"instruction":"English","instructionZh":"中文","imageUri":null,"durationSeconds":<number or null>}],',
    '  "micros": {"iron":<mg>,"calcium":<mg>,"potassium":<mg>,"vitaminC":<mg>,"vitaminD":<mcg>}',
    "}",
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
      maxOutputTokens: 1500,
    });

    const recipe = extractJson(text);
    // The client re-validates and sanitises the whole shape (parseRecipeResponse) before it ever
    // reaches the recipe store, so forwarding the parsed object is safe.
    return json({ recipe }, 200);
  } catch (err) {
    return proxyError(err);
  }
});
