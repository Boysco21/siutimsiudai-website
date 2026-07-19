import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ScalableText } from "@/components/ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useRecipeStore } from "@/stores/recipeStore";

// In-step countdown. Re-mounts per step (key={step.id}) so each step gets a fresh timer.
// Capped font scaling keeps the big digits from overflowing at the largest OS text sizes.
function CookTimer({ seconds }: { seconds: number }) {
  const { t, tl } = useLocale();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const done = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <View className="items-center gap-3 rounded-2xl bg-white/10 px-6 py-4">
      <ScalableText className="text-5xl font-bold text-white" maxFontSizeMultiplier={1.3}>
        {mm}:{ss}
      </ScalableText>
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? tl("Pause", "暫停") : t("cook.start")}
          disabled={done}
          onPress={() => setRunning((v) => !v)}
          className={`h-12 flex-row items-center gap-2 rounded-full bg-white px-5 ${
            done ? "opacity-40" : "active:opacity-80"
          }`}
        >
          <Ionicons name={running ? "pause" : "play"} size={20} color={colors.ink} />
          <ScalableText className="text-base font-semibold text-ink" maxFontSizeMultiplier={1.3}>
            {running ? tl("Pause", "暫停") : t("cook.start")}
          </ScalableText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tl("Reset", "重設")}
          onPress={() => {
            setRunning(false);
            setRemaining(seconds);
          }}
          className="h-12 w-12 items-center justify-center rounded-full bg-white/20 active:opacity-80"
        >
          <Ionicons name="refresh" size={20} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tl } = useLocale();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const [index, setIndex] = useState(0);

  if (!recipe || recipe.steps.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-ink">
        <ScalableText className="text-lg text-white">
          {tl("No steps to cook.", "未有煮食步驟。")}
        </ScalableText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("cook.exit")}
          onPress={() => router.back()}
          className="h-12 items-center justify-center rounded-full bg-white px-6 active:opacity-80"
        >
          <ScalableText className="text-base font-semibold text-ink">{t("cook.exit")}</ScalableText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const total = recipe.steps.length;
  const step = recipe.steps[index];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (isLast) router.back();
    else setIndex((i) => Math.min(total - 1, i + 1));
  };

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("cook.exit")}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="close" size={28} color={colors.white} />
        </Pressable>
        <ScalableText className="text-base font-semibold text-white" maxFontSizeMultiplier={1.3}>
          {t("cook.step", { current: index + 1, total })}
        </ScalableText>
        <View className="h-11 w-11" />
      </View>

      <View className="flex-row flex-wrap justify-center gap-1.5 px-4 pb-2">
        {recipe.steps.map((s, i) => (
          <View
            key={s.id}
            className={`h-1.5 rounded-full ${
              i === index ? "w-6 bg-brand" : i < index ? "w-1.5 bg-white" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </View>

      <View className="flex-1 justify-center gap-6 px-6">
        <ScalableText
          className="text-center text-6xl font-extrabold text-brand"
          maxFontSizeMultiplier={1.3}
        >
          {step.stepNumber}
        </ScalableText>
        <ScalableText
          className="text-center text-3xl font-bold leading-relaxed text-white"
          maxFontSizeMultiplier={1.4}
        >
          {tl(step.instruction, step.instructionZh)}
        </ScalableText>
        <ScalableText
          className="text-center text-lg text-white/60"
          maxFontSizeMultiplier={1.3}
        >
          {tl(step.instructionZh, step.instruction)}
        </ScalableText>
        {step.durationSeconds != null && <CookTimer key={step.id} seconds={step.durationSeconds} />}
      </View>

      <View className="gap-2 px-6 pb-2">
        <ScalableText className="text-center text-xs text-white/50" maxFontSizeMultiplier={1.3}>
          {t("cook.hint")}
        </ScalableText>
        <View className="flex-row justify-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("cook.gestureSim")}
            disabled={isFirst}
            onPress={goPrev}
            className={`h-12 flex-row items-center gap-2 rounded-full border border-white/20 px-4 ${
              isFirst ? "opacity-30" : "active:opacity-70"
            }`}
          >
            <Ionicons name="hand-left-outline" size={18} color={colors.white} />
            <ScalableText className="text-xs font-semibold text-white" maxFontSizeMultiplier={1.3}>
              {t("cook.gesture")}
            </ScalableText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("cook.voiceSim")}
            onPress={goNext}
            className="h-12 flex-row items-center gap-2 rounded-full border border-white/20 px-4 active:opacity-70"
          >
            <Ionicons name="mic-outline" size={18} color={colors.white} />
            <ScalableText className="text-xs font-semibold text-white" maxFontSizeMultiplier={1.3}>
              {t("cook.voice")}
            </ScalableText>
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-3 px-6 pb-6 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("cook.prev")}
          disabled={isFirst}
          onPress={goPrev}
          className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/15 ${
            isFirst ? "opacity-30" : "active:opacity-80"
          }`}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
          <ScalableText className="text-lg font-semibold text-white" maxFontSizeMultiplier={1.3}>
            {t("cook.prev")}
          </ScalableText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? t("cook.finish") : t("cook.next")}
          onPress={goNext}
          className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand active:opacity-80"
        >
          <ScalableText className="text-lg font-semibold text-white" maxFontSizeMultiplier={1.3}>
            {isLast ? t("cook.finish") : t("cook.next")}
          </ScalableText>
          <Ionicons name={isLast ? "checkmark" : "chevron-forward"} size={22} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
