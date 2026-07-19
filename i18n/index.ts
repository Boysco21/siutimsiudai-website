import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { Locale } from "@/types";
import enStrings from "./en.json";
import zhStrings from "./zh-Hant.json";

const resources = {
  en: { translation: enStrings },
  "zh-Hant": { translation: zhStrings },
};

export function detectInitialLocale(): Locale {
  try {
    const first = getLocales()[0];
    const tag = (first?.languageTag ?? first?.languageCode ?? "en").toLowerCase();
    if (tag.startsWith("zh")) return "zh-Hant";
  } catch {
    // expo-localization can throw on web SSR; fall back to English.
  }
  return "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectInitialLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export function setI18nLocale(locale: Locale): void {
  if (i18n.language !== locale) {
    i18n.changeLanguage(locale);
  }
}

/** Pick a localized data field (name vs nameZh) for the active locale. */
export function pick(locale: Locale, en: string, zh: string): string {
  return locale === "zh-Hant" ? zh || en : en || zh;
}

export default i18n;
