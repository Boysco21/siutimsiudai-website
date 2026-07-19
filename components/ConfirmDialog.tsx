import { Modal, Pressable, View } from "react-native";
import { ScalableText } from "./ScalableText";
import { Button } from "./Button";
import { useLocale } from "@/hooks/useLocale";

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A small centred confirm used for destructive actions. Built from our own Modal so it
// behaves the same on web and native (unlike React Native's Alert, which is a no-op on web).
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLocale();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel ?? t("common.cancel")}
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/40 px-8"
      >
        {/* Absorb taps on the card so they don't fall through to the backdrop. */}
        <Pressable onPress={() => {}} className="w-full max-w-md gap-4 rounded-3xl bg-surface p-5">
          <View className="gap-1.5">
            <ScalableText className="text-lg font-bold text-ink">{title}</ScalableText>
            {message ? (
              <ScalableText className="text-sm leading-5 text-ink-muted">{message}</ScalableText>
            ) : null}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label={cancelLabel ?? t("common.cancel")} variant="secondary" onPress={onCancel} />
            </View>
            <View className="flex-1">
              <Button label={confirmLabel} onPress={onConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
