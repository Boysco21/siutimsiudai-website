import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useFamilyStore } from "@/stores/familyStore";
import {
  createFamilyInvite,
  leaveFamily,
  removeMember,
  revokeInvite,
} from "@/services/familyService";
import { hasActiveMaxEntitlement } from "@/services/revenueCatService";
import { createReasonKey, FAMILY_MAX_MEMBERS, isGroupFull, remainingSeats } from "@/utils/familyInvite";
import type { FamilyInvite, FamilyMember } from "@/types/family";

/**
 * The manager-facing "My Family" screen (HA Go's "My Family" / Carer view). Three states, chosen by
 * the caller's real relationship to a household — never by a value the device could forge:
 *   - dependent: a linked member sees who can manage their logs and a Leave control.
 *   - manager (Max): create + share single-use invite links, see the roster, remove dependents,
 *     and revoke pending invites.
 *   - anyone else: a Max upsell, since minting invites is a Max perk.
 *
 * The Max check here is only a UX gate to keep the paywall honest; the UNSPOOFABLE gate is the
 * create-family-invite Edge Function, which re-verifies Max with the RevenueCat secret server-side.
 */
export function InviteFamilyScreen() {
  const { t, tl } = useLocale();
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const activeTier = useSubscriptionStore((s) => s.activeTier);

  const snapshot = useFamilyStore((s) => s.snapshot);
  const loading = useFamilyStore((s) => s.loading);
  const refresh = useFamilyStore((s) => s.refresh);

  // Local Max mirror. Seeded from the (synchronous) tier mirror so a Max user never flashes the
  // upsell, then OR'd with the SDK's server-validated entitlement on a real build.
  const [sdkMax, setSdkMax] = useState(false);
  const hasMax = activeTier === "max" || sdkMax;

  // Freshly minted invite to surface for sharing, plus the create call's transient state.
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [createErrorKey, setCreateErrorKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Destructive-action dialogs.
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    refresh().catch(() => {});
    hasActiveMaxEntitlement()
      .then((v) => {
        if (v) setSdkMax(true);
      })
      .catch(() => {});
  }, [refresh]);

  const role = snapshot?.role ?? null;
  const members = snapshot?.members ?? [];
  const invitations = snapshot?.invitations ?? [];
  const maxMembers = snapshot?.group?.maxMembers ?? FAMILY_MAX_MEMBERS;
  const groupFull = isGroupFull(members.length, maxMembers);
  const seatsLeft = remainingSeats(members.length, maxMembers);

  const onCreate = useCallback(async () => {
    setCreating(true);
    setCreateErrorKey(null);
    const res = await createFamilyInvite();
    setCreating(false);
    if (res.ok) {
      setInvite(res.invite);
      setSimulated(!!res.simulated);
      refresh().catch(() => {});
    } else {
      setCreateErrorKey(createReasonKey(res.reason));
    }
  }, [refresh]);

  async function onShare() {
    if (!invite) return;
    try {
      await Share.share({ message: invite.url });
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  }

  async function onCopy() {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function confirmRemove() {
    const target = removeTarget;
    setRemoveTarget(null);
    if (!target) return;
    await removeMember(target.userId);
    refresh().catch(() => {});
  }

  async function onRevoke(id: string) {
    await revokeInvite(id);
    refresh().catch(() => {});
  }

  async function confirmLeave() {
    setLeaveOpen(false);
    await leaveFamily();
    setInvite(null);
    refresh().catch(() => {});
  }

  const memberName = (m: FamilyMember): string =>
    m.userId === uid ? t("family.you") : m.displayName || tl("Family member", "家庭成員");

  const showSpinner = loading && !snapshot;

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-1 px-3 pb-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={tl("Back", "返回")}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <ScalableText className="text-2xl font-bold text-ink">{t("family.title")}</ScalableText>
      </View>

      {showSpinner ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40, gap: 16 }}>
          {role === "dependent" ? (
            // --- Dependent view: a linked member. --------------------------------------------
            <View className="gap-4 rounded-2xl border border-[#E4DCCB] bg-surface p-5">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#E3F1E6" }}
                >
                  <Ionicons name="people" size={24} color={colors.jade} />
                </View>
                <ScalableText className="flex-1 text-lg font-bold text-ink">
                  {tl("You're linked to a family", "你已連結到一個家庭")}
                </ScalableText>
              </View>
              <ScalableText className="text-sm leading-5 text-ink-muted">
                {tl(
                  "A family manager can view and manage your meal logs. You keep your own account and can leave at any time.",
                  "家庭管理者可以查看及管理你嘅飲食記錄。你會保留自己嘅帳戶，並可隨時離開。",
                )}
              </ScalableText>
              <Button
                label={t("family.leave")}
                icon="exit-outline"
                variant="secondary"
                onPress={() => setLeaveOpen(true)}
              />
            </View>
          ) : hasMax ? (
            // --- Manager view: create + manage invites. --------------------------------------
            <>
              <ScalableText className="px-1 text-sm leading-5 text-ink-muted">
                {t("family.subtitle")}
              </ScalableText>

              <View className="gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-4">
                {groupFull ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="information-circle-outline" size={18} color={colors.inkMuted} />
                    <ScalableText className="flex-1 text-sm text-ink-muted">
                      {t("family.errGroupFull")}
                    </ScalableText>
                  </View>
                ) : (
                  <>
                    <Button
                      label={t("family.generate")}
                      icon="link-outline"
                      loading={creating}
                      onPress={() => void onCreate()}
                    />
                    <ScalableText className="text-center text-xs text-ink-faint">
                      {tl(`${seatsLeft} seats left`, `仲有 ${seatsLeft} 個名額`)}
                    </ScalableText>
                  </>
                )}
                {createErrorKey ? (
                  <ScalableText className="text-sm" style={{ color: "#C2554B" }}>
                    {t(createErrorKey)}
                  </ScalableText>
                ) : null}
              </View>

              {invite ? (
                <View className="gap-3 rounded-2xl border border-brand bg-surface p-4">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
                    <ScalableText className="text-base font-bold text-ink">
                      {t("family.linkReady")}
                    </ScalableText>
                  </View>
                  <View className="items-center gap-2 py-1">
                    <View
                      className="rounded-2xl border border-[#E4DCCB] p-3"
                      style={{ backgroundColor: "#FFFFFF" }}
                    >
                      <QRCode
                        value={invite.url}
                        size={180}
                        color={colors.ink}
                        backgroundColor="#FFFFFF"
                      />
                    </View>
                    <ScalableText className="text-xs text-ink-muted">
                      {tl("Scan to accept the invitation", "掃描即可接受邀請")}
                    </ScalableText>
                  </View>
                  <View className="rounded-xl bg-surface-sunken px-3 py-2">
                    <ScalableText className="text-xs text-ink-muted" numberOfLines={2}>
                      {invite.url}
                    </ScalableText>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button label={t("family.share")} icon="share-outline" onPress={() => void onShare()} />
                    </View>
                    <View className="flex-1">
                      <Button
                        label={copied ? t("family.copied") : t("family.copy")}
                        icon={copied ? "checkmark" : "copy-outline"}
                        variant="secondary"
                        onPress={() => void onCopy()}
                      />
                    </View>
                  </View>
                  <ScalableText className="text-xs leading-4 text-ink-faint">
                    {t("family.linkHint")}
                  </ScalableText>
                  {simulated ? (
                    <ScalableText className="text-xs leading-4 text-ink-faint">
                      {tl(
                        "Demo link. Real linking activates once the app is connected to its backend.",
                        "示範連結。應用程式連接到後端後，真正連結功能即會啟用。",
                      )}
                    </ScalableText>
                  ) : null}
                </View>
              ) : null}

              {/* Roster */}
              <View className="gap-2">
                <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
                  {t("family.members")}
                </ScalableText>
                {members.length === 0 ? (
                  <View className="rounded-2xl border border-[#E4DCCB] bg-surface p-4">
                    <ScalableText className="text-sm text-ink-muted">
                      {t("family.membersEmpty")}
                    </ScalableText>
                  </View>
                ) : (
                  members.map((m) => (
                    <View
                      key={m.userId}
                      className="flex-row items-center gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
                        <Ionicons
                          name={m.role === "manager" ? "star" : "person"}
                          size={18}
                          color={colors.inkMuted}
                        />
                      </View>
                      <View className="flex-1">
                        <ScalableText className="text-base font-semibold text-ink" numberOfLines={1}>
                          {memberName(m)}
                        </ScalableText>
                        <ScalableText className="text-xs text-ink-muted">
                          {m.role === "manager" ? t("family.roleManager") : t("family.roleDependent")}
                        </ScalableText>
                      </View>
                      {m.role === "dependent" && m.userId !== uid ? (
                        <Pressable
                          onPress={() => setRemoveTarget(m)}
                          accessibilityRole="button"
                          accessibilityLabel={t("family.remove")}
                          className="min-h-[36px] items-center justify-center rounded-lg px-3 active:opacity-70"
                        >
                          <ScalableText className="text-sm font-semibold" style={{ color: "#C2554B" }}>
                            {t("family.remove")}
                          </ScalableText>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
              </View>

              {/* Pending invitations */}
              {invitations.length > 0 ? (
                <View className="gap-2">
                  <ScalableText className="px-1 text-sm font-semibold text-ink-muted">
                    {t("family.pending")}
                  </ScalableText>
                  {invitations.map((inv) => (
                    <View
                      key={inv.id}
                      className="flex-row items-center gap-3 rounded-2xl border border-[#E4DCCB] bg-surface p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
                        <Ionicons name="mail-outline" size={18} color={colors.inkMuted} />
                      </View>
                      <View className="flex-1">
                        <ScalableText className="text-base font-semibold text-ink" numberOfLines={1}>
                          {inv.inviteeLabel || t("family.pendingOne")}
                        </ScalableText>
                        <ScalableText className="text-xs text-ink-muted">
                          {t("family.pendingOne")}
                        </ScalableText>
                      </View>
                      <Pressable
                        onPress={() => void onRevoke(inv.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t("family.revoke")}
                        className="min-h-[36px] items-center justify-center rounded-lg px-3 active:opacity-70"
                      >
                        <ScalableText className="text-sm font-semibold" style={{ color: "#C2554B" }}>
                          {t("family.revoke")}
                        </ScalableText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            // --- Upsell: minting invites is a Max perk. --------------------------------------
            <View className="gap-4 rounded-2xl border border-accent bg-[#FCF3DD] p-5">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#FBEAC4" }}
                >
                  <Ionicons name="diamond" size={24} color={colors.accentDark} />
                </View>
                <ScalableText className="flex-1 text-lg font-bold text-ink">
                  {t("family.maxOnly")}
                </ScalableText>
              </View>
              <ScalableText className="text-sm leading-5 text-ink-muted">
                {t("family.maxOnlyBody")}
              </ScalableText>
              <Button
                label={t("family.upgrade")}
                icon="sparkles"
                onPress={() => router.push("/subscription")}
              />
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmDialog
        visible={removeTarget !== null}
        title={t("family.removeTitle", { name: removeTarget ? memberName(removeTarget) : "" })}
        message={t("family.removeBody")}
        confirmLabel={t("family.remove")}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
      <ConfirmDialog
        visible={leaveOpen}
        title={t("family.leaveTitle")}
        message={t("family.leaveBody")}
        confirmLabel={t("family.leave")}
        onConfirm={() => void confirmLeave()}
        onCancel={() => setLeaveOpen(false)}
      />
    </Screen>
  );
}
