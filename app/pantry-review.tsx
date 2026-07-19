import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScalableText } from "@/components/ScalableText";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { usePantryStore } from "@/stores/pantryStore";
import { usePantryScanStore } from "@/stores/pantryScanStore";
import { syncPantryItemsToCloud } from "@/services/pantrySyncService";
import { newId } from "@/utils/id";
import { CanonicalUnit } from "@/types";

const INPUT = "rounded-xl border border-[#E4DCCB] bg-surface px-3 py-2 text-base text-ink";
const UNITS: CanonicalUnit[] = ["piece", "g", "ml"];

// A local, editable copy of one scanned row. quantity is kept as a string so the numeric field
// edits cleanly; `key` is a stable id for React and per-row updates. `confidence` (present only on
// AI guesses, not hand-added rows) drives the "AI guess" badge.
interface EditableRow {
  key: string;
  name: string;
  nameZh: string;
  quantity: string;
  unit: CanonicalUnit;
  confidence?: number;
}

/**
 * The mandatory "Review & Edit" intercept between the AI scan and the database. AI misreads, so
 * nothing the camera produced is saved until the user has seen it here and tapped Confirm: they can
 * fix names, correct quantities/units, delete wrong rows, and add anything the scan missed. Only
 * then does the confirmed basket land in the local pantry (and mirror to Supabase when signed in).
 */
export default function PantryReviewScreen() {
  const { t, tl, locale } = useLocale();
  const addManyItems = usePantryStore((s) => s.addManyItems);
  const clearDraft = usePantryScanStore((s) => s.clearDraft);

  // Snapshot the hand-off draft once into editable local state. Read via getState (not a selector)
  // so later edits here never fight the store; the draft is cleared on confirm/cancel.
  const [rows, setRows] = useState<EditableRow[]>(() =>
    usePantryScanStore.getState().draft.map((it) => ({
      key: newId("row"),
      name: it.name,
      nameZh: it.nameZh,
      quantity: it.quantity > 0 ? String(it.quantity) : "",
      unit: it.unit,
      confidence: it.confidence,
    })),
  );
  const [saving, setSaving] = useState(false);

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function deleteRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: newId("row"), name: "", nameZh: "", quantity: "", unit: "piece" }]);
  }

  // Rows the user actually gave a name (in either language). Empty rows are ignored on save.
  const named = rows.filter((r) => r.name.trim() || r.nameZh.trim());

  async function confirm() {
    if (saving || named.length === 0) return;
    setSaving(true);
    const inputs = named.map((r) => {
      const en = r.name.trim();
      const zh = r.nameZh.trim();
      return {
        // Fill the missing side from the one we have, so no pantry row is half-blank.
        name: en || zh,
        nameZh: zh || en,
        quantity: Number(r.quantity) || 0,
        unit: r.unit,
        inStock: true,
      };
    });
    // Local write is the source of truth and always succeeds; the cloud mirror is best-effort.
    const created = addManyItems(inputs);
    await syncPantryItemsToCloud(created);
    clearDraft();
    router.back(); // returns to the Pantry tab (the camera was replaced by this screen)
  }

  function cancel() {
    clearDraft();
    router.back();
  }

  const unitLabel = (u: CanonicalUnit) =>
    u === "piece" ? tl("pc", "件") : u === "g" ? tl("g", "克") : tl("ml", "毫升");

  return (
    <Screen>
      <View className="flex-row items-center justify-between border-b border-[#E4DCCB] px-3 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={cancel}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="close" size={24} color={colors.inkMuted} />
        </Pressable>
        <ScalableText className="text-base font-bold text-ink">{t("pantryReview.title")}</ScalableText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("pantryReview.add")}
          onPress={addRow}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="add" size={26} color={colors.brand} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
          <ScalableText className="px-1 text-sm leading-5 text-ink-muted">
            {t("pantryReview.subtitle")}
          </ScalableText>

          {rows.length === 0 ? (
            <View className="items-center gap-3 rounded-2xl border border-[#E4DCCB] bg-surface px-4 py-10">
              <Ionicons name="scan-outline" size={30} color={colors.inkFaint} />
              <ScalableText className="text-center text-sm text-ink-muted">
                {t("pantryReview.empty")}
              </ScalableText>
              <Button label={t("pantryReview.add")} icon="add" variant="secondary" onPress={addRow} />
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.key} className="gap-2 rounded-2xl border border-[#E4DCCB] bg-surface p-3">
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className={`${INPUT} flex-1`}
                    value={locale === "zh-Hant" ? row.nameZh : row.name}
                    onChangeText={(v) =>
                      updateRow(row.key, locale === "zh-Hant" ? { nameZh: v } : { name: v })
                    }
                    placeholder={tl("Ingredient name", "食材名稱")}
                    placeholderTextColor={colors.inkFaint}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.delete")}
                    onPress={() => deleteRow(row.key)}
                    className="h-11 w-11 items-center justify-center rounded-xl bg-surface-sunken active:opacity-70"
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.inkMuted} />
                  </Pressable>
                </View>

                <View className="flex-row items-center gap-2">
                  <TextInput
                    className={`${INPUT} w-24`}
                    value={row.quantity}
                    onChangeText={(v) => updateRow(row.key, { quantity: v })}
                    keyboardType="number-pad"
                    placeholder={t("log.quantity")}
                    placeholderTextColor={colors.inkFaint}
                  />
                  <View className="flex-1 flex-row gap-1.5">
                    {UNITS.map((u) => {
                      const active = u === row.unit;
                      return (
                        <Pressable
                          key={u}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => updateRow(row.key, { unit: u })}
                          className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                            active ? "bg-ink" : "bg-surface-sunken"
                          }`}
                        >
                          <ScalableText
                            className={`text-xs font-semibold ${active ? "text-white" : "text-ink-muted"}`}
                          >
                            {unitLabel(u)}
                          </ScalableText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {row.confidence !== undefined && (
                  <View className="flex-row items-center gap-1 self-start rounded-full bg-surface-sunken px-2 py-0.5">
                    <Ionicons name="sparkles-outline" size={11} color={colors.inkMuted} />
                    <ScalableText className="text-xs font-medium text-ink-muted">
                      {t("pantryReview.aiGuess")} · {Math.round(row.confidence * 100)}%
                    </ScalableText>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <View className="border-t border-[#E4DCCB] bg-surface-subtle px-4 pb-6 pt-3">
          <Button
            label={t("pantryReview.confirm", { count: named.length })}
            icon="checkmark"
            loading={saving}
            disabled={named.length === 0}
            onPress={confirm}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
