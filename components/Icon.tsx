import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

export type IconName = keyof typeof Ionicons.glyphMap;

// Thin wrapper so screens reference a single Icon API; primary actions pair one of these
// with a text label for older users who navigate by recognisable glyphs.
export function Icon({
  name,
  size = 24,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
