import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { MealType } from "@/types";

interface Props {
  value: MealType;
  onChange: (meal: MealType) => void;
}

const TYPES: { key: MealType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "breakfast", icon: "cafe-outline" },
  { key: "lunch", icon: "fast-food-outline" },
  { key: "dinner", icon: "restaurant-outline" },
  { key: "snack", icon: "ice-cream-outline" },
];

// Segmented selector reused by every log tab and the manual form. Icon stacked over label
// so all four fit across a narrow screen and stay recognisable without reading the text.
export function MealTypePicker({ value, onChange }: Props) {
  const { t } = useLocale();
  return (
    <View className="flex-row gap-2">
      {TYPES.map(({ key, icon }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            className={`min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl px-1 py-2 ${
              active ? "bg-brand" : "bg-surface-sunken"
            }`}
          >
            <Ionicons name={icon} size={18} color={active ? colors.white : colors.inkMuted} />
            <ScalableText
              className={`text-xs font-semibold ${active ? "text-white" : "text-ink-muted"}`}
            >
              {t(`mealType.${key}`)}
            </ScalableText>
          </Pressable>
        );
      })}
    </View>
  );
}
