import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ScalableText } from "./ScalableText";
import { microColors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { TRACKED_MICRO_KEYS, TRACKED_MICRO_META, MicroTotals, TrackedMicroKey } from "@/utils/micros";
import { MicronutrientTarget } from "@/types";

export interface MicroHistoryDatum {
  dateKey: string;
  label: string; // weekday short, already localized
  micros: MicroTotals; // the five tracked totals for the day
  isToday: boolean;
}

interface Props {
  data: MicroHistoryDatum[]; // oldest -> newest, up to 7 days
  targets: MicronutrientTarget[] | null; // for the dashed daily-goal line
  title: string;
}

const CHART_HEIGHT = 120;
const COLUMN_WIDTH = 18;
// Enough dashes to span the plot as a broken horizontal line without a drawing dependency.
const DASHES = Array.from({ length: 22 });

// A single, MacroFactor-style 7-day micronutrient chart. One micro is shown at a time; the toggle
// above swaps which. Each day is one bar in the micro's colour, and a dashed line marks that micro's
// daily target so "am I hitting my goal" reads at a glance. The axis is scaled to fit both the bars
// and the goal, so the target line is always on-canvas. Premium-only — the screen renders a locked
// decoy for free users, so no real figure reaches this tree unless the user is paid.
export function MicroHistoryChart({ data, targets, title }: Props) {
  const { tl } = useLocale();
  const [activeKey, setActiveKey] = useState<TrackedMicroKey>("iron");

  const meta = TRACKED_MICRO_META[activeKey];
  const color = microColors[activeKey];
  const goal = targets?.find((t) => t.key === activeKey)?.amount ?? null;

  const values = data.map((d) => d.micros[activeKey]);
  const max = Math.max(1, goal ?? 0, ...values);
  const goalY = goal != null ? Math.min(CHART_HEIGHT, (goal / max) * CHART_HEIGHT) : null;

  return (
    <View className="rounded-2xl border border-[#E4DCCB] bg-surface p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <ScalableText className="text-base font-semibold text-ink">{title}</ScalableText>
        {goal != null ? (
          <View className="flex-row items-center gap-1.5">
            <View
              style={{ width: 14, borderTopWidth: 1.5, borderColor: color, borderStyle: "dashed" }}
            />
            <ScalableText className="text-[11px] text-ink-muted">
              {tl(`Goal ${Math.round(goal)} ${meta.unit}`, `目標 ${Math.round(goal)} ${meta.unit}`)}
            </ScalableText>
          </View>
        ) : null}
      </View>

      {/* Micro toggle: horizontal scrolling pills, the active one tinted with its own colour. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        className="mb-3"
      >
        {TRACKED_MICRO_KEYS.map((key) => {
          const active = key === activeKey;
          const m = TRACKED_MICRO_META[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setActiveKey(key)}
              style={active ? { backgroundColor: microColors[key] } : undefined}
              className={`min-h-[44px] justify-center rounded-full px-4 py-2 active:opacity-80 ${
                active ? "" : "border border-[#E4DCCB] bg-surface"
              }`}
            >
              <ScalableText
                className={`text-sm font-semibold ${active ? "text-white" : "text-ink-muted"}`}
              >
                {tl(m.label, m.labelZh)}
              </ScalableText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Plot: bars anchored to the baseline, with the dashed goal line floated over them. */}
      <View style={{ height: CHART_HEIGHT }} className="relative">
        {goalY != null ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: goalY }}
            className="flex-row justify-between"
          >
            {DASHES.map((_, i) => (
              <View key={i} style={{ width: 5, height: 1.5, backgroundColor: color, opacity: 0.5 }} />
            ))}
          </View>
        ) : null}

        <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
          {data.map((d) => {
            const v = d.micros[activeKey];
            const colH = v > 0 ? Math.max(4, (v / max) * CHART_HEIGHT) : 0;
            return (
              <View
                key={d.dateKey}
                className="flex-1 items-center justify-end"
                style={{ height: CHART_HEIGHT }}
              >
                {colH > 0 ? (
                  <View
                    style={{ height: colH, width: COLUMN_WIDTH, backgroundColor: color }}
                    className="rounded-t-md"
                  />
                ) : (
                  <View style={{ width: COLUMN_WIDTH }} className="h-1 rounded-full bg-surface-sunken" />
                )}
              </View>
            );
          })}
        </View>
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
