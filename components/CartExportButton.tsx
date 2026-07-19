import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface Props {
  onPress: () => void;
}

// The "Buy missing ingredients" entry point on the recipe screen. Always visible with a Max badge
// so every tier sees the perk exists; only Max opens the comparison sheet, everyone else lands on
// the paywall. The gate lives here so the recipe screen just renders <CartExportButton onPress=.. />.
// Custom Pressable (not <Button/>) because it carries a trailing badge pill the shared button lacks.
export function CartExportButton({ onPress }: Props) {
  const { tl } = useLocale();
  const { hasAccess, triggerPaywall } = useFeatureAccess("grocery_export");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasAccess
          ? tl("Buy missing ingredients", "買齊欠缺食材")
          : tl("Buy missing ingredients, unlock with Max", "買齊欠缺食材，升級 Max 解鎖")
      }
      onPress={hasAccess ? onPress : triggerPaywall}
      className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 active:opacity-80"
    >
      <Ionicons name={hasAccess ? "cart" : "lock-closed"} size={18} color={colors.white} />
      <ScalableText className="text-base font-semibold text-white">
        {tl("Buy missing ingredients", "買齊欠缺食材")}
      </ScalableText>
      <View className="rounded-full bg-white/20 px-2 py-0.5">
        <ScalableText className="text-xs font-bold text-white">Max</ScalableText>
      </View>
    </Pressable>
  );
}
