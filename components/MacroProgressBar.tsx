import { View } from "react-native";
import { ScalableText } from "./ScalableText";

interface Props {
  label: string;
  grams: number;
  // When a target is given the bar fills toward it and captions "eaten / target g"; without
  // one it falls back to this macro's share of the day's total (matching the dashboard NutrientPanel).
  target?: number;
  total?: number;
  color: string;
}

// One horizontal macro bar: category name on the left, weight consumed vs target on the right,
// and a track that fills by intake percentage. Shared by the history day view so the logbook
// and the dashboard nutrient panel read identically.
export function MacroProgressBar({ label, grams, target, total, color }: Props) {
  const pct =
    target && target > 0
      ? Math.min(100, Math.round((grams / target) * 100))
      : total && total > 0
        ? Math.round((grams / total) * 100)
        : 0;

  return (
    <View className="mb-3">
      <View className="mb-1 flex-row items-end justify-between">
        <ScalableText className="text-sm font-semibold text-ink">{label}</ScalableText>
        <ScalableText className="text-sm text-ink-muted">
          {Math.round(grams)}
          {target ? ` / ${target}` : ""} g
        </ScalableText>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        <View
          style={{ width: `${pct}%`, backgroundColor: color }}
          className="h-full rounded-full"
        />
      </View>
    </View>
  );
}
