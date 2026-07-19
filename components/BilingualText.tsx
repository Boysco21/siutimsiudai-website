import { TextProps } from "react-native";
import { ScalableText } from "./ScalableText";
import { useLocale } from "@/hooks/useLocale";

interface Props extends TextProps {
  en: string;
  zh: string;
}

// Renders the locale-appropriate side of a paired name/nameZh field, falling back to the
// other language when one side is empty.
export function BilingualText({ en, zh, ...rest }: Props) {
  const { tl } = useLocale();
  return <ScalableText {...rest}>{tl(en, zh)}</ScalableText>;
}
