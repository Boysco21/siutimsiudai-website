# Siu Tim Siu Dai (少甜少底) — Hong Kong Meal Tracker + Recipe App

Cross-platform mobile app for the Hong Kong market: multi-modal nutrition logging, a smart recipe box, and pantry/grocery management. Bilingual English / Traditional Chinese throughout.

## Stack

- Expo (SDK 52) + React Native + TypeScript, file-based routing via expo-router.
- NativeWind v4 (Tailwind) for styling. Theme tokens in `tailwind.config.js` and `constants/theme.ts`.
- Zustand + `persist` over AsyncStorage for global state and offline cache.
- expo-camera (barcode + capture), expo-image-picker, expo-localization.
- i18next + react-i18next, resources in `i18n/`.
- Supabase JS (auth, Postgres, Storage). Defined now, wired live later. App is local-first today.

## Scripts

- `npm install` then `npx expo start` to run. Open in Expo Go or a simulator.
- `npm test` runs Jest on pure logic (unit converter, grocery merge, NLP mock).
- `npm run typecheck` runs `tsc --noEmit`.
- If install reports version drift, run `npx expo install --fix`.

## Runtime rules

- Requires Node 18+.
- Everything runs in standard Expo Go. No custom native modules. AI features (vision, NLP, OCR, URL scrape, substitution) are mock services behind stable interfaces in `services/`; swap in a real provider by replacing one file, no UI change.
- Camera and barcode use expo-camera and work in Expo Go. Real on-device OCR/vision later needs react-native-vision-camera + ML Kit and an EAS dev build.

## Conventions

- All entity shapes are explicit `interface`s in `types/`. Prefer interfaces over type unions.
- Bilingual data is paired fields: `name` + `name_zh`, `title` + `title_zh`, etc. UI picks per `useAppStore.locale` and falls back gracefully.
- Hong Kong wet-market math is fixed in `utils/unitConverter.ts`: 1 catty (斤) = 604.79g, 1 tael (兩) = 37.8g, 16 taels = 1 catty. Never use Mainland rounded values (500g jin / 50g liang).
- Grocery merging is bilingual-aware via `utils/groceryMerge.ts` and the EN/zh-Hant dictionary in `constants/ingredientDictionary.ts`.
- Accessibility: respect OS dynamic text size (`fontScale`), keep touch targets >= 44pt, pair prominent icons with labels.
- Progressive disclosure: the calorie ring is the hero; macros and advanced options hide behind drawers/toggles.

## Layout

`app/` routes, `components/` UI, `screens/` composed bodies, `services/` mock services, `stores/` Zustand, `database/` SQL, `types/` interfaces, `i18n/` locales, `utils/` pure logic, `constants/` tokens and data.
