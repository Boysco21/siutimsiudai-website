import { Locale } from "@/types";

export function formatCalories(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function clampPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
}

export function formatQuantity(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Seven ISO date keys for the Monday-first week containing `start`. */
export function weekDates(start: Date = new Date()): string[] {
  const d = new Date(start);
  const offsetToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offsetToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return todayKey(x);
  });
}

export function shortTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale === "zh-Hant" ? "zh-HK" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function weekdayShort(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString(locale === "zh-Hant" ? "zh-HK" : "en-US", { weekday: "short" });
}

export function dayOfMonth(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}
