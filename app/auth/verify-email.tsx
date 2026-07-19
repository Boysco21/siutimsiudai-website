import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAuthStore } from "@/stores/authStore";
import { resendVerification, signInWithEmail } from "@/services/authService";

// The verification wall for email/password signups. There is no session yet (Supabase withholds
// it until the link is clicked), so we cannot poll getUser(). Instead the primary action retries
// sign-in with the stored credentials: it fails with "not confirmed" until the link is clicked,
// then succeeds and the route gate moves the user on to profile setup. If the emailed link deep
// links back into the app, app/auth/callback.tsx establishes the session automatically instead.
export default function VerifyEmailScreen() {
  const { t } = useLocale();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const pendingPassword = useAuthStore((s) => s.pendingPassword);
  const clearPending = useAuthStore((s) => s.clearPending);

  const [busy, setBusy] = useState<null | "check" | "resend">(null);
  const [notYet, setNotYet] = useState(false);
  const [resent, setResent] = useState(false);

  async function check() {
    if (!pendingEmail || !pendingPassword) return;
    setBusy("check");
    setNotYet(false);
    setResent(false);
    const res = await signInWithEmail(pendingEmail, pendingPassword);
    setBusy(null);
    // Success clears pending inside authStore.applySession and the gate advances. A failure here
    // almost always means the address is not confirmed yet.
    if (!res.ok) setNotYet(true);
  }

  async function resend() {
    if (!pendingEmail) return;
    setBusy("resend");
    setNotYet(false);
    const res = await resendVerification(pendingEmail);
    setBusy(null);
    setResent(res.ok);
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="flex-1 justify-center px-6">
        <View className="items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-surface-sunken">
            <Ionicons name="mail-unread" size={30} color={colors.brand} />
          </View>
          <ScalableText className="text-2xl font-bold text-ink">{t("verify.title")}</ScalableText>
          <ScalableText className="mt-2 text-center text-base leading-6 text-ink-muted">
            {t("verify.body", { email: pendingEmail ?? "" })}
          </ScalableText>
        </View>

        {notYet && (
          <View className="mt-5 flex-row items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2.5">
            <Ionicons name="time" size={18} color={colors.inkMuted} />
            <ScalableText className="flex-1 text-sm text-ink-muted">{t("verify.notYet")}</ScalableText>
          </View>
        )}
        {resent && (
          <View className="mt-5 flex-row items-start gap-2 rounded-xl bg-[#E7F4EC] px-3 py-2.5">
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <ScalableText className="flex-1 text-sm text-ink">{t("verify.resent")}</ScalableText>
          </View>
        )}

        <View className="mt-8 gap-2.5">
          <Button
            label={t("verify.checkButton")}
            icon="checkmark-circle-outline"
            onPress={check}
            loading={busy === "check"}
            disabled={busy !== null}
          />
          <Button
            label={t("verify.resend")}
            icon="mail-outline"
            variant="secondary"
            onPress={resend}
            loading={busy === "resend"}
            disabled={busy !== null}
          />
          <Button
            label={t("verify.changeEmail")}
            variant="ghost"
            onPress={clearPending}
            disabled={busy !== null}
          />
        </View>
      </View>
    </Screen>
  );
}
