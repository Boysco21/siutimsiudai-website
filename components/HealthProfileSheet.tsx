import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { HealthProfileForm, HEALTH_DEFAULTS } from "./HealthProfileForm";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { normalizeHealthProfile } from "@/utils/nutritionTargets";
import { HealthProfile } from "@/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  initial: HealthProfile | null;
  onSaved: (profile: HealthProfile) => void;
}

export function HealthProfileSheet({ visible, onClose, initial, onSaved }: Props) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<HealthProfile>(initial ?? HEALTH_DEFAULTS);

  function save() {
    onSaved(normalizeHealthProfile(draft));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={onClose}
        />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "92%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-3 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">{t("health.title")}</ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Remount on open so the form re-seeds from the saved profile and a cancelled edit
                doesn't linger. */}
            <HealthProfileForm key={String(visible)} initial={initial} onChange={setDraft} />
            <View className="mt-4">
              <Button label={t("common.save")} icon="checkmark" onPress={save} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
