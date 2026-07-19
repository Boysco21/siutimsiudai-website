import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistStorage } from "@/stores/persistStorage";

// The app was renamed from sikfan to siutimsiudai (少甜少底). persistStorage transparently pulls
// any value saved under the old key prefix forward to the new one the first time the new key is
// read, so an existing user's logged meals / recipes / pantry survive the rename. These tests lock
// that behaviour in — a regression here would silently orphan real user data on upgrade.
describe("persisted key migration (sikfan- -> siutimsiudai-)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("carries legacy data forward and removes the stale key", async () => {
    const legacy = JSON.stringify({ state: { items: [1, 2, 3] }, version: 0 });
    await AsyncStorage.setItem("sikfan-pantry", legacy);

    const migrated = await persistStorage.getItem("siutimsiudai-pantry");

    // createJSONStorage parses the JSON, so we get the stored shape back.
    expect(migrated).toEqual({ state: { items: [1, 2, 3] }, version: 0 });
    // The value now lives under the new key and the old copy is gone.
    expect(await AsyncStorage.getItem("siutimsiudai-pantry")).toBe(legacy);
    expect(await AsyncStorage.getItem("sikfan-pantry")).toBeNull();
  });

  it("prefers data already under the new key over any legacy copy", async () => {
    await AsyncStorage.setItem(
      "sikfan-recipes",
      JSON.stringify({ state: { recipes: ["old"] }, version: 0 }),
    );
    await AsyncStorage.setItem(
      "siutimsiudai-recipes",
      JSON.stringify({ state: { recipes: ["new"] }, version: 0 }),
    );

    const got = await persistStorage.getItem("siutimsiudai-recipes");

    expect(got).toEqual({ state: { recipes: ["new"] }, version: 0 });
    // Legacy key is only consumed when the new key is empty, so it is left untouched here.
    expect(await AsyncStorage.getItem("sikfan-recipes")).not.toBeNull();
  });

  it("returns null when neither the new nor the legacy key exists", async () => {
    expect(await persistStorage.getItem("siutimsiudai-grocery")).toBeNull();
  });
});
