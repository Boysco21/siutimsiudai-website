import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import { Locale } from "@/types";

/**
 * One hook for everything language-related: the active locale, the i18next `t` for UI
 * strings, and `tl(en, zh)` for picking the right side of a bilingual data field.
 */
export function useLocale(): {
  locale: Locale;
  t: ReturnType<typeof useTranslation>["t"];
  tl: (en: string, zh: string) => string;
} {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation();
  const tl = (en: string, zh: string) => (locale === "zh-Hant" ? zh || en : en || zh);
  return { locale, t, tl };
}
