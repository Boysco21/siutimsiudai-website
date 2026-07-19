// Type contract for the platform-split RevenueCat loader. `tsc` resolves the bare
// "./purchasesModule" import to this declaration, while Metro swaps in purchasesModule.native.ts
// (real SDK) or purchasesModule.web.ts (null) at bundle time. The `typeof import(...)` type is
// erased at compile time, so referencing it here never drags the native module into any bundle.
type PurchasesClass = typeof import("react-native-purchases").default;

// The RevenueCat SDK class on a native build where the module loaded, or null on web and in any
// runtime that lacks the compiled native binary (e.g. Expo Go). Consumers MUST null-check.
export declare const PurchasesSDK: PurchasesClass | null;
