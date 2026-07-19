import { Platform } from "react-native";
import { RecipeIngredient, RecipeStep, StructuredRecipe } from "@/types";
import { toCanonical } from "@/utils/unitConverter";
import { reconcileToNature } from "@/utils/ingredientNature";
import { BRAISED_BEEF, STEAMED_FISH } from "./sampleStructured";

type StructuredIngredient = Omit<RecipeIngredient, "id" | "recipeId">;
type StructuredStep = Omit<RecipeStep, "id" | "recipeId">;

export interface UrlScrapeService {
  // Fetches a recipe page and parses its schema.org/Recipe JSON-LD into our structured
  // shape, with the source URL attached so the recipe card can link back. The two demo
  // links (DayDayCook / Cookpad HK) resolve to bundled fixtures so the walkthrough works
  // offline; every other URL is fetched and parsed for real.
  scrape(url: string): Promise<StructuredRecipe>;
}

const FETCH_TIMEOUT_MS = 15000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// -- HTML text helpers -------------------------------------------------------

// Named entities we actually see in recipe copy. Numeric entities are handled separately.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  frac12: "½",
  frac13: "⅓",
  frac23: "⅔",
  frac14: "¼",
  frac34: "¾",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name) =>
      name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : match,
    );
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

// Strip tags, decode entities, collapse whitespace. Good enough for recipe field text.
export function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// -- JSON-LD extraction ------------------------------------------------------

// Pull every <script type="application/ld+json"> block and JSON.parse it. Unparseable
// blocks (stray CDATA wrappers, malformed JSON) are skipped rather than throwing.
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    // Strict parse first (fast path for well-formed JSON), then a CDATA-stripped retry, then
    // a lenient retry that escapes raw control chars some sites leave unescaped in strings.
    const parsed =
      tryParseJson(raw) ??
      tryParseJson(stripCdata(raw)) ??
      tryParseJson(sanitizeJsonLd(raw)) ??
      tryParseJson(sanitizeJsonLd(stripCdata(raw)));
    if (parsed !== undefined) blocks.push(parsed);
  }
  return blocks;
}

// Some recipe plugins emit JSON-LD with literal newlines/tabs inside string values (author
// bios, multi-line descriptions). Strict JSON forbids raw control chars in strings, so
// JSON.parse rejects the whole block and the recipe is lost. Walk the text and escape any
// control char that sits *inside* a double-quoted string, leaving structural whitespace
// between tokens untouched. Backslash escapes are respected so an escaped quote (\") does not
// prematurely end the string.
function sanitizeJsonLd(input: string): string {
  const ESC: Record<number, string> = { 8: "\\b", 9: "\\t", 10: "\\n", 12: "\\f", 13: "\\r" };
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else {
        const code = input.charCodeAt(i);
        out += code < 0x20 ? (ESC[code] ?? " ") : ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function stripCdata(raw: string): string {
  return raw.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}

function isRecipeNode(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const type = (value as Record<string, unknown>)["@type"];
  if (typeof type === "string") return /recipe/i.test(type);
  if (Array.isArray(type)) return type.some((t) => typeof t === "string" && /recipe/i.test(t));
  return false;
}

// Recurse through arrays and @graph containers to find the Recipe node. WordPress/Yoast
// sites nest it inside @graph alongside WebPage/Organization nodes.
export function findRecipeNode(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeNode(value)) return value as Record<string, unknown>;
  const graph = (value as Record<string, unknown>)["@graph"];
  if (Array.isArray(graph)) return findRecipeNode(graph, depth + 1);
  return null;
}

// -- Field parsers -----------------------------------------------------------

// ISO 8601 duration ("PT1H30M", "PT45M", "P0DT0H20M0S") to whole minutes.
export function parseIsoDurationMinutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : null;
}

function clampServings(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(Math.round(n), 99);
}

// recipeYield may be a number, a string ("4" / "4 servings"), or an array of either.
export function parseServings(recipeYield: unknown): number {
  const first = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield;
  if (typeof first === "number") return clampServings(first);
  if (typeof first === "string") {
    const match = first.match(/\d+/);
    if (match) return clampServings(parseInt(match[0], 10));
  }
  return 2;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

function tokenToNumber(token: string): number | null {
  if (token in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[token];
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split("/").map(Number);
    return b ? a / b : null;
  }
  if (/^\d*\.\d+$/.test(token)) return parseFloat(token);
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return null;
}

// Pull a leading quantity off an ingredient line. Handles integers, decimals, ascii and
// unicode fractions, mixed numbers ("1 1/2", "1 1/2"), and ranges ("1-2" -> lower bound).
// Returns the remaining text so the caller can look for a unit next.
function parseLeadingQuantity(text: string): { value: number | null; rest: string } {
  // Collapse a range to its lower bound: "1-2 cloves" / "1 to 2 cloves" -> "1 ...".
  let s = text
    .replace(/^(\s*\d+(?:\.\d+)?)\s*[-–—]\s*\d+(?:\.\d+)?/, "$1")
    .replace(/^(\s*\d+(?:\.\d+)?)\s+to\s+\d+(?:\.\d+)?/i, "$1");
  // Separate a digit fused to a unicode fraction: "1½" -> "1 ½".
  s = s.replace(new RegExp(`(\\d)([${FRACTION_CHARS}])`, "g"), "$1 $2");

  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { value: null, rest: "" };

  const first = tokenToNumber(tokens[0]);
  if (first === null) return { value: null, rest: text.trim() };

  let value = first;
  let consumed = 1;
  // Mixed number: integer followed by a fraction token.
  if (tokens.length > 1 && Number.isInteger(first)) {
    const second = tokens[1];
    if (/^\d+\/\d+$/.test(second) || second in UNICODE_FRACTIONS) {
      const frac = tokenToNumber(second);
      if (frac !== null) {
        value = first + frac;
        consumed = 2;
      }
    }
  }
  return { value: round2(value), rest: tokens.slice(consumed).join(" ") };
}

// Recipe words to canonical converter keys understood by toCanonical.
const UNIT_SYNONYMS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
};

// recipetineats-style dual units ("600 g / 1.2 lb beef") leave "/ 1.2 lb beef" after the
// primary amount is parsed; drop the alternate measurement so the name is just the food.
function stripDualUnit(name: string): string {
  const m = name.match(/^\/\s*([\d.,/\s-]+?)\s*([a-zA-Z]+)\s+(.*)$/);
  if (m && UNIT_SYNONYMS[m[2].toLowerCase()]) return m[3].trim();
  return name;
}

// Peel parenthetical groups from a string, inside out, so nested notes like
// "(, at least 20% fat (Note 1))" come off in one pass. Whitespace tidy is left to callers.
function removeParens(s: string): string {
  let prev = "";
  let out = s;
  while (out !== prev) {
    prev = out;
    out = out.replace(/\s*\([^()]*\)/g, "");
  }
  return out;
}

// Drop parenthetical notes so ingredient names stay simple, e.g.
// "beef mince (ground beef) (, at least 20% fat (Note 1))" -> "beef mince", then tidy stray
// whitespace and dangling commas.
function stripNotes(name: string): string {
  return removeParens(name)
    .replace(/\s+/g, " ")
    .replace(/\s+([,;])/g, "$1")
    .replace(/[,;]\s*$/, "")
    .trim();
}

// Turn a single recipeIngredient string into a structured ingredient. Unquantified lines
// ("Salt and pepper to taste") keep quantity 0 and the whole line as the name, so the UI
// can show the text without a bogus "0 piece" amount.
export function parseIngredientLine(raw: string): StructuredIngredient {
  const rawText = stripHtml(String(raw));
  const asPiece = (quantity: number, rawName: string): StructuredIngredient => {
    const name = stripNotes(rawName) || rawText;
    return {
      name,
      nameZh: name,
      quantity: round2(quantity),
      unit: "piece",
      displayUnit: "piece",
      rawText,
      substitutedFrom: null,
    };
  };

  if (!rawText) return asPiece(0, rawText);

  const { value, rest } = parseLeadingQuantity(rawText);
  if (value === null) return asPiece(0, rawText);

  const words = rest.split(/\s+/).filter(Boolean);
  const unitWord = (words[0] ?? "").toLowerCase().replace(/\.$/, "");
  const converterKey = UNIT_SYNONYMS[unitWord];

  if (converterKey) {
    const name = stripNotes(stripDualUnit(words.slice(1).join(" ").trim())) || rawText;
    const canonical = toCanonical(value, converterKey);
    // A tbsp of soy sauce is volume; a tbsp of flour is really weight. Let the ingredient's
    // nature pick mL vs g so metric reads sensibly regardless of how the source measured it.
    const { quantity, unit } = reconcileToNature(name, converterKey, canonical);
    const displayUnit = unit === canonical.unit ? converterKey : unit;
    return { name, nameZh: name, quantity, unit, displayUnit, rawText, substitutedFrom: null };
  }

  // A bare count with no recognised unit: "4 hamburger buns", "2 eggs".
  return asPiece(value, rest.trim());
}

function stepDurationSeconds(text: string): number | null {
  const match = text.match(/(\d+)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("h")) return n * 3600;
  if (unit.startsWith("s")) return n;
  return n * 60;
}

// Split a single instruction blob into steps by <br>, then newlines, then sentences.
function splitInstructionString(input: string): string[] {
  const withBreaks = input.replace(/<br\s*\/?>/gi, "\n");
  const byLine = withBreaks
    .split(/\r?\n+/)
    .map((s) => stripHtml(s))
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  const stripped = stripHtml(withBreaks);
  // Sentence split without lookbehind (Hermes-safe): keep trailing punctuation.
  const sentences = (stripped.match(/[^.!?。！？]+[.!?。！？]*/g) ?? [stripped])
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length ? sentences : [stripped];
}

// recipeInstructions may be a string, an array of strings, HowToStep objects, or
// HowToSection objects that wrap steps in itemListElement. Flatten them all to lines.
function collectInstructionTexts(value: unknown, out: string[], depth: number): void {
  if (depth > 5 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectInstructionTexts(item, out, depth + 1);
    return;
  }
  if (typeof value === "string") {
    const cleaned = stripHtml(value);
    if (cleaned) out.push(cleaned);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.itemListElement)) {
      collectInstructionTexts(obj.itemListElement, out, depth + 1);
      return;
    }
    const text = typeof obj.text === "string" ? obj.text : obj.name;
    if (typeof text === "string") {
      const cleaned = stripHtml(text);
      if (cleaned) out.push(cleaned);
    }
  }
}

// Common imperative verbs that open a cooking step. When a step already leads with one of
// these it is left alone; otherwise we try to lift a section label off the front so the
// action comes first ("Patties: Separate the beef" -> "Separate the beef").
const STEP_VERBS = new Set([
  "add", "arrange", "assemble", "bake", "baste", "beat", "blend", "boil", "break", "bring",
  "broil", "brown", "brush", "chill", "chop", "coat", "combine", "cook", "cool", "cover",
  "crack", "crush", "cut", "dice", "dip", "dissolve", "divide", "drain", "drizzle", "drop",
  "dry", "dust", "fill", "flip", "fold", "form", "fry", "garnish", "grate", "grease", "grill",
  "grind", "heat", "knead", "ladle", "layer", "leave", "let", "line", "marinate", "mash",
  "measure", "melt", "microwave", "mince", "mix", "pat", "peel", "place", "pour", "preheat",
  "prepare", "press", "pulse", "punch", "puree", "put", "reduce", "refrigerate", "remove",
  "repeat", "reserve", "return", "rinse", "roast", "roll", "rub", "saute", "sauté", "scatter",
  "scoop", "scrape", "season", "separate", "serve", "set", "shake", "shape", "shred", "sift",
  "simmer", "skim", "slice", "soak", "spoon", "spread", "sprinkle", "squeeze", "steam", "stir",
  "strain", "stuff", "take", "taste", "tear", "toast", "top", "toss", "transfer", "trim",
  "turn", "wash", "whip", "whisk", "wipe", "work", "wrap",
]);

function startsWithStepVerb(text: string): boolean {
  const first = text.trim().toLowerCase().match(/^[a-zà-ÿ]+/)?.[0];
  return first ? STEP_VERBS.has(first) : false;
}

// Tidy one instruction line so it reads like a concise, verb-first step. Drops leading
// bullets and "Step 1." / "1)" numbering, lifts a short "Label:" heading when the step does
// not already open on a verb, and peels parenthetical asides. Duration is read from the raw
// text before this runs, so an "(about 20 minutes)" note still sets the timer.
function cleanStepText(text: string): string {
  let s = text.trim();
  s = s
    .replace(/^[-–—•*]\s+/, "")
    .replace(/^step\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\d+\s*[.)]\s+/, "");
  // Lift a short "Label:" heading ("Patties:", "Toast buns:", "Cook:") off the front so the
  // step opens on its action. Kept narrow (<= 4 words, no internal comma/period) and only
  // when the continuation reads like a real instruction (starts capitalised or on a verb),
  // so a mid-sentence clause like "Meanwhile, cook the pasta: stir" is never truncated.
  const labelled = s.match(/^([^:.!?,]{1,30}):\s+(\S.*)$/);
  if (labelled && labelled[1].trim().split(/\s+/).length <= 4) {
    const rest = labelled[2].trim();
    if (/^[A-Z]/.test(rest) || startsWithStepVerb(rest)) s = rest;
  }
  return removeParens(s)
    .replace(/[()]/g, " ") // drop a bracket left unbalanced by the source
    .replace(/\s+/g, " ")
    .replace(/\s+([,;.!?])/g, "$1")
    .replace(/([.!?])[.!?]+/g, "$1") // collapse ".." left after a whole parenthetical sentence is removed
    .trim();
}

export function parseInstructions(value: unknown): StructuredStep[] {
  const texts = typeof value === "string" ? splitInstructionString(value) : [];
  if (typeof value !== "string") collectInstructionTexts(value, texts, 0);
  return texts
    .map((raw) => ({ instruction: cleanStepText(raw), durationSeconds: stepDurationSeconds(raw) }))
    .filter((s) => s.instruction.length > 0)
    .map((s, idx) => ({
      stepNumber: idx + 1,
      instruction: s.instruction,
      instructionZh: s.instruction,
      imageUri: null,
      durationSeconds: s.durationSeconds,
    }));
}

function sumMinutes(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

// -- Top-level parse ---------------------------------------------------------

// Turn a full HTML document into a StructuredRecipe. Throws "no_recipe_jsonld" when the
// page has no schema.org/Recipe block, or "empty_recipe" when the block has no usable
// content. Chinese fields are seeded with the English text here; the actual EN -> zh
// translation happens lazily in the recipe store (translateRecipeToZh) the first time the
// app is viewed in Traditional Chinese, driven by the useRecipeAutoTranslate listener.
export function parseRecipeFromHtml(html: string, url: string): StructuredRecipe {
  let node: Record<string, unknown> | null = null;
  for (const block of extractJsonLdBlocks(html)) {
    node = findRecipeNode(block);
    if (node) break;
  }
  if (!node) throw new Error("no_recipe_jsonld");

  const title = stripHtml(String(node.name ?? "")).trim();
  const ingredientSource: unknown[] = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
    : Array.isArray(node.ingredients)
      ? node.ingredients
      : [];
  const ingredients = ingredientSource
    .map((line) => parseIngredientLine(String(line)))
    .filter((ing) => ing.name.trim().length > 0);
  const steps = parseInstructions(node.recipeInstructions);

  if (!title && ingredients.length === 0 && steps.length === 0) {
    throw new Error("empty_recipe");
  }

  const totalMinutes =
    parseIsoDurationMinutes(node.totalTime) ??
    sumMinutes(parseIsoDurationMinutes(node.cookTime), parseIsoDurationMinutes(node.prepTime)) ??
    30;

  const finalTitle = title || "Imported recipe";
  return {
    title: finalTitle,
    titleZh: finalTitle,
    servings: parseServings(node.recipeYield),
    totalMinutes,
    sourceUrl: url,
    ingredients,
    steps,
  };
}

// Public read-only CORS proxies. Browsers block cross-origin fetches to recipe sites
// (they send no Access-Control-Allow-Origin), so on web we route through a proxy. Native
// (Expo Go, real builds) is not CORS-bound and hits the site directly. For production,
// replace these with your own proxy or a Supabase Edge Function.
const CORS_PROXIES: ((url: string) => string)[] = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

// Order the fetch attempts. On web the direct hit is doomed by CORS, so try proxies first
// and keep the direct URL as a last resort (some sites do send permissive headers). On
// native, go direct first and only fall back to a proxy if the site refuses us.
function candidateUrls(url: string): string[] {
  const proxied = CORS_PROXIES.map((build) => build(url));
  return Platform.OS === "web" ? [...proxied, url] : [url, ...proxied];
}

async function fetchOnce(target: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      // User-Agent is a forbidden header in browsers (silently dropped); only set it on
      // native, where some sites gate on a browser-like agent.
      headers:
        Platform.OS === "web"
          ? { Accept: "text/html,application/xhtml+xml" }
          : {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
              Accept: "text/html,application/xhtml+xml",
            },
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Walk the candidate URLs, running the full fetch+parse for each so a proxy that returns
// a 200 with junk (no recipe markup) falls through to the next candidate instead of
// failing outright. sourceUrl stays the real page, never the proxy wrapper.
async function fetchAndParse(url: string): Promise<StructuredRecipe> {
  let lastError: unknown;
  for (const target of candidateUrls(url)) {
    try {
      const html = await fetchOnce(target);
      return parseRecipeFromHtml(html, url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("scrape_failed");
}

export const urlScrapeService: UrlScrapeService = {
  async scrape(url) {
    const trimmed = url.trim();
    // Keep the offline demo chips deterministic against bundled fixtures.
    if (/cookpad/i.test(trimmed)) return { ...STEAMED_FISH, sourceUrl: trimmed };
    if (/daydaycook/i.test(trimmed)) return { ...BRAISED_BEEF, sourceUrl: trimmed };

    return fetchAndParse(trimmed);
  },
};
