// Supabase Edge Function: translate
//
// Server-side proxy for Google Cloud Translation. The billable API key lives HERE as a Supabase
// secret (GOOGLE_TRANSLATE_API_KEY) and never ships to a device or the app bundle. The client
// (services/translationService.ts) calls this function with { texts, target }; we forward to
// Google, then return { translations } in the same order.
//
// Deploy:   supabase functions deploy translate
// Secret:   supabase secrets set GOOGLE_TRANSLATE_API_KEY=AIza...your-key...
//
// This file runs in the Supabase Deno runtime, not in the React Native bundle, so it is excluded
// from the app tsconfig (see "exclude": ["supabase"]). `Deno` is a runtime global here.

const GOOGLE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

// Map our app locale codes to Google's target codes. Google uses zh-TW for Traditional Chinese;
// the app speaks zh-Hant. Anything unmapped is passed through unchanged.
const TARGET_MAP: Record<string, string> = { "zh-Hant": "zh-TW" };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Browser preflight for the web build.
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const apiKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 500);

    const { texts, target, source } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0 || typeof target !== "string") {
      return json({ error: "bad_request" }, 400);
    }
    const googleTarget = TARGET_MAP[target] ?? target;
    // Pin the source language. Left to auto-detect, Google misreads short ingredient strings:
    // "Soy sauce" is parsed as Spanish ("soy" = I am, "saúce" = willow) and returns 我是柳樹.
    // The app always sends English recipe text, so default to "en"; a caller may override.
    const googleSource =
      typeof source === "string" && source.length > 0 ? TARGET_MAP[source] ?? source : "en";

    // format: "text" keeps Google from HTML-escaping the output, so we get clean strings back.
    const upstream = await fetch(`${GOOGLE_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: texts, source: googleSource, target: googleTarget, format: "text" }),
    });
    if (!upstream.ok) return json({ error: "upstream_failed" }, 502);

    const payload = await upstream.json();
    const rows: Array<{ translatedText?: string }> = payload?.data?.translations ?? [];
    // Google preserves input order; fall back to the original text if a row is missing.
    const translations = texts.map((t: string, i: number) => rows[i]?.translatedText ?? t);
    return json({ translations }, 200);
  } catch (_err) {
    return json({ error: "internal_error" }, 500);
  }
});
