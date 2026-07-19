// Web (Expo Web preview) resolution of the RevenueCat loader.
//
// A native In-App Purchase SDK has no place in a browser bundle, so we hand back null
// unconditionally. The `typeof import(...)` below lives only in a type position and is erased at
// compile time, so Metro never pulls react-native-purchases into the web bundle. revenueCatService
// sees null, reports itself "unavailable", and serves its simulated checkout — which is exactly
// what powers the reviewable in-browser demo without touching the App Store.
type PurchasesClass = typeof import("react-native-purchases").default;

export const PurchasesSDK: PurchasesClass | null = null;
