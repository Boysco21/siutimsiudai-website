import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useRecipeStore } from "@/stores/recipeStore";
import { usePantryStore } from "@/stores/pantryStore";
import { useGroceryStore } from "@/stores/groceryStore";

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Pick recipes; the store merges their ingredients (bilingual dedupe) and deducts pantry stock.
export function GroceryCompileSheet({ visible, onClose }: Props) {
  const { t, tl } = useLocale();
  const recipes = useRecipeStore((s) => s.recipes);
  const pantryItems = usePantryStore((s) => s.items);
  const compile = useGroceryStore((s) => s.compileFromRecipes);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  function build() {
    if (selected.length === 0) return;
    compile(selected, recipes, pantryItems);
    setSelected([]);
    onClose();
  }

  function close() {
    setSelected([]);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={close}
        />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "80%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-3 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("grocery.select")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={close}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          {recipes.length === 0 ? (
            <View className="items-center gap-2 py-8">
              <Ionicons name="book-outline" size={28} color={colors.inkFaint} />
              <ScalableText className="text-sm text-ink-muted">{t("recipes.empty")}</ScalableText>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
              {recipes.map((r) => {
                const active = selected.includes(r.id);
                return (
                  <Pressable
                    key={r.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggle(r.id)}
                    className="flex-row items-center gap-3 border-b border-[#E8E1D2] py-3 active:opacity-70"
                  >
                    <Ionicons
                      name={active ? "checkbox" : "square-outline"}
                      size={24}
                      color={active ? colors.brand : colors.inkFaint}
                    />
                    <View className="flex-1">
                      <ScalableText className="text-base font-semibold text-ink">
                        {tl(r.title, r.titleZh)}
                      </ScalableText>
                      <ScalableText className="text-xs text-ink-muted">
                        {r.ingredients.length} {t("recipes.ingredients")}
                      </ScalableText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Button
            label={t("grocery.build")}
            icon="cart-outline"
            disabled={selected.length === 0}
            onPress={build}
          />
        </View>
      </View>
    </Modal>
  );
}
