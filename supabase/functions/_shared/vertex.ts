// Shared Google Cloud (Vertex AI) client for the Edge Function proxies.
//
// SECURITY (the whole point of this file): the Google Cloud service account — including its RSA
// private key — lives ONLY here, server-side, as a Supabase secret (GCP_SERVICE_ACCOUNT_KEY).
// It is never shipped to a device or the app bundle and cannot be pulled off the JS the way an
// EXPO_PUBLIC_ key could. Each request mints a short-lived OAuth access token from that key and
// calls Vertex with a Bearer token; the key material itself never leaves this runtime.
//
// Why a service account and not a simple API key: true Vertex AI (…-aiplatform.googleapis.com)
// authenticates with Google OAuth, not an "?key=" query param. So the secret is the service account
// JSON (client_email + private_key), and we run the standard JWT-bearer grant by hand — there is no
// Google SDK / Application Default Credentials in the Supabase Deno runtime.
//
// Runs in the Supabase Deno runtime (Deno.env, crypto.subtle, fetch, btoa/atob), excluded from the
// app tsconfig. `Deno` is a runtime global here.

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Map an internal throw to a stable client-facing error. We deliberately expose only coarse codes
// (never the underlying Google/token error text) so nothing about the credentials leaks to callers,
// and so the client's mock-fallback logic keeps working unchanged.
export function proxyError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : "";
  // Log the full reason server-side (visible only in the Supabase function logs, never to the
  // client) so an operator can diagnose a 5xx without any of it reaching the device.
  console.error("[vertex] proxyError:", msg);
  if (msg.startsWith("not_configured")) return json({ error: "not_configured" }, 500);
  if (msg.startsWith("auth_failed") || msg.startsWith("upstream_failed"))
    return json({ error: "upstream_failed" }, 502);
  return json({ error: "internal_error" }, 500);
}

// Gemini is asked to answer with pure JSON (generationConfig.responseMimeType), but never trust it:
// strip a ```json fence and grab the first balanced {...} so a stray sentence can't break parsing.
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no_json");
  return JSON.parse(body.slice(start, end + 1));
}

// --- Service account + OAuth ------------------------------------------------------------------

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let saCache: ServiceAccount | null = null;

function readServiceAccount(): ServiceAccount {
  if (saCache) return saCache;
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");
  if (!raw) throw new Error("not_configured");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("not_configured");
  }
  if (!parsed.client_email || !parsed.private_key) throw new Error("not_configured");
  saCache = parsed;
  return parsed;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PEM (-----BEGIN PRIVATE KEY-----, PKCS#8) -> raw DER bytes for crypto.subtle.importKey.
function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Cache the access token across warm invocations of a single function instance (Google tokens last
// ~1h). Refreshed 60s early so an in-flight request never races the expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const sa = readServiceAccount();
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64url(
    enc.encode(
      JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_ENDPOINT, iat: now, exp: now + 3600 }),
    ),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const assertion = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`auth_failed http=${res.status} ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const token = data?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("auth_failed no_access_token");
  }
  cachedToken = { value: token, expiresAt: now + (Number(data.expires_in) || 3600) };
  return token;
}

// --- Vertex AI generateContent ---------------------------------------------------------------

export interface VertexPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GenerateContentOptions {
  system?: string;
  parts: VertexPart[];
  maxOutputTokens?: number;
  temperature?: number;
}

function projectId(): string {
  const explicit = Deno.env.get("GOOGLE_CLOUD_PROJECT");
  if (explicit) return explicit;
  const sa = readServiceAccount();
  if (sa.project_id) return sa.project_id;
  throw new Error("not_configured");
}

// Call a Gemini model on Vertex AI and return the raw text of the first candidate. Forces JSON-only
// output via responseMimeType; the caller still runs extractJson + full shape validation, so the
// model is never trusted. Throws (never returns partial junk) so the client falls back to its mock.
export async function vertexGenerateContent(model: string, opts: GenerateContentOptions): Promise<string> {
  const token = await getAccessToken();
  const location = Deno.env.get("VERTEX_LOCATION") || "us-central1";
  const project = projectId();
  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 1500,
      temperature: opts.temperature ?? 0.4,
      responseMimeType: "application/json",
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`upstream_failed http=${res.status} model=${model} loc=${location} ${detail.slice(0, 600)}`);
  }

  const payload = await res.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error("upstream_failed no_parts " + JSON.stringify(payload).slice(0, 600));
  }
  const text = parts.map((p: VertexPart) => (typeof p.text === "string" ? p.text : "")).join("").trim();
  if (!text) {
    throw new Error("upstream_failed empty_text " + JSON.stringify(payload).slice(0, 600));
  }
  return text;
}
