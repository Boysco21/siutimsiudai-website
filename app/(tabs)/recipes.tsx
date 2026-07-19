import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { RecipeCard } from "@/components/RecipeCard";
import { WeekPlanner } from "@/components/WeekPlanner";
import { AddRecipeSheet } from "@/components/AddRecipeSheet";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useRecipeStore } from "@/stores/recipeStore";

export default function RecipesScreen() {
  const { t, tl } = useLocale();
  const recipes = useRecipeStore((s) => s.recipes);
  const [addOpen, setAddOpen] = useState(false);

  const openRecipe = (id: string) => router.push({ pathname: "/recipe/[id]", params: { id } });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
        <ScalableText className="text-2xl font-bold text-ink">{t("recipes.title")}</ScalableText>

        <WeekPlanner />

        <View className="gap-3">
          <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
            {tl("All recipes", "所有食譜")}
          </ScalableText>
          {recipes.length === 0 ? (
            <View className="items-center gap-2 rounded-2xl border border-dashed border-[#E4DCCB] px-6 py-8">
              <Ionicons name="book-outline" size={28} color={colors.inkFaint} />
              <ScalableText className="text-center text-sm text-ink-muted">
                {t("recipes.empty")}
              </ScalableText>
            </View>
          ) : (
            recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} onPress={() => openRecipe(r.id)} />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("recipes.add")}
        onPress={() => setAddOpen(true)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-80"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>

      <AddRecipeSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(r) => openRecipe(r.id)}
      />
    </Screen>
  );
}
