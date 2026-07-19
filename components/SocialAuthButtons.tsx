import { ActivityIndicator, Pressable, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { ScalableText } from "./ScalableText";

// Official-style third-party sign-in buttons. Rendered with brand-guideline colours and marks so
// they read as the standard Apple / Google buttons, while staying pure JS (no native modules) so
// the whole flow runs in Expo Go and on web. They drive Supabase browser OAuth, not native SDKs.

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
}

const BASE =
  "min-h-[48px] w-full flex-row items-center justify-center gap-3 rounded-xl px-4 py-3 active:opacity-80";

// Apple: black button, white wordmark + logo (Apple Human Interface Guidelines).
export function AppleAuthButton({ onPress, loading, disabled, label }: Props) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      onPress={onPress}
      className={`${BASE} bg-black ${inactive ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {/* Nudge the glyph up a hair; Apple's mark sits slightly high in its box. */}
          <FontAwesome name="apple" size={19} color="#FFFFFF" style={{ marginTop: -2 }} />
          <ScalableText className="text-base font-semibold text-white">{label}</ScalableText>
        </>
      )}
    </Pressable>
  );
}

// The official four-colour Google "G" mark.
function GoogleGLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

// Google: white button, neutral border, dark text + colour mark (Google branding guidelines).
export function GoogleAuthButton({ onPress, loading, disabled, label }: Props) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      onPress={onPress}
      className={`${BASE} border border-[#747775] bg-white ${inactive ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <>
          <GoogleGLogo />
          <ScalableText className="text-base font-semibold text-[#1F1F1F]">{label}</ScalableText>
        </>
      )}
    </Pressable>
  );
}
