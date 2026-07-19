// Lightweight client-side id generator for locally-created rows. Real rows get a
// uuid from Postgres once Supabase is wired; these only need to be unique on device.
let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
