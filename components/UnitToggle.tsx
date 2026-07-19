import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { MeasurementSystem } from "@/types";

interface Props {
  value: MeasurementSystem;
  onChange: (system: MeasurementSystem) => void;
}

const OPTIONS: MeasurementSystem[] = ["metric", "imperial", "hk_market"];

// Switches how ingredient quantities read: grams, ounces, or HK wet-market catty / tael / bowl.
export function UnitToggle({ value, onChange }: Props) {
  const { tl } = useLocale();
  // Wet-market 斤/兩 units are a Pro perk; metric and imperial stay free. Only the 街市 option
  // gates, so a free user keeps their everyday toggle and taps into the paywall for market units.
  const { hasAccess, triggerPaywall } = useFeatureAccess("wet_market_units");
  const labelFor = (s: MeasurementSystem) =>
    s === "metric" ? tl("Metric", "公制") : s === "imperial" ? tl("Imperial", "英制") : tl("Market", "街市");

  return (
    <View className="flex-row gap-2">
      {OPTIONS.map((s) => {
        const locked = s === "hk_market" && !hasAccess;
        const active = s === value && !locked;
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              locked ? tl("Market units, unlock with Pro", "街市單位，升級 Pro 解鎖") : undefined
            }
            onPress={() => (locked ? triggerPaywall() : onChange(s))}
            className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1 rounded-xl px-2 py-2 ${
              active ? "bg-ink" : "bg-surface-sunken"
            }`}
          >
            {locked ? <Ionicons name="lock-closed" size={12} color={colors.brand} /> : null}
            <ScalableText
              className={`text-sm font-semibold ${
                active ? "text-white" : locked ? "text-brand" : "text-ink-muted"
              }`}
            >
              {labelFor(s)}
            </ScalableText>
          </Pressable>
        );
      })}
    </View>
  );
}
