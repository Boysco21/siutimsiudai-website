import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { clampPercent, formatCalories } from "@/utils/formatters";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  eaten: number;
  target: number;
  size?: number;
}

// The hero of the dashboard: a single big number for "eaten" inside a progress ring.
// Only the number and its target label live inside the ring so they stay optically
// centred; the running caption (remaining / over) sits just beneath the ring, where a
// longer sentence has room to breathe instead of crowding the ring's inner edge.
export function CalorieRing({ eaten, target, size = 224 }: Props) {
  const { t } = useLocale();
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clampPercent(eaten, target);
  const offset = circumference * (1 - pct);
  const over = eaten > target;
  const remaining = Math.max(0, Math.round(target - eaten));
  // Health indicator: jade while on track, egg-tart gold once over target.
  const progressColor = over ? colors.accent : colors.jade;
  const caption = over
    ? t("dashboard.over", { count: Math.round(eaten - target) })
    : t("dashboard.remaining", { count: remaining });

  return (
    <View className="items-center gap-3">
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.ringTrack}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View className="absolute items-center px-8">
          <ScalableText className="text-6xl font-extrabold leading-none text-ink">
            {formatCalories(eaten)}
          </ScalableText>
          <ScalableText className="mt-2 text-sm text-ink-muted">
            {t("dashboard.eaten")} · {formatCalories(target)} {t("dashboard.target")}
          </ScalableText>
        </View>
      </View>
      <ScalableText
        className="max-w-[280px] text-center text-sm font-semibold leading-relaxed tracking-wide"
        style={{ color: progressColor }}
      >
        {caption}
      </ScalableText>
    </View>
  );
}
