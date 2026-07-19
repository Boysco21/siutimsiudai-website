import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { MealTypePicker } from "./MealTypePicker";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { dayOfMonth, todayKey, weekDates, weekdayShort } from "@/utils/formatters";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { MealType } from "@/types";

interface Props {
  visible: boolean;
  recipeId: string;
  onClose: () => void;
}

// Assigns a recipe to a day + meal this week. Those assignments feed the grocery compiler.
export function PlanPickerSheet({ visible, recipeId, onClose }: Props) {
  const { t, locale } = useLocale();
  const assign = useMealPlanStore((s) => s.assign);
  const dates = weekDates();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [mealType, setMealType] = useState<MealType>("dinner");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onClose} />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3">
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-4 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("recipes.planAdd")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          <ScalableText className="mb-2 text-sm font-semibold text-ink-muted">
            {t("plan.thisWeek")}
          </ScalableText>
          <View className="mb-4 flex-row justify-between">
            {dates.map((d) => {
              const active = d === date;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDate(d)}
                  className={`min-h-[56px] flex-1 items-center justify-center gap-0.5 rounded-xl py-1 ${
                    active ? "bg-brand" : "bg-surface-sunken"
                  }`}
                >
                  <ScalableText className={`text-xs ${active ? "text-white" : "text-ink-muted"}`}>
                    {weekdayShort(d, locale)}
                  </ScalableText>
                  <ScalableText className={`text-base font-bold ${active ? "text-white" : "text-ink"}`}>
                    {dayOfMonth(d)}
                  </ScalableText>
                </Pressable>
              );
            })}
          </View>

          <ScalableText className="mb-2 text-sm font-semibold text-ink-muted">
            {t("log.mealType")}
          </ScalableText>
          <View className="mb-5">
            <MealTypePicker value={mealType} onChange={setMealType} />
          </View>

          <Button
            label={t("recipes.planAdd")}
            icon="calendar-outline"
            onPress={() => {
              assign(date, mealType, recipeId);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
