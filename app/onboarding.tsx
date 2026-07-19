import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAppStore } from "@/stores/appStore";
import { Locale } from "@/types";

const LANGS: { key: Locale; label: string }[] = [
  { key: "en", label: "EN" },
  { key: "zh-Hant", label: "中" },
];

function LangToggle() {
  const { locale } = useLocale();
  const setLocale = useAppStore((s) => s.setLocale);
  return (
    <View className="flex-row rounded-full bg-surface-sunken p-1">
      {LANGS.map((lng) => {
        const active = locale === lng.key;
        return (
          <Pressable
            key={lng.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setLocale(lng.key)}
            className={`min-h-[44px] justify-center rounded-full px-4 ${active ? "bg-ink" : ""}`}
          >
            <ScalableText className={`text-sm font-bold ${active ? "text-white" : "text-ink-muted"}`}>
              {lng.label}
            </ScalableText>
          </Pressable>
        );
      })}
    </View>
  );
}

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; titleKey: string; bodyKey: string }[] = [
  { icon: "restaurant", titleKey: "onboarding.feature1Title", bodyKey: "onboarding.feature1Body" },
  { icon: "book", titleKey: "onboarding.feature2Title", bodyKey: "onboarding.feature2Body" },
  { icon: "nutrition", titleKey: "onboarding.feature3Title", bodyKey: "onboarding.feature3Body" },
];

function FeatureRow({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-sunken">
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <View className="flex-1">
        <ScalableText className="text-base font-bold text-ink">{title}</ScalableText>
        <ScalableText className="mt-0.5 text-sm leading-5 text-ink-muted">{body}</ScalableText>
      </View>
    </View>
  );
}

/**
 * First screen on launch: a short value-prop intro. "Get Started" marks onboarding complete and
 * hands off to the auth flow. The route gate (app/_layout.tsx) only shows this once.
 */
export default function OnboardingScreen() {
  const { t } = useLocale();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  function getStarted() {
    // Mark onboarding done and let the route gate (app/_layout.tsx) choose the next stop: sign-in
    // for a new user, or straight to profile-setup / the app when a session already exists (e.g. a
    // dev replay). Keeping the destination in the gate avoids a stale hardcoded hop.
    completeOnboarding();
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-end px-5 pt-2">
        <LangToggle />
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 mt-4">
          <ScalableText className="text-3xl font-bold text-ink">{t("onboarding.welcomeTitle")}</ScalableText>
          <ScalableText className="mt-2 text-base leading-6 text-ink-muted">
            {t("onboarding.welcomeSubtitle")}
          </ScalableText>
        </View>

        <View className="gap-5">
          {FEATURES.map((f) => (
            <FeatureRow key={f.titleKey} icon={f.icon} title={t(f.titleKey)} body={t(f.bodyKey)} />
          ))}
        </View>
      </ScrollView>

      <View className="border-t border-[#E4DCCB] bg-surface px-5 pb-4 pt-3">
        <Button label={t("onboarding.getStarted")} icon="arrow-forward" onPress={getStarted} />
      </View>
    </Screen>
  );
}
