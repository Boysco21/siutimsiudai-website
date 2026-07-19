import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { formatCalories } from "@/utils/formatters";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useSavedMealsStore } from "@/stores/savedMealsStore";

interface Props {
  date: string;
}

// One-tap re-log of frequent meals. Most-used first, so the row reflects real habits.
export function QuickAddRow({ date }: Props) {
  const { t, tl } = useLocale();
  const meals = useSavedMealsStore((s) => s.meals);
  const topMeals = useSavedMealsStore((s) => s.topMeals);
  const markUsed = useSavedMealsStore((s) => s.markUsed);
  const addEntry = useNutritionStore((s) => s.addEntry);

  // Subscribing to `meals` above keeps this reactive; topMeals re-sorts on every change.
  void meals;
  const top = topMeals(8);
  if (top.length === 0) return null;

  return (
    <View className="gap-2">
      <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
        {t("dashboard.recents")}
      </ScalableText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
      >
        {top.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${t("common.add")} ${tl(m.name, m.nameZh)}`}
            onPress={() => {
              addEntry(
                {
                  name: m.name,
                  nameZh: m.nameZh,
                  calories: m.calories,
                  protein: m.protein,
                  carbs: m.carbs,
                  fat: m.fat,
                  mealType: m.defaultMealType,
                  source: "manual",
                },
                date,
              );
              markUsed(m.id);
            }}
            className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-[#E4DCCB] bg-surface px-4 py-2 active:opacity-80"
          >
            <Ionicons name="add" size={16} color={colors.brand} />
            <View>
              <ScalableText className="text-sm font-semibold text-ink">
                {tl(m.name, m.nameZh)}
              </ScalableText>
              <ScalableText className="text-xs text-ink-faint">
                {formatCalories(m.calories)} kcal
              </ScalableText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
