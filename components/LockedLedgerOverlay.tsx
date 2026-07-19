import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  // Route to the paywall. Wired to useHistoryAccess().triggerPaywall by the screen.
  onUnlock: () => void;
}

// A row of muted placeholder blocks that mimic the real hero + bars layout. This is what sits
// under the blur, so a free user peering past the window sees the SHAPE of their archive but no
// real figures ever enter the tree. The blur is aesthetic; the security is the absent numbers.
function DecoySkeleton() {
  return (
    <View className="gap-4 p-5">
      <View className="items-center gap-2">
        <View className="h-3 w-24 rounded-full bg-surface-sunken" />
        <View className="h-10 w-40 rounded-2xl bg-surface-sunken" />
        <View className="h-3 w-28 rounded-full bg-surface-sunken" />
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} className="gap-1.5">
          <View className="flex-row justify-between">
            <View className="h-3 w-16 rounded-full bg-surface-sunken" />
            <View className="h-3 w-14 rounded-full bg-surface-sunken" />
          </View>
          <View className="h-2.5 rounded-full bg-surface-sunken" />
        </View>
      ))}
    </View>
  );
}

// The "Locked Ledger" state for free users looking more than seven days back. Never a blank
// page: the decoy archive is blurred and dimmed under a charcoal scrim, with a high-contrast
// card floated on top carrying the upgrade pitch and a Milk Tea Amber CTA to the paywall.
export function LockedLedgerOverlay({ onUnlock }: Props) {
  const { tl } = useLocale();

  return (
    <View className="relative min-h-[340px] overflow-hidden rounded-3xl border border-[#E4DCCB] bg-surface">
      <DecoySkeleton />

      {/* Real native blur (expo-blur, works in Expo Go + web) ... */}
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      {/* ... plus a guaranteed charcoal tint so the lock reads even where blur is subtle. */}
      <View style={StyleSheet.absoluteFill} className="bg-charcoal/40" />

      <View className="absolute inset-0 items-center justify-center p-6">
        <View
          className="w-full max-w-[340px] items-center gap-3 rounded-3xl bg-surface p-6"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand/10">
            <Ionicons name="lock-closed" size={26} color={colors.brand} />
          </View>

          <ScalableText className="text-center text-lg font-bold text-ink">
            {tl("Ledger Archive Locked", "歷史帳目被鎖定")}
          </ScalableText>

          <ScalableText className="text-center text-sm leading-5 text-ink-muted">
            {tl(
              "Boss, every day before today is safely filed in your archive. Upgrade to Pro to reopen your full history and track your long-term progress with clean charts.",
              "老細，今日之前嘅每一日都安全歸檔咗。升級 Pro，重開完整歷史帳目，用圖表追蹤你嘅長線進度。",
            )}
          </ScalableText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tl("Unlock Lifetime History", "解鎖歷史帳目")}
            onPress={onUnlock}
            className="mt-1 min-h-[44px] w-full flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 active:opacity-90"
          >
            <Ionicons name="sparkles" size={16} color={colors.white} />
            <ScalableText className="text-base font-bold text-white">
              {tl("Unlock Lifetime History", "解鎖歷史帳目")}
            </ScalableText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
