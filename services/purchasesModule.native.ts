// Native (iOS / Android) resolution of the RevenueCat loader.
//
// We require the SDK inside a try/catch so a runtime without the compiled native module —
// most importantly Expo Go, which cannot bundle third-party native code — degrades to null
// instead of throwing while the JS module graph is still loading. Requiring the JavaScript is
// safe there; only *calling* a native method would throw, and revenueCatService guards every
// call behind an availability check. On a real dev/production build the native module is
// present and this hands back the fully functional Purchases class.
type PurchasesClass = typeof import("react-native-purchases").default;

let PurchasesSDK: PurchasesClass | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PurchasesSDK = require("react-native-purchases").default;
} catch {
  PurchasesSDK = null;
}

export { PurchasesSDK };
