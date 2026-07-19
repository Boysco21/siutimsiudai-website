import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors, microColors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  // Route to the paywall. Wired to useHistoryAccess().triggerPaywall by the screen.
  onUnlock: () => void;
}

const CHART_HEIGHT = 120;
const COLUMN_WIDTH = 18;
// Fixed decoy heights (fraction of the chart), deliberately NOT derived from any logged day, so a
// free user sees the SHAPE of a micronutrient trend behind the blur but no real figure enters the
// tree. Single-colour bars mirror the one-micro-at-a-time premium chart.
const DECOY = [0.5, 0.72, 0.58, 0.9, 0.55, 0.82, 0.66];

// The locked micronutrient-trend state for free users. A decoy single-series chart with a toggle
// skeleton is blurred and dimmed under a charcoal scrim, with a compact upsell card floated on top.
// Mirrors LockedTrendCard so the two history locks feel like one system.
export function LockedMicroTrendCard({ onUnlock }: Props) {
  const { tl } = useLocale();

  return (
    <View className="relative overflow-hidden rounded-2xl border border-[#E4DCCB] bg-surface p-4">
      {/* Header skeleton: placeholder title + goal chip. */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="h-3 w-28 rounded-full bg-surface-sunken" />
        <View className="h-2.5 w-16 rounded-full bg-surface-sunken" />
      </View>

      {/* Toggle skeleton: five micro pills, the first tinted as if selected. */}
      <View className="mb-3 flex-row gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={i === 0 ? { backgroundColor: microColors.iron } : undefined}
            className={`h-7 rounded-full ${i === 0 ? "w-14" : "w-12 bg-surface-sunken"}`}
          />
        ))}
      </View>

      {/* Decoy single-series columns + placeholder day labels. */}
      <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
        {DECOY.map((frac, i) => (
          <View key={i} className="flex-1 items-center justify-end" style={{ height: CHART_HEIGHT }}>
            <View
              style={{ height: frac * CHART_HEIGHT, width: COLUMN_WIDTH, backgroundColor: microColors.iron }}
              className="rounded-t-md"
            />
          </View>
        ))}
      </View>
      <View className="mt-2 flex-row justify-between">
        {DECOY.map((_, i) => (
          <View key={i} className="flex-1 items-center">
            <View className="h-2 w-5 rounded-full bg-surface-sunken" />
          </View>
        ))}
      </View>

      {/* Native blur (expo-blur, works in Expo Go + web) plus a guaranteed charcoal tint. */}
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} className="bg-charcoal/40" />

      <View className="absolute inset-0 items-center justify-center p-5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <Ionicons name="lock-closed" size={22} color={colors.brand} />
        </View>
        <ScalableText className="mt-2 text-center text-base font-bold text-ink">
          {tl("See your micronutrient trends", "睇你嘅微量營養走勢")}
        </ScalableText>
        <ScalableText className="mt-1 text-center text-xs leading-5 text-ink-muted">
          {tl(
            "Upgrade to Pro to chart iron, calcium, potassium and your vitamins across 7 days.",
            "升級 Pro，7 日圖表追蹤鐵、鈣、鉀同你嘅維他命。",
          )}
        </ScalableText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tl("Unlock micronutrient trends", "解鎖微量營養走勢")}
          onPress={onUnlock}
          className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-2.5 active:opacity-90"
        >
          <Ionicons name="sparkles" size={15} color={colors.white} />
          <ScalableText className="text-sm font-bold text-white">{tl("Unlock", "解鎖")}</ScalableText>
        </Pressable>
      </View>
    </View>
  );
}
