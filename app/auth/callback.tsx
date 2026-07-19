import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { ScalableText } from "@/components/ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { completeAuthFromUrl } from "@/services/authService";

// Landing spot for auth deep links (chiefly the email confirmation link; OAuth is completed inline
// in signInWithProvider). We turn whatever token the URL carries into a session; on success the
// auth listener fires and the route gate takes over. On failure the gate still routes sensibly
// from current state (back to verify-email or sign-in), so this screen never traps the user.
export default function AuthCallbackScreen() {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function handle(url: string | null) {
      if (!url) return;
      const ok = await completeAuthFromUrl(url);
      if (active && !ok) setFailed(true);
    }
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <ActivityIndicator color={colors.brand} />
      <ScalableText className="mt-4 text-center text-base text-ink-muted">
        {failed ? t("auth.callbackFailed") : t("auth.callbackWorking")}
      </ScalableText>
    </View>
  );
}
