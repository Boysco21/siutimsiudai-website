import { InviteFamilyScreen } from "@/screens/InviteFamilyScreen";

// Thin route wrapper. The composed body lives in screens/ so the family manager view can be opened
// from the profile tab via router.push("/family/invite").
export default function FamilyInvite() {
  return <InviteFamilyScreen />;
}
