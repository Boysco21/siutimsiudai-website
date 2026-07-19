import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, PersistStorage, StateStorage } from "zustand/middleware";

// The app was renamed from "sikfan" to "siutimsiudai" (少甜少底). Persisted stores keyed their
// data under the old prefix, so the first time a new-prefixed key is read we pull any legacy
// value forward and delete the stale copy — keeping every already-logged meal, recipe, and
// pantry item across the rename. Once migrated, no legacy keys remain and this is a plain
// pass-through. Every store shares the `<prefix>-<store>` key shape, so one generic hook covers
// them all.
const LEGACY_PREFIX = "sikfan-";
const CURRENT_PREFIX = "siutimsiudai-";

const migratingStorage: StateStorage = {
  getItem: async (name) => {
    const current = await AsyncStorage.getItem(name);
    if (current != null || !name.startsWith(CURRENT_PREFIX)) return current;
    const legacyName = LEGACY_PREFIX + name.slice(CURRENT_PREFIX.length);
    const legacy = await AsyncStorage.getItem(legacyName);
    if (legacy == null) return null;
    await AsyncStorage.setItem(name, legacy);
    await AsyncStorage.removeItem(legacyName);
    return legacy;
  },
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

// Shared AsyncStorage-backed JSON storage for every persisted store. Swapping in a
// different driver later (e.g. expo-secure-store for the session) is a one-line change.
// JSON storage is shape-agnostic at runtime, so a single instance serves every store;
// the PersistStorage<any> annotation lets it slot into stores of any persisted shape.
export const persistStorage = createJSONStorage(() => migratingStorage) as PersistStorage<any>;
