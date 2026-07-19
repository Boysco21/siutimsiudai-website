import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { UnitToggle } from "@/components/UnitToggle";
import { HealthProfileSheet } from "@/components/HealthProfileSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LegalLinks } from "@/components/LegalLinks";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { SubscriptionTier, useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { computeNutritionTargets } from "@/utils/nutritionTargets";
import { HealthProfile, Locale } from "@/types";

const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";

export default function ProfileScreen() {
  const { t, tl } = useLocale();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const system = useAppStore((s) => s.measurementSystem);
  const setMeasurementSystem = useAppStore((s) => s.setMeasurementSystem);
  const resetOnboarding = useAppStore((s) => s.resetOnboarding);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const tier = useSubscriptionStore((s) => s.activeTier);

  const target = useNutritionStore((s) => s.dailyCalorieTarget);
  const setCalorieTarget = useNutritionStore((s) => s.setCalorieTarget);
  const healthProfile = useNutritionStore((s) => s.healthProfile);
  const setHealthProfile = useNutritionStore((s) => s.setHealthProfile);
  const clearHealthProfile = useNutritionStore((s) => s.clearHealthProfile);
  const [targetText, setTargetText] = useState(String(target));
  const [healthSheetOpen, setHealthSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const targets = healthProfile ? computeNutritionTargets(healthProfile) : null;

  function commitTarget() {
    const next = Math.max(0, Math.round(Number(targetText) || 0)) || 2000;
    setCalorieTarget(next);
    setTargetText(String(next));
  }

  function handleHealthSaved(profile: HealthProfile) {
    setHealthProfile(profile);
    // Push the freshly calculated goal straight into the daily target the log page reads, so
    // the calorie ring updates immediately instead of waiting for a second manual save.
    const calculated = computeNutritionTargets(profile).calories;
    setCalorieTarget(calculated);
    setTargetText(String(calculated));
  }

  async function confirmDelete() {
    setDeleteOpen(false);
    setDeleting(true);
    setDeleteError(false);
    const outcome = await deleteAccount();
    // On success the session clears and the route gate navigates away from the tabs, unmounting
    // this screen, so only the failure path needs handling here.
    if (!outcome.ok) {
      setDeleting(false);
      setDeleteError(true);
    }
  }

  const LANGS: { code: Locale; label: string }[] = [
    { code: "en", label: t("profile.english") },
    { code: "zh-Hant", label: t("profile.chinese") },
  ];

  const TIER_INFO: Record<
    SubscriptionTier,
    { name: string; persona: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
  > = {
    free: {
      name: tl("Free", "免費"),
      persona: tl("The Casual Eater", "街坊食客"),
      icon: "cafe",
      color: colors.inkMuted,
      bg: colors.surfaceSunken,
    },
    pro: {
      name: tl("Pro", "Pro 熟客"),
      persona: tl("The Healthy Foodie", "識食健康派"),
      icon: "star",
      color: colors.brand,
      bg: "#F5EBE0",
    },
    max: {
      name: tl("Max", "Max 話事人"),
      persona: tl("The Household Executive", "一家之主"),
      icon: "diamond",
      color: colors.accentDark,
      bg: "#FBEAC4",
    },
  };
  const currentTier = TIER_INFO[tier];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}>
        <ScalableText className="text-2xl font-bold text-ink">{t("profile.title")}</ScalableText>

        <View className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
              <Ionicons name="person" size={22} color={colors.inkMuted} />
            </View>
            <View className="flex-1">
              <ScalableText className="text-base font-bold text-ink">
                {tl("Signed in", "已登入")}
              </ScalableText>
              <ScalableText className="text-xs text-ink-muted" numberOfLines={1}>
                {user?.email ?? tl("Synced to your account", "已同步到你的帳戶")}
              </ScalableText>
            </View>
          </View>
          <Button
            label={tl("Sign out", "登出")}
            icon="log-out-outline"
            variant="secondary"
            onPress={() => {
              void signOut();
            }}
          />
        </View>

        <View className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: currentTier.bg }}
            >
              <Ionicons name={currentTier.icon} size={22} color={currentTier.color} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <ScalableText className="text-base font-bold text-ink">{currentTier.name}</ScalableText>
                {tier !== "free" && (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: currentTier.color }}>
                    <ScalableText className="text-[10px] font-bold text-white">
                      {tl("ACTIVE", "開通中")}
                    </ScalableText>
                  </View>
                )}
              </View>
              <ScalableText className="text-xs text-ink-muted">{currentTier.persona}</ScalableText>
            </View>
          </View>
          <Button
            label={tier === "free" ? tl("See plans", "睇下計劃") : tl("Manage plan", "管理計劃")}
            icon={tier === "free" ? "sparkles" : "settings-outline"}
            variant={tier === "free" ? "primary" : "secondary"}
            onPress={() => router.push("/subscription")}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("family.title")}
          onPress={() => router.push("/family/invite")}
          className="flex-row items-center gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4 active:opacity-70"
        >
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#F5EBE0" }}>
            <Ionicons name="people" size={22} color={colors.brand} />
          </View>
          <View className="flex-1">
            <ScalableText className="text-base font-bold text-ink">{t("family.title")}</ScalableText>
            <ScalableText className="text-xs text-ink-muted" numberOfLines={2}>
              {tier === "max"
                ? tl("Invite and manage family members.", "邀請及管理家庭成員。")
                : t("family.maxOnly")}
            </ScalableText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
        </Pressable>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("profile.language")}
          </ScalableText>
          <View className="flex-row gap-2">
            {LANGS.map((l) => {
              const active = l.code === locale;
              return (
                <Pressable
                  key={l.code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setLocale(l.code)}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                    active ? "bg-ink" : "bg-surface-sunken"
                  }`}
                >
                  <ScalableText
                    className={`text-sm font-semibold ${active ? "text-white" : "text-ink-muted"}`}
                  >
                    {l.label}
                  </ScalableText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("recipes.units")}
          </ScalableText>
          <UnitToggle value={system} onChange={setMeasurementSystem} />
        </View>

        <View className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
              <Ionicons name="fitness" size={22} color={colors.inkMuted} />
            </View>
            <View className="flex-1">
              <ScalableText className="text-base font-bold text-ink">{t("health.title")}</ScalableText>
              <ScalableText className="text-xs text-ink-muted">
                {targets ? t("health.subtitle") : t("health.summaryUnset")}
              </ScalableText>
            </View>
          </View>

          {targets && (
            <View className="gap-1">
              <View className="flex-row items-baseline gap-2">
                <ScalableText className="text-2xl font-bold text-ink">{targets.calories}</ScalableText>
                <ScalableText className="text-sm text-ink-muted">{tl("kcal / day", "千卡 / 日")}</ScalableText>
              </View>
              <ScalableText className="text-sm text-ink-muted">
                {t("health.protein")} {targets.protein}g · {t("health.carbs")} {targets.carbs}g ·{" "}
                {t("health.fat")} {targets.fat}g · {t("health.fibre")} {targets.fiber}g
              </ScalableText>
            </View>
          )}

          <Button
            label={targets ? t("health.edit") : t("health.setup")}
            icon={targets ? "create-outline" : "calculator-outline"}
            variant={targets ? "secondary" : "primary"}
            onPress={() => setHealthSheetOpen(true)}
          />
        </View>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("profile.calorieTarget")}
          </ScalableText>
          <View className="flex-row items-center gap-2">
            <TextInput
              className={`${INPUT} flex-1`}
              value={targetText}
              onChangeText={setTargetText}
              onEndEditing={commitTarget}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkFaint}
            />
            <ScalableText className="text-sm text-ink-muted">{tl("kcal", "千卡")}</ScalableText>
            <Button label={t("common.save")} onPress={commitTarget} />
          </View>
        </View>

        <View className="flex-row items-center gap-2 rounded-2xl bg-surface-sunken p-3">
          <Ionicons name="text" size={18} color={colors.inkMuted} />
          <ScalableText className="flex-1 text-xs text-ink-muted">{t("profile.textSize")}</ScalableText>
        </View>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {tl("Legal", "法律資訊")}
          </ScalableText>
          <View className="rounded-2xl border border-[#E4DCCB] bg-surface px-4 py-3">
            <LegalLinks align="start" />
          </View>
        </View>

        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tl("Delete account", "刪除帳戶")}
            disabled={deleting}
            onPress={() => setDeleteOpen(true)}
            className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-[#E4DCCB] px-4 py-3 active:opacity-70 ${
              deleting ? "opacity-50" : ""
            }`}
          >
            {deleting ? (
              <ActivityIndicator color="#C2554B" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#C2554B" />
            )}
            <ScalableText className="text-base font-semibold" style={{ color: "#C2554B" }}>
              {tl("Delete account", "刪除帳戶")}
            </ScalableText>
          </Pressable>
          {deleteError ? (
            <ScalableText className="px-1 text-xs" style={{ color: "#C2554B" }}>
              {tl(
                "Something went wrong. Please check your connection and try again.",
                "發生錯誤，請檢查網絡後再試。",
              )}
            </ScalableText>
          ) : (
            <ScalableText className="px-1 text-xs text-ink-faint">
              {tl(
                "Permanently deletes your account and saved data.",
                "永久刪除你的帳戶及已儲存資料。",
              )}
            </ScalableText>
          )}
        </View>

        {/* Dev-only: replay the whole first-run flow for testing and demos. Clearing the saved
            health profile makes the route gate pass back through profile-setup instead of skipping
            it, so onboarding -> profile-setup -> app all show. __DEV__ is false in production
            builds, so this row never ships to the public. Safe to delete anytime. */}
        {__DEV__ && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              resetOnboarding();
              clearHealthProfile();
              router.replace("/onboarding");
            }}
            className="min-h-[44px] flex-row items-center gap-2 rounded-2xl border border-dashed border-[#E4DCCB] p-3 active:opacity-70"
          >
            <Ionicons name="refresh" size={18} color={colors.inkMuted} />
            <ScalableText className="flex-1 text-xs text-ink-muted">
              Replay first run (dev only)
            </ScalableText>
          </Pressable>
        )}
      </ScrollView>

      <HealthProfileSheet
        visible={healthSheetOpen}
        initial={healthProfile}
        onClose={() => setHealthSheetOpen(false)}
        onSaved={handleHealthSaved}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={tl("Delete your account?", "確認刪除帳戶？")}
        message={tl(
          "This permanently deletes your account and your saved data. This cannot be undone.",
          "此操作會永久刪除你的帳戶及已儲存資料，無法復原。",
        )}
        confirmLabel={tl("Delete account", "刪除帳戶")}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}
