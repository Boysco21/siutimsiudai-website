import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ScalableText } from "./ScalableText";
import { useLocale } from "@/hooks/useLocale";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/constants/legal";

interface Props {
  // Center under the paywall's restore row; left-align in the settings list.
  align?: "center" | "start";
}

// Clickable Privacy Policy + Terms of Service links. Apple wants these reachable inside the app in
// two spots: account settings (Guideline 5.1.1) and the paywall (Guideline 3.1.2, auto-renewing
// subscriptions). Each opens its document in an in-app browser (Safari View Controller / Custom
// Tab). Best-effort: a failed open never crashes the host screen.
export function LegalLinks({ align = "center" }: Props) {
  const { tl } = useLocale();
  const open = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  return (
    <View
      className={`flex-row items-center gap-2 ${align === "center" ? "justify-center" : ""}`}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tl("Privacy Policy", "私隱政策")}
        onPress={() => open(PRIVACY_POLICY_URL)}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        className="min-h-[44px] justify-center active:opacity-70"
      >
        <ScalableText className="text-sm font-medium text-brand underline">
          {tl("Privacy Policy", "私隱政策")}
        </ScalableText>
      </Pressable>
      <ScalableText className="text-sm text-ink-faint">·</ScalableText>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tl("Terms of Service", "服務條款")}
        onPress={() => open(TERMS_OF_SERVICE_URL)}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        className="min-h-[44px] justify-center active:opacity-70"
      >
        <ScalableText className="text-sm font-medium text-brand underline">
          {tl("Terms of Service", "服務條款")}
        </ScalableText>
      </Pressable>
    </View>
  );
}
