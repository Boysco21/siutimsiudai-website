import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { pantryVisionService } from "@/services/pantryVisionService";
import { usePantryScanStore } from "@/stores/pantryScanStore";

// Custom in-app camera for the AI pantry scanner. Uses expo-camera's CameraView (works in Expo Go,
// no dev build needed) rather than the OS image picker, so scanning feels like one seamless flow.
// The capture is sent to pantryVisionService (server-side Claude vision, or the on-device mock in
// Expo Go) and the guesses are handed to the review screen for editing — nothing saves from here.
export default function PantryScanScreen() {
  const { t } = useLocale();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const setDraft = usePantryScanStore((s) => s.setDraft);

  const [scanning, setScanning] = useState(false);

  async function capture() {
    if (scanning || !cameraRef.current) return;
    setScanning(true);
    try {
      // Low quality + base64 keeps the payload small enough for the Edge Function round-trip; the
      // vision model only needs to recognise ingredients, not read fine print.
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      const items = await pantryVisionService.scan(photo?.base64 ?? "");
      setDraft(items);
      // replace (not push) so Back from the review screen returns to the Pantry tab, not the camera.
      router.replace("/pantry-review");
    } catch {
      // Capture or scan failed: drop back to a usable camera so the user can simply try again.
      setScanning(false);
    }
  }

  // Permission still loading (null on first mount).
  if (!permission) {
    return <View className="flex-1 bg-charcoal" />;
  }

  // Not granted yet: a plain, on-brand request screen instead of a black camera.
  if (!permission.granted) {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
        <View className="flex-row justify-end px-2 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center"
          >
            <Ionicons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-sunken">
            <Ionicons name="camera-outline" size={30} color={colors.brand} />
          </View>
          <ScalableText className="text-center text-xl font-bold text-ink">
            {t("pantryScan.permissionTitle")}
          </ScalableText>
          <ScalableText className="text-center text-sm leading-5 text-ink-muted">
            {t("pantryScan.permissionBody")}
          </ScalableText>
          <View className="mt-2 w-full">
            <Button label={t("pantryScan.grant")} icon="camera" onPress={requestPermission} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Controls float above the live preview. */}
      <SafeAreaView edges={["top", "bottom"]} className="absolute inset-0 justify-between">
        <View className="flex-row items-start justify-between p-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <View className="flex-1 items-center px-3">
            <ScalableText className="text-center text-base font-bold text-white">
              {t("pantryScan.title")}
            </ScalableText>
            <ScalableText className="text-center text-xs text-white/80">
              {t("pantryScan.hint")}
            </ScalableText>
          </View>
          {/* Spacer to balance the close button so the title stays centred. */}
          <View className="h-11 w-11" />
        </View>

        <View className="items-center pb-6">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("pantryScan.capture")}
            accessibilityState={{ disabled: scanning }}
            onPress={capture}
            disabled={scanning}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-white/30 active:opacity-70"
          >
            {scanning ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View className="h-14 w-14 rounded-full bg-white" />
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Full-screen "reading your ingredients" veil while the AI works. */}
      {scanning && (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-black/60">
          <ActivityIndicator size="large" color={colors.white} />
          <ScalableText className="text-base font-semibold text-white">
            {t("pantryScan.scanning")}
          </ScalableText>
        </View>
      )}
    </View>
  );
}
