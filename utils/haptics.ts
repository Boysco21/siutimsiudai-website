import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Thin wrappers so call sites don't repeat the web guard. expo-haptics is a no-op on web,
// but we skip it there anyway to avoid any console noise. Failures are swallowed: haptics
// are a nicety, never worth throwing over.

/** A crisp selection tick, like a waiter ticking an order on a notepad. */
export function tick() {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync().catch(() => {});
}

/** A light confirming tap, for committing an action. */
export function tapLight() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
