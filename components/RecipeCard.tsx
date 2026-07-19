import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { Recipe, RecipeSourceType } from "@/types";

interface Props {
  recipe: Recipe;
  onPress: () => void;
}

const SOURCE_ICON: Record<RecipeSourceType, keyof typeof Ionicons.glyphMap> = {
  url: "link-outline",
  ocr: "scan-outline",
  manual: "create-outline",
};

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color={colors.inkFaint} />
      <ScalableText className="text-xs text-ink-muted">{label}</ScalableText>
    </View>
  );
}

export function RecipeCard({ recipe, onPress }: Props) {
  const { tl, locale } = useLocale();
  const secondary = locale === "zh-Hant" ? recipe.title : recipe.titleZh;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-2xl border border-[#E4DCCB] bg-surface p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <ScalableText className="text-lg font-bold text-ink" numberOfLines={1}>
            {tl(recipe.title, recipe.titleZh)}
          </ScalableText>
          <ScalableText className="text-sm text-ink-muted" numberOfLines={1}>
            {secondary}
          </ScalableText>
          <View className="mt-2 flex-row items-center gap-4">
            <Meta icon="people-outline" label={String(recipe.servings)} />
            <Meta icon="time-outline" label={`${recipe.totalMinutes} min`} />
            <Meta icon={SOURCE_ICON[recipe.sourceType]} label={recipe.sourceType.toUpperCase()} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}
