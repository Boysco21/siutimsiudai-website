import { Modal, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  visible: boolean;
  onClose: () => void;
}

// The contextual paywall that pops when a free user spends their fifth AI log of the week and
// reaches for a sixth. It floats over the log sheet, so manual entry stays free right behind it;
// the Milk Tea Amber CTA hands off to the full subscription screen. Positioning stays strictly
// nutrition-ledger: this is a metabolic bookkeeping quota, never a food-ordering limit.
export function PaywallModal({ visible, onClose }: Props) {
  const { tl } = useLocale();

  // Dismiss the modal first, then route to the paywall so the log sheet isn't left stacked
  // underneath the subscription screen.
  function onUnlock() {
    onClose();
    router.push("/subscription");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        {/* Tap-off backdrop. Dismissing drops the user back on the log sheet with manual entry. */}
        <Pressable
          className="absolute inset-0"
          accessibilityRole="button"
          accessibilityLabel={tl("Dismiss", "唔使住")}
          onPress={onClose}
        />

        <View
          className="w-full max-w-[360px] items-center gap-4 rounded-3xl bg-surface p-6"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand/10">
            <Ionicons name="sparkles" size={30} color={colors.brand} />
          </View>

          <ScalableText className="text-center text-xl font-bold text-ink">
            {tl("Weekly Quota Fully Booked", "呢個星期嘅健康 quota 已用完！")}
          </ScalableText>

          <ScalableText className="text-center text-sm leading-6 text-ink-muted">
            {tl(
              "Boss, your 5 free AI ledger entries for the week are fully spent! Even the kitchen needs a break. Want to scan your macros anytime without restrictions? Upgrade to our Pro Plan to unlock unlimited AI recognition and fully automate your healthy routine!",
              "老細，你今個禮拜嘅 5 次免費 AI 記帳 Quota 已經用晒喇！廚房都要休息㗎。想隨時隨地無限制影相入數？升級到 Pro 計劃，即刻解鎖無限次 AI 識別，全面自動化你嘅少甜少底生活！",
            )}
          </ScalableText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tl("Unlock Unlimited AI Logs", "解鎖無限次 AI 記帳")}
            onPress={onUnlock}
            className="mt-1 min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 active:opacity-90"
          >
            <Ionicons name="sparkles" size={18} color={colors.white} />
            <ScalableText className="text-base font-bold text-white">
              {tl("Unlock Unlimited AI Logs", "解鎖無限次 AI 記帳")}
            </ScalableText>
          </Pressable>

          {/* Escape hatch: manual entry never gates, so let them back out gracefully. */}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="min-h-[44px] w-full items-center justify-center py-1"
          >
            <ScalableText className="text-sm font-semibold text-ink-faint">
              {tl("Maybe later, manual entry is free", "遲啲先，手動入數照樣免費")}
            </ScalableText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
