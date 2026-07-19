import { ActivityIndicator, Pressable, PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScalableText } from "./ScalableText";
import { colors } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends Omit<PressableProps, "children"> {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

const container: Record<Variant, string> = {
  primary: "bg-brand",
  secondary: "bg-surface border border-[#E4DCCB]",
  ghost: "bg-transparent",
};

const textTone: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-ink",
  ghost: "text-brand",
};

const iconTone: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  ghost: colors.brand,
};

// 44pt minimum height and an optional leading icon keep primary actions easy to hit and
// recognise. Disabled and loading states share one dimmed style.
export function Button({
  label,
  icon,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...rest
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 active:opacity-80 ${container[variant]} ${inactive ? "opacity-50" : ""} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={iconTone[variant]} />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={iconTone[variant]} />
      ) : null}
      <ScalableText className={`text-base font-semibold ${textTone[variant]}`}>{label}</ScalableText>
    </Pressable>
  );
}
