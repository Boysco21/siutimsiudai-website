import { Stack } from "expo-router";

// Auth flow is a plain (non-group) directory so the routes have real URLs — /auth/sign-in,
// /auth/verify-email, /auth/callback — which the email confirmation deep link can target.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
