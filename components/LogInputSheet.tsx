import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { MealTypePicker } from "./MealTypePicker";
import { PaywallModal } from "./PaywallModal";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { formatCalories } from "@/utils/formatters";
import { parseMealText } from "@/utils/parseMeal";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useSavedMealsStore } from "@/stores/savedMealsStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { barcodeService, labelOcrService, nlpMealService, visionFoodService } from "@/services";
import { HK_DISHES } from "@/constants/hkDishes";
import { tapLight } from "@/utils/haptics";
import { EntryMicronutrients, LogSource, MealType } from "@/types";

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
}

type Tab = "photo" | "voice" | "barcode" | "label" | "manual";

// Canonical code-switched demo string the simulated mic injects (no native speech-to-text
// in Expo Go, so the mic is a mocked trigger per the hands-free design).
const VOICE_EXAMPLE = "朝早食咗一碗麥片加 mixed berries";

// A normalised guess from any of the five inputs. The shared candidate list renders these
// the same way, and "Add to log" / "Edit" behave identically regardless of source.
interface Candidate {
  name: string;
  nameZh: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: LogSource;
  confidence?: number;
  portionLabel?: string;
  portionLabelZh?: string;
  barcode?: string | null;
  unit?: string;
  // Premium per-serving vitamins & minerals from the photo / voice AI. Carried to addEntry, where
  // the save path keeps it for paid tiers and drops it for free (retainMicrosForTier).
  micros?: EntryMicronutrients | null;
}

// The resolved nutrition for a manual entry once a dish is known — from a quick-tag, a corrected
// candidate, or a local keyword match. When absent, the entry's text is sent to the logging AI.
interface ManualNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: EntryMicronutrients | null;
}

const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "photo", icon: "camera-outline", labelKey: "log.photo" },
  { key: "voice", icon: "mic-outline", labelKey: "log.voice" },
  { key: "barcode", icon: "barcode-outline", labelKey: "log.barcode" },
  { key: "label", icon: "document-text-outline", labelKey: "log.label" },
  { key: "manual", icon: "create-outline", labelKey: "log.manual" },
];

const SAMPLE_CODES = [
  { code: "4891028714842", label: "Vitasoy" },
  { code: "4892327000019", label: "Garden" },
  { code: "0123456789012", label: "?" },
];

const INPUT =
  "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";

// Copy a freshly captured asset into the app cache under a stable, timestamped name so the
// photo has a predictable home the vision pipeline (and a future upload) can reuse. The picker
// already writes to cache, so this is best-effort: any failure, or web where cacheDirectory is
// null, falls back to the original cached URI rather than blocking the log.
async function cacheMealPhoto(uri: string): Promise<string> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return uri;
    const dest = `${dir}meal-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

// Open the device's native camera and return the cached file URI of the capture, or null if the
// user backs out. On native we ask for camera permission and launch the viewfinder; if that is
// denied (or we are on web, which has no reliable in-preview camera) we fall back to the photo
// library so the flow still yields a real image URI to feed the pipeline. Never throws.
async function captureMealPhoto(): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
  try {
    let result: ImagePicker.ImagePickerResult;
    if (Platform.OS === "web") {
      result = await ImagePicker.launchImageLibraryAsync(options);
    } else {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      result = perm.granted
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    }
    if (result.canceled || !result.assets?.length) return null;
    return await cacheMealPhoto(result.assets[0].uri);
  } catch {
    return null;
  }
}

// Resolve a free-text description to a known dish's nutrition via the local keyword matcher (the
// same one the voice tab runs through nlpMealService). Returns null when nothing matches, which
// routes the manual entry to the logging AI for an estimate instead.
function matchKnownDish(text: string): ManualNutrition | null {
  const [first] = parseMealText(text);
  if (!first) return null;
  return {
    calories: first.calories,
    protein: first.protein,
    carbs: first.carbs,
    fat: first.fat,
    micros: first.micros ?? null,
  };
}

// Parse the optional manual quantity into a positive serving multiplier. Blank or junk means one
// serving; capped so a stray big number can't blow up the day's totals.
function parseQty(raw: string): number {
  const n = parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(n, 99);
}

// Scale a micronutrient set by the serving multiplier, keeping only the keys that were present.
function scaleMicros(m: EntryMicronutrients | null, factor: number): EntryMicronutrients | null {
  if (!m || factor === 1) return m;
  const out: EntryMicronutrients = {};
  (Object.keys(m) as (keyof EntryMicronutrients)[]).forEach((k) => {
    const v = m[k];
    if (typeof v === "number") out[k] = v * factor;
  });
  return out;
}

export function LogInputSheet({ visible, date, onClose }: Props) {
  const { t, tl } = useLocale();
  const addEntry = useNutritionStore((s) => s.addEntry);
  const savedMeals = useSavedMealsStore((s) => s.meals);
  const markUsed = useSavedMealsStore((s) => s.markUsed);
  const incrementAiLog = useSubscriptionStore((s) => s.incrementAiLog);
  const aiAccess = useFeatureAccess("ai_log");

  const [tab, setTab] = useState<Tab>("photo");
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [barcodeMiss, setBarcodeMiss] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const [text, setText] = useState("");
  const [code, setCode] = useState("");

  const [mName, setMName] = useState("");
  const [mNameZh, setMNameZh] = useState("");
  // Optional serving multiplier for the manual entry. Blank means one serving; when set it scales
  // the resolved macros + micros (a known dish or an AI estimate) before they hit the ledger.
  const [mQty, setMQty] = useState("");
  // Known-dish nutrition for the current manual entry: set by a quick-tag pick or by loading a
  // candidate to correct. Cleared when the user types a name (they're going off-menu, which routes
  // the entry to the logging AI on add). null means "estimate from the text".
  const [manualPreset, setManualPreset] = useState<ManualNutrition | null>(null);
  // True after the AI returned no estimate for a novel description, so we can nudge inline.
  const [manualMiss, setManualMiss] = useState(false);

  function resetManual() {
    setMName("");
    setMNameZh("");
    setMQty("");
    setManualPreset(null);
    setManualMiss(false);
  }

  function close() {
    setCandidates([]);
    setBarcodeMiss(false);
    setText("");
    setCode("");
    setLoading(false);
    resetManual();
    onClose();
  }

  function switchTab(next: Tab) {
    setTab(next);
    setCandidates([]);
    setBarcodeMiss(false);
    setManualMiss(false);
  }

  // Free tier gets a metered number of AI-assisted logs a week (photo/voice/barcode/label).
  // Once the weekly allotment is spent, pop the contextual paywall over the sheet instead of
  // firing another recognition. The sheet stays put so manual entry is still one tap away.
  // Returns false when blocked so callers bail early. Manual never gates.
  function guardAiLog(): boolean {
    if (aiAccess.hasAccess) return true;
    setPaywallVisible(true);
    return false;
  }

  async function runPhoto() {
    if (!guardAiLog()) return;
    // Open the native camera first so a cancelled capture never burns a spinner or a quota
    // check. captureMealPhoto returns the cached file URI (or null if the user backs out).
    const uri = await captureMealPhoto();
    if (!uri) return;
    setLoading(true);
    // The real capture URI is piped straight into the vision service. The service itself is
    // still a mock (recognition is stubbed), so swapping in a real provider is a one-file change.
    const results = await visionFoodService.recognize(uri);
    setCandidates(
      results.map((r) => ({
        name: r.name,
        nameZh: r.nameZh,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        source: "photo",
        confidence: r.confidence,
        portionLabel: r.portionLabel,
        portionLabelZh: r.portionLabelZh,
        micros: r.micros,
      })),
    );
    setLoading(false);
  }

  async function runVoice() {
    if (!text.trim()) return;
    if (!guardAiLog()) return;
    setLoading(true);
    const parsed = await nlpMealService.parse(text);
    setCandidates(
      parsed.map((p) => ({
        name: p.name,
        nameZh: p.nameZh,
        calories: p.calories,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        source: "voice",
        unit: p.unit,
        micros: p.micros,
      })),
    );
    setLoading(false);
  }

  async function runBarcode(value: string) {
    const c = value.trim();
    if (!c) return;
    if (!guardAiLog()) return;
    setLoading(true);
    setBarcodeMiss(false);
    const product = await barcodeService.lookup(c);
    if (!product) {
      setCandidates([]);
      setBarcodeMiss(true);
    } else {
      setCandidates([
        {
          name: product.name,
          nameZh: product.nameZh,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          source: "barcode",
          barcode: product.barcode,
          unit: product.servingSize,
        },
      ]);
    }
    setLoading(false);
  }

  async function runLabel() {
    if (!guardAiLog()) return;
    setLoading(true);
    const facts = await labelOcrService.parse("sample://label.jpg");
    setCandidates([
      {
        name: "Nutrition label item",
        nameZh: "標籤食品",
        calories: facts.calories,
        protein: facts.protein,
        carbs: facts.carbs,
        fat: facts.fat,
        source: "label",
        unit: facts.servingSize,
      },
    ]);
    setLoading(false);
  }

  function commit(c: Candidate) {
    tapLight();
    addEntry(
      {
        name: c.name,
        nameZh: c.nameZh,
        calories: c.calories,
        protein: c.protein,
        carbs: c.carbs,
        fat: c.fat,
        mealType,
        source: c.source,
        unit: c.unit,
        barcode: c.barcode ?? null,
        micros: c.micros ?? null,
      },
      date,
    );
    // Bump an existing saved meal so the quick-add row stays ordered by real use.
    const saved = savedMeals.find((m) => m.name === c.name);
    if (saved) markUsed(saved.id);
    // A committed photo/voice/barcode/label entry spends one AI log; manual entry is free.
    if (c.source !== "manual") incrementAiLog();
    close();
  }

  // Commit a resolved manual nutrition, scaled by the optional serving quantity, as a manual entry.
  function commitManual(name: string, nameZh: string, n: ManualNutrition, qty: number) {
    commit({
      name,
      nameZh,
      calories: n.calories * qty,
      protein: n.protein * qty,
      carbs: n.carbs * qty,
      fat: n.fat * qty,
      micros: scaleMicros(n.micros, qty),
      source: "manual",
    });
  }

  // Smart manual log: the user only says WHAT they ate (and optionally how many servings). Known
  // dishes (a quick-tag, a corrected candidate, or a local keyword match) fill instantly and free.
  // A novel description is handed to the logging AI to estimate all macros + micros — that path is
  // metered like the other AI tabs. Either way the result is scaled by the quantity before saving.
  async function addManual() {
    const en = mName.trim();
    const zh = mNameZh.trim();
    if (!en && !zh) return;
    setManualMiss(false);

    const name = en || zh;
    const nameZh = zh || en;
    const qty = parseQty(mQty);

    // 1) Known dish: fills instantly, never spends an AI log.
    const known = manualPreset ?? matchKnownDish(`${en} ${zh}`);
    if (known) {
      commitManual(name, nameZh, known, qty);
      return;
    }

    // 2) Novel description: estimate via the logging AI. Metered, so gate on the weekly quota
    //    first (this pops the paywall when a free user's logs are spent).
    if (!guardAiLog()) return;
    setLoading(true);
    const parsed = await nlpMealService.parse(`${en} ${zh}`.trim());
    setLoading(false);
    const best = parsed[0];
    if (!best) {
      // No estimate came back, and a miss spends nothing. Nudge a tag or a rename inline.
      setManualMiss(true);
      return;
    }
    // A successful estimate spends one AI log. Metered here (not via commit) so the entry still
    // records as a manual log — commit only auto-meters non-manual sources.
    incrementAiLog();
    commitManual(
      name,
      nameZh,
      {
        calories: best.calories,
        protein: best.protein,
        carbs: best.carbs,
        fat: best.fat,
        micros: best.micros ?? null,
      },
      qty,
    );
  }

  // The accuracy guardrail: load any guess into the manual form to correct its name. Its estimate
  // rides along as the preset, so confirming as-is keeps the numbers; retyping the name re-routes
  // the entry to the logging AI for a fresh estimate.
  function editCandidate(c: Candidate) {
    setMName(c.name);
    setMNameZh(c.nameZh);
    setManualPreset({
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      micros: c.micros ?? null,
    });
    switchTab("manual");
  }

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={close}
        />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "88%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-3 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("dashboard.addMeal")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={close}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          <MealTypePicker value={mealType} onChange={setMealType} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
          >
            {TABS.map(({ key, icon, labelKey }) => {
              const active = key === tab;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => switchTab(key)}
                  className={`min-h-[44px] flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
                    active ? "bg-ink" : "bg-surface-sunken"
                  }`}
                >
                  <Ionicons name={icon} size={16} color={active ? colors.white : colors.inkMuted} />
                  <ScalableText
                    className={`text-sm font-semibold ${active ? "text-white" : "text-ink-muted"}`}
                  >
                    {t(labelKey)}
                  </ScalableText>
                </Pressable>
              );
            })}
          </ScrollView>

          {tab !== "manual" && Number.isFinite(aiAccess.remainingLogs) && (
            <View className="mb-1 flex-row items-center gap-1.5 px-1">
              <Ionicons name="sparkles-outline" size={13} color={colors.inkFaint} />
              <ScalableText className="text-xs text-ink-faint">
                {aiAccess.remainingLogs > 0
                  ? tl(
                      `${aiAccess.remainingLogs} free AI logs left this week`,
                      `今個星期仲有 ${aiAccess.remainingLogs} 次 AI 入數`,
                    )
                  : tl(
                      "This week's AI logs are spent. Manual entry is still on us.",
                      "今個星期 AI 入數用晒，手動入數照樣免費。",
                    )}
              </ScalableText>
            </View>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === "photo" && (
              <View className="gap-3">
                <ScalableText className="text-sm text-ink-muted">{t("log.snapHint")}</ScalableText>
                <Button
                  label={loading ? t("log.recognising") : t("log.snap")}
                  icon="camera"
                  loading={loading}
                  onPress={runPhoto}
                />
              </View>
            )}

            {tab === "voice" && (
              <View className="gap-3">
                <ScalableText className="text-sm text-ink-muted">{t("log.speakHint")}</ScalableText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tl("Simulate voice input", "模擬語音輸入")}
                  onPress={() => setText(VOICE_EXAMPLE)}
                  className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-3 active:opacity-80"
                >
                  <Ionicons name="mic" size={20} color={colors.brand} />
                  <ScalableText className="text-sm font-semibold text-brand">
                    {tl("Tap to speak (demo)", "撳一下講嘢（示範）")}
                  </ScalableText>
                </Pressable>
                <TextInput
                  className={`${INPUT} min-h-[72px]`}
                  multiline
                  value={text}
                  onChangeText={setText}
                  placeholder={t("log.speakExample")}
                  placeholderTextColor={colors.inkFaint}
                  textAlignVertical="top"
                />
                <Button
                  label={loading ? t("log.recognising") : t("log.parse")}
                  icon="sparkles-outline"
                  loading={loading}
                  onPress={runVoice}
                />
              </View>
            )}

            {tab === "barcode" && (
              <View className="gap-3">
                <ScalableText className="text-sm text-ink-muted">{t("log.scanHint")}</ScalableText>
                <TextInput
                  className={INPUT}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="489..."
                  placeholderTextColor={colors.inkFaint}
                />
                <View className="flex-row flex-wrap gap-2">
                  {SAMPLE_CODES.map((s) => (
                    <Pressable
                      key={s.code}
                      accessibilityRole="button"
                      onPress={() => {
                        setCode(s.code);
                        runBarcode(s.code);
                      }}
                      className="min-h-[44px] justify-center rounded-full bg-surface-sunken px-4 py-2"
                    >
                      <ScalableText className="text-sm font-semibold text-ink">{s.label}</ScalableText>
                    </Pressable>
                  ))}
                </View>
                <Button
                  label={t("common.search")}
                  icon="barcode-outline"
                  loading={loading}
                  onPress={() => runBarcode(code)}
                />
                {barcodeMiss && (
                  <View className="gap-2 rounded-xl bg-surface-sunken p-3">
                    <ScalableText className="text-sm font-semibold text-ink">
                      {t("log.notFound")}
                    </ScalableText>
                    <Button
                      label={t("log.scanLabel")}
                      icon="document-text-outline"
                      variant="secondary"
                      onPress={() => switchTab("label")}
                    />
                  </View>
                )}
              </View>
            )}

            {tab === "label" && (
              <View className="gap-3">
                <ScalableText className="text-sm text-ink-muted">{t("log.scanLabel")}</ScalableText>
                <Button
                  label={loading ? t("log.recognising") : t("log.label")}
                  icon="document-text-outline"
                  loading={loading}
                  onPress={runLabel}
                />
              </View>
            )}

            {tab === "manual" && (
              <View className="gap-3">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {HK_DISHES.slice(0, 8).map((d) => (
                    <Pressable
                      key={d.name}
                      accessibilityRole="button"
                      onPress={() => {
                        setMName(d.name);
                        setMNameZh(d.nameZh);
                        setManualPreset({
                          calories: d.calories,
                          protein: d.protein,
                          carbs: d.carbs,
                          fat: d.fat,
                          micros: d.micros,
                        });
                        setManualMiss(false);
                      }}
                      className="min-h-[44px] justify-center rounded-full border border-[#E4DCCB] px-4 py-2"
                    >
                      <ScalableText className="text-sm text-ink">{tl(d.name, d.nameZh)}</ScalableText>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  className={INPUT}
                  value={mName}
                  onChangeText={(v) => {
                    setMName(v);
                    setManualPreset(null);
                    setManualMiss(false);
                  }}
                  placeholder={tl("Name (English)", "名稱（英文）")}
                  placeholderTextColor={colors.inkFaint}
                />
                <TextInput
                  className={INPUT}
                  value={mNameZh}
                  onChangeText={(v) => {
                    setMNameZh(v);
                    setManualPreset(null);
                    setManualMiss(false);
                  }}
                  placeholder={tl("Name (中文)", "名稱（中文）")}
                  placeholderTextColor={colors.inkFaint}
                />
                {/* Optional serving count. Leave it blank for one serving; anything else scales the
                    estimated nutrition. It never changes WHAT the dish is, so it doesn't re-trigger
                    the AI or clear a preset. */}
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className={`${INPUT} w-24`}
                    value={mQty}
                    onChangeText={setMQty}
                    keyboardType="decimal-pad"
                    placeholder={tl("Qty", "份量")}
                    placeholderTextColor={colors.inkFaint}
                  />
                  <ScalableText className="flex-1 text-xs text-ink-faint">
                    {tl("Servings (optional, default 1)", "份數（可選，預設 1）")}
                  </ScalableText>
                </View>
                {/* Numbers are the AI's job now: the user only says what they ate. Recognised
                    dishes fill instantly and free; a novel description spends one AI log. */}
                <View className="flex-row items-start gap-1.5 px-1">
                  <Ionicons name="sparkles-outline" size={13} color={colors.inkFaint} />
                  <ScalableText className="flex-1 text-xs text-ink-faint">
                    {tl(
                      "Type a dish or tap a tag and we'll fill in the nutrition. New dishes spend one AI log.",
                      "打菜名或者揀標籤，我哋幫你填營養。新菜式會用一次 AI 入數。",
                    )}
                  </ScalableText>
                </View>
                {manualMiss && (
                  <View className="rounded-xl bg-surface-sunken p-3">
                    <ScalableText className="text-sm text-ink">
                      {tl(
                        "Couldn't estimate that one. Try a quick-tag above, or rename it.",
                        "計唔到呢樣。試下上面嘅標籤，或者改個名。",
                      )}
                    </ScalableText>
                  </View>
                )}
                <Button
                  label={loading ? tl("Estimating your meal...", "幫你計緊營養...") : t("log.confirm")}
                  icon="add"
                  loading={loading}
                  onPress={addManual}
                />
              </View>
            )}

            {candidates.length > 0 && (
              <View className="mt-4 gap-3">
                {candidates.map((c, i) => {
                  const meta = c.portionLabel
                    ? tl(c.portionLabel, c.portionLabelZh ?? c.portionLabel)
                    : c.unit ?? "";
                  return (
                    <View
                      key={`${c.name}-${i}`}
                      className="overflow-hidden rounded-xl border border-[#E4DCCB] bg-surface"
                    >
                      {/* Order slip (飛單): clipped ticket header with a perforated edge. */}
                      <View className="flex-row items-center justify-between border-b border-dashed border-[#D8CDB8] bg-surface-subtle px-3 py-1.5">
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="receipt-outline" size={13} color={colors.inkMuted} />
                          <ScalableText className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
                            {tl("Order slip", "飛單")}
                          </ScalableText>
                        </View>
                        {c.confidence !== undefined && (
                          <ScalableText className="text-[11px] font-semibold text-ink-muted">
                            {Math.round(c.confidence * 100)}%
                          </ScalableText>
                        )}
                      </View>
                      <View className="gap-2 p-3">
                        <View className="flex-row items-start justify-between gap-2">
                          <ScalableText
                            className="flex-1 text-base font-bold text-ink"
                            numberOfLines={2}
                          >
                            {tl(c.name, c.nameZh)}
                          </ScalableText>
                          <View className="flex-row items-baseline gap-1">
                            <ScalableText className="text-base font-bold text-ink">
                              {formatCalories(c.calories)}
                            </ScalableText>
                            <ScalableText className="text-xs text-ink-faint">kcal</ScalableText>
                          </View>
                        </View>
                        <View className="flex-row items-center justify-between border-t border-dashed border-[#E4DCCB] pt-2">
                          <ScalableText className="text-xs text-ink-muted">
                            P {Math.round(c.protein)}g · C {Math.round(c.carbs)}g · F{" "}
                            {Math.round(c.fat)}g
                          </ScalableText>
                          {meta ? (
                            <ScalableText className="text-xs text-ink-faint" numberOfLines={1}>
                              {meta}
                            </ScalableText>
                          ) : null}
                        </View>
                        <View className="flex-row gap-2 pt-1">
                          <Button
                            label={t("log.confirm")}
                            icon="add"
                            className="flex-1"
                            onPress={() => commit(c)}
                          />
                          <Button
                            label={t("log.correct")}
                            variant="secondary"
                            className="flex-1"
                            onPress={() => editCandidate(c)}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Contextual paywall: pops over the sheet when the weekly AI quota is spent. Manual entry
        stays reachable on the sheet behind it. */}
    <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </>
  );
}
