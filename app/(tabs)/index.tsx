import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { CalorieRing } from "@/components/CalorieRing";
import { NutrientPanel } from "@/components/NutrientPanel";
import { QuickAddRow } from "@/components/QuickAddRow";
import { FoodEntryRow } from "@/components/FoodEntryRow";
import { LogInputSheet } from "@/components/LogInputSheet";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { todayKey } from "@/utils/formatters";
import { computeNutritionTargets } from "@/utils/nutritionTargets";
import { effectiveMacros } from "@/utils/customizations";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useAppStore } from "@/stores/appStore";
import { MacroNutrients } from "@/types";

const EMPTY: MacroNutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export default function DashboardScreen() {
  const { t, locale } = useLocale();
  const date = todayKey();
  const entries = useNutritionStore((s) => s.logsByDate[date]?.entries);
  const target = useNutritionStore((s) => s.dailyCalorieTarget);
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const toggleCustomization = useNutritionStore((s) => s.toggleCustomization);
  const healthProfile = useNutritionStore((s) => s.healthProfile);
  const isGuest = useAppStore((s) => s.sessionUserId === null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const macroTargets = useMemo(
    () => (healthProfile ? computeNutritionTargets(healthProfile) : null),
    [healthProfile],
  );

  const list = entries ?? [];
  // Totals track the effective macros after any 少甜 / 少底 tweaks, so the ring reacts live.
  const totals = list.reduce<MacroNutrients>((acc, e) => {
    const m = effectiveMacros(e, e.customizations);
    return {
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    };
  }, { ...EMPTY });

  const prettyDate = new Date().toLocaleDateString(locale === "zh-Hant" ? "zh-HK" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
        <View>
          <ScalableText className="text-2xl font-bold text-ink">{t("dashboard.title")}</ScalableText>
          <ScalableText className="text-sm text-ink-muted">{prettyDate}</ScalableText>
        </View>

        {isGuest && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-brand/10 px-4 py-3">
            <Ionicons name="information-circle-outline" size={20} color={colors.brand} />
            <ScalableText className="flex-1 text-sm text-ink">{t("dashboard.guestBanner")}</ScalableText>
          </View>
        )}

        <View className="items-center py-2">
          <CalorieRing eaten={totals.calories} target={target} />
        </View>

        <NutrientPanel date={date} macros={totals} targets={macroTargets} />

        <QuickAddRow date={date} />

        <View className="gap-1">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("common.today")}
          </ScalableText>
          {list.length === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.orderFood")}
              onPress={() => setSheetOpen(true)}
              className="items-center gap-3 rounded-2xl border border-dashed border-[#E4DCCB] px-6 py-9 active:opacity-80"
            >
              {/* An upside-down coffee cup: the table's empty, nothing served yet. */}
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <Ionicons name="cafe-outline" size={34} color={colors.inkFaint} />
              </View>
              <ScalableText className="text-center text-sm text-ink-muted">
                {t("dashboard.empty")}
              </ScalableText>
              <View className="flex-row items-center gap-1.5 rounded-full bg-brand px-4 py-2">
                <Ionicons name="add" size={16} color={colors.white} />
                <ScalableText className="text-sm font-bold text-white">
                  {t("dashboard.orderFood")}
                </ScalableText>
              </View>
            </Pressable>
          ) : (
            list.map((entry) => (
              <FoodEntryRow
                key={entry.id}
                entry={entry}
                onRemove={() => removeEntry(date, entry.id)}
                onToggleCustomization={(c) => toggleCustomization(date, entry.id, c)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.addMeal")}
        onPress={() => setSheetOpen(true)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-80"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>

      <LogInputSheet visible={sheetOpen} date={date} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}
