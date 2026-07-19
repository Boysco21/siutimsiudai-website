// Shared Jest setup, registered via the "setupFiles" hook in package.json so it runs before any
// test module is imported.
//
// The native AsyncStorage module has no JS implementation under Jest, so any test that imports a
// Zustand store (every store persists through AsyncStorage) would otherwise throw at import time.
// Swapping in the library's official mock lets pure-logic tests import stores freely — which is
// how the entitlement-tier resolver is unit-tested without booting the persistence layer.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
