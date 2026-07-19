import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}

// Big round +/- controls so the recipe scales with one thumb. Drives recipeStore.scaleServings.
export function ServingStepper({ value, onChange, min = 1 }: Props) {
  const { tl } = useLocale();
  const atMin = value <= min;
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tl("Fewer servings", "減少份量")}
        disabled={atMin}
        onPress={() => onChange(Math.max(min, value - 1))}
        className={`h-11 w-11 items-center justify-center rounded-full bg-surface-sunken ${
          atMin ? "opacity-40" : "active:opacity-70"
        }`}
      >
        <Ionicons name="remove" size={22} color={colors.ink} />
      </Pressable>
      <ScalableText className="min-w-[32px] text-center text-xl font-bold text-ink">
        {value}
      </ScalableText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tl("More servings", "增加份量")}
        onPress={() => onChange(value + 1)}
        className="h-11 w-11 items-center justify-center rounded-full bg-surface-sunken active:opacity-70"
      >
        <Ionicons name="add" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );
}
