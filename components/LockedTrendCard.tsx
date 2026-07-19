import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors, macroColors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  // Route to the paywall. Wired to useHistoryAccess().triggerPaywall by the screen.
  onUnlock: () => void;
}

const CHART_HEIGHT = 120;
const COLUMN_WIDTH = 18;
// Fixed decoy heights (fraction of the chart) with invented macro splits. Deliberately NOT
// derived from any logged day, so a free user sees the SHAPE of a weekly trend behind the blur
// but no real figure ever enters the tree. The blur is aesthetic; the security is the fake data.
const DECOY = [0.55, 0.8, 0.45, 0.95, 0.6, 0.85, 0.7];

function DecoyColumn({ frac }: { frac: number }) {
  const h = frac * CHART_HEIGHT;
  return (
    <View className="flex-1 items-center justify-end" style={{ height: CHART_HEIGHT }}>
      <View style={{ height: h, width: COLUMN_WIDTH }} className="overflow-hidden rounded-t-md">
        <View style={{ height: h * 0.34, backgroundColor: macroColors.protein }} />
        <View style={{ height: h * 0.28, backgroundColor: macroColors.fat }} />
        <View style={{ height: h * 0.38, backgroundColor: macroColors.carbs }} />
      </View>
    </View>
  );
}

// The locked weekly-trend state for free users. A decoy stacked-column chart is blurred and
// dimmed under a charcoal scrim, with a compact upsell card floated on top. Mirrors the
// LockedLedgerOverlay treatment so the two archive locks feel like one system.
export function LockedTrendCard({ onUnlock }: Props) {
  const { tl } = useLocale();

  return (
    <View className="relative overflow-hidden rounded-2xl border border-[#E4DCCB] bg-surface p-4">
      {/* Decoy chart skeleton: placeholder header + invented columns + placeholder day labels. */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="h-3 w-24 rounded-full bg-surface-sunken" />
        <View className="flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="h-2 w-8 rounded-full bg-surface-sunken" />
          ))}
        </View>
      </View>
      <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
        {DECOY.map((frac, i) => (
          <DecoyColumn key={i} frac={frac} />
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
          {tl("See your weekly trend", "睇你嘅每週走勢")}
        </ScalableText>
        <ScalableText className="mt-1 text-center text-xs leading-5 text-ink-muted">
          {tl(
            "Upgrade to Pro to chart your last 7 days of macros and micros.",
            "升級 Pro，圖表回顧你近 7 日嘅營養走勢。",
          )}
        </ScalableText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tl("Unlock weekly trend", "解鎖每週走勢")}
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
