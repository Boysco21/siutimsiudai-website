import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { formatQuantity } from "@/utils/formatters";
import { displayInSystem } from "@/utils/unitConverter";
import { MeasurementSystem, RecipeIngredient } from "@/types";

interface Props {
  ingredient: RecipeIngredient;
  system: MeasurementSystem;
  onSwap: () => void;
}

export function IngredientRow({ ingredient, system, onSwap }: Props) {
  const { t, tl, locale } = useLocale();
  const measure = displayInSystem(ingredient.quantity, ingredient.unit, system);
  const unitLabel = locale === "zh-Hant" ? measure.unitZh : measure.unit;

  return (
    <View className="flex-row items-center gap-3 border-b border-[#E8E1D2] py-3">
      <View className="flex-1">
        <ScalableText className="text-base font-semibold text-ink">
          {tl(ingredient.name, ingredient.nameZh)}
        </ScalableText>
        {ingredient.substitutedFrom && (
          <ScalableText className="text-xs font-medium text-accent-600">
            {tl(`was ${ingredient.substitutedFrom}`, `原為 ${ingredient.substitutedFrom}`)}
          </ScalableText>
        )}
      </View>
      {measure.quantity > 0 && (
        <ScalableText className="text-base text-ink">
          {formatQuantity(measure.quantity)} {unitLabel}
        </ScalableText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("recipes.substitute")} ${tl(ingredient.name, ingredient.nameZh)}`}
        onPress={onSwap}
        className="h-11 w-11 items-center justify-center"
      >
        <Ionicons name="swap-horizontal" size={20} color={colors.brand} />
      </Pressable>
    </View>
  );
}
