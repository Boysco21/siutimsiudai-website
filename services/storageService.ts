import { delay } from "./util";

export type StorageBucket = "meal-images" | "recipe-images";

export interface StorageService {
  // Returns a URL the app can render. Local stub just echoes the device uri back;
  // the real implementation uploads to the matching Supabase Storage bucket.
  upload(uri: string, bucket: StorageBucket): Promise<string>;
}

export const storageService: StorageService = {
  async upload(uri) {
    await delay(300);
    return uri;
  },
};
