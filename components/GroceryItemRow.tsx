import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/hooks/useLocale";
import { formatQuantity } from "@/utils/formatters";
import { displayInSystem } from "@/utils/unitConverter";
import { GroceryListItem, MeasurementSystem } from "@/types";

interface Props {
  item: GroceryListItem;
  system: MeasurementSystem;
  onToggle: () => void;
}

// A single shopping line. Badges expose the two compiler behaviours: how many raw labels
// folded into this row (bilingual merge) and whether the pantry already covers it.
export function GroceryItemRow({ item, system, onToggle }: Props) {
  const { t, tl, locale } = useLocale();
  const measure = item.quantity > 0 ? displayInSystem(item.quantity, item.unit, system) : null;
  const unitLabel = measure ? (locale === "zh-Hant" ? measure.unitZh : measure.unit) : "";
  const mergedCount = item.mergedFrom.length;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={tl(item.name, item.nameZh)}
      onPress={onToggle}
      className="flex-row items-center gap-3 border-b border-[#E8E1D2] py-2.5 active:opacity-70"
    >
      <Ionicons
        name={item.checked ? "checkbox" : "square-outline"}
        size={24}
        color={item.checked ? colors.brand : colors.inkFaint}
      />
      <View className="flex-1">
        <ScalableText
          className={`text-base font-semibold ${
            item.checked ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {tl(item.name, item.nameZh)}
        </ScalableText>
        {(mergedCount > 1 || item.inPantry) && (
          <View className="flex-row flex-wrap gap-1.5 pt-0.5">
            {mergedCount > 1 && (
              <View className="rounded-full bg-surface-sunken px-2 py-0.5">
                <ScalableText className="text-xs font-semibold text-ink-muted">
                  {mergedCount} {t("grocery.merged")}
                </ScalableText>
              </View>
            )}
            {item.inPantry && (
              <View className="rounded-full bg-jade/10 px-2 py-0.5">
                <ScalableText className="text-xs font-semibold text-jade">
                  {t("grocery.fromPantry")}
                </ScalableText>
              </View>
            )}
          </View>
        )}
      </View>
      {measure ? (
        <ScalableText className={`text-sm ${item.checked ? "text-ink-faint" : "text-ink"}`}>
          {formatQuantity(measure.quantity)} {unitLabel}
        </ScalableText>
      ) : item.inPantry ? (
        <Ionicons name="checkmark-done" size={18} color={colors.jade} />
      ) : null}
    </Pressable>
  );
}
