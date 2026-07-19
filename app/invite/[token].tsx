import { useLocalSearchParams } from "expo-router";
import { AcceptInvitationScreen } from "@/screens/AcceptInvitationScreen";

// Deep-link target for https://siutimsiudai.app/invite/<token> (and the siutimsiudai:// + exp://
// equivalents). The raw token rides in the path; the composed body resolves it, shows who is
// inviting, and links the accounts only on an explicit tap.
export default function InviteAccept() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <AcceptInvitationScreen token={typeof token === "string" ? token : ""} />;
}
