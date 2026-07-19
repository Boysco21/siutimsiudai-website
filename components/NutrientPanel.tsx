import { useMemo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors, macroColors, microColors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useNutritionStore } from "@/stores/nutritionStore";
import { sumMicroTotals, TrackedMicroKey } from "@/utils/micros";
import { NutritionTargets } from "@/types";

interface Props {
  date: string;
  // Effective macros for the day (after 少甜 / 少底 tweaks). Calories aren't charted here.
  macros: { protein: number; carbs: number; fat: number };
  // Full computed target set, or null when the user hasn't set a health profile yet.
  targets: NutritionTargets | null;
}

// The two micro groups the tracker charts, split from the five tracked keys so vitamins and
// minerals read as their own tidy blocks rather than one undifferentiated list.
const MINERAL_KEYS: TrackedMicroKey[] = ["iron", "calcium", "potassium"];
const VITAMIN_KEYS: TrackedMicroKey[] = ["vitaminC", "vitaminD"];

// One progress row, shared by every nutrient. With a target it fills toward it and shows
// "eaten / target unit"; without one (macros before a profile exists) it shows the macro's
// share of the day's total, matching the old macro drawer so the bars stay familiar.
function NutrientBar({
  label,
  value,
  target,
  total,
  unit,
  color,
}: {
  label: string;
  value: number;
  target?: number;
  total?: number;
  unit: string;
  color: string;
}) {
  const pct =
    target && target > 0
      ? Math.min(100, Math.round((value / target) * 100))
      : total && total > 0
        ? Math.round((value / total) * 100)
        : 0;
  return (
    <View className="mb-3">
      <View className="mb-1 flex-row items-end justify-between">
        <ScalableText className="text-sm font-semibold text-ink">{label}</ScalableText>
        <ScalableText className="text-sm text-ink-muted">
          {Math.round(value)}
          {target && target > 0 ? ` / ${Math.round(target)}` : ""} {unit}
        </ScalableText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </View>
    </View>
  );
}

// A labelled group of bars (Macros / Minerals / Vitamins). The small caps header is the
// grouping cue; `first` drops the top margin so the block hugs the card header.
function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <View className={first ? "" : "mt-4"}>
      <ScalableText className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-faint">
        {title}
      </ScalableText>
      {children}
    </View>
  );
}

// The unified premium "Nutrients" card: macros, minerals and vitamins in one elegant panel with
// matching progress bars. Gated end to end — both macro_drawer and micro_tracker are Pro, so a
// free user sees one locked upsell and never any figures. Belt-and-braces: micros are also stripped
// from free history at the save path (retainMicrosForTier), so the numbers behind this are premium
// by construction, not just hidden by the gate.
export function NutrientPanel({ date, macros, targets }: Props) {
  const { t, tl } = useLocale();
  const { hasAccess, triggerPaywall } = useFeatureAccess("macro_drawer");
  const entries = useNutritionStore((s) => s.logsByDate[date]?.entries);
  const microTotals = useMemo(() => sumMicroTotals(entries ?? []), [entries]);

  // Free tier: one locked upsell for the whole panel. Tapping opens the paywall, never numbers.
  if (!hasAccess) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tl(
          "Unlock the full nutrients breakdown with Pro",
          "升級 Pro 解鎖完整營養分析",
        )}
        onPress={triggerPaywall}
        className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-[#E4DCCB] bg-surface px-4 py-3 active:opacity-80"
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Ionicons name="nutrition-outline" size={20} color={colors.inkMuted} />
          <View className="flex-1">
            <ScalableText className="text-base font-semibold text-ink">
              {t("dashboard.nutrients")}
            </ScalableText>
            <ScalableText className="text-xs text-ink-muted" numberOfLines={1}>
              {tl("Macros, vitamins & minerals breakdown", "營養素、維他命同礦物質完整分析")}
            </ScalableText>
          </View>
        </View>
        <View
          className="flex-row items-center gap-1 rounded-full px-3 py-1"
          style={{ backgroundColor: "#F5EBE0" }}
        >
          <Ionicons name="lock-closed" size={12} color={colors.brand} />
          <ScalableText className="text-xs font-bold" style={{ color: colors.brand }}>
            {tl("Pro", "Pro")}
          </ScalableText>
        </View>
      </Pressable>
    );
  }

  const macroTotal = macros.protein + macros.carbs + macros.fat;
  // Single source of truth for each micro's target, label and unit (utils/nutritionTargets).
  const microByKey = new Map((targets?.micros ?? []).map((m) => [m.key, m]));

  const renderMicro = (key: TrackedMicroKey) => {
    const target = microByKey.get(key);
    if (!target) return null;
    return (
      <NutrientBar
        key={key}
        label={tl(target.label, target.labelZh)}
        value={microTotals[key]}
        target={target.amount}
        unit={target.unit}
        color={microColors[key]}
      />
    );
  };

  return (
    <View className="rounded-2xl border border-[#E4DCCB] bg-surface p-4">
      <View className="mb-4 flex-row items-center gap-2">
        <Ionicons name="nutrition-outline" size={18} color={colors.brand} />
        <ScalableText className="text-base font-semibold text-ink">
          {t("dashboard.nutrients")}
        </ScalableText>
      </View>

      <Section title={t("dashboard.macros")} first>
        <NutrientBar
          label={t("dashboard.protein")}
          value={macros.protein}
          target={targets?.protein}
          total={macroTotal}
          unit="g"
          color={macroColors.protein}
        />
        <NutrientBar
          label={t("dashboard.carbs")}
          value={macros.carbs}
          target={targets?.carbs}
          total={macroTotal}
          unit="g"
          color={macroColors.carbs}
        />
        <NutrientBar
          label={t("dashboard.fat")}
          value={macros.fat}
          target={targets?.fat}
          total={macroTotal}
          unit="g"
          color={macroColors.fat}
        />
      </Section>

      {targets ? (
        <>
          <Section title={tl("Minerals", "礦物質")}>{MINERAL_KEYS.map(renderMicro)}</Section>
          <Section title={tl("Vitamins", "維他命")}>{VITAMIN_KEYS.map(renderMicro)}</Section>
        </>
      ) : (
        // Paid, but no health profile yet: no personalised micro targets to chart against. Nudge
        // setup rather than showing empty vitamin/mineral bars.
        <View className="mt-4 rounded-xl bg-surface-subtle p-3">
          <ScalableText className="text-xs text-ink-muted">
            {tl(
              "Set up your health profile to see your vitamin & mineral targets.",
              "設定健康檔案，即可睇維他命同礦物質目標。",
            )}
          </ScalableText>
        </View>
      )}
    </View>
  );
}
