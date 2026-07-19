import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { usePantryStore } from "@/stores/pantryStore";
import { CanonicalUnit } from "@/types";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const UNITS: CanonicalUnit[] = ["piece", "g", "ml"];
const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";

export function AddPantryItemSheet({ visible, onClose }: Props) {
  const { t, tl } = useLocale();
  const addItem = usePantryStore((s) => s.addItem);

  const [name, setName] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<CanonicalUnit>("piece");

  const unitLabel = (u: CanonicalUnit) =>
    u === "piece" ? tl("Piece", "件") : u === "g" ? tl("Grams", "克") : tl("ml", "毫升");

  function reset() {
    setName("");
    setNameZh("");
    setQuantity("");
    setUnit("piece");
  }

  function save() {
    const en = name.trim();
    const zh = nameZh.trim();
    if (!en && !zh) return;
    addItem({
      name: en || zh,
      nameZh: zh || en,
      quantity: Number(quantity) || 0,
      unit,
      inStock: true,
    });
    reset();
    onClose();
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={close}
        />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3">
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-4 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("pantry.add")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={close}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          <View className="gap-3">
            <TextInput
              className={INPUT}
              value={name}
              onChangeText={setName}
              placeholder={tl("Name (English)", "名稱（英文）")}
              placeholderTextColor={colors.inkFaint}
            />
            <TextInput
              className={INPUT}
              value={nameZh}
              onChangeText={setNameZh}
              placeholder={tl("Name (中文)", "名稱（中文）")}
              placeholderTextColor={colors.inkFaint}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                  {t("log.quantity")}
                </ScalableText>
                <TextInput
                  className={INPUT}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.inkFaint}
                />
              </View>
              <View className="flex-[2]">
                <ScalableText className="mb-1 text-xs font-semibold text-ink-muted">
                  {t("recipes.units")}
                </ScalableText>
                <View className="flex-row gap-2">
                  {UNITS.map((u) => {
                    const active = u === unit;
                    return (
                      <Pressable
                        key={u}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setUnit(u)}
                        className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                          active ? "bg-ink" : "bg-surface-sunken"
                        }`}
                      >
                        <ScalableText
                          className={`text-sm font-semibold ${active ? "text-white" : "text-ink-muted"}`}
                        >
                          {unitLabel(u)}
                        </ScalableText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <Button label={t("common.save")} icon="checkmark" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
