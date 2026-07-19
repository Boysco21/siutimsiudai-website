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
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { recipeOcrService, recipeStructurer, urlScrapeService } from "@/services";
import { parseIngredientLine } from "@/services/urlScrapeService";
import { useRecipeStore } from "@/stores/recipeStore";
import { Recipe, StructuredRecipe } from "@/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
}

type Tab = "url" | "ocr" | "manual";

const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "url", icon: "link-outline", labelKey: "recipes.fromUrl" },
  { key: "ocr", icon: "scan-outline", labelKey: "recipes.fromCard" },
  { key: "manual", icon: "create-outline", labelKey: "recipes.manual" },
];

const SAMPLE_URLS = [
  { url: "https://daydaycook.com/recipes/braised-beef-brisket", label: "DayDayCook" },
  { url: "https://cookpad.com/hk/recipes/steamed-fish", label: "Cookpad HK" },
];

const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";

export function AddRecipeSheet({ visible, onClose, onCreated }: Props) {
  const { t, tl } = useLocale();
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  // Importing from a cookbook link runs the (metered) AI scraper, so it's Pro-only. The photo
  // card and manual tabs stay free; a free user sees a locked upsell in place of the URL form.
  const urlAccess = useFeatureAccess("url_scraper");

  const [tab, setTab] = useState<Tab>("url");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [ocrRaw, setOcrRaw] = useState<string | null>(null);

  const [mTitle, setMTitle] = useState("");
  const [mTitleZh, setMTitleZh] = useState("");
  const [mServings, setMServings] = useState("2");
  const [mMinutes, setMMinutes] = useState("30");
  const [mIngredients, setMIngredients] = useState("");
  const [mSteps, setMSteps] = useState("");

  function reset() {
    setTab("url");
    setLoading(false);
    setUrl("");
    setUrlError(null);
    setOcrRaw(null);
    setMTitle("");
    setMTitleZh("");
    setMServings("2");
    setMMinutes("30");
    setMIngredients("");
    setMSteps("");
  }

  function finish(recipe: Recipe) {
    reset();
    onClose();
    onCreated(recipe);
  }

  async function runUrl() {
    // Defensive: the URL tab shows a locked upsell for free users, so this shouldn't be reachable
    // without access. Never run the metered scraper without it.
    if (!urlAccess.hasAccess) {
      urlAccess.triggerPaywall();
      return;
    }
    if (!url.trim()) return;
    setLoading(true);
    setUrlError(null);
    try {
      const structured = await urlScrapeService.scrape(url.trim());
      const recipe = addRecipe(structured, "url");
      finish(recipe);
    } catch {
      // Network failure, no recipe markup, or a page we can't read. Keep the sheet open
      // so the user can try another link or switch to manual entry.
      setUrlError(
        tl(
          "Couldn't read that page. Try another link or add it manually.",
          "讀取唔到呢個網頁，試下另一條連結或手動加入。",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function runOcr() {
    setLoading(true);
    const raw = await recipeOcrService.parse("sample://card.jpg");
    setOcrRaw(raw);
    setLoading(false);
  }

  async function importOcr() {
    if (!ocrRaw) return;
    setLoading(true);
    const structured = await recipeStructurer.structure(ocrRaw);
    const recipe = addRecipe(structured, "ocr");
    setLoading(false);
    finish(recipe);
  }

  function buildManual(): StructuredRecipe {
    const fallback = tl("My recipe", "我的食譜");
    // Parse each typed line the same way scraped recipes are, so "2 tbsp soy sauce" becomes
    // 30 mL and "200 g flour" becomes 200 g. Lines with no amount keep quantity 0 and show
    // just the name.
    const ingredients = mIngredients
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => parseIngredientLine(line));
    const steps = mSteps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        stepNumber: idx + 1,
        instruction: line,
        instructionZh: line,
        imageUri: null,
        durationSeconds: null,
      }));
    return {
      title: mTitle.trim() || fallback,
      titleZh: mTitleZh.trim() || mTitle.trim() || fallback,
      servings: Number(mServings) || 2,
      totalMinutes: Number(mMinutes) || 30,
      sourceUrl: null,
      ingredients,
      steps,
    };
  }

  function addManual() {
    const recipe = addRecipe(buildManual(), "manual");
    finish(recipe);
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable className="flex-1" accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={close} />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "88%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-3 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("recipes.add")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={close}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          <View className="mb-3 flex-row gap-2">
            {TABS.map(({ key, icon, labelKey }) => {
              const active = key === tab;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(key)}
                  className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2 ${
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
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === "url" &&
              (urlAccess.hasAccess ? (
                <View className="gap-3">
                  <ScalableText className="text-sm text-ink-muted">{t("recipes.urlHint")}</ScalableText>
                  <TextInput
                    className={INPUT}
                    value={url}
                    onChangeText={(text) => {
                      setUrl(text);
                      if (urlError) setUrlError(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="https://"
                    placeholderTextColor={colors.inkFaint}
                  />
                  {urlError && (
                    <View className="flex-row items-center gap-2 rounded-xl bg-brand-100 px-3 py-2">
                      <Ionicons name="alert-circle" size={16} color={colors.brand} />
                      <ScalableText className="flex-1 text-xs font-medium text-brand-700">
                        {urlError}
                      </ScalableText>
                    </View>
                  )}
                  <View className="flex-row flex-wrap gap-2">
                    {SAMPLE_URLS.map((s) => (
                      <Pressable
                        key={s.url}
                        accessibilityRole="button"
                        onPress={() => setUrl(s.url)}
                        className="min-h-[44px] justify-center rounded-full bg-surface-sunken px-4 py-2"
                      >
                        <ScalableText className="text-sm font-semibold text-ink">{s.label}</ScalableText>
                      </Pressable>
                    ))}
                  </View>
                  <Button
                    label={t("recipes.import")}
                    icon="download-outline"
                    loading={loading}
                    onPress={runUrl}
                  />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tl(
                    "Unlock cookbook link import with Pro",
                    "升級 Pro 解鎖食譜連結匯入",
                  )}
                  onPress={urlAccess.triggerPaywall}
                  className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4 active:opacity-80"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                      <Ionicons name="link" size={20} color={colors.brand} />
                    </View>
                    <View className="flex-1">
                      <ScalableText className="text-base font-bold text-ink">
                        {tl("Import from any cookbook link", "任何食譜連結一撳匯入")}
                      </ScalableText>
                      <ScalableText className="text-xs text-ink-muted">
                        {tl(
                          "Paste a link and let the AI plate it into your recipe box. A Pro perk.",
                          "貼個連結，AI 幫你執靚入食譜簿。Pro 專享。",
                        )}
                      </ScalableText>
                    </View>
                  </View>
                  <View className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-3">
                    <Ionicons name="lock-closed" size={14} color={colors.white} />
                    <ScalableText className="text-sm font-bold text-white">
                      {tl("Unlock with Pro", "升級 Pro 解鎖")}
                    </ScalableText>
                  </View>
                </Pressable>
              ))}

            {tab === "ocr" && (
              <View className="gap-3">
                <ScalableText className="text-sm text-ink-muted">{t("recipes.fromCard")}</ScalableText>
                <Button
                  label={loading && !ocrRaw ? t("log.recognising") : t("recipes.fromCard")}
                  icon="camera-outline"
                  variant={ocrRaw ? "secondary" : "primary"}
                  loading={loading && !ocrRaw}
                  onPress={runOcr}
                />
                {ocrRaw && (
                  <View className="gap-3">
                    <View className="rounded-xl bg-surface-sunken p-3">
                      <ScalableText className="text-xs leading-5 text-ink-muted">{ocrRaw}</ScalableText>
                    </View>
                    <Button
                      label={t("recipes.import")}
                      icon="download-outline"
                      loading={loading}
                      onPress={importOcr}
                    />
                  </View>
                )}
              </View>
            )}

            {tab === "manual" && (
              <View className="gap-3">
                <TextInput
                  className={INPUT}
                  value={mTitle}
                  onChangeText={setMTitle}
                  placeholder={tl("Title (English)", "標題（英文）")}
                  placeholderTextColor={colors.inkFaint}
                />
                <TextInput
                  className={INPUT}
                  value={mTitleZh}
                  onChangeText={setMTitleZh}
                  placeholder={tl("Title (中文)", "標題（中文）")}
                  placeholderTextColor={colors.inkFaint}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                      {t("recipes.servings")}
                    </ScalableText>
                    <TextInput
                      className={INPUT}
                      value={mServings}
                      onChangeText={setMServings}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.inkFaint}
                    />
                  </View>
                  <View className="flex-1">
                    <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                      {tl("Minutes", "分鐘")}
                    </ScalableText>
                    <TextInput
                      className={INPUT}
                      value={mMinutes}
                      onChangeText={setMMinutes}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.inkFaint}
                    />
                  </View>
                </View>
                <View>
                  <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                    {t("recipes.ingredients")}
                  </ScalableText>
                  <TextInput
                    className={`${INPUT} min-h-[88px]`}
                    multiline
                    value={mIngredients}
                    onChangeText={setMIngredients}
                    placeholder={tl("One per line", "每行一項")}
                    placeholderTextColor={colors.inkFaint}
                    textAlignVertical="top"
                  />
                </View>
                <View>
                  <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                    {t("recipes.steps")}
                  </ScalableText>
                  <TextInput
                    className={`${INPUT} min-h-[88px]`}
                    multiline
                    value={mSteps}
                    onChangeText={setMSteps}
                    placeholder={tl("One per line", "每行一步")}
                    placeholderTextColor={colors.inkFaint}
                    textAlignVertical="top"
                  />
                </View>
                <Button label={t("common.save")} icon="checkmark" onPress={addManual} />
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
