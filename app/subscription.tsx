import { SubscriptionScreen } from "@/screens/SubscriptionScreen";

// Thin route wrapper. The composed body lives in screens/ so the paywall can also be opened
// from anywhere via router.push("/subscription") (see hooks/useFeatureAccess triggerPaywall).
export default function Subscription() {
  return <SubscriptionScreen />;
}
