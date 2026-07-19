import { View } from "react-native";

// Stable entry route. It renders nothing but the app background; the route gate in app/_layout.tsx
// redirects to the correct destination (onboarding / auth / profile / tabs) as soon as the stores
// hydrate and auth initializes. The splash overlay covers this frame, so it never flashes.
export default function Index() {
  return <View className="flex-1 bg-surface" />;
}
