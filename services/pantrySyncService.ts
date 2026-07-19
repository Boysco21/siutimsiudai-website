import { PantryItem } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "./supabase";

// Best-effort mirror of confirmed pantry rows to Supabase Postgres. The local Zustand pantry store
// is the source of truth (the app is local-first); this write-through just backs the rows up to the
// cloud so they survive a reinstall and sync across a signed-in user's devices.
//
// Security: the insert runs under the user's own JWT, and the pantry_items RLS policy
// (own_pantry_items: auth.uid() = user_id) means a client can only ever write rows for itself —
// a tampered request cannot touch anyone else's pantry. We stamp user_id from the live session,
// never from anything the client screen passed in.
//
// This never throws and returns quietly when there's nothing to do: no Supabase (Expo Go / web /
// tests), or a signed-out/guest user whose data stays purely on-device.
export async function syncPantryItemsToCloud(items: PantryItem[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  const userId = useAuthStore.getState().session?.user?.id;
  if (!userId) return; // guest / signed-out: pantry lives only in local storage

  try {
    // Let Postgres mint the uuid (id has a gen_random_uuid() default) and set updated_at via its
    // trigger; we only supply the owned columns. RLS re-checks user_id === auth.uid() on write.
    const { error } = await supabase.from("pantry_items").insert(
      items.map((it) => ({
        user_id: userId,
        name: it.name,
        name_zh: it.nameZh,
        quantity: it.quantity,
        unit: it.unit,
        in_stock: it.inStock,
      })),
    );
    // Swallow a returned error: the row is already safe in the local store, and a later full sync
    // pass can reconcile. We surface nothing to the user for a background backup.
    if (error) return;
  } catch {
    // Network/transport failure: same reasoning — local store already holds the confirmed rows.
  }
}
