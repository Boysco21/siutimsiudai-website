import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { formatCalories, shortTime } from "@/utils/formatters";
import { ALL_CUSTOMIZATIONS, effectiveMacros } from "@/utils/customizations";
import { tick } from "@/utils/haptics";
import { FoodEntry, LogSource, MealCustomization } from "@/types";

interface Props {
  entry: FoodEntry;
  onRemove: () => void;
  onToggleCustomization: (customization: MealCustomization) => void;
}

// How each entry got logged, surfaced as a small recognisable glyph on the left.
const SOURCE_ICON: Record<LogSource, keyof typeof Ionicons.glyphMap> = {
  photo: "camera-outline",
  voice: "mic-outline",
  barcode: "barcode-outline",
  label: "document-text-outline",
  manual: "create-outline",
};

const CUSTOM_LABEL: Record<MealCustomization, string> = {
  less_sugar: "custom.lessSugar",
  less_rice: "custom.lessRice",
};

export function FoodEntryRow({ entry, onRemove, onToggleCustomization }: Props) {
  const { t, tl, locale } = useLocale();
  const active = entry.customizations ?? [];
  const eff = effectiveMacros(entry, active);
  const saved = entry.calories - eff.calories;

  return (
    <View className="gap-2 border-b border-[#E8E1D2] py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
          <Ionicons name={SOURCE_ICON[entry.source]} size={18} color={colors.inkMuted} />
        </View>
        <View className="flex-1">
          <ScalableText className="text-base font-semibold text-ink" numberOfLines={1}>
            {tl(entry.name, entry.nameZh)}
          </ScalableText>
          <ScalableText className="text-xs text-ink-muted">
            {t(`mealType.${entry.mealType}`)} · {shortTime(entry.loggedAt, locale)}
          </ScalableText>
        </View>
        <View className="items-end">
          {saved > 0 && (
            <ScalableText className="text-xs text-ink-faint line-through">
              {formatCalories(entry.calories)}
            </ScalableText>
          )}
          <ScalableText
            className="text-base font-bold"
            style={{ color: saved > 0 ? colors.jade : colors.ink }}
          >
            {formatCalories(eff.calories)}
          </ScalableText>
          <ScalableText className="text-xs text-ink-faint">kcal</ScalableText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          onPress={onRemove}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="trash-outline" size={18} color={colors.inkFaint} />
        </Pressable>
      </View>

      {/* Order tweaks: tick 少甜 / 少底 like a waiter marking a notepad. */}
      <View className="flex-row flex-wrap gap-2" style={{ paddingLeft: 52 }}>
        {ALL_CUSTOMIZATIONS.map((key) => {
          const on = active.includes(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(CUSTOM_LABEL[key])}
              onPress={() => {
                tick();
                onToggleCustomization(key);
              }}
              className={`min-h-[36px] flex-row items-center gap-1 rounded-lg border px-2.5 py-1 active:opacity-70 ${
                on ? "border-jade bg-jade" : "border-dashed border-[#D8CDB8] bg-surface"
              }`}
            >
              <Ionicons
                name={on ? "checkmark" : "add"}
                size={14}
                color={on ? colors.white : colors.inkFaint}
              />
              <ScalableText
                className={`text-xs font-semibold ${on ? "text-white" : "text-ink-muted"}`}
              >
                {t(CUSTOM_LABEL[key])}
              </ScalableText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
