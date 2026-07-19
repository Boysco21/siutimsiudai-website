import { View, ViewProps } from "react-native";

export function Card({ className, ...props }: ViewProps) {
  return <View className={`rounded-2xl border border-[#E4DCCB] bg-surface p-4 ${className ?? ""}`} {...props} />;
}
