import { View } from "react-native";
import { ScalableText } from "./ScalableText";
import { macroColors } from "@/constants/theme";

export interface WeeklyMacroDatum {
  dateKey: string;
  label: string; // weekday short, already localized
  protein: number;
  carbs: number;
  fat: number;
  isToday: boolean;
}

interface Props {
  data: WeeklyMacroDatum[]; // oldest -> newest, up to 7 days
  title: string;
  legend: { carbs: string; fat: string; protein: string };
}

const CHART_HEIGHT = 120;
const COLUMN_WIDTH = 18;

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View style={{ backgroundColor: color }} className="h-2 w-2 rounded-full" />
      <ScalableText className="text-[11px] text-ink-muted">{label}</ScalableText>
    </View>
  );
}

// Seven-day intake trend. Each day is one column that stacks carbs (bottom), fat (middle) and
// protein (top); the column's height is the day's total grams scaled against the busiest day,
// so the shape reads as "how much did I book, and of what" at a glance.
export function WeeklyMacroChart({ data, title, legend }: Props) {
  const max = Math.max(1, ...data.map((d) => d.carbs + d.fat + d.protein));

  return (
    <View className="rounded-2xl border border-[#E4DCCB] bg-surface p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <ScalableText className="text-base font-semibold text-ink">{title}</ScalableText>
        <View className="flex-row items-center gap-3">
          <LegendDot color={macroColors.carbs} label={legend.carbs} />
          <LegendDot color={macroColors.fat} label={legend.fat} />
          <LegendDot color={macroColors.protein} label={legend.protein} />
        </View>
      </View>

      <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
        {data.map((d) => {
          const total = d.carbs + d.fat + d.protein;
          const colH = total > 0 ? Math.max(4, (total / max) * CHART_HEIGHT) : 0;
          const seg = (g: number) => (total > 0 ? (g / total) * colH : 0);
          return (
            <View
              key={d.dateKey}
              className="flex-1 items-center justify-end"
              style={{ height: CHART_HEIGHT }}
            >
              {total > 0 ? (
                <View style={{ height: colH, width: COLUMN_WIDTH }} className="overflow-hidden rounded-t-md">
                  <View style={{ height: seg(d.protein), backgroundColor: macroColors.protein }} />
                  <View style={{ height: seg(d.fat), backgroundColor: macroColors.fat }} />
                  <View style={{ height: seg(d.carbs), backgroundColor: macroColors.carbs }} />
                </View>
              ) : (
                <View style={{ width: COLUMN_WIDTH }} className="h-1 rounded-full bg-surface-sunken" />
              )}
            </View>
          );
        })}
      </View>

      <View className="mt-2 flex-row justify-between">
        {data.map((d) => (
          <View key={d.dateKey} className="flex-1 items-center">
            <ScalableText
              className={`text-xs ${d.isToday ? "font-bold text-brand" : "text-ink-faint"}`}
            >
              {d.label}
            </ScalableText>
          </View>
        ))}
      </View>
    </View>
  );
}
