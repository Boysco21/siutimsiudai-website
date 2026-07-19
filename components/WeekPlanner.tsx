import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { dayOfMonth, todayKey, weekDates, weekdayShort } from "@/utils/formatters";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { useRecipeStore } from "@/stores/recipeStore";

// This week at a glance. Assignments come from a recipe's "Add to plan"; tapping a chip
// here removes it. The distinct recipes planned across the week feed the grocery compiler.
export function WeekPlanner() {
  const { t, tl, locale } = useLocale();
  const entries = useMealPlanStore((s) => s.entries);
  const unassign = useMealPlanStore((s) => s.unassign);
  const recipes = useRecipeStore((s) => s.recipes);
  const dates = weekDates();
  const today = todayKey();

  const titleFor = (recipeId: string) => {
    const r = recipes.find((x) => x.id === recipeId);
    return r ? tl(r.title, r.titleZh) : "?";
  };

  return (
    <View className="gap-2">
      <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
        {t("plan.thisWeek")}
      </ScalableText>
      <View className="rounded-2xl border border-[#E4DCCB] bg-surface p-2">
        {dates.map((d) => {
          const dayEntries = entries.filter((e) => e.planDate === d);
          const isToday = d === today;
          return (
            <View key={d} className="flex-row items-start gap-3 px-2 py-2">
              <View className={`w-12 items-center rounded-lg py-1 ${isToday ? "bg-brand" : ""}`}>
                <ScalableText className={`text-xs ${isToday ? "text-white" : "text-ink-muted"}`}>
                  {weekdayShort(d, locale)}
                </ScalableText>
                <ScalableText className={`text-base font-bold ${isToday ? "text-white" : "text-ink"}`}>
                  {dayOfMonth(d)}
                </ScalableText>
              </View>
              <View className="flex-1 flex-row flex-wrap items-center gap-2 pt-1">
                {dayEntries.length === 0 ? (
                  <ScalableText className="py-1 text-sm text-ink-faint">—</ScalableText>
                ) : (
                  dayEntries.map((e) => (
                    <Pressable
                      key={e.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("common.delete")} ${titleFor(e.recipeId)}`}
                      onPress={() => unassign(e.id)}
                      className="flex-row items-center gap-1 rounded-full bg-surface-sunken px-3 py-1.5 active:opacity-70"
                    >
                      <ScalableText className="text-xs font-semibold text-ink">
                        {titleFor(e.recipeId)}
                      </ScalableText>
                      <Ionicons name="close" size={12} color={colors.inkMuted} />
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
