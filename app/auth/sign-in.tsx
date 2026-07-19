import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { AppleAuthButton, GoogleAuthButton } from "@/components/SocialAuthButtons";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { isSupabaseConfigured } from "@/services/supabase";
import {
  AuthOutcome,
  OAuthProvider,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from "@/services/authService";

type Mode = "signIn" | "signUp";
type Busy = null | "email" | OAuthProvider;

const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3.5 py-3 text-base text-ink";

function errorKey(e: AuthOutcome["error"]): string {
  switch (e) {
    case "invalid_credentials":
      return "auth.errInvalidCredentials";
    case "already_registered":
      return "auth.errAlreadyRegistered";
    case "not_confirmed":
      return "auth.errNotConfirmed";
    case "unavailable":
      return "auth.errUnavailable";
    default:
      return "auth.errGeneric";
  }
}

// The authentication screen. Intentionally plain and professional: no brand humour here, standard
// email/password plus the official Apple and Google buttons. Email signups are handed to the
// verification wall via authStore.pendingEmail; the route gate does the actual navigation.
export default function SignInScreen() {
  const { t } = useLocale();
  const setPending = useAuthStore((s) => s.setPending);
  const resetTierForNewAccount = useSubscriptionStore((s) => s.resetTierForNewAccount);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";
  const anyBusy = busy !== null;

  function validate(): boolean {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.errEmailInvalid"));
      return false;
    }
    if (password.length < 6) {
      setError(t("auth.errPasswordShort"));
      return false;
    }
    return true;
  }

  async function submitEmail() {
    setError(null);
    if (!validate()) return;
    setBusy("email");
    const res = isSignUp
      ? await signUpWithEmail(email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setBusy(null);
    if (!res.ok) {
      setError(t(errorKey(res.error)));
      return;
    }
    if (isSignUp) {
      // A newly created account always starts on the Free plan. Reset the local tier mirror right
      // now so a shared device (or a leftover simulated-checkout purchase) can't show the new user
      // a paid plan. If they genuinely own an entitlement, RevenueCat restores it on the next sync.
      resetTierForNewAccount();
    }
    if (isSignUp && res.needsVerification) {
      // Keep the credentials so the verify screen can retry sign-in after the user confirms.
      setPending(email.trim(), password);
      return;
    }
    // Otherwise a session now exists and the route gate advances on its own.
  }

  async function oauth(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    const res = await signInWithProvider(provider);
    setBusy(null);
    // A user-cancelled browser sheet is not an error worth showing.
    if (!res.ok && res.error !== "cancelled") setError(t(errorKey(res.error)));
  }

  function switchMode() {
    setMode(isSignUp ? "signIn" : "signUp");
    setError(null);
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-ink">
              <Ionicons name="fast-food" size={28} color={colors.white} />
            </View>
            <ScalableText className="text-2xl font-bold text-ink">{t("auth.title")}</ScalableText>
            <ScalableText className="mt-1 text-center text-base text-ink-muted">
              {isSignUp ? t("auth.subtitleSignUp") : t("auth.subtitleSignIn")}
            </ScalableText>
          </View>

          {!isSupabaseConfigured && (
            <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5">
              <Ionicons name="information-circle" size={18} color={colors.inkMuted} />
              <ScalableText className="flex-1 text-xs text-ink-muted">
                {t("auth.previewNotice")}
              </ScalableText>
            </View>
          )}

          <View className="gap-3">
            <AppleAuthButton
              label={t("auth.continueApple")}
              loading={busy === "apple"}
              disabled={anyBusy && busy !== "apple"}
              onPress={() => oauth("apple")}
            />
            <GoogleAuthButton
              label={t("auth.continueGoogle")}
              loading={busy === "google"}
              disabled={anyBusy && busy !== "google"}
              onPress={() => oauth("google")}
            />
          </View>

          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-[#E4DCCB]" />
            <ScalableText className="text-xs font-medium uppercase text-ink-faint">
              {t("auth.or")}
            </ScalableText>
            <View className="h-px flex-1 bg-[#E4DCCB]" />
          </View>

          <View className="gap-4">
            <View className="gap-1.5">
              <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
                {t("auth.emailLabel")}
              </ScalableText>
              <TextInput
                className={INPUT}
                value={email}
                onChangeText={setEmail}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                editable={!anyBusy}
              />
            </View>

            <View className="gap-1.5">
              <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
                {t("auth.passwordLabel")}
              </ScalableText>
              <View className="flex-row items-center">
                <TextInput
                  className={`${INPUT} flex-1 pr-11`}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPw}
                  textContentType={isSignUp ? "newPassword" : "password"}
                  autoComplete={isSignUp ? "password-new" : "password"}
                  editable={!anyBusy}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
                  onPress={() => setShowPw((v) => !v)}
                  className="absolute right-0 h-11 w-11 items-center justify-center"
                >
                  <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.inkMuted} />
                </Pressable>
              </View>
            </View>

            {error && (
              <View className="flex-row items-start gap-2 rounded-xl bg-[#FBEAE7] px-3 py-2.5">
                <Ionicons name="alert-circle" size={18} color="#C0392B" />
                <ScalableText className="flex-1 text-sm text-[#C0392B]">{error}</ScalableText>
              </View>
            )}

            <Button
              label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
              onPress={submitEmail}
              loading={busy === "email"}
              disabled={anyBusy && busy !== "email"}
            />
          </View>

          <View className="mt-6 flex-row items-center justify-center gap-1">
            <ScalableText className="text-sm text-ink-muted">
              {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}
            </ScalableText>
            <Pressable
              accessibilityRole="button"
              onPress={switchMode}
              className="min-h-[44px] justify-center"
              disabled={anyBusy}
            >
              <ScalableText className="text-sm font-bold text-brand">
                {isSignUp ? t("auth.switchToSignIn") : t("auth.switchToSignUp")}
              </ScalableText>
            </Pressable>
          </View>

          <ScalableText className="mt-4 px-4 text-center text-xs leading-5 text-ink-faint">
            {t("auth.legal")}
          </ScalableText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
