import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAuthStore } from "@/stores/authStore";
import { useFamilyStore } from "@/stores/familyStore";
import { acceptFamilyInvite, previewFamilyInvite } from "@/services/familyService";
import { acceptReasonKey } from "@/utils/familyInvite";

type Phase = "loading" | "needsAuth" | "confirm" | "working" | "done" | "error";

/**
 * The "pending final confirmation" step of family linking (HA Go's Carer flow). We resolve the invite
 * by token, show WHO is inviting before the user commits, and only link the accounts on an explicit
 * tap. A signed-out user is asked to authenticate first; useInviteDeepLink stashes the token so the
 * flow resumes here after sign-in. Every outcome is a plain, trustworthy message (no takeout voice).
 */
export function AcceptInvitationScreen({ token }: { token: string }) {
  const { t, tl } = useLocale();
  const signedIn = useAuthStore((s) => s.session !== null);
  const emailVerified = useAuthStore((s) => !!s.user?.email_confirmed_at);
  const setPendingInviteToken = useFamilyStore((s) => s.setPendingInviteToken);
  const refreshFamily = useFamilyStore((s) => s.refresh);

  const [phase, setPhase] = useState<Phase>("loading");
  const [inviter, setInviter] = useState("");
  const [errorKey, setErrorKey] = useState("family.errAcceptGeneric");

  const genericInviter = tl("your family manager", "你嘅家人");

  useEffect(() => {
    let active = true;
    // Not fully signed in yet: stash the token and ask the user to authenticate. The route gate also
    // carries them through sign-in, and useInviteDeepLink brings them back here afterwards.
    if (!signedIn || !emailVerified) {
      setPendingInviteToken(token);
      setPhase("needsAuth");
      return;
    }
    (async () => {
      setPhase("loading");
      const res = await previewFamilyInvite(token);
      if (!active) return;
      if (!res.ok) {
        if (res.reason === "not_authenticated") {
          setPendingInviteToken(token);
          setPhase("needsAuth");
        } else {
          setErrorKey(res.reason === "invalid" ? "family.errInvalid" : "family.errAcceptGeneric");
          setPhase("error");
        }
        return;
      }
      setInviter(res.inviterName || genericInviter);
      if (res.canAccept) {
        setPhase("confirm");
      } else {
        // Resolved but not acceptable: say precisely why.
        const key =
          res.status === "accepted"
            ? "family.errAlreadyUsed"
            : res.expired || res.status === "expired"
              ? "family.errExpired"
              : "family.errInvalid";
        setErrorKey(key);
        setPhase("error");
      }
    })();
    return () => {
      active = false;
    };
    // genericInviter is derived from locale; re-resolving on locale change is harmless.
  }, [token, signedIn, emailVerified, setPendingInviteToken, genericInviter]);

  const finish = useCallback(() => {
    setPendingInviteToken(null);
    router.replace("/(tabs)");
  }, [setPendingInviteToken]);

  async function onAccept() {
    setPhase("working");
    const res = await acceptFamilyInvite(token);
    if (res.ok) {
      setInviter(res.inviterName || inviter || genericInviter);
      setPendingInviteToken(null);
      refreshFamily().catch(() => {});
      setPhase("done");
    } else if (res.reason === "not_authenticated") {
      setPendingInviteToken(token);
      setPhase("needsAuth");
    } else {
      setErrorKey(acceptReasonKey(res.reason));
      setPhase("error");
    }
  }

  function goSignIn() {
    setPendingInviteToken(token);
    router.replace("/auth/sign-in");
  }

  // --- Presentation -------------------------------------------------------------------------
  if (phase === "loading" || phase === "working") {
    return (
      <Screen edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator color={colors.brand} />
          <ScalableText className="mt-4 text-center text-base text-ink-muted">
            {t(phase === "working" ? "family.acceptWorking" : "family.acceptLoading")}
          </ScalableText>
        </View>
      </Screen>
    );
  }

  interface Content {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    title: string;
    body: string;
    primary?: { label: string; onPress: () => void };
    secondary?: { label: string; onPress: () => void };
  }

  let content: Content;
  if (phase === "needsAuth") {
    content = {
      icon: "person-circle-outline",
      iconColor: colors.brand,
      iconBg: "#F5EBE0",
      title: t("family.signInToAccept"),
      body: t("family.signInToAcceptBody"),
      primary: { label: t("family.signInToAccept"), onPress: goSignIn },
      secondary: { label: t("family.decline"), onPress: finish },
    };
  } else if (phase === "confirm") {
    content = {
      icon: "people",
      iconColor: colors.brand,
      iconBg: "#F5EBE0",
      title: t("family.acceptTitle"),
      body: t("family.acceptBody", { inviter }),
      primary: { label: t("family.acceptCta"), onPress: onAccept },
      secondary: { label: t("family.decline"), onPress: finish },
    };
  } else if (phase === "done") {
    content = {
      icon: "checkmark-circle",
      iconColor: colors.jade,
      iconBg: "#E3F1E6",
      title: t("family.acceptedTitle"),
      body: t("family.accepted", { inviter }),
      primary: { label: t("family.done"), onPress: finish },
    };
  } else {
    content = {
      icon: "alert-circle-outline",
      iconColor: "#C2554B",
      iconBg: "#F6E4E1",
      title: t("family.acceptTitle"),
      body: t(errorKey),
      primary: { label: t("family.done"), onPress: finish },
    };
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-surface p-6">
          <View
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: content.iconBg }}
          >
            <Ionicons name={content.icon} size={30} color={content.iconColor} />
          </View>
          <ScalableText className="text-center text-xl font-bold text-ink">
            {content.title}
          </ScalableText>
          <ScalableText className="text-center text-sm leading-5 text-ink-muted">
            {content.body}
          </ScalableText>
          <View className="mt-2 w-full gap-2">
            {content.primary ? (
              <Button label={content.primary.label} onPress={content.primary.onPress} />
            ) : null}
            {content.secondary ? (
              <Button
                label={content.secondary.label}
                variant="ghost"
                onPress={content.secondary.onPress}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Screen>
  );
}
