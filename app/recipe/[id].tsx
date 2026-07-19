import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { ServingStepper } from "@/components/ServingStepper";
import { UnitToggle } from "@/components/UnitToggle";
import { IngredientRow } from "@/components/IngredientRow";
import { SubstitutionSheet } from "@/components/SubstitutionSheet";
import { CartExportButton } from "@/components/CartExportButton";
import { CartExportSheet } from "@/components/CartExportSheet";
import { PlanPickerSheet } from "@/components/PlanPickerSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { healthySwapService } from "@/services";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAppStore } from "@/stores/appStore";
import { useRecipeStore } from "@/stores/recipeStore";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { MeasurementSystem, RecipeIngredient } from "@/types";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tl } = useLocale();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const scaleServings = useRecipeStore((s) => s.scaleServings);
  const applyHealthySwaps = useRecipeStore((s) => s.applyHealthySwaps);
  const revertHealthySwaps = useRecipeStore((s) => s.revertHealthySwaps);
  const removeRecipe = useRecipeStore((s) => s.removeRecipe);
  const unassignRecipe = useMealPlanStore((s) => s.unassignRecipe);
  const defaultSystem = useAppStore((s) => s.measurementSystem);
  // Recipe tweaks (the one-tap "Make Healthy" rewrite and per-ingredient swaps) both run the
  // metered AI engine, so they're a Pro perk gated behind the paywall.
  const recipeMod = useFeatureAccess("recipe_modifier");

  const [system, setSystem] = useState<MeasurementSystem>(defaultSystem);
  const [swapTarget, setSwapTarget] = useState<RecipeIngredient | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [healthyLoading, setHealthyLoading] = useState(false);

  // Remove the recipe and any meal-plan assignments that point at it, then leave the now
  // missing detail screen.
  const confirmDelete = () => {
    if (!recipe) return;
    setDeleteOpen(false);
    unassignRecipe(recipe.id);
    removeRecipe(recipe.id);
    router.back();
  };

  // One tap rewrites the whole recipe to healthier swaps (and adjusts quantities); tapping
  // again restores the snapshot. The await covers the Claude fallback in the hybrid engine.
  const toggleHealthy = async () => {
    if (!recipe) return;
    if (recipe.healthyApplied) {
      revertHealthySwaps(recipe.id);
      return;
    }
    // Applying healthier swaps runs the metered AI engine, a Pro perk. Reverting above stays free.
    if (!recipeMod.hasAccess) {
      recipeMod.triggerPaywall();
      return;
    }
    setHealthyLoading(true);
    try {
      const swaps = await healthySwapService.suggest(recipe.ingredients);
      applyHealthySwaps(recipe.id, swaps);
    } finally {
      setHealthyLoading(false);
    }
  };

  if (!recipe) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Ionicons name="sad-outline" size={32} color={colors.inkFaint} />
          <ScalableText className="text-center text-base text-ink-muted">
            {tl("Recipe not found.", "搵唔到食譜。")}
          </ScalableText>
          <Button
            label={t("common.back")}
            icon="arrow-back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center px-2 py-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 120, gap: 16 }}>
        <View className="gap-1">
          <ScalableText className="text-2xl font-bold text-ink">
            {tl(recipe.title, recipe.titleZh)}
          </ScalableText>
          <ScalableText className="text-sm text-ink-muted">
            {tl(recipe.titleZh, recipe.title)}
          </ScalableText>
          <View className="mt-1 flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="people-outline" size={16} color={colors.inkMuted} />
              <ScalableText className="text-sm text-ink-muted">
                {recipe.servings} {t("recipes.servings")}
              </ScalableText>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={16} color={colors.inkMuted} />
              <ScalableText className="text-sm text-ink-muted">
                {tl(`${recipe.totalMinutes} min`, `${recipe.totalMinutes} 分鐘`)}
              </ScalableText>
            </View>
          </View>
        </View>

        <View className="gap-4 rounded-2xl border border-[#E4DCCB] bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <ScalableText className="text-sm font-semibold text-ink-muted">
              {t("recipes.scale")}
            </ScalableText>
            <ServingStepper value={recipe.servings} onChange={(n) => scaleServings(recipe.id, n)} />
          </View>
          <View className="gap-2">
            <ScalableText className="text-sm font-semibold text-ink-muted">
              {t("recipes.units")}
            </ScalableText>
            <UnitToggle value={system} onChange={setSystem} />
          </View>
        </View>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("recipes.ingredients")}
          </ScalableText>

          <Button
            label={recipe.healthyApplied ? t("healthy.showOriginal") : t("healthy.makeHealthy")}
            icon={
              recipe.healthyApplied
                ? "arrow-undo-outline"
                : recipeMod.hasAccess
                  ? "leaf"
                  : "lock-closed"
            }
            variant={recipe.healthyApplied ? "secondary" : "primary"}
            loading={healthyLoading}
            onPress={toggleHealthy}
          />

          {recipe.healthyApplied && (
            <View className="flex-row items-center gap-2 rounded-2xl bg-jade-100 px-3 py-2">
              <Ionicons name="leaf" size={16} color={colors.jade} />
              <ScalableText className="flex-1 text-xs font-medium text-jade">
                {t("healthy.banner")}
              </ScalableText>
            </View>
          )}

          <View className="rounded-2xl border border-[#E4DCCB] bg-surface px-4 py-1">
            {recipe.ingredients.map((ing) => (
              <IngredientRow
                key={ing.id}
                ingredient={ing}
                system={system}
                onSwap={() =>
                  recipeMod.hasAccess ? setSwapTarget(ing) : recipeMod.triggerPaywall()
                }
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {t("recipes.steps")}
          </ScalableText>
          <View className="gap-3">
            {recipe.steps.map((step) => (
              <View
                key={step.id}
                className="flex-row gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-3"
              >
                <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
                  <ScalableText className="text-sm font-bold text-white">
                    {step.stepNumber}
                  </ScalableText>
                </View>
                <View className="flex-1 gap-1">
                  <ScalableText className="text-base leading-relaxed text-ink">
                    {tl(step.instruction, step.instructionZh)}
                  </ScalableText>
                  {step.durationSeconds != null && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="timer-outline" size={14} color={colors.inkMuted} />
                      <ScalableText className="text-xs text-ink-muted">
                        {Math.round(step.durationSeconds / 60)} {tl("min", "分鐘")}
                      </ScalableText>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <CartExportButton onPress={() => setCartOpen(true)} />
          <Button
            label={t("recipes.cook")}
            icon="flame"
            onPress={() => router.push({ pathname: "/cook/[id]", params: { id: recipe.id } })}
          />
          <Button
            label={t("recipes.planAdd")}
            icon="calendar-outline"
            variant="secondary"
            onPress={() => setPlanOpen(true)}
          />
          <Button
            label={t("recipes.delete")}
            icon="trash-outline"
            variant="ghost"
            onPress={() => setDeleteOpen(true)}
          />
        </View>
      </ScrollView>

      <SubstitutionSheet
        visible={!!swapTarget}
        recipeId={recipe.id}
        ingredient={swapTarget}
        onClose={() => setSwapTarget(null)}
      />
      <CartExportSheet visible={cartOpen} recipe={recipe} onClose={() => setCartOpen(false)} />
      <PlanPickerSheet visible={planOpen} recipeId={recipe.id} onClose={() => setPlanOpen(false)} />
      <ConfirmDialog
        visible={deleteOpen}
        title={t("recipes.deleteTitle")}
        message={t("recipes.deleteBody", { name: tl(recipe.title, recipe.titleZh) })}
        confirmLabel={t("common.delete")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}
