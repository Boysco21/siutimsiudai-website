import { useCallback, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  checkPasswordRules,
  signInSchema,
  signUpSchema,
  type PasswordRuleKey,
  type SignUpValues,
} from "@/utils/passwordSchema";
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

// A met rule reads green; an unmet one stays faint. Literal hex mirrors the existing screen style
// (the error banner already uses "#C0392B"), since the theme has no dedicated success token.
const RULE_MET = "#2E7D32";

// zod message keys (from utils/passwordSchema) -> localized copy.
const FIELD_ERROR_KEYS: Record<string, string> = {
  email_invalid: "auth.errEmailInvalid",
  password_required: "auth.errPasswordRequired",
  password_weak: "auth.errPasswordWeak",
};

// Password-rule keys -> localized checklist labels.
const RULE_LABEL_KEYS: Record<PasswordRuleKey, string> = {
  length: "auth.pwRuleLength",
  upper: "auth.pwRuleUpper",
  lower: "auth.pwRuleLower",
  number: "auth.pwRuleNumber",
  symbol: "auth.pwRuleSymbol",
};

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
//
// Validation runs through React Hook Form + zod (utils/passwordSchema). Sign-UP enforces the strong
// rules (>= 8 chars, upper, lower, number, symbol) and shows a live checklist; sign-IN validates
// shape only, so an existing account created before the rule is never locked out at the door.
export default function SignInScreen() {
  const { t } = useLocale();
  const setPending = useAuthStore((s) => s.setPending);
  const resetTierForNewAccount = useSubscriptionStore((s) => s.resetTierForNewAccount);

  const [mode, setMode] = useState<Mode>("signIn");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";
  const anyBusy = busy !== null;

  // The active schema depends on mode. A ref keeps the resolver identity stable across renders while
  // still reading the latest mode at validation time, so we never rebuild the form on every toggle.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const resolver = useCallback<Resolver<SignUpValues>>(
    (values, context, options) =>
      zodResolver(modeRef.current === "signUp" ? signUpSchema : signInSchema)(values, context, options),
    [],
  );

  const {
    control,
    handleSubmit,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<SignUpValues>({
    defaultValues: { email: "", password: "" },
    resolver,
    mode: "onTouched",
  });

  const passwordValue = watch("password") ?? "";
  const rules = useMemo(() => checkPasswordRules(passwordValue), [passwordValue]);

  const localizedFieldError = (name: keyof SignUpValues): string | null => {
    const raw = errors[name]?.message;
    if (!raw) return null;
    const key = FIELD_ERROR_KEYS[raw] ?? "auth.errGeneric";
    return t(key);
  };

  async function onValid(values: SignUpValues) {
    setServerError(null);
    setBusy("email");
    const email = values.email.trim();
    const res = isSignUp
      ? await signUpWithEmail(email, values.password)
      : await signInWithEmail(email, values.password);
    setBusy(null);

    if (!res.ok) {
      setServerError(t(errorKey(res.error)));
      return;
    }

    if (isSignUp) {
      // A newly created account always starts on the Free plan. Reset the local tier mirror right
      // now so a shared device (or a leftover simulated-checkout purchase) can't show the new user
      // a paid plan. If they genuinely own an entitlement, RevenueCat restores it on the next sync.
      resetTierForNewAccount();
      if (res.needsVerification) {
        // Keep the credentials so the verify screen can retry sign-in after the user confirms.
        setPending(email, values.password);
        return;
      }
    }
    // Otherwise a session now exists and the route gate advances on its own.
  }

  async function oauth(provider: OAuthProvider) {
    setServerError(null);
    setBusy(provider);
    const res = await signInWithProvider(provider);
    setBusy(null);
    // A user-cancelled browser sheet is not an error worth showing.
    if (!res.ok && res.error !== "cancelled") setServerError(t(errorKey(res.error)));
  }

  function switchMode() {
    setMode(isSignUp ? "signIn" : "signUp");
    setServerError(null);
    // Drop any field errors so a strong-rule failure from sign-up doesn't linger into sign-in.
    clearErrors();
  }

  const emailError = localizedFieldError("email");
  const passwordError = localizedFieldError("password");

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
              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className={INPUT}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t("auth.emailPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!anyBusy}
                  />
                )}
              />
              {emailError && (
                <ScalableText className="px-1 text-xs text-[#C0392B]">{emailError}</ScalableText>
              )}
            </View>

            <View className="gap-1.5">
              <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
                {t("auth.passwordLabel")}
              </ScalableText>
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <View className="flex-row items-center">
                    <TextInput
                      className={`${INPUT} flex-1 pr-11`}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
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
                )}
              />

              {/* Live strength checklist: sign-up only. Guides the user to a valid password before
                  they submit, instead of bouncing them off a single error after the fact. */}
              {isSignUp && (
                <View
                  accessibilityRole="summary"
                  className="mt-1 gap-1 rounded-xl bg-surface-sunken px-3 py-2.5"
                >
                  <ScalableText className="text-xs font-semibold text-ink-muted">
                    {t("auth.passwordChecklistTitle")}
                  </ScalableText>
                  {rules.map((rule) => (
                    <View key={rule.key} className="flex-row items-center gap-2">
                      <Ionicons
                        name={rule.met ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={rule.met ? RULE_MET : colors.inkFaint}
                      />
                      <ScalableText
                        className={`text-xs ${rule.met ? "text-ink-muted" : "text-ink-faint"}`}
                      >
                        {t(RULE_LABEL_KEYS[rule.key])}
                      </ScalableText>
                    </View>
                  ))}
                </View>
              )}

              {passwordError && (
                <ScalableText className="px-1 text-xs text-[#C0392B]">{passwordError}</ScalableText>
              )}
            </View>

            {serverError && (
              <View className="flex-row items-start gap-2 rounded-xl bg-[#FBEAE7] px-3 py-2.5">
                <Ionicons name="alert-circle" size={18} color="#C0392B" />
                <ScalableText className="flex-1 text-sm text-[#C0392B]">{serverError}</ScalableText>
              </View>
            )}

            <Button
              label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
              onPress={handleSubmit(onValid)}
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
