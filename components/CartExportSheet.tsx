import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { cartExportService } from "@/services";
import { usePantryStore } from "@/stores/pantryStore";
import { missingItemsFromRecipe } from "@/utils/cartExport";
import { RETAILERS } from "@/constants/retailers";
import { tapLight } from "@/utils/haptics";
import { GroceryRetailer, Recipe, StoreAvailability } from "@/types";

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}

// Try the native app deep link first (guarded so we never throw on an uninstalled app), fall back to
// the web results page. Best-effort: the clipboard already holds the full list, so a failed open
// still leaves the shopper ready to paste.
async function openStore(deepLinkUrl: string, webUrl: string) {
  try {
    if (deepLinkUrl !== webUrl && (await Linking.canOpenURL(deepLinkUrl))) {
      await Linking.openURL(deepLinkUrl);
      return;
    }
    await Linking.openURL(webUrl);
  } catch {
    // The store wouldn't open; the list is already on the clipboard regardless.
  }
}

// The Max-only comparison modal. Reads the recipe's still-missing ingredients (pantry-aware),
// checks each retailer's mock catalogue, and lets the shopper tap a store to copy the full list in
// that store's language and jump straight to its search. Matches SubstitutionSheet's bottom-sheet
// styling for consistency.
export function CartExportSheet({ visible, recipe, onClose }: Props) {
  const { tl } = useLocale();
  const pantry = usePantryStore((s) => s.items);
  const missing = useMemo(() => missingItemsFromRecipe(recipe, pantry), [recipe, pantry]);

  const [availability, setAvailability] = useState<StoreAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<GroceryRetailer | null>(null);

  useEffect(() => {
    if (!visible || missing.length === 0) {
      setAvailability([]);
      return;
    }
    let active = true;
    setLoading(true);
    cartExportService.checkAvailability(missing).then((res) => {
      if (active) {
        setAvailability(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [visible, missing]);

  // The widest catalogue in this run drives the "Best match" flag. Guarded so an all-zero run (or
  // the loading gap) never lights every row up.
  const bestFound = availability.reduce((max, a) => Math.max(max, a.foundCount), 0);

  const handleExport = async (retailer: GroceryRetailer) => {
    setExporting(retailer);
    try {
      const payload = cartExportService.buildExport(retailer, missing);
      await Clipboard.setStringAsync(payload.clipboardText);
      await openStore(payload.deepLinkUrl, payload.webUrl);
      tapLight();
      onClose();
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={tl("Close", "閂咗佢")}
          onPress={onClose}
        />
        <View className="rounded-t-3xl bg-surface px-4 pb-8 pt-3" style={{ maxHeight: "80%" }}>
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-surface-sunken" />
          <View className="mb-1 flex-row items-center justify-between">
            <ScalableText className="text-xl font-bold text-ink">
              {tl("Buy missing ingredients", "買齊欠缺食材")}
            </ScalableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tl("Close", "閂咗佢")}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </Pressable>
          </View>

          {missing.length > 0 && (
            <ScalableText className="mb-3 text-sm text-ink-muted">
              {tl(
                `${missing.length} still short. Pick a store to send the list.`,
                `仲爭 ${missing.length} 樣。揀間鋪發送清單。`,
              )}
            </ScalableText>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {missing.length === 0 ? (
              <View className="items-center gap-2 py-8">
                <Ionicons name="checkmark-circle" size={28} color={colors.jade} />
                <ScalableText className="text-center text-sm text-ink-muted">
                  {tl(
                    "Your pantry's already got everything for this dish.",
                    "你個雪櫃已經齊晒料，唔使補貨。",
                  )}
                </ScalableText>
              </View>
            ) : loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <View className="gap-3">
                {availability.map((store) => {
                  const cfg = RETAILERS[store.retailer];
                  const allFound = store.foundCount === store.totalCount;
                  const isBest = bestFound > 0 && store.foundCount === bestFound;
                  const busy = exporting === store.retailer;
                  return (
                    <Pressable
                      key={store.retailer}
                      accessibilityRole="button"
                      accessibilityLabel={tl(
                        `Export to ${cfg.name}, ${store.foundCount} of ${store.totalCount} items found`,
                        `發送去${cfg.nameZh}，搵到 ${store.foundCount} / ${store.totalCount} 樣`,
                      )}
                      disabled={exporting !== null}
                      onPress={() => handleExport(store.retailer)}
                      className="flex-row items-center gap-3 rounded-2xl border border-[#E4DCCB] p-3 active:opacity-80"
                    >
                      <View
                        className="h-11 w-11 items-center justify-center rounded-full"
                        style={{ backgroundColor: cfg.brandColor }}
                      >
                        <Ionicons name="storefront" size={20} color={colors.white} />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <ScalableText className="text-base font-bold text-ink">
                            {tl(cfg.name, cfg.nameZh)}
                          </ScalableText>
                          {isBest && (
                            <View className="rounded-full bg-jade-100 px-2 py-0.5">
                              <ScalableText className="text-xs font-bold text-jade">
                                {tl("Best match", "貨最齊")}
                              </ScalableText>
                            </View>
                          )}
                        </View>
                        <ScalableText
                          className={`text-sm font-medium ${allFound ? "text-jade" : "text-ink-muted"}`}
                        >
                          {tl(
                            `${store.foundCount} / ${store.totalCount} items found`,
                            `搵到 ${store.foundCount} / ${store.totalCount} 樣`,
                          )}
                        </ScalableText>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={colors.inkMuted} />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
                      )}
                    </Pressable>
                  );
                })}

                <View className="mt-1 flex-row items-start gap-2 px-1">
                  <Ionicons name="clipboard-outline" size={14} color={colors.inkFaint} />
                  <ScalableText className="flex-1 text-xs text-ink-faint">
                    {tl(
                      "We'll copy the full list and open the store, ready to paste.",
                      "我哋會複製成張清單，再打開間鋪，貼上就得。",
                    )}
                  </ScalableText>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
