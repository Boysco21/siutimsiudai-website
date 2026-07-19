import { Modal, ScrollView, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAppStore } from "@/stores/appStore";
import { PRIVACY_POLICY_URL } from "@/constants/legal";

// One-time, blocking AI disclosure shown the first time a user reaches the main app. It names the
// AI provider (Google Cloud) and the exact content that gets sent, then records consent in the app
// store so it never shows again. Required for App Store review (Guideline 5.1.2): the user must be
// told, and agree, before any of their content is sent to an AI vendor. There is no close
// affordance and the backdrop is inert, so consent is explicit rather than dismissed-away. The
// on-device mock services still run without a network, so declining users who quit lose nothing.
export function AiConsentSheet() {
  const { tl } = useLocale();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const accepted = useAppStore((s) => s.aiConsentAccepted);
  const acceptAiConsent = useAppStore((s) => s.acceptAiConsent);

  // Wait for persistence to hydrate so a returning, already-consented user never sees a flash.
  const visible = hasHydrated && !accepted;

  const bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "camera-outline", text: tl("Meal photos you scan", "你影低嘅餐相") },
    { icon: "chatbubble-ellipses-outline", text: tl("Meal descriptions you type", "你打嘅餐點描述") },
    { icon: "link-outline", text: tl("Recipe links you import", "你匯入嘅食譜連結") },
    { icon: "swap-horizontal-outline", text: tl("Ingredients you ask us to swap", "你要求更換嘅食材") },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-surface px-5 pb-8 pt-6" style={{ maxHeight: "88%" }}>
          <View className="mb-3 h-12 w-12 items-center justify-center self-center rounded-full bg-jade-100">
            <Ionicons name="sparkles" size={24} color={colors.jade} />
          </View>
          <ScalableText className="text-center text-xl font-bold text-ink">
            {tl("How Siu Tim Siu Dai uses AI", "少甜少底點樣運用 AI")}
          </ScalableText>
          <ScalableText className="mt-2 text-center text-sm leading-5 text-ink-muted">
            {tl(
              "Some features use AI to read your food and suggest results. When you use them, the following is sent securely to our AI provider, Google Cloud, to generate your result:",
              "部分功能會用 AI 分析你嘅食物並提供結果。當你使用時，以下內容會安全傳送到我哋嘅 AI 供應商 Google Cloud 生成結果：",
            )}
          </ScalableText>

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {bullets.map((b) => (
                <View
                  key={b.icon}
                  className="flex-row items-center gap-3 rounded-2xl bg-surface-sunken px-3 py-3"
                >
                  <Ionicons name={b.icon} size={18} color={colors.inkMuted} />
                  <ScalableText className="flex-1 text-sm text-ink">{b.text}</ScalableText>
                </View>
              ))}
            </View>
            <ScalableText className="mt-3 px-1 text-xs leading-5 text-ink-faint">
              {tl(
                "Your content is processed only to provide the feature and is never sold. You can still log meals and browse recipes manually without AI. See our Privacy Policy for details.",
                "你嘅內容只會用嚟提供該功能，絕不出售。你亦可以唔用 AI，自行手動記錄餐點同瀏覽食譜。詳情請睇我哋嘅私隱政策。",
              )}
            </ScalableText>
          </ScrollView>

          <View className="mt-4 gap-2">
            <Button label={tl("Agree and continue", "同意並繼續")} icon="checkmark" onPress={acceptAiConsent} />
            <Button
              label={tl("Read Privacy Policy", "查看私隱政策")}
              variant="ghost"
              onPress={() => {
                WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() => {});
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
