import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScalableText } from "./ScalableText";
import { colors, macroColors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { computeNutritionTargets } from "@/utils/nutritionTargets";
import { resolveMicrosPresentation, useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { ActivityLevel, HealthProfile, Sex, WeightGoal } from "@/types";

const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";

// Shared starting point when the user has no saved profile yet. Computes to a sensible
// mid-range target so the live preview is never blank.
export const HEALTH_DEFAULTS: HealthProfile = {
  sex: "female",
  age: 30,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "maintain",
};

const SEX_OPTIONS: { value: Sex; labelKey: string }[] = [
  { value: "female", labelKey: "health.female" },
  { value: "male", labelKey: "health.male" },
];

const GOAL_OPTIONS: { value: WeightGoal; labelKey: string }[] = [
  { value: "lose", labelKey: "health.goalLose" },
  { value: "maintain", labelKey: "health.goalMaintain" },
  { value: "gain", labelKey: "health.goalGain" },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; labelKey: string; hintKey: string }[] = [
  { value: "sedentary", labelKey: "health.activitySedentary", hintKey: "health.activitySedentaryHint" },
  { value: "light", labelKey: "health.activityLight", hintKey: "health.activityLightHint" },
  { value: "moderate", labelKey: "health.activityModerate", hintKey: "health.activityModerateHint" },
  { value: "active", labelKey: "health.activityActive", hintKey: "health.activityActiveHint" },
  { value: "very_active", labelKey: "health.activityVeryActive", hintKey: "health.activityVeryActiveHint" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
              active ? "bg-ink" : "bg-surface-sunken"
            }`}
          >
            <ScalableText
              className={`text-sm font-semibold ${active ? "text-white" : "text-ink-muted"}`}
            >
              {o.label}
            </ScalableText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <ScalableText className="px-1 text-sm font-semibold text-ink-muted">{label}</ScalableText>
      {children}
    </View>
  );
}

function MacroPill({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-xl bg-surface-sunken py-2">
      <View className="h-1.5 w-6 rounded-full" style={{ backgroundColor: color }} />
      <ScalableText className="text-base font-bold text-ink">{grams}</ScalableText>
      <ScalableText className="text-xs text-ink-muted">{label}</ScalableText>
    </View>
  );
}

interface Props {
  /** Saved profile to seed from, or null to start from HEALTH_DEFAULTS. */
  initial: HealthProfile | null;
  /** Fires with the current (un-normalised) draft whenever a field changes. */
  onChange: (draft: HealthProfile) => void;
  /**
   * What FREE users see for the premium daily vitamins & minerals panel. Paid tiers always see the
   * real numbers regardless; this only picks the free-tier treatment:
   *  - "upsell" (default): a locked •••• teaser plus a tappable paywall prompt. Used on the
   *    profile-tab "Nutrition needs" sheet, where /subscription is reachable.
   *  - "hidden": omit the panel entirely. Used on the forced first-run setup, where the route gate
   *    pins the user on /profile-setup and the paywall can't open over it — an inert lock would be
   *    worse than not surfacing premium data at all.
   */
  freeMicros?: "upsell" | "hidden";
}

/**
 * The body of the nutrition-needs form: sex, age, height, weight, activity, goal, plus a live
 * daily-target preview. Holds its own field state and pushes the draft up via onChange so the
 * caller owns the commit button. Shared by the profile sheet and first-run onboarding.
 */
export function HealthProfileForm({ initial, onChange, freeMicros = "upsell" }: Props) {
  const { t, tl } = useLocale();
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.activeTier);
  // Paid tiers see the real vitamins & minerals; free tiers get the upsell teaser or nothing,
  // per the screen's policy. This is the sole gate, so free numbers can never leak on any screen.
  const micros = resolveMicrosPresentation(tier, freeMicros);
  const base = initial ?? HEALTH_DEFAULTS;

  const [sex, setSex] = useState<Sex>(base.sex);
  const [age, setAge] = useState(String(base.age));
  const [heightCm, setHeightCm] = useState(String(base.heightCm));
  const [weightKg, setWeightKg] = useState(String(base.weightKg));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(base.activityLevel);
  const [goal, setGoal] = useState<WeightGoal>(base.goal);

  // Re-seed when the caller swaps in a different saved profile.
  useEffect(() => {
    const b = initial ?? HEALTH_DEFAULTS;
    setSex(b.sex);
    setAge(String(b.age));
    setHeightCm(String(b.heightCm));
    setWeightKg(String(b.weightKg));
    setActivityLevel(b.activityLevel);
    setGoal(b.goal);
  }, [initial]);

  const draft = useMemo<HealthProfile>(
    () => ({
      sex,
      age: Number(age) || 0,
      heightCm: Number(heightCm) || 0,
      weightKg: Number(weightKg) || 0,
      activityLevel,
      goal,
    }),
    [sex, age, heightCm, weightKg, activityLevel, goal],
  );

  const targets = useMemo(() => computeNutritionTargets(draft), [draft]);

  // Push the current draft up whenever it changes so the caller's commit button has it.
  useEffect(() => {
    onChange(draft);
  }, [draft, onChange]);

  return (
    <View className="gap-4">
      <Field label={t("health.sex")}>
        <Segmented
          value={sex}
          onChange={setSex}
          options={SEX_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        />
      </Field>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label={t("health.age")}>
            <TextInput
              className={INPUT}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkFaint}
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={`${t("health.height")} (cm)`}>
            <TextInput
              className={INPUT}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkFaint}
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={`${t("health.weight")} (kg)`}>
            <TextInput
              className={INPUT}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkFaint}
            />
          </Field>
        </View>
      </View>

      <Field label={t("health.activity")}>
        <View className="gap-2">
          {ACTIVITY_OPTIONS.map((o) => {
            const active = o.value === activityLevel;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActivityLevel(o.value)}
                className={`min-h-[44px] flex-row items-center justify-between rounded-xl border px-3 py-2 ${
                  active ? "border-ink bg-ink" : "border-[#E4DCCB] bg-surface"
                }`}
              >
                <View className="flex-1 pr-2">
                  <ScalableText
                    className={`text-sm font-semibold ${active ? "text-white" : "text-ink"}`}
                  >
                    {t(o.labelKey)}
                  </ScalableText>
                  <ScalableText className={`text-xs ${active ? "text-white/70" : "text-ink-muted"}`}>
                    {t(o.hintKey)}
                  </ScalableText>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.white} />}
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label={t("health.goal")}>
        <Segmented
          value={goal}
          onChange={setGoal}
          options={GOAL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        />
      </Field>

      <View className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface-subtle p-4">
        <ScalableText className="text-sm font-semibold text-ink-muted">
          {t("health.dailyTargets")}
        </ScalableText>

        <View className="flex-row items-baseline gap-2">
          <ScalableText className="text-3xl font-bold text-ink">{targets.calories}</ScalableText>
          <ScalableText className="text-base text-ink-muted">
            {tl("kcal", "千卡")} · {t("health.calories")}
          </ScalableText>
        </View>

        <View className="flex-row gap-2">
          <MacroPill label={t("health.protein")} grams={targets.protein} color={macroColors.protein} />
          <MacroPill label={t("health.carbs")} grams={targets.carbs} color={macroColors.carbs} />
          <MacroPill label={t("health.fat")} grams={targets.fat} color={macroColors.fat} />
          <MacroPill label={t("health.fibre")} grams={targets.fiber} color={colors.inkFaint} />
        </View>

        {micros !== "hidden" && (
          <View className="mt-1 gap-2">
            <View className="flex-row items-center gap-1.5">
              <ScalableText className="text-sm font-semibold text-ink-muted">
                {t("health.micros")}
              </ScalableText>
              {micros === "upsell" && <Ionicons name="lock-closed" size={12} color={colors.inkFaint} />}
            </View>
            {targets.micros.map((m) => (
              <View key={m.key} className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ScalableText className="text-sm text-ink">{tl(m.label, m.labelZh)}</ScalableText>
                  {m.isLimit && (
                    <View className="rounded-full bg-surface-sunken px-2 py-0.5">
                      <ScalableText className="text-xs font-medium text-ink-muted">
                        {t("health.max")}
                      </ScalableText>
                    </View>
                  )}
                </View>
                {micros === "upsell" ? (
                  <ScalableText className="text-sm font-semibold tracking-widest text-ink-faint">
                    ••••
                  </ScalableText>
                ) : (
                  <ScalableText className="text-sm font-semibold text-ink">
                    {m.amount} {m.unit}
                  </ScalableText>
                )}
              </View>
            ))}

            {micros === "upsell" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/subscription")}
                className="mt-1 min-h-[44px] flex-row items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 p-3 active:opacity-70"
              >
                <Ionicons name="lock-open-outline" size={16} color={colors.brand} />
                <ScalableText className="flex-1 text-xs font-semibold text-ink">
                  {t("health.microsUpsell")}
                </ScalableText>
                <Ionicons name="chevron-forward" size={16} color={colors.brand} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      <ScalableText className="px-1 text-xs leading-5 text-ink-faint">
        {t("health.disclaimer")}
      </ScalableText>
    </View>
  );
}
