import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { substitutionService } from "@/services";
import { useRecipeStore } from "@/stores/recipeStore";
import { RecipeIngredient, Substitution } from "@/types";

interface Props {
  visible: boolean;
  recipeId: string;
  ingredient: RecipeIngredient | null;
  onClose: () => void;
}

// Lists HK-supermarket swaps for an ingredient. Applying one patches the affected step text
// via recipeStore.applySubstitution so the instructions stay coherent.
export function SubstitutionSheet({ visible, recipeId, ingredient, onClose }: Props) {
  const { t, tl } = useLocale();
  const applySubstitution = useRecipeStore((s) => s.applySubstitution);
  const [subs, setSubs] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ingredient) {
      setSubs([]);
      return;
    }
    let active = true;
    setLoading(true);
    substitutionService.suggest(ingredient.name, ingredient.nameZh).then((r) => {
      if (active) {
        setSubs(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [ingredient]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onClose} />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "80%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-1 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("substitute.title")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>
          {ingredient && (
            <ScalableText className="mb-3 text-sm text-ink-muted">
              {t("substitute.missing", { name: tl(ingredient.name, ingredient.nameZh) })}
            </ScalableText>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : subs.length === 0 ? (
              <View className="items-center gap-2 py-8">
                <Ionicons name="sad-outline" size={28} color={colors.inkFaint} />
                <ScalableText className="text-sm text-ink-muted">
                  {tl("No swaps found for this one.", "暫時冇替換建議。")}
                </ScalableText>
              </View>
            ) : (
              <View className="gap-3">
                {subs.map((sub, i) => (
                  <View key={`${sub.substitute}-${i}`} className="gap-2 rounded-2xl border border-[#E4DCCB] p-3">
                    <View className="flex-row items-center justify-between">
                      <ScalableText className="text-base font-bold text-ink">
                        {tl(sub.substitute, sub.substituteZh)}
                      </ScalableText>
                      <View className="rounded-full bg-surface-sunken px-2 py-0.5">
                        <ScalableText className="text-xs font-semibold text-ink-muted">
                          {t("substitute.ratio")} {sub.ratio}
                        </ScalableText>
                      </View>
                    </View>
                    <ScalableText className="text-sm text-ink-muted">
                      {tl(sub.note, sub.noteZh)}
                    </ScalableText>
                    <Button
                      label={t("substitute.apply")}
                      icon="swap-horizontal"
                      onPress={() => {
                        if (ingredient) applySubstitution(recipeId, ingredient.id, sub);
                        onClose();
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
