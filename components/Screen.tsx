import { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

interface Props {
  children: ReactNode;
  className?: string;
  edges?: Edge[];
}

// Standard screen frame: safe-area aware, app background, fills the viewport.
export function Screen({ children, className, edges = ["top"] }: Props) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-surface-subtle">
      <View className={`flex-1 ${className ?? ""}`}>{children}</View>
    </SafeAreaView>
  );
}
