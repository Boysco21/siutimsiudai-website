import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { HEALTH_DEFAULTS, HealthProfileForm } from "@/components/HealthProfileForm";
import { useLocale } from "@/hooks/useLocale";
import { useNutritionStore } from "@/stores/nutritionStore";
import { normalizeHealthProfile } from "@/utils/nutritionTargets";
import { HealthProfile } from "@/types";

// Post-authentication landing screen: the health profile setup. Saving (or skipping to sensible
// defaults) writes a non-null healthProfile, which is exactly what the route gate checks before
// letting the user into the app. Reuses the shared HealthProfileForm so this stays in lockstep
// with the in-app editor.
export default function ProfileSetupScreen() {
  const { t } = useLocale();
  const existing = useNutritionStore((s) => s.healthProfile);
  const setHealthProfile = useNutritionStore((s) => s.setHealthProfile);
  const [draft, setDraft] = useState<HealthProfile>(existing ?? HEALTH_DEFAULTS);

  function commit(profile: HealthProfile) {
    // setHealthProfile also seeds the daily calorie target, so the dashboard ring is right on
    // arrival. A non-null profile flips the gate's last step and routes into the app.
    setHealthProfile(normalizeHealthProfile(profile));
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="px-5 pb-3 pt-4">
        <ScalableText className="text-2xl font-bold text-ink">{t("profileSetup.title")}</ScalableText>
        <ScalableText className="mt-1 text-base leading-6 text-ink-muted">
          {t("profileSetup.subtitle")}
        </ScalableText>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* First run: calories + macros preview shows for everyone, but the premium vitamins &
            minerals panel is hidden for free users (freeMicros="hidden"). The route gate keeps the
            user pinned here until a profile is saved, so the subscription modal can't open over this
            screen — an inert lock/upsell would be a dead link. The tappable upsell lives on the
            profile-tab "Nutrition needs" sheet, where /subscription is actually reachable. */}
        <HealthProfileForm initial={existing} onChange={setDraft} freeMicros="hidden" />
        <View className="h-4" />
      </ScrollView>

      <View className="gap-2 border-t border-[#E4DCCB] bg-surface px-5 pb-4 pt-3">
        <Button label={t("profileSetup.saveContinue")} icon="checkmark" onPress={() => commit(draft)} />
        <Button label={t("profileSetup.skip")} variant="ghost" onPress={() => commit(HEALTH_DEFAULTS)} />
      </View>
    </Screen>
  );
}
