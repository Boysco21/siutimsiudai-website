import { useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { isWithinHistoryWindow } from "@/hooks/useFeatureAccess";
import { dayOfMonth, todayKey, weekdayShort } from "@/utils/formatters";

interface Props {
  days: string[]; // oldest -> newest, ending today
  selected: string;
  onSelect: (dateKey: string) => void;
  // Free tier: every day before today wears a small lock so the archive reads as gated.
  isPaid: boolean;
}

// Horizontal calendar scroll strip. Auto-scrolls to today on mount so the freshest day sits
// under the thumb; tapping any pill selects that day for the breakdown below.
export function HistoryDateStrip({ days, selected, onSelect, isPaid }: Props) {
  const { locale } = useLocale();
  const today = todayKey();
  const scrollRef = useRef<ScrollView>(null);
  const didAutoScroll = useRef(false);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => {
        if (didAutoScroll.current) return;
        didAutoScroll.current = true;
        scrollRef.current?.scrollToEnd({ animated: false });
      }}
      contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
    >
      {days.map((dateKey) => {
        const isSelected = dateKey === selected;
        const isToday = dateKey === today;
        const locked = !isPaid && !isWithinHistoryWindow(dateKey, today);
        return (
          <Pressable
            key={dateKey}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dateKey}
            onPress={() => onSelect(dateKey)}
            className={`min-h-[44px] w-[52px] items-center rounded-2xl border px-1 py-2 active:opacity-80 ${
              isSelected ? "border-brand bg-brand" : "border-[#E4DCCB] bg-surface"
            }`}
          >
            <ScalableText
              className={`text-[11px] ${
                isSelected ? "text-white/90" : isToday ? "font-bold text-brand" : "text-ink-faint"
              }`}
            >
              {weekdayShort(dateKey, locale)}
            </ScalableText>
            <ScalableText className={`text-lg font-bold ${isSelected ? "text-white" : "text-ink"}`}>
              {dayOfMonth(dateKey)}
            </ScalableText>
            {locked ? (
              <Ionicons
                name="lock-closed"
                size={11}
                color={isSelected ? colors.white : colors.inkFaint}
              />
            ) : (
              // Spacer keeps every pill the same height whether or not the lock shows.
              <View className="h-[11px]" />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
